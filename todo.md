# Rebookd 1.1 — Project TODO

## Database Schema
- [x] Tenants table (multi-tenant support)
- [x] Leads table (contacts with phone, status, metadata)
- [x] Messages table (inbound/outbound SMS logs)
- [x] Automations table (trigger-action workflows)
- [x] Templates table (message templates with tone)
- [x] Subscriptions/Plans table (billing tiers)
- [x] Usage table (message/automation counters)
- [x] PhoneNumbers table (per-tenant Twilio numbers)
- [x] AIMessageLog table (AI rewrite audit log)
- [x] WebhookLog table (delivery tracking + retry)
- [x] ApiKeys table (tenant API key management)
- [x] SystemErrors table (error logging)
- [x] Plans seeded (Starter $49, Growth $99, Scale $199)

## Backend (tRPC Routers)
- [x] Auth: login, logout, me
- [x] Tenants: get/update tenant settings, onboarding setup
- [x] Leads: list, create, update status, view conversation
- [x] Messages: list by lead, send SMS (via Twilio)
- [x] Automations: list, create, update, toggle enable/disable, delete
- [x] Templates: list, create, update, delete, preview tone (AI)
- [x] Analytics: dashboard metrics, message stats, lead stats, message volume
- [x] Billing: get subscription, get plans, upgrade/downgrade
- [x] PhoneNumbers: list, add, remove, set-default, set-inbound
- [x] ApiKeys: list, create, revoke
- [x] AI: rewrite message with tone selection
- [x] Admin: tenant management (list, get)
- [x] Admin: user management (list, toggle active)
- [x] Admin: system health (errors, uptime)
- [x] Admin: webhook logs
- [x] Admin: AI message logs

## Frontend Pages
- [x] Landing page (marketing, features, pricing, CTA)
- [x] Onboarding page (business setup wizard)
- [x] Dashboard (metrics overview, charts, recent activity)
- [x] Leads list page (table, filters, search, status badges, add lead)
- [x] Lead detail / Conversation view (SMS thread, send message, update status)
- [x] Automations list page (starter templates, toggle, delete)
- [x] Automation builder (create/edit workflow with trigger + actions)
- [x] Templates page (list, create, edit, delete, AI preview)
- [x] Analytics page (charts, message volume, lead funnel, conversion rates)
- [x] Billing page (plan selection, subscription status, usage meters)
- [x] Settings page (tenant info, phone numbers, API keys)
- [x] Admin: Tenants list
- [x] Admin: Users list
- [x] Admin: System health (errors + webhook logs)
- [x] Admin: AI message logs

## UI/UX
- [x] Dark theme with brand colors (deep navy + electric blue)
- [x] DashboardLayout with resizable sidebar navigation
- [x] Responsive design (mobile-first)
- [x] Loading states and empty states on all pages
- [x] Toast notifications for all actions
- [x] Status badges for leads/automations
- [x] Custom scrollbar styling
- [x] Google Fonts (Inter + Space Grotesk)
- [x] 404 page matching brand theme
- [x] Admin section in sidebar (admin users only)

## Tests
- [x] Auth logout test (19 total tests passing)
- [x] Auth me test (authenticated + unauthenticated)
- [x] Plans list test
- [x] Tenant get test
- [x] Leads list + create test
- [x] Automations list test
- [x] Templates list + create + preview test
- [x] Analytics dashboard test
- [x] Admin RBAC tests (FORBIDDEN for non-admin)
- [x] Admin tenants + users + system health tests

## Deployment and Ops
- [x] Configure production MySQL and DATABASE_URL setup (`.env.example` included)
- [x] Set up Twilio number + inbound webhook route (`/api/twilio/inbound`)
- [x] Secure environment secrets in `.env` / production secret manager
- [x] Docker/ deployment docs updated in `DEPLOYMENT.md`
- [ ] Final E2E test of all automations (manual or CI script pending)

