from __future__ import annotations

import json
import logging
import os
import secrets
import sqlite3
from contextlib import asynccontextmanager
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import bcrypt
import stripe
import uvicorn
from dotenv import load_dotenv
from fastapi import Depends, FastAPI, Form, HTTPException, Request, status
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


def get_db() -> sqlite3.Connection:
    connection = sqlite3.connect(DATABASE_PATH)
    connection.row_factory = sqlite3.Row
    connection.execute("PRAGMA foreign_keys = ON")
    return connection


def ensure_column(connection: sqlite3.Connection, table_name: str, column_name: str, definition: str) -> None:
    columns = {
        row["name"] for row in connection.execute(f"PRAGMA table_info({table_name})").fetchall()
    }
    if column_name not in columns:
        connection.execute(f"ALTER TABLE {table_name} ADD COLUMN {column_name} {definition}")


def init_db() -> None:
    with get_db() as connection:
        connection.executescript(
            """
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
                services_json TEXT NOT NULL DEFAULT '[]',
                incentive TEXT,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT,
                FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS leads (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                tenant_id INTEGER NOT NULL,
                phone TEXT NOT NULL,
                status TEXT NOT NULL DEFAULT 'new',
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
                FOREIGN KEY(tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
            );

            CREATE INDEX IF NOT EXISTS idx_tenants_user_id ON tenants(user_id);
            CREATE INDEX IF NOT EXISTS idx_tenants_twilio_phone ON tenants(twilio_phone);
            """
        )

        # Safe column additions (no dynamic defaults)
        ensure_column(connection, "leads", "external_id", "TEXT")
        ensure_column(connection, "leads", "last_message_at", "TEXT")
        ensure_column(connection, "leads", "delivery_status", "TEXT")
        ensure_column(connection, "leads", "delivery_status_updated_at", "TEXT")
        ensure_column(connection, "leads", "last_outbound_message_sid", "TEXT")
        ensure_column(connection, "tenants", "updated_at", "TEXT")

        # Backfill updated_at for existing rows
        connection.execute(
            "UPDATE tenants SET updated_at = CURRENT_TIMESTAMP WHERE updated_at IS NULL"
        )

        connection.executescript(
            """
            CREATE INDEX IF NOT EXISTS idx_leads_tenant_id ON leads(tenant_id);
            CREATE INDEX IF NOT EXISTS idx_leads_external_id ON leads(external_id);
            CREATE INDEX IF NOT EXISTS idx_leads_last_outbound_message_sid ON leads(last_outbound_message_sid);
            """
        )


def is_real_secret(value: str) -> bool:
    lowered = value.lower()
    placeholder_tokens = {"your_", "xxxxxxxx", "change-this", "change-me", "example", "replace-with"}
    return bool(value) and not any(token in lowered for token in placeholder_tokens)


def ensure_runtime_security() -> None:
    if settings.production_mode and not is_real_secret(settings.secret_key):
        raise RuntimeError("SECRET_KEY must be set to a non-placeholder value in production or staging.")


@asynccontextmanager
async def lifespan(app: FastAPI):
    ensure_runtime_security()
    init_db()
    TEMPLATE_DIR.mkdir(exist_ok=True)
    yield


app = FastAPI(title="Rebookd - Revenue Recovery SaaS", lifespan=lifespan)
templates = Jinja2Templates(directory=str(TEMPLATE_DIR))

# --- rest of your file stays EXACTLY the same ---

def parse_services(services_text: str) -> list[dict[str, Any]]:
    services: list[dict[str, Any]] = []
    for raw_item in services_text.split(","):
        item = raw_item.strip()
        if not item:
            continue
        parts = [part.strip() for part in item.split(":")]
        if len(parts) != 3:
            raise ValueError(
                "Each service must look like Name:minutes:price. Example: Haircut:45:65"
            )
        name, minutes_text, price_text = parts
        try:
            minutes = int(minutes_text)
            price = float(price_text)
        except ValueError as exc:
            raise ValueError("Service minutes must be an integer and price must be a number.") from exc
        services.append({"name": name, "minutes": minutes, "price": price})
    return services


