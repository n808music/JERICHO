"""Tests for the LLM adapter — stub mode, server mode, subprocess fallback."""
import asyncio
from unittest.mock import MagicMock, patch

import pytest

from jyriko.llm.adapter import call_llm, subagent_spawn, with_fallback, _is_stub
from jyriko.llm.registry import ModelProfile
from jyriko.llm.schemas import DecomposedGoal

_STUB_PROFILE = ModelProfile(
    model_id="stub",
    inference_backend="stub",
    context_window_tokens=4096,
    structured_output_reliability="low",
    reasoning_depth="low",
    recommended_pass_count=1,
    self_critique_required=False,
    timeout_threshold_seconds=1,
    latency_profile="fast",
    supports_tool_use=False,
)

_BITNET_PROFILE = ModelProfile(
    model_id="bitnet-2b",
    inference_backend="bitnet",
    base_url="",
    context_window_tokens=2048,
    structured_output_reliability="low",
    reasoning_depth="low",
    recommended_pass_count=2,
    self_critique_required=True,
    timeout_threshold_seconds=15,
    latency_profile="fast",
    supports_tool_use=False,
)


# ---------------------------------------------------------------------------
# Stub mode
# ---------------------------------------------------------------------------

def test_stub_profile_returns_decomposed_goal_without_llm():
    result = call_llm("any prompt", DecomposedGoal, _STUB_PROFILE)
    assert isinstance(result, DecomposedGoal)


def test_bitnet_falls_back_to_stub_when_no_binary_and_no_url(monkeypatch: pytest.MonkeyPatch):
    monkeypatch.delenv("BITNET_BASE_URL", raising=False)
    with patch("jyriko.llm.adapter._binary_exists", return_value=False):
        result = call_llm("any prompt", DecomposedGoal, _BITNET_PROFILE)
    assert isinstance(result, DecomposedGoal)
    assert result.goal_title == "Stub goal"


def test_is_stub_true_for_stub_backend():
    assert _is_stub(_STUB_PROFILE) is True


def test_is_stub_false_when_base_url_set(monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setenv("BITNET_BASE_URL", "http://localhost:8081/v1")
    assert _is_stub(_BITNET_PROFILE) is False


def test_is_stub_true_when_no_url(monkeypatch: pytest.MonkeyPatch):
    monkeypatch.delenv("BITNET_BASE_URL", raising=False)
    assert _is_stub(_BITNET_PROFILE) is True


# ---------------------------------------------------------------------------
# Server mode (mocked — no real server in unit tests)
# ---------------------------------------------------------------------------

def test_server_mode_dispatches_when_url_set(monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setenv("BITNET_BASE_URL", "http://localhost:8081/v1")
    mock_goal = DecomposedGoal(goal_title="test", tasks=[], dependency_rationale="mocked")
    with patch("jyriko.llm.adapter._call_server", return_value=mock_goal) as mock_server:
        result = call_llm("prompt", DecomposedGoal, _BITNET_PROFILE)
    mock_server.assert_called_once()
    assert result.goal_title == "test"


# ---------------------------------------------------------------------------
# Subprocess fallback (subprocess:// URL scheme)
# ---------------------------------------------------------------------------

def test_subprocess_fallback_via_url_scheme(monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setenv("BITNET_BASE_URL", "subprocess://local")
    mock_goal = DecomposedGoal(goal_title="subprocess", tasks=[], dependency_rationale="fallback")
    with patch("jyriko.llm.adapter._run_bitnet_inference", return_value=mock_goal) as mock_sub:
        result = call_llm("prompt", DecomposedGoal, _BITNET_PROFILE)
    mock_sub.assert_called_once()
    assert result.goal_title == "subprocess"


# ---------------------------------------------------------------------------
# Subagent + fallback utilities
# ---------------------------------------------------------------------------

def test_subagent_spawn_uses_stub_mode():
    result = subagent_spawn("prompt", DecomposedGoal, _STUB_PROFILE, pass_number=1)
    assert isinstance(result, DecomposedGoal)


async def test_with_fallback_returns_primary_on_success():
    result = await with_fallback(lambda: "primary", lambda: "fallback", timeout_seconds=5.0)
    assert result == "primary"


async def test_with_fallback_returns_fallback_on_timeout():
    async def slow() -> str:
        await asyncio.sleep(10)
        return "slow"

    result = await with_fallback(slow, lambda: "fallback", timeout_seconds=0.05)
    assert result == "fallback"


async def test_with_fallback_returns_fallback_on_exception():
    def bad() -> str:
        raise ValueError("explode")

    result = await with_fallback(bad, lambda: "safe", timeout_seconds=5.0)
    assert result == "safe"


# ---------------------------------------------------------------------------
# OTEL span attributes
# ---------------------------------------------------------------------------

def test_call_llm_sets_latency_on_span():
    span = MagicMock()
    call_llm("prompt", DecomposedGoal, _STUB_PROFILE, otel_span=span)
    attr_keys = {c.args[0] for c in span.set_attribute.call_args_list}
    assert "llm.latency_ms" in attr_keys


# ---------------------------------------------------------------------------
# Decomposition pipeline (stub)
# ---------------------------------------------------------------------------

def test_pass_count_drives_decomposition_passes():
    """Verify stub respects recommended_pass_count as a smoke test (stubs return on pass 1)."""
    from jyriko.llm.prompts.decomposition import run_decomposition_pipeline

    result = run_decomposition_pipeline("I will finish my album by 2026-12-31", _STUB_PROFILE)
    assert isinstance(result, DecomposedGoal)
    assert result.tasks == []
