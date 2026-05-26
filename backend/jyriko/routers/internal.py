from fastapi import APIRouter, HTTPException
from fastapi.responses import JSONResponse

from jyriko.db.json_adapter import safe_read_state

router = APIRouter(tags=["internal"])


@router.get("/diagnostics")
async def get_diagnostics() -> JSONResponse:
    result = await safe_read_state()
    if not result["ok"]:
        raise HTTPException(status_code=500, detail={"error": result["errorCode"]})

    state = result["state"]
    tasks = state.get("tasks") or []
    history = state.get("history") or []
    integrity = state.get("integrity") or {}

    # Phase 2+: replace with computeAdvisoryDiagnostics() port
    diagnostics = {
        "taskCount": len(tasks),
        "historyCount": len(history),
        "pendingTasks": sum(1 for t in tasks if t.get("status") == "pending"),
        "completedTasks": sum(1 for t in tasks if t.get("status") == "completed"),
        "missedTasks": sum(1 for t in tasks if t.get("status") == "missed"),
        "integrityScore": integrity.get("score", 0),
        "goalCount": len(state.get("goals") or []),
    }
    return JSONResponse(diagnostics)
