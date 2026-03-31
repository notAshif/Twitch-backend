import { Router, type Request, type Response } from 'express';
import prisma from '../db/prisma.ts';
import { twitchService } from '../services/twitch.ts';
import { authenticate } from '../middleware/auth.ts';
import { config } from '../config/env.ts';

const router = Router();

function encryptToken(token: string): string {
  const crypto = require('crypto');
  const key = Buffer.from(config.encryption.key.padEnd(32, '0').slice(0, 32));
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
  let encrypted = cipher.update(token, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return iv.toString('hex') + ':' + encrypted;
}

function decryptToken(encrypted: string): string {
  const crypto = require('crypto');
  const key = Buffer.from(config.encryption.key.padEnd(32, '0').slice(0, 32));
  const [ivHex, encryptedData] = encrypted.split(':');
  const iv = Buffer.from(ivHex!, 'hex');
  const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
  let decrypted = decipher.update(encryptedData, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

router.get('/', authenticate, async (req: Request, res: Response) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user!.id } });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const accessToken = decryptToken(user.accessTokenEnc);
    const streams = await twitchService.getLiveFollowedStreams(accessToken, user.twitchId);

    res.json({ streams });
  } catch (error) {
    console.error('Get following error:', error);
    res.status(500).json({ error: 'Failed to get following' });
  }
});

router.get('/live', authenticate, async (req: Request, res: Response) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user!.id } });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const accessToken = decryptToken(user.accessTokenEnc);
    const streams = await twitchService.getLiveFollowedStreamsWithUsers(accessToken, user.twitchId);

    res.json({ streams });
  } catch (error) {
    console.error('Get live streams error:', error);
    res.status(500).json({ error: 'Failed to get live streams' });
  }
});

router.post('/sync', authenticate, async (req: Request, res: Response) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user!.id } });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const accessToken = decryptToken(user.accessTokenEnc);
    let cursor: string | undefined = undefined;
    let totalSynced = 0;

    do {
      const follows = await twitchService.getFollowing(accessToken, user.twitchId, cursor, 100);
      
      for (const follow of follows.data) {
        await prisma.following.upsert({
          where: {
            userId_broadcasterId: {
              userId: user.id,
              broadcasterId: follow.broadcaster_id,
            },
          },
          create: {
            userId: user.id,
            broadcasterId: follow.broadcaster_id,
            broadcasterLogin: follow.broadcaster_login,
            broadcasterName: follow.broadcaster_name,
          },
          update: {
            broadcasterLogin: follow.broadcaster_login,
            broadcasterName: follow.broadcaster_name,
          },
        });
      }
      
      totalSynced += follows.data.length;
      cursor = follows.cursor;
    } while (cursor && totalSynced < 1000);

    res.json({ success: true, synced: totalSynced });
  } catch (error) {
    console.error('Sync follows error:', error);
    res.status(500).json({ error: 'Failed to sync follows' });
  }
});

router.get('/channels', authenticate, async (req: Request, res: Response) => {
  try {
    const follows = await prisma.following.findMany({
      where: { userId: req.user!.id },
      orderBy: { followedAt: 'desc' },
    });

    res.json({ following: follows });
  } catch (error) {
    console.error('Get channels error:', error);
    res.status(500).json({ error: 'Failed to get channels' });
  }
});

export default router;
