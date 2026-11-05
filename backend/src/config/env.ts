import { z } from 'zod';
import dotenv from 'dotenv';

dotenv.config();

const envSchema = z.object({
  PORT: z.string().default('4000'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  FRONTEND_URL: z.string().default('http://localhost:3000'),

  DATABASE_URL: z.string(),

  REDIS_HOST: z.string().default('localhost'),
  REDIS_PORT: z.string().default('6379'),

  GOOGLE_CLIENT_ID: z.string(),
  GOOGLE_CLIENT_SECRET: z.string(),
  GOOGLE_CALLBACK_URL: z.string(),

  JWT_SECRET: z.string(),
  SESSION_SECRET: z.string(),

  ELASTICSEARCH_URL: z.string().default('http://localhost:9200'),

  SLACK_CLIENT_ID: z.string().optional(),
  SLACK_CLIENT_SECRET: z.string().optional(),
  SLACK_REDIRECT_URI: z.string().optional(),

  MAX_EMAILS_PER_HOUR: z.string().default('200'),
  MAX_EMAILS_PER_HOUR_PER_SENDER: z.string().default('50'),
  WORKER_CONCURRENCY: z.string().default('5'),
  MIN_EMAIL_DELAY_MS: z.string().default('2000'),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌ Invalid environment variables:', parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = {
  port: parseInt(parsed.data.PORT),
  nodeEnv: parsed.data.NODE_ENV,
  frontendUrl: parsed.data.FRONTEND_URL,
  databaseUrl: parsed.data.DATABASE_URL,
  redis: {
    host: parsed.data.REDIS_HOST,
    port: parseInt(parsed.data.REDIS_PORT),
  },
  google: {
    clientId: parsed.data.GOOGLE_CLIENT_ID,
    clientSecret: parsed.data.GOOGLE_CLIENT_SECRET,
    callbackUrl: parsed.data.GOOGLE_CALLBACK_URL,
  },
  jwtSecret: parsed.data.JWT_SECRET,
  sessionSecret: parsed.data.SESSION_SECRET,
  elasticsearchUrl: parsed.data.ELASTICSEARCH_URL,
  slack: {
    clientId: parsed.data.SLACK_CLIENT_ID,
    clientSecret: parsed.data.SLACK_CLIENT_SECRET,
    redirectUri: parsed.data.SLACK_REDIRECT_URI,
  },
  maxEmailsPerHour: parseInt(parsed.data.MAX_EMAILS_PER_HOUR),
  maxEmailsPerHourPerSender: parseInt(parsed.data.MAX_EMAILS_PER_HOUR_PER_SENDER),
  workerConcurrency: parseInt(parsed.data.WORKER_CONCURRENCY),
  minEmailDelayMs: parseInt(parsed.data.MIN_EMAIL_DELAY_MS),
};
