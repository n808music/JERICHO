"""Tests for gap_analysis — mirrors tests/core/gap-analysis.test.js."""
import pytest

from jyriko.domain.gap_analysis import compute_capability_gaps, rank_capability_gaps


def test_compute_gaps_unknown_capability_defaults_to_3():
    requirements = [{"id": "r1", "domain": "Execution", "capability": "discipline", "targetLevel": 8, "weight": 1.0}]
    gaps = compute_capability_gaps([], requirements)
    assert len(gaps) == 1
    assert gaps[0]["currentLevel"] == 3
    assert gaps[0]["rawGap"] == 5  # 8 - 3


def test_compute_gaps_uses_state_level():
    state = [{"domain": "Execution", "capability": "discipline", "level": 6}]
    requirements = [{"id": "r1", "domain": "Execution", "capability": "discipline", "targetLevel": 8, "weight": 0.5}]
    gaps = compute_capability_gaps(state, requirements)
    assert gaps[0]["currentLevel"] == 6
    assert gaps[0]["rawGap"] == 2
    assert gaps[0]["weightedGap"] == pytest.approx(1.0)


def test_rank_gaps_orders_by_weighted_gap_desc():
    gaps = [
        {"domain": "A", "capability": "x", "weightedGap": 1.0},
        {"domain": "B", "capability": "y", "weightedGap": 3.0},
        {"domain": "C", "capability": "z", "weightedGap": 2.0},
    ]
    ranked = rank_capability_gaps(gaps)
    assert ranked[0]["weightedGap"] == 3.0
    assert ranked[0]["rank"] == 1
    assert ranked[2]["rank"] == 3


def test_compute_gaps_empty_inputs():
    assert compute_capability_gaps([], []) == []
    assert compute_capability_gaps(None, None) == []  # type: ignore[arg-type]


def test_compute_gaps_clamps_state_level():
    state = [{"domain": "X", "capability": "y", "level": 15}]  # >10, should clamp to 10
    req = [{"id": "r1", "domain": "X", "capability": "y", "targetLevel": 8, "weight": 1.0}]
    gaps = compute_capability_gaps(state, req)
    assert gaps[0]["currentLevel"] == 10
    assert gaps[0]["rawGap"] == 0  # target < current after clamp
