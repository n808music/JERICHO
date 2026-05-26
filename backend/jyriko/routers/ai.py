"""
AI routes — /ai/* endpoints.
Mirror of the Node.js server's /ai/* handlers.
Phase 1: callLLM replaces stub responses.
"""
from typing import Any

from fastapi import APIRouter, HTTPException
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from jyriko.db.json_adapter import safe_read_state, write_state
from jyriko.domain.pipeline import run_pipeline
from jyriko.domain.scene_compiler import compile_scene_graph
from jyriko.domain.narrative_compiler import compile_narrative
from jyriko.domain.directive_planner import plan_directives
from jyriko.domain.reasoning_strip import build_reasoning_strip
from jyriko.domain.reasoning_chain import build_reasoning_chain
from jyriko.domain.multi_goal_evaluator import evaluate_multi_goal_portfolio
from jyriko.domain.integrity_deviation_engine import analyze_integrity_deviations
from jyriko.domain.ai_session import build_session_snapshot
from jyriko.domain.team_roles import filter_session_for_viewer
from jyriko.domain.llm_contract import get_llm_contract

router = APIRouter(tags=["ai"])


def _pipeline_with_state(state: dict[str, Any]) -> dict[str, Any]:
    """Run pipeline against current state, return pipeline result."""
    goals = state.get("goals") or []
    identity = state.get("identity") or {}
    return run_pipeline(
        goal_input={"goals": goals} if goals else {"goals": []},
        identity=identity,
        history=state.get("history") or [],
        tasks=state.get("tasks") or [],
        team=state.get("team"),
    )


def _full_session(state: dict[str, Any], result: dict[str, Any]) -> dict[str, Any]:
    """Build a full session snapshot — shared by /ai/session, /ai/llm-suggestions, etc."""
    scene = compile_scene_graph(result)
    narrative = compile_narrative(state, result)
    directives_result = plan_directives(state, result)
    reasoning = build_reasoning_strip(
        pipeline=result, narrative=narrative, directives=directives_result,
        scene=scene, state=state,
    )
    chain = build_reasoning_chain(reasoning=reasoning, pipeline=result, directives=directives_result)
    multi_goal = evaluate_multi_goal_portfolio(state=state, analysis={"pipeline": result}, meta={})
    integrity_deviations = analyze_integrity_deviations(
        result.get("history") or [],
        result.get("integrity") or {},
        (result.get("analysis") or {}).get("teamGovernance"),
    )
    return build_session_snapshot(
        state=state,
        pipeline_output=result,
        scene=scene,
        narrative=narrative,
        directives=directives_result,
        reasoning=reasoning,
        chain=chain,
        multi_goal=multi_goal,
        integrity_deviations=integrity_deviations,
    )


async def _get_state_or_raise() -> dict[str, Any]:
    result = await safe_read_state()
    if not result["ok"]:
        raise HTTPException(status_code=500, detail={"error": result["errorCode"]})
    return result["state"]


@router.get("/view")
async def ai_view() -> JSONResponse:
    state = await _get_state_or_raise()
    pipeline_result = _pipeline_with_state(state)
    scene = compile_scene_graph(pipeline_result)
    return JSONResponse({"scene": scene, "raw": pipeline_result})


@router.get("/llm-contract")
async def llm_contract() -> JSONResponse:
    contract = get_llm_contract()
    return JSONResponse({"version": contract.get("version"), "updatedAt": contract.get("updatedAt"), "contract": contract})


@router.get("/session/view")
async def session_view(viewerId: str | None = None) -> JSONResponse:
    state = await _get_state_or_raise()
    pipeline_result = _pipeline_with_state(state)
    session = _full_session(state, pipeline_result)
    filtered = filter_session_for_viewer(session, viewerId, session.get("teamRoles"), "team")
    return JSONResponse(filtered)


@router.get("/llm-suggestions")
async def llm_suggestions() -> JSONResponse:
    state = await _get_state_or_raise()
    pipeline_result = _pipeline_with_state(state)
    session = _full_session(state, pipeline_result)

    # Phase 1: replace with runSuggestions({ session }) via Ollama
    suggestions = {
        "model": "stub",
        "suggestions": [],
        "session_id": session.get("id"),
    }
    return JSONResponse(suggestions)


class CommandPayload(BaseModel):
    command: str
    args: dict[str, Any] = {}


@router.post("/command")
async def ai_command(payload: CommandPayload) -> JSONResponse:
    from jyriko.domain.ai_interpreter import interpret_command

    state = await _get_state_or_raise()
    try:
        next_state, effects = interpret_command(payload.model_dump(), state)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail={"error": "INVALID_COMMAND", "message": str(exc)}) from exc

    await write_state(next_state)
    pipeline_result = _pipeline_with_state(next_state)
    scene = compile_scene_graph(pipeline_result)
    return JSONResponse({"effects": effects, "scene": scene, "raw": pipeline_result})


@router.get("/narrative")
async def ai_narrative() -> JSONResponse:
    state = await _get_state_or_raise()
    pipeline_result = _pipeline_with_state(state)
    scene = compile_scene_graph(pipeline_result)
    narrative = compile_narrative(state, pipeline_result)
    return JSONResponse({"narrative": narrative, "scene": scene, "state": state})


@router.get("/directives")
async def ai_directives() -> JSONResponse:
    state = await _get_state_or_raise()
    pipeline_result = _pipeline_with_state(state)
    directives_result = plan_directives(state, pipeline_result)
    scene = compile_scene_graph(pipeline_result)
    return JSONResponse({
        "directives": directives_result.get("directives"),
        "summary": directives_result.get("summary"),
        "scene": scene,
        "raw": pipeline_result,
    })


@router.get("/session")
async def ai_session() -> JSONResponse:
    from datetime import datetime, timezone

    state = await _get_state_or_raise()
    pipeline_result = _pipeline_with_state(state)
    session = _full_session(state, pipeline_result)
    # Phase 2: replace with buildTeamHud(session) port
    team_hud: dict[str, Any] = {}
    timestamp = datetime.now(timezone.utc).isoformat()
    return JSONResponse({"timestamp": timestamp, "session": session, "teamHud": team_hud})
