"""
Pydantic output schemas for LLM-structured responses.

These define the exact shape the LLM must produce. They also inform the
Phase 2 tasks table structure — do not change field names without a migration.
"""
from __future__ import annotations

from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, Field


class TaskDecomposition(BaseModel):
    title: str
    instructions: str
    estimated_cost: Decimal
    estimated_duration_minutes: int
    cognitive_load: float = Field(ge=0.0, le=1.0)
    task_type: Literal["decision", "research", "creative", "execution", "administrative"]
    importance_tier: Literal["hard_deadline", "routine", "flexible"]
    dependencies: list[str]


class DecomposedGoal(BaseModel):
    goal_title: str
    tasks: list[TaskDecomposition]
    dependency_rationale: str


class SelfCritiqueRevision(BaseModel):
    """Reviews a decomposition for issues and provides revised tasks."""
    issues_found: list[str]
    revised_tasks: list[TaskDecomposition]
    confidence_score: float = Field(ge=0.0, le=1.0)
    rationale: str


class NarrativeText(BaseModel):
    """Short plain-language narrative produced by a lightweight model."""
    text: str = Field(description="Plain language narrative, under 100 words.")
