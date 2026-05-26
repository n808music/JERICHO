"""Core domain types — enums and immutable dataclasses.

No I/O, no side effects. All business objects are frozen dataclasses so
they can be safely passed between pure functions without mutation risk.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date
from enum import Enum


class TaskStatus(str, Enum):
    """Task lifecycle states — stored as strings for DB serialisation."""
    CREATED = "created"
    SCHEDULED = "scheduled"
    IN_WINDOW = "in_window"
    COMPLETED = "completed"
    MISSED = "missed"
    RESCHEDULED = "rescheduled"
    VIABILITY_PAUSE = "viability_pause"
    DECOMPOSED = "decomposed"
    DATE_EXTENDED = "date_extended"
    ARCHIVED = "archived"


class DependencyType(str, Enum):
    """Strength of task ordering relationship."""
    BLOCKING = "blocking"
    PREFERRED_ORDER = "preferred_order"
    PARALLEL_OK = "parallel_ok"


class MomentumSignal(str, Enum):
    """User-reported workload perception from Saturday Sundown."""
    HEAVY = "heavy"
    NEUTRAL = "neutral"
    LIGHT = "light"


class ToneBranch(str, Enum):
    """Narrative tone selected by the Reweave pipeline."""
    MOMENTUM = "momentum"
    BALANCED = "balanced"
    RECALIBRATION = "recalibration"


@dataclass(frozen=True)
class CapacityVector:
    """7-slot immutable capacity vector — one slot per day of week (Mon–Sun)."""
    values: tuple[float, ...]

    def __post_init__(self) -> None:
        if len(self.values) != 7:
            raise ValueError(f"CapacityVector requires exactly 7 values, got {len(self.values)}")


@dataclass(frozen=True)
class Task:
    """Immutable task value object used throughout the domain layer."""
    id: str
    goal_id: str
    title: str
    status: str  # TaskStatus.value
    task_type: str
    importance_tier: str
    estimated_duration_minutes: int
    cognitive_load: float
    deferral_count: int
    dependencies: tuple[str, ...] = field(default_factory=tuple)
    deadline: date | None = None
    scheduled_date: date | None = None
    instance_id: str = ""


@dataclass(frozen=True)
class Goal:
    """Immutable goal value object."""
    id: str
    title: str
    instance_id: str


@dataclass(frozen=True)
class PlacementResult:
    """Result of placing one task into a schedule slot."""
    task_id: str
    scheduled_date: date
    load_ratio: float
    was_deferred: bool
