from fastapi import APIRouter
from fastapi.responses import JSONResponse

from jyriko.db.json_adapter import safe_read_state

router = APIRouter(tags=["health"])


@router.get("/health")
async def health() -> JSONResponse:
    return JSONResponse({
        "status": "alive",
        "routes": [
            "/pipeline",
            "/state",
            "/goals",
            "/identity",
            "/tasks",
            "/internal/diagnostics",
            "/api/health",
        ],
    })


@router.get("/api/health")
async def api_health() -> JSONResponse:
    result = await safe_read_state()
    if not result["ok"]:
        return JSONResponse(
            {"error": result["errorCode"], "reason": result["reason"]},
            status_code=500,
        )
    # Phase 2: replace with aggregateHealthCheck(state) from domain/validation/health.py
    state = result["state"]
    tasks = state.get("tasks") or []
    return JSONResponse({
        "ok": True,
        "taskCount": len(tasks),
        "goalCount": len(state.get("goals") or []),
        "integrityScore": (state.get("integrity") or {}).get("score", 0),
    })
