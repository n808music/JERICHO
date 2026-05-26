from typing import Any

from fastapi import APIRouter, HTTPException
from fastapi.responses import JSONResponse
from pydantic import BaseModel, field_validator

from jyriko.db.json_adapter import safe_read_state, write_state

router = APIRouter(tags=["identity"])


def _clamp_level(value: Any) -> float | None:
    """Return level clamped to [0, 10], or None if invalid."""
    try:
        n = float(value)
    except (TypeError, ValueError):
        return None
    if n < 0 or n > 10:
        return None
    return round(n, 2)


class IdentityPayload(BaseModel):
    domain: str
    capability: str
    level: Any

    @field_validator("domain", "capability")
    @classmethod
    def must_be_string(cls, v: Any) -> str:
        if not isinstance(v, str):
            raise ValueError("must be a string")
        return v


class IdentityBatchPayload(BaseModel):
    updates: dict[str, Any]


@router.post("/identity")
async def set_identity(payload: IdentityPayload) -> JSONResponse:
    level = _clamp_level(payload.level)
    if level is None:
        raise HTTPException(
            status_code=400,
            detail={"error": "INVALID_IDENTITY_LEVEL", "message": "level must be numeric between 0 and 10"},
        )

    result = await safe_read_state()
    if not result["ok"]:
        raise HTTPException(status_code=500, detail={"error": result["errorCode"]})

    current = result["state"]
    identity: dict[str, Any] = dict(current.get("identity") or {})
    identity[payload.domain] = dict(identity.get(payload.domain) or {})
    identity[payload.domain][payload.capability] = {"level": level}

    await write_state({**current, "identity": identity})
    return JSONResponse({"status": "ok"})


@router.patch("/identity")
async def batch_update_identity(payload: IdentityBatchPayload) -> JSONResponse:
    updates = payload.updates
    if not updates:
        raise HTTPException(
            status_code=400,
            detail={"error": "INVALID_IDENTITY", "message": "Identity updates are required."},
        )

    validated: dict[str, float] = {}
    for cap_id, value in updates.items():
        if not isinstance(cap_id, str) or "." not in cap_id:
            raise HTTPException(
                status_code=400,
                detail={"error": "INVALID_IDENTITY", "message": "capability ids must be domain.capability"},
            )
        level = _clamp_level(value)
        if level is None:
            raise HTTPException(
                status_code=400,
                detail={"error": "INVALID_IDENTITY_LEVEL", "message": "levels must be numeric between 0 and 10"},
            )
        validated[cap_id] = level

    result = await safe_read_state()
    if not result["ok"]:
        raise HTTPException(status_code=500, detail={"error": result["errorCode"]})

    current = result["state"]
    identity: dict[str, Any] = dict(current.get("identity") or {})
    for cap_id, level in validated.items():
        domain, capability = cap_id.split(".", 1)
        identity[domain] = dict(identity.get(domain) or {})
        identity[domain][capability] = {"level": level}

    written = await write_state({**current, "identity": identity})
    return JSONResponse({"identity": written.get("identity") or {}})
