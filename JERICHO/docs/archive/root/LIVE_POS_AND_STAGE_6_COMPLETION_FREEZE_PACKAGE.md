# LIVE_POS_AND_STAGE_6_COMPLETION_FREEZE_PACKAGE

## Freeze Scope

This package freezes Stage 6: End-to-End Function with Live P.O.S.

The frozen Stage 6 stack includes:

- Live P.O.S. doctrine
- canonical execution-evidence inputs
- eligibility / withholding
- deterministic live-state machine
- bounded score math
- dedicated surface rendering

This freeze records product/system completion of Stage 6. It does not claim
unrelated repository-wide formatting or lint drift has been resolved.

---

## Baseline Dependency

Stage 6 is built on the frozen gate-open baseline from:

- [PLAN_QUALITY_AND_E2E_GATE_OPEN_FREEZE_PACKAGE.md](/Users/jamesdotson/vscode/JERICHO/JERICHO/PLAN_QUALITY_AND_E2E_GATE_OPEN_FREEZE_PACKAGE.md)

The validated substrate beneath Stage 6 includes:

- chart truth
- standardized plan quality
- standardized long-term plan quality
- initial feasibility
- end-to-end lifecycle function

Live P.O.S. work must not reopen those layers unless a reopening condition is
met.

---

## Canonical Ownership

Canonical Live P.O.S. ownership remains fixed in:

- [GoalPolicy.ts](/Users/jamesdotson/vscode/JERICHO/JERICHO/src/domain/goal/GoalPolicy.ts)

Canonical assembly remains fixed through:

- [identityCompute.js](/Users/jamesdotson/vscode/JERICHO/JERICHO/src/state/identityCompute.js)

Canonical output remains available through:

- `goalPolicyByGoalId`
- `cycle.policyState.goalPolicy`
- `activeCycle.policyState.goalPolicy.livePos`

No UI component owns Live P.O.S. policy semantics.

---

## Frozen Canonical Inputs

Live P.O.S. may consume only canonical post-execution evidence and supporting
execution-state truth.

Frozen input classes:

- canonical execution events
- live schedule state
- linked completion evidence
- linked missed execution evidence
- linked reschedule / drift evidence
- linked recovery evidence
- evidence density
- evidence linkage quality
- lineage sufficiency needed to interpret execution evidence

Frozen exclusions:

- feasibility as live evidence
- trust as a substitute for execution evidence
- UI-derived interpretation
- speculative user-follow-through inference
- generated plan text
- non-canonical summaries
- alternate score math from
  [cycleScoring.ts](/Users/jamesdotson/vscode/JERICHO/JERICHO/src/domain/scoring/cycleScoring.ts)

---

## Eligibility And Withholding

The canonical admission layer is frozen as:

- `livePos.state`

Allowed values:

- `eligible`
- `withheld`

Withholding must remain intentional when canonical evidence is insufficient.

Frozen withholding classes include:

- admission not ready
- execution state unavailable
- schedule not live
- canonical truth too thin
- lineage insufficient
- no execution evidence yet
- unlinked evidence only

No surface may override canonical withholding.

---

## Active-State Semantics

The canonical active-state layer is frozen as:

- `livePos.liveState`
- `livePos.liveStateReasonCodes`

Frozen live states:

- `withheld`
- `activating`
- `stable`
- `at_risk`
- `recovering`

Frozen meaning:

- `withheld`: no honest live state exists yet
- `activating`: linked execution evidence exists but is still early
- `stable`: linked execution continuity is strong enough to support stability
- `at_risk`: drift, misses, or destabilizing evidence is materially present
- `recovering`: post-risk evidence shows credible recovery without full
  stability yet

No later layer may merge these states or reduce them to a generic good/bad
status.

---

## Score-Math Semantics

The canonical numeric layer is frozen as:

- `livePos.score`

Frozen score fields:

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

The score remains downstream of:

- canonical evidence
- eligibility / withholding
- active-state semantics

The score must not become a second state machine.

---

## Surface Rendering

The completed surface rendering layer is owned in:

- [ZionDashboard.jsx](/Users/jamesdotson/vscode/JERICHO/JERICHO/src/components/ZionDashboard.jsx)

The surface reads canonical output from:

- `activeCycle.policyState.goalPolicy.livePos`

The surface renders:

- withheld vs available intentionally
- first-class live state
- bounded score
- score range
- cap status
- evidence density
- readable reason text mapped from canonical reason codes
- separated feasibility context
- separated P.O.S. trust context

The surface does not:

- recompute Live P.O.S.
- recompute score
- reinterpret state
- borrow feasibility semantics
- borrow trust semantics
- use
  [cycleScoring.ts](/Users/jamesdotson/vscode/JERICHO/JERICHO/src/domain/scoring/cycleScoring.ts)
- generate UI-owned state transitions

The governing presentation rule remains:

**Read canonical outputs, render them, do not reinterpret them.**

---

## Reason-Code Ownership

Reason-code ownership remains canonical.

Reason-code groups remain separated as:

- withholding reason codes
- live-state reason codes
- score reason codes

The UI may map canonical reason codes into readable text, but it may not create
new semantic reason classes.

If new Live P.O.S. reason-code categories are required, they must be added
through the canonical policy path first.

---

## Verification Record

Focused rendering and regression verification passed:

- [ZionDashboard.pos.afterAdmit.test.jsx](/Users/jamesdotson/vscode/JERICHO/JERICHO/tests/components/ZionDashboard.pos.afterAdmit.test.jsx)
- [ZionDashboard.pos.postcondition.test.jsx](/Users/jamesdotson/vscode/JERICHO/JERICHO/tests/components/ZionDashboard.pos.postcondition.test.jsx)
- [structure.deliverableTerminology.contract.test.jsx](/Users/jamesdotson/vscode/JERICHO/JERICHO/tests/components/structure.deliverableTerminology.contract.test.jsx)

Focused command:

- `npm run test -- tests/components/ZionDashboard.pos.afterAdmit.test.jsx tests/components/ZionDashboard.pos.postcondition.test.jsx tests/components/structure.deliverableTerminology.contract.test.jsx --reporter=verbose`

Focused result:

- `3` files passed
- `27` tests passed

This verifies:

- withheld rendering
- available rendering
- first-class live state rendering
- bounded score rendering
- range rendering
- cap rendering
- evidence-density rendering
- canonical reason-code mapping
- separation from feasibility and trust
- no regression to formal chart lifecycle/semantic truth

---

## Repo-Hygiene Caveat

At Stage 6 completion time, `npm run check-all` is not a clean closure signal
because the repo contains unrelated pre-existing lint / format drift outside
this Stage 6 surface pass.

Observed blocker class:

- repo-wide Prettier drift in unrelated markdown, audit, domain, and state files
- lint warnings already present outside the Live P.O.S. rendering change

This caveat does not reopen Stage 6 product/system semantics.

Stage 6 closure is based on:

- frozen canonical Live P.O.S. stack
- completed rendering layer
- focused rendering regressions passing
- no policy or score semantics changed during the rendering pass

Repository-wide formatting cleanup remains a maintenance task.

---

## Closed Stage 6 State

Stage 6 is closed at the product/system layer.

Closed components:

- doctrine boundary
- canonical inputs
- eligibility / withholding
- deterministic live-state machine
- score math
- surface rendering

Remaining work after this freeze is not Stage 6 doctrine or engine work.

Remaining non-blocking work:

- repo-wide formatting / lint hygiene cleanup
- future full `check-all` confirmation after unrelated drift is resolved

---

## Reopening Conditions

This freeze must be reopened if a future change does any of the following:

- recomputes Live P.O.S. outside
  [GoalPolicy.ts](/Users/jamesdotson/vscode/JERICHO/JERICHO/src/domain/goal/GoalPolicy.ts)
- lets UI reinterpret or override canonical live state
- lets UI reinterpret or override canonical score
- merges feasibility into live evidence semantics
- uses trust as a substitute for execution evidence
- changes score bounds or movement rules without a new brief
- changes state-machine transitions without a new brief
- introduces new evidence sources without canonical-input review
- routes Live P.O.S. score math through
  [cycleScoring.ts](/Users/jamesdotson/vscode/JERICHO/JERICHO/src/domain/scoring/cycleScoring.ts)
  or another alternate scoring path
- collapses withholding, active-state, and score layers into one generic status
- adds UI-authored explanation semantics that are not grounded in canonical
  reason codes

If any reopening condition occurs, the Live P.O.S. stack is no longer frozen and
must be re-evaluated as a canonical subsystem.
