"""
Integration test fixtures for Supabase.

All tests in tests/db/ are skipped unless SUPABASE_URL is set in the
environment — they require a running local Supabase stack (via Colima).
"""
from __future__ import annotations

import os

import pytest
from supabase._async.client import AsyncClient, create_client


def pytest_collection_modifyitems(items: list) -> None:  # type: ignore[type-arg]
    if not os.getenv("SUPABASE_URL"):
        skip = pytest.mark.skip(reason="SUPABASE_URL not set — requires local Supabase")
        for item in items:
            if "tests/db" in str(item.fspath):
                item.add_marker(skip)


@pytest.fixture
async def db() -> AsyncClient:  # type: ignore[misc]
    url = os.environ["SUPABASE_URL"]
    key = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
    return await create_client(url, key)
