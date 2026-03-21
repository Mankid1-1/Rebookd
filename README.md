# Rebookd v2

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
DATABASE_URL=mysql://user:password@host:3306/rebookd
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
rebookd/
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
