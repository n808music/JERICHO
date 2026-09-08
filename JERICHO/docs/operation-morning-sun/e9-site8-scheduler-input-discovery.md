---
name: e9-site8-scheduler-input-discovery
description: "E9 missing Site 8 identified — scheduler input path (line 12778) prefers stale appTime over fresh, breaks planning"
metadata: 
  node_type: memory
  type: project
  date: 2026-08-22T03:30Z
  originSessionId: b755537e-0f88-49c4-92b8-84a3bc170178
  modified: 2026-08-22T08:29:19.075Z
---

# E9: Missing Site 8 — Scheduler Input appTime

## Discovery
**Status:** ROOT CAUSE CONFIRMED, FIX STRATEGY DESIGNED, READY TO IMPLEMENT

During systematic scan of failing tests, traced `schedule.generate.nonSilent.test.js` failure to a missing `setAppTime()` wiring in the scheduler code path.

## The Missing Site
**Location:** `src/state/identityCompute.js:12778` in `routeGenerateSchedule()`

**Problem:** Code computes fresh time (`runtimeNowISO`) on line 12776 but then **throws it away** and uses stale persisted `state.appTime?.nowISO` on line 12778.

```javascript
const runtimeNowISO = new Date().toISOString();  // FRESH
const nowISO = state.appTime?.nowISO || runtimeNowISO;  // STALE PREFERRED
const nowDayKeyFromClock = dayKeyFromISO(nowISO, ...);  // propagates stale
const schedulerStartDayKey = maxDayKey(nowDayKeyFromClock, ...);  // stale result
const anchorNowISO = `${schedulerStartDayKey}T12:00:00.000Z`;  // stale to scheduler
// Passed to compileAutoAsanaPlan({ nowISO: anchorNowISO })
```

**Impact:** Scheduler makes block-generation decisions based on stale date, breaking tests that expect fresh time.

## The Fix (Verified Safe)
Route line 12778 through `setAppTime()` to respect `timeIsPinned` guard:

```javascript
setAppTime(state, {
  mode: 'scheduler_input',
  respectPin: true,  // respects timeIsPinned
});
const nowISO = state.appTime?.nowISO || runtimeNowISO;  // now uses guard logic
```

**Why this is safe:** 
- Pinned tests keep their fixture times (guard prevents refresh)
- Unpinned tests get fresh time (guard allows refresh)
- No bypass of existing guard logic

## Wiring Status Summary
- **Wired sites:** 7 (3 in identityStore + 4 in identityCompute)
- **Missing site:** Site 8 (scheduler input, line 12778)
- **Scope:** This is separate from Pattern C fixture issues; it's a missing code path

## Known Issues to Avoid
- Don't unconditionally use `runtimeNowISO` (breaks pinned tests)
- Don't assume other 99+ `state.appTime?.nowISO || <fresh>` patterns are benign (at least line 7582 in `applyProbabilityScoring` is also scheduling-relevant)
- Check each failing test individually, not by name pattern

## Related Issues
- Test `schedule.generate.nonSilent.test.js::passes the live runtime floor...` (expects fresh time, gets stale)
- Possibly `applyProbabilityScoring` line 7582 (similar pattern, probability scoring time-dependent)
- Pre-existing: test was documented as brittle (hardcoded date expectations) in earlier session

## Next Steps
1. ✅ Confirm wiring status (done)
2. ✅ Identify missing site (done)
3. 🔲 Apply Site 8 fix (call setAppTime at line 12778)
4. 🔲 Write test Case 2 (pinned time scenario) to verify guard
5. 🔲 Re-run suite, measure impact on 36 failures
6. 🔲 Triage remaining failures individually

## Files Modified
- `E9_SITE8_FIX_PLAN.md` — implementation details
- Memory: this file
