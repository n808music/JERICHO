# Product Grounding & Operating Loop Alignment

## Objective

Align the full Jericho product around the canonical **Executable Schedule Standard**.

A user should be able to move through the full operating loop:

```text
sign in -> enter saved profile -> generate/review executable schedule -> activate -> execute blocks -> course-correct -> reassess -> regenerate/export/evaluate
```

without losing context, seeing unnecessary UI noise, bypassing gates, or relying on hidden developer assumptions.

## Core Doctrine

The product must now behave as an operating system, not a demo surface.

```text
1. Access must be stable.
2. UI must be minimal and purposeful.
3. Plans must activate into executable reality.
4. Execution must feed course correction.
5. Course correction must preserve the Executable Schedule Standard.
6. Feasibility and P.O.S. must judge the real plan standard, not an older thinner model.
```

## Canonical Context

Plan quality is no longer the active blocker. It is now the floor the product must carry end-to-end.

The approved Operation Endgame schedule is the reference exemplar because it proves the correct product substrate:

```text
goal -> horizon -> phases -> lanes -> dated blocks -> owners -> outputs -> artifacts -> dependencies -> gates -> milestones -> exportable schedule
```

The next initiative is to ensure the rest of Jericho operates on top of that floor.

---

## Phase 1 — Login / Logout Stability

### Purpose

Ensure users can reliably enter and leave the product without corrupting profile, plan, or schedule state.

### Required Behavior

```text
1. App requires sign-in before use.
2. Signed-in refresh preserves the correct profile.
3. Sign-out clears active session access.
4. Refresh after sign-out requires sign-in again.
5. Sign-in restores the saved profile and active goal context.
6. Operation Endgame returns through account/profile continuity, not restore buttons.
7. No page shows sensitive plan/schedule state while signed out.
```

### Development Tasks

- Audit auth containment path.
- Confirm `activeProfileId` lifecycle.
- Confirm active goal and mission context restore after sign-in.
- Confirm local/session storage is cleared or protected correctly on sign-out.
- Confirm no unauthenticated route leaks Structure, Today, Plan, or Stability data.
- Add regression tests for refresh, sign-out, sign-in, and profile restoration.

### Acceptance Criteria

PASS when:

- logged-in refresh preserves profile
- sign-out + refresh blocks access
- sign-in restores Operation Endgame context
- no restore workaround is required
- no active plan appears while signed out

---

## Phase 2 — UI Minimalism and Conceptual Clarity

### Purpose

Reduce product confusion by making the UI follow the real lifecycle.

### Lifecycle States

```text
1. No profile selected
2. Profile selected, no active goal
3. Goal admitted, no schedule generated
4. Schedule generated, pending review
5. Schedule reviewed, pending activation
6. Schedule activated
7. Execution in progress
8. Course correction needed
9. Reassessment accepted
10. Schedule regenerated/rebased
```

### Development Tasks

- Define lifecycle-state model.
- Map each tab/page to lifecycle state.
- Hide or disable irrelevant controls.
- Remove product-facing workaround controls.
- Preserve blank-state clarity without showing fake data.
- Ensure buttons use operational language:

```text
Generate Schedule
Review Plan
Export Full Schedule
Activate Schedule
Complete / Miss / Skip
Reassess
Regenerate from Reassessment
```

### Acceptance Criteria

PASS when:

- user always knows the next action
- inactive states are visible but not noisy
- no duplicate or competing actions exist
- no restore/demo/dev workaround appears as product UI
- Structure, Today, Plan, Stability each have a clear purpose

---

## Phase 3 — End-to-End Function After Activation

### Purpose

Prove that an approved plan does not only export well; it becomes executable inside the product.

### Required Loop

```text
goal -> schedule -> export/review -> activate -> today block -> complete/miss/skip -> progress update -> course correction signal
```

### Required Behavior

After activation:

```text
1. Today shows the correct active block(s).
2. Future locked blocks remain visible but not prematurely editable.
3. User can complete a block.
4. User can miss a block.
5. User can skip/defer a block with reason.
6. Completion updates state.
7. Missed work creates course-correction pressure.
8. Activation guard prevents mutation of committed schedule unless reassessment occurs.
9. Exported schedule and active schedule remain consistent.
```

