# ReachInbox — Full-Stack Email Job Scheduler

A production-grade email scheduler built for the ReachInbox hiring assignment. Features BullMQ + Redis delayed jobs, PostgreSQL persistence, Elasticsearch search, Ethereal SMTP, Google OAuth, Slack notifications, and a Next.js dashboard.

---

## 🏗️ Architecture Overview

```
┌───────────────────────────────────────────────────────────┐
│                 Next.js Frontend (port 3000)               │
│  Google Login → Dashboard → Compose → Scheduled/Sent      │
└──────────────────┬────────────────────────────────────────┘
                   │ REST API
┌──────────────────▼────────────────────────────────────────┐
│              Express.js API Server (port 4000)             │
│  /api/emails   /auth/google   /auth/slack   /api/search   │
│  /admin/queues (Bull-Board live dashboard)                 │
└──────┬──────────────┬────────────────────────────────────┘
       │              │
  ┌────▼────┐    ┌────▼────┐    ┌──────────────┐
  │Postgres │    │  Redis  │    │Elasticsearch │
  │(Prisma) │    │(BullMQ) │    │  (Search)    │
  └─────────┘    └────┬────┘    └──────────────┘
                      │
            ┌─────────▼──────────┐
            │   BullMQ Worker    │
            │  concurrency = 5   │
            │  2s min delay      │
            │  rate limit/hour   │
            │  Ethereal SMTP     │
            └────────────────────┘
```

### How Scheduling Works

1. **POST /api/emails/schedule** receives the request
2. A unique `idempotencyKey` (SHA-256 hash of userId + sender + subject + scheduledAt + recipients) is generated
3. The job is stored in **PostgreSQL** with `status = SCHEDULED`
4. A **BullMQ delayed job** is added with `delay = scheduledAt - now` (jobs live in Redis Sorted Sets)
5. The email is indexed into **Elasticsearch** for search
6. At the scheduled time, the BullMQ **Worker** picks up the job and sends via **Ethereal SMTP**
7. DB and Elasticsearch are updated with the result

### Persistence on Restart

- BullMQ delayed jobs are stored in **Redis Sorted Sets (ZSETs)** keyed by scheduled timestamp
- Restarting the Node server does **not** clear Redis — all future jobs still fire at the correct time
- The `idempotencyKey` as BullMQ job ID prevents any job from being created twice

### Rate Limiting & Concurrency

| Setting | Default | Env Variable |
|---|---|---|
| Worker concurrency | 5 | `WORKER_CONCURRENCY` |
| Min delay between sends | 2000ms | `MIN_EMAIL_DELAY_MS` |
| Global emails/hour | 200 | `MAX_EMAILS_PER_HOUR` |
| Per-sender emails/hour | 50 | `MAX_EMAILS_PER_HOUR_PER_SENDER` |

**How rate limiting works:**
- **Global**: BullMQ's built-in `limiter: { max, duration }` auto-pauses workers when the global limit is hit
- **Per-sender**: Redis `INCR` with key `rate:sender:{email}:{hourTimestamp}` — atomic, safe across multiple workers
- When per-sender limit is hit: job is **rescheduled** to the next hour window (not dropped), and a **Slack notification** is fired
- Redis keys auto-expire at the start of the next hour (TTL set on first increment)

---

## 🚀 Quick Start

### Prerequisites

- **Docker** (for Redis, PostgreSQL, Elasticsearch)
- **Node.js** v18+
- **npm** v9+

### 1. Start Infrastructure

```bash
docker-compose up -d
```

Starts:
- PostgreSQL 15 on `localhost:5432`
- Redis 7 on `localhost:6379`
- Elasticsearch 8.11 on `localhost:9200`

Wait ~30s for Elasticsearch to be healthy.

### 2. Backend Setup

```bash
cd backend

# Copy env and fill in secrets
cp .env.example .env
# Edit .env — add your GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, JWT_SECRET, SESSION_SECRET

# Install dependencies
npm install

# Generate Prisma client
npm run db:generate

# Run database migrations
npm run db:migrate

# Start API server (terminal 1)
npm run dev

# Start BullMQ worker (terminal 2)
npm run dev:worker
```

Backend runs at `http://localhost:4000`  
Bull-Board queue dashboard at `http://localhost:4000/admin/queues`  
Health check at `http://localhost:4000/health`  

---

### 3. SMTP & Email Delivery Setup

The scheduler features **dual-mode email delivery**:

#### Option A: Ethereal Email (Default Mock Sandbox — Safe Testing)
- By default, if no external SMTP credentials are provided in `backend/.env`, the scheduler automatically uses **Ethereal Mail** (`nodemailer.createTestAccount()`).
- Ethereal catches all outgoing emails and generates an interactive web preview link (e.g. `https://ethereal.email/message/...`) so campaigns can be verified without spamming or burning real domain reputation.
- In the dashboard **Sent** tab, click **View Preview ↗** to inspect the rendered email, headers, and payload.

