"""
Calendar connectivity router.

Google OAuth:
  GET  /api/calendar/google/auth      → redirect to consent screen
  GET  /api/calendar/google/callback  → exchange code, store encrypted

CalDAV:
  POST /api/calendar/caldav/connect   → store encrypted credentials

Disconnect:
  DELETE /api/calendar/{type}/disconnect → revoke + purge
"""
from __future__ import annotations

import secrets
from typing import Annotated, Literal

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import RedirectResponse
from google.oauth2.credentials import Credentials  # type: ignore[import-untyped]
from google_auth_oauthlib.flow import Flow  # type: ignore[import-untyped]
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.api.auth import get_current_user
from app.calendar.token_store import delete_credentials, load_credentials, save_credentials
from app.core.config import settings
from app.core.database import get_db
from app.models.user import User

router = APIRouter(prefix="/calendar", tags=["calendar"])

CalendarType = Literal["google", "caldav"]

_GOOGLE_SCOPES = ["https://www.googleapis.com/auth/calendar.events"]

# In-memory CSRF state: state_token → user_id. Single-instance dev only.
_oauth_states: dict[str, int] = {}


def _make_google_flow() -> Flow:
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


@router.get("/google/auth")
def google_auth(
    current_user: User = Depends(get_current_user),
) -> RedirectResponse:
    if not settings.google_client_id:
        raise HTTPException(status_code=501, detail="Google OAuth not configured")

    state = secrets.token_urlsafe(32)
    _oauth_states[state] = current_user.id

    flow = _make_google_flow()
    auth_url, _ = flow.authorization_url(
        access_type="offline",
        include_granted_scopes="true",
        state=state,
        prompt="consent",
    )
    return RedirectResponse(url=auth_url)


@router.get("/google/callback")
def google_callback(
    code: str,
    state: str,
    db: Session = Depends(get_db),
) -> dict[str, str]:
    user_id = _oauth_states.pop(state, None)
    if user_id is None:
        raise HTTPException(status_code=400, detail="Invalid or expired OAuth state")

    flow = _make_google_flow()
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
    save_credentials(db, user_id, "google", payload, settings.credential_encryption_key)
    return {"status": "connected", "type": "google"}


class CalDAVConnectRequest(BaseModel):
    url: str
    username: str
    password: str


@router.post("/caldav/connect")
def caldav_connect(
    body: CalDAVConnectRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict[str, str]:
    payload = {"url": body.url, "username": body.username, "password": body.password}
    save_credentials(db, current_user.id, "caldav", payload, settings.credential_encryption_key)
    return {"status": "connected", "type": "caldav"}


@router.delete("/{calendar_type}/disconnect")
def disconnect(
    calendar_type: CalendarType,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict[str, str]:
    creds = load_credentials(db, current_user.id, calendar_type, settings.credential_encryption_key)

    if creds and calendar_type == "google":
        try:
            import httpx
            httpx.post(
                "https://oauth2.googleapis.com/revoke",
                params={"token": creds.get("token") or creds.get("refresh_token")},
            )
        except Exception:  # noqa: BLE001
            pass

    delete_credentials(db, current_user.id, calendar_type)
    return {"status": "disconnected", "type": calendar_type}
