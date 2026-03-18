# Rebookd Agent Roadmap

This file is the execution guide for agents working in `C:\Users\Brend\Documents\Rebookd`.

## Mission

Move the repository as close as practical to production-ready across four outcomes:

- Functional completeness
- Quality and reliability
- User friendliness
- Policy and security compliance

This roadmap is intentionally constrained by current repo truth. It is not a product wish list.

## Current State Snapshot

Verified as of this roadmap revision:

- The app is a small FastAPI monolith centered in [main.py](/C:/Users/Brend/Documents/Rebookd/main.py).
- There is no separate package structure, migrations system, or automated test suite yet.
- The current UI lives in five server-rendered templates under [Templates](/C:/Users/Brend/Documents/Rebookd/Templates):
  - `signup.html`
  - `login.html`
  - `dashboard.html`
  - `config.html`
  - `metrics.html`
- Safe sample configuration currently lives in [.env.example](/C:/Users/Brend/Documents/Rebookd/.env.example) and should be treated as the source of truth for supported settings.
- The repo also includes [README.md](/C:/Users/Brend/Documents/Rebookd/README.md), [requirements.txt](/C:/Users/Brend/Documents/Rebookd/requirements.txt), and [.gitignore](/C:/Users/Brend/Documents/Rebookd/.gitignore).
- A tracked file still presents repo-safety risk: [.env.txt](/C:/Users/Brend/Documents/Rebookd/.env.txt) contains a live-looking API key and references capabilities that are not implemented in the current codebase.

Verified route surface in [main.py](/C:/Users/Brend/Documents/Rebookd/main.py):

- `/signup`
- `/login`
- `/dashboard`
- `/config`
- `/metrics`
- `/health`
- `/sms`
- `/status`

Current repo constraints that must shape all work:

- `.env.txt` is unsafe and non-authoritative.
- Stripe, OpenAI, Google OAuth, and similar settings mentioned in `.env.txt` should not be treated as implemented product scope unless code is added first.
- SQLite is the active storage mechanism and all current behavior is built around it.

## Active Defects and Risks

These are current repo truths, not hypothetical concerns:

- [main.py](/C:/Users/Brend/Documents/Rebookd/main.py) `/status` overwrites lead business lifecycle state with Twilio delivery state.
- Webhook endpoints in [main.py](/C:/Users/Brend/Documents/Rebookd/main.py) do not visibly verify Twilio request signatures.
- Form routes currently rely on cookie auth without an explicit CSRF strategy.
- The repo has no automated regression harness for auth, configuration, metrics, or webhook flows.

## Priority Order

1. P0 Repo safety and truth alignment
2. P1 Domain correctness and data integrity
3. P2 Quality and regression harness
4. P3 UX and onboarding polish
5. P4 Hosting and operational readiness
6. P5 Policy and security gate

## Execution Sequence

Follow this order unless an explicit exception is documented in a task handoff:

1. Finish P0 before broad parallel work.
2. Freeze P1 lifecycle semantics before substantial UX or deployment work.
3. Start P2 as soon as P1 behavior is stable enough to codify.
4. Do P3 only against real backend behavior.
5. Do P4 after core flows and tests are trustworthy.
6. Treat P5 as continuous, but require a final security/policy gate before any production-ready claim.

## Workstreams

### P0 Repo Safety and Truth Alignment

Why this matters now:

- The repository should be safe to share before more contributors or automation touch it.
- Docs and env examples must describe the product honestly or later work will drift toward fake scope.

Implementation targets:

- Remove or neutralize live-looking secrets in tracked files, especially [.env.txt](/C:/Users/Brend/Documents/Rebookd/.env.txt).
- Make `.env.example` the only authoritative sample for currently supported configuration.
- Align [README.md](/C:/Users/Brend/Documents/Rebookd/README.md) and any setup notes with what [main.py](/C:/Users/Brend/Documents/Rebookd/main.py) actually implements today.
- Confirm ignore rules still cover local env files, local SQLite artifacts, and generated caches.

Blocked by / unlocks:

- Blocks broad collaboration until complete.
- Unlocks safe branching, safe sharing, and honest downstream planning.

Verification:

- No tracked file contains a real-looking secret.
- README and env samples describe only implemented behavior.
- Fresh local setup steps are complete and internally consistent.

Exit criteria:

- Repo is safe to publish to another contributor.
- `.env.txt` no longer exposes a live-looking secret or implies unsupported features are ready.
- Setup documentation matches the current route surface and required settings.

### P1 Domain Correctness and Data Integrity

Why this matters now:

- Product trust depends on the lead model meaning one thing everywhere.
- Dashboard and metrics work is not reliable until business state and delivery state stop colliding.

Implementation targets:

