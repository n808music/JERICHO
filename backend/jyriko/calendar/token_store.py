"""
AES-256-GCM credential encryption + Supabase user_credentials repository.

GCM is authenticated encryption — decryption fails loudly if tampered with.
A fresh 12-byte random nonce is prepended to every ciphertext; never reused.
"""
from __future__ import annotations

import hashlib
import json
import os
from typing import Any

from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from supabase import AsyncClient

_NONCE_BYTES = 12  # 96-bit nonce — NIST recommendation for AES-GCM


def _derive_key(raw_key: str) -> bytes:
    """SHA-256 of the raw key string → 32-byte AES-256 key."""
    return hashlib.sha256(raw_key.encode()).digest()


def encrypt_payload(data: dict[str, Any], raw_key: str) -> bytes:
    """Encrypt *data* to AES-256-GCM ciphertext. Returns nonce ‖ ciphertext."""
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


CredentialType = str  # "google" | "caldav"


async def save_credentials(
    client: AsyncClient,
    instance_id: str,
    credential_type: CredentialType,
    payload: dict[str, Any],
    raw_key: str,
) -> None:
    """Upsert encrypted credential payload for (instance_id, credential_type)."""
    encrypted = encrypt_payload(payload, raw_key)
    await (
        client.table("user_credentials")
        .upsert(
            {
                "instance_id": instance_id,
                "credential_type": credential_type,
                "encrypted_payload": {"hex": encrypted.hex()},
            },
            on_conflict="instance_id,credential_type",
        )
        .execute()
    )


async def load_credentials(
    client: AsyncClient,
    instance_id: str,
    credential_type: CredentialType,
    raw_key: str,
) -> dict[str, Any] | None:
    """Return decrypted credentials or None if not found."""
    response = await (
        client.table("user_credentials")
        .select("encrypted_payload")
        .eq("instance_id", instance_id)
        .eq("credential_type", credential_type)
        .maybe_single()
        .execute()
    )
    if response.data is None:
        return None
    blob = bytes.fromhex(response.data["encrypted_payload"]["hex"])
    return decrypt_payload(blob, raw_key)


async def delete_credentials(
    client: AsyncClient,
    instance_id: str,
    credential_type: CredentialType,
) -> None:
    """Remove credential row for (instance_id, credential_type)."""
    await (
        client.table("user_credentials")
        .delete()
        .eq("instance_id", instance_id)
        .eq("credential_type", credential_type)
        .execute()
    )