def services_to_text(services_json: str | None) -> str:
    if not services_json:
        return ""
    try:
        services = json.loads(services_json)
    except json.JSONDecodeError:
        return ""
    formatted = []
    for service in services:
        formatted.append(
            f"{service.get('name', '').strip()}:{service.get('minutes', 0)}:{service.get('price', 0)}"
        )
    return ", ".join(item for item in formatted if item.strip(":"))


def create_auth_response(destination: str, user_id: int) -> RedirectResponse:
    response = RedirectResponse(destination, status_code=status.HTTP_303_SEE_OTHER)
    token = serializer.dumps({"user_id": user_id})
    response.set_cookie(
        "auth_token",
        token,
        httponly=True,
        secure=settings.cookie_secure,
        samesite="lax",
        max_age=AUTH_MAX_AGE_SECONDS,
    )
    return response


def get_current_user_id(request: Request) -> int:
    token = request.cookies.get("auth_token")
    if not token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")
    try:
        data = serializer.loads(token, max_age=AUTH_MAX_AGE_SECONDS)
        return int(data["user_id"])
    except (BadSignature, SignatureExpired, KeyError, ValueError) as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid authentication token"
        ) from exc


def get_tenant_for_user(connection: sqlite3.Connection, user_id: int) -> sqlite3.Row | None:
    return connection.execute(
        "SELECT * FROM tenants WHERE user_id = ?",
        (user_id,),
    ).fetchone()


def is_real_secret(value: str) -> bool:
    lowered = value.lower()
    placeholder_tokens = {"your_", "xxxxxxxx", "change-this", "change-me", "example", "replace-with"}
    return bool(value) and not any(token in lowered for token in placeholder_tokens)


def ensure_runtime_security() -> None:
    if settings.production_mode and not is_real_secret(settings.secret_key):
        raise RuntimeError("SECRET_KEY must be set to a non-placeholder value in production or staging.")


def ensure_csrf_seed(request: Request) -> str:
    return request.cookies.get(CSRF_COOKIE_NAME) or secrets.token_urlsafe(24)


def build_csrf_token(seed: str, form_name: str) -> str:
    return serializer.dumps({"csrf_seed": seed, "form_name": form_name})


def render_template(
    request: Request,
    template_name: str,
    context: dict[str, Any],
    *,
    status_code: int = status.HTTP_200_OK,
    form_name: str | None = None,
) -> HTMLResponse:
    seed = ensure_csrf_seed(request)
    merged_context = {"request": request, **context}
    if form_name:
        merged_context["csrf_token"] = build_csrf_token(seed, form_name)
    response = templates.TemplateResponse(request, template_name, merged_context, status_code=status_code)
    if request.cookies.get(CSRF_COOKIE_NAME) != seed:
        response.set_cookie(
            CSRF_COOKIE_NAME,
            seed,
            httponly=False,
            secure=settings.cookie_secure,
            samesite="lax",
            max_age=AUTH_MAX_AGE_SECONDS,
        )
    return response


def validate_csrf(request: Request, csrf_token: str, form_name: str) -> None:
    seed = request.cookies.get(CSRF_COOKIE_NAME)
    if not seed or not csrf_token:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Invalid CSRF token")
    try:
        payload = serializer.loads(csrf_token, max_age=CSRF_MAX_AGE_SECONDS)
    except (BadSignature, SignatureExpired) as exc:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Invalid CSRF token") from exc

    if payload.get("csrf_seed") != seed or payload.get("form_name") != form_name:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Invalid CSRF token")


async def validate_twilio_request(request: Request, form: Any) -> None:
    if not is_real_secret(settings.twilio_auth_token):
        logger.warning("Rejected webhook request because TWILIO_AUTH_TOKEN is not configured safely.")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Webhook verification is not configured.",
        )

    signature = request.headers.get("X-Twilio-Signature", "")
    params = {key: str(value) for key, value in form.items()}
    validator = RequestValidator(settings.twilio_auth_token)
    if not validator.validate(str(request.url), params, signature):
        logger.warning("Rejected webhook request with invalid Twilio signature for %s", request.url.path)
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Invalid Twilio signature")


