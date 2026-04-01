import type { Request, Response, NextFunction } from 'express';
import * as jose from 'jose';
import { prisma } from '../db/prisma';
import { config } from '../config/env';

export async function authenticate(req: Request, res: Response, next: NextFunction) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const token = authHeader.substring(7);
    
    const secret = new TextEncoder().encode(config.jwt.secret);
    const { payload } = await jose.jwtVerify(token, secret);

    if (!payload.jti || !payload.sub) {
      return res.status(401).json({ error: 'Invalid token payload' });
    }

    const session = await prisma.session.findUnique({
      where: { jti: payload.jti },
      include: { user: true },
    });

    if (!session) {
      return res.status(401).json({ error: 'Session not found' });
    }

    if (session.expiresAt < new Date()) {
      await prisma.session.delete({ where: { id: session.id } });
      return res.status(401).json({ error: 'Session expired' });
    }

    req.user = {
      id: session.user.id,
      twitchId: session.user.twitchId,
      login: session.user.login,
      displayName: session.user.displayName,
      profileImageUrl: session.user.profileImageUrl,
      email: session.user.email,
      role: session.user.role,
    };
    req.sessionId = session.id;

    next();
  } catch (error) {
    if (error instanceof jose.errors.JWTExpired) {
      return res.status(401).json({ error: 'Token expired' });
    }
    return res.status(401).json({ error: 'Invalid token' });
  }
}

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
}
