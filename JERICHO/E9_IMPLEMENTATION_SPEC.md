# E9: appTime Refresh Guard with timeIsPinned — Implementation Spec

**Status:** READY FOR IMPLEMENTATION  
**Last Updated:** 2026-08-22  
**Implementation Path:** Step 0 gaps closed → Step 1-4 execution

---

## Step 0: Spec Gaps — CLOSED

### Gap 1: Site 6 Decision

**Decision:** ✅ **REFACTOR ALL 6 SITES TO USE setAppTime()**

**Rationale:**
- Single source of truth for "how should appTime be set" logic
- Ensures `timeIsPinned` guard is respected consistently across all 6 sites
- Prevents duplication-risk bugs (one site updated, another left stale)
- Existing pattern: E8 fix used centralized helper to respect context, same pattern applies here

**Alternative considered:** Keep Site 6 as separate inline `!next.appTime.timeIsPinned` check
- **Rejected:** Creates two independent implementations of the same guard logic
- Risk: future maintainer updates one place, not the other
- This project has been burned by this pattern before (see git history for E8-adjacent refactorings)

---

### Gap 2: Fixture File List

**Run date:** 2026-08-22  
**Search criteria:** Test files that construct `appTime` with `nowISO` or `activeDayKey`

**Result:** 53 files (not 45)

**List of 53 files requiring `timeIsPinned: true`:**

```
src/core/__tests__/draftSchedule.autoplacement.test.ts
src/core/__tests__/midnightRollover.test.ts
src/core/__tests__/rollover.properties.test.ts
src/core/engine/flowIncompleteToBacklog.test.ts
src/domain/autoSeed.admission.test.ts
src/domain/goal/LaunchIdentityPolicy.crossDomain.test.ts
src/domain/masterPlan/artifactDependencyIntegrity.test.js
src/domain/masterPlan/exportFullHorizonSchedule.test.js
src/state/__tests__/audit_d09_d12_lifecycle.test.ts
src/state/__tests__/audit_rc03_lt_rerun.test.ts
src/state/__tests__/audit_rc03_st_rerun.test.ts
src/state/__tests__/buildMasterPlanOperationalDescriptors.cycleRebase.test.js
src/state/__tests__/capacitySeed.integration.test.js
src/state/__tests__/commitPreviewItems.invariant.test.js
src/state/__tests__/confirmCapacity.test.js
src/state/__tests__/cycle_scoping_no_mix.test.js
src/state/__tests__/cycle.boundary.properties.test.ts
src/state/__tests__/cycle.scoping.test.js
src/state/__tests__/cycle.switching.test.js
src/state/__tests__/declareDependency.test.js
src/state/__tests__/deliverableUrgency.blockingChain.test.js
src/state/__tests__/deliverableUrgency.multiHopCrossLane.test.js
src/state/__tests__/dependencySatisfactionMode.e2e.test.js
src/state/__tests__/deterministic.store.integration.test.js
src/state/__tests__/e9-apptime-refresh-guard.test.js
src/state/__tests__/entity.noroletags.test.js
src/state/__tests__/forecast_and_commit_do_not_mix.test.js
src/state/__tests__/generateApply.gating.test.js
src/state/__tests__/generateApply.integration.test.js
src/state/__tests__/generateColdPlan.canonicalSchedule.test.js
src/state/__tests__/generateColdPlan.matrixCapacity.test.js
src/state/__tests__/generateColdPlan.matrixCausalChain.test.js
src/state/__tests__/generatePlan.missingGoalDraft.recovery.test.js
src/state/__tests__/generateSchedule.routing.test.js
src/state/__tests__/hard_delete_removes_learning_contributions.test.js
src/state/__tests__/identityStore.completeBlock.projections.test.js
src/state/__tests__/identityStore.goalAdmission.test.js
src/state/__tests__/learning_updates_only_from_ended_cycles.test.js
src/state/__tests__/manual_blocks_contribute.test.js
src/state/__tests__/mvp3_end_to_end.test.js
src/state/__tests__/mvp3_linkage_integrity.test.js
src/state/__tests__/mvp3_terminal_convergence.test.js
src/state/__tests__/probability.initial.test.js
src/state/__tests__/progressCredit.gating.test.js
src/state/__tests__/scheduleTemporalDrift.activation.test.js
src/state/__tests__/scheduleTemporalRebase.test.js
src/state/__tests__/setInitiativePhase.test.js
src/state/__tests__/stress.invariants.test.js
src/state/__tests__/stress.scale.test.js
src/state/__tests__/suggestion.accept.idempotence.test.js
src/state/__tests__/zzz_debug_activate.test.js
src/state/engine/feasibility.upperbound.test.ts
src/state/engine/mergePriorTodayBlocks.regression.test.ts
```

**Note:** Fresh run returned 53, not 45. **Real finding:** Either (a) prior estimate was conservative, (b) 8 files have been added since the prior analysis, or (c) definition of "fixture file" has broadened. This is NOT a regression—it is a more complete inventory.

---

## Implementation Sites (6 Total)

### Site 1: identityStore.js:2535
**Function:** Reducer initialization guard (fallback if `nowISO` missing)  
**Current code:**
```javascript
if (!state.appTime.nowISO) {
  state.appTime.nowISO = new Date().toISOString();
}
```
**Category:** Initialization guard (must capture real time on first run)  
**Will refactor to:** `setAppTime(state, { mode: 'init' })`

---

### Site 2: identityStore.js:2538
**Function:** Reducer initialization guard (derive `activeDayKey` if missing)  
**Current code:**
```javascript
if (!state.appTime.activeDayKey) {
  state.appTime.activeDayKey = dayKeyFromISO(state.appTime.nowISO, state.appTime.timeZone);
}
```
**Category:** Dependent derivation (computes day-key from `nowISO`)  
**Will refactor to:** `setAppTime()` call will handle both `nowISO` and `activeDayKey` together

