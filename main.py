from __future__ import annotations

import json
import logging
import os
import re
import secrets
import sqlite3
from contextlib import asynccontextmanager
from dataclasses import dataclass
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any

import bcrypt
import stripe
import uvicorn
from dotenv import load_dotenv
from fastapi import Depends, FastAPI, Form, HTTPException, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.responses import HTMLResponse, RedirectResponse, Response
from fastapi.templating import Jinja2Templates
from itsdangerous import BadSignature, SignatureExpired, URLSafeTimedSerializer
from twilio.request_validator import RequestValidator
from twilio.rest import Client

load_dotenv()

BASE_DIR = Path(__file__).resolve().parent
TEMPLATE_DIR = BASE_DIR / "Templates"
DATABASE_PATH = BASE_DIR / os.getenv("DATABASE_PATH", "rebookd.db")

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("rebookd")

CSRF_COOKIE_NAME = "csrf_seed"
CSRF_MAX_AGE_SECONDS = 60 * 60 * 2
AUTH_MAX_AGE_SECONDS = 60 * 60 * 24 * 30

DEFAULT_AUTOMATIONS: dict[str, Any] = {
    "new_lead": {
        "enabled": False,
        "message_1": "Hi {name}, thanks for reaching out to {business}! We'd love to get you booked. {booking_url}",
        "message_2": "Just following up — would you like to schedule an appointment? {booking_url}",
        "delay_minutes": 1440,
        "stop_on_reply": True,
        "stop_on_booking": True,
    },
    "missed_call": {
        "enabled": True,
        "message_1": "Hi! You just called {business}. We'd love to get you booked — {booking_url} Reply STOP to opt out.",
        "message_2": "Still looking to book with {business}? We have availability this week. {booking_url}",
        "delay_minutes": 1440,
        "stop_on_reply": True,
        "stop_on_booking": True,
        "voicemail_branch": True,
    },
    "no_show": {
        "enabled": False,
        "message_1": "Hi {name}, we missed you today at {business}! Life happens — let's get you rescheduled. {booking_url}",
        "message_2": "We'd still love to see you. Here's our booking link when you're ready: {booking_url}",
        "delay_minutes": 1440,
        "stop_on_reply": True,
        "stop_on_booking": True,
    },
    "cancellation": {
        "enabled": False,
        "message_1": "Your appointment at {business} has been cancelled. Whenever you're ready to rebook: {booking_url}",
        "message_2": "We'd love to get you back on the calendar. {booking_url}",
        "delay_minutes": 2880,
        "stop_on_reply": True,
        "stop_on_booking": True,
    },
    "reactivation": {
        "enabled": False,
        "message_1": "Hi {name}, we miss you at {business}! It's been a while — here's a link to book your next visit: {booking_url}",
        "message_2": "Still thinking about it? We'd love to see you again. {booking_url}",
        "delay_minutes": 2880,
        "inactivity_days": 60,
        "stop_on_reply": True,
        "stop_on_booking": True,
    },
    "review": {
        "enabled": False,
        "message_1": "Thanks for visiting {business}! We'd love your feedback — could you leave us a quick review? {review_url}",
        "message_2": "Your opinion means a lot to us. If you have a moment: {review_url}",
        "delay_minutes": 60,
        "review_url": "",
        "stop_on_reply": True,
    },
}

DEFAULT_GLOBAL_SETTINGS: dict[str, Any] = {
    "tone": "friendly",
    "ai_behavior": "flexible",
    "message_frequency": "one_followup",
    "business_hours": {
        "monday":    {"open": "09:00", "close": "17:00", "enabled": True},
        "tuesday":   {"open": "09:00", "close": "17:00", "enabled": True},
        "wednesday": {"open": "09:00", "close": "17:00", "enabled": True},
        "thursday":  {"open": "09:00", "close": "17:00", "enabled": True},
        "friday":    {"open": "09:00", "close": "17:00", "enabled": True},
        "saturday":  {"open": "10:00", "close": "15:00", "enabled": False},
        "sunday":    {"open": "10:00", "close": "15:00", "enabled": False},
    },
    "after_hours_behavior": "delay",
    "smart_hours": True,
    "notify_new_lead": True,
    "notify_reply": True,
    "notify_booking": True,
    "notify_missed_call": True,
    "notify_no_show": False,
    "booking_link_style": "standard",
    "default_message2_delay": 1440,
    "default_reactivation_delay": 60,
    "default_review_delay": 60,
    "auto_tag_new_leads": True,
    "auto_tag_missed_calls": True,
    "auto_tag_no_shows": True,
    "auto_tag_cancellations": True,
}


@dataclass
class Settings:
    app_name: str = "Rebookd"
    host: str = os.getenv("HOST", "0.0.0.0")
    port: int = int(os.getenv("PORT", "8000"))
    secret_key: str = os.getenv("SECRET_KEY", "change-me-in-production")
    stripe_secret_key: str = os.getenv("STRIPE_SECRET_KEY", "")
    twilio_account_sid: str = os.getenv("TWILIO_ACCOUNT_SID", "")
    twilio_auth_token: str = os.getenv("TWILIO_AUTH_TOKEN", "")
    twilio_phone: str = os.getenv("TWILIO_PHONE", "")
    base_url: str = os.getenv("BASE_URL", "")

    @property
    def environment(self) -> str:
        return os.getenv("ENVIRONMENT", "development").lower()

    @property
    def cookie_secure(self) -> bool:
        return self.environment in {"production", "staging"}

    @property
    def production_mode(self) -> bool:
        return self.environment in {"production", "staging"}


settings = Settings()
serializer = URLSafeTimedSerializer(settings.secret_key)
stripe.api_key = settings.stripe_secret_key or None

twilio_client = (
    Client(settings.twilio_account_sid, settings.twilio_auth_token)
    if settings.twilio_account_sid and settings.twilio_auth_token
    else None
)


# ---------------------------------------------------------------------------
# Database
# ---------------------------------------------------------------------------

