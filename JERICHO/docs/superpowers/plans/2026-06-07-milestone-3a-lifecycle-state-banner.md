# Milestone 3A — Explicit Lifecycle State Model + Product State Banner

## Status

Active next implementation target for `Operating Loop Alignment`.

This milestone supersedes Milestone 2 as the immediate build priority unless a
live auth/profile failure reappears. The current highest-value constraint is
not access stability; it is lifecycle intelligibility.

## Why This Comes Next

Jericho already contains most of the operating loop at the domain and
interaction level:

```text
auth containment
profile access gate
goal context
schedule generation
review/apply
activation guard
Today execution controls
friction recording
reassessment
plan quality gate
Initial Feasibility
Live P.O.S.
course correction entropy
```

The problem is that these surfaces do not yet present themselves as one
coherent operating system. The user sees separate areas rather than one visible
lifecycle contract.

This milestone builds that spine.

---

## Objective

Create a first-class lifecycle state model that tells both the product and the
user where they are in the operating loop.

The product should always be able to answer:

```text
Who is signed in?
Which profile is active?
Which goal is active?
What schedule state are we in?
What phase is active?
What should happen today?
Is the plan ready, active, blocked, or in reassessment?
What is the next correct action?
```

## Scope

This milestone should stay narrow.

Build:

```text
1. Lifecycle state resolver
2. Product state banner
3. Activation readiness summary
4. Minimal next-action display
```

Do not:

```text
- rewrite auth
- redesign every tab
- change plan generation
- change the Executable Schedule Standard
- rewrite P.O.S.
- build the full course-correction remediation UI
```

---

## Proposed Lifecycle State Enum

Use one canonical product state model, for example:

```ts
type OperatingLifecycleState =
  | 'SIGNED_OUT'
  | 'PROFILE_REQUIRED'
  | 'GOAL_REQUIRED'
  | 'GOAL_ADMITTED'
  | 'SCHEDULE_REQUIRED'
  | 'SCHEDULE_GENERATED'
  | 'PLAN_REVIEW_REQUIRED'
  | 'READY_TO_ACTIVATE'
  | 'ACTIVE_EXECUTION'
  | 'EXECUTION_BLOCKED'
  | 'COURSE_CORRECTION_REQUIRED'
  | 'REASSESSMENT_PENDING'
  | 'REASSESSMENT_ACCEPTED'
  | 'REGENERATION_REQUIRED';
```

The exact labels can change, but the resolver must be canonical and shared.

---

## Lifecycle State Resolver

Create a selector or domain utility such as:

```text
resolveOperatingLifecycleState(appState)
```

### Candidate Location

Preferred:

`src/domain/live/resolveOperatingLifecycleState.ts`

Alternative:

`src/domain/product/resolveOperatingLifecycleState.ts`

### Inputs

The resolver should consider:

```text
auth state
activeProfileId
activeGoalId / mission context
schedule exists
schedule generated timestamp
plan quality status
dependency audit status
review blocks exist
schedule applied
schedule activated
today blocks
missed/skipped/completed blocks
friction events
reassessment required/accepted
availability/work windows
```

### Output Contract

The resolver should return something like:

```json
{
  "state": "READY_TO_ACTIVATE",
  "label": "Ready to activate",
  "reason": "Schedule generated, reviewed, and passed the Executable Schedule Standard.",
  "nextAction": "Activate Schedule",
  "blockingIssues": [],
  "readinessSummary": {
    "planQuality": "PASS",
    "dependencyAudit": "PASS",
    "ownerCoverage": "PASS",
    "gateIntegrity": "PASS",
    "firstExecutableDate": "2026-06-08",
    "blockCount": 1055
  }
}
```

The key requirement is not the exact shape. The requirement is that one shared
resolver drives product-state messaging.

---

## Product State Banner

Add a compact product-state banner near the top of the main shell or dashboard.

### Minimum Fields

```text
Profile
Goal
Schedule
Phase
Today
Next Action
```

