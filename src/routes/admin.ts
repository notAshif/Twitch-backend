import { Router, type Request, type Response } from 'express';
import prisma from '../db/prisma.js';
import { authenticate, requireAdmin } from '../middleware/auth.js';

const router = Router();

router.get('/stats', authenticate, requireAdmin, async (req: Request, res: Response) => {
  try {
    const [
      totalUsers,
      activeUsers,
      totalSessions,
      totalActivities,
      recentActivities,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.session.count({
        where: { expiresAt: { gt: new Date() } },
      }),
      prisma.session.count(),
      prisma.userActivity.count(),
      prisma.userActivity.findMany({
        take: 20,
        orderBy: { createdAt: 'desc' },
        include: { user: { select: { login: true, displayName: true } } },
      }),
    ]);

    res.json({
      stats: {
        totalUsers,
        activeUsers,
        totalSessions,
        totalActivities,
      },
      recentActivities,
    });
  } catch (error) {
    console.error('Admin stats error:', error);
    res.status(500).json({ error: 'Failed to get stats' });
  }
});

router.get('/users', authenticate, requireAdmin, async (req: Request, res: Response) => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
    const offset = parseInt(req.query.offset as string) || 0;

    const users = await prisma.user.findMany({
      select: {
        id: true,
        twitchId: true,
        login: true,
        displayName: true,
        profileImageUrl: true,
        email: true,
        role: true,
        createdAt: true,
        _count: {
          select: {
            sessions: true,
            viewHistory: true,
            followedChannels: true,
            activities: true,
          },
        },
      },
      take: limit,
      skip: offset,
      orderBy: { createdAt: 'desc' },
    });

    const total = await prisma.user.count();

    res.json({ users, total });
  } catch (error) {
    console.error('Admin get users error:', error);
    res.status(500).json({ error: 'Failed to get users' });
  }
});

router.get('/users/:id', authenticate, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { id } = req.params as unknown as { id: string };

    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        twitchId: true,
        login: true,
        displayName: true,
        profileImageUrl: true,
        email: true,
        role: true,
        createdAt: true,
        sessions: {
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
        viewHistory: {
          orderBy: { watchedAt: 'desc' },
          take: 20,
        },
        followedChannels: {
          orderBy: { followedAt: 'desc' },
        },
        activities: {
          orderBy: { createdAt: 'desc' },
          take: 50,
        },
        _count: {
          select: {
            sessions: true,
            viewHistory: true,
            followedChannels: true,
            activities: true,
            issues: true,
          },
        },
      },
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ user });
  } catch (error) {
    console.error('Admin get user error:', error);
    res.status(500).json({ error: 'Failed to get user' });
  }
});

router.get('/activities', authenticate, requireAdmin, async (req: Request, res: Response) => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 100, 500);
    const offset = parseInt(req.query.offset as string) || 0;
    const type = req.query.type as string | undefined;

    const where = type ? { activityType: type } : {};

    const activities = await prisma.userActivity.findMany({
      where,
      include: {
        user: { select: { login: true, displayName: true, profileImageUrl: true } },
      },
      take: limit,
      skip: offset,
      orderBy: { createdAt: 'desc' },
    });

    const total = await prisma.userActivity.count({ where });

    res.json({ activities, total });
  } catch (error) {
    console.error('Admin activities error:', error);
    res.status(500).json({ error: 'Failed to get activities' });
  }
});

router.patch('/users/:id/role', authenticate, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { id } = req.params as unknown as { id: string };
    const { role } = req.body;

    if (!['user', 'admin'].includes(role)) {
      return res.status(400).json({ error: 'Invalid role' });
    }

    const user = await prisma.user.update({
      where: { id },
      data: { role },
      select: {
        id: true,
        login: true,
        displayName: true,
        role: true,
      },
    });

    await prisma.userActivity.create({
      data: {
        userId: id,
        activityType: 'role_change',
        metadata: JSON.stringify({ newRole: role, changedBy: req.user!.id }),
      },
    });

    res.json({ user });
  } catch (error) {
    console.error('Admin change role error:', error);
    res.status(500).json({ error: 'Failed to change role' });
  }
});

router.delete('/users/:id', authenticate, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { id } = req.params as unknown as { id: string };

    if (id === req.user!.id) {
      return res.status(400).json({ error: 'Cannot delete yourself' });
    }

    await prisma.user.delete({ where: { id } });

    res.json({ success: true });
  } catch (error) {
    console.error('Admin delete user error:', error);
    res.status(500).json({ error: 'Failed to delete user' });
  }
});

export default router;
