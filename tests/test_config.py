from __future__ import annotations

import json

from conftest import extract_csrf_token


def post_config(client, **overrides):
    config_page = client.get("/config")
    csrf_token = extract_csrf_token(config_page.text)
    payload = {
        "csrf_token": csrf_token,
        "twilio_phone": "",
        "services": "",
        "incentive": "",
    }
    payload.update(overrides)
    return client.post("/config", data=payload, follow_redirects=False)


def post_signup(client, email: str, business_name: str):
    signup_page = client.get("/signup")
    csrf_token = extract_csrf_token(signup_page.text)
    return client.post(
        "/signup",
        data={
            "csrf_token": csrf_token,
            "email": email,
            "password": "password123",
            "business_name": business_name,
        },
        follow_redirects=False,
    )


def test_config_rejects_non_e164_phone(registered_client):
    response = post_config(
        registered_client,
        twilio_phone="5551234567",
        services="Haircut:45:65",
        incentive="10% off",
    )

    assert response.status_code == 400
    assert "Twilio phone number must be in E.164 format" in response.text


def test_config_saves_tenant_settings(registered_client, app_module):
    response = post_config(
        registered_client,
        twilio_phone="+15551234567",
        services="Haircut:45:65, Color:90:120",
        incentive="10% off your next visit",
    )

    assert response.status_code == 303
    assert response.headers["location"] == "/dashboard?setup=saved"

    with app_module.get_db() as connection:
        tenant = connection.execute(
            "SELECT twilio_phone, services_json, incentive FROM tenants"
        ).fetchone()

    assert tenant["twilio_phone"] == "+15551234567"
    assert json.loads(tenant["services_json"]) == [
        {"name": "Haircut", "minutes": 45, "price": 65.0},
        {"name": "Color", "minutes": 90, "price": 120.0},
    ]
    assert tenant["incentive"] == "10% off your next visit"


def test_config_rejects_duplicate_twilio_phone(client):
    first_signup = post_signup(client, "first@example.com", "First Spa")
    assert first_signup.status_code == 303
    first_config = post_config(client, twilio_phone="+15550000001")
    assert first_config.status_code == 303

    client.get("/logout")

    second_signup = post_signup(client, "second@example.com", "Second Spa")
    assert second_signup.status_code == 303

    duplicate = post_config(client, twilio_phone="+15550000001")

    assert duplicate.status_code == 400
    assert "already assigned to another account" in duplicate.text
