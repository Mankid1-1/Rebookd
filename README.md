# Rebookd

Rebookd is a small FastAPI app for appointment-based businesses that want to recover missed-call revenue through a simple dashboard, structured business setup, and Twilio-driven lead capture.

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

- The app is still a single-file FastAPI monolith in [main.py](/C:/Users/Brend/Documents/Rebookd/main.py).
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
