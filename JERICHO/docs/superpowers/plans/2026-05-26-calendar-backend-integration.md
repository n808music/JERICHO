# Calendar Backend Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Port the CalDAV + Google Calendar backend modules from PR #5 into `JERICHO/backend/app/`, adapted from Supabase/async to SQLAlchemy/sync with JWT auth.

**Architecture:** Three self-contained modules — `token_store.py` (AES-256-GCM credential encryption over SQLAlchemy), `caldav_backend.py` and `google_backend.py` (calendar CRUD), and `api/calendar.py` (FastAPI router using `get_current_user`). A new `UserCalendarCredential` ORM model stores encrypted blobs. The encryption logic (`encrypt_payload`/`decrypt_payload`) is copied verbatim from PR #5; only the DB layer changes.

**Tech Stack:** Python, FastAPI, SQLAlchemy (sync), `caldav`, `google-api-python-client`, `google-auth-oauthlib`, `cryptography` (AES-GCM)

---

## File Map

| Action | Path | Responsibility |
|---|---|---|
| Modify | `backend/requirements.txt` | Add 5 new packages |
| Create | `backend/app/models/user_calendar.py` | `UserCalendarCredential` ORM model |
| Modify | `backend/app/models/user.py` | Add `calendar_credentials` relationship |
| Modify | `backend/main.py` | Import model, register router |
| Modify | `backend/app/core/config.py` | Add 4 calendar settings |
| Create | `backend/app/calendar/__init__.py` | Package marker |
| Create | `backend/app/calendar/types.py` | `CalendarTask` dataclass |
| Create | `backend/app/calendar/token_store.py` | Encrypt/decrypt + SQLAlchemy CRUD |
| Create | `backend/app/calendar/caldav_backend.py` | CalDAV CRUD (ported) |
| Create | `backend/app/calendar/google_backend.py` | Google Calendar CRUD (ported) |
| Create | `backend/app/api/calendar.py` | FastAPI router (4 endpoints) |
| Create | `backend/app/tests/test_calendar_token_store.py` | Token store unit tests |
| Create | `backend/app/tests/test_calendar_caldav.py` | CalDAV backend unit tests |
| Create | `backend/app/tests/test_calendar_google.py` | Google backend unit tests |
| Create | `backend/app/tests/test_calendar_router.py` | Router integration tests |

---

### Task 1: Add dependencies

**Files:**
- Modify: `backend/requirements.txt`

- [ ] **Step 1: Add the 5 new packages**

```
# requirements.txt — append these lines:
caldav==1.3.9
google-api-python-client==2.136.0
google-auth-oauthlib==1.2.1
google-auth-httplib2==0.2.0
cryptography==42.0.8
```

The full file after edit:
```
fastapi==0.104.1
uvicorn[standard]==0.24.0
sqlalchemy==2.0.23
psycopg2-binary==2.9.9
alembic==1.13.1
pydantic==2.5.0
python-jose[cryptography]==3.3.0
passlib[bcrypt]==1.7.4
python-multipart==0.0.6
python-dotenv==1.0.0
pytest==7.4.3
pytest-asyncio==0.21.1
httpx==0.25.2
caldav==1.3.9
google-api-python-client==2.136.0
google-auth-oauthlib==1.2.1
google-auth-httplib2==0.2.0
cryptography==42.0.8
```

- [ ] **Step 2: Install**

```bash
cd backend && ./venv/bin/pip install -r requirements.txt
```

Expected: no errors; `Successfully installed` lines for the 5 new packages.

- [ ] **Step 3: Commit**

```bash
git add backend/requirements.txt
git commit -m "chore(backend): add calendar integration dependencies"
```

---

### Task 2: UserCalendarCredential model + settings + wiring

**Files:**
- Create: `backend/app/models/user_calendar.py`
- Modify: `backend/app/models/user.py`
- Modify: `backend/app/core/config.py`
- Modify: `backend/main.py`

- [ ] **Step 1: Write the failing test**