### Example — Ready to Activate

```text
Profile: Nathan
Goal: Operation Endgame
Schedule: Activated · 1055 blocks · PASS
Phase: P1 Launch / Proof
Today: 2 blocks scheduled
Next: Complete today's active block
```

### Example — Review Required

```text
Profile: Nathan
Goal: Operation Endgame
Schedule: Generated · Review required
Phase: P1 Launch / Proof
Today: Not active
Next: Review and activate schedule
```

### Example — Course Correction Needed

```text
Profile: Nathan
Goal: Operation Endgame
Schedule: Active · Course correction needed
Phase: P1 Launch / Proof
Today: Missed critical block
Next: Accept reassessment
```

---

## Activation Readiness Summary

Before activation, consolidate scattered readiness facts into one panel.

### Required Fields

```text
Block count
First executable date
Horizon end
Plan quality
Dependency audit
Owner coverage
Gate integrity
Export status
Activation blockers
```

This panel does not replace the PDF. It tells the user whether the schedule is
ready to become live.

---

## Minimal UI Rule

Do not surface every available action at once.

Each lifecycle state should expose one primary action and only a small number of
secondary actions.

### Examples

```text
SCHEDULE_REQUIRED
Primary: Generate Schedule
Secondary: Edit Availability

PLAN_REVIEW_REQUIRED
Primary: Export Full Schedule
Secondary: Review Plan Quality

READY_TO_ACTIVATE
Primary: Activate Schedule
Secondary: Export Full Schedule

ACTIVE_EXECUTION
Primary: Complete Current Block
Secondary: Miss / Skip

COURSE_CORRECTION_REQUIRED
Primary: Review Course Correction
Secondary: Record Friction
```

---

## Likely Owning Files

Based on the audit, the most relevant surfaces are:

```text
src/components/ZionDashboard.jsx
src/components/AppShell.jsx
src/components/ProfileAccessGate.jsx
src/domain/live/courseCorrection.ts
src/domain/planQuality/evaluatePlanQualityGate.ts
```

Likely new file:

```text
src/domain/live/resolveOperatingLifecycleState.ts
```

Likely tests:

```text
tests/domain/live/resolveOperatingLifecycleState.test.ts
tests/components/ProductStateBanner.test.jsx
tests/components/ZionDashboard.lifecycleState.test.jsx
```

---

## Acceptance Criteria

This milestone passes when:

```text
1. The product has one canonical lifecycle-state resolver.
2. The dashboard renders a visible state banner.
3. The banner shows profile, goal, schedule state, phase, today status, and next action.
4. Activation readiness is consolidated before activation.
5. Existing auth/profile/generation/activation behavior remains unchanged.
6. UI actions are reduced or prioritized according to lifecycle state.
7. Course correction can be represented as a visible lifecycle state, even before the full course-correction UI is rebuilt.
```

---

## Why This Comes Before Course Correction and P.O.S. Work

Both course correction and P.O.S. depend on knowing the lifecycle context.

Without lifecycle state, P.O.S. has no stable frame:

```text
Is this pre-schedule feasibility?
Post-generation readiness?
Post-activation operating probability?
Post-miss recovery probability?
```

Without lifecycle state, course correction has no clean entry point:

```text
Is the user behind?
Blocked?
Awaiting reassessment?
Ready to regenerate?
Still active?
```

The resolver and banner become the product spine that later P.O.S. and
course-correction work can attach to.

---

## Updated Initiative Order

```text
Milestone 1 — Product Ground Audit: started / sufficient first pass
Milestone 2 — Access and State Stability: mostly implemented, monitor only
Milestone 3A — Explicit Lifecycle State Model + Product State Banner: next active implementation
Milestone 4 — Missing Product Ground Elements: partially folded into Milestone 3A
Milestone 5 — Course Correction Evaluation: after lifecycle state is visible
Milestone 6 — Feasibility / P.O.S. Alignment: after lifecycle and course correction are explicit
```
