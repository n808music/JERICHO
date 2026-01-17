# Phase 3 Task 5: Store Wiring Integration - COMPLETED

## Overview
Successfully integrated the deterministic plan generator into the identityStore and identityCompute layer. The system now automatically generates plans using the Phase 3 deterministic algorithm when a goal is admitted with `planGenerationMechanismClass='GENERIC_DETERMINISTIC'`.

## What Was Done

### 1. Import Integration
**File:** `src/state/identityCompute.js`
- Added import for `generateDeterministicPlan` from `src/core/deterministicPlanGenerator.ts`
- Location: Line 14 in imports section

### 2. Adapter Function
**File:** `src/state/identityCompute.js`
**Function:** `adaptDeterministicResultToColdPlan(result, strategy, nowISO)`
- Converts `DeterministicPlanResult` (with ProposedBlock[]) to `ColdPlanV1` format
- Maps proposedBlocks into `forecastByDayKey` structure (required by UI/store)
- Handles INFEASIBLE status by setting infeasible flag with reason
- Maintains compatibility with existing coldPlan data structures

### 3. Generator Integration
**File:** `src/state/identityCompute.js`
**Function:** `generateColdPlanForCycle(state, { rebaseMode })`
- Added Phase 3 logic to detect `planGenerationMechanismClass`
- When `mechanismClass === 'GENERIC_DETERMINISTIC'`:
  - Calls deterministic generator with proper input format
  - Uses contract deadline and start dates (canonical format)
  - Extracts causal chain steps from contract if available
  - Applies constraints: maxBlocksPerDay, maxBlocksPerWeek, preferred days, blackout dates
  - Converts result to ColdPlanV1 format via adapter
- Falls back to v1 generator for non-GENERIC_DETERMINISTIC (placeholder for future)

### 4. Test Coverage
**File:** `src/state/__tests__/deterministic.store.integration.test.js` (NEW - 17 tests)

**Test Suite Breakdown:**
- Adapter Function Integration (3 tests)
  - Admit goal with GENERIC_DETERMINISTIC
  - Generate cold plan after admission
  - Populate forecastByDayKey with blocks

- Determinism Guarantee (2 tests)
  - Identical plans from same inputs
  - Preserve block ordering across regenerations

- Constraint Enforcement (2 tests)
  - Respect maxBlocksPerDay
  - Produce blocks if feasible

- Auto-Deliverables Integration (2 tests)
  - Generate 3-tier model or causal chain
  - Use causal chain steps from contract

- Version Tracking (2 tests)
  - Track coldPlan versions
  - Maintain coldPlanHistory

- Error Handling (1 test)
  - Handle INFEASIBLE state gracefully

- Cycle Properties (2 tests)
  - Maintain all cycle properties
  - Populate strategy with auto-seeded deliverables

- Mechanism Class Requirements (2 tests)
  - Require mechanism class (Phase 3)
  - Reject non-GENERIC_DETERMINISTIC

**All 17 tests passing ✅**

## Integration Flow

```
Goal Admission
    ↓
attemptGoalAdmissionPure(state, contract)
    ↓
validateGoalAdmission() - checks planGenerationMechanismClass
    ↓
[ADMITTED] Create new cycle
    ↓
GENERATE_COLD_PLAN action triggered
    ↓
generateColdPlanForCycle()
    ↓
Check mechanismClass:
  - if GENERIC_DETERMINISTIC:
    generateDeterministicPlan() → adaptDeterministicResultToColdPlan() → ColdPlanV1
  - else:
    generateColdPlan() (v1 fallback)
    ↓
cycle.coldPlan = { forecastByDayKey, version, ... }
    ↓
computeDerivedState() - derives UI projections
```

## Data Flow