```python
# backend/app/tests/test_calendar_token_store.py  (create the file)
import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.core.database import Base
from app.models.user import User
from app.models.user_calendar import UserCalendarCredential


@pytest.fixture
def db():
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(bind=engine)
    Session = sessionmaker(bind=engine)
    session = Session()
    yield session
    session.close()
    Base.metadata.drop_all(bind=engine)


def test_user_calendar_credential_model(db):
    user = User(email="cal@test.com", password_hash="x", is_active=True)
    db.add(user)
    db.flush()

    cred = UserCalendarCredential(
        user_id=user.id,
        credential_type="caldav",
        encrypted_payload=b"somebytes",
    )
    db.add(cred)
    db.commit()

    row = db.query(UserCalendarCredential).filter_by(user_id=user.id).first()
    assert row is not None
    assert row.credential_type == "caldav"
    assert row.encrypted_payload == b"somebytes"
```

- [ ] **Step 2: Run — expect ImportError on UserCalendarCredential**

```bash
cd backend && ./venv/bin/pytest app/tests/test_calendar_token_store.py::test_user_calendar_credential_model -v
```

Expected: `ImportError: cannot import name 'UserCalendarCredential'`

- [ ] **Step 3: Create `backend/app/models/user_calendar.py`**

```python
from sqlalchemy import Column, Integer, String, LargeBinary, DateTime, ForeignKey, UniqueConstraint
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.core.database import Base


class UserCalendarCredential(Base):
    __tablename__ = "user_calendar_credentials"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    credential_type = Column(String, nullable=False)  # "google" | "caldav"
    encrypted_payload = Column(LargeBinary, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    __table_args__ = (UniqueConstraint("user_id", "credential_type", name="uq_user_cred_type"),)

    user = relationship("User", back_populates="calendar_credentials")
```

- [ ] **Step 4: Add relationship to `backend/app/models/user.py`**

Add one line to the `User` class (after the `state = relationship(...)` line):

```python
    calendar_credentials = relationship("UserCalendarCredential", back_populates="user")
```

- [ ] **Step 5: Add calendar settings to `backend/app/core/config.py`**

Add inside the `Settings` class, after the `environment` field:

```python
    # Calendar OAuth + encryption
    google_client_id: str = ""
    google_client_secret: str = ""
    google_oauth_redirect_uri: str = "http://localhost:8000/api/calendar/google/callback"
    credential_encryption_key: str = "dev-encryption-key-change-in-production"
```

- [ ] **Step 6: Import model in `backend/main.py`**

Add after the existing model imports (after `import app.models.user_state`):

```python
import app.models.user_calendar  # noqa: F401
```

- [ ] **Step 7: Run test — expect PASS**

```bash
cd backend && ./venv/bin/pytest app/tests/test_calendar_token_store.py::test_user_calendar_credential_model -v
```

Expected: `PASSED`

- [ ] **Step 8: Commit**

```bash
git add backend/app/models/user_calendar.py backend/app/models/user.py \
        backend/app/core/config.py backend/main.py \
        backend/app/tests/test_calendar_token_store.py
git commit -m "feat(backend): add UserCalendarCredential model and calendar settings"
```

---

### Task 3: Token store

**Files:**
- Create: `backend/app/calendar/__init__.py`
- Create: `backend/app/calendar/types.py`
- Create: `backend/app/calendar/token_store.py`
- Modify: `backend/app/tests/test_calendar_token_store.py`

- [ ] **Step 1: Add token store tests to the existing test file**

Append to `backend/app/tests/test_calendar_token_store.py`:

```python
from app.calendar.token_store import (
    delete_credentials,
    decrypt_payload,
    encrypt_payload,
    load_credentials,
    save_credentials,
)


def test_encrypt_decrypt_roundtrip():
    data = {"token": "abc123", "refresh_token": "xyz"}
    raw_key = "test-key"
    blob = encrypt_payload(data, raw_key)
    assert isinstance(blob, bytes)
    assert len(blob) > 12  # nonce + ciphertext
    result = decrypt_payload(blob, raw_key)
    assert result == data


def test_encrypt_produces_unique_blobs():
    data = {"token": "same"}
    key = "k"
    blob1 = encrypt_payload(data, key)
    blob2 = encrypt_payload(data, key)
    assert blob1 != blob2  # different nonces


def test_save_and_load(db):
    user = User(email="store@test.com", password_hash="x", is_active=True)
    db.add(user)
    db.flush()

    payload = {"url": "https://cal.example.com", "username": "u", "password": "p"}
    save_credentials(db, user.id, "caldav", payload, "raw-key")

    loaded = load_credentials(db, user.id, "caldav", "raw-key")
    assert loaded == payload


def test_load_missing_returns_none(db):
    assert load_credentials(db, 9999, "caldav", "key") is None


def test_save_upserts(db):
    user = User(email="upsert@test.com", password_hash="x", is_active=True)
    db.add(user)
    db.flush()

    save_credentials(db, user.id, "caldav", {"v": "1"}, "k")
    save_credentials(db, user.id, "caldav", {"v": "2"}, "k")  # overwrite

    loaded = load_credentials(db, user.id, "caldav", "k")
    assert loaded == {"v": "2"}

    from app.models.user_calendar import UserCalendarCredential
    count = db.query(UserCalendarCredential).filter_by(user_id=user.id).count()
    assert count == 1  # not two rows


def test_delete_credentials(db):
    user = User(email="del@test.com", password_hash="x", is_active=True)
    db.add(user)
    db.flush()

    save_credentials(db, user.id, "google", {"token": "t"}, "k")
    delete_credentials(db, user.id, "google")
    assert load_credentials(db, user.id, "google", "k") is None


def test_delete_missing_is_noop(db):
    delete_credentials(db, 9999, "google")  # must not raise
```

- [ ] **Step 2: Run — expect ImportError on token_store**

```bash
cd backend && ./venv/bin/pytest app/tests/test_calendar_token_store.py -v
```

Expected: `ImportError: cannot import name 'save_credentials' from 'app.calendar.token_store'`

- [ ] **Step 3: Create `backend/app/calendar/__init__.py`**

Empty file:
```python
```

- [ ] **Step 4: Create `backend/app/calendar/types.py`**

```python
from __future__ import annotations

from dataclasses import dataclass
from datetime import date
from typing import Optional


@dataclass
class CalendarTask:
    """Minimal task representation used by calendar backends."""
    id: str
    title: str
    scheduled_date: Optional[date] = None
```

- [ ] **Step 5: Create `backend/app/calendar/token_store.py`**

```python
"""
AES-256-GCM credential encryption over SQLAlchemy.

encrypt_payload / decrypt_payload are pure functions — no DB access.
save / load / delete operate on the UserCalendarCredential table.
"""
from __future__ import annotations

import hashlib
import json
import os
from typing import Any

from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from sqlalchemy.orm import Session

from app.models.user_calendar import UserCalendarCredential

_NONCE_BYTES = 12  # 96-bit nonce — NIST recommendation for AES-GCM


def _derive_key(raw_key: str) -> bytes:
    return hashlib.sha256(raw_key.encode()).digest()


def encrypt_payload(data: dict[str, Any], raw_key: str) -> bytes:
    """Encrypt *data* to AES-256-GCM bytes: nonce ‖ ciphertext."""
    key = _derive_key(raw_key)
    nonce = os.urandom(_NONCE_BYTES)
    ciphertext = AESGCM(key).encrypt(nonce, json.dumps(data).encode(), None)
    return nonce + ciphertext


def decrypt_payload(blob: bytes, raw_key: str) -> dict[str, Any]:
    """Decrypt AES-256-GCM blob (nonce ‖ ciphertext) → original dict."""
    key = _derive_key(raw_key)
    nonce, ciphertext = blob[:_NONCE_BYTES], blob[_NONCE_BYTES:]
    plaintext = AESGCM(key).decrypt(nonce, ciphertext, None)
    return json.loads(plaintext.decode())  # type: ignore[no-any-return]


def save_credentials(
    db: Session,
    user_id: int,
    credential_type: str,
    payload: dict[str, Any],
    raw_key: str,
) -> None:
    """Upsert encrypted credentials for (user_id, credential_type)."""
    encrypted = encrypt_payload(payload, raw_key)
    existing = (
        db.query(UserCalendarCredential)
        .filter_by(user_id=user_id, credential_type=credential_type)
        .first()
    )
    if existing:
        existing.encrypted_payload = encrypted
    else:
        db.add(UserCalendarCredential(
            user_id=user_id,
            credential_type=credential_type,
            encrypted_payload=encrypted,
        ))
    db.commit()


def load_credentials(
    db: Session,
    user_id: int,
    credential_type: str,
    raw_key: str,
) -> dict[str, Any] | None:
    """Return decrypted credentials or None if not found."""
    row = (
        db.query(UserCalendarCredential)
        .filter_by(user_id=user_id, credential_type=credential_type)
        .first()
    )
    if row is None:
        return None
    return decrypt_payload(row.encrypted_payload, raw_key)


def delete_credentials(db: Session, user_id: int, credential_type: str) -> None:
    """Remove credential row; no-op if not found."""
    db.query(UserCalendarCredential).filter_by(
        user_id=user_id, credential_type=credential_type
    ).delete()
    db.commit()
```