def get_db() -> sqlite3.Connection:
    connection = sqlite3.connect(DATABASE_PATH)
    connection.row_factory = sqlite3.Row
    connection.execute("PRAGMA foreign_keys = ON")
    return connection


def ensure_column(connection: sqlite3.Connection, table: str, column: str, definition: str) -> None:
    cols = {r["name"] for r in connection.execute(f"PRAGMA table_info({table})").fetchall()}
    if column not in cols:
        connection.execute(f"ALTER TABLE {table} ADD COLUMN {column} {definition}")


def init_db() -> None:
    with get_db() as conn:
        conn.executescript("""
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                email TEXT NOT NULL UNIQUE,
                hashed_pw BLOB NOT NULL,
                stripe_customer_id TEXT,
                subscription_status TEXT NOT NULL DEFAULT 'trial',
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS tenants (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL UNIQUE,
                business_name TEXT NOT NULL,
                twilio_phone TEXT UNIQUE,
                booking_url TEXT,
                services_json TEXT NOT NULL DEFAULT '[]',
                incentive TEXT,
                automations_json TEXT,
                global_settings_json TEXT,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT,
                FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS leads (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                tenant_id INTEGER NOT NULL,
                phone TEXT NOT NULL,
                name TEXT,
                status TEXT NOT NULL DEFAULT 'new',
                tags TEXT NOT NULL DEFAULT '[]',
                source TEXT,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                booked_at TEXT,
                details TEXT,
                recovery_method TEXT,
                revenue REAL NOT NULL DEFAULT 0,
                external_id TEXT,
                last_message_at TEXT,
                delivery_status TEXT,
                delivery_status_updated_at TEXT,
                last_outbound_message_sid TEXT,
                followup_scheduled_at TEXT,
                followup_sent INTEGER NOT NULL DEFAULT 0,
                FOREIGN KEY(tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS automation_log (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                tenant_id INTEGER NOT NULL,
                lead_id INTEGER,
                automation_type TEXT NOT NULL,
                message_index INTEGER NOT NULL DEFAULT 1,
                status TEXT NOT NULL DEFAULT 'sent',
                message_body TEXT,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY(tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
            );

            CREATE INDEX IF NOT EXISTS idx_tenants_user_id ON tenants(user_id);
            CREATE INDEX IF NOT EXISTS idx_tenants_twilio_phone ON tenants(twilio_phone);
            CREATE INDEX IF NOT EXISTS idx_leads_tenant_id ON leads(tenant_id);
            CREATE INDEX IF NOT EXISTS idx_leads_external_id ON leads(external_id);
            CREATE INDEX IF NOT EXISTS idx_leads_followup ON leads(followup_scheduled_at);
            CREATE INDEX IF NOT EXISTS idx_leads_last_outbound_message_sid ON leads(last_outbound_message_sid);
        """)

        for tbl, col, defn in [
            ("leads", "external_id", "TEXT"),
            ("leads", "last_message_at", "TEXT"),
            ("leads", "delivery_status", "TEXT"),
            ("leads", "delivery_status_updated_at", "TEXT"),
            ("leads", "last_outbound_message_sid", "TEXT"),
            ("leads", "name", "TEXT"),
            ("leads", "tags", "TEXT NOT NULL DEFAULT '[]'"),
            ("leads", "source", "TEXT"),
            ("leads", "followup_scheduled_at", "TEXT"),
            ("leads", "followup_sent", "INTEGER NOT NULL DEFAULT 0"),
            ("tenants", "updated_at", "TEXT"),
            ("tenants", "booking_url", "TEXT"),
            ("tenants", "automations_json", "TEXT"),
            ("tenants", "global_settings_json", "TEXT"),
        ]:
            ensure_column(conn, tbl, col, defn)

        conn.execute("UPDATE tenants SET updated_at = CURRENT_TIMESTAMP WHERE updated_at IS NULL")


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def is_real_secret(value: str) -> bool:
    if not value:
        return False
    lowered = value.lower()
    return not any(t in lowered for t in {"your_", "xxxxxxxx", "change-this", "change-me", "example", "replace-with"})


def is_valid_email(email: str) -> bool:
    return bool(re.match(r"^[^@\s]+@[^@\s]+\.[^@\s]+$", email))


def ensure_runtime_security() -> None:
    if settings.production_mode and not is_real_secret(settings.secret_key):
        raise RuntimeError("SECRET_KEY must be set to a non-placeholder value in production or staging.")


def parse_services(text: str) -> list[dict[str, Any]]:
    services: list[dict[str, Any]] = []
    for raw in text.split(","):
        item = raw.strip()
        if not item:
            continue
        parts = [p.strip() for p in item.split(":")]
        if len(parts) != 3:
            raise ValueError("Each service must be Name:minutes:price. Example: Haircut:45:65")
        name, mins, price = parts
        try:
            services.append({"name": name, "minutes": int(mins), "price": float(price)})
        except ValueError as exc:
            raise ValueError("Service minutes must be an integer and price must be a number.") from exc
    return services


def services_to_text(services_json: str | None) -> str:
    if not services_json:
        return ""
    try:
        items = json.loads(services_json)
    except json.JSONDecodeError:
        return ""
    return ", ".join(
        f"{s.get('name','').strip()}:{s.get('minutes',0)}:{s.get('price',0)}"
        for s in items
        if s.get("name", "").strip()
    )


def get_tenant_automations(tenant: dict) -> dict[str, Any]:
    raw = tenant.get("automations_json")
    if raw:
        try:
            stored = json.loads(raw)
            merged = {}
            for key, defaults in DEFAULT_AUTOMATIONS.items():
                merged[key] = {**defaults, **stored.get(key, {})}
            return merged
        except (json.JSONDecodeError, TypeError):
            pass
    return {k: dict(v) for k, v in DEFAULT_AUTOMATIONS.items()}


