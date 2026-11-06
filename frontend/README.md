# ReachInbox Email Scheduler — Frontend

Next.js 15 (App Router) client application matching the official ReachInbox Figma wireframes.

---

## 🎨 UI Features (Figma Spec)

- **Light Minimalist Theme:** Signature ReachInbox green (`#00a854`), clean slate typography, and comfortable whitespace.
- **Login Screen:** Clean Google OAuth login and email input fallback.
- **Header:** Brand "ONE" logo, Elasticsearch live search bar, BullMQ engine status beacon, and user profile popover.
- **Left Navigation:** User account pill, "+ Compose" pill, Scheduled / Sent tabs with live badges, and sliding-window quota bar.
- **Gmail-Style Feed:** Recipient avatar pill, scheduled countdown timers (`in 30s`, `in 5m`), delivery indicators, and cancel actions.
- **Composer Window:**
  - Full Figma header with back button and "Send Later" popovers.
  - From dropdown and To field with CSV bulk lead parsing.
  - **Visible Schedule Timer** with 1-click test chips (`⚡ In 30s`, `+2 mins`, `+5 mins`, `Tomorrow 8 AM`).
  - Delay between emails and hourly limit controls.
  - Rich formatting toolbar (`↶ ↷ | Tt B I U S | 🔗 📷 ❝`).
  - Detail view for inspecting sent emails, raw headers, and Ethereal / Gmail delivery status.

---

## ⚙️ Environment Configuration (`.env.local`)

Create `frontend/.env.local`:

```env
NEXT_PUBLIC_API_URL=http://localhost:4000
```

---

## 🛠️ Step-by-Step Setup

### 1. Install Dependencies
```bash
cd frontend
npm install
```

### 2. Run Next.js Development Server
```bash
npm run dev
```
Open **`http://localhost:3000`** in your browser.

### 3. Production Build
```bash
npm run build
npm run start
```
Runs optimized standalone SSR build on port 3000.