### Development Tasks

- Validate `activateSchedule` path.
- Validate Today block selection.
- Validate complete/miss/skip handlers.
- Validate schedule-state persistence after refresh.
- Validate active block status is reflected in Plan/Stability.
- Validate future blocks are visible but protected.
- Validate missed blocks do not silently disappear.

### Acceptance Criteria

PASS when:

- user can activate a generated schedule
- Today shows actionable work
- completion persists
- missed blocks trigger course correction path
- refresh does not lose active execution state
- active schedule still aligns with the full schedule artifact

---

## Phase 4 — Missing Product Ground Elements

### Purpose

Identify the missing product elements required for Jericho to feel coherent rather than modular.

### Likely Missing Elements

#### A. State banner

Every main screen should expose current product state:

```text
Profile: Nathan
Goal: Operation Endgame
Schedule: Generated / Reviewed / Activated
Phase: P1
Today: On track / Behind / Needs reassessment
```

#### B. Plan quality status

The user should be able to see whether the generated plan passed the standard:

```text
Plan Quality: Passed Executable Schedule Standard
Dependency Audit: Pass
Gate Integrity: Pass
Owner Coverage: Pass
Schedule Floor: Pass
```

#### C. Activation readiness panel

Before activation, show:

```text
- block count
- first executable date
- horizon end
- dependency audit
- owner coverage
- gate status
- export available
```

#### D. Course correction trigger

The system should know when reassessment is required:

```text
- missed critical block
- repeated missed blocks
- activation delayed
- dependency blocked
- gate failed
- availability changed
- user says plan no longer reflects reality
```

#### E. Reassessment history

Course corrections should become part of the operating record:

```text
Reassessment accepted: date
Reason: missed work / changed availability / blocked gate / user-initiated
Result: schedule rebased / blocks deferred / phase gate held
```

### Acceptance Criteria

PASS when:

- user can see current product state
- plan quality status is explicit
- activation readiness is inspectable
- course correction has a formal entry point
- reassessments are recorded, not hidden

---

## Phase 5 — Course Correction Evaluation

### Purpose

Build the evaluation layer that decides when the plan must adapt.

### Doctrine

```text
A missed or blocked plan does not automatically mean the goal failed.
It means the system must evaluate whether to:
- continue
- defer
- rebase
- split
- hold gate
- regenerate
- change intensity
- change availability
- change strategic path
```

### Inputs

```text
1. Missed blocks
2. Skipped blocks
3. Completed blocks
4. Failed gates
5. Delayed activation
6. Changed availability
7. Dependency failures
8. User reassessment
9. External constraints
10. Plan quality failures
```

### Outputs

```text
Continue:
- no schedule change

Rebase:
- move future executable work forward from reassessment date

Defer:
- keep goal but delay lane/block

Compress:
- increase density only if capacity allows

Split:
- separate overloaded lane or independent cycle

Hold:
- stop downstream work until gate evidence exists

Regenerate:
- produce a new executable schedule under the standard

Terminate:
- mark goal/path no longer active
```

### Development Tasks

- Define `courseCorrectionEvaluation`.
- Add reason codes.
- Add severity levels.
- Add recommended action.
- Connect missed block handling to course-correction evaluation.
- Connect activation delay to reassessment prompt.
- Connect failed gates to hold/regenerate path.
- Ensure regeneration respects effective reassessment date.

### Acceptance Criteria

PASS when:

- missed/blocked work produces a clear evaluation
- reassessment can rebase the plan
- regeneration preserves the Executable Schedule Standard
- course correction does not backdate blocks
- system explains why it recommends continue/defer/rebase/regenerate

---

## Phase 6 — Initial Feasibility and P.O.S. Alignment

### Purpose

Update the feasibility and P.O.S. layers so they evaluate the real executable schedule standard rather than a thinner legacy model.

### Required Shift

Old model:

```text
Does the goal seem feasible based on ambition, resources, time, and current state?
```

Updated model:

```text
Does the goal have a valid executable schedule substrate, and does current reality support operating that schedule?
```

### Initial Feasibility

Initial Feasibility is pre-schedule and should score:

