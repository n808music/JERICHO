"""
TDD: tests written BEFORE domain/reweave.py exists.
All tests here must fail (ImportError) until the implementation is written.
"""
from __future__ import annotations

from unittest.mock import MagicMock

import pytest

from jyriko.domain.reweave import (
    SundownInput,
    SundownOutput,
    compute_completion_ratio,
    run_reweave_pipeline,
    select_tone_branch,
)
from jyriko.domain.types import CapacityVector, MomentumSignal, TaskStatus

_BASE_CAPACITY = CapacityVector(values=(0.8, 0.8, 1.0, 0.8, 0.8, 0.4, 0.4))


def _sundown_input(
    completed: int = 5,
    total: int = 7,
    momentum: MomentumSignal = MomentumSignal.NEUTRAL,
    week_number: int = 4,
    completion_ratios_by_day: tuple[float, ...] = (0.8, 0.8, 1.0, 0.8, 0.8, 0.5, 0.5),
) -> SundownInput:
    return SundownInput(
        instance_id="inst-001",
        week_number=week_number,
        momentum_signal=momentum,
        completed_count=completed,
        total_scheduled=total,
        current_capacity=_BASE_CAPACITY,
        completion_ratios_by_day=completion_ratios_by_day,
    )


# ---------------------------------------------------------------------------
# compute_completion_ratio
# ---------------------------------------------------------------------------

def test_completion_ratio_all_completed() -> None:
    statuses = [TaskStatus.COMPLETED] * 5
    assert compute_completion_ratio(statuses) == 1.0


def test_completion_ratio_none_completed() -> None:
    statuses = [TaskStatus.MISSED, TaskStatus.RESCHEDULED, TaskStatus.VIABILITY_PAUSE]
    assert compute_completion_ratio(statuses) == 0.0


def test_completion_ratio_mixed() -> None:
    statuses = [
        TaskStatus.COMPLETED, TaskStatus.COMPLETED, TaskStatus.COMPLETED,
        TaskStatus.MISSED, TaskStatus.MISSED,
    ]
    assert compute_completion_ratio(statuses) == pytest.approx(0.6)


def test_completion_ratio_empty_returns_zero() -> None:
    assert compute_completion_ratio([]) == 0.0


# ---------------------------------------------------------------------------
# select_tone_branch — boundary conditions
# ---------------------------------------------------------------------------

def test_tone_above_70_is_momentum() -> None:
    assert select_tone_branch(0.71) == "momentum"


def test_tone_exactly_70_is_balanced() -> None:
    # >0.70 means 0.70 itself is NOT momentum
    assert select_tone_branch(0.70) == "balanced"


def test_tone_exactly_40_is_balanced() -> None:
    # 0.40–0.70 range: 0.40 is balanced
    assert select_tone_branch(0.40) == "balanced"


def test_tone_below_40_is_recalibration() -> None:
    assert select_tone_branch(0.39) == "recalibration"


def test_tone_zero_is_recalibration() -> None:
    assert select_tone_branch(0.0) == "recalibration"


def test_tone_one_is_momentum() -> None:
    assert select_tone_branch(1.0) == "momentum"


# ---------------------------------------------------------------------------
# SundownInput / SundownOutput — dataclass contracts
# ---------------------------------------------------------------------------

def test_sundown_input_is_frozen() -> None:
    inp = _sundown_input()
    with pytest.raises(Exception):
        inp.completed_count = 99  # type: ignore[misc]


def test_sundown_output_is_frozen() -> None:
    out = SundownOutput(
        tone_branch="momentum",
        completion_ratio=0.8,
        updated_capacity=_BASE_CAPACITY,
        narrative_summary="Great week.",
        capacity_update_narrative="Capacity updated.",
        capacity_match_prompt="Does this match how your week felt?",
    )
    with pytest.raises(Exception):
        out.tone_branch = "balanced"  # type: ignore[misc]


# ---------------------------------------------------------------------------
# run_reweave_pipeline
# ---------------------------------------------------------------------------

def test_pipeline_returns_sundown_output() -> None:
    mock_llm = MagicMock(return_value="LLM narrative")
    result = run_reweave_pipeline(_sundown_input(), mock_llm)
    assert isinstance(result, SundownOutput)


def test_pipeline_tone_branch_matches_completion_ratio() -> None:
    # 5/7 ≈ 0.714 → momentum
    mock_llm = MagicMock(return_value="narrative")
    result = run_reweave_pipeline(_sundown_input(completed=5, total=7), mock_llm)
    assert result.tone_branch == "momentum"
    assert result.completion_ratio == pytest.approx(5 / 7)


def test_pipeline_low_completion_produces_recalibration() -> None:
    mock_llm = MagicMock(return_value="narrative")
    result = run_reweave_pipeline(_sundown_input(completed=2, total=8), mock_llm)
    assert result.tone_branch == "recalibration"


def test_pipeline_calls_llm() -> None:
    mock_llm = MagicMock(return_value="generated text")
    run_reweave_pipeline(_sundown_input(), mock_llm)
    assert mock_llm.called


def test_pipeline_updated_capacity_differs_when_ewa_applied() -> None:
    """Week 4+ uses EWA — capacity should shift toward completion evidence."""
    mock_llm = MagicMock(return_value="narrative")
    inp = _sundown_input(
        completed=7, total=7,  # full completion — should push capacity up
        week_number=4,
        completion_ratios_by_day=(1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0),
    )
    result = run_reweave_pipeline(inp, mock_llm)
    # EWA(current=0.8, new=1.0, alpha=0.3) = 0.86 — higher than original 0.8
    assert all(v >= c for v, c in zip(result.updated_capacity.values, _BASE_CAPACITY.values))


def test_pipeline_heavy_signal_more_conservative_than_neutral() -> None:
    """HEAVY momentum signal → capacity update is lower than NEUTRAL for same data."""
    ratios = (0.9, 0.9, 0.9, 0.9, 0.9, 0.9, 0.9)
    mock_llm = MagicMock(return_value="narrative")

    heavy = run_reweave_pipeline(
        _sundown_input(completed=6, total=7, momentum=MomentumSignal.HEAVY,
                       completion_ratios_by_day=ratios),
        mock_llm,
    )
    neutral = run_reweave_pipeline(
        _sundown_input(completed=6, total=7, momentum=MomentumSignal.NEUTRAL,
                       completion_ratios_by_day=ratios),
        mock_llm,
    )
    # Every day's capacity under HEAVY must be ≤ NEUTRAL (same evidence, more caution)
    assert all(h <= n for h, n in zip(heavy.updated_capacity.values, neutral.updated_capacity.values))


def test_pipeline_capacity_match_prompt_always_present() -> None:
    mock_llm = MagicMock(return_value="narrative")
    result = run_reweave_pipeline(_sundown_input(), mock_llm)
    assert result.capacity_match_prompt
    assert len(result.capacity_match_prompt) > 10
