"""Smoke tests for health routes."""
import pytest
from httpx import AsyncClient, ASGITransport

from jyriko.main import app


@pytest.fixture
async def client():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        yield c


async def test_health_returns_alive(client: AsyncClient):
    resp = await client.get("/health")
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "alive"
    assert "/pipeline" in data["routes"]


async def test_health_routes_listed(client: AsyncClient):
    resp = await client.get("/health")
    routes = resp.json()["routes"]
    assert "/state" in routes
    assert "/goals" in routes
