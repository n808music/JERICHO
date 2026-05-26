"""Tests for domain/briefing.py — Sunday Briefing pipeline."""

import pytest

from jyriko.domain.briefing import (
    BriefingInput,
    run_sunday_briefing,
)
from jyriko.domain.types import CapacityVector


def test_briefing_generates_capacity_snapshot():
    """Capacity snapshot is generated and contains day information."""
    input_data = BriefingInput(
        instance_id="test",
        week_number=4,
        current_capacity=CapacityVector(values=(0.8, 0.9, 0.7, 0.6, 0.8, 0.5, 0.5)),
        anchor_goals=["Finish podcast pilot"],
    )

    def mock_llm(prompt: str, tone: str) -> str:
        if "capacity snapshot" in prompt:
            return "Wednesday looks like your strongest day this week at 90% capacity."
        return "A balanced week ahead with moderate energy expected."

    result = run_sunday_briefing(input_data, mock_llm)

    assert result.capacity_snapshot is not None
    assert "Wednesday" in result.capacity_snapshot


def test_briefing_includes_anchor_goals_prompt():
    """Anchor goals prompt is included in output."""
    input_data = BriefingInput(
        instance_id="test",
        week_number=4,
        current_capacity=CapacityVector(values=(0.7,) * 7),
        anchor_goals=["Complete pilot episode"],
    )

    def mock_llm(prompt: str, tone: str) -> str:
        return "Test response"

    result = run_sunday_briefing(input_data, mock_llm)

    assert "anchor" in result.anchor_goals_prompt.lower()


def test_briefing_output_has_required_fields():
    """All required output fields are present."""
    input_data = BriefingInput(
        instance_id="test",
        week_number=1,
        current_capacity=CapacityVector(values=(0.5, 0.6, 0.7, 0.5, 0.6, 0.4, 0.4)),
        anchor_goals=[],
    )

    result = run_sunday_briefing(input_data, lambda p, t: "x")

    assert hasattr(result, "capacity_snapshot")
    assert hasattr(result, "week_preview")
    assert hasattr(result, "anchor_goals_prompt")
    assert hasattr(result, "tone")
    assert result.tone == "informational"
