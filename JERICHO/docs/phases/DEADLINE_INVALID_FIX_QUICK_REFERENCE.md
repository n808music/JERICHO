# DEADLINE_INVALID Fix - Quick Reference

## The Problem
Goal admission succeeded, but "Regenerate Route" fails with `DEADLINE_INVALID` error. UI is read-only (can't edit), so user is stuck.

## The Root Cause
Plan generator was reading deadline from wrong/inconsistent fields instead of the canonical `deadline.dayKey`.

## The Solution

### 1. New Helper: `src/core/deadline.ts`
```typescript
// Extract deadline from contract (handles all formats)
const dayKey = getDeadlineDayKey(goalContract, 'UTC');
// Returns: '2026-04-08' or null

// Validate format
if (isValidDayKey(dayKey)) { /* ... */ }
// Returns: true/false

// Debug why parsing failed
const diagnostic = debugDeadline(goalContract);
// Returns: { dayKey, source, isValid, error }
```

### 2. Fixed: `src/state/identityCompute.js`
```javascript
// OLD (broken):
const deadlineKey = cycle.strategy?.deadlineISO?.slice(0, 10);

// NEW (fixed):
const deadlineKey = getDeadlineDayKey(cycle.goalContract, timeZone);
```

### 3. New Feature: Archive + Clone
When `DEADLINE_INVALID` error occurs:
- Button appears: "Archive + Clone (Edit Goal)"
- User clicks → Current cycle archived, new editable draft created
- User fixes deadline and re-admits
- Plan generation works

## Priority: Which Deadline Field?

1. ✅ `deadline.dayKey` (preferred, canonical format)
2. ✅ `deadlineISO` (legacy, converted automatically)
3. ✅ `deadlineDayKey` (fallback)
4. ✅ `definiteGoal.deadlineDayKey` (last resort)

## Testing

All 407 tests passing:
- 25 deadline utility tests
- 8 plan generation deadline validation tests
- All existing tests (0 regressions)

## Usage Examples

### Extract deadline from admitted contract
```javascript
const cycle = state.cyclesById[activeCycleId];
const dayKey = getDeadlineDayKey(cycle.goalContract, 'UTC');
// Returns: '2026-04-15' or null
```

### Validate deadline in plan generation
```javascript
const deadlineKey = getDeadlineDayKey(cycle.goalContract, timeZone);
if (!deadlineKey || !deadlineKey.match(/^\d{4}-\d{2}-\d{2}$/)) {
  // DEADLINE_INVALID
  diagnosticReasons.push('DEADLINE_INVALID: ...');
}
```

### Debug why deadline parsing failed
```javascript
const diag = debugDeadline(contract);
console.log(diag.source); // 'deadline.dayKey' or 'deadlineISO', etc.
console.log(diag.error);  // Reason for failure, if any
```

### Trigger archive + clone (recovery)
```javascript
// In component
store.archiveAndCloneCycle(activeCycleId);

// In store
archiveAndCloneCycle(cycleId, overrides);
```

## Files to Know

### Core
- `src/core/deadline.ts` - Canonical deadline parsing
- `src/state/identityCompute.js` - Plan generation (uses deadline helper)

### Tests
- `src/core/__tests__/deadline.test.ts` - Deadline utility tests
- `src/state/__tests__/planGeneration.deadlineValidation.test.ts` - Integration tests

### UI
- `src/components/zion/StructurePageConsolidated.jsx` - Error banner + recovery button

## Key Concepts

**Canonical Format**: `YYYY-MM-DD` (e.g., `'2026-04-08'`)
- Stable across timezones
- Used in all comparisons
- Stored in `deadline.dayKey`

**Determinism**: Same goal always produces same deadline extraction
- Pure functions, no side effects
- Testable via deep equality
- Reproducible across runs

**Backward Compatibility**: Handles legacy ISO deadlines
- Automatically converts to canonical format
- All old tests still pass
- No breaking changes

## Troubleshooting

### "DEADLINE_INVALID but deadline looks fine"
→ Use `debugDeadline()` to see which field was read and where parsing failed

### "Archive + Clone button not appearing"
→ Check if error code is `PLAN_PRECONDITIONS_FAILED` AND reasons include `'DEADLINE_INVALID'`

### "Plan generation still fails after fix"
→ Check if there are other failures (e.g., NO_DELIVERABLES)
→ Use `lastPlanError?.details` to see all diagnostics

## Architecture Note

**Why separate deadline from deliverables?**
- Deadline: Contract metadata (set at admission)
- Deliverables: Strategy data (can be auto-generated)
- Both independent ✓
- Either can fail independently ✓
- Easy to debug ✓

---

**Version**: 1.0 (Initial implementation)
**Status**: ✅ Complete, 407 tests passing, 0 regressions
**Last Updated**: 2026-01-12