- Separate lead business lifecycle from transport delivery lifecycle.
- Treat `/status` as a transport-status updater, not a lead-status owner.
- Treat `/sms` as lead activity intake that may create a lead or update an existing lead.
- Define explicit meanings for `new`, `contacted`, and `booked`.
- Review metrics queries so booked revenue and active follow-up counts still match the corrected lifecycle model.
- Tighten config parsing and validation for phone numbers, services, and tenant setup data where needed.

Blocked by / unlocks:

- Should start after P0.
- Blocks substantial P3 UI polish and meaningful P4 production claims.
- Unlocks stable tests in P2 and clearer product language in P3/P4/P5.

Verification:

- Delivery status updates do not mutate lifecycle values such as `new`, `contacted`, or `booked`.
- `/sms` behavior preserves booked leads while still recording new inbound activity.
- Dashboard and metrics still compute recovered revenue, booked leads, and active follow-ups consistently.
- Lead transitions are explicit enough to test deterministically.

Exit criteria:

- Business lifecycle and transport lifecycle are clearly separated in code and docs.
- No webhook path can silently corrupt lead state semantics.
- Metrics and dashboard outputs remain internally consistent after the fix.

### P2 Quality and Regression Harness

Why this matters now:

- The monolith is small enough to test cheaply and fragile enough to need protection.
- P1 changes will be easy to regress unless the core flows are codified.

Implementation targets:

- Add automated tests for signup, login, config save, dashboard, metrics, `/health`, `/sms`, and `/status`.
- Add a repeatable SQLite test database strategy with isolation/reset per test run.
- Introduce minimal linting and formatting checks if they can be added without inventing unnecessary tooling complexity.
- Refactor only where needed to make behavior testable and route logic easier to reason about.

Blocked by / unlocks:

- Depends on stable P1 lifecycle semantics.
- Can run in parallel with narrow P3 work after route behavior is frozen.
- Unlocks safer refactors, safer security work, and credible readiness claims.

Verification:

- Test suite runs repeatably against isolated SQLite state.
- Critical route behavior is covered with deterministic assertions.
- Test fixtures or helpers do not require manual DB cleanup.

Exit criteria:

- Core routes have automated coverage.
- DB-dependent flows are repeatable in local development and CI-style execution.
- Future changes to auth, config, lifecycle, or metrics are likely to fail fast when broken.

### P3 UX and Onboarding Polish

Why this matters now:

- The current product is already usable enough to refine, but only after backend semantics are trustworthy.
- Small UX clarity improvements will meaningfully reduce first-time confusion for appointment-based businesses.

Implementation targets:

- Improve the signup -> config -> dashboard journey using the routes and fields that actually exist.
- Add clearer guidance, validation messaging, empty states, and success states in [Templates](/C:/Users/Brend/Documents/Rebookd/Templates).
- Improve mobile behavior and scannability on dashboard and metrics pages.
- Keep template language aligned to the actual backend model and current feature set.

Blocked by / unlocks:

- Depends on P1 semantics being stable.
- Can overlap with P2 once backend contract is frozen.
- Unlocks clearer onboarding and lower support burden.

Verification:

- Empty, success, and validation states render cleanly on core templates.
- New-user flow works without outside instructions.
- Desktop and mobile layouts remain understandable for signup, config, dashboard, and metrics.

Exit criteria:

- A first-time user can reach a configured dashboard without guesswork.
- Core templates communicate current product behavior accurately.
- Empty/error states feel intentional rather than broken.

Stop doing:

- Do not add UI for OpenAI, Google OAuth, Stripe plans, or other flows that are only referenced in `.env.txt` unless backend support is implemented first.

### P4 Hosting and Operational Readiness

Why this matters now:

- Deployment guidance is only useful once the app behaves correctly and predictably.
- Operational assumptions should be explicit before anyone treats the repo as a hosted product.

Implementation targets:

- Document the intended runtime topology and startup expectations.
- Clarify environment separation, secret handling, and runtime-required settings.
- Strengthen health/readiness expectations and logging guidance.
- Decide whether SQLite remains acceptable for expected usage or whether a migration plan is required.

Blocked by / unlocks:

- Depends on P1 and should preferably follow meaningful P2 coverage.
- Unlocks cleaner handoff to hosting and lower deployment surprise.

Verification:

- Deployment assumptions are documented without requiring code edits at deploy time.
- Health checks and logs are meaningful for local and hosted operation.
- Storage choice is explicitly justified.

Exit criteria:

- Another engineer can understand how to run and host the app from docs alone.
- Production configuration expectations are explicit.
- Known operational limitations are documented instead of implied away.

Stop doing:

- Do not document production support for unimplemented capabilities just because variables exist in `.env.txt`.

### P5 Policy and Security Gate

Why this matters now:

- The app handles auth, tenant data, and messaging flows, so basic trust boundaries need to be explicit before production claims.
- Security and privacy posture should be a final gate, not a retroactive cleanup.

Implementation targets:

