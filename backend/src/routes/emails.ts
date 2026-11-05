import { Router, Request, Response } from 'express';
import { z } from 'zod';
import crypto from 'crypto';
import { requireAuth } from '../middleware/authMiddleware';
import { prisma } from '../config/database';
import { scheduleEmailJob } from '../queue/emailQueue';
import { indexEmail } from '../services/elasticService';
import { getSenderCount, getResetTimeMs } from '../services/rateLimiter';
import { EmailStatus } from '@prisma/client';

const router = Router();

// ── Validation Schemas ──────────────────────────────────────────

const scheduleEmailSchema = z.object({
  subject: z.string().min(1, 'Subject is required').max(500),
  body: z.string().min(1, 'Body is required'),
  recipients: z
    .array(z.string().email('Invalid email address'))
    .min(1, 'At least one recipient required')
    .max(1000, 'Max 1000 recipients per batch'),
  sender: z.string().email('Invalid sender email'),
  scheduledAt: z.string().datetime({ message: 'Invalid datetime format' }),
  hourlyLimit: z.number().int().min(1).max(1000).default(50),
  delayBetweenMs: z.number().int().min(0).max(60000).default(2000),
});

// ── Helper ──────────────────────────────────────────────────────

function generateIdempotencyKey(params: {
  userId: string;
  sender: string;
  subject: string;
  scheduledAt: string;
  recipients: string[];
}): string {
  const data = JSON.stringify({
    userId: params.userId,
    sender: params.sender,
    subject: params.subject,
    scheduledAt: params.scheduledAt,
    recipients: [...params.recipients].sort(),
  });
  return crypto.createHash('sha256').update(data).digest('hex');
}

// ── Routes ──────────────────────────────────────────────────────

/**
 * POST /api/emails/schedule
 * Schedule a new email job
 */
router.post('/schedule', requireAuth, async (req: Request, res: Response) => {
  try {
    const parsed = scheduleEmailSchema.safeParse(req.body);

    if (!parsed.success) {
      res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() });
      return;
    }

    const { subject, body, recipients, sender, scheduledAt, hourlyLimit, delayBetweenMs } = parsed.data;
    const userId = req.currentUser!.id;
    const scheduledDate = new Date(scheduledAt);

    if (scheduledDate <= new Date()) {
      res.status(400).json({ error: 'scheduledAt must be in the future' });
      return;
    }

    // Generate idempotency key
    const idempotencyKey = generateIdempotencyKey({ userId, sender, subject, scheduledAt, recipients });

    // Check if already scheduled (idempotent)
    const existing = await prisma.emailJob.findUnique({ where: { idempotencyKey } });
    if (existing) {
      res.status(200).json({
        message: 'Email already scheduled (idempotent)',
        jobId: existing.id,
        jobBullId: existing.jobId,
        status: existing.status,
      });
      return;
    }

    // Create DB record
    const emailJob = await prisma.emailJob.create({
      data: {
        userId,
        subject,
        body,
        recipients: recipients as unknown as import('@prisma/client').Prisma.InputJsonValue,
        sender,
        scheduledAt: scheduledDate,
        status: EmailStatus.SCHEDULED,
        idempotencyKey,
        hourlyLimit,
        delayBetweenMs,
      },
    });

    // Enqueue BullMQ delayed job
    const bullJobId = await scheduleEmailJob(
      {
        jobDbId: emailJob.id,
        userId,
        sender,
        recipients,
        subject,
        body,
        scheduledAt,
        hourlyLimit,
        delayBetweenMs,
        idempotencyKey,
      },
      scheduledDate
    );

    // Update DB with BullMQ job ID
    await prisma.emailJob.update({
      where: { id: emailJob.id },
      data: { jobId: bullJobId },
    });

    // Index to Elasticsearch
    await indexEmail({
      jobId: emailJob.id,
      userId,
      sender,
      recipients,
      subject,
      body,
      status: EmailStatus.SCHEDULED,
      scheduledAt: scheduledDate.toISOString(),
      createdAt: emailJob.createdAt.toISOString(),
    });

    res.status(201).json({
      message: 'Email scheduled successfully',
      jobId: emailJob.id,
      bullJobId,
      scheduledAt: scheduledDate.toISOString(),
      recipientCount: recipients.length,
    });
  } catch (error) {
    console.error('Schedule email error:', error);
    res.status(500).json({ error: 'Failed to schedule email' });
  }
});

/**
 * GET /api/emails/scheduled
 * List all scheduled emails for the current user
 */
