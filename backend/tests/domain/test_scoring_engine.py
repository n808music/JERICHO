"""Tests for scoring_engine — mirrors tests/core/scoring-engine.test.js."""
import pytest

from jyriko.domain.scoring_engine import compute_integrity_score, explain_integrity_score
from jyriko.domain.task_status import TASK_STATUS_COMPLETED, TASK_STATUS_MISSED, TASK_STATUS_PENDING


def _task(status: str, impact: float = 1.0, difficulty: int = 2, on_time: bool = True) -> dict:
    return {"status": status, "estimatedImpact": impact, "difficulty": difficulty, "onTime": on_time}


def test_empty_tasks_returns_zero_score():
    result = compute_integrity_score([])
    assert result["score"] == 0
    assert result["maxPossible"] == 0


def test_all_completed_on_time_scores_100():
    tasks = [_task(TASK_STATUS_COMPLETED, impact=1.0, difficulty=2, on_time=True)]
    result = compute_integrity_score(tasks)
    assert result["score"] == 100


def test_late_completion_applies_penalty():
    tasks = [_task(TASK_STATUS_COMPLETED, impact=1.0, difficulty=2, on_time=False)]
    result = compute_integrity_score(tasks)
    assert result["score"] == 70  # 0.7 * 1.0 * 1.0 (diff=2 → weight=1.0)


def test_missed_task_subtracts_from_score():
    tasks = [
        _task(TASK_STATUS_COMPLETED, impact=1.0),
        _task(TASK_STATUS_MISSED, impact=1.0),
    ]
    result = compute_integrity_score(tasks)
    # completed: +1.0*1.0, missed: -1.0 → rawTotal=0; ratio=0 → score=0
    assert result["score"] == 0


def test_pending_tasks_ignored_in_score():
    tasks = [
        _task(TASK_STATUS_COMPLETED, impact=1.0),
        _task(TASK_STATUS_PENDING, impact=1.0),
    ]
    result = compute_integrity_score(tasks)
    assert result["score"] > 0
    assert result["pendingCount"] == 1


def test_difficulty_weight_t1_lower():
    t1 = [_task(TASK_STATUS_COMPLETED, impact=1.0, difficulty=1)]
    t3 = [_task(TASK_STATUS_COMPLETED, impact=1.0, difficulty=3)]
    # T1 weight=0.8, T3 weight=1.2 — but max_possible scales too, so ratio=1 for both
    assert compute_integrity_score(t1)["score"] == 100
    assert compute_integrity_score(t3)["score"] == 100


def test_explain_score_breakdown_fields():
    tasks = [
        _task(TASK_STATUS_COMPLETED, on_time=True),
        _task(TASK_STATUS_COMPLETED, on_time=False),
        _task(TASK_STATUS_MISSED),
    ]
    result = explain_integrity_score(tasks)
    bd = result["breakdown"]
    assert bd["completedOnTime"] == 1
    assert bd["completedLate"] == 1
    assert bd["missed"] == 1
    assert bd["totalTasks"] == 3
    assert 0.0 <= bd["completionRate"] <= 1.0
    assert 0.0 <= bd["onTimeRate"] <= 1.0
