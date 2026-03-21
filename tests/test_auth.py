from __future__ import annotations

from conftest import extract_csrf_token


def test_signup_creates_user_tenant_and_auth_cookie(client, app_module):
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
    assert response.headers["location"] == "/dashboard"
    assert "auth_token" in response.cookies

    with app_module.get_db() as connection:
        user = connection.execute(
            "SELECT id FROM users WHERE email = ?",
            ("owner@example.com",),
        ).fetchone()
        tenant = connection.execute(
            "SELECT business_name FROM tenants WHERE user_id = ?",
            (user["id"],),
        ).fetchone()

    assert user is not None
    assert tenant["business_name"] == "Northwind Spa"


def test_login_sets_auth_cookie_for_valid_credentials(registered_client, client):
    client.get("/logout")
    login_page = client.get("/login")
    csrf_token = extract_csrf_token(login_page.text)

    response = client.post(
        "/login",
        data={
            "csrf_token": csrf_token,
            "email": "owner@example.com",
            "password": "password123",
        },
        follow_redirects=False,
    )

    assert response.status_code == 303
    assert response.headers["location"] == "/dashboard"
    assert "auth_token" in response.cookies


def test_login_rejects_invalid_credentials(client):
    login_page = client.get("/login")
    csrf_token = extract_csrf_token(login_page.text)
    response = client.post(
        "/login",
        data={
            "csrf_token": csrf_token,
            "email": "missing@example.com",
            "password": "wrongpass",
        },
    )

    assert response.status_code == 400
    assert "Invalid email or password." in response.text
