"""Tests for domain/cognitive_load.py — PRD §3.3."""
import pytest

from jyriko.domain.cognitive_load import compute_cognitive_load


def test_short_no_deps_no_override():
    # baseline=0.5, duration≤30 → mult=1.0, no_dependents → mult=1.0, no override
    result = compute_cognitive_load(0.5, 30, 0)
    assert result == pytest.approx(0.5)


def test_medium_duration_multiplier():
    # 45 min → "31_to_60" → 1.2
    result = compute_cognitive_load(0.5, 45, 0)
    assert result == pytest.approx(0.5 * 1.2)


def test_long_duration_multiplier():
    # 75 min → "61_to_90" → 1.5
    result = compute_cognitive_load(0.4, 75, 0)
    assert result == pytest.approx(0.4 * 1.5)


def test_gt90_duration_multiplier():
    # 120 min → "gt_90" → 1.8
    result = compute_cognitive_load(0.4, 120, 0)
    assert result == pytest.approx(0.4 * 1.8)


def test_one_dependent_multiplier():
    # 1 dependent → "one_to_two" → 1.25
    result = compute_cognitive_load(0.4, 30, 1)
    assert result == pytest.approx(0.4 * 1.0 * 1.25)


def test_three_plus_dependents_multiplier():
    # 3 dependents → "three_plus" → 1.5
    result = compute_cognitive_load(0.4, 30, 3)
    assert result == pytest.approx(0.4 * 1.0 * 1.5)


def test_user_override_adds_bonus():
    from jyriko.constants import USER_OVERRIDE_LOAD_BONUS
    result = compute_cognitive_load(0.4, 30, 0, user_override=True)
    assert result == pytest.approx(0.4 + USER_OVERRIDE_LOAD_BONUS)


def test_result_clamped_to_one():
    # High baseline + long duration + many deps + override should clamp to 1.0
    result = compute_cognitive_load(1.0, 120, 5, user_override=True)
    assert result == pytest.approx(1.0)


def test_result_never_negative():
    result = compute_cognitive_load(0.0, 30, 0)
    assert result == pytest.approx(0.0)