def get_dashboard_stats(connection: sqlite3.Connection, tenant_id: int) -> dict[str, Any]:
    lead_stats = connection.execute(
        """
        SELECT
            COUNT(*) AS total_leads,
            COALESCE(SUM(CASE WHEN status = 'booked' THEN revenue ELSE 0 END), 0) AS recovered_revenue,
            COALESCE(SUM(CASE WHEN status = 'booked' THEN 1 ELSE 0 END), 0) AS booked_count,
            COALESCE(SUM(CASE WHEN status IN ('new', 'contacted') THEN 1 ELSE 0 END), 0) AS active_followups
        FROM leads
        WHERE tenant_id = ?
        """,
        (tenant_id,),
    ).fetchone()

    total_leads = int(lead_stats["total_leads"] or 0)
    booked_count = int(lead_stats["booked_count"] or 0)
    recovery_rate = round((booked_count / total_leads) * 100, 1) if total_leads else 0.0

    recent_leads_rows = connection.execute(
        """
        SELECT phone, status, delivery_status, revenue, recovery_method, created_at, last_message_at
        FROM leads
        WHERE tenant_id = ?
        ORDER BY datetime(created_at) DESC
        LIMIT 5
        """,
        (tenant_id,),
    ).fetchall()
    recent_leads = [dict(row) for row in recent_leads_rows]

    return {
        "recovered_revenue": float(lead_stats["recovered_revenue"] or 0),
        "booked_count": booked_count,
        "active_followups": int(lead_stats["active_followups"] or 0),
        "recovery_rate": recovery_rate,
        "recent_leads": recent_leads,
    }


def ensure_tenant(connection: sqlite3.Connection, user_id: int, business_name: str) -> int:
    cursor = connection.execute(
        "INSERT INTO tenants (user_id, business_name) VALUES (?, ?)",
        (user_id, business_name),
    )
    return int(cursor.lastrowid)


@app.on_event("startup")
def startup() -> None:
    ensure_runtime_security()
    init_db()
    TEMPLATE_DIR.mkdir(exist_ok=True)


@app.get("/", response_class=HTMLResponse)
def home(request: Request) -> RedirectResponse:
    if request.cookies.get("auth_token"):
        return RedirectResponse("/dashboard", status_code=status.HTTP_302_FOUND)
    return RedirectResponse("/signup", status_code=status.HTTP_302_FOUND)


@app.get("/signup", response_class=HTMLResponse)
def signup_page(request: Request) -> HTMLResponse:
    return render_template(
        request,
        "signup.html",
        {"error": None, "form": {}},
        form_name="signup",
    )


@app.post("/signup", response_class=HTMLResponse)
def create_account(
    request: Request,
    csrf_token: str = Form(...),
    email: str = Form(...),
    password: str = Form(...),
    business_name: str = Form(...),
) -> Response:
    validate_csrf(request, csrf_token, "signup")

    normalized_email = email.strip().lower()
    cleaned_business_name = business_name.strip()
    if len(password) < 8:
        return render_template(
            request,
            "signup.html",
            {
                "error": "Use a password with at least 8 characters.",
                "form": {"email": normalized_email, "business_name": cleaned_business_name},
            },
            status_code=status.HTTP_400_BAD_REQUEST,
            form_name="signup",
        )

    if not cleaned_business_name:
        return render_template(
            request,
            "signup.html",
            {
                "error": "Add a business name so the tenant can be created correctly.",
                "form": {"email": normalized_email, "business_name": cleaned_business_name},
            },
            status_code=status.HTTP_400_BAD_REQUEST,
            form_name="signup",
        )

    hashed = bcrypt.hashpw(password.encode("utf-8")[:72], bcrypt.gensalt())
    stripe_customer_id = None
    if is_real_secret(settings.stripe_secret_key):
        try:
            customer = stripe.Customer.create(email=normalized_email)
            stripe_customer_id = customer.id
        except Exception as exc:  # pragma: no cover - external service variability
            logger.warning("Stripe customer creation failed during signup: %s", exc)

    try:
        with get_db() as connection:
            cursor = connection.execute(
                """
                INSERT INTO users (email, hashed_pw, stripe_customer_id)
                VALUES (?, ?, ?)
                """,
                (normalized_email, hashed, stripe_customer_id),
            )
            user_id = int(cursor.lastrowid)
            ensure_tenant(connection, user_id, cleaned_business_name)
        return create_auth_response("/dashboard", user_id)
    except sqlite3.IntegrityError:
        return render_template(
            request,
            "signup.html",
            {
                "error": "That email is already in use.",
                "form": {"email": normalized_email, "business_name": cleaned_business_name},
            },
            status_code=status.HTTP_400_BAD_REQUEST,
            form_name="signup",
        )


