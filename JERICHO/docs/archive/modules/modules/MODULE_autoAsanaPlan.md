# Module Identity Sheet — Schedule Proposal Generation

**File:** `src/state/engine/autoAsanaPlan.ts`  
**Phase:** 2 — Module Determinism Audit  
**Status:** AUDIT IN PROGRESS  
**Determinism Grade:** YELLOW — mostly deterministic, boundary leaks exist (see
Known Failure Modes)  
**Last updated:** 2026-03-13

---

## Purpose

Compile a deterministic schedule proposal for a single goal cycle. Given a plan
proof, constraints, and an action sequence, produce a set of dated, timed
horizon blocks that represent the complete forward schedule from today to the
goal deadline.

This module owns **proposal generation only**. It does not own persistence,
calendar rendering, or block commitment.

---

## Allowed Inputs

| Parameter        | Type                   | Required | Default | Notes                                                                                    |
| ---------------- | ---------------------- | -------- | ------- | ---------------------------------------------------------------------------------------- |
| `goalId`         | `string`               | yes      | —       | Canonical goal identifier                                                                |
| `cycleId`        | `string`               | yes      | —       | Canonical cycle identifier                                                               |
| `planProof`      | `PlanProof`            | yes      | —       | Validated plan structure from upstream                                                   |
| `constraints`    | `Constraints`          | yes      | —       | Scheduling rules and capacity bounds                                                     |
| `nowISO`         | `string`               | yes      | —       | Time anchor for all date math — must be valid ISO                                        |
| `horizonDays`    | `number`               | no       | `14`    | **Known default bug** — 14 is too short for most goals. Caller must pass explicit value. |
| `acceptedBlocks` | `AcceptedBlock[]`      | no       | `[]`    | Previously committed blocks to avoid during placement                                    |
| `actionSequence` | `ActionSequenceItem[]` | no       | `[]`    | Ordered list of actions to schedule                                                      |
| `sessionPlan`    | `SessionPlanItem[]`    | no       | `[]`    | LLM-generated session detail layer                                                       |

### `Constraints` type

```typescript
type Constraints = {
  timezone: string;
  maxBlocksPerDay?: number; // default: Infinity (known issue — should default to 1)
  maxBlocksPerWeek?: number; // default: Infinity
  minSessionMinutes?: number;
  workingHoursWindows?: TimeWindow[];
  forbiddenTimeWindows?: TimeWindow[];
  forbiddenDayKeys?: string[];
  workableDayPolicy?: { weekdays?: Array<number | string> };
  weeklyWindows?: Partial<
    Record<string, Array<{ startHHMM: string; endHHMM: string }>>
  >;
  dayEndAtHHMM?: string;
  cycleStartDayKey?: string;
  cycleEndDayKey?: string;
  blackoutDates?: string[];
  calendarCommittedBlocksByDate?: Record<string, number>;
};
```

### `PlanProof` type

_(to be filled when extracted — pending paste)_

### `TimeWindow` type

_(to be filled when extracted — pending paste)_

---

## Allowed Outputs

Single return value of type `AutoAsanaPlan`:

```typescript
type AutoAsanaPlan = {
  graph: {
    tasks: any[];
    dependencies: any[];
    milestones: any[];
  };
  horizon: {
    startDayKey: string;
    endDayKey: string;
    daysCount: number;
  };
  horizonBlocks: Array<{
    id: string;
    dayKey: string;
    startISO: string;
    durationMinutes: number;
    kind: string;
    title: string;
    identityKey?: string;
    deliverableId?: string | null;
    actionId?: string | null;
    sessionIndex?: number | null;
  }>;
  conflicts: {
    kind: string;
    detail: string;
    code?: string; // ⚠ DRIFT: present in runtime, absent from declared type
    candidateResolutions?: string[];
  }[];
  recoveryOptions: {
    kind: string;
    detail: string;
  }[];
  audit: {
    generatedAtISO: string;
    goalId: string;
    cycleId: string;
    policyVersion: string;
  };
};
```

---

## Canonical Store Paths

