import { Router, Request, Response } from 'express';
import { requireAuth } from '../middleware/authMiddleware';
import { searchEmails } from '../services/elasticService';

const router = Router();

/**
 * GET /api/search
 * Full-text search across emails via Elasticsearch
 *
 * Query params:
 *   q       - search query (subject, body, recipients)
 *   status  - filter by status (SCHEDULED|SENT|FAILED|etc.)
 *   sender  - filter by sender email
 *   from    - filter scheduledAt >= (ISO date)
 *   to      - filter scheduledAt <= (ISO date)
 *   page    - page number (default 1)
 *   size    - page size (default 20)
 */
router.get('/', requireAuth, async (req: Request, res: Response) => {
  try {
    const { q, status, sender, from, to, page, size } = req.query as Record<string, string>;

    const results = await searchEmails({
      q,
      status,
      sender,
      userId: req.currentUser!.id,
      from,
      to,
      page: page ? parseInt(page) : 1,
      size: size ? Math.min(parseInt(size), 100) : 20,
    });

    res.json(results);
  } catch (error) {
    console.error('Search error:', error);
    res.status(500).json({ error: 'Search failed' });
  }
});

export default router;