def get_global_settings(tenant: dict) -> dict[str, Any]:
    raw = tenant.get("global_settings_json")
    if raw:
        try:
            stored = json.loads(raw)
            merged = dict(DEFAULT_GLOBAL_SETTINGS)
            merged.update(stored)
            if "business_hours" in stored:
                merged["business_hours"] = {
                    day: {**DEFAULT_GLOBAL_SETTINGS["business_hours"].get(day, {}), **stored["business_hours"].get(day, {})}
                    for day in DEFAULT_GLOBAL_SETTINGS["business_hours"]
                }
            return merged
        except (json.JSONDecodeError, TypeError):
            pass
    return dict(DEFAULT_GLOBAL_SETTINGS)


def is_within_business_hours(gs: dict) -> bool:
    now = datetime.now()
    day_name = now.strftime("%A").lower()
    hours = gs.get("business_hours", {}).get(day_name, {})
    if not hours.get("enabled", True):
        return False
    try:
        open_h, open_m = map(int, hours["open"].split(":"))
        close_h, close_m = map(int, hours["close"].split(":"))
        open_dt = now.replace(hour=open_h, minute=open_m, second=0, microsecond=0)
        close_dt = now.replace(hour=close_h, minute=close_m, second=0, microsecond=0)
        return open_dt <= now <= close_dt
    except (KeyError, ValueError):
        return True


def format_message(template: str, tenant: dict, lead: dict | None = None) -> str:
    booking_url = tenant.get("booking_url") or ""
    business = tenant.get("business_name") or "us"
    name = (lead or {}).get("name") or "there"
    return (
        template
        .replace("{business}", business)
        .replace("{booking_url}", booking_url)
        .replace("{name}", name)
        .replace("{review_url}", "")
    ).strip()


def log_automation(conn: sqlite3.Connection, tenant_id: int, lead_id: int | None,
                   auto_type: str, msg_index: int, body: str, status: str = "sent") -> None:
    conn.execute(
        "INSERT INTO automation_log (tenant_id, lead_id, automation_type, message_index, status, message_body) VALUES (?,?,?,?,?,?)",
        (tenant_id, lead_id, auto_type, msg_index, status, body),
    )


def send_sms(to: str, from_: str, body: str) -> str | None:
    if not twilio_client:
        logger.warning("Twilio not configured — skipping SMS to %s", to)
        return None
    try:
        msg = twilio_client.messages.create(body=body, from_=from_, to=to)
        return msg.sid
    except Exception as exc:
        logger.warning("Failed to send SMS to %s: %s", to, exc)
        return None


def run_automation(
    conn: sqlite3.Connection,
    automation_type: str,
    tenant: dict,
    lead_id: int | None,
    from_number: str,
    to_number: str,
) -> None:
    automations = get_tenant_automations(tenant)
    gs = get_global_settings(tenant)
    auto = automations.get(automation_type, {})

    if not auto.get("enabled", False):
        return

    msg1 = format_message(auto.get("message_1", ""), tenant, {"name": None} if not lead_id else None)
    delay_minutes = int(auto.get("delay_minutes", gs.get("default_message2_delay", 1440)))

    within_hours = is_within_business_hours(gs)
    after_hours_behavior = gs.get("after_hours_behavior", "delay")

    if not within_hours and after_hours_behavior == "delay":
        now = datetime.now()
        scheduled = (now + timedelta(hours=8)).isoformat()
    else:
        scheduled = None

    if not within_hours and after_hours_behavior == "delay" and scheduled:
        logger.info("After-hours: delaying %s message for %s until %s", automation_type, from_number, scheduled)
    else:
        sid = send_sms(from_number, to_number, msg1)
        if sid and lead_id:
            conn.execute(
                "UPDATE leads SET last_outbound_message_sid=?, last_message_at=CURRENT_TIMESTAMP WHERE id=?",
                (sid, lead_id),
            )
        if lead_id:
            log_automation(conn, tenant["id"], lead_id, automation_type, 1, msg1)

    msg2_template = auto.get("message_2", "")
    if msg2_template and gs.get("message_frequency", "one_followup") != "one_touch":
        followup_at = (datetime.now() + timedelta(minutes=delay_minutes)).isoformat()
        if lead_id:
            conn.execute(
                "UPDATE leads SET followup_scheduled_at=?, followup_sent=0 WHERE id=?",
                (followup_at, lead_id),
            )


def check_stop_conditions(conn: sqlite3.Connection, lead_id: int, auto: dict) -> bool:
    lead = conn.execute("SELECT status FROM leads WHERE id=?", (lead_id,)).fetchone()
    if not lead:
        return True
    if auto.get("stop_on_booking") and lead["status"] == "booked":
        return True
    if auto.get("stop_on_reply") and lead["status"] == "contacted":
        return True
    return False


def process_pending_followups() -> None:
    now = datetime.now().isoformat()
    with get_db() as conn:
        pending = conn.execute(
            """
            SELECT l.id, l.phone, l.tenant_id, l.recovery_method, l.followup_scheduled_at,
                   t.twilio_phone, t.automations_json, t.global_settings_json,
                   t.booking_url, t.business_name, t.id as tid
            FROM leads l
            JOIN tenants t ON t.id = l.tenant_id
            WHERE l.followup_scheduled_at <= ? AND l.followup_sent = 0 AND l.status NOT IN ('booked','closed')
            """,
            (now,),
        ).fetchall()

        for row in pending:
            tenant = dict(row)
            auto_type = row["recovery_method"] or "new_lead"
            automations = get_tenant_automations(tenant)
            auto = automations.get(auto_type, {})

            if check_stop_conditions(conn, row["id"], auto):
                conn.execute("UPDATE leads SET followup_sent=1 WHERE id=?", (row["id"],))
                continue

            msg2 = format_message(auto.get("message_2", ""), tenant, {"name": None})
            if msg2 and row["twilio_phone"]:
                sid = send_sms(row["phone"], row["twilio_phone"], msg2)
                if sid:
                    conn.execute(
                        "UPDATE leads SET last_outbound_message_sid=?, last_message_at=CURRENT_TIMESTAMP, followup_sent=1 WHERE id=?",
                        (sid, row["id"]),
                    )
                    log_automation(conn, row["tid"], row["id"], auto_type, 2, msg2)
            else:
                conn.execute("UPDATE leads SET followup_sent=1 WHERE id=?", (row["id"],))