---

### Site 3: identityStore.js:3032
**Function:** Reducer action handler (activate new cycle)  
**Current code:**
```javascript
if (draft.appTime) {
  draft.appTime.activeDayKey = startDayKey;
}
```
**Category:** Purposeful update (when transitioning to new cycle)  
**Will refactor to:** `setAppTime(draft, { activeDayKey: startDayKey, mode: 'transition' })`

---

### Site 4: identityCompute.js:11917
**Function:** `ensureTodayState()` or similar (activate new cycle in derived state)  
**Current code:**
```javascript
if (state.appTime?.isFollowingNow) {
  state.appTime.activeDayKey = startDayKey;
}
```
**Category:** Conditional update (only if following now)  
**Will refactor to:** `setAppTime(state, { activeDayKey: startDayKey, respectPin: true })`

---

### Site 5: identityCompute.js:12062
**Function:** Restore cycle state / hydration  
**Current code:**
```javascript
if (state.appTime) {
  state.appTime.activeDayKey = visibleStartDayKey;
  state.appTime.isFollowingNow = false;
}
```
**Category:** Recovery/re-hydration (restoring to a saved cycle)  
**Will refactor to:** `setAppTime(state, { activeDayKey: visibleStartDayKey, isFollowingNow: false })`

---

### Site 6: identityCompute.js:12240
**Function:** Cycle initialization or reset  
**Current code:**
```javascript
if (state.appTime) {
  state.appTime.activeDayKey = startDayKey;
}
```
**Category:** Purposeful update (aligning view to cycle)  
**Will refactor to:** `setAppTime(state, { activeDayKey: startDayKey, mode: 'reset' })`

---

## setAppTime() Helper Signature (Draft)

```typescript
/**
 * Centralized setter for appTime.nowISO and appTime.activeDayKey.
 * Respects timeIsPinned guard: if pin is set, does NOT update values.
 *
 * @param state - The state object to mutate
 * @param options - Configuration object
 * @param options.nowISO - Optional: explicit ISO timestamp to set (default: current time if mode='refresh')
 * @param options.activeDayKey - Optional: explicit day key to set
 * @param options.respectPin - If true, check timeIsPinned guard (default: true for derived state, false for reducer)
 * @param options.mode - Context hint: 'init' | 'refresh' | 'transition' | 'recovery' (used for logging)
 *
 * @returns void (mutates state in place)
 */
export function setAppTime(state, options = {}) {
  const {
    nowISO = null,
    activeDayKey = null,
    respectPin = true,
    mode = 'update',
  } = options;

  // Guard 1: If pin is set and we're told to respect it, don't change anything
  if (respectPin && state.appTime?.timeIsPinned) {
    return;
  }

  if (!state.appTime) {
    return; // Shouldn't happen, but guard against mutation of undefined
  }

  // Guard 2: Only update if values are explicitly provided
  if (nowISO !== null) {
    state.appTime.nowISO = nowISO;
  }

  if (activeDayKey !== null) {
    state.appTime.activeDayKey = activeDayKey;
  }
}
```

---

## Test Strategy

### Helper Tests (Step 1)
Write isolated tests for `setAppTime()` in a new file: `src/state/__tests__/setAppTime.test.js`

Test cases:
- ✅ Setting `nowISO` alone
- ✅ Setting `activeDayKey` alone
- ✅ Setting both together
- ✅ Guard: `timeIsPinned=true` prevents update
- ✅ Guard: `timeIsPinned=false` allows update
- ✅ Guard: `timeIsPinned` unset defaults to allow update
- ✅ No-op if state.appTime is undefined
- ✅ Respects mode hints (for logging consistency)

### Fixture Application (Step 2)
After helper is confirmed working, apply `timeIsPinned: true` to all 53 fixture files.

Each fixture construction of `appTime` becomes:
```javascript
appTime: {
  nowISO: '2026-06-21T12:00:00.000Z',
  activeDayKey: '2026-06-21',
  timeZone: APP_TIME_ZONE,
  isFollowingNow: true,
  timeIsPinned: true,  // ← ADD THIS LINE
}
```

### Baseline Verification (Step 3)
After fixtures are updated, run full suite and diff against:
- Baseline file: `docs/reference/baseline-test-failures-2026-08-07.md`
- Expected result: **Zero new regressions**, same 36 failures as baseline

---

## Implementation Checklist

- [ ] Step 1.1: Write `setAppTime()` helper in `src/state/time/setAppTime.js`
- [ ] Step 1.2: Write isolated tests for helper (before wiring up sites)
- [ ] Step 1.3: Wire Site 1 (identityStore.js:2535) to use helper
- [ ] Step 1.4: Wire Site 2 (identityStore.js:2538) to use helper
- [ ] Step 1.5: Wire Site 3 (identityStore.js:3032) to use helper
- [ ] Step 1.6: Wire Site 4 (identityCompute.js:11917) to use helper
- [ ] Step 1.7: Wire Site 5 (identityCompute.js:12062) to use helper
- [ ] Step 1.8: Wire Site 6 (identityCompute.js:12240) to use helper
- [ ] Step 2: Apply `timeIsPinned: true` to all 53 fixture files
- [ ] Step 3: Run full suite, verify baseline match
- [ ] Step 4: Commit with evidence (hash, git log, diff)

---

## References

- **Test spec:** `src/state/__tests__/e9-apptime-refresh-guard.test.js` (4 test cases)
- **Root cause memo:** `e9-fix-BLOCKED-test-date-hardcoding.md`
- **E10 bucket structure:** `e10-bucket-breakdown-structure.md` (broader staleness audit)

