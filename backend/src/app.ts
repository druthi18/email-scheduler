import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import passport from 'passport';
import { createBullBoard } from '@bull-board/api';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { ExpressAdapter } from '@bull-board/express';

import { env } from './config/env';
import { setupElasticsearch } from './config/elasticsearch';
import { emailQueue } from './queue/emailQueue';

// Routes
import authRoutes from './routes/auth';
import emailRoutes from './routes/emails';
import slackRoutes from './routes/slack';
import searchRoutes from './routes/search';

const app = express();

// ── Security & Parsing ──────────────────────────────────────────
app.use(
  helmet({
    contentSecurityPolicy: false, // disabled for bull-board iframe
    crossOriginEmbedderPolicy: false,
  })
);

app.use(
  cors({
    origin: env.frontendUrl,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);

app.use(morgan('dev'));
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(passport.initialize());

// ── Bull Board Dashboard ────────────────────────────────────────
const serverAdapter = new ExpressAdapter();
serverAdapter.setBasePath('/admin/queues');

createBullBoard({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  queues: [new BullMQAdapter(emailQueue) as any],
  serverAdapter,
});

app.use('/admin/queues', serverAdapter.getRouter());

// ── API Routes ──────────────────────────────────────────────────
app.use('/auth', authRoutes);
app.use('/auth/slack', slackRoutes);
app.use('/api/emails', emailRoutes);
app.use('/api/search', searchRoutes);

// ── Health Check ────────────────────────────────────────────────
app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'ReachInbox Email Scheduler',
  });
});

// ── 404 Handler ─────────────────────────────────────────────────
app.use((_req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// ── Global Error Handler ────────────────────────────────────────
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// ── Startup ─────────────────────────────────────────────────────
async function bootstrap() {
  // Setup Elasticsearch index
  await setupElasticsearch();

  app.listen(env.port, () => {
    console.log(`
🚀 ReachInbox Email Scheduler API
   ───────────────────────────────
   Server:      http://localhost:${env.port}
   Bull Board:  http://localhost:${env.port}/admin/queues
   Health:      http://localhost:${env.port}/health
   Environment: ${env.nodeEnv}
    `);
  });
}

bootstrap().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});

export default app;
