"""
Multi-pass goal decomposition pipeline.

Runs N independent passes (recommended_pass_count from registry) then an
optional self-critique pass. Each pass is a fresh subagent — no context bleed.
The final result is the last pass output, revised by critique if enabled.
"""
from __future__ import annotations

from jyriko.llm.adapter import subagent_spawn
from jyriko.llm.registry import ModelProfile
from jyriko.llm.schemas import DecomposedGoal, SelfCritiqueRevision

_DECOMPOSE_PROMPT = """
You are a personal execution coach. Break down this goal into concrete, actionable tasks.

Goal: {goal}

Requirements:
- Each task must be independently completable
- Assign cognitive_load between 0.0 (trivial) and 1.0 (maximal focus)
- Classify task_type: decision, research, creative, execution, or administrative
- Assign importance_tier: hard_deadline, routine, or flexible
- List dependencies by task title (empty list if none)

Respond with valid JSON matching this exact schema:
{{
  "goal_title": "string",
  "tasks": [
    {{
      "title": "string",
      "instructions": "string",
      "estimated_cost": "0.00",
      "estimated_duration_minutes": 30,
      "cognitive_load": 0.5,
      "task_type": "execution",
      "importance_tier": "routine",
      "dependencies": []
    }}
  ],
  "dependency_rationale": "string"
}}
""".strip()

_SELF_CRITIQUE_PROMPT = """
Review this goal decomposition and identify any issues:
- Overlapping tasks
- Missing critical steps
- Unrealistic cognitive load estimates
- Circular dependencies

Original decomposition:
{decomposition_json}

Revise the task list to address any issues found.

Respond with valid JSON matching this exact schema:
{{
  "issues_found": ["string"],
  "revised_tasks": [
    {{
      "title": "string",
      "instructions": "string",
      "estimated_cost": "0.00",
      "estimated_duration_minutes": 30,
      "cognitive_load": 0.5,
      "task_type": "execution",
      "importance_tier": "routine",
      "dependencies": []
    }}
  ],
  "confidence_score": 0.8,
  "rationale": "string"
}}
""".strip()


def run_decomposition_pipeline(
    goal: str,
    model_profile: ModelProfile,
) -> DecomposedGoal:
    """N independent decomposition passes then optional self-critique.

    Returns the final DecomposedGoal — revised if self_critique_required and tasks exist.
    """
    prompt = _DECOMPOSE_PROMPT.format(goal=goal)
    result = DecomposedGoal(goal_title=goal, tasks=[], dependency_rationale="")

    for pass_num in range(model_profile.recommended_pass_count):
        result = subagent_spawn(
            prompt=prompt,
            schema=DecomposedGoal,
            model_profile=model_profile,
            pass_number=pass_num + 1,
        )

    if model_profile.self_critique_required and result.tasks:
        critique_prompt = _SELF_CRITIQUE_PROMPT.format(
            decomposition_json=result.model_dump_json(indent=2)
        )
        revision: SelfCritiqueRevision = subagent_spawn(
            prompt=critique_prompt,
            schema=SelfCritiqueRevision,
            model_profile=model_profile,
            pass_number=model_profile.recommended_pass_count + 1,
        )
        if revision.revised_tasks:
            result = DecomposedGoal(
                goal_title=result.goal_title,
                tasks=revision.revised_tasks,
                dependency_rationale=revision.rationale,
            )

    return result