- [ ] **Step 6: Run tests — expect all PASS**

```bash
cd backend && ./venv/bin/pytest app/tests/test_calendar_token_store.py -v
```

Expected: 8 tests, all `PASSED`

- [ ] **Step 7: Commit**

```bash
git add backend/app/calendar/ backend/app/tests/test_calendar_token_store.py
git commit -m "feat(backend): add calendar token store with AES-256-GCM encryption"
```

---

### Task 4: CalDAV backend

**Files:**
- Create: `backend/app/calendar/caldav_backend.py`
- Create: `backend/app/tests/test_calendar_caldav.py`

- [ ] **Step 1: Write the failing tests**

```python
# backend/app/tests/test_calendar_caldav.py
"""Tests for CalDAVBackend — caldav.DAVClient mocked."""
from __future__ import annotations

from datetime import date
from unittest.mock import MagicMock, patch

import pytest

from app.calendar.caldav_backend import CalDAVBackend
from app.calendar.types import CalendarTask


@pytest.fixture
def mock_calendar():
    cal = MagicMock()
    cal.search.return_value = []
    return cal


@pytest.fixture
def backend(mock_calendar):
    with patch("app.calendar.caldav_backend.DAVClient") as mock_client_cls:
        instance = mock_client_cls.return_value
        instance.principal.return_value.calendars.return_value = [mock_calendar]
        b = CalDAVBackend(url="https://cal.example.com", username="u", password="p")
        b._mock_calendar = mock_calendar
        yield b


@pytest.fixture
def task():
    return CalendarTask(id="task-1", title="Write tests", scheduled_date=date(2026, 6, 1))


@pytest.mark.asyncio
async def test_create_event_returns_task_id(backend, task):
    result = await backend.create_event(task)
    assert result == "task-1"
    backend._mock_calendar.save_event.assert_called_once()
    ical = backend._mock_calendar.save_event.call_args[0][0]
    assert "task-1" in ical
    assert "Write tests" in ical
    assert "20260601" in ical


@pytest.mark.asyncio
async def test_update_event_overwrites_existing(backend, task):
    mock_event = MagicMock()
    backend._mock_calendar.search.return_value = [mock_event]

    await backend.update_event(task, "task-1")

    assert mock_event.data is not None
    mock_event.save.assert_called_once()


@pytest.mark.asyncio
async def test_update_event_recreates_if_missing(backend, task):
    backend._mock_calendar.search.return_value = []

    await backend.update_event(task, "task-1")

    backend._mock_calendar.save_event.assert_called_once()


@pytest.mark.asyncio
async def test_delete_event_found(backend):
    mock_event = MagicMock()
    backend._mock_calendar.search.return_value = [mock_event]

    await backend.delete_event("task-1")

    mock_event.delete.assert_called_once()


@pytest.mark.asyncio
async def test_delete_event_not_found_is_noop(backend):
    backend._mock_calendar.search.return_value = []
    await backend.delete_event("nonexistent")  # must not raise


@pytest.mark.asyncio
async def test_no_calendars_raises(task):
    with patch("app.calendar.caldav_backend.DAVClient") as mock_client_cls:
        instance = mock_client_cls.return_value
        instance.principal.return_value.calendars.return_value = []
        b = CalDAVBackend(url="https://cal.example.com", username="u", password="p")
        with pytest.raises(RuntimeError, match="No calendars found"):
            await b.create_event(task)
```

- [ ] **Step 2: Run — expect ImportError**

```bash
cd backend && ./venv/bin/pytest app/tests/test_calendar_caldav.py -v
```

Expected: `ImportError: cannot import name 'CalDAVBackend'`

- [ ] **Step 3: Create `backend/app/calendar/caldav_backend.py`**

