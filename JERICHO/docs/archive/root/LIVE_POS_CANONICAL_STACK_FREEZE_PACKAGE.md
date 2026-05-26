# LIVE_POS_CANONICAL_STACK_FREEZE_PACKAGE

## Freeze Scope

This package freezes the non-presentational Live P.O.S. engine before UI rendering work begins.

The frozen subsystem includes:
- doctrine boundary
- canonical execution-evidence inputs
- eligibility / withholding
- deterministic live-state semantics
- bounded score math

This freeze does not include UI rendering, score display policy, or narrative presentation.

---

## Canonical Ownership

Canonical Live P.O.S. ownership is fixed in:
- [GoalPolicy.ts](/Users/jamesdotson/vscode/JERICHO/JERICHO/src/domain/goal/GoalPolicy.ts)

Canonical assembly into state is fixed through:
- [identityCompute.js](/Users/jamesdotson/vscode/JERICHO/JERICHO/src/state/identityCompute.js)

The canonical policy output is available through:
- `goalPolicyByGoalId`
- `cycle.policyState.goalPolicy`

No UI component owns Live P.O.S. semantics.

---

## Frozen Canonical Inputs

Live P.O.S. is allowed to consume only canonical post-execution inputs.

Frozen input classes:
- canonical execution events
- linkage quality of execution evidence
- live schedule state
- lineage sufficiency needed to interpret evidence
- linked completion counts
- linked miss counts
- linked reschedule counts
- recovery evidence counts
- evidence density across the live window

Frozen exclusions:
- feasibility as live evidence
- trust as a substitute for evidence
- UI-derived interpretation
- speculative user behavior inference
- non-canonical summaries
- numeric POS math from [cycleScoring.ts](/Users/jamesdotson/vscode/JERICHO/JERICHO/src/domain/scoring/cycleScoring.ts)

---

## Eligibility And Withholding

The canonical admission layer is frozen as:
- `livePos.state`

Allowed values:
- `eligible`
- `withheld`

Frozen withholding reason classes include:
- admission not ready
- execution state unavailable
- schedule not live
- canonical truth too thin
- lineage insufficient
- no execution evidence yet
- unlinked evidence only

Live P.O.S. must remain withheld when those conditions are present.

No later surface pass may override withholding.

---

## Active-State Semantics

The canonical active-state layer is frozen as:
- `livePos.liveState`
- `livePos.liveStateReasonCodes`

Frozen states:
- `withheld`
- `activating`
- `stable`
- `at_risk`
- `recovering`

Frozen semantic meaning:
- `withheld`: no honest live state exists yet
- `activating`: live evidence exists but is still early
- `stable`: linked evidence continuity is strong enough to support stability
- `at_risk`: drift, misses, or destabilizing evidence is materially present
- `recovering`: post-risk evidence shows credible recovery without full stability yet

No UI layer may rename, merge, or reinterpret these states.

---

## Score-Math Semantics

The canonical numeric layer is frozen as:
- `livePos.score`

Frozen fields:
- `state`
- `value`
- `reasonCodes`
- `capped`
- `evidenceDensity`
- `lowerBound`
- `upperBound`

Frozen score doctrine:
- no score when Live P.O.S. is withheld
- activating remains in bounded early-evidence ranges
- stable remains in bounded continuity-based ranges
- at_risk degrades deterministically from canonical negative evidence
- recovering improves deterministically but remains bounded
- evidence density affects reach and caps
- feasibility does not move the live score when live evidence is unchanged

The score is downstream of:
- canonical evidence
- eligibility / withholding
- active-state semantics

The score must not become a second state machine.

---

## Reason-Code Ownership

Live P.O.S. reason-code ownership is frozen in the canonical policy layer.

Reason-code groups are separated as:
- withholding reason codes
- live-state reason codes
- score-math reason codes

UI rendering may display these codes or mapped copy later, but it does not own their meaning.

No presentation layer may invent new semantic reason classes for canonical Live P.O.S.

---

## Strict Exclusions

The frozen subsystem explicitly excludes:
- feasibility reinterpretation as live evidence
- reuse of [cycleScoring.ts](/Users/jamesdotson/vscode/JERICHO/JERICHO/src/domain/scoring/cycleScoring.ts) as Live P.O.S. score math
- UI-local interpretation of “on track”
- heuristic score changes detached from canonical events
- narrative overrides of withheld, state, or score semantics

The surface pass must follow one rule:

**Read canonical outputs, render them, do not reinterpret them.**

---

## Reopening Conditions

This freeze must be reopened if a future change does any of the following:
- recomputes Live P.O.S. outside [GoalPolicy.ts](/Users/jamesdotson/vscode/JERICHO/JERICHO/src/domain/goal/GoalPolicy.ts)
- lets UI reinterpret or override canonical live state or score
- merges feasibility into live evidence semantics
- changes state-machine transitions without a new brief
- changes score bounds or movement rules without a new brief
- adds new evidence sources without canonical-input review
- collapses withholding, active-state, and score layers into one field
- routes Live P.O.S. semantics through [cycleScoring.ts](/Users/jamesdotson/vscode/JERICHO/JERICHO/src/domain/scoring/cycleScoring.ts) or another non-canonical path

If any of these occur, the Live P.O.S. engine is no longer frozen and must be re-evaluated as a canonical subsystem.

---

## Verified State

At freeze time, the subsystem status is:
- canonical ownership established
- canonical inputs established
- eligibility / withholding implemented
- deterministic live-state machine implemented
- bounded score math implemented

Verification state:
- `345` test files passed
- `1778 / 1778` tests passed
- `0` failures

This freeze point means the remaining Live P.O.S. work is presentation only.

---

## Remaining Work

The only remaining layer after this freeze is:
- Live P.O.S. surface rendering

That pass must:
- consume canonical outputs only
- preserve withholding/state/score semantics
- avoid score reinterpretation
- avoid UI-owned Live P.O.S. logic