# ---------------------------------------------------------------------------
# Auth / CSRF
# ---------------------------------------------------------------------------

def create_auth_response(destination: str, user_id: int) -> RedirectResponse:
    response = RedirectResponse(destination, status_code=status.HTTP_303_SEE_OTHER)
    token = serializer.dumps({"user_id": user_id})
    response.set_cookie("auth_token", token, httponly=True, secure=settings.cookie_secure,
                        samesite="lax", max_age=AUTH_MAX_AGE_SECONDS)
    return response


def get_current_user_id(request: Request) -> int:
    token = request.cookies.get("auth_token")
    next_url = request.url.path
    if request.url.query:
        next_url += f"?{request.url.query}"
    if not token:
        raise HTTPException(status_code=302, headers={"Location": f"/login?next={next_url}"})
    try:
        data = serializer.loads(token, max_age=AUTH_MAX_AGE_SECONDS)
        return int(data["user_id"])
    except (BadSignature, SignatureExpired, KeyError, ValueError):
        raise HTTPException(status_code=302, headers={"Location": f"/login?next={next_url}&expired=1"})


def ensure_csrf_seed(request: Request) -> str:
    return request.cookies.get(CSRF_COOKIE_NAME) or secrets.token_urlsafe(24)


def build_csrf_token(seed: str, form_name: str) -> str:
    return serializer.dumps({"csrf_seed": seed, "form_name": form_name})


def render_template(request: Request, template_name: str, context: dict[str, Any], *,
                    status_code: int = 200, form_name: str | None = None) -> HTMLResponse:
    seed = ensure_csrf_seed(request)
    merged = {"request": request, **context}
    if form_name:
        merged["csrf_token"] = build_csrf_token(seed, form_name)
    response = templates.TemplateResponse(request, template_name, merged, status_code=status_code)
    if request.cookies.get(CSRF_COOKIE_NAME) != seed:
        response.set_cookie(CSRF_COOKIE_NAME, seed, httponly=False, secure=settings.cookie_secure,
                            samesite="lax", max_age=AUTH_MAX_AGE_SECONDS)
    return response


def validate_csrf(request: Request, csrf_token: str, form_name: str) -> None:
    seed = request.cookies.get(CSRF_COOKIE_NAME)
    if not seed or not csrf_token:
        raise HTTPException(status_code=403, detail="Invalid CSRF token")
    try:
        payload = serializer.loads(csrf_token, max_age=CSRF_MAX_AGE_SECONDS)
    except (BadSignature, SignatureExpired) as exc:
        raise HTTPException(status_code=403, detail="Invalid CSRF token") from exc
    if payload.get("csrf_seed") != seed or payload.get("form_name") != form_name:
        raise HTTPException(status_code=403, detail="Invalid CSRF token")


async def validate_twilio_request(request: Request, form: Any) -> None:
    if not is_real_secret(settings.twilio_auth_token):
        raise HTTPException(status_code=503, detail="Webhook verification is not configured.")
    signature = request.headers.get("X-Twilio-Signature", "")
    params = {key: str(value) for key, value in form.items()}
    validator = RequestValidator(settings.twilio_auth_token)
    if not validator.validate(str(request.url), params, signature):
        raise HTTPException(status_code=403, detail="Invalid Twilio signature")


def get_tenant_for_user(conn: sqlite3.Connection, user_id: int) -> sqlite3.Row | None:
    return conn.execute("SELECT * FROM tenants WHERE user_id=?", (user_id,)).fetchone()


def get_dashboard_stats(conn: sqlite3.Connection, tenant_id: int) -> dict[str, Any]:
    row = conn.execute(
        """
        SELECT COUNT(*) AS total_leads,
               COALESCE(SUM(CASE WHEN status='booked' THEN revenue ELSE 0 END),0) AS recovered_revenue,
               COALESCE(SUM(CASE WHEN status='booked' THEN 1 ELSE 0 END),0) AS booked_count,
               COALESCE(SUM(CASE WHEN status IN ('new','contacted') THEN 1 ELSE 0 END),0) AS active_followups
        FROM leads WHERE tenant_id=?
        """, (tenant_id,),
    ).fetchone()
    total = int(row["total_leads"] or 0)
    booked = int(row["booked_count"] or 0)
    recent = conn.execute(
        "SELECT phone,name,status,delivery_status,revenue,recovery_method,created_at,last_message_at FROM leads WHERE tenant_id=? ORDER BY datetime(created_at) DESC LIMIT 10",
        (tenant_id,),
    ).fetchall()
    return {
        "recovered_revenue": float(row["recovered_revenue"] or 0),
        "booked_count": booked,
        "active_followups": int(row["active_followups"] or 0),
        "recovery_rate": round((booked / total) * 100, 1) if total else 0.0,
        "recent_leads": [dict(r) for r in recent],
    }


def ensure_tenant(conn: sqlite3.Connection, user_id: int, business_name: str) -> int:
    cursor = conn.execute("INSERT INTO tenants (user_id, business_name) VALUES (?,?)", (user_id, business_name))
    return int(cursor.lastrowid)


# ---------------------------------------------------------------------------
# App + exception handlers
# ---------------------------------------------------------------------------

@asynccontextmanager
async def lifespan(app: FastAPI):
    ensure_runtime_security()
    init_db()
    TEMPLATE_DIR.mkdir(exist_ok=True)
    yield


app = FastAPI(title="Rebookd", lifespan=lifespan)
templates = Jinja2Templates(directory=str(TEMPLATE_DIR))


@app.exception_handler(404)
async def not_found_handler(request: Request, exc: Exception) -> HTMLResponse:
    return templates.TemplateResponse(request, "error.html",
        {"title": "Page not found", "message": "That page doesn't exist.", "code": 404}, status_code=404)


