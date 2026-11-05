import { Queue, QueueEvents } from 'bullmq';
import { redisConnection } from '../config/redis';
import { env } from '../config/env';

export const EMAIL_QUEUE_NAME = 'email-scheduler';

export interface EmailJobData {
  jobDbId: string;         // DB record ID
  userId: string;
  sender: string;
  recipients: string[];
  subject: string;
  body: string;
  scheduledAt: string;     // ISO string
  hourlyLimit: number;
  delayBetweenMs: number;
  idempotencyKey: string;
}

// Main queue — rate limited globally
export const emailQueue = new Queue<EmailJobData>(EMAIL_QUEUE_NAME, {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 5000,
    },
    removeOnComplete: { count: 200 },
    removeOnFail: { count: 100 },
  },
});

// Queue events for monitoring
export const emailQueueEvents = new QueueEvents(EMAIL_QUEUE_NAME, {
  connection: redisConnection,
});

emailQueueEvents.on('completed', ({ jobId }) => {
  console.log(`✅ Job ${jobId} completed`);
});

emailQueueEvents.on('failed', ({ jobId, failedReason }) => {
  console.error(`❌ Job ${jobId} failed: ${failedReason}`);
});

/**
 * Schedule an email job with delay
 * Uses idempotencyKey as the job ID to prevent duplicates
 */
export async function scheduleEmailJob(
  data: EmailJobData,
  scheduledAt: Date
): Promise<string> {
  const delay = Math.max(0, scheduledAt.getTime() - Date.now());

  const job = await emailQueue.add(
    'send-email',
    data,
    {
      jobId: data.idempotencyKey, // Idempotent — won't create duplicate if key exists
      delay,
    }
  );

  return job.id!;
}

/**
 * Get all delayed (scheduled) jobs
 */
export async function getScheduledJobs() {
  return emailQueue.getJobs(['delayed', 'waiting']);
}

/**
 * Get all completed jobs
 */
export async function getCompletedJobs() {
  return emailQueue.getJobs(['completed']);
}

/**
 * Get all failed jobs
 */
export async function getFailedJobs() {
  return emailQueue.getJobs(['failed']);
}
