# E9 Site 8 Fix — Scheduler Input appTime Refresh

## Missing Site Location
**File:** `src/state/identityCompute.js`  
**Line:** 12778  
**Function:** `routeGenerateSchedule()`  

Current code:
```javascript
const runtimeNowISO = new Date().toISOString();  // FRESH TIME COMPUTED
// ... other setup ...
const nowISO = state.appTime?.nowISO || runtimeNowISO;  // BUG: PREFERS STALE
```

## Root Cause
The scheduler input computes `runtimeNowISO` (fresh) on line 12776 but then **ignores it** in favor of stale `state.appTime?.nowISO` on line 12778. This breaks scheduler decisions when `appTime` is out of date.

## The Fix (Respects timeIsPinned Guard)
Replace line 12778 to route through `setAppTime()`:

```javascript
// Line 12778 replacement
setAppTime(state, {
  mode: 'scheduler_input',
  respectPin: true,  // KEY: respects timeIsPinned guard
});
// After setAppTime, use the potentially-refreshed value
const nowISO = state.appTime?.nowISO || runtimeNowISO;
```

This ensures:
- **Pinned tests** (`timeIsPinned: true`): Keep their fixture-frozen `nowISO` as-is
- **Unpinned tests** (`isFollowingNow: true`, no pin): Get fresh time via `setAppTime()`

## Test Cases
### Case 1: Unpinned, isFollowingNow (should use fresh time)
- Fixture: `appTime.nowISO = '2026-05-19'` (stale), `isFollowingNow: true`
- Expected: scheduler gets fresh time (e.g., `2026-08-22`)
- Test: `schedule.generate.nonSilent.test.js > passes the live runtime floor...`

### Case 2: Pinned (should keep fixture time)
- Fixture: `appTime.nowISO = '2026-05-19'`, `timeIsPinned: true`
- Expected: scheduler gets fixture time (`2026-05-19`)
- Test: NEW — write this to verify pin is respected

## Implementation Steps
1. Modify `setAppTime()` helper to handle `mode: 'scheduler_input'` (if not already)
2. Apply fix to line 12778
3. Write test Case 2 (pinned scenario)
4. Run suite and verify:
   - `schedule.generate.nonSilent.test.js` passes
   - Pinned tests still pass
5. Check how many of the 36 failures this clears

## Risk Assessment
- **HIGH CONFIDENCE** this fixes the identified issue
- **MEDIUM CONFIDENCE** about other failures (some may be unrelated)
- **LOW RISK** of regression because fix respects existing `timeIsPinned` guard