@app.exception_handler(RequestValidationError)
async def validation_error_handler(request: Request, exc: RequestValidationError) -> HTMLResponse:
    return templates.TemplateResponse(request, "error.html",
        {"title": "Bad request", "message": "Something was missing or formatted incorrectly.", "code": 400}, status_code=400)


@app.exception_handler(500)
async def server_error_handler(request: Request, exc: Exception) -> HTMLResponse:
    logger.exception("Unhandled error: %s", exc)
    return templates.TemplateResponse(request, "error.html",
        {"title": "Something went wrong", "message": "An unexpected error occurred. Please try again.", "code": 500}, status_code=500)


# ---------------------------------------------------------------------------
# Auth routes
# ---------------------------------------------------------------------------

@app.get("/", response_class=HTMLResponse)
def home(request: Request) -> RedirectResponse:
    if request.cookies.get("auth_token"):
        return RedirectResponse("/dashboard", status_code=302)
    return RedirectResponse("/signup", status_code=302)


@app.get("/signup", response_class=HTMLResponse)
def signup_page(request: Request) -> HTMLResponse:
    if request.cookies.get("auth_token"):
        return RedirectResponse("/dashboard", status_code=302)
    return render_template(request, "signup.html", {"errors": {}, "form": {}}, form_name="signup")


@app.post("/signup", response_class=HTMLResponse)
def create_account(
    request: Request,
    csrf_token: str = Form(...),
    email: str = Form(...),
    password: str = Form(...),
    confirm_password: str = Form(...),
    business_name: str = Form(...),
) -> Response:
    validate_csrf(request, csrf_token, "signup")
    normalized_email = email.strip().lower()
    cleaned_name = business_name.strip()
    errors: dict[str, str] = {}

    if not cleaned_name:
        errors["business_name"] = "Business name is required."
    if not normalized_email or not is_valid_email(normalized_email):
        errors["email"] = "Enter a valid email address."
    if len(password) < 8:
        errors["password"] = "Password must be at least 8 characters."
    elif password != confirm_password:
        errors["confirm_password"] = "Passwords don't match."

    if errors:
        return render_template(request, "signup.html",
            {"errors": errors, "form": {"email": normalized_email, "business_name": cleaned_name}},
            status_code=400, form_name="signup")

    hashed = bcrypt.hashpw(password.encode("utf-8")[:72], bcrypt.gensalt())
    stripe_customer_id = None
    if is_real_secret(settings.stripe_secret_key):
        try:
            customer = stripe.Customer.create(email=normalized_email)
            stripe_customer_id = customer.id
        except Exception as exc:
            logger.warning("Stripe customer creation failed: %s", exc)

    try:
        with get_db() as conn:
            cursor = conn.execute(
                "INSERT INTO users (email, hashed_pw, stripe_customer_id) VALUES (?,?,?)",
                (normalized_email, hashed, stripe_customer_id),
            )
            ensure_tenant(conn, int(cursor.lastrowid), cleaned_name)
        return create_auth_response("/config?welcome=1", int(cursor.lastrowid))
    except sqlite3.IntegrityError:
        return render_template(request, "signup.html",
            {"errors": {"email": "An account with that email already exists."},
             "form": {"email": normalized_email, "business_name": cleaned_name}},
            status_code=400, form_name="signup")


@app.get("/login", response_class=HTMLResponse)
def login_page(request: Request) -> HTMLResponse:
    if request.cookies.get("auth_token"):
        return RedirectResponse("/dashboard", status_code=302)
    expired = request.query_params.get("expired") == "1"
    return render_template(request, "login.html",
        {"errors": {}, "form": {}, "next": request.query_params.get("next", "/dashboard"), "expired": expired},
        form_name="login")


@app.post("/login", response_class=HTMLResponse)
def login(
    request: Request,
    csrf_token: str = Form(...),
    email: str = Form(...),
    password: str = Form(...),
    next_url: str = Form("/dashboard"),
) -> Response:
    validate_csrf(request, csrf_token, "login")
    normalized_email = email.strip().lower()
    errors: dict[str, str] = {}

    if not normalized_email:
        errors["email"] = "Email is required."
    if not password:
        errors["password"] = "Password is required."

    if errors:
        return render_template(request, "login.html",
            {"errors": errors, "form": {"email": normalized_email}, "next": next_url, "expired": False},
            status_code=400, form_name="login")

    with get_db() as conn:
        user = conn.execute("SELECT id, hashed_pw FROM users WHERE email=?", (normalized_email,)).fetchone()

    if not user or not bcrypt.checkpw(password.encode("utf-8")[:72], user["hashed_pw"]):
        return render_template(request, "login.html",
            {"errors": {"general": "Email or password is incorrect."},
             "form": {"email": normalized_email}, "next": next_url, "expired": False},
            status_code=400, form_name="login")

    safe_next = next_url if next_url.startswith("/") else "/dashboard"
    return create_auth_response(safe_next, int(user["id"]))


@app.get("/logout")
def logout() -> RedirectResponse:
    response = RedirectResponse("/login", status_code=302)
    response.delete_cookie("auth_token")
    return response


# ---------------------------------------------------------------------------
# Dashboard
# ---------------------------------------------------------------------------

