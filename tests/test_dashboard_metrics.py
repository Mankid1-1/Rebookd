from __future__ import annotations


def test_dashboard_renders_setup_state_and_recent_leads(registered_client, app_module):
    with app_module.get_db() as connection:
        tenant = connection.execute("SELECT id FROM tenants").fetchone()
        connection.execute(
            """
            UPDATE tenants
            SET twilio_phone = ?, services_json = ?, incentive = ?
            WHERE id = ?
            """,
            (
                "+15551234567",
                '[{"name":"Haircut","minutes":45,"price":65}]',
                "10% off",
                tenant["id"],
            ),
        )
        connection.execute(
            """
            INSERT INTO leads (tenant_id, phone, status, revenue, recovery_method)
            VALUES (?, ?, 'booked', 125, 'sms')
            """,
            (tenant["id"], "+15557654321"),
        )

    response = registered_client.get("/dashboard")

    assert response.status_code == 200
    assert "Northwind Spa" in response.text
    assert "Twilio forwarding number" in response.text
    assert "Service catalog" in response.text
    assert "+15557654321" in response.text


def test_metrics_renders_booked_revenue_by_method(registered_client, app_module):
    with app_module.get_db() as connection:
        tenant = connection.execute("SELECT id, business_name FROM tenants").fetchone()
        connection.execute(
            """
            INSERT INTO leads (tenant_id, phone, status, revenue, recovery_method)
            VALUES
                (?, ?, 'booked', 100, 'sms'),
                (?, ?, 'booked', 50, 'manual'),
                (?, ?, 'contacted', 999, 'sms')
            """,
            (
                tenant["id"],
                "+15550000001",
                tenant["id"],
                "+15550000002",
                tenant["id"],
                "+15550000003",
            ),
        )

    response = registered_client.get("/metrics")

    assert response.status_code == 200
    assert tenant["business_name"] in response.text
    assert "sms" in response.text
    assert "manual" in response.text
    assert "150" in response.text
