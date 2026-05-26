"""
Integration tests for BitNet LLM — only run when BITNET_BASE_URL is set.

These tests make real inference calls and verify structured output parsing.
Skip automatically in CI / offline environments.
"""
from __future__ import annotations

import os

import pytest

from jyriko.llm.adapter import call_llm
from jyriko.llm.registry import ModelProfile
from jyriko.llm.schemas import DecomposedGoal, NarrativeText

_SKIP_REASON = "BITNET_BASE_URL not set — skipping integration tests"

_BITNET_PROFILE = ModelProfile(
    model_id="bitnet-2b",
    inference_backend="bitnet",
    base_url=os.getenv("BITNET_BASE_URL", ""),
    context_window_tokens=2048,
    structured_output_reliability="low",
    reasoning_depth="low",
    recommended_pass_count=1,
    self_critique_required=False,
    timeout_threshold_seconds=30,
    latency_profile="fast",
    supports_tool_use=False,
)


@pytest.mark.skipif(not os.getenv("BITNET_BASE_URL"), reason=_SKIP_REASON)
def test_narrative_text_roundtrip():
    result = call_llm(
        "Write a brief motivational message about weekly progress. Under 50 words.",
        NarrativeText,
        _BITNET_PROFILE,
    )
    assert isinstance(result, NarrativeText)
    assert len(result.text) > 0


@pytest.mark.skipif(not os.getenv("BITNET_BASE_URL"), reason=_SKIP_REASON)
def test_decomposed_goal_roundtrip():
    result = call_llm(
        "Break down this goal into tasks: 'Read 12 books this year'. Provide 2-3 tasks.",
        DecomposedGoal,
        _BITNET_PROFILE,
    )
    assert isinstance(result, DecomposedGoal)
    assert len(result.goal_title) > 0
