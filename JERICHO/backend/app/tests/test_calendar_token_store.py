import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.core.database import Base
from app.models.user import User
from app.models.user_calendar import UserCalendarCredential

# Import all models so SQLAlchemy mapper resolves all relationships
import app.models.master_plan  # noqa: F401
import app.models.core_mission_contract  # noqa: F401
import app.models.user_state  # noqa: F401


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
