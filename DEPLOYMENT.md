**Rebookd — Docker & Deployment Guide (Railway / Render / Docker Compose)**

Quick: this guide helps you build, run, and deploy Rebookd using Docker (or container hosts such as Railway/Render).

1) Build & run locally with Docker Compose

- Ensure env vars in a `.env` file (see list below).
- Start:

```bash
docker compose up --build
```

The API will be available at `http://localhost:3000`.

2) Environment variables (minimum required)

- `DATABASE_URL` — MySQL connection (mysql://user:pass@host:3306/dbname)
- `MYSQL_ROOT_PASSWORD` (for docker-compose local DB)
- `STRIPE_SECRET_KEY` — Stripe secret API key
- `STRIPE_WEBHOOK_SECRET` — Stripe webhook signing secret
- `APP_URL` — public URL (https://your-domain)
- `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER`
- `JWT_SECRET` or other secrets used in `.env`

3) Deploying to Railway / Render

- Railway (recommended quick path): create a new project, connect your Git repo, and add a service from `Dockerfile` or use the Docker Compose option. Set the environment variables in the Railway dashboard. Add a persistent MySQL add-on (Railway) or connect an external PlanetScale/Aiven database.

- Render: create a new Web Service, set `Dockerfile` build, set `PORT=3000` and environment variables. For the worker, add a separate Background Worker service using command `node dist/worker.js`.

Notes for PlanetScale / Serverless MySQL providers:
- PlanetScale forbids direct `ALTER`/`LOCK` operations; ensure migrations are compatible (use migrate with appropriate flags). Use a managed DB user with proper grants.

4) Stripe webhooks & Twilio

- Configure Stripe Webhook URL: `https://<YOUR_DOMAIN>/api/stripe/webhook`. Copy the signing secret to `STRIPE_WEBHOOK_SECRET`.
- Configure Twilio Messaging webhook (for inbound SMS) to `https://<YOUR_DOMAIN>/api/twilio/inbound` (POST). Use the phone number's Messaging webhook.

5) Process model

- App: runs `node dist/index.js` (Express + tRPC server). Expose port `3000`.
- Worker: runs `node dist/worker.js` (background jobs, retries). Deploy as separate process or service in your host.

6) Post-deploy checklist

- Run migrations: `pnpm db:migrate` (or via provider CLI). Ensure `plans` seeded: `pnpm db:seed:plans`.
- Create Stripe Prices and set `STRIPE_PRICE_STARTER`, `STRIPE_PRICE_GROWTH`, `STRIPE_PRICE_SCALE` env vars (used by seeds).
- Add domain, enable HTTPS, test webhook endpoints with Stripe CLI: `stripe listen --forward-to https://<YOUR_DOMAIN>/api/stripe/webhook`.

7) Helpful commands

```bash
# Build (local)
pnpm install
pnpm build

# Run locally (dev)
pnpm dev

# Build + run prod dist
pnpm build
node dist/index.js
```

If you want, I can produce a cloud-specific manifest for Railway or Render (with exact service definitions and env var templates).
