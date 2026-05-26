from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from jyriko.db.json_adapter import safe_read_state, write_state

router = APIRouter(tags=["goals"])


class GoalPayload(BaseModel):
    text: str | None = None
    goal: str | None = None
    goalText: str | None = None


@router.post("/goals")
async def add_goal(payload: GoalPayload) -> JSONResponse:
    text = payload.text or payload.goal or payload.goalText
    if not text or not text.strip():
        raise HTTPException(
            status_code=400, detail={"error": "INVALID_GOAL", "message": "Goal text is required."}
        )

    text = text.strip()

    # Phase 1: replace with LLM-based goal validation
    if len(text) < 5:
        raise HTTPException(
            status_code=400,
            detail={
                "error": "INVALID_DEFINITE_GOAL",
                "message": "Goal must be specific, measurable, and time-bound.",
            },
        )

    result = await safe_read_state()
    if not result["ok"]:
        raise HTTPException(status_code=500, detail={"error": result["errorCode"]})

    current = result["state"]
    existing: list[str] = current.get("goals") or []

    # Deduplicate while preserving order (latest wins)
    with_new = [*existing, text]
    seen: set[str] = set()
    deduped: list[str] = []
    for g in reversed(with_new):
        if g not in seen:
            seen.add(g)
            deduped.insert(0, g)

    next_state = {**current, "goals": deduped}
    await write_state(next_state)
    return JSONResponse({"goals": deduped})


@router.post("/goals/decompose")
async def decompose_goal(
    goal_title: str,
    goal_description: str | None = None,
    request: Request = None,
) -> JSONResponse:
    """LLM-powered goal decomposition — PRD RECORD → REDUCE."""
    from jyriko.llm.prompts.decomposition import run_decomposition_pipeline
    from jyriko.llm.registry import get_model_profile

    from jyriko.config import get_settings

    registry = request.app.state.registry
    profile = get_model_profile(get_settings().default_model_id, registry)

    result = run_decomposition_pipeline(
        goal=goal_title,
        model_profile=profile,
    )

    return JSONResponse(
        {
            "goal": result.goal_title,
            "tasks": [t.model_dump() for t in result.tasks],
            "dependency_rationale": result.dependency_rationale,
        }
    )
