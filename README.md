<<<<<<< HEAD
# Rebooked v2

AI-powered SMS revenue recovery platform for appointment-based businesses.

## Quick Start

### Prerequisites
- Node.js 18+
- pnpm (`npm install -g pnpm`)
- MySQL database (PlanetScale, Railway, or local)

### 1. Install dependencies
```bash
pnpm install
```

### 2. Configure environment
Create a `.env` file in the project root:
```env
DATABASE_URL=mysql://user:password@host:3306/rebooked
JWT_SECRET=your-32-char-secret-here
VITE_APP_ID=your-oauth-app-id
OAUTH_SERVER_URL=https://your-oauth-server.com
VITE_OAUTH_PORTAL_URL=https://your-oauth-server.com
OWNER_OPEN_ID=your-open-id-for-admin-account
```

### 3. Push schema to database
```bash
pnpm db:push
```

### 4. Seed plans (run once in your DB)
```sql
INSERT INTO plans (name, slug, priceMonthly, maxAutomations, maxMessages, maxSeats) VALUES
  ('Starter', 'starter', 4900,  6,  500,   1),
  ('Growth',  'growth',  9900,  12, 2000,  5),
  ('Scale',   'scale',   19900, 16, 10000, 20);
```

### 5. Run in development
```bash
pnpm dev
```

App runs at `http://localhost:3000`

### 6. Build for production
```bash
pnpm build
pnpm start
```

---

## Architecture

```
rebooked/
├── client/src/
│   ├── pages/
│   │   ├── Home.tsx              # Public landing page
│   │   ├── Onboarding.tsx        # 3-step business setup wizard
│   │   ├── Dashboard.tsx         # Metrics + charts
│   │   ├── Leads.tsx             # Lead management
│   │   ├── LeadDetail.tsx        # SMS conversation view
│   │   ├── Automations.tsx       # 16 pre-built automations
│   │   ├── Templates.tsx         # Message templates
│   │   ├── Analytics.tsx         # Analytics charts
│   │   ├── Billing.tsx           # Plans + usage
│   │   ├── Settings.tsx          # Business settings
│   │   └── admin/                # Admin-only pages
│   └── components/
│       ├── DashboardLayout.tsx   # Sidebar + nav
│       └── ui/                   # shadcn/ui components
├── server/
│   ├── routers.ts                # All tRPC routes
│   ├── db.ts                     # All DB queries
│   └── _core/                    # Express, auth, tRPC setup
├── drizzle/
│   └── schema.ts                 # Full DB schema
└── shared/
    └── const.ts                  # Shared constants
```

## Automations

16 pre-built automations across 7 categories — all toggle-enabled, no builder required:

| Category | Automations |
|---|---|
| Appointment | 24hr Reminder, 2hr Reminder, Booking Confirmation |
| No-Show | Check-In, Rebook Offer |
| Cancellation | Acknowledgement, Post-Cancellation Rebook |
| Follow-Up | Post-Visit Feedback, Post-Visit Upsell, 3-Day Lead, 7-Day Lead |
| Re-Engagement | 30-Day Win-Back, 90-Day Win-Back |
| Welcome | New Lead Welcome |
| Loyalty | Birthday Promo, Loyalty Milestone |

## Multi-Tenant SaaS Model

- Businesses sign up and get their own isolated tenant
- Plans: Starter ($49), Growth ($99), Scale ($199)
- Admin panel at `/admin/*` for platform management
- `OWNER_OPEN_ID` in `.env` gets automatic `admin` role

## Key tRPC Procedures

| Procedure | Description |
|---|---|
| `automations.toggleByKey` | Enable/disable a pre-built automation |
| `automations.configureByKey` | Save config (delay, message, offer) |
| `automations.list` | Returns all automations for current tenant |
| `onboarding.setup` | Creates tenant + trial subscription |
| `tenant.get/update` | Tenant settings |
| `leads.*` | Lead CRUD + SMS sending |
| `admin.tenants.list` | Platform-wide tenant overview |
=======
# Rebooked

Rebooked is a small FastAPI app for appointment-based businesses that want to recover missed-call revenue through a simple dashboard, structured business setup, and Twilio-driven lead capture.

## Current capabilities

- Signup, login, logout, and signed cookie auth
- Tenant configuration for Twilio number, service catalog, and incentive copy
- Dashboard and metrics pages backed by SQLite tenant and lead data
- `/sms` webhook intake for inbound lead activity
- `/status` webhook handling for Twilio delivery tracking
- CSRF protection for HTML form POST routes
- Twilio signature verification for inbound webhook routes
- Health check with basic configuration visibility

## Current limitations

- The app is still a single-file FastAPI monolith in [main.py](/C:/Users/Brend/Documents/Rebooked/main.py).
- SQLite is the active database and is best suited to local development or low-volume deployments.
- There is no background job system, migrations framework, or production hosting config yet.
- OpenAI, Google OAuth, Stripe subscriptions, and calendar flows are not implemented in the current repo even if older notes mention them.

## Local setup

1. Create a virtual environment.
2. Install dependencies with `pip install -r requirements.txt`.
3. Copy `.env.example` to `.env`.
4. Set `SECRET_KEY` to a long random value.
5. If you want webhook routes to accept Twilio requests, also set `TWILIO_AUTH_TOKEN` and the related Twilio values.
6. If you want best-effort Stripe customer creation during signup, set `STRIPE_SECRET_KEY`.
7. Run `python main.py`.

The app starts on `http://localhost:8000`.

`.env.example` is the authoritative sample for supported configuration. Older env notes or templates should not be treated as product scope unless the code and docs were updated together.

## Lead model

- `new`: a lead exists but no recovery interaction has happened yet
- `contacted`: a recovery interaction happened through SMS or callback workflow
- `booked`: the lead converted and can be counted toward recovered revenue

Twilio delivery state is tracked separately from lead lifecycle and must not overwrite those business states.

## Useful routes

- `/signup`
- `/login`
- `/logout`
- `/dashboard`
- `/config`
- `/metrics`
- `/health`
- `/sms`
- `/status`

## Testing

Run the regression suite with:

```bash
pytest
```

The tests use an isolated SQLite database and do not require live Twilio or Stripe services.

## Security notes

- If a local or historical env file ever contained real secrets, rotate them.
- Production and staging should never run with placeholder `SECRET_KEY` values.
- Webhook trust depends on `TWILIO_AUTH_TOKEN` being configured correctly.
- This repo does not yet include a full privacy policy, retention tooling, or audit log system, so production claims should stay conservative.
>>>>>>> d13c058bdd90ffaf7ded8c5ac5fd7108489d89df
