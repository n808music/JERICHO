from fastapi import APIRouter, HTTPException
from fastapi.responses import JSONResponse

from jyriko.db.json_adapter import safe_read_state, write_state
from jyriko.domain.pipeline import run_pipeline

router = APIRouter(tags=["pipeline"])


def _resolve_goal_input(state: dict) -> dict:
    goals = state.get("goals") or []
    if goals:
        return {"goals": goals}
    # Fallback to empty goal input — Phase 1 replaces with LLM decomposition
    return {"goals": []}


def _resolve_identity(state: dict) -> dict:
    identity = state.get("identity") or {}
    return identity if identity else {}


@router.get("/pipeline")
async def get_pipeline() -> JSONResponse:
    result = await safe_read_state()
    if not result["ok"]:
        raise HTTPException(status_code=500, detail={"error": result["errorCode"]})

    state = result["state"]
    goal_input = _resolve_goal_input(state)
    identity = _resolve_identity(state)

    pipeline_result = run_pipeline(
        goal_input=goal_input,
        identity=identity,
        history=state.get("history") or [],
        tasks=state.get("tasks") or [],
        team=state.get("team"),
    )
    return JSONResponse({**pipeline_result, "state": state})


@router.post("/cycle/next")
async def cycle_next() -> JSONResponse:
    result = await safe_read_state()
    if not result["ok"]:
        raise HTTPException(status_code=500, detail={"error": result["errorCode"]})

    state = result["state"]
    goal_input = _resolve_goal_input(state)
    identity = _resolve_identity(state)

    try:
        pipeline_result = run_pipeline(
            goal_input=goal_input,
            identity=identity,
            history=state.get("history") or [],
            tasks=state.get("tasks") or [],
            team=state.get("team"),
        )
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail={"error": "PIPELINE_ERROR", "message": str(exc)},
        ) from exc

    next_state = {
        **state,
        "goals": state.get("goals") or [],
        "identity": pipeline_result.get("identity") or state.get("identity") or {},
        "history": pipeline_result.get("history") or state.get("history") or [],
        "tasks": pipeline_result.get("tasks") or [],
        "team": pipeline_result.get("team") or state.get("team") or {},
        "integrity": pipeline_result.get("integrity") or state.get("integrity") or {},
    }
    written = await write_state(next_state)
    return JSONResponse({"pipeline": pipeline_result, "state": written})
