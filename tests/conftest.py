from __future__ import annotations

import re
from pathlib import Path

import pytest
from fastapi.testclient import TestClient


def extract_csrf_token(response_text: str) -> str:
    match = re.search(r'name="csrf_token"\s+value="([^"]+)"', response_text)
    assert match, "Expected csrf_token input in form response."
    return match.group(1)


async def allow_all_twilio_requests(*args, **kwargs) -> None:
    return None


@pytest.fixture
def app_module(monkeypatch: pytest.MonkeyPatch, tmp_path: Path):
    import main

    database_path = tmp_path / "test.db"
    monkeypatch.setattr(main, "DATABASE_PATH", database_path)
    monkeypatch.setattr(main.settings, "stripe_secret_key", "")
    monkeypatch.setattr(main.settings, "twilio_account_sid", "")
    monkeypatch.setattr(main.settings, "twilio_auth_token", "")
    monkeypatch.setattr(main, "validate_twilio_request", allow_all_twilio_requests)
    main.stripe.api_key = None
    main.twilio_client = None
    main.init_db()
    return main


@pytest.fixture
def client(app_module):
    with TestClient(app_module.app) as test_client:
        yield test_client


@pytest.fixture
def registered_client(client: TestClient):
    signup_page = client.get("/signup")
    csrf_token = extract_csrf_token(signup_page.text)
    response = client.post(
        "/signup",
        data={
            "csrf_token": csrf_token,
            "email": "owner@example.com",
            "password": "password123",
            "business_name": "Northwind Spa",
        },
        follow_redirects=False,
    )
    assert response.status_code == 303
    return client
