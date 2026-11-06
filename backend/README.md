# ReachInbox Email Scheduler — Backend

Node.js / Express.js REST API and BullMQ background worker engine for scheduled, rate-limited email delivery.

---

## 🚀 Tech Stack

- **Framework:** Express.js + TypeScript
- **Queue Engine:** BullMQ + Redis 7
- **Database & ORM:** PostgreSQL 15 + Prisma ORM
- **Search Engine:** Elasticsearch 8.11
- **SMTP Providers:** Nodemailer with Ethereal Sandbox (zero-setup preview links) & Gmail SMTP
- **Monitoring:** Bull-Board queue UI (`/admin/queues`)
- **Authentication:** Google OAuth2 + JWT (HTTP-only cookies & Bearer token)
- **Alerts:** Slack Incoming Webhooks (OAuth flow + notifications)

---

## ⚙️ Environment Configuration (`.env`)

Create `backend/.env` based on `.env.example`:

```env
PORT=4000
NODE_ENV=development
FRONTEND_URL=http://localhost:3000

# PostgreSQL Database
DATABASE_URL=postgresql://reachinbox:reachinbox123@localhost:5432/reachinbox_scheduler?schema=public

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=

# Elasticsearch
ELASTICSEARCH_NODE=http://localhost:9200

# Auth Secrets
JWT_SECRET=super-secret-jwt-key-reachinbox-scheduler-production-2024
SESSION_SECRET=super-secret-session-reachinbox-scheduler-key-2024

# Google OAuth Credentials
GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-google-client-secret
GOOGLE_CALLBACK_URL=http://localhost:4000/auth/google/callback

# Slack OAuth (Optional for rate limit alerts)
SLACK_CLIENT_ID=
SLACK_CLIENT_SECRET=
SLACK_REDIRECT_URI=http://localhost:4000/auth/slack/callback

# SMTP Settings
# Mode 1: Ethereal Sandbox (Default, creates fake test inbox with preview URLs)
USE_ETHEREAL=false
ETHEREAL_USER=
ETHEREAL_PASS=

# Mode 2: Real Gmail SMTP (Sends live real emails to inboxes)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-16-char-app-password
SMTP_FROM=your-email@gmail.com

# Queue & Concurrency Controls
WORKER_CONCURRENCY=5
MIN_EMAIL_DELAY_MS=2000
MAX_EMAILS_PER_HOUR=200
MAX_EMAILS_PER_HOUR_PER_SENDER=50
```

---

## 🛠️ Step-by-Step Setup

### 1. Start Infrastructure via Docker
From project root:
```bash
docker-compose up -d
```
Starts PostgreSQL (`5432`), Redis (`6379`), and Elasticsearch (`9200`).

### 2. Install Dependencies & Migrate DB
```bash
cd backend
npm install
npx prisma generate
npx prisma db push
```

### 3. Start API Server (Terminal 1)
```bash
npm run dev
```
Runs at `http://localhost:4000`. Health check: `GET http://localhost:4000/health`.

### 4. Start BullMQ Email Worker (Terminal 2)
```bash
npm run dev:worker
```
Listens to Redis queue `email-queue`, handles delayed executions, concurrency, per-sender rate limiting, and delivery.

---

## 📊 Live Monitoring

- **Bull-Board Queue Dashboard:** `http://localhost:4000/admin/queues`
  - Real-time active, delayed, waiting, and completed jobs with payload inspect and retry controls.

---

## 🏛️ Architecture Details

### 1. Scheduling
- When `POST /api/emails/schedule` is hit, an idempotency key (SHA-256) is generated.
- Record stored in PostgreSQL with status `SCHEDULED`.
- BullMQ calculates `delay = max(0, scheduledAt - Date.now())`.
- Job pushed into Redis Sorted Sets (`ZSET`).

### 2. Persistence on Restart
- Redis persists BullMQ delayed sets to disk (RDB/AOF).
- If the server or worker crashes or is stopped (`Ctrl+C`), jobs remain safely in Redis.
- When worker starts up again, it resumes processing all due jobs without loss.

### 3. Rate Limiting & Concurrency
- Concurrency: `WORKER_CONCURRENCY=5` allows 5 worker threads in parallel.
- Sliding Window Rate Limit: Redis key `rate:sender:{email}:{hourTimestamp}` with atomic `INCR`.
- If limit is hit: Job is delayed by remaining seconds until next hour window, and a Slack alert is sent.
- Inter-email delay: `delayBetweenMs` enforced between consecutive emails to prevent spam flags.
