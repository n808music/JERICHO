"""
Calendar connectivity router — Phase 3.

Google OAuth flow:
  GET /calendar/google/auth     → redirect to Google consent screen
  GET /calendar/google/callback → exchange code for tokens, store encrypted

CalDAV flow:
  POST /calendar/caldav/connect → store encrypted URL/username/password

Disconnect:
  DELETE /calendar/{type}/disconnect → revoke tokens + purge user_credentials

Instance identity comes from the `instance_id` query parameter (Phase 3 MVP).
Phase 5 auth middleware will make this implicit via JWT.
"""
from __future__ import annotations

import secrets
from typing import Annotated, Literal
from urllib.parse import urlencode

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from fastapi.responses import RedirectResponse
from google.oauth2.credentials import Credentials  # type: ignore[import-untyped]
from google_auth_oauthlib.flow import Flow  # type: ignore[import-untyped]
from pydantic import BaseModel
from supabase import AsyncClient

from jyriko.calendar.token_store import delete_credentials, load_credentials, save_credentials
from jyriko.config import Settings, get_settings
from jyriko.db.deps import require_db_client

router = APIRouter(tags=["calendar"])

_GOOGLE_SCOPES = ["https://www.googleapis.com/auth/calendar.events"]

# In-memory CSRF state store (sufficient for single-instance dev; replace with
# Redis or Supabase for multi-instance production).
_oauth_states: dict[str, str] = {}  # state_token → instance_id


def _make_google_flow(settings: Settings) -> Flow:
    client_config = {
        "web": {
            "client_id": settings.google_client_id,
            "client_secret": settings.google_client_secret,
            "auth_uri": "https://accounts.google.com/o/oauth2/auth",
            "token_uri": "https://oauth2.googleapis.com/token",
            "redirect_uris": [settings.google_oauth_redirect_uri],
        }
    }
    flow = Flow.from_client_config(client_config, scopes=_GOOGLE_SCOPES)
    flow.redirect_uri = settings.google_oauth_redirect_uri
    return flow


# ---------------------------------------------------------------------------
# Google OAuth
# ---------------------------------------------------------------------------

@router.get("/google/auth")
async def google_auth(
    instance_id: Annotated[str, Query(description="Caller's instance UUID")],
    settings: Annotated[Settings, Depends(get_settings)],
) -> RedirectResponse:
    """Initiate Google OAuth — redirect user to consent screen."""
    if not settings.google_client_id:
        raise HTTPException(status_code=501, detail="Google OAuth not configured")

    state = secrets.token_urlsafe(32)
    _oauth_states[state] = instance_id

    flow = _make_google_flow(settings)
    auth_url, _ = flow.authorization_url(
        access_type="offline",
        include_granted_scopes="true",
        state=state,
        prompt="consent",
    )
    return RedirectResponse(url=auth_url)


@router.get("/google/callback")
async def google_callback(
    request: Request,
    code: Annotated[str, Query()],
    state: Annotated[str, Query()],
    settings: Annotated[Settings, Depends(get_settings)],
    db: Annotated[AsyncClient, Depends(require_db_client)],
) -> dict[str, str]:
    """Exchange OAuth code for tokens and persist encrypted credentials."""
    instance_id = _oauth_states.pop(state, None)
    if instance_id is None:
        raise HTTPException(status_code=400, detail="Invalid or expired OAuth state")

    flow = _make_google_flow(settings)
    flow.fetch_token(code=code)
    creds: Credentials = flow.credentials

    payload = {
        "token": creds.token,
        "refresh_token": creds.refresh_token,
        "token_uri": creds.token_uri,
        "client_id": creds.client_id,
        "client_secret": creds.client_secret,
        "scopes": list(creds.scopes or []),
    }
    await save_credentials(db, instance_id, "google", payload, settings.credential_encryption_key)
    return {"status": "connected", "type": "google"}


# ---------------------------------------------------------------------------
# CalDAV connect
# ---------------------------------------------------------------------------

class CalDAVConnectRequest(BaseModel):
    instance_id: str
    url: str
    username: str
    password: str


@router.post("/caldav/connect")
async def caldav_connect(
    body: CalDAVConnectRequest,
    settings: Annotated[Settings, Depends(get_settings)],
    db: Annotated[AsyncClient, Depends(require_db_client)],
) -> dict[str, str]:
    """Store encrypted CalDAV connection credentials."""
    payload = {"url": body.url, "username": body.username, "password": body.password}
    await save_credentials(
        db, body.instance_id, "caldav", payload, settings.credential_encryption_key
    )
    return {"status": "connected", "type": "caldav"}


# ---------------------------------------------------------------------------
# Disconnect (both types)
# ---------------------------------------------------------------------------

CalendarType = Literal["google", "caldav"]


@router.delete("/{calendar_type}/disconnect")
async def disconnect(
    calendar_type: CalendarType,
    instance_id: Annotated[str, Query()],
    settings: Annotated[Settings, Depends(get_settings)],
    db: Annotated[AsyncClient, Depends(require_db_client)],
) -> dict[str, str]:
    """Revoke + purge credentials for the given calendar type."""
    creds = await load_credentials(db, instance_id, calendar_type, settings.credential_encryption_key)

    if creds and calendar_type == "google":
        # Best-effort token revocation; don't fail disconnect if revoke errors.
        try:
            import httpx
            await httpx.AsyncClient().post(
                "https://oauth2.googleapis.com/revoke",
                params={"token": creds.get("token") or creds.get("refresh_token")},
            )
        except Exception:  # noqa: BLE001
            pass

    await delete_credentials(db, instance_id, calendar_type)
    return {"status": "disconnected", "type": calendar_type}