@app.get("/login", response_class=HTMLResponse)
def login_page(request: Request) -> HTMLResponse:
    return render_template(
        request,
        "login.html",
        {"error": None, "form": {}},
        form_name="login",
    )


@app.post("/login", response_class=HTMLResponse)
def login(
    request: Request,
    csrf_token: str = Form(...),
    email: str = Form(...),
    password: str = Form(...),
) -> Response:
    validate_csrf(request, csrf_token, "login")

    normalized_email = email.strip().lower()
    with get_db() as connection:
        user = connection.execute(
            "SELECT id, hashed_pw FROM users WHERE email = ?",
            (normalized_email,),
        ).fetchone()

    if not user or not bcrypt.checkpw(password.encode("utf-8")[:72], user["hashed_pw"]):
        return render_template(
            request,
            "login.html",
            {
                "error": "Invalid email or password.",
                "form": {"email": normalized_email},
            },
            status_code=status.HTTP_400_BAD_REQUEST,
            form_name="login",
        )

    return create_auth_response("/dashboard", int(user["id"]))


@app.get("/logout")
def logout() -> RedirectResponse:
    response = RedirectResponse("/login", status_code=status.HTTP_302_FOUND)
    response.delete_cookie("auth_token")
    return response


@app.get("/dashboard", response_class=HTMLResponse)
def dashboard(request: Request, user_id: int = Depends(get_current_user_id)) -> HTMLResponse:
    with get_db() as connection:
        tenant_row = get_tenant_for_user(connection, user_id)
        if tenant_row is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tenant not found")

        tenant = dict(tenant_row)
        stats = get_dashboard_stats(connection, int(tenant["id"]))
        services = json.loads(tenant["services_json"] or "[]")
        setup_ready = bool(tenant["twilio_phone"]) and len(services) > 0
        setup_items = [
            {
                "label": "Business profile",
                "complete": bool(tenant["business_name"]),
                "hint": "Name and account are ready.",
            },
            {
                "label": "Twilio forwarding number",
                "complete": bool(tenant["twilio_phone"]),
                "hint": tenant["twilio_phone"] or "Add the number your missed calls should route through.",
            },
            {
                "label": "Service catalog",
                "complete": len(services) > 0,
                "hint": f"{len(services)} service(s) configured." if services else "Add services and pricing.",
            },
            {
                "label": "Recovery incentive",
                "complete": bool(tenant["incentive"]),
                "hint": tenant["incentive"] or "Optional, but useful for improving reply rates.",
            },
        ]

    context = {
        "business_name": tenant["business_name"],
        "tenant": tenant,
        "services": services,
        "stats": stats,
        "setup_items": setup_items,
        "setup_ready": setup_ready,
        "setup_saved": request.query_params.get("setup") == "saved",
    }
    return render_template(request, "dashboard.html", context)


