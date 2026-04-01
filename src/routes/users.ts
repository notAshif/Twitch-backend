import { Router,type Request,type Response } from 'express';
import prisma from '../db/prisma';
import { authenticate } from '../middleware/auth.js';

const router = Router();

router.get('/me', authenticate, async (req: Request, res: Response) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: {
        id: true,
        twitchId: true,
        login: true,
        displayName: true,
        profileImageUrl: true,
        email: true,
        role: true,
        createdAt: true,
      },
    });

    res.json({ user });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ error: 'Failed to get user' });
  }
});

router.patch('/me', authenticate, async (req: Request, res: Response) => {
  try {
    const { displayName } = req.body;

    const user = await prisma.user.update({
      where: { id: req.user!.id },
      data: { displayName },
      select: {
        id: true,
        twitchId: true,
        login: true,
        displayName: true,
        profileImageUrl: true,
        email: true,
        role: true,
      },
    });

    res.json({ user });
  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json({ error: 'Failed to update user' });
  }
});

export default router;