@app.get("/dashboard", response_class=HTMLResponse)
def dashboard(request: Request, user_id: int = Depends(get_current_user_id)) -> HTMLResponse:
    with get_db() as conn:
        tenant_row = get_tenant_for_user(conn, user_id)
        if not tenant_row:
            raise HTTPException(status_code=404, detail="Tenant not found")
        tenant = dict(tenant_row)
        stats = get_dashboard_stats(conn, tenant["id"])
        services = json.loads(tenant["services_json"] or "[]")
        automations = get_tenant_automations(tenant)
        enabled_count = sum(1 for a in automations.values() if a.get("enabled"))

    setup_items = [
        {"label": "Business profile", "complete": bool(tenant["business_name"]), "hint": "Name and account ready."},
        {"label": "Twilio number", "complete": bool(tenant["twilio_phone"]),
         "hint": tenant["twilio_phone"] or "Add your Twilio number in setup."},
        {"label": "Booking URL", "complete": bool(tenant["booking_url"]),
         "hint": tenant["booking_url"] or "Add your booking link (Calendly, Jane, etc.)."},
        {"label": "Service catalog", "complete": len(services) > 0,
         "hint": f"{len(services)} service(s) configured." if services else "Add services and pricing."},
        {"label": "Automations", "complete": enabled_count > 0,
         "hint": f"{enabled_count} automation(s) active." if enabled_count else "Enable automations to start recovering revenue."},
        {"label": "Recovery incentive", "complete": bool(tenant["incentive"]),
         "hint": tenant["incentive"] or "Optional — add an offer to improve reply rates."},
    ]

    return render_template(request, "dashboard.html", {
        "business_name": tenant["business_name"],
        "tenant": tenant,
        "services": services,
        "stats": stats,
        "setup_items": setup_items,
        "setup_ready": bool(tenant["twilio_phone"]) and len(services) > 0,
        "setup_saved": request.query_params.get("setup") == "saved",
        "enabled_automations": enabled_count,
    })


# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------

@app.get("/config", response_class=HTMLResponse)
def config_page(request: Request, user_id: int = Depends(get_current_user_id)) -> HTMLResponse:
    with get_db() as conn:
        tenant_row = get_tenant_for_user(conn, user_id)
        if not tenant_row:
            raise HTTPException(status_code=404, detail="Tenant not found")
        tenant = dict(tenant_row)

    return render_template(request, "config.html", {
        "errors": {},
        "saved": request.query_params.get("saved") == "1",
        "welcome": request.query_params.get("welcome") == "1",
        "form": {
            "twilio_phone": tenant["twilio_phone"] or "",
            "booking_url": tenant["booking_url"] or "",
            "services": services_to_text(tenant["services_json"]),
            "incentive": tenant["incentive"] or "",
        },
    }, form_name="config")


@app.post("/config", response_class=HTMLResponse)
def save_config(
    request: Request,
    user_id: int = Depends(get_current_user_id),
    csrf_token: str = Form(...),
    twilio_phone: str = Form(...),
    booking_url: str = Form(""),
    services: str = Form(""),
    incentive: str = Form(""),
) -> Response:
    validate_csrf(request, csrf_token, "config")
    cleaned_phone = twilio_phone.strip()
    cleaned_url = booking_url.strip() or None
    cleaned_services = services.strip()
    cleaned_incentive = incentive.strip()
    errors: dict[str, str] = {}

    if not cleaned_phone.startswith("+"):
        errors["twilio_phone"] = "Phone must be in E.164 format, e.g. +15551234567."

    services_payload: list[dict] = []
    if cleaned_services:
        try:
            services_payload = parse_services(cleaned_services)
        except ValueError as exc:
            errors["services"] = str(exc)

    if errors:
        return render_template(request, "config.html", {
            "errors": errors, "saved": False, "welcome": False,
            "form": {"twilio_phone": cleaned_phone, "booking_url": cleaned_url or "",
                     "services": cleaned_services, "incentive": cleaned_incentive},
        }, status_code=400, form_name="config")

    try:
        with get_db() as conn:
            conn.execute(
                "UPDATE tenants SET twilio_phone=?,booking_url=?,services_json=?,incentive=?,updated_at=CURRENT_TIMESTAMP WHERE user_id=?",
                (cleaned_phone, cleaned_url, json.dumps(services_payload), cleaned_incentive or None, user_id),
            )
        return RedirectResponse("/dashboard?setup=saved", status_code=303)
    except sqlite3.IntegrityError:
        return render_template(request, "config.html", {
            "errors": {"twilio_phone": "That Twilio number is already assigned to another account."},
            "saved": False, "welcome": False,
            "form": {"twilio_phone": cleaned_phone, "booking_url": cleaned_url or "",
                     "services": cleaned_services, "incentive": cleaned_incentive},
        }, status_code=400, form_name="config")


# ---------------------------------------------------------------------------
# Automations
# ---------------------------------------------------------------------------

@app.get("/automations", response_class=HTMLResponse)
def automations_page(request: Request, user_id: int = Depends(get_current_user_id)) -> HTMLResponse:
    with get_db() as conn:
        tenant_row = get_tenant_for_user(conn, user_id)
        if not tenant_row:
            raise HTTPException(status_code=404, detail="Tenant not found")
        tenant = dict(tenant_row)

    automations = get_tenant_automations(tenant)
    gs = get_global_settings(tenant)
    saved = request.query_params.get("saved") == "1"

    return render_template(request, "automations.html", {
        "automations": automations,
        "global_settings": gs,
        "saved": saved,
        "business_name": tenant["business_name"],
    }, form_name="automations")


@app.post("/automations", response_class=HTMLResponse)
async def save_automations(
    request: Request,
    user_id: int = Depends(get_current_user_id),
) -> Response:
    form = await request.form()
    validate_csrf(request, form.get("csrf_token", ""), "automations")

    with get_db() as conn:
        tenant_row = get_tenant_for_user(conn, user_id)
        if not tenant_row:
            raise HTTPException(status_code=404, detail="Tenant not found")
        tenant = dict(tenant_row)

    current = get_tenant_automations(tenant)

    for key in DEFAULT_AUTOMATIONS:
        current[key]["enabled"] = form.get(f"{key}_enabled") == "on"
        for field in ["message_1", "message_2"]:
            val = form.get(f"{key}_{field}", "").strip()
            if val:
                current[key][field] = val
        delay_raw = form.get(f"{key}_delay_minutes", "")
        if delay_raw:
            try:
                current[key]["delay_minutes"] = int(delay_raw)
            except ValueError:
                pass
        for flag in ["stop_on_reply", "stop_on_booking", "voicemail_branch"]:
            if flag in current[key]:
                current[key][flag] = form.get(f"{key}_{flag}") == "on"
        if key == "reactivation":
            try:
                current[key]["inactivity_days"] = int(form.get(f"{key}_inactivity_days", 60))
            except ValueError:
                pass
        if key == "review":
            current[key]["review_url"] = form.get("review_review_url", "").strip()

    with get_db() as conn:
        conn.execute(
            "UPDATE tenants SET automations_json=?, updated_at=CURRENT_TIMESTAMP WHERE user_id=?",
            (json.dumps(current), user_id),
        )

    return RedirectResponse("/automations?saved=1", status_code=303)


