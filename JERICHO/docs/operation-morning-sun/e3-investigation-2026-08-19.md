---
name: e3-investigation-2026-08-19
description: "E3 masterPlanFullHorizon.quality.test.js investigation — 11 failures, root cause TBD"
metadata: 
  node_type: memory
  type: project
  originSessionId: 2e9164c9-8e35-4fed-8b30-edc06d0ef61d
  modified: 2026-08-19T06:16:43.815Z
---

# E3 Investigation: masterPlanFullHorizon.quality.test.js (11 Failures)

## Initial Hypothesis (Incorrect)
**Root cause:** Advisory dimensions reintegration in c1e8b79 causing trust-state enum threshold to trigger incorrectly.

**Attempt:** Added FULL_HORIZON_ADVISORY_CODES filter to exclude advisory codes from the aggregateReasonFamilies.length >= 5 threshold check.

**Result:** ❌ No change — all 11 tests still fail identically.

## Secondary Hypothesis (Incorrect)
**Root cause:** `floorToSunday` function added in c1e8b79 delays scheduler start by 0-6 days, breaking coverage audit.

**Finding:** 2026-05-11 (Monday) → 2026-05-17 (Sunday) = +6 day delay (function ceiling'd to next Sunday, not floor'd to previous).

**Attempt:** Changed logic to floor to previous Sunday instead of ceiling to next.

**Result:** ❌ No change — all 11 tests still fail identically.

## Observations
1. Test file imports changed: `buildOperationEndgameFixtureState` → `buildSampleProfileFixtureState`
2. Source file `operationEndgameRestore.js` deleted (status: D)
3. However, failing tests use `buildGeneratedState()` which chains through test helpers, not the deleted fixture
4. All 11 failures persist regardless of advisory filter or floorToSunday fixes

## Categorization (Still Valid)

| Group | Count | Pattern | Status |
|-------|-------|---------|--------|
| A | 2 | Boolean mismatch (false to be true) | Unclear |
| B | 6 | Enum mismatch (missing 'failed'/'degraded'/'withheld_plan') | Unclear |
| C | 1 | Missing reason code (professionalism) | Unclear |
| D | 2 | Array/structure size mismatch | Unclear |

## Next Steps
- [ ] Check if tests pass on main branch (baseline truthiness)
- [ ] Diff fullHorizonPlanQuality.js between HEAD and latest passing commit
- [ ] Investigate whether c1e8b79's advisory reintegration was actually committed and is still in HEAD
- [ ] Check identityCompute.js for other changes affecting plan quality computation
- [ ] Consider whether fixture function changes broke test setup entirely

## Status
**Escalated to user** — multiple attempted fixes didn't resolve failures. Real root cause not yet identified.
