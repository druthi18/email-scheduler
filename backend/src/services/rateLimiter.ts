import { redisClient } from '../config/redis';
import { env } from '../config/env';

/**
 * Returns current hour window key for a given sender
 * e.g. "alice@example.com:1699200000"
 */
function getHourWindow(sender: string): string {
  const hourTimestamp = Math.floor(Date.now() / 3_600_000); // floor to current hour
  return `rate:sender:${sender}:${hourTimestamp}`;
}

/**
 * Returns milliseconds until the next hour window resets
 */
function msUntilNextHour(): number {
  const now = Date.now();
  const nextHour = (Math.floor(now / 3_600_000) + 1) * 3_600_000;
  return nextHour - now;
}

export interface RateLimitResult {
  allowed: boolean;
  currentCount: number;
  limit: number;
  resetInMs: number;
  sender: string;
}

/**
 * Atomically check and increment the per-sender hourly counter.
 * Uses Redis INCR + EXPIRE — safe across multiple workers.
 *
 * Returns:
 *   allowed = true  → proceed with sending
 *   allowed = false → reschedule to next hour window
 */
export async function checkAndIncrementSenderLimit(sender: string): Promise<RateLimitResult> {
  const key = getHourWindow(sender);
  const limit = env.maxEmailsPerHourPerSender;
  const resetInMs = msUntilNextHour();

  // Atomic INCR
  const count = await redisClient.incr(key);

  // Set expiry only on first increment (TTL = seconds until next hour + buffer)
  if (count === 1) {
    await redisClient.pexpire(key, resetInMs + 60_000); // +1 min buffer
  }

  return {
    allowed: count <= limit,
    currentCount: count,
    limit,
    resetInMs,
    sender,
  };
}

/**
 * Check the global queue rate limit
 */
export async function checkGlobalLimit(): Promise<RateLimitResult> {
  const hourTimestamp = Math.floor(Date.now() / 3_600_000);
  const key = `rate:global:${hourTimestamp}`;
  const limit = env.maxEmailsPerHour;
  const resetInMs = msUntilNextHour();

  const count = await redisClient.incr(key);

  if (count === 1) {
    await redisClient.pexpire(key, resetInMs + 60_000);
  }

  return {
    allowed: count <= limit,
    currentCount: count,
    limit,
    resetInMs,
    sender: 'global',
  };
}

/**
 * Get current counts for a sender (for dashboard display)
 */
export async function getSenderCount(sender: string): Promise<number> {
  const key = getHourWindow(sender);
  const count = await redisClient.get(key);
  return count ? parseInt(count) : 0;
}

/**
 * Get ms until rate limit resets for a sender
 */
export function getResetTimeMs(): number {
  return msUntilNextHour();
}
