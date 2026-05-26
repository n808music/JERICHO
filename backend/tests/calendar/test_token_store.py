"""Tests for AES-256-GCM token store encrypt/decrypt."""
import pytest

from jyriko.calendar.token_store import decrypt_payload, encrypt_payload


_KEY = "test-secret-key"
_PAYLOAD = {"token": "abc123", "refresh_token": "xyz789", "scopes": ["calendar.events"]}


def test_encrypt_returns_bytes() -> None:
    blob = encrypt_payload(_PAYLOAD, _KEY)
    assert isinstance(blob, bytes)
    # 12-byte nonce + at least 1 byte ciphertext + 16-byte GCM tag
    assert len(blob) > 28


def test_roundtrip() -> None:
    blob = encrypt_payload(_PAYLOAD, _KEY)
    result = decrypt_payload(blob, _KEY)
    assert result == _PAYLOAD


def test_different_nonce_each_call() -> None:
    """Each encrypt call produces a unique ciphertext (random nonce)."""
    blob1 = encrypt_payload(_PAYLOAD, _KEY)
    blob2 = encrypt_payload(_PAYLOAD, _KEY)
    assert blob1 != blob2


def test_wrong_key_raises() -> None:
    blob = encrypt_payload(_PAYLOAD, _KEY)
    with pytest.raises(Exception):  # cryptography.exceptions.InvalidTag
        decrypt_payload(blob, "wrong-key")


def test_tampered_ciphertext_raises() -> None:
    blob = bytearray(encrypt_payload(_PAYLOAD, _KEY))
    blob[-1] ^= 0xFF  # flip last byte (GCM tag)
    with pytest.raises(Exception):
        decrypt_payload(bytes(blob), _KEY)


def test_nested_payload_roundtrip() -> None:
    nested = {"a": {"b": [1, 2, 3]}, "c": None}
    assert decrypt_payload(encrypt_payload(nested, _KEY), _KEY) == nested