router.get('/scheduled', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.currentUser!.id;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const skip = (page - 1) * limit;

    const [jobs, total] = await Promise.all([
      prisma.emailJob.findMany({
        where: {
          userId,
          status: { in: [EmailStatus.SCHEDULED, EmailStatus.RATE_LIMITED, EmailStatus.PROCESSING] },
        },
        orderBy: { scheduledAt: 'asc' },
        skip,
        take: limit,
        select: {
          id: true,
          subject: true,
          sender: true,
          recipients: true,
          scheduledAt: true,
          status: true,
          hourlyLimit: true,
          delayBetweenMs: true,
          createdAt: true,
          jobId: true,
        },
      }),
      prisma.emailJob.count({
        where: {
          userId,
          status: { in: [EmailStatus.SCHEDULED, EmailStatus.RATE_LIMITED, EmailStatus.PROCESSING] },
        },
      }),
    ]);

    res.json({
      jobs,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    console.error('Get scheduled emails error:', error);
    res.status(500).json({ error: 'Failed to fetch scheduled emails' });
  }
});

/**
 * GET /api/emails/sent
 * List all sent/failed emails for the current user
 */
router.get('/sent', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.currentUser!.id;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const skip = (page - 1) * limit;

    const [jobs, total] = await Promise.all([
      prisma.emailJob.findMany({
        where: {
          userId,
          status: { in: [EmailStatus.SENT, EmailStatus.FAILED] },
        },
        orderBy: { sentAt: 'desc' },
        skip,
        take: limit,
        select: {
          id: true,
          subject: true,
          sender: true,
          recipients: true,
          scheduledAt: true,
          sentAt: true,
          status: true,
          etherealPreviewUrl: true,
          errorMessage: true,
          createdAt: true,
        },
      }),
      prisma.emailJob.count({
        where: {
          userId,
          status: { in: [EmailStatus.SENT, EmailStatus.FAILED] },
        },
      }),
    ]);

    res.json({
      jobs,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    console.error('Get sent emails error:', error);
    res.status(500).json({ error: 'Failed to fetch sent emails' });
  }
});

/**
 * GET /api/emails/stats
 * Dashboard statistics
 */
router.get('/stats', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.currentUser!.id;

    const [scheduled, sent, failed, rateLimited] = await Promise.all([
      prisma.emailJob.count({ where: { userId, status: EmailStatus.SCHEDULED } }),
      prisma.emailJob.count({ where: { userId, status: EmailStatus.SENT } }),
      prisma.emailJob.count({ where: { userId, status: EmailStatus.FAILED } }),
      prisma.emailJob.count({ where: { userId, status: EmailStatus.RATE_LIMITED } }),
    ]);

    // Get unique senders and their current rate limit counts
    const senders = await prisma.emailJob.findMany({
      where: { userId },
      select: { sender: true },
      distinct: ['sender'],
    });

    const senderStats = await Promise.all(
      senders.map(async ({ sender }) => ({
        sender,
        currentHourCount: await getSenderCount(sender),
        limit: 50,
        resetInMs: getResetTimeMs(),
      }))
    );

    res.json({
      stats: { scheduled, sent, failed, rateLimited, total: scheduled + sent + failed + rateLimited },
      senderStats,
    });
  } catch (error) {
    console.error('Get stats error:', error);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

/**
 * DELETE /api/emails/:id
 * Cancel a scheduled email
 */
router.delete('/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.currentUser!.id;
    const { id } = req.params;

    const job = await prisma.emailJob.findFirst({
      where: { id, userId },
    });

    if (!job) {
      res.status(404).json({ error: 'Email job not found' });
      return;
    }

    if (job.status !== EmailStatus.SCHEDULED && job.status !== EmailStatus.RATE_LIMITED) {
      res.status(400).json({ error: 'Can only cancel scheduled or rate-limited emails' });
      return;
    }

    // Remove from BullMQ if jobId exists
    if (job.jobId) {
      const { emailQueue } = await import('../queue/emailQueue');
      const bullJob = await emailQueue.getJob(job.jobId);
      if (bullJob) await bullJob.remove();
    }

    await prisma.emailJob.update({
      where: { id },
      data: { status: EmailStatus.CANCELLED },
    });

    res.json({ message: 'Email job cancelled successfully' });
  } catch (error) {
    console.error('Cancel email error:', error);
    res.status(500).json({ error: 'Failed to cancel email' });
  }
});

export default router;