```python
"""
CalDAV backend.

VEVENT UID is set to task.id — reliable correlation without storing
a separate external_event_id. X-JERICHO-TASK-ID carries the same value
for integrations that parse raw iCalendar data (e.g., native iOS client).
Events are all-day (DATE not DATETIME) — JERICHO schedules at day granularity.
"""
from __future__ import annotations

from datetime import date, timedelta

import caldav  # type: ignore[import-untyped]
from caldav import DAVClient  # type: ignore[import-untyped]

from app.calendar.types import CalendarTask

_VCALENDAR_TEMPLATE = """\
BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Jericho//Jericho 2.0//EN
BEGIN:VEVENT
UID:{uid}
SUMMARY:{summary}
DTSTART;VALUE=DATE:{dtstart}
DTEND;VALUE=DATE:{dtend}
X-JERICHO-TASK-ID:{uid}
END:VEVENT
END:VCALENDAR"""


def _fallback_date() -> date:
    return date.today()


def _build_ical(task: CalendarTask) -> str:
    day = task.scheduled_date or _fallback_date()
    return _VCALENDAR_TEMPLATE.format(
        uid=task.id,
        summary=task.title,
        dtstart=day.strftime("%Y%m%d"),
        dtend=(day + timedelta(days=1)).strftime("%Y%m%d"),
    )


class CalDAVBackend:
    def __init__(self, url: str, username: str, password: str) -> None:
        self._client = DAVClient(url=url, username=username, password=password)

    def _calendar(self) -> caldav.Calendar:
        principal = self._client.principal()
        calendars = principal.calendars()
        if not calendars:
            raise RuntimeError("No calendars found for CalDAV account")
        return calendars[0]

    async def create_event(self, task: CalendarTask) -> str:
        """Add a VEVENT and return task.id as external_event_id."""
        self._calendar().save_event(_build_ical(task))
        return task.id

    async def update_event(self, task: CalendarTask, external_event_id: str) -> None:
        """Overwrite event by UID; recreate if externally deleted."""
        cal = self._calendar()
        results = cal.search(uid=external_event_id, event=True)
        if not results:
            cal.save_event(_build_ical(task))
            return
        event = results[0]
        event.data = _build_ical(task)
        event.save()

    async def delete_event(self, external_event_id: str) -> None:
        """Delete event by UID; silently succeeds if already gone."""
        results = self._calendar().search(uid=external_event_id, event=True)
        if results:
            results[0].delete()
```

- [ ] **Step 4: Run tests — expect all PASS**

```bash
cd backend && ./venv/bin/pytest app/tests/test_calendar_caldav.py -v
```

Expected: 6 tests, all `PASSED`

- [ ] **Step 5: Commit**

```bash
git add backend/app/calendar/caldav_backend.py \
        backend/app/calendar/types.py \
        backend/app/calendar/__init__.py \
        backend/app/tests/test_calendar_caldav.py
git commit -m "feat(backend): add CalDAV backend"
```

---

### Task 5: Google Calendar backend

**Files:**
- Create: `backend/app/calendar/google_backend.py`
- Create: `backend/app/tests/test_calendar_google.py`

- [ ] **Step 1: Write the failing tests**

