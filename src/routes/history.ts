import { Router,type Request,type Response } from 'express';
import prisma from '../db/prisma.ts';
import { authenticate } from '../middleware/auth.js';

const router = Router();

router.get('/', authenticate, async (req: Request, res: Response) => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
    const offset = parseInt(req.query.offset as string) || 0;

    const history = await prisma.viewHistory.findMany({
      where: { userId: req.user!.id },
      orderBy: { watchedAt: 'desc' },
      take: limit,
      skip: offset,
    });

    const total = await prisma.viewHistory.count({
      where: { userId: req.user!.id },
    });

    res.json({ history, total });
  } catch (error) {
    console.error('Get history error:', error);
    res.status(500).json({ error: 'Failed to get history' });
  }
});

router.post('/', authenticate, async (req: Request, res: Response) => {
  try {
    console.log("RECEIVED HISTORY DATA::", req.body);
    const { streamId, channelName, channelLogin, gameName, title, thumbnailUrl } = req.body;

    await prisma.viewHistory.create({
      data: {
        userId: req.user!.id,
        streamId: streamId || 'unknown',
        channelName: channelName || 'Unknown Streamer',
        channelLogin: channelLogin || 'unknown',
        gameName: gameName || 'Just Chatting',
        title: title || 'Untitled Stream',
        thumbnailUrl: (thumbnailUrl || '').replace('{width}', '320').replace('{height}', '180') || 'https://fallback-thumbnail-url.com/default.jpg',
      },
    });

    await prisma.userActivity.create({
      data: {
        userId: req.user!.id,
        activityType: 'watch',
        metadata: JSON.stringify({ streamId, channelName }),
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      },
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Add history error:', error);
    res.status(500).json({ error: 'Failed to add history' });
  }
});

router.delete('/:id', authenticate, async (req: Request, res: Response) => {
  try {
    const { id } = req.params as unknown as { id: string };

    await prisma.viewHistory.deleteMany({
      where: {
        id,
        userId: req.user!.id,
      },
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Delete history error:', error);
    res.status(500).json({ error: 'Failed to delete history' });
  }
});

router.delete('/', authenticate, async (req: Request, res: Response) => {
  try {
    await prisma.viewHistory.deleteMany({
      where: { userId: req.user!.id },
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Clear history error:', error);
    res.status(500).json({ error: 'Failed to clear history' });
  }
});

export default router;
