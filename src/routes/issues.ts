import { Router,type Request,type Response } from 'express';
import prisma from '../db/prisma.js';
import { authenticate } from '../middleware/auth.js';
import { config } from '../config/env.js';

const router = Router();

router.get('/', authenticate, async (req: Request, res: Response) => {
  try {
    const issues = await prisma.issue.findMany({
      where: { userId: req.user!.id },
      orderBy: { createdAt: 'desc' },
    });

    res.json({ issues });
  } catch (error) {
    console.error('Get issues error:', error);
    res.status(500).json({ error: 'Failed to get issues' });
  }
});

router.post('/', authenticate, async (req: Request, res: Response) => {
  try {
    const { title, description, severity } = req.body;

    if (!title || !description) {
      return res.status(400).json({ error: 'Title and description required' });
    }

    const validSeverities = ['low', 'medium', 'high', 'critical'];
    const issueSeverity = validSeverities.includes(severity) ? severity : 'medium';

    const issue = await prisma.issue.create({
      data: {
        userId: req.user!.id,
        title,
        description,
        severity: issueSeverity,
        status: 'open',
      },
    });

    let githubIssueUrl: string | null = null;
    let githubIssueId: string | null = null;

    if (config.github.token && config.github.repoOwner && config.github.repoName) {
      try {
        const response = await fetch(
          `https://api.github.com/repos/${config.github.repoOwner}/${config.github.repoName}/issues`,
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${config.github.token}`,
              'Content-Type': 'application/json',
              Accept: 'application/vnd.github.v3+json',
              'User-Agent': 'Twitch-Ads-Blocker',
            },
            body: JSON.stringify({
              title: `[${issueSeverity.toUpperCase()}] ${title}`,
              body: `## Issue Report\n\n**Reported by:** ${req.user!.displayName} (@${req.user!.login})\n**Severity:** ${issueSeverity}\n**App Issue ID:** ${issue.id}\n\n### Description\n${description}\n\n---\n*This issue was reported through the Twitch Ads Blocker web app.*`,
              labels: ['bug', `severity-${issueSeverity}`, 'app-reported'],
            }),
          }
        );

        if (response.ok) {
          const githubIssue: any = await response.json();
          githubIssueUrl = githubIssue.html_url;
          githubIssueId = String(githubIssue.number);

          await prisma.issue.update({
            where: { id: issue.id },
            data: {
              githubIssueUrl,
              githubIssueId,
            },
          });

          issue.githubIssueUrl = githubIssueUrl;
          issue.githubIssueId = githubIssueId;
        }
      } catch (githubError) {
        console.error('Failed to create GitHub issue:', githubError);
      }
    }

    await prisma.userActivity.create({
      data: {
        userId: req.user!.id,
        activityType: 'issue_created',
        metadata: JSON.stringify({ issueId: issue.id, title }),
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      },
    });

    res.json({ issue });
  } catch (error) {
    console.error('Create issue error:', error);
    res.status(500).json({ error: 'Failed to create issue' });
  }
});

router.get('/:id', authenticate, async (req: Request, res: Response) => {
  try {
    const { id } = req.params as unknown as { id: string };

    const issue = await prisma.issue.findFirst({
      where: {
        id,
        userId: req.user!.id,
      },
    });

    if (!issue) {
      return res.status(404).json({ error: 'Issue not found' });
    }

    res.json({ issue });
  } catch (error) {
    console.error('Get issue error:', error);
    res.status(500).json({ error: 'Failed to get issue' });
  }
});

router.patch('/:id', authenticate, async (req: Request, res: Response) => {
  try {
    const { id } = req.params as unknown as { id: string };
    const { status } = req.body;

    const issue = await prisma.issue.findFirst({
      where: {
        id,
        userId: req.user!.id,
      },
    });

    if (!issue) {
      return res.status(404).json({ error: 'Issue not found' });
    }

    const updated = await prisma.issue.update({
      where: { id },
      data: { status },
    });

    res.json({ issue: updated });
  } catch (error) {
    console.error('Update issue error:', error);
    res.status(500).json({ error: 'Failed to update issue' });
  }
});

export default router;
