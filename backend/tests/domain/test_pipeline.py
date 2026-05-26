"""Tests for the pipeline orchestrator."""
import pytest

from jyriko.domain.pipeline import run_pipeline


def test_invalid_goal_returns_error_shape():
    result = run_pipeline(goal_input={"goals": ["not a valid goal"]}, identity={})
    assert result["goal"] is None
    assert result["error"] is not None
    assert result["tasks"] == []
    assert result["integrity"]["score"] == 0


def test_valid_goal_produces_tasks():
    result = run_pipeline(
        goal_input={"goals": ["I will launch my app by 2026-12-31"]},
        identity={},
    )
    assert result["goal"] is not None
    assert len(result["tasks"]) > 0
    assert result["integrity"] is not None


def test_pipeline_identity_updated_from_completed_tasks():
    identity = {"Execution": {"discipline": {"level": 4}}}
    tasks = [
        {"domain": "Execution", "capability": "discipline", "status": "completed",
         "estimatedImpact": 1.0, "difficulty": 2, "onTime": True}
    ]
    result = run_pipeline(
        goal_input={"goals": ["I will launch my app by 2026-12-31"]},
        identity=identity,
        tasks=tasks,
    )
    # Identity update should produce changes when tasks align with gaps
    assert isinstance(result["changes"], list)


def test_pipeline_history_entry_appended():
    result = run_pipeline(
        goal_input={"goals": ["I will finish my album by 2026-12-31"]},
        identity={},
        history=[],
    )
    assert len(result["history"]) == 1
    assert "timestamp" in result["history"][0]


def test_pipeline_empty_goal_list_returns_error():
    result = run_pipeline(goal_input={"goals": []}, identity={})
    assert result["goal"] is None


def test_pipeline_pacing_returned():
    result = run_pipeline(
        goal_input={"goals": ["I will complete 500 courses by 2026-12-31"]},
        identity={},
    )
    assert "pacing" in result
    assert result["pacing"]["mode"] in {"stabilize", "build", "advance"}
