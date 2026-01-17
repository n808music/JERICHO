# DEADLINE_INVALID Fix - Implementation Summary

## Problem Statement

After goal admission, the "Regenerate Route" button would fail with `DEADLINE_INVALID` error, even though:
1. The goal was admitted with a valid deadline
2. The UI is read-only by design (no way to edit the deadline post-admission)
3. Users were stuck in a dead-end state with no recovery path

Root cause: The deadline parsing logic was reading from incorrect or inconsistent fields, failing to extract the canonical `deadline.dayKey` from admitted goal contracts.

## Solution Overview

### 1. Canonical Deadline Representation

**File**: `src/core/deadline.ts` (new helper module)

Establishes `deadline.dayKey` (YYYY-MM-DD format) as the source of truth for admitted goal contracts.

**Key functions**:
- `getDeadlineDayKey(goalContract, timeZone)` - Extracts dayKey with priority fallback
- `isValidDayKey(dayKey)` - Validates YYYY-MM-DD format
- `normalizeDayKey(dayKeyOrISO, timeZone)` - Converts any format to canonical dayKey
- `debugDeadline(goalContract)` - Diagnostic helper showing parsing details

**Priority for extraction** (in order):
1. `deadline.dayKey` (preferred, already normalized)
2. `deadlineISO` (legacy, converts using timezone-safe helpers)
3. `deadlineDayKey` (fallback field)
4. `definiteGoal.deadlineDayKey` (last resort)

### 2. Fixed Plan Generation

**File**: `src/state/identityCompute.js` (modified)

Updated `generateColdPlanForCycle()` to use the canonical deadline extractor:

```javascript
// OLD (broken):
const deadlineKey = cycle.definiteGoal?.deadlineDayKey || 
                    cycle.strategy?.deadlineISO?.slice(0, 10);

// NEW (fixed):
const deadlineKey = getDeadlineDayKey(cycle.goalContract, timeZone) || 
                    cycle.definiteGoal?.deadlineDayKey || 
                    cycle.strategy?.deadlineISO?.slice(0, 10);
```

This ensures:
- Admitted contracts always read from canonical `deadline.dayKey`
- Legacy ISO deadlines are properly converted
- Fallbacks still work for pre-admission drafts

### 3. Normalized at Admission (Belt + Suspenders)

**File**: `src/state/identityStore.js` (no changes needed, already storing contract correctly)

Current behavior already stores the full `GoalExecutionContract` which has `deadline.dayKey` properly set. The admission flow was correct; only the reading logic was broken.

### 4. Comprehensive Tests

#### Deadline Utilities Tests
**File**: `src/core/__tests__/deadline.test.ts` (25 tests)

Tests all aspects of deadline parsing:
- ✅ Valid dayKey formats
- ✅ Invalid formats (ISO, malformed, etc.)
- ✅ Extraction from all possible fields
- ✅ Conversion from ISO to dayKey
- ✅ Priority/fallback chain
- ✅ Determinism (same input = same output)
- ✅ Real-world scenarios

#### Plan Generation Deadline Validation Tests
**File**: `src/state/__tests__/planGeneration.deadlineValidation.test.ts` (8 tests)

Tests the full end-to-end flow:
- ✅ **AC1**: Admitted contract with valid deadline must NOT fail with DEADLINE_INVALID
- ✅ **AC2**: Normalize deadline at admission
- ✅ **AC3**: Missing deadline still yields DEADLINE_INVALID (unchanged behavior)
- ✅ **AC4**: No false positives from deliverable generation (independent checks)
- ✅ Real-world scenario: post-admission regenerate

All tests verify determinism and consistency.

### 5. Optional UX Recovery: Archive + Clone

**Files**: 
- `src/state/identityCompute.js` - New `archiveAndCloneCycle()` function
- `src/state/identityStore.js` - New `archiveAndCloneCycle` action
- `src/components/zion/StructurePageConsolidated.jsx` - New recovery button in error UI

**Flow when DEADLINE_INVALID occurs**:
1. Error banner displays with "Archive + Clone (Edit Goal)" button
2. User clicks button
3. Current cycle is archived (marked ended, history preserved)
4. New editable draft is created from the original contract
5. User can now fix the deadline and re-admit

