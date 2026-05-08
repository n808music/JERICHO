# JERICHO Apply -> Activate Lifecycle Spec

## Purpose

Define a strict schedule lifecycle so Jericho behaves like a behavioral
execution engine:

- `Generate Schedule` creates draft proposed blocks only
- `Apply` places draft blocks on the calendar for review
- `Activate` / `Commit` makes the schedule authoritative and starts
  accountability
- after activation, required system-created blocks are reschedulable, not
  casually deletable

## Canonical Lifecycle States

- `no_schedule`
- `draft_schedule_ready`
- `applied_review`
- `active_schedule`
- `reschedule_pending`
- `stale_draft_invalidated`

## State Semantics

### Generate Schedule

- refreshes draft proposed blocks only
- does not activate accountability
- blocks regeneration when an active authoritative schedule is already present
- replaces stale draft state instead of accumulating duplicate work

### Apply

- materializes draft blocks as review blocks on the calendar
- does not create authoritative execution events
- does not start live accountability
- marks the schedule as `applied_review`

### Activate / Commit

- converts review blocks into authoritative execution events
- marks the schedule as `active_schedule`
- starts live accountability and active-clock semantics
- becomes the point after which regenerate is no longer the default action

### Post-activation behavior

- required system-created blocks are not casually deletable
- specific blocks may be rescheduled through controlled flow
- regenerate is blocked for unchanged active schedules unless the user
  explicitly rebuilds or reschedules

## Authority Rules

- one active schedule version owns the calendar for its cycle
- repeated generate/apply on unchanged input must not duplicate authoritative
  work
- review blocks are distinct from active execution events
- active required blocks preserve their canonical identity through reschedule
  flows

## Duplicate-Protection Rules

- identical draft schedules refresh review state instead of stacking duplicates
- activation is idempotent for already-active schedules
- applying a draft does not create execution events
- activation only commits blocks that are still present in review state

## Deletion Policy

- required active system-created blocks cannot be casually deleted
- deletion requests on protected blocks are blocked deterministically
- reschedule is the allowed path for active required blocks
- optional or draft-only blocks may remain flexible if the current state shape
  supports it

## UI Contract

- draft schedule state is shown after generate
- review schedule state is shown after apply
- active schedule state is shown after activate / commit
- controls shift from planning semantics to execution semantics once active

## Files Changed

- `src/state/identityCompute.js`
- `src/state/identityStore.js`
- `src/state/identityTypes.js`
- `src/state/engine/todayAuthority.ts`
- `src/state/structureSchedulingSemantics.js`
- `src/components/zion/StructurePageConsolidated.jsx`
- `src/components/ZionDashboard.jsx`
- `src/components/zion/MissionSetupFlow.jsx`
- `src/components/zion/BlockDetailsPanel.jsx`
- `src/components/zion/DaySchedulePanel.jsx`
- `tests/state/applyDraftSchedule.canonicalSource.test.js`
- `tests/state/blockStore.shadowWrite.parity.test.js`
- `tests/state/draftBlockCreation.test.js`
- `tests/state/generalization.archetypeMatrix.test.js`
- `src/state/__tests__/generateApply.integration.test.js`

## Before / After

### Before

- apply effectively acted like commit
- repeated generate/apply could stack work too loosely
- active required blocks were too easy to treat as disposable

### After

- generate creates draft-only state
- apply creates review-only state
- activate creates authoritative active state
- required active blocks are reschedulable but not casually deletable
- the UI and reducer now agree on the lifecycle boundary
