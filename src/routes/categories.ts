import { Router, type Request, type Response } from 'express';
import * as crypto from 'crypto';
import prisma from '../db/prisma';
import { twitchService } from '../services/twitch';
import { authenticate } from '../middleware/auth';
import { config } from '../config/env';

const router = Router();

function decryptToken(encrypted: string): string {
  const key = Buffer.from(config.encryption.key.padEnd(32, '0').slice(0, 32));
  const [ivHex, encryptedData] = encrypted.split(':');
  if (!ivHex || !encryptedData) throw new Error('Invalid encrypted token format');
  const iv = Buffer.from(ivHex, 'hex');
  const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
  let decrypted = decipher.update(encryptedData!, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

router.get('/trending', authenticate, async (req: Request, res: Response) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user!.id } });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const accessToken = decryptToken(user.accessTokenEnc);
    const categories = await twitchService.getTopCategories(accessToken);

    res.json({ categories });
  } catch (error) {
    console.error('Get trending error:', error);
    res.status(500).json({ error: 'Failed to get trending categories' });
  }
});

router.get('/search', authenticate, async (req: Request, res: Response) => {
  try {
    const { q } = req.query;
    if (!q || typeof q !== 'string') {
      return res.status(400).json({ error: 'Search query required' });
    }

    const user = await prisma.user.findUnique({ where: { id: req.user!.id } });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const accessToken = decryptToken(user.accessTokenEnc);
    const [categories, channels] = await Promise.all([
      twitchService.searchCategories(accessToken, q),
      twitchService.searchChannels(accessToken, q),
    ]);

    res.json({ categories, channels });
  } catch (error) {
    console.error('Search error:', error);
    res.status(500).json({ error: 'Failed to search' });
  }
});

router.get('/search/channels', authenticate, async (req: Request, res: Response) => {
  try {
    const { q } = req.query;
    if (!q || typeof q !== 'string') {
      return res.status(400).json({ error: 'Search query required' });
    }

    const user = await prisma.user.findUnique({ where: { id: req.user!.id } });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const accessToken = decryptToken(user.accessTokenEnc);
    const channels = await twitchService.searchChannels(accessToken, q);

    res.json({ channels });
  } catch (error) {
    console.error('Search channels error:', error);
    res.status(500).json({ error: 'Failed to search channels' });
  }
});

router.get('/:id', authenticate, async (req: Request, res: Response) => {
  try {
    const { id } = req.params as unknown as { id: string };

    let category = await prisma.category.findUnique({ where: { id } });

    if (!category) {
      const user = await prisma.user.findUnique({ where: { id: req.user!.id } });
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      const accessToken = decryptToken(user.accessTokenEnc);
      const cat = await twitchService.getCategoryById(accessToken, id);

      if (cat) {
        category = await prisma.category.create({
          data: {
            id: cat.id,
            name: cat.name,
            boxArtUrl: cat.box_art_url,
          },
        });
      }
    }

    if (!category) {
      return res.status(404).json({ error: 'Category not found' });
    }

    const user = await prisma.user.findUnique({ where: { id: req.user!.id } });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const accessToken = decryptToken(user.accessTokenEnc);
    const streams = await twitchService.getCategoryStreams(accessToken, id);

    res.json({ category, streams });
  } catch (error) {
    console.error('Get category error:', error);
    res.status(500).json({ error: 'Failed to get category' });
  }
});

router.post('/pin', authenticate, async (req: Request, res: Response) => {
  try {
    const { categoryId, name, boxArtUrl } = req.body;

    let category = await prisma.category.findUnique({ where: { id: categoryId } });
    if (!category && name && boxArtUrl) {
      category = await prisma.category.create({
        data: {
          id: categoryId,
          name,
          boxArtUrl,
        },
      });
    }

    if (!category) {
      return res.status(404).json({ error: 'Category not found' });
    }

    const pinned = await prisma.pinnedCategory.create({
      data: {
        userId: req.user!.id,
        categoryId: category.id,
      },
    });

    res.json({ pinned });
  } catch (error) {
    console.error('Pin category error:', error);
    res.status(500).json({ error: 'Failed to pin category' });
  }
});

router.delete('/pin/:categoryId', authenticate, async (req: Request, res: Response) => {
  try {
    const { categoryId } = req.params as unknown as { categoryId: string };

    await prisma.pinnedCategory.deleteMany({
      where: {
        userId: req.user!.id,
        categoryId,
      },
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Unpin category error:', error);
    res.status(500).json({ error: 'Failed to unpin category' });
  }
});

router.get('/pinned/list', authenticate, async (req: Request, res: Response) => {
  try {
    const pinned = await prisma.pinnedCategory.findMany({
      where: { userId: req.user!.id },
      include: { category: true },
      orderBy: { pinnedAt: 'desc' },
    });

    res.json({ pinned: pinned.map((p: any) => p.category) });
  } catch (error) {
    console.error('Get pinned error:', error);
    res.status(500).json({ error: 'Failed to get pinned categories' });
  }
});

export default router;