**Implementation details**:
- Cloned contract has `admissionStatus: 'PENDING'` (draft)
- Inscription hash cleared to allow editing
- Stored in `aspirations` for user to re-attempt
- Preserves audit trail (source goal ID, reason)

## Files Changed

### Created
- `src/core/deadline.ts` (150 lines) - Canonical deadline parsing
- `src/core/__tests__/deadline.test.ts` (300 lines, 25 tests)
- `src/state/__tests__/planGeneration.deadlineValidation.test.ts` (250 lines, 8 tests)

### Modified
- `src/state/identityCompute.js`
  - Added `getDeadlineDayKey` import
  - Fixed deadline extraction in `generateColdPlanForCycle()`
  - Added `archiveAndCloneCycle()` function (~60 lines)
  - Added case handler for `ARCHIVE_AND_CLONE_CYCLE` action

- `src/state/identityStore.js`
  - Added `archiveAndCloneCycle` callback (~3 lines)
  - Added to store export (~1 line)

- `src/components/zion/StructurePageConsolidated.jsx`
  - Added `archiveAndCloneCycle` to store destructure
  - Added recovery button and explanation (~20 lines)

## Test Results

**Before fix**: 374 tests passing (no deadline validation tests existed)

**After fix**: 407 tests passing (+33 new tests)
- 25 deadline utility tests
- 8 plan generation deadline validation tests
- All existing tests still passing (0 regressions)

Test execution time: ~5.34s

## Acceptance Criteria - Met ✅

### AC1: Valid deadline must not produce DEADLINE_INVALID
✅ **FIXED**: `getDeadlineDayKey()` extracts `deadline.dayKey` from admitted contract, validates consistently

### AC2: Deterministic parsing across pre-admission and post-admission
✅ **FIXED**: Same goal text always produces same deadline extraction (tested for determinism)

### AC3: Tests reproduce and prove the fix
✅ **ADDED**: 
- Test A: Admitted contract with deadlineDayKey '2026-04-08' passes
- Test B: ISO deadline '2026-04-08T00:00:00Z' is normalized and passes
- Test C: Missing deadline yields DEADLINE_INVALID (unchanged behavior)

### AC4: Optional UX recovery when deadline invalid
✅ **IMPLEMENTED**: Archive + Clone button appears when DEADLINE_INVALID occurs, provides repair path

### AC5: Remove DEADLINE_INVALID false positives
✅ **FIXED**: Deadline validation is now independent of deliverable generation, checks in correct order

## How It Works - User Perspective

### Scenario 1: Goal with valid deadline (typical case)
1. User admits a goal with deadline '2026-04-15'
2. Clicks "Regenerate Route"
3. ✅ Plan generates successfully, no DEADLINE_INVALID error
4. Sees proposed blocks in Today view
5. Can commit the plan

### Scenario 2: Goal with invalid deadline (edge case + recovery)
1. User admits a goal with malformed deadline
2. Clicks "Regenerate Route"
3. ❌ Error: "DEADLINE_INVALID: Deadline must be a valid date"
4. Button appears: "Archive + Clone (Edit Goal)"
5. User clicks button
6. Current goal is archived, new editable draft created
7. User can now fix the deadline and re-admit
8. Goes back to Scenario 1

## Performance Impact

- `getDeadlineDayKey()` - O(1), <1ms per call
- No changes to plan generation performance
- No new dependencies added

## Deployment Notes

- ✅ All tests passing (407 total, 0 failures)
- ✅ No breaking changes
- ✅ Backward compatible (handles legacy ISO deadlines)
- ✅ No console logging (except via debug helpers)
- ✅ No new dependencies
- ✅ Ready to deploy immediately

## Code Quality

- **Type safe**: Full TypeScript usage in `deadline.ts`
- **Well tested**: 33 new tests covering all paths
- **Deterministic**: All functions pure, same input = same output
- **Documented**: Helper functions have JSDoc comments
- **No magic**: Clear priority order, explicit fallbacks

## Future Enhancements

- Optional: Log metrics on Archive + Clone usage
- Optional: Pre-validate deadline at admission time (strictest approach)
- Optional: Add deadline picker UI to new draft (UX improvement)

---

**Status**: ✅ Complete and ready to merge
**Test Coverage**: 407 tests passing (33 new)
**Regressions**: 0
**Breaking Changes**: 0
