import { Worker, Job } from 'bullmq';
import { redisConnection } from '../config/redis';
import { env } from '../config/env';
import { EMAIL_QUEUE_NAME, EmailJobData, emailQueue } from '../queue/emailQueue';
import { sendEmail, sleep } from '../services/emailService';
import { checkAndIncrementSenderLimit, getResetTimeMs } from '../services/rateLimiter';
import { notifyRateLimitHit } from '../services/slackService';
import { indexEmail, updateEmailIndex } from '../services/elasticService';
import { prisma } from '../config/database';
import { EmailStatus } from '@prisma/client';

/**
 * Process a single email job
 *
 * Flow:
 * 1. Check per-sender rate limit (Redis INCR atomic)
 * 2. If rate limited → update DB status, reschedule to next hour, notify Slack → return
 * 3. Send email via Ethereal
 * 4. Enforce minimum delay between sends
 * 5. Update DB record + Elasticsearch index
 */
async function processEmailJob(job: Job<EmailJobData>): Promise<void> {
  const { jobDbId, userId, sender, recipients, subject, body, delayBetweenMs } = job.data;

  console.log(`\n⚙️  Processing job ${job.id} | DB: ${jobDbId} | To: ${recipients.join(', ')}`);

  // 1. Check rate limit
  const rateLimitResult = await checkAndIncrementSenderLimit(sender);

  if (!rateLimitResult.allowed) {
    console.warn(`⏱️  Rate limit hit for ${sender} (${rateLimitResult.currentCount}/${rateLimitResult.limit})`);

    // Update DB status
    await prisma.emailJob.update({
      where: { id: jobDbId },
      data: { status: EmailStatus.RATE_LIMITED },
    });

    // Fire Slack notification (gracefully skips if no webhook)
    await notifyRateLimitHit(
      userId,
      sender,
      rateLimitResult.currentCount,
      rateLimitResult.limit,
      rateLimitResult.resetInMs
    );

    // Reschedule to next hour window (preserving order by adding small offset)
    const rescheduleDelay = rateLimitResult.resetInMs + (job.opts.priority || 0) * 100;
    await emailQueue.add(
      'send-email',
      { ...job.data },
      {
        delay: rescheduleDelay,
        // Don't use same idempotencyKey for rescheduled jobs
        jobId: `${job.data.idempotencyKey}-retry-${Date.now()}`,
        attempts: 3,
        backoff: { type: 'exponential', delay: 5000 },
      }
    );

    console.log(`🔄 Job ${job.id} rescheduled to next hour (${Math.ceil(rescheduleDelay / 60_000)} min from now)`);
    return; // Don't throw — we handled it gracefully
  }

  // 2. Update status to PROCESSING
  await prisma.emailJob.update({
    where: { id: jobDbId },
    data: { status: EmailStatus.PROCESSING },
  });

  // 3. Send email to each recipient
  let lastPreviewUrl = '';
  let lastError = '';

  for (const recipient of recipients) {
    try {
      const result = await sendEmail({
        sender,
        to: recipient,
        subject,
        body,
      });
      lastPreviewUrl = result.previewUrl;

      // Enforce minimum delay between individual sends
      if (recipients.indexOf(recipient) < recipients.length - 1) {
        await sleep(Math.max(delayBetweenMs, env.minEmailDelayMs));
      }
    } catch (error) {
      lastError = (error as Error).message;
      console.error(`❌ Failed to send to ${recipient}:`, lastError);
    }
  }

  // 4. Enforce global minimum delay between job processing
  await sleep(env.minEmailDelayMs);

  // 5. Update DB record
  const finalStatus = lastError && recipients.length === 1
    ? EmailStatus.FAILED
    : EmailStatus.SENT;

  const sentAt = new Date();
  await prisma.emailJob.update({
    where: { id: jobDbId },
    data: {
      status: finalStatus,
      sentAt,
      etherealPreviewUrl: lastPreviewUrl || null,
      errorMessage: lastError || null,
    },
  });

  // 6. Update Elasticsearch index
  await updateEmailIndex(jobDbId, {
    status: finalStatus,
    sentAt: sentAt.toISOString(),
    etherealPreviewUrl: lastPreviewUrl,
  });

  console.log(`✅ Job ${job.id} done | Status: ${finalStatus} | Preview: ${lastPreviewUrl}`);
}

// ───────────────────────────────────────────────────────────────
// Worker
// ───────────────────────────────────────────────────────────────
const worker = new Worker<EmailJobData>(
  EMAIL_QUEUE_NAME,
  processEmailJob,
  {
    connection: redisConnection,
    concurrency: env.workerConcurrency,
    // BullMQ global rate limiter — max emails per hour across all workers
    limiter: {
      max: env.maxEmailsPerHour,
      duration: 3_600_000, // 1 hour in ms
    },
  }
);

worker.on('active', (job) => {
  console.log(`▶️  Worker active: job ${job.id}`);
});

worker.on('completed', (job) => {
  console.log(`✅ Worker completed: job ${job.id}`);
});

worker.on('failed', (job, err) => {
  console.error(`❌ Worker failed: job ${job?.id} — ${err.message}`);
  if (job) {
    prisma.emailJob
      .update({
        where: { id: job.data.jobDbId },
        data: { status: EmailStatus.FAILED, errorMessage: err.message },
      })
      .catch(console.error);
  }
});

worker.on('error', (err) => {
  console.error('❌ Worker error:', err.message);
});

console.log(`
🚀 Email Worker Started
   Queue: ${EMAIL_QUEUE_NAME}
   Concurrency: ${env.workerConcurrency}
   Min delay between sends: ${env.minEmailDelayMs}ms
   Max emails/hour (global): ${env.maxEmailsPerHour}
   Max emails/hour/sender: ${env.maxEmailsPerHourPerSender}
`);

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('🛑 SIGTERM received — closing worker gracefully...');
  await worker.close();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('🛑 SIGINT received — closing worker gracefully...');
  await worker.close();
  process.exit(0);
});

export default worker;
