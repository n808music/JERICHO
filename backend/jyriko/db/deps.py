"""
FastAPI dependency helpers for database access.

Routers import `get_db_client` and use `Depends(get_db_client)` to receive
the Supabase AsyncClient.  The client is None when Supabase is unconfigured
(Phase 0 JSON mode), so routers must guard against this or call
`require_db_client` which raises a 503.
"""
from __future__ import annotations

from fastapi import HTTPException, Request
from supabase import AsyncClient


async def get_db_client(request: Request) -> AsyncClient | None:
    """Return the Supabase client from app.state, or None in JSON-adapter mode."""
    return getattr(request.app.state, "db_client", None)


async def require_db_client(request: Request) -> AsyncClient:
    """Like get_db_client but raises HTTP 503 when Supabase is not configured."""
    client = getattr(request.app.state, "db_client", None)
    if client is None:
        raise HTTPException(
            status_code=503,
            detail="Supabase database not configured — set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY",
        )
    return client
