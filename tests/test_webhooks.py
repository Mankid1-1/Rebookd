from __future__ import annotations

import json

from test_config import post_config


def test_health_reports_ok(client):
    response = client.get("/health")

    assert response.status_code == 200
    assert response.json()["status"] == "ok"


def test_sms_webhook_creates_lead_for_matching_tenant(registered_client, app_module):
    post_config(registered_client, twilio_phone="+15551234567")

    response = registered_client.post(
        "/sms",
        data={
            "From": "+15557654321",
            "To": "+15551234567",
            "MessageSid": "SM123",
            "Body": "Need an appointment",
        },
    )

    assert response.status_code == 200
    assert response.json() == {"status": "ok"}

    with app_module.get_db() as connection:
        lead = connection.execute(
            "SELECT phone, status, recovery_method, external_id, details FROM leads"
        ).fetchone()

    assert lead["phone"] == "+15557654321"
    assert lead["status"] == "contacted"
    assert lead["recovery_method"] == "sms"
    assert lead["external_id"] == "SM123"
    assert json.loads(lead["details"])["last_inbound_sms"] == "Need an appointment"


def test_sms_webhook_updates_existing_lead_and_preserves_booked(registered_client, app_module):
    post_config(registered_client, twilio_phone="+15551234567")

    with app_module.get_db() as connection:
        tenant = connection.execute("SELECT id FROM tenants").fetchone()
        connection.execute(
            """
            INSERT INTO leads (tenant_id, phone, status, revenue, external_id)
            VALUES (?, ?, 'booked', 200, 'SM_OLD')
            """,
            (tenant["id"], "+15557654321"),
        )

    response = registered_client.post(
        "/sms",
        data={
            "From": "+15557654321",
            "To": "+15551234567",
            "MessageSid": "SM999",
            "Body": "Confirming my booking",
        },
    )

    assert response.status_code == 200
    assert response.json() == {"status": "ok"}

    with app_module.get_db() as connection:
        lead = connection.execute(
            "SELECT status, external_id, details FROM leads WHERE phone = ?",
            ("+15557654321",),
        ).fetchone()

    assert lead["status"] == "booked"
    assert lead["external_id"] == "SM999"
    assert json.loads(lead["details"])["last_inbound_sms"] == "Confirming my booking"


def test_status_webhook_updates_matching_delivery_status(registered_client, app_module):
    post_config(registered_client, twilio_phone="+15551234567")
    registered_client.post(
        "/sms",
        data={
            "From": "+15557654321",
            "To": "+15551234567",
            "MessageSid": "SM123",
            "Body": "Need an appointment",
        },
    )

    response = registered_client.post(
        "/status",
        data={
            "MessageSid": "SM123",
            "MessageStatus": "delivered",
            "To": "+15551234567",
        },
    )

    assert response.status_code == 200
    assert response.json() == {"status": "ok"}

    with app_module.get_db() as connection:
        lead = connection.execute(
            "SELECT status, delivery_status FROM leads WHERE external_id = ?",
            ("SM123",),
        ).fetchone()

    assert lead["status"] == "contacted"
    assert lead["delivery_status"] == "delivered"


def test_status_webhook_ignores_missing_message_sid(client):
    response = client.post(
        "/status",
        data={"MessageStatus": "delivered", "To": "+15551234567"},
    )

    assert response.status_code == 200
    assert response.json() == {"status": "ignored"}
