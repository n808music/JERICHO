---
name: feedback-rtg-run-the-goal
description: "RTG = Run the Goal. Formal product-verification convention the user defined for closing development passes — run the saved goal through the live engine and inspect the user-facing output, not just the gate codes."
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 815dd309-a1a9-48a3-a469-89422f5ed4e5
---

**Rule:** After completing a development pass, do not call the work done at "tests green" or "gate passed." Perform an RTG — Run the Goal — pass: load the actual saved goal, run it through the live product/engine state, and inspect whether the output is coherent, complete, visible, usable, and aligned with the declared mission.

**Why:** The user has explicitly defined RTG as the formal verification command for Jericho work. Code-green and unit-test-green are necessary but insufficient; they prove the code didn't break, not that the goal still runs. Plan Quality Remediation closed at `PLAN_QUALITY_PASSED with 0 failure codes`, but that's the technical gate, not RTG. A green engine that produces a thin, clipped, misleading, or stale-feeling plan is a fail. The product anchor is "does the goal run?" not "did the code pass?"

**How to apply:**
- After merging an initiative or major patch, the workflow is: patch → test suite → merge → close initiative → **RTG**.
- For Jericho specifically: RTG Operation Endgame means reload the Endgame fixture, generate/apply/inspect the goal output as a real user would, and confirm coherence/completeness/inspectability/trustworthiness.
- An RTG fail is not a regression in tests — it's a failure of the user-facing product promise even when tests are green.
- RTG is NOT a unit test, fixture snapshot test, or repo cleanup. It is the final product-facing proof.
- When the user asks for the next move after an initiative closes, "RTG Operation Endgame" is the canonical answer.

**Related:** [[project_operation_endgame]]