| Artifact                            | Written by this module               | Read by                                               |
| ----------------------------------- | ------------------------------------ | ----------------------------------------------------- |
| `AutoAsanaPlan` return value        | yes — returned, not written directly | `identityCompute.js` assigns to `cycle.autoAsanaPlan` |
| `cycle.autoAsanaPlan.horizonBlocks` | indirect — via caller                | `applyDraftSchedule` reads as `state.proposedBlocks`  |
| `cycle.autoAsanaPlan.horizon`       | indirect — via caller                | `logGenerateDiagnostics` reads `daysCount`            |

**This module does not write to state directly.** It is a pure computation
function. All state writes happen in the caller (`identityCompute.js` line
5263).

---

## Deterministic Rule Set

1. **Horizon expansion:** walk from `startDayKey` to `endDayKey` (derived from
   `horizonDays`), emit one candidate slot per workable day per
   `constraints.weeklyWindows` or `workableDayPolicy`.

2. **Slot assignment:** for each session in `actionSequence` + `sessionPlan`,
   find the earliest available slot in `dayKeys` that satisfies:
   - not in `forbiddenDayKeys` or `blackoutDates`
   - not overlapping `acceptedBlocks` or previously placed sessions
   - within `workingHoursWindows` or `weeklyWindows`
   - within `maxBlocksPerDay` and `maxBlocksPerWeek` limits

3. **Identity key:** each block gets
   `identityKey = cycleId::deliverableId::actionId::sessionIndex` for dedup.

4. **Conflict reporting:** if a session cannot be placed, emit a conflict object
   with `kind`, `detail`, and `code` (note: `code` is not in declared type — see
   Known Failure Modes).

5. **Recovery options:** if conflicts exist, emit recovery suggestions
   (`EXTEND_HORIZON`, `INCREASE_MAX_PER_DAY`, etc.).

---

## Known Failure Modes

| Code                          | Description                                                                           | Status                                                             |
| ----------------------------- | ------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| `NO_ALLOWED_WINDOWS`          | `weeklyWindows` and `workableDayPolicy` both empty — no valid days to place blocks    | Active — emitted correctly                                         |
| `OVERLAP_ALL_SLOTS`           | All candidate slots are occupied by `acceptedBlocks`                                  | Active — emitted correctly                                         |
| `EXCEEDS_MAX_PER_DAY`         | `maxBlocksPerDay` constraint blocks placement                                         | Active — emitted correctly                                         |
| `EXCEEDS_MAX_PER_WEEK`        | `maxBlocksPerWeek` constraint blocks placement                                        | Active — emitted correctly                                         |
| `UNSCHEDULABLE`               | Horizon exists but no slot found for unknown reason                                   | Active — catchall                                                  |
| `DEFAULT_HORIZON_TOO_SHORT`   | `horizonDays` defaults to 14 when caller omits it — most goals need 30–120 days       | **Known architectural debt** — default should be removed or raised |
| `MAX_BLOCKS_PER_DAY_INFINITY` | `maxBlocksPerDay` defaults to `Infinity` causing block stacking                       | **Known architectural debt** — default should be 1                 |
| `CONFLICT_CODE_UNDECLARED`    | `code` field written to `conflicts[]` at runtime but absent from `AutoAsanaPlan` type | **Type drift** — declared type must be updated                     |

---

## Test Coverage Status

| Test file                                                                | Coverage area                      | Status                                               |
| ------------------------------------------------------------------------ | ---------------------------------- | ---------------------------------------------------- |
| `tests/state/autoAsanaPlan.distribution.spread.test.ts`                  | Horizon spread and distribution    | ✓ passing                                            |
| `tests/state/autoAsanaPlan.identityAndDistribution.test.ts`              | Identity key and dedup             | ✓ passing                                            |
| `tests/state/schedule.generate.actionsCanonicalPrecedence.test.js`       | Canonical action title precedence  | ✓ passing                                            |
| `tests/state/schedule.generate.materializesBlocks.orExplainsWhy.test.js` | Block materialization or conflict  | ✓ passing                                            |
| `tests/state/schedule.generatesFromWorkWindows.test.js`                  | Work window constraint enforcement | ✓ passing                                            |
| `tests/state/singlePipeline.postFix.integration.test.ts`                 | Full pipeline integration          | ✓ passing                                            |
| `tests/components/generatePlan.calendarIntegration.test.jsx`             | Calendar render integration        | ✗ failing — Bucket 3 (recomputeSummaries truncation) |

**Missing test coverage:**