```text
1. Goal clarity
2. Horizon realism
3. Availability/capacity
4. Resource constraints
5. Known blockers
6. Required evidence
7. Strategic coherence
8. Readiness to generate an executable schedule
```

Proposed equation:

```text
Initial Feasibility =
Goal Clarity
× Horizon Plausibility
× Capacity Fit
× Resource Access
× Constraint Visibility
× Evidence Readiness
× Strategic Coherence
× Schedule-Generation Readiness
```

### P.O.S.

P.O.S. is post-schedule or post-activation and should score:

```text
P.O.S. =
Plan Quality
× Execution Compliance
× Capacity Fit
× Dependency Health
× Gate Progress
× Evidence Velocity
× Resource Reality
× Course Correction Responsiveness
```

Where:

```text
Plan Quality = Executable Schedule Standard score
Execution Compliance = completion / missed / skipped pattern
Capacity Fit = schedule load vs availability
Dependency Health = dependency audit + blocked dependencies
Gate Progress = gates passed / held / failed
Evidence Velocity = rate of produced artifacts
Resource Reality = cash/time/tools/access constraints
Course Correction Responsiveness = speed/quality of reassessment after deviation
```

### Development Tasks

- Locate current P.O.S. equation.
- Locate current initial feasibility equation.
- Separate pre-schedule feasibility from post-schedule operating probability.
- Add plan-quality score as a core P.O.S. input.
- Add dependency health and gate progress.
- Add execution compliance after activation.
- Add course-correction responsiveness.
- Ensure initial feasibility does not require a full schedule before generation.
- Ensure P.O.S. does not show false confidence before activation.

### Acceptance Criteria

PASS when:

- Initial Feasibility helps decide whether the goal is ready to generate
- P.O.S. helps decide whether the active schedule is likely to succeed
- P.O.S. reflects the Executable Schedule Standard
- P.O.S. changes when execution reality changes
- missed blocks, failed gates, dependency issues, and poor plan quality lower P.O.S.
- clean execution, passed gates, artifacts produced, and successful reassessment improve P.O.S.

---

## Suggested Development Order

### Milestone 1 — Product Ground Audit

```text
Audit login/logout, lifecycle state, UI flow, activation path, course correction,
feasibility, and P.O.S.
No major code changes except obvious broken assertions.
Output: gap list mapped to product lifecycle.
```

### Milestone 2 — Access and State Stability

```text
Close login/logout/profile restoration issues.
Confirm protected routes and active context persistence.
```

### Milestone 3 — Lifecycle UI Minimalism

```text
Align UI actions to lifecycle states.
Remove product-facing workaround controls.
Clarify next action on each tab.
```

### Milestone 4 — Activation and Execution Loop

```text
Prove schedule activation, Today execution, complete/miss/skip, persistence, and post-activation state updates.
```

### Milestone 5 — Course Correction Engine

```text
Formalize missed/blocked/delayed work evaluation.
Implement rebase/defer/hold/regenerate recommendations.
```

### Milestone 6 — Feasibility and P.O.S. Alignment

```text
Separate Initial Feasibility from post-schedule P.O.S.
Update both equations around the Executable Schedule Standard.
```

### Milestone 7 — End-to-End Certification

```text
Run a live user path:
sign in
restore profile
review active Operation Endgame
generate/export
activate
complete/miss/skip block
trigger course correction
reassess
regenerate
export again
confirm standard holds
```

---

## Definition of Done

This initiative is complete when Jericho can demonstrate:

```text
1. Stable sign-in/sign-out/profile restoration
2. Minimal lifecycle-aligned UI
3. Activated schedules execute through Today
4. Missed/blocked work triggers course correction
5. Reassessment rebases without past-dating
6. Regenerated schedules preserve the Executable Schedule Standard
7. Initial Feasibility reflects pre-schedule readiness
8. P.O.S. reflects post-schedule operating probability
9. The product loop works end-to-end without conceptual breaks
```

## Initiative Name

Working name:

`Product Grounding & Operating Loop Alignment`

Short name:

`Operating Loop Alignment`

The product is no longer being judged by whether it can generate one strong plan.
It is being judged by whether it can operate on top of the executable schedule floor.
