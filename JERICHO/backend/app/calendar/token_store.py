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
