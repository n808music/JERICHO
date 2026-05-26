"""Tests for domain/capacity_profile.py — PRD §3.6."""
import pytest

from jyriko.constants import COLD_START_MULTIPLIERS, EWA_ALPHA
from jyriko.domain.capacity_profile import (
    apply_cold_start,
    compute_ewa,
    derive_capacity_from_signal,
)
from jyriko.domain.types import CapacityVector, MomentumSignal


# ── apply_cold_start ──────────────────────────────────────────────────────────

def test_cold_start_week1():
    assert apply_cold_start(1.0, 1) == pytest.approx(COLD_START_MULTIPLIERS[0])


def test_cold_start_week2():
    assert apply_cold_start(1.0, 2) == pytest.approx(COLD_START_MULTIPLIERS[1])


def test_cold_start_week3():
    assert apply_cold_start(1.0, 3) == pytest.approx(COLD_START_MULTIPLIERS[2])


def test_cold_start_exits_at_week4():
    # Week 4+ → multiplier = 1.0 (no cold-start adjustment)
    assert apply_cold_start(0.8, 4) == pytest.approx(0.8)


def test_cold_start_week10_unchanged():
    assert apply_cold_start(0.6, 10) == pytest.approx(0.6)


def test_cold_start_week0_unchanged():
    # Week 0 is invalid (pre-onboarding) — no adjustment
    assert apply_cold_start(0.8, 0) == pytest.approx(0.8)


# ── compute_ewa ───────────────────────────────────────────────────────────────

def test_ewa_with_default_alpha():
    # α=0.3: 0.3×new + 0.7×current
    result = compute_ewa(current=0.8, new_observation=0.5)
    assert result == pytest.approx(0.3 * 0.5 + 0.7 * 0.8)


def test_ewa_alpha_1_returns_new():
    assert compute_ewa(0.8, 0.5, alpha=1.0) == pytest.approx(0.5)


def test_ewa_alpha_0_returns_current():
    assert compute_ewa(0.8, 0.5, alpha=0.0) == pytest.approx(0.8)


def test_ewa_uses_module_default_alpha():
    assert EWA_ALPHA == pytest.approx(0.3)


# ── derive_capacity_from_signal ───────────────────────────────────────────────

_BASE_VECTOR = CapacityVector(values=(0.8, 0.8, 0.8, 0.8, 0.8, 0.6, 0.6))
_ALL_COMPLETE = tuple([1.0] * 7)
_HALF_COMPLETE = tuple([0.5] * 7)


def test_derive_returns_capacity_vector():
    result = derive_capacity_from_signal(
        _BASE_VECTOR, _ALL_COMPLETE, MomentumSignal.NEUTRAL, False
    )
    assert isinstance(result, CapacityVector)


def test_derive_neutral_full_completion_increases_capacity():
    result = derive_capacity_from_signal(
        _BASE_VECTOR, _ALL_COMPLETE, MomentumSignal.NEUTRAL, False
    )
    # All observed=1.0, scale=1.0 → EWA moves each day upward from its current value
    assert all(v > c for v, c in zip(result.values, _BASE_VECTOR.values))


def test_derive_heavy_signal_scales_down_observed():
    result = derive_capacity_from_signal(
        _BASE_VECTOR, _ALL_COMPLETE, MomentumSignal.HEAVY, False
    )
    # scale=0.85 → observed input = 0.85; still < 1.0 baseline may change direction
    neutral_result = derive_capacity_from_signal(
        _BASE_VECTOR, _ALL_COMPLETE, MomentumSignal.NEUTRAL, False
    )
    # Heavy signal produces lower capacity estimate than neutral
    assert all(r < n for r, n in zip(result.values, neutral_result.values))


def test_derive_capacity_match_bonus_adds_small_amount():
    without = derive_capacity_from_signal(
        _BASE_VECTOR, _HALF_COMPLETE, MomentumSignal.NEUTRAL, False
    )
    with_bonus = derive_capacity_from_signal(
        _BASE_VECTOR, _HALF_COMPLETE, MomentumSignal.NEUTRAL, True
    )
    assert all(b > w for b, w in zip(with_bonus.values, without.values))


def test_derive_wrong_completion_ratios_length_raises():
    with pytest.raises(ValueError, match="length 7"):
        derive_capacity_from_signal(
            _BASE_VECTOR, (1.0, 1.0), MomentumSignal.NEUTRAL, False
        )


def test_capacity_vector_wrong_length_raises():
    with pytest.raises(ValueError, match="exactly 7"):
        CapacityVector(values=(1.0, 1.0, 1.0))