@app.get("/config", response_class=HTMLResponse)
def config_page(request: Request, user_id: int = Depends(get_current_user_id)) -> HTMLResponse:
    with get_db() as connection:
        tenant_row = get_tenant_for_user(connection, user_id)
        if tenant_row is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tenant not found")
        tenant = dict(tenant_row)

    form = {
        "twilio_phone": tenant["twilio_phone"] or "",
        "services": services_to_text(tenant["services_json"]),
        "incentive": tenant["incentive"] or "",
    }
    return render_template(
        request,
        "config.html",
        {
            "error": None,
            "saved": request.query_params.get("saved") == "1",
            "welcome": request.query_params.get("welcome") == "1",
            "form": form,
        },
        form_name="config",
    )


@app.post("/config", response_class=HTMLResponse)
def save_config(
    request: Request,
    user_id: int = Depends(get_current_user_id),
    csrf_token: str = Form(...),
    twilio_phone: str = Form(...),
    services: str = Form(""),
    incentive: str = Form(""),
) -> Response:
    validate_csrf(request, csrf_token, "config")

    cleaned_phone = twilio_phone.strip()
    cleaned_services = services.strip()
    cleaned_incentive = incentive.strip()

    if not cleaned_phone.startswith("+"):
        return render_template(
            request,
            "config.html",
            {
                "error": "Twilio phone number must be in E.164 format, for example +15551234567.",
                "saved": False,
                "welcome": False,
                "form": {
                    "twilio_phone": cleaned_phone,
                    "services": cleaned_services,
                    "incentive": cleaned_incentive,
                },
            },
            status_code=status.HTTP_400_BAD_REQUEST,
            form_name="config",
        )

    try:
        services_payload = parse_services(cleaned_services) if cleaned_services else []
    except ValueError as exc:
        return render_template(
            request,
            "config.html",
            {
                "error": str(exc),
                "saved": False,
                "welcome": False,
                "form": {
                    "twilio_phone": cleaned_phone,
                    "services": cleaned_services,
                    "incentive": cleaned_incentive,
                },
            },
            status_code=status.HTTP_400_BAD_REQUEST,
            form_name="config",
        )

    try:
        with get_db() as connection:
            connection.execute(
                """
                UPDATE tenants
                SET twilio_phone = ?, services_json = ?, incentive = ?, updated_at = CURRENT_TIMESTAMP
                WHERE user_id = ?
                """,
                (cleaned_phone, json.dumps(services_payload), cleaned_incentive or None, user_id),
            )
        return RedirectResponse("/dashboard?setup=saved", status_code=status.HTTP_303_SEE_OTHER)
    except sqlite3.IntegrityError:
        return render_template(
            request,
            "config.html",
            {
                "error": "That Twilio phone number is already assigned to another account.",
                "saved": False,
                "welcome": False,
                "form": {
                    "twilio_phone": cleaned_phone,
                    "services": cleaned_services,
                    "incentive": cleaned_incentive,
                },
            },
            status_code=status.HTTP_400_BAD_REQUEST,
            form_name="config",
        )


@app.get("/metrics", response_class=HTMLResponse)
def metrics(request: Request, user_id: int = Depends(get_current_user_id)) -> HTMLResponse:
    with get_db() as connection:
        tenant_row = get_tenant_for_user(connection, user_id)
        if tenant_row is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tenant not found")
        tenant = dict(tenant_row)

        rows = connection.execute(
            """
            SELECT
                COALESCE(recovery_method, 'Unattributed') AS recovery_method,
                COUNT(*) AS bookings,
                COALESCE(SUM(revenue), 0) AS revenue
            FROM leads
            WHERE tenant_id = ? AND status = 'booked'
            GROUP BY COALESCE(recovery_method, 'Unattributed')
            ORDER BY revenue DESC, bookings DESC
            """,
            (tenant["id"],),
        ).fetchall()

    total_revenue = sum(float(row["revenue"] or 0) for row in rows)
    metrics_rows = []
    for row in rows:
        revenue = float(row["revenue"] or 0)
        metrics_rows.append(
            {
                "method": row["recovery_method"],
                "bookings": int(row["bookings"] or 0),
                "revenue": revenue,
                "share": round((revenue / total_revenue) * 100, 1) if total_revenue else 0,
            }
        )

    return render_template(
        request,
        "metrics.html",
        {
            "business_name": tenant["business_name"],
            "total_revenue": total_revenue,
            "rows": metrics_rows,
        },
    )