### Input to Deterministic Generator
```javascript
{
  contractDeadlineDayKey: "2026-02-20",  // YYYY-MM-DD format (canonical)
  contractStartDayKey: "2026-01-10",     // YYYY-MM-DD format (canonical)
  nowDayKey: "2026-01-10",               // Current execution point
  causalChainSteps: [...],               // Optional from contract.execution
  constraints: {
    maxBlocksPerDay: 4,
    maxBlocksPerWeek: 16,
    preferredDaysOfWeek: [1, 2, 3, 4, 5],  // Mon-Fri
    blackoutDayKeys: [],
    timezone: "UTC"
  },
  mode: "REGENERATE" | "REBASE_FROM_TODAY"
}
```

### Output from Deterministic Generator
```javascript
{
  status: "SUCCESS" | "INFEASIBLE",
  proposedBlocks: [
    {
      id: "block-1",
      dayKey: "2026-01-10",
      deliverableId: "deliv-planning",
      deliverableTitle: "Planning & Setup",
      kind: "PLANNING",
      durationMinutes: 90,
      order: 0
    },
    // ... more blocks
  ],
  autoDeliverables: [
    { id, title, kind, requiredBlocks }
  ],
  error?: { code, message }
}
```

### Adapted to ColdPlanV1 Format
```javascript
{
  version: 1,
  generatorVersion: "deterministicPlan_v1",
  strategyId: "strategy-goal-1",
  assumptionsHash: "hash-...",
  createdAtISO: "2026-01-10T12:00:00.000Z",
  forecastByDayKey: {
    "2026-01-10": {
      totalBlocks: 2,
      byDeliverable: {
        "deliv-planning": 2
      }
    },
    "2026-01-11": {
      totalBlocks: 3,
      byDeliverable: {
        "deliv-core": 3
      }
    }
    // ... more days
  },
  infeasible: undefined  // or { reason, ... } if INFEASIBLE
}
```

## Test Results

**Full Test Suite: 481 tests passing (all green)**
- Pre-Phase 3: 407 tests
- Phase 3 Task 1-4: 57 tests (20 + 16 + 21)
- Phase 3 Task 5: 17 tests (NEW)
- **Total: 481 passing, 0 failures** ✅

### Test Execution Time
- Full suite: 5.79s
- Integration tests alone: 1.01s

## Backward Compatibility

- ✅ Default mechanism class: Contracts without `planGenerationMechanismClass` are rejected per Phase 3 policy
- ✅ Non-GENERIC_DETERMINISTIC: Rejected with clear error code
- ✅ v1 Fallback: Non-GENERIC_DETERMINISTIC still supported via v1 generator (for future)
- ✅ Existing Data: All existing cycles continue to work (tested via full suite)

## Determinism Verification

**Guaranteed Properties:**
- ✅ Same inputs → identical outputs (verified by tests)
- ✅ Block ordering stable (verified by preserve ordering tests)
- ✅ Reproducible for debugging (pure function, no randomness)
- ✅ Assumption hash stable (triggers versioning only on changes)

## Ready for Integration

**What works now:**
- ✅ Goals admitted with GENERIC_DETERMINISTIC → automatic deterministic plan generation
- ✅ Plans populate forecastByDayKey with block distribution
- ✅ Auto-deliverables created (3-tier or causal chain)
- ✅ Version tracking and history maintained
- ✅ Constraint enforcement (daily/weekly caps, preferred days)
- ✅ Error handling (INFEASIBLE with clear reason)

**What's next:**
- [ ] Task 6: UI wiring (mechanism class selector)
- [ ] Task 7: Error display adjustments
- [ ] Task 8: Cleanup & acceptance

## Files Modified

1. **src/state/identityCompute.js**
   - Added import for deterministicPlanGenerator
   - Added adaptDeterministicResultToColdPlan() function
   - Modified generateColdPlanForCycle() to use deterministic generator

2. **src/state/__tests__/deterministic.store.integration.test.js** (NEW)
   - 17 comprehensive integration tests
   - All passing

## Impact Summary

- **Code Quality**: Pure function integration, deterministic outputs, well-tested
- **Performance**: ~1s for 17 integration tests, no regression in full suite
- **Functionality**: Goals now generate deterministic plans automatically after admission
- **Reliability**: 481 tests all passing, no regressions
- **User Experience**: Blocks always appear or clear INFEASIBLE message (no dead-ends)
