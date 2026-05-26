from fastapi import APIRouter
from fastapi.responses import JSONResponse

from jyriko.db.json_adapter import safe_read_state
from jyriko.domain.pipeline import run_pipeline
from jyriko.domain.scene_compiler import compile_scene_graph
from jyriko.domain.narrative_compiler import compile_narrative
from jyriko.domain.directive_planner import plan_directives
from jyriko.domain.reasoning_strip import build_reasoning_strip
from jyriko.domain.reasoning_chain import build_reasoning_chain
from jyriko.domain.multi_goal_evaluator import evaluate_multi_goal_portfolio
from jyriko.domain.integrity_deviation_engine import analyze_integrity_deviations
from jyriko.domain.ai_session import build_session_snapshot
from jyriko.domain.team_hud import build_team_export

router = APIRouter(tags=["team"])


@router.get("/export")
async def team_export() -> JSONResponse:
    result = await safe_read_state()
    if not result["ok"]:
        from fastapi import HTTPException
        raise HTTPException(status_code=500, detail={"error": result["errorCode"]})

    state = result["state"]
    goals = state.get("goals") or []
    identity = state.get("identity") or {}
    pipeline_result = run_pipeline(
        goal_input={"goals": goals} if goals else {"goals": []},
        identity=identity,
        history=state.get("history") or [],
        tasks=state.get("tasks") or [],
        team=state.get("team"),
    )
    scene = compile_scene_graph(pipeline_result)
    narrative = compile_narrative(state, pipeline_result)
    directives_result = plan_directives(state, pipeline_result)
    reasoning = build_reasoning_strip(
        pipeline=pipeline_result, narrative=narrative,
        directives=directives_result, scene=scene, state=state,
    )
    chain = build_reasoning_chain(reasoning=reasoning, pipeline=pipeline_result, directives=directives_result)
    multi_goal = evaluate_multi_goal_portfolio(state=state, analysis={"pipeline": pipeline_result}, meta={})
    integrity_deviations = analyze_integrity_deviations(
        pipeline_result.get("history") or [],
        pipeline_result.get("integrity") or {},
        None,
    )
    session = build_session_snapshot(
        state=state, pipeline_output=pipeline_result, scene=scene,
        narrative=narrative, directives=directives_result,
        reasoning=reasoning, chain=chain, multi_goal=multi_goal,
        integrity_deviations=integrity_deviations,
    )
    export_payload = build_team_export(session)
    return JSONResponse({"export": export_payload})
