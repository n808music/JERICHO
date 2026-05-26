"""Tests for validate_goal — mirrors tests/core/validate-goal.test.js."""
import pytest

from jyriko.domain.validate_goal import validate_goal


def test_valid_goal_returns_parsed_fields():
    result = validate_goal("I will launch my app by 2026-12-31")
    assert result["valid"] is True
    assert result["goal"]["outcome"] == "I will launch my app"
    assert "2026-12-31" in result["goal"]["deadline"]
    assert result["goal"]["type"] == "event"


def test_missing_by_keyword_fails():
    result = validate_goal("I will finish this project")
    assert result["valid"] is False
    assert result["error"] == "missing_by_keyword"


def test_non_string_fails():
    result = validate_goal(None)  # type: ignore[arg-type]
    assert result["valid"] is False


def test_outcome_must_start_with_i_will():
    result = validate_goal("Finish my book by 2026-06-01")
    assert result["valid"] is False
    assert result["error"] == "invalid_outcome"


def test_compound_goal_rejected():
    result = validate_goal("I will launch and market my app by 2026-12-31")
    assert result["valid"] is False
    assert result["error"] == "compound_goal"


def test_vague_outcome_rejected():
    result = validate_goal("I will improve my skills by 2026-12-31")
    assert result["valid"] is False
    assert result["error"] == "vague_outcome"


def test_ambiguous_deadline_rejected():
    result = validate_goal("I will finish my album by next year")
    assert result["valid"] is False
    assert result["error"] == "ambiguous_deadline"


def test_production_type_detected():
    result = validate_goal("I will write 1000 words daily by 2026-12-31")
    assert result["valid"] is True
    assert result["goal"]["type"] == "production"


def test_numeric_metric_extracted():
    result = validate_goal("I will lose 20 pounds by 2026-06-01")
    assert result["valid"] is True
    assert result["goal"]["metric"] == "20"
