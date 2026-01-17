# Validation Architecture Design

**Date**: 2026-01-17
**Status**: Approved
**Purpose**: Comprehensive validation strategy for Jericho system health, data integrity, and operational correctness

## Context

### Problem Statement
The Jericho system has experienced issues across multiple layers:
- Pipeline breaks (tasks not generating, scoring failures)
- State drift (completed tasks showing as active, identity state mismatches)
- UI inconsistencies (display doesn't match backend state)
- Edge case failures (cycle boundaries, empty states, unusual inputs)

### Goals
1. Build internal confidence that the system operates correctly
2. Provide evidence for technical reviewers examining the implementation
3. Catch issues at boundaries rather than letting them propagate silently

## Architecture Overview

| Layer | Purpose | Trigger Points |
|-------|---------|----------------|
| Schema Validation | Field types, required fields, enums | State read/write, API boundaries |
| Invariant Assertions | Business rules enforcement | Before state persist, dev mode reads |
| Pipeline Validation | Pre/post conditions per stage | Every pipeline execution |
| UI-Backend Consistency | Response validation, drift detection | Every API call, after mutations |
| Health Check & Reporting | Aggregated checks, evidence generation | On-demand endpoint, CLI, CI |

## Layer 1: Schema Validation

### Location
`src/core/validation/schemas.js`

### Approach
Define entity shapes using lightweight validator functions (no heavy dependencies). Each validator returns `{ valid: boolean, errors: string[] }`.

### Entities to Validate

**State**:
- `goals`: array of strings or goal objects
- `identity`: object with domain -> capability -> level mappings
- `history`: array of history entries
- `tasks`: array of task objects
- `integrity`: object with score, counts, lastRun
- `team`: users, teams, roles structure

**Task**:
- `id`: non-empty string, unique
- `title`: non-empty string
- `description`: string
- `domain`: non-empty string
- `capability`: non-empty string
- `status`: enum `"pending" | "completed" | "missed"`
- `dueDate`: valid ISO date string
- `createdAt`: valid ISO date string

**History Entry** (two shapes):
- Cycle snapshot: `timestamp`, `goalId`, `integrity`, `identityBefore`, `identityAfter`, `changes`
- Task record: `id`, `taskId`, `domain`, `capability`, `status`, `timestamp`, `integrity`

### Validation Points
1. `safeReadState()` — validate after JSON parse
2. `writeState()` — validate before persist
3. API request/response boundaries

## Layer 2: Invariant Assertions

### Location
`src/core/validation/invariants.js`

### Function Signature
```javascript
checkInvariants(state) → { valid: boolean, violations: Violation[] }
// Violation: { invariant: string, message: string, context: object }
```

### Invariants

| ID | Rule | Rationale |
|----|------|-----------|
| INV-001 | Task-History Consistency | Every completed/missed task must have a history entry |
| INV-002 | Integrity Score Coherence | `completedCount + pendingCount` equals non-archived task count |
| INV-003 | No Orphaned References | `task.goalLink` must reference existing goal |
| INV-004 | Identity Level Bounds | All capability levels must be integers 1-5 |
| INV-005 | Temporal Sanity | `task.createdAt <= task.dueDate`; history ordered by timestamp |
| INV-006 | No Duplicate IDs | Task and history entry IDs unique within collections |

### Failure Behavior
- **Production**: Log violation, alert, continue (no crash)
- **Development/Test**: Throw immediately to surface bugs

## Layer 3: Pipeline Validation

### Location
`src/core/validation/pipeline-guards.js`

### Pattern
```javascript
const withValidation = (stageFn, validateInput, validateOutput) => (input) => {
  const inputCheck = validateInput(input);
  if (!inputCheck.valid) throw new ValidationError('pre', inputCheck.errors);

  const result = stageFn(input);

  const outputCheck = validateOutput(result);
  if (!outputCheck.valid) throw new ValidationError('post', outputCheck.errors);

  return result;
};
```

### Stage Contracts

| Stage | Pre-condition | Post-condition |
|-------|--------------|----------------|
| Identity Requirements | Valid goal string/object | Array of requirements with domain, capability, targetLevel |
| Gap Detection | Valid requirements + identity | Gaps where currentLevel < targetLevel |
| Task Generation | Valid gaps | Tasks with all required fields, unique IDs |
| Integrity Scoring | Valid tasks + history | Score 0-100, counts match statuses |
| Reinforcement | Valid score + identity | Identity changes within level bounds |

### Test Structure
- Unit tests: Happy path per stage
- Property-based tests: Edge cases (empty inputs, boundaries)
- Integration tests: Full pipeline with invariant checks on final state

## Layer 4: UI-Backend Consistency

### API Response Validation
Every endpoint wraps response through `validateResponse(data, schema)`. Malformed responses return 500 with details rather than reaching the UI.

### Frontend Contract
```javascript
const fetchState = async () => {
  const response = await fetch('/api/state');
  const data = await response.json();

  const check = validateState(data);
  if (!check.valid) {
    console.error('Backend returned invalid state:', check.errors);
    // Show error UI, not corrupted data
  }
  return data;
};
```

### Drift Detection
- After mutations, re-fetch and compare with optimistic update
- Reconcile or alert on mismatch
- Optional checksum for quick change detection

### Test Coverage
- Contract tests: Mock valid/invalid API responses
- Snapshot tests: Render with edge-case state
- E2E smoke test: Full flow verifying UI reflects each state change

## Layer 5: Health Check & Reporting

### Health Endpoint
`GET /api/health`

```json
{
  "status": "healthy | degraded | unhealthy",
  "timestamp": "2026-01-17T...",
  "checks": {
    "stateSchema": { "valid": true, "errors": [] },
    "invariants": { "valid": true, "violations": [] },
    "pipelineReady": { "valid": true, "lastRunAt": "..." },
    "dataIntegrity": { "valid": false, "issues": ["2 orphaned task references"] }
  }
}
```

### CLI Command
`npm run validate`

- Loads current state file
- Runs schema validation, invariants, referential integrity
- Human-readable output with pass/fail per check
- Exit code 0 (all pass) or 1 (any fail) for CI

### Validation Report
Generated markdown for reviewers:
- Summary: X passed, Y failed
- Per-layer breakdown with specific errors
- Recommendations for fixes
- Timestamp and state file hash for auditability

## File Structure

```
src/core/validation/
  index.js            # Public exports
  schemas.js          # Entity shape definitions
  validators.js       # validateState, validateTask, etc.
  invariants.js       # checkInvariants, individual invariant functions
  pipeline-guards.js  # withValidation wrapper, stage validators
  health.js           # aggregateHealthCheck, generateReport
```

## Implementation Priorities

1. **Schema validators** — Foundation for everything else
2. **Invariant checks** — Catches state drift immediately
3. **State read/write integration** — Quarantine invalid data
4. **Health endpoint + CLI** — Provides reviewer evidence
5. **Pipeline guards** — Stage-level fail-fast
6. **UI validation** — Frontend safety net

## Success Criteria

- [ ] All existing tests pass with validation integrated
- [ ] `npm run validate` returns clean on `state_good.json`
- [ ] `npm run validate` catches issues in `state_broken.json`
- [ ] Health endpoint returns structured check results
- [ ] Technical reviewers can run validation and understand output
