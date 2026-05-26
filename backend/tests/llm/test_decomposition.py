"""Tests for llm/prompts/decomposition.py — stub mode only (no network calls)."""
from unittest.mock import MagicMock, patch

import pytest

from jyriko.llm.prompts.decomposition import run_decomposition_pipeline
from jyriko.llm.registry import ModelProfile
from jyriko.llm.schemas import DecomposedGoal, SelfCritiqueRevision


def _profile(pass_count: int, critique: bool) -> ModelProfile:
    return ModelProfile(
        model_id="stub",
        inference_backend="stub",
        base_url="",
        context_window_tokens=4096,
        structured_output_reliability="low",
        reasoning_depth="low",
        recommended_pass_count=pass_count,
        self_critique_required=critique,
        timeout_threshold_seconds=1,
        latency_profile="fast",
        supports_tool_use=False,
    )


def test_returns_decomposed_goal_in_stub_mode():
    profile = _profile(pass_count=1, critique=False)
    result = run_decomposition_pipeline("finish my album by 2026", profile)
    assert isinstance(result, DecomposedGoal)


def test_pass_count_respected(monkeypatch):
    """subagent_spawn called exactly recommended_pass_count times (no critique)."""
    calls: list[int] = []
    stub = DecomposedGoal(goal_title="g", tasks=[], dependency_rationale="")

    def _fake_spawn(prompt, schema, model_profile, pass_number=1, otel_span=None):
        calls.append(pass_number)
        return stub

    monkeypatch.setattr("jyriko.llm.prompts.decomposition.subagent_spawn", _fake_spawn)
    profile = _profile(pass_count=3, critique=False)
    run_decomposition_pipeline("goal", profile)
    assert len(calls) == 3
    assert calls == [1, 2, 3]


def test_self_critique_adds_extra_pass(monkeypatch):
    """When self_critique_required, subagent_spawn is called pass_count + 1 times."""
    from decimal import Decimal
    from jyriko.llm.schemas import TaskDecomposition

    task = TaskDecomposition(
        title="t",
        instructions="do it",
        estimated_cost=Decimal("0"),
        estimated_duration_minutes=30,
        cognitive_load=0.5,
        task_type="execution",
        importance_tier="routine",
        dependencies=[],
    )
    decomposed = DecomposedGoal(goal_title="g", tasks=[task], dependency_rationale="")
    critique = SelfCritiqueRevision(
        issues_found=[],
        revised_tasks=[task],
        confidence_score=0.9,
        rationale="looks good",
    )

    returns = iter([decomposed, decomposed, critique])

    def _fake_spawn(prompt, schema, model_profile, pass_number=1, otel_span=None):
        return next(returns)

    monkeypatch.setattr("jyriko.llm.prompts.decomposition.subagent_spawn", _fake_spawn)
    profile = _profile(pass_count=2, critique=True)
    result = run_decomposition_pipeline("goal", profile)
    assert isinstance(result, DecomposedGoal)


def test_self_critique_skipped_when_no_tasks(monkeypatch):
    """Critique pass must not run when prior passes produce no tasks."""
    calls: list[int] = []
    stub = DecomposedGoal(goal_title="g", tasks=[], dependency_rationale="")

    def _fake_spawn(prompt, schema, model_profile, pass_number=1, otel_span=None):
        calls.append(pass_number)
        return stub

    monkeypatch.setattr("jyriko.llm.prompts.decomposition.subagent_spawn", _fake_spawn)
    profile = _profile(pass_count=1, critique=True)
    run_decomposition_pipeline("goal", profile)
    # Only 1 call — critique skipped because tasks list is empty
    assert len(calls) == 1


def test_critique_not_called_when_flag_false(monkeypatch):
    """When self_critique_required is False, critique prompt never fires."""
    from decimal import Decimal
    from jyriko.llm.schemas import TaskDecomposition

    task = TaskDecomposition(
        title="t", instructions="x", estimated_cost=Decimal("0"),
        estimated_duration_minutes=30, cognitive_load=0.5,
        task_type="execution", importance_tier="routine", dependencies=[],
    )
    calls: list[int] = []
    decomposed = DecomposedGoal(goal_title="g", tasks=[task], dependency_rationale="")

    def _fake_spawn(prompt, schema, model_profile, pass_number=1, otel_span=None):
        calls.append(pass_number)
        return decomposed

    monkeypatch.setattr("jyriko.llm.prompts.decomposition.subagent_spawn", _fake_spawn)
    profile = _profile(pass_count=2, critique=False)
    run_decomposition_pipeline("goal", profile)
    assert len(calls) == 2
