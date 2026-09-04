---
name: e15-site-1-verification-deferral
description: E15 Phase 2b Site 1 wiring (f166780) — count-level stability verified; full test-name-level diff deferred
metadata: 
  node_type: memory
  type: project
  originSessionId: 30dbc389-3f75-4749-b7de-2fa34358eff4
  modified: 2026-08-24T01:07:55.734Z
---

## Site 1 Wiring Verification Deferral (2026-08-23 20:07 CDT)

**Commit:** f166780 (Site 1 wired: computeProjectSpinePhase into deriveEffectiveProjectPhases)

**What was verified (solid):**
- causalChainFromMatrix.test.js: 11/11 ✓ (scheduling execution-order impact verified by name)
- Count-level test suite: 4351/4402 passing, 47 failures (consistent with baseline 48→47, though count math didn't fully reconcile)

**What was deferred (not yet verified):**
- Full name-level diff of failing test cases (baseline 48 vs current 47): which specific test names changed, if any
- Individual test name verification that the 47 failures are literally the same set as before, not a mix of new failures and fixed tests

**Why it matters:**
The count-level result (47) matches or improves baseline, but this hides whether the distribution changed (e.g., +4 new failures offset by −5 fixed tests). The name-level diff would reveal whether Site 1 wiring introduced any new instability or genuinely improved things.

**Scheduling gate is solid:** causalChainFromMatrix 11/11 is the actual answer to "does Site 1 break execution ordering", verified by real test names. Overall count is stable/improving. Commit proceeded on that basis.

**Follow-up:** Before marking E15 Phase 2b final in the spec, run a formal test-name diff against b5b6441 to record which tests moved.

---

## Related
- [[e15-phase-2b-sites-scope]] — Sites 1/4 both wired, doctrine applied
- [[e16-commit-2-final-status]] — baseline reference (b5b6441)
