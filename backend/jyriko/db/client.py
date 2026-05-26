"""
Supabase async client factory — Phase 2.

Requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (not the anon key —
service role is needed to set PostgreSQL session variables for RLS).
"""
from __future__ import annotations

from supabase import AsyncClient, acreate_client

from jyriko.config import Settings


async def create_db_client(settings: Settings) -> AsyncClient:
    """Create a Supabase async client configured for server-side use.

    Raises RuntimeError when Supabase credentials are absent so the app can
    fall back to the JSON adapter in Phase 0/1 mode without crashing.
    """
    if not settings.supabase_url or not settings.supabase_service_role_key:
        raise RuntimeError(
            "Supabase not configured — set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY"
        )
    return await acreate_client(settings.supabase_url, settings.supabase_service_role_key)