@app.get("/health")
def health() -> dict[str, Any]:
    with get_db() as connection:
        connection.execute("SELECT 1").fetchone()
    return {
        "status": "ok",
        "database": str(DATABASE_PATH),
        "twilio_configured": bool(
            settings.twilio_account_sid and is_real_secret(settings.twilio_auth_token)
        ),
        "stripe_configured": is_real_secret(settings.stripe_secret_key),
        "csrf_protection": "enabled",
    }


@app.post("/status")
async def status_webhook(request: Request) -> dict[str, str]:
    form = await request.form()
    await validate_twilio_request(request, form)

    message_sid = form.get("MessageSid")
    message_status = form.get("MessageStatus", "unknown")
    to_number = form.get("To", "").strip()

    if not message_sid:
        logger.info("Status webhook received without MessageSid: %s", dict(form))
        return {"status": "ignored"}

    with get_db() as connection:
        tenant = connection.execute(
            "SELECT id FROM tenants WHERE twilio_phone = ?",
            (to_number,),
        ).fetchone()
        if tenant:
            connection.execute(
                """
                UPDATE leads
                SET delivery_status = ?, delivery_status_updated_at = CURRENT_TIMESTAMP,
                    last_message_at = CURRENT_TIMESTAMP
                WHERE tenant_id = ? AND (last_outbound_message_sid = ? OR external_id = ?)
                """,
                (message_status, tenant["id"], message_sid, message_sid),
            )

    logger.info("Status webhook processed for %s with status %s", message_sid, message_status)
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
        logger.info("SMS webhook missing phone data: %s", dict(form))
        return {"status": "ignored"}

    with get_db() as connection:
        tenant = connection.execute(
            "SELECT id FROM tenants WHERE twilio_phone = ?",
            (to_number,),
        ).fetchone()
        if tenant is None:
            logger.warning("No tenant matched inbound SMS for %s", to_number)
            return {"status": "tenant_not_found"}

        existing_lead = connection.execute(
            """
            SELECT id, status, details
            FROM leads
            WHERE tenant_id = ? AND phone = ?
            ORDER BY datetime(created_at) DESC
            LIMIT 1
            """,
            (tenant["id"], from_number),
        ).fetchone()

        details_payload: dict[str, Any] = {"last_inbound_sms": body}
        if existing_lead and existing_lead["details"]:
            try:
                details_payload.update(json.loads(existing_lead["details"]))
            except json.JSONDecodeError:
                logger.info("Lead details for %s were not valid JSON, replacing payload.", from_number)
        details_payload["last_inbound_sms"] = body

        details = json.dumps(details_payload)
        if existing_lead:
            connection.execute(
                """
                UPDATE leads
                SET details = ?, external_id = ?, last_message_at = CURRENT_TIMESTAMP,
                    delivery_status = NULL,
                    delivery_status_updated_at = NULL,
                    status = CASE WHEN status = 'booked' THEN status ELSE 'contacted' END
                WHERE id = ?
                """,
                (details, message_sid, existing_lead["id"]),
            )
        else:
            connection.execute(
                """
                INSERT INTO leads (
                    tenant_id, phone, status, details, recovery_method, external_id, last_message_at
                )
                VALUES (?, ?, 'contacted', ?, 'sms', ?, CURRENT_TIMESTAMP)
                """,
                (tenant["id"], from_number, details, message_sid),
            )

    logger.info("SMS webhook stored lead activity for %s", from_number)
    return {"status": "ok"}


if __name__ == "__main__":
    uvicorn.run("main:app", host=settings.host, port=settings.port, reload=True)
