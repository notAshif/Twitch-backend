import { Router, type Request, type Response } from 'express';
import * as jose from 'jose';
import * as crypto from 'crypto';
import prisma from '../db/prisma';
import { twitchService } from '../services/twitch';
import { config } from '../config/env';
import { authenticate } from '../middleware/auth';

const router = Router();
const stateStore = new Map<string, { expires: number }>();

function generateState(): string {
  return crypto.randomBytes(32).toString('hex');
}

function encryptToken(token: string): string {
  const key = Buffer.from(config.encryption.key.padEnd(32, '0').slice(0, 32));
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
  let encrypted = cipher.update(token, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return iv.toString('hex') + ':' + encrypted;
}

function decryptToken(encrypted: string): string {
  try {
    const key = Buffer.from(config.encryption.key.padEnd(32, '0').slice(0, 32));
    const [ivHex, encryptedData] = encrypted.split(':');
    if (!ivHex || !encryptedData) throw new Error('Invalid encrypted token format');
    const iv = Buffer.from(ivHex, 'hex');
    const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
    let decrypted = decipher.update(encryptedData, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (e) {
    throw new Error('Failed to decrypt token: ' + (e as Error).message);
  }
}

router.get('/twitch', (req: Request, res: Response) => {
  const state = generateState();
  stateStore.set(state, { expires: Date.now() + 600000 });
  res.redirect(twitchService.getAuthUrl(state));
});

router.get('/twitch/callback', async (req: Request, res: Response) => {
  try {
    const { code, state } = req.query;
    const stateStr = typeof state === 'string' ? state : undefined;
    const codeStr = typeof code === 'string' ? code : undefined;

    if (!stateStr) {
      return res.status(400).json({ error: 'Missing state parameter' });
    }

    const storedState = stateStore.get(stateStr);
    if (!storedState || storedState.expires < Date.now()) {
      stateStore.delete(stateStr);
      return res.status(400).json({ error: 'Invalid or expired state' });
    }
    stateStore.delete(stateStr);

    if (!codeStr) {
      return res.status(400).json({ error: 'Missing authorization code' });
    }

    const tokens = await twitchService.exchangeCode(codeStr);
    const twitchUser = await twitchService.getUser(tokens.access_token);

    let user = await prisma.user.findUnique({
      where: { twitchId: twitchUser.id },
    });

    const expiresAt = new Date(Date.now() + tokens.expires_in * 1000);

    if (user) {
      user = await prisma.user.update({
        where: { id: user.id },
        data: {
          accessTokenEnc: encryptToken(tokens.access_token),
          refreshTokenEnc: encryptToken(tokens.refresh_token),
          tokenExpiresAt: expiresAt,
        },
      });
    } else {
      user = await prisma.user.create({
        data: {
          twitchId: twitchUser.id,
          login: twitchUser.login,
          displayName: twitchUser.display_name,
          profileImageUrl: twitchUser.profile_image_url,
          email: twitchUser.email || null,
          accessTokenEnc: encryptToken(tokens.access_token),
          refreshTokenEnc: encryptToken(tokens.refresh_token),
          tokenExpiresAt: expiresAt,
          role: 'user',
        },
      });

      await syncTwitchFollows(user.id, tokens.access_token);
    }

    const jti = crypto.randomBytes(32).toString('hex');
    await prisma.session.create({
      data: {
        userId: user.id,
        jti,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });

    const secret = new TextEncoder().encode(config.jwt.secret);
    const jwt = await new jose.SignJWT({ sub: user.id, jti, role: user.role })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime(config.jwt.expiresIn)
      .sign(secret);

    await prisma.userActivity.create({
      data: {
        userId: user.id,
        activityType: 'login',
        metadata: JSON.stringify({ method: 'twitch_oauth' }),
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      },
    });

    res.redirect(`${config.appUrl}?token=${jwt}`);
  } catch (error) {
    console.error('OAuth callback error:', error);
    res.status(500).json({ error: 'Authentication failed' });
  }
});

router.post('/refresh', authenticate, async (req: Request, res: Response) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const tokens = await twitchService.refreshAccessToken(
      decryptToken(user.refreshTokenEnc)
    );

    const expiresAt = new Date(Date.now() + tokens.expires_in * 1000);

    await prisma.user.update({
      where: { id: user.id },
      data: {
        accessTokenEnc: encryptToken(tokens.access_token),
        refreshTokenEnc: encryptToken(tokens.refresh_token),
        tokenExpiresAt: expiresAt,
      },
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Token refresh error:', error);
    res.status(500).json({ error: 'Failed to refresh token' });
  }
});

router.post('/logout', authenticate, async (req: Request, res: Response) => {
  try {
    if (req.sessionId) {
      await prisma.session.delete({ where: { id: req.sessionId } });
    }

    await prisma.userActivity.create({
      data: {
        userId: req.user!.id,
        activityType: 'logout',
        metadata: JSON.stringify({}),
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      },
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({ error: 'Logout failed' });
  }
});

router.get('/me', authenticate, async (req: Request, res: Response) => {
  res.json({ user: req.user });
});

async function syncTwitchFollows(userId: string, accessToken: string) {
  try {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return;

    let cursor: string | undefined;
    do {
      const follows = await twitchService.getFollowing(accessToken, user.twitchId, cursor);
      
      for (const follow of follows.data) {
        await prisma.following.upsert({
          where: {
            userId_broadcasterId: {
              userId,
              broadcasterId: follow.broadcaster_id,
            },
          },
          create: {
            userId,
            broadcasterId: follow.broadcaster_id,
            broadcasterLogin: follow.broadcaster_login,
            broadcasterName: follow.broadcaster_name,
          },
          update: {},
        });
      }

      cursor = follows.cursor;
    } while (cursor);
  } catch (error) {
    console.error('Error syncing follows:', error);
  }
}

export default router;
