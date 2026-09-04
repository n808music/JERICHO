---
name: e3-ready-for-rebase
description: "E3 re-baselining ready — fixture switched, awaiting test output to update expectations"
metadata: 
  node_type: memory
  type: project
  originSessionId: 2e9164c9-8e35-4fed-8b30-edc06d0ef61d
  modified: 2026-08-19T06:39:52.084Z
---

# E3 Re-baselining Ready

## Changes Made
✓ File: `tests/state/masterPlanFullHorizon.quality.test.js`
- Line 11: Changed `buildOperationEndgameState(options)` → `buildSampleProfileFixtureState(options)`
- Line 8: Removed unused import `buildOperationEndgameState`
- Fixture now: 60-month sample profile (2026-05-19 → 2031-05-19) instead of 72-month OE (2026-05-11 → 2032-03-15)

## Next Step (After Test Output Ready)
Run: `npm test -- tests/state/masterPlanFullHorizon.quality.test.js`

For each of the 11 failing tests, capture actual values and update expectations. The pattern will be:
- Line XXX: `expect(...).toBe('old-value')` → `expect(...).toBe('new-value')`

No logic changes needed — purely expectation updates.

## Tests to Re-baseline
1. keeps the baseline Operation Endgame schedule trusted... (line ~80)
2. keeps lane/object context populated... (line ~100)
3. fails professionalism when... (line ~214)
4. narrows institution, civic... (line ~283)
5. moves downstream P2 timing... (line ~293)
6. keeps quality trust false when... (line ~310-312)
7. does not trust the full-horizon plan... (line ~343)
8. propagates unjustified P1... (line ~371)
9. does not silently trust a major middle phase... (line ~448)
10. keeps milestone-thin phases provisional... (line ~469)
11. passes the distributed baseline as official... (line ~628)

## Root Cause (For Record)
Fixture refactoring incomplete: test file was updated to import new fixture but continued using old fixture generator. Switching to new fixture changes baseline horizon from 72 to 60 months, requiring re-baseline of all assertions.