```python
# backend/app/tests/test_calendar_google.py
"""Tests for GoogleCalendarBackend — googleapiclient mocked."""
from __future__ import annotations

from datetime import date
from unittest.mock import MagicMock, patch

import pytest
from googleapiclient.errors import HttpError

from app.calendar.google_backend import GoogleCalendarBackend
from app.calendar.types import CalendarTask


@pytest.fixture
def mock_service():
    svc = MagicMock()
    svc.events.return_value.insert.return_value.execute.return_value = {"id": "gcal-event-id"}
    svc.events.return_value.patch.return_value.execute.return_value = {}
    svc.events.return_value.delete.return_value.execute.return_value = {}
    return svc


@pytest.fixture
def backend(mock_service):
    with patch("app.calendar.google_backend._build_service", return_value=mock_service):
        b = GoogleCalendarBackend(credentials=MagicMock())
        b._service = mock_service
        yield b


@pytest.fixture
def task():
    return CalendarTask(id="task-1", title="Ship feature", scheduled_date=date(2026, 6, 1))


@pytest.mark.asyncio
async def test_create_event_returns_event_id(backend, mock_service, task):
    result = await backend.create_event(task)
    assert result == "gcal-event-id"
    mock_service.events.return_value.insert.assert_called_once()
    body = mock_service.events.return_value.insert.call_args.kwargs["body"]
    assert body["summary"] == "Ship feature"
    assert body["extendedProperties"]["private"]["jericho_task_id"] == "task-1"


@pytest.mark.asyncio
async def test_update_event_patches(backend, mock_service, task):
    await backend.update_event(task, "gcal-event-id")
    mock_service.events.return_value.patch.assert_called_once()
    call = mock_service.events.return_value.patch.call_args
    assert call.kwargs["eventId"] == "gcal-event-id"
    assert call.kwargs["body"]["summary"] == "Ship feature"


@pytest.mark.asyncio
async def test_delete_event(backend, mock_service):
    await backend.delete_event("gcal-event-id")
    mock_service.events.return_value.delete.assert_called_once_with(
        calendarId="primary", eventId="gcal-event-id"
    )


@pytest.mark.asyncio
async def test_delete_event_410_is_noop(backend, mock_service):
    resp = MagicMock()
    resp.status = 410
    mock_service.events.return_value.delete.return_value.execute.side_effect = HttpError(
        resp=resp, content=b"Gone"
    )
    await backend.delete_event("already-gone")  # must not raise


@pytest.mark.asyncio
async def test_delete_event_non_410_reraises(backend, mock_service):
    resp = MagicMock()
    resp.status = 403
    mock_service.events.return_value.delete.return_value.execute.side_effect = HttpError(
        resp=resp, content=b"Forbidden"
    )
    with pytest.raises(HttpError):
        await backend.delete_event("forbidden-event")
```

- [ ] **Step 2: Run — expect ImportError**

```bash
cd backend && ./venv/bin/pytest app/tests/test_calendar_google.py -v
```

Expected: `ImportError: cannot import name 'GoogleCalendarBackend'`

- [ ] **Step 3: Create `backend/app/calendar/google_backend.py`**

```python
"""
Google Calendar backend.

Every created event carries extendedProperties.private.jericho_task_id
so we can identify Jericho events regardless of title changes.
Uses events().patch() (not update()) to avoid clobbering user-added fields.
"""
from __future__ import annotations

from typing import Any

from googleapiclient.discovery import Resource, build  # type: ignore[import-untyped]
from googleapiclient.errors import HttpError  # type: ignore[import-untyped]

from app.calendar.types import CalendarTask

_CALENDAR_ID = "primary"
_JERICHO_TAG_KEY = "jericho_task_id"


def _build_service(credentials: Any) -> Resource:
    return build("calendar", "v3", credentials=credentials, cache_discovery=False)


def _event_body(task: CalendarTask, *, include_tag: bool = True) -> dict[str, Any]:
    date_str = task.scheduled_date.isoformat() if task.scheduled_date else None
    body: dict[str, Any] = {
        "summary": task.title,
        "start": {"date": date_str},
        "end": {"date": date_str},
    }
    if include_tag:
        body["extendedProperties"] = {"private": {_JERICHO_TAG_KEY: task.id}}
    return body


class GoogleCalendarBackend:
    def __init__(self, credentials: Any) -> None:
        self._service: Resource = _build_service(credentials)

    async def create_event(self, task: CalendarTask) -> str:
        """Insert a new event and return its Google event id."""
        result: dict[str, Any] = (
            self._service.events()
            .insert(calendarId=_CALENDAR_ID, body=_event_body(task, include_tag=True))
            .execute()
        )
        return result["id"]

    async def update_event(self, task: CalendarTask, external_event_id: str) -> None:
        """Patch title and dates; preserves any user-added fields."""
        patch_body: dict[str, Any] = {
            "summary": task.title,
            "start": {"date": task.scheduled_date.isoformat() if task.scheduled_date else None},
            "end": {"date": task.scheduled_date.isoformat() if task.scheduled_date else None},
        }
        self._service.events().patch(
            calendarId=_CALENDAR_ID, eventId=external_event_id, body=patch_body
        ).execute()

    async def delete_event(self, external_event_id: str) -> None:
        """Delete event; 410 Gone treated as success."""
        try:
            self._service.events().delete(
                calendarId=_CALENDAR_ID, eventId=external_event_id
            ).execute()
        except HttpError as exc:
            if exc.resp.status == 410:
                return
            raise
```