- conflict resolution path — no test asserts on `conflicts[]` shape
- `recoveryOptions` emission — untested
- `maxBlocksPerDay` enforcement at boundary (1 block exactly) — untested
- `horizonDays` default behavior — untested (the 14-day default is a silent
  footgun)

---

## Boundary Audit

### What this module MAY read

- All fields of `Constraints` input
- `nowISO` for time anchoring
- `acceptedBlocks` for busy-slot detection
- `actionSequence` and `sessionPlan` for work content

### What this module MAY NOT do

- Write to `state` directly
- Read from `state` directly
- Call `applyDraftSchedule` or any commit function
- Mutate input arguments

### What this module MUST produce

- A valid `AutoAsanaPlan` object on every call — never `null`, never `undefined`
- `horizonBlocks` as an array — empty array if nothing can be placed, with
  `conflicts` explaining why
- `audit.generatedAtISO` populated on every call

### Known boundary leaks (YELLOW grade reasons)

1. `maxBlocksPerDay` defaults to `Infinity` inside the module — the caller
   cannot override this without passing an explicit constraint. This is a hidden
   default that causes stacking.
2. `horizonDays` defaults to `14` in the function signature — callers that
   forget to pass this get a silently truncated schedule.
3. `conflicts[].code` is written at runtime but not declared in the return type
   — consumers that read `code` have an undeclared dependency.

---

## Phase 2 Required Actions (to reach GREEN grade)

- [x] Raise `horizonDays` default from `14` to `90` as a temporary boundary
      safeguard until callers pass explicit horizon values
- [x] Add `code?: string` to `conflicts[]` in `AutoAsanaPlan` type declaration
- [x] Add `PlanProof` and `TimeWindow` type definitions to this sheet
- [ ] Add tests for conflict emission shape, recovery options, and boundary
      enforcement
- [ ] Write agent charter (Phase 3 prerequisite)

## Deferred Boundary Actions

| Action                                   | Reason deferred                                                                                                                                                          | Prerequisite                                                                                      |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------- |
| `maxBlocksPerDay` internal default → `1` | Breaks work-window generation tests that assume `Infinity` fallback. Requires explicit per-day constraints in those fixtures before the default can be tightened safely. | Fixture updates in `schedule.generatesFromWorkWindows` and `schedule.generate.materializesBlocks` |

### `PlanProof` type

```typescript
type PlanProof = {
  workableDaysRemaining: number;
  totalRequiredUnits: number;
  requiredPacePerDay: number;
  maxPerDay: number;
  maxPerWeek: number;
  slackUnits: number;
  slackRatio: number;
  intensityRatio: number;
};
```

### `TimeWindow` type

```typescript
type TimeWindow = { startMin: number; endMin: number };
```

---

## Agent Charter (Phase 3 — draft)

**Agent:** Scheduling Agent  
**Owns:** `compileAutoAsanaPlan` and all internal helpers in
`autoAsanaPlan.ts`  
**Autonomy level target:** Level 2 — bounded execution

**Allowed reads:**

- `Constraints` input
- `actionSequence` and `sessionPlan` inputs
- `acceptedBlocks` input
- `nowISO` and `horizonDays` inputs

**Allowed writes:**

- Return value only — `AutoAsanaPlan`

**Prohibited:**

- Direct state reads or writes
- Calling `applyDraftSchedule`, `createBlock`, or any persistence function
- Modifying input arguments

**Success definition:**

- `horizonBlocks.length` equals session count from `sessionPlan` when sufficient
  horizon exists
- All blocks have valid `startISO` parseable as ISO date
- All blocks have unique `identityKey`
- No block placed on `forbiddenDayKeys` or `blackoutDates`
- `conflicts[]` is empty when placement succeeds

**Failure codes this agent may return:**

- `NO_ALLOWED_WINDOWS`
- `OVERLAP_ALL_SLOTS`
- `EXCEEDS_MAX_PER_DAY`
- `EXCEEDS_MAX_PER_WEEK`
- `UNSCHEDULABLE`

**Handoff target:** `identityCompute.js` caller at line 5263 — assigns return
value to `cycle.autoAsanaPlan`

**Escalation behavior:** If placement fails for more than 50% of sessions, emit
`PARTIAL_SCHEDULE` conflict and return what was placed. Never return empty
`horizonBlocks` without a corresponding `conflicts[]` entry.