# ---------------------------------------------------------------------------
# Global settings
# ---------------------------------------------------------------------------

@app.get("/settings", response_class=HTMLResponse)
def settings_page(request: Request, user_id: int = Depends(get_current_user_id)) -> HTMLResponse:
    with get_db() as conn:
        tenant_row = get_tenant_for_user(conn, user_id)
        if not tenant_row:
            raise HTTPException(status_code=404, detail="Tenant not found")
        tenant = dict(tenant_row)

    gs = get_global_settings(tenant)
    saved = request.query_params.get("saved") == "1"
    return render_template(request, "settings.html", {
        "gs": gs,
        "saved": saved,
        "business_name": tenant["business_name"],
        "days": ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"],
    }, form_name="settings")


@app.post("/settings", response_class=HTMLResponse)
async def save_settings(
    request: Request,
    user_id: int = Depends(get_current_user_id),
) -> Response:
    form = await request.form()
    validate_csrf(request, form.get("csrf_token", ""), "settings")

    with get_db() as conn:
        tenant_row = get_tenant_for_user(conn, user_id)
        if not tenant_row:
            raise HTTPException(status_code=404, detail="Tenant not found")
        tenant = dict(tenant_row)

    gs = get_global_settings(tenant)

    gs["tone"] = form.get("tone", "friendly")
    gs["ai_behavior"] = form.get("ai_behavior", "flexible")
    gs["message_frequency"] = form.get("message_frequency", "one_followup")
    gs["after_hours_behavior"] = form.get("after_hours_behavior", "delay")
    gs["smart_hours"] = form.get("smart_hours") == "on"
    gs["booking_link_style"] = form.get("booking_link_style", "standard")

    for flag in ["notify_new_lead", "notify_reply", "notify_booking",
                 "notify_missed_call", "notify_no_show",
                 "auto_tag_new_leads", "auto_tag_missed_calls",
                 "auto_tag_no_shows", "auto_tag_cancellations"]:
        gs[flag] = form.get(flag) == "on"

    for delay_key in ["default_message2_delay", "default_reactivation_delay", "default_review_delay"]:
        try:
            gs[delay_key] = int(form.get(delay_key, gs[delay_key]))
        except (ValueError, TypeError):
            pass

    days = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]
    for day in days:
        gs["business_hours"][day] = {
            "open": form.get(f"hours_{day}_open", "09:00"),
            "close": form.get(f"hours_{day}_close", "17:00"),
            "enabled": form.get(f"hours_{day}_enabled") == "on",
        }

    with get_db() as conn:
        conn.execute(
            "UPDATE tenants SET global_settings_json=?, updated_at=CURRENT_TIMESTAMP WHERE user_id=?",
            (json.dumps(gs), user_id),
        )

    return RedirectResponse("/settings?saved=1", status_code=303)


# ---------------------------------------------------------------------------
# Metrics
# ---------------------------------------------------------------------------

@app.get("/metrics", response_class=HTMLResponse)
def metrics(request: Request, user_id: int = Depends(get_current_user_id)) -> HTMLResponse:
    with get_db() as conn:
        tenant_row = get_tenant_for_user(conn, user_id)
        if not tenant_row:
            raise HTTPException(status_code=404, detail="Tenant not found")
        tenant = dict(tenant_row)

        rows = conn.execute(
            """
            SELECT COALESCE(recovery_method,'Unattributed') AS recovery_method,
                   COUNT(*) AS bookings,
                   COALESCE(SUM(revenue),0) AS revenue
            FROM leads WHERE tenant_id=? AND status='booked'
            GROUP BY COALESCE(recovery_method,'Unattributed')
            ORDER BY revenue DESC
            """, (tenant["id"],),
        ).fetchall()

        log_rows = conn.execute(
            """
            SELECT automation_type, message_index, COUNT(*) as count
            FROM automation_log WHERE tenant_id=?
            GROUP BY automation_type, message_index
            ORDER BY automation_type, message_index
            """, (tenant["id"],),
        ).fetchall()

    total_revenue = sum(float(r["revenue"] or 0) for r in rows)
    metrics_rows = [
        {"method": r["recovery_method"], "bookings": int(r["bookings"] or 0),
         "revenue": float(r["revenue"] or 0),
         "share": round((float(r["revenue"] or 0) / total_revenue) * 100, 1) if total_revenue else 0}
        for r in rows
    ]

    return render_template(request, "metrics.html", {
        "business_name": tenant["business_name"],
        "total_revenue": total_revenue,
        "rows": metrics_rows,
        "log_rows": [dict(r) for r in log_rows],
    })


# ---------------------------------------------------------------------------
# Health
# ---------------------------------------------------------------------------

@app.get("/health")
def health() -> dict[str, Any]:
    with get_db() as conn:
        conn.execute("SELECT 1").fetchone()
    return {
        "status": "ok",
        "database": str(DATABASE_PATH),
        "twilio_configured": bool(settings.twilio_account_sid and is_real_secret(settings.twilio_auth_token)),
        "stripe_configured": is_real_secret(settings.stripe_secret_key),
    }


# ---------------------------------------------------------------------------
# Twilio webhooks
# ---------------------------------------------------------------------------

@app.post("/status")
async def status_webhook(request: Request) -> dict[str, str]:
    form = await request.form()
    await validate_twilio_request(request, form)
    message_sid = form.get("MessageSid")
    message_status = form.get("MessageStatus", "unknown")
    to_number = form.get("To", "").strip()
    if not message_sid:
        return {"status": "ignored"}
    with get_db() as conn:
        tenant = conn.execute("SELECT id FROM tenants WHERE twilio_phone=?", (to_number,)).fetchone()
        if tenant:
            conn.execute(
                "UPDATE leads SET delivery_status=?,delivery_status_updated_at=CURRENT_TIMESTAMP,last_message_at=CURRENT_TIMESTAMP WHERE tenant_id=? AND (last_outbound_message_sid=? OR external_id=?)",
                (message_status, tenant["id"], message_sid, message_sid),
            )
            conn.commit()
    return {"status": "ok"}