- [ ] **Step 4: Run tests — expect all PASS**

```bash
cd backend && ./venv/bin/pytest app/tests/test_calendar_google.py -v
```

Expected: 5 tests, all `PASSED`

- [ ] **Step 5: Commit**

```bash
git add backend/app/calendar/google_backend.py backend/app/tests/test_calendar_google.py
git commit -m "feat(backend): add Google Calendar backend"
```

---

### Task 6: Calendar router + integration tests

**Files:**
- Create: `backend/app/api/calendar.py`
- Create: `backend/app/tests/test_calendar_router.py`
- Modify: `backend/main.py`

- [ ] **Step 1: Write the failing integration tests**

```python
# backend/app/tests/test_calendar_router.py
"""Integration tests for /api/calendar routes."""
from __future__ import annotations

from unittest.mock import patch

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


def test_caldav_connect(client, auth_headers, db, user):
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


def test_disconnect_caldav(client, auth_headers, db, user):
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


def test_google_auth_redirects_when_configured(client, auth_headers):
    with patch.object(
        app.dependency_overrides.get(None, lambda: None) or (lambda: None),
        "__call__",
        return_value=None,
    ):
        with patch("app.api.calendar.settings") as mock_settings:
            mock_settings.google_client_id = "fake-client-id"
            mock_settings.google_client_secret = "fake-secret"
            mock_settings.google_oauth_redirect_uri = "http://localhost/callback"
            mock_settings.credential_encryption_key = "key"
            with patch("app.api.calendar._make_google_flow") as mock_flow_fn:
                mock_flow = mock_flow_fn.return_value
                mock_flow.authorization_url.return_value = ("https://accounts.google.com/auth?x=1", "state")
                resp = client.get(
                    "/api/calendar/google/auth",
                    headers=auth_headers,
                    follow_redirects=False,
                )
                assert resp.status_code in (302, 307)
```

- [ ] **Step 2: Run — expect ImportError on calendar router**

```bash
cd backend && ./venv/bin/pytest app/tests/test_calendar_router.py -v 2>&1 | head -20
```

Expected: `ImportError` or `ModuleNotFoundError` for `app.api.calendar`

- [ ] **Step 3: Create `backend/app/api/calendar.py`**

```python
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


# ---------------------------------------------------------------------------
# Google OAuth
# ---------------------------------------------------------------------------

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


# ---------------------------------------------------------------------------
# CalDAV
# ---------------------------------------------------------------------------

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


# ---------------------------------------------------------------------------
# Disconnect
# ---------------------------------------------------------------------------

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
```

- [ ] **Step 4: Register router in `backend/main.py`**

Add the import after the existing API imports:

```python
from app.api import auth, goals, blocks, sync, calendar
```

Add the router include after the existing `app.include_router` calls:

```python
app.include_router(calendar.router, prefix="/api")
```

- [ ] **Step 5: Run tests — expect all PASS**

```bash
cd backend && ./venv/bin/pytest app/tests/test_calendar_router.py -v
```

Expected: 6 tests, all `PASSED`

- [ ] **Step 6: Run the full backend test suite**

```bash
cd backend && ./venv/bin/pytest app/tests/ -v
```

Expected: all pre-existing tests still pass plus the new calendar tests.

- [ ] **Step 7: Commit**

```bash
git add backend/app/api/calendar.py \
        backend/app/tests/test_calendar_router.py \
        backend/main.py
git commit -m "feat(backend): add calendar router (CalDAV + Google OAuth)"
```

---

## Verification

After all tasks:

```bash
# All backend tests green
cd backend && ./venv/bin/pytest app/tests/ -v

# Server starts without import errors
cd backend && ./venv/bin/python -c "from main import app; print('OK')"

# Calendar endpoints appear in OpenAPI
cd backend && ./venv/bin/python -c "
from main import app
routes = [r.path for r in app.routes if hasattr(r, 'path') and 'calendar' in r.path]
print(routes)
"
# Expected: ['/api/calendar/google/auth', '/api/calendar/google/callback',
#            '/api/calendar/caldav/connect', '/api/calendar/{calendar_type}/disconnect']
```
