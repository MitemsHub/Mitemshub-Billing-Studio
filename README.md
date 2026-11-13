# Mitemshub Billing Studio

> **Full-stack multi-currency freelance invoicing, client directory, recurring retainer engine, automated payment reminder workflows, and live stationery branding studio built for [Mitemshub](https://github.com/MitemsHub/Mitemshub-Billing-Studio).**

![Stack](https://img.shields.io/badge/React-19-0B3B91?style=flat-square&logo=react&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5%2F7-111315?style=flat-square&logo=typescript&logoColor=white)
![TailwindCSS](https://img.shields.io/badge/Tailwind%20CSS-v4-0B3B91?style=flat-square&logo=tailwindcss&logoColor=white)
![Express](https://img.shields.io/badge/Express-Backend-111315?style=flat-square&logo=express&logoColor=white)
![Appwrite](https://img.shields.io/badge/Appwrite-Cloud%20DB-F02E65?style=flat-square&logo=appwrite&logoColor=white)

---

## Highlights

- **Multi-Currency Invoicing & FX Equivalents**: Issue invoices in `USD`, `NGN`, `GBP`, `EUR`, `CAD`, `AUD`, `GHS`, `KES`, or `ZAR` with real-time `USD` / `NGN` equivalent quoting, per-invoice FX rate overrides, percentage discounts, VAT/Tax, **WHT (Withholding Tax)** deductions, and crisp **A4 Print / Download PDF** export (`@media print`).
- **Appwrite Cloud Persistence + Offline Cache**: Backed by an Express API server (`server.ts`) wired to **Appwrite Cloud Databases** (`node-appwrite`) with idempotent schema provisioning, automatic first-run seeding, and automatic browser `localStorage` fallback cache.
- **Client Directory**: Manage international client contacts, country profiles, preferred currencies, net payment terms, service tags, CSV invoice exports, and one-click invoice creation.
- **Recurring Retainers & Reminder Engine**: Schedule weekly, bi-weekly, monthly, or quarterly retainers, generate invoices with one click, customize tokenized reminder templates (`{{client_name}}`, `{{amount_primary}}`, `{{amount_equivalent}}`, `{{due_date}}`), run automated sweeps, and delete individual or clear all **Reminder Dispatch Logs**.
- **Brand Identity & Stationery Studio**: Features your **Original Draft (PNG)** mark alongside custom image uploads (with remove/replace support), brand accent presets, editable studio address/profile, and dual-currency USD/NGN settlement instructions updated live on the invoice paper.

---

## Architecture

```
mitemshub-billing-studio/
├── server.ts                  # Express server (port 3000), REST /api/* routes & Vite middleware
├── server/
│   └── appwrite.ts            # Appwrite SDK client, auto schema/collections provisioning & CRUD
├── src/
│   ├── App.tsx                # Workspace shell, remote state hydration & optimistic Appwrite sync
│   ├── services/api.ts        # Typed /api/* frontend client
│   ├── components/
│   │   ├── BrandLogo.tsx      # Original Draft PNG + Custom upload renderer
│   │   ├── InvoicePaper.tsx   # Print-ready dual-currency A4 invoice stationery
│   │   └── Sidebar.tsx        # Responsive desktop rail + mobile navigation drawer
│   ├── views/
│   │   ├── OverviewView.tsx   # Cashflow summary, dual-currency ledger & automation queue
│   │   ├── InvoicesView.tsx   # Searchable invoice ledger, live editor & Download PDF
│   │   ├── ClientsView.tsx    # Multi-currency client directory & CRUD modal
│   │   ├── RecurringRemindersView.tsx # Reminder sweep, cadence templates & log management
│   │   └── BrandStudioView.tsx# Logo upload/download, colors, studio address & payout accounts
│   ├── utils/
│   │   ├── billing.ts         # Currency conversion, WHT/VAT math, CSV export & eligibility engine
│   │   └── billing.test.ts    # Node built-in test runner unit suite
│   ├── data/seedData.ts       # Default brand, starter clients, invoices, retainers & rules
│   └── types/billing.ts       # Shared full-stack TypeScript models
└── .env.example               # Environment template (copy to .env)
```

---

## Appwrite Database Schema (`mitemshub_billing`)

On startup, `server/appwrite.ts` automatically verifies and provisions the target Appwrite **TablesDB** database and tables if they do not exist yet, then seeds them once:

| Table ID | Purpose | Key Attributes |
| --- | --- | --- |
| `studio_meta` | Tracks one-time initialization (`init`) so deletions stay deleted | `initialized`, `updatedAt` |
| `brand_settings` | Studio name, address, logo variant/custom image, FX rate, bank details | `businessName`, `logoVariant`, `customLogoDataUrl`, `accentColor`, `usdBankDetails`, `ngnBankDetails` |
| `clients` | Client profiles & default billing terms | `name`, `company`, `email`, `country`, `preferredCurrency`, `defaultTermsDays`, `tagsJson` |
| `invoices` | Line items, FX pairs, WHT/Tax/discount rates, payment status | `invoiceNumber`, `clientId`, `status`, `primaryCurrency`, `exchangeRate`, `itemsJson`, `whtRatePercent` |
| `recurring_schedules` | Retainer cadences and next run dates | `clientId`, `title`, `frequency`, `itemsJson`, `nextRunDate`, `active` |
| `reminder_rules` | Trigger offsets and tokenized email templates | `name`, `triggerType`, `daysOffset`, `enabled`, `subjectTemplate`, `bodyTemplate` |
| `reminder_logs` | Audit trail of dispatched payment nudges (deletable/clearable) | `invoiceNumber`, `clientName`, `ruleName`, `channel`, `sentAt`, `subject` |

---

## Getting Started

### Requirements

- **Node.js 22.18+** (24 LTS recommended). `npm start` runs `server.ts` directly, which relies on Node's built-in TypeScript type stripping.

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment Variables

Copy `.env.example` to `.env` — or to `.env.local` if you prefer — and fill in your Appwrite project credentials. `.env.local` is read first, then `.env`; existing variables always win. Neither file is committed:

```env
APPWRITE_ENDPOINT="https://fra.cloud.appwrite.io/v1"
APPWRITE_PROJECT_ID="your-appwrite-project-id"
APPWRITE_API_KEY="your-appwrite-server-api-key"
APPWRITE_DATABASE_ID="mitemshub_billing"
```

> Required Appwrite API key scopes: `databases.write`, `tables.write`, `columns.write`, `rows.read`, `rows.write`. Add `tables.read` / `columns.read` if your project enforces schema reads separately.

### 3. Run Development Server

Starts Express API routes (`/api/*`) + Vite on `http://localhost:3000`:

```bash
npm run dev
```

### 4. Production Build & Start

```bash
npm run build
npm start
```

---

## Scripts & Quality Checks

| Command | Description |
| --- | --- |
| `npm run dev` | Start full-stack Express + Vite development server on port `3000` |
| `npm run build` | Build optimized frontend bundle into `dist/` |
| `npm start` | Serve production API + `dist/` bundle via `node server.ts` |
| `npm run lint` | Run strict TypeScript type-checking (`tsc --noEmit`) |
| `npx tsx --test src/utils/billing.test.ts` | Run billing math, FX, reminder & CSV unit tests |

---

## Authentication

Every data route requires a signed-in session whenever Appwrite is configured. Only `GET /api/health` and the `/api/auth/*` routes stay public.

Sign-in is verified against **Appwrite Auth** (email + password). The server never stores the password: it opens a temporary Appwrite session, reads the account profile, then issues its own `httpOnly`, `SameSite=Lax` cookie signed with HMAC-SHA256. Sessions last 8 hours; sign out from the sidebar. If Appwrite is not configured at all, the guard stays off so the app still runs in local-only mode.

### Appwrite console setup

1. **Auth → Settings** — make sure **Email/Password** is enabled for the project.
2. **Auth → Users → Create user** — add the email and password of each person who should reach the studio. This app exposes no public sign-up; accounts are created by you.
3. **No extra API key scopes are needed.** Login uses Appwrite's public session endpoint; the existing server key is only used for TablesDB reads and writes.

### Session environment

```env
# Optional. Signing key for session cookies. When unset it is derived from
# APPWRITE_API_KEY, so sessions still survive restarts.
SESSION_SECRET="a-long-random-string"
```

Set `SESSION_SECRET` in production so the cookie key is independent of the Appwrite key. The cookie is `Secure` when `NODE_ENV=production`, so the deployed app must be served over HTTPS. Failed logins are rate limited: 8 attempts per IP per 10 minutes.

---

## API Endpoints

- `GET /api/health` — Verify server and Appwrite database readiness
- `POST /api/auth/login` — Exchange email + password for a session cookie
- `POST /api/auth/logout` — Clear the session cookie
- `GET /api/auth/session` — Report whether the caller is signed in
- `GET /api/state` — Hydrate brand settings, clients, invoices, recurring schedules, rules, and reminder logs
- `PUT /api/brand` — Persist studio profile, logo choice, and payout accounts
- `PUT /api/clients/:id` · `DELETE /api/clients/:id` — Create/update/delete client records
- `PUT /api/invoices/:id` · `PATCH /api/invoices/:id/status` · `DELETE /api/invoices/:id` — Persist invoice lifecycle
- `PUT /api/recurring/:id` · `DELETE /api/recurring/:id` — Manage recurring billing retainers
- `PUT /api/reminder-rules/:id` — Update reminder trigger cadences & email templates
- `POST /api/reminder-logs` · `DELETE /api/reminder-logs/:id` · `DELETE /api/reminder-logs` — Log, delete single, or clear all reminder dispatch entries

---

## License

MIT © [Mitemshub](https://github.com/MitemsHub)