@app.post("/sms")
async def sms_webhook(request: Request) -> dict[str, str]:
    form = await request.form()
    await validate_twilio_request(request, form)
    from_number = form.get("From", "").strip()
    to_number = form.get("To", "").strip()
    message_sid = form.get("MessageSid", secrets.token_hex(8))
    body = form.get("Body", "").strip()

    if not from_number or not to_number:
        return {"status": "ignored"}

    with get_db() as conn:
        tenant_row = conn.execute("SELECT * FROM tenants WHERE twilio_phone=?", (to_number,)).fetchone()
        if not tenant_row:
            return {"status": "tenant_not_found"}
        tenant = dict(tenant_row)
        automations = get_tenant_automations(tenant)
        gs = get_global_settings(tenant)

        existing = conn.execute(
            "SELECT id,status,details FROM leads WHERE tenant_id=? AND phone=? ORDER BY datetime(created_at) DESC LIMIT 1",
            (tenant["id"], from_number),
        ).fetchone()

        details_payload: dict[str, Any] = {}
        if existing and existing["details"]:
            try:
                details_payload = json.loads(existing["details"])
            except json.JSONDecodeError:
                pass
        details_payload["last_inbound_sms"] = body

        tags = ["replied"]
        if gs.get("auto_tag_new_leads") and not existing:
            tags.append("new_lead")

        if existing:
            conn.execute(
                "UPDATE leads SET details=?,external_id=?,last_message_at=CURRENT_TIMESTAMP,delivery_status=NULL,delivery_status_updated_at=NULL,status=CASE WHEN status='booked' THEN status ELSE 'contacted' END,followup_sent=1 WHERE id=?",
                (json.dumps(details_payload), message_sid, existing["id"]),
            )
            conn.commit()
            lead_id = existing["id"]
        else:
            cursor = conn.execute(
                "INSERT INTO leads (tenant_id,phone,status,details,recovery_method,external_id,last_message_at,tags) VALUES (?,?,'contacted',?,'sms',?,CURRENT_TIMESTAMP,?)",
                (tenant["id"], from_number, json.dumps(details_payload), message_sid, json.dumps(tags)),
            )
            lead_id = cursor.lastrowid
            auto = automations.get("new_lead", {})
            if auto.get("enabled"):
                run_automation(conn, "new_lead", tenant, lead_id, from_number, to_number)

    return {"status": "ok"}


@app.post("/voice")
async def voice_webhook(request: Request) -> Response:
    form = await request.form()
    await validate_twilio_request(request, form)
    to_number = form.get("To", "").strip()
    from_number = form.get("From", "").strip()

    with get_db() as conn:
        tenant_row = conn.execute("SELECT * FROM tenants WHERE twilio_phone=?", (to_number,)).fetchone()
        if not tenant_row:
            return Response(content="<?xml version='1.0'?><Response><Say>Sorry, this number is not configured.</Say></Response>", media_type="application/xml")
        tenant = dict(tenant_row)
        gs = get_global_settings(tenant)
        automations = get_tenant_automations(tenant)

        recording_callback = f"{settings.base_url}/voice/recording" if settings.base_url else "/voice/recording"
        biz = tenant["business_name"]

        twiml = f"""<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="alice">Hi, you've reached {biz}. We're unavailable right now. Please leave a message after the tone and we'll get back to you shortly. You can also book online — we'll send you a link by text right away.</Say>
  <Record maxLength="60" action="{recording_callback}" transcribe="false" />
</Response>"""

        if from_number:
            cursor = conn.execute(
                "INSERT INTO leads (tenant_id,phone,status,recovery_method,last_message_at,tags) VALUES (?,?,'new','missed_call',CURRENT_TIMESTAMP,?)",
                (tenant["id"], from_number, json.dumps(["missed_call"] if gs.get("auto_tag_missed_calls") else [])),
            )
            lead_id = cursor.lastrowid

            auto = automations.get("missed_call", {})
            if auto.get("enabled"):
                run_automation(conn, "missed_call", tenant, lead_id, from_number, to_number)

    return Response(content=twiml, media_type="application/xml")


@app.post("/voice/recording")
async def voice_recording(request: Request) -> Response:
    form = await request.form()
    await validate_twilio_request(request, form)
    from_number = form.get("From", "").strip()
    to_number = form.get("To", "").strip()
    recording_url = form.get("RecordingUrl", "")
    recording_sid = form.get("RecordingSid", "")

    if from_number and to_number:
        with get_db() as conn:
            tenant_row = conn.execute("SELECT id FROM tenants WHERE twilio_phone=?", (to_number,)).fetchone()
            if tenant_row:
                details = json.dumps({"recording_url": recording_url, "recording_sid": recording_sid})
                conn.execute(
                    "UPDATE leads SET details=?,delivery_status='voicemail_received',delivery_status_updated_at=CURRENT_TIMESTAMP WHERE tenant_id=? AND phone=? AND recovery_method='missed_call'",
                    (details, tenant_row["id"], from_number),
                )

    return Response(content="<?xml version='1.0'?><Response/>", media_type="application/xml")


# ---------------------------------------------------------------------------
# Follow-up processor (called by a cron or polling endpoint)
# ---------------------------------------------------------------------------

@app.post("/internal/process-followups")
async def process_followups_endpoint(request: Request) -> dict[str, str]:
    token = request.headers.get("X-Internal-Token", "")
    if token != settings.secret_key:
        raise HTTPException(status_code=403, detail="Forbidden")
    process_pending_followups()
    return {"status": "ok"}


if __name__ == "__main__":
    uvicorn.run("main:app", host=settings.host, port=settings.port, reload=True)
