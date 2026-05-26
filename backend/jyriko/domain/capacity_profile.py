"""Capacity profile engine — PRD §3.6."""
from __future__ import annotations

from jyriko.constants import COLD_START_MULTIPLIERS, COLD_START_WEEK_COUNT, EWA_ALPHA
from jyriko.domain.types import CapacityVector, MomentumSignal


def apply_cold_start(declared: float, week_number: int) -> float:
    """Scale declared capacity by cold-start multiplier; weeks beyond count pass through."""
    if week_number < 1 or week_number > COLD_START_WEEK_COUNT:
        return declared
    return declared * COLD_START_MULTIPLIERS[week_number - 1]


def compute_ewa(current: float, new_observation: float, alpha: float = EWA_ALPHA) -> float:
    return alpha * new_observation + (1.0 - alpha) * current


_SIGNAL_SCALE: dict[MomentumSignal, float] = {
    MomentumSignal.HEAVY: 0.85,
    MomentumSignal.NEUTRAL: 1.0,
    MomentumSignal.LIGHT: 1.10,
}

_CAPACITY_MATCH_BONUS: float = 0.05


def derive_capacity_from_signal(
    current_vector: CapacityVector,
    completion_ratios: tuple[float, ...],
    momentum_signal: MomentumSignal,
    capacity_match: bool,
) -> CapacityVector:
    """Update each day's capacity via EWA, scaled by momentum signal and match bonus."""
    if len(completion_ratios) != 7:
        raise ValueError(f"completion_ratios must have length 7, got {len(completion_ratios)}")
    scale = _SIGNAL_SCALE[momentum_signal]
    bonus = _CAPACITY_MATCH_BONUS if capacity_match else 0.0
    new_values = tuple(
        compute_ewa(current, observed * scale + bonus)
        for current, observed in zip(current_vector.values, completion_ratios)
    )
    return CapacityVector(values=new_values)
