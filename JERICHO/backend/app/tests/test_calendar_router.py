"""Integration tests for /api/calendar routes."""
from __future__ import annotations

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from main import app
from app.core.database import Base, engine, get_db
from app.models.user import User
from app.core.security import create_access_token


@pytest.fixture(autouse=True)
def clean_db():
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)


@pytest.fixture
def db():
    session = next(get_db())
    yield session
    session.close()


@pytest.fixture
def user(db: Session):
    u = User(email="caluser@test.com", password_hash="x", is_active=True)
    db.add(u)
    db.commit()
    db.refresh(u)
    return u


@pytest.fixture
def auth_headers(user: User):
    token = create_access_token(data={"sub": str(user.id)})
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def client():
    return TestClient(app)


def test_caldav_connect(client, auth_headers):
    resp = client.post(
        "/api/calendar/caldav/connect",
        json={"url": "https://cal.example.com", "username": "u", "password": "p"},
        headers=auth_headers,
    )
    assert resp.status_code == 200
    assert resp.json() == {"status": "connected", "type": "caldav"}


def test_caldav_connect_unauthenticated(client):
    resp = client.post(
        "/api/calendar/caldav/connect",
        json={"url": "https://cal.example.com", "username": "u", "password": "p"},
    )
    assert resp.status_code == 401


def test_disconnect_caldav(client, auth_headers):
    # Connect first
    client.post(
        "/api/calendar/caldav/connect",
        json={"url": "https://cal.example.com", "username": "u", "password": "p"},
        headers=auth_headers,
    )
    # Then disconnect
    resp = client.delete("/api/calendar/caldav/disconnect", headers=auth_headers)
    assert resp.status_code == 200
    assert resp.json() == {"status": "disconnected", "type": "caldav"}


def test_disconnect_when_not_connected_is_ok(client, auth_headers):
    resp = client.delete("/api/calendar/caldav/disconnect", headers=auth_headers)
    assert resp.status_code == 200


def test_google_auth_not_configured(client, auth_headers):
    resp = client.get("/api/calendar/google/auth", headers=auth_headers)
    assert resp.status_code == 501
    assert "not configured" in resp.json()["detail"]


def test_google_callback_invalid_state(client):
    resp = client.get("/api/calendar/google/callback?code=abc&state=invalid-state")
    assert resp.status_code == 400
    assert "Invalid or expired" in resp.json()["detail"]
