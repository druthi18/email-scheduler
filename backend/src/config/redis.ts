import IORedis from 'ioredis';
import { env } from './env';

// Connection for BullMQ (requires maxRetriesPerRequest: null)
export const redisConnection = new IORedis({
  host: env.redis.host,
  port: env.redis.port,
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
  retryStrategy(times) {
    const delay = Math.min(times * 50, 2000);
    return delay;
  },
});

// General purpose Redis connection for rate limiting, etc.
export const redisClient = new IORedis({
  host: env.redis.host,
  port: env.redis.port,
  maxRetriesPerRequest: 3,
  retryStrategy(times) {
    const delay = Math.min(times * 50, 2000);
    return delay;
  },
});

redisConnection.on('connect', () => console.log('✅ Redis (BullMQ) connected'));
redisConnection.on('error', (err) => console.error('❌ Redis (BullMQ) error:', err.message));

redisClient.on('connect', () => console.log('✅ Redis (client) connected'));
redisClient.on('error', (err) => console.error('❌ Redis (client) error:', err.message));