- Add Twilio webhook signature verification.
- Enforce non-placeholder secret handling for production environments.
- Define and implement a CSRF strategy for authenticated form posts.
- Document privacy, consent, retention, and tenant-isolation expectations appropriate to the current product.
- Add basic auditability expectations for account and messaging actions.

Blocked by / unlocks:

- Can begin in parallel in small pieces, but final signoff should follow P1 and P2 stabilization.
- Unlocks any credible statement that the app is production-ready.

Verification:

- Inbound webhook trust is verified.
- Production mode does not silently run on placeholder secrets.
- Sensitive form flows have basic tamper resistance.
- Repo includes a documented privacy and consent posture.

Exit criteria:

- Highest-risk trust and abuse gaps are closed or explicitly documented.
- Security-sensitive flows have baseline protections.
- Production-readiness claims have a defined gate rather than a vague feeling.

## Lane Ownership

Each contributor should claim one lane only unless explicit coordination says otherwise:

- Docs/env hygiene lane
  - Owns env files, README/setup notes, and repo-safety cleanups.
- Backend/domain lane
  - Owns lead lifecycle logic, webhook semantics, and related code in [main.py](/C:/Users/Brend/Documents/Rebookd/main.py).
- Test/tooling lane
  - Owns test harness, fixtures, and quality-tooling setup.
- Template UX lane
  - Owns presentation-layer changes under [Templates](/C:/Users/Brend/Documents/Rebookd/Templates).
- Ops/security lane
  - Owns runtime posture, deployment docs, webhook trust, and security middleware/guardrails.

## Merge Guidance for This Repo

- Only one lane should edit core lead lifecycle logic in [main.py](/C:/Users/Brend/Documents/Rebookd/main.py) at a time unless responsibilities are split by function or route.
- Template work should avoid backend contract changes.
- Test work can proceed in parallel once target behavior is frozen.
- Ops/security changes should coordinate carefully with backend changes touching auth, forms, and webhooks.
- Merge P0 first, then P1, then P2. Only after that should larger P3/P4/P5 changes stack up.

## Definition of Done

No task is done until all of the following are true:

- The target user flow works.
- Failure states are handled.
- Verification was added or documented.
- Docs or env examples were updated if behavior changed.
- No new secret exposure, misleading feature claim, or policy regression was introduced.

## Verification Expectations

Every change should include:

- A manual route-level check for the affected flow
- Automated coverage when behavior is critical or easy to regress
- Notes on schema or data-model impact
- A short security/policy impact note, even if the answer is `none`

## Manual Smoke Checklist

Run these checks after each major milestone that touches the affected area:

1. Visit `/signup` and create a tenant account.
2. Visit `/login` and confirm auth redirect behavior works.
3. Visit `/config` and verify phone/service validation plus save success.
4. Visit `/dashboard` and confirm setup checklist plus recent lead state render correctly.
5. Visit `/metrics` and confirm booked counts and revenue presentation still make sense.
6. Call `/health` and confirm expected app/database status output.
7. Exercise `/sms` for a matched tenant and confirm lead creation or update behavior.
8. Exercise `/status` and confirm transport delivery updates do not overwrite lifecycle states.

## Test Plan Expectations

At minimum, the regression plan should cover:

- Signup creates both a user and a tenant.
- Login sets the auth cookie and redirects correctly.
- Config save validates E.164-style Twilio phone numbers and service parsing.
- Dashboard and metrics render for an authenticated tenant.
- `/health` succeeds without optional integrations configured.
- `/sms` creates a lead for a matching tenant and updates an existing lead without breaking booked state.
- `/status` records delivery progress without overwriting lifecycle values such as `new`, `contacted`, or `booked`.

## Assumptions and Defaults

- This roadmap is for completing the repo execution guide, not claiming that the code changes are already done.
- The roadmap should work for either one engineer or multiple agents, but it assumes lane discipline because the backend currently lives in one file.
- Current repo truth comes from [main.py](/C:/Users/Brend/Documents/Rebookd/main.py), [Templates](/C:/Users/Brend/Documents/Rebookd/Templates), [.env.example](/C:/Users/Brend/Documents/Rebookd/.env.example), and [README.md](/C:/Users/Brend/Documents/Rebookd/README.md).
- No new feature area should be added to the roadmap unless the current repo supports it or a future task explicitly expands scope.

## Immediate Next Moves

1. Neutralize unsafe values and unsupported claims in [.env.txt](/C:/Users/Brend/Documents/Rebookd/.env.txt).
2. Fix the `/status` lifecycle collision in [main.py](/C:/Users/Brend/Documents/Rebookd/main.py).
3. Add tests around lead lifecycle, webhook behavior, auth, config, and health routes.
4. Improve signup, config, dashboard, and metrics UX only after lifecycle semantics are stable.
5. Add webhook verification and CSRF posture before any production-ready claim.