#### Option B: Real SMTP (Gmail / Custom Provider — Real Inbox Delivery)
To deliver emails directly to real inboxes (like Gmail, Outlook), simply add your SMTP credentials to `backend/.env`:

```env
# ============================================================
# Real SMTP Configuration (Gmail)
# ============================================================
SMTP_HOST=smtp.gmail.com
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=your_email@gmail.com
SMTP_PASS=your_16_character_app_password
```
*(To generate a 16-character Google App Password: Google Account ➔ Security ➔ 2-Step Verification ➔ App Passwords ➔ Create)*.  
When configured, emails are delivered directly to real inboxes and marked with a **`✓ Inbox Delivered`** badge.

### 3. Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Start development server
npm run dev
```

Frontend runs at `http://localhost:3000`

### 4. Configure Google OAuth

1. Go to [console.cloud.google.com](https://console.cloud.google.com)
2. Create a project → APIs & Services → Credentials → Create OAuth 2.0 Client ID
3. Application type: **Web application**
4. Authorized redirect URIs: `http://localhost:4000/auth/google/callback`
5. Copy Client ID and Secret into `backend/.env`

### 5. Configure Slack (Optional)

1. Go to [api.slack.com/apps](https://api.slack.com/apps) → Create New App → From scratch
2. Add feature: **Incoming Webhooks** → Enable
3. OAuth & Permissions → Add Redirect URL: `http://localhost:4000/auth/slack/callback`
4. Scopes → Bot Token Scopes: `incoming-webhook`
5. Copy Client ID and Secret into `backend/.env`
6. Click "Connect Slack" in the dashboard header to link your workspace

---

## 📋 API Reference

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/health` | No | Health check |
| GET | `/auth/google` | No | Initiate Google OAuth |
| GET | `/auth/google/callback` | No | OAuth callback |
| POST | `/auth/logout` | Yes | Clear auth cookie |
| GET | `/auth/me` | Yes | Get current user |
| POST | `/api/emails/schedule` | Yes | Schedule new email |
| GET | `/api/emails/scheduled` | Yes | List scheduled emails |
| GET | `/api/emails/sent` | Yes | List sent emails |
| GET | `/api/emails/stats` | Yes | Dashboard statistics |
| DELETE | `/api/emails/:id` | Yes | Cancel scheduled email |
| GET | `/api/search?q=` | Yes | Full-text search (Elasticsearch) |
| GET | `/auth/slack` | Yes | Initiate Slack OAuth |
| GET | `/auth/slack/callback` | No | Slack OAuth callback |
| DELETE | `/api/slack/disconnect` | Yes | Disconnect Slack |
| GET | `/admin/queues` | No | Bull-Board dashboard |

### Schedule Email — Request Body

```json
{
  "subject": "Hello World",
  "body": "Email body text here",
  "recipients": ["user@example.com", "other@example.com"],
  "sender": "noreply@yourdomain.com",
  "scheduledAt": "2024-12-01T10:00:00.000Z",
  "hourlyLimit": 50,
  "delayBetweenMs": 2000
}
```

---

## ✅ Features Implemented

### Backend
- [x] BullMQ delayed jobs (no cron, no setInterval)
- [x] PostgreSQL + Prisma ORM (Users, EmailJobs, SenderRateLimits)
- [x] Redis persistence — jobs survive server restarts
- [x] Idempotency — SHA-256 keyed jobs, never duplicated
- [x] Ethereal Email SMTP (per-sender test accounts)
- [x] Worker concurrency (configurable, default 5)
- [x] Minimum 2s delay between email sends
- [x] Global rate limiting via BullMQ limiter
- [x] Per-sender rate limiting via Redis INCR (atomic, multi-worker safe)
- [x] Job rescheduling on rate limit (not dropped)
- [x] Slack OAuth + real webhook notifications on rate limit
- [x] Elasticsearch indexing + full-text search
- [x] Bull-Board live queue dashboard at `/admin/queues`
- [x] Google OAuth 2.0 with Passport.js
- [x] JWT authentication (cookie + Bearer header)
- [x] Email cancellation

### Frontend
- [x] Google OAuth login page
- [x] JWT token stored in localStorage
- [x] Dashboard with Scheduled / Sent tabs
- [x] Stats cards (scheduled, sent, failed, rate-limited)
- [x] Per-sender rate limit progress bars
- [x] Compose email modal with:
  - [x] CSV / text file upload (auto-parses emails)
  - [x] Subject, body, sender
  - [x] Start time (datetime picker)
  - [x] Delay between emails
  - [x] Hourly limit
- [x] Email table with status badges, pagination
- [x] Ethereal preview links for sent emails
- [x] Cancel scheduled emails
- [x] Full-text search (Elasticsearch)
- [x] Slack connect / disconnect in header
- [x] Loading skeletons + empty states
- [x] Toast notifications
- [x] Auto-refresh every 30 seconds
- [x] Bull-Board quick link in header

---

## ⚙️ Environment Variables

See [`backend/.env.example`](./backend/.env.example) for full documentation.

Key configurable values:
- `WORKER_CONCURRENCY` — Number of parallel email workers (default: 5)
- `MIN_EMAIL_DELAY_MS` — Minimum ms between individual sends (default: 2000)
- `MAX_EMAILS_PER_HOUR` — Global hourly limit (default: 200)
- `MAX_EMAILS_PER_HOUR_PER_SENDER` — Per-sender limit (default: 50)

---

## 🔄 Behavior Under Load

When 1000+ emails are scheduled for the same time:

1. BullMQ processes them with `concurrency = 5` (5 parallel workers)
2. Each send has a **2s minimum delay**
3. Global BullMQ limiter ensures ≤200/hour across all workers
4. Per-sender Redis counter ensures ≤50/hour per sender
5. When either limit is hit:
   - Job is **rescheduled** to the next hour window
   - Slack notification fired (if connected)
   - DB status updated to `RATE_LIMITED`
   - No jobs are dropped or lost

---

## 📂 Project Structure

```
email/
├── docker-compose.yml          # Redis + PostgreSQL + Elasticsearch
├── README.md
├── backend/
│   ├── prisma/
│   │   └── schema.prisma       # DB schema
│   ├── src/
│   │   ├── config/             # env, redis, database, elasticsearch
│   │   ├── queue/              # BullMQ queue definition
│   │   ├── workers/            # BullMQ worker processor
│   │   ├── services/           # email, rateLimiter, slack, elastic
│   │   ├── routes/             # auth, emails, slack, search
│   │   ├── middleware/         # JWT auth guard
│   │   └── app.ts              # Express entry point
│   ├── .env                    # Environment variables
│   └── package.json
└── frontend/
    ├── src/
    │   ├── app/                # Next.js app router
    │   │   ├── page.tsx        # Login page
    │   │   └── dashboard/      # Main dashboard
    │   ├── components/         # Header, EmailTable, ComposeModal, ui/
    │   ├── lib/                # API client
    │   └── types/              # TypeScript interfaces
    └── package.json
```

---

## 📹 Demo Video Recording Guide (≤ 5 mins)

When recording your submission walkthrough, follow this structured plan:

1. **Dashboard & Creation (1 min):**
   - Open `http://localhost:3000/dashboard`.
   - Show the stats cards and SMTP Quota Monitor.
   - Click **Compose New Email**, add recipients, select `⚡ Send in 30s` (or pick a future time), and schedule.
   - Show the newly created row in the **Scheduled** tab.

2. **BullMQ Queue Verification (1 min):**
   - Open Bull-Board at `http://localhost:4000/admin/queues`.
   - Show the delayed job waiting in Redis with its active countdown timer.
   - Switch back to the dashboard once 30 seconds pass and verify the row moves to the **Sent** tab with preview/delivery status.

3. **Server Restart Scenario (1 min):**
   - Schedule an email for +2 minutes in the future.
   - In your terminal, stop the backend server (`Ctrl + C`).
   - Show that the backend is down.
   - Restart the backend (`npm run dev`) and BullMQ worker (`npm run dev:worker`).
   - Refresh the dashboard: the scheduled job is still intact in Redis/Postgres and delivers right on schedule when the timer matures!

4. **Rate Limiting & Delay Behavior Under Load (1 min):**
   - Demonstrate scheduling a campaign with 5+ recipients and a 2000ms delay.
   - Show in worker logs or Bull-Board how each email is processed sequentially with the mandatory delay.
   - Demonstrate the quota bar updating in real-time, proving that exceeding limits reschedules jobs rather than failing them.

---

## 🔧 Assumptions, Shortcuts & Trade-offs

1. **Dual SMTP Modes:** Defaults to **Ethereal Email** test sandbox so evaluators can run the project immediately without needing private email credentials. Adding `SMTP_USER` and `SMTP_PASS` seamlessly upgrades to production Gmail delivery.
2. **Persistence Guarantee:** Scheduled emails are dual-persisted — in PostgreSQL for relational queries and state tracking, and in Redis Sorted Sets (ZSETs) for millisecond-precision delayed execution. Even if the Node process crashes, Redis preserves all pending timers.
3. **Idempotency Strategy:** Each job calculates a SHA-256 hash of `userId + sender + subject + scheduledAt + sorted recipients` used as the BullMQ Job ID. This prevents accidental duplicate schedules from network retries or double form submissions.
4. **Elasticsearch Resilience:** Elasticsearch is treated as an auxiliary search index. If ES is offline or not installed, the application continues to schedule and deliver emails with standard database queries.
5. **Rate Limiting Sliding Window:** Rate limits use Redis atomic `INCR` with an hourly TTL window per sender. When a quota is reached, jobs are gracefully rescheduled to the next hour rather than dropping outreach leads.
