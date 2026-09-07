---
name: next-action-test-intersection-2026-08-17
description: "Next concrete action. Test-name-level intersection between 36 baseline tests and 109 current tests. Will answer real question of regression vs new failures. Caveats: fixture-naming renames may create ambiguity; results must sum and check against phase recovery (8 tests fixed)."
metadata: 
  node_type: memory
  type: project
  originSessionId: 8b8fe96f-00c5-4506-8f13-1c1dedaddf00
  modified: 2026-08-18T02:00:20.295Z
---

# Next Action: Test-Level Intersection (2026-08-17)

## What This Does

Answers the question: **Of the 36 baseline failures, how many are still failing (regression) vs how many have been fixed or replaced by new failures?**

## Input Data (Already Have)

- **Baseline tests**: 36 explicit test names in `/docs/reference/baseline-test-failures-2026-08-07.md`
- **Current tests**: 109 failing test names in memory file `failure-list-2026-08-17-complete.md`

## Mechanical Task

1. Extract 36 baseline test names cleanly (already started)
2. Extract 109 current test names cleanly (from failure list)
3. Intersect: Which of the 36 baseline names appear in current 109?
4. Result should yield:
   - **X** = baseline tests still failing (regression)
   - **Y** = new tests not in baseline (new failures)
   - **Z** = baseline tests now passing (fixed, should relate to phase work's 8)
   - Check: X + Y should ≈ 109; X + Z should ≈ 36

## Known Ambiguity: Fixture Naming

**Category A issue**: 47 function calls across test files were renamed (operationEndgame* → sampleProfile*). 

**Impact on intersection**: If baseline test names reference old names/paths and current tests use new names, a naive string-match might count them as "disappeared from baseline" rather than "still failing but renamed."

**Decision needed before running**:
- Should we normalize names (catch "same test, different name" as still-failing)?
- Or strictly match names as-is and note file-rename ambiguity in results?

**Recommendation**: Normalize by test file + test description, not by full path, to handle fixture renames without false negatives.

## When This is Complete

Three real numbers will answer the fundamental question:
- How much of the 109 is baseline regression (bad — same tests still broken)?
- How much is new failures (unclear — could be expansion or new bugs)?
- Did phase elicitation actually recover any of the 36 baseline tests?

Until then, all claims about "92 new" or "mostly regression" or "mostly expansion" are unsupported conjecture.

---

*This is the only concrete next step from the 36→109 reconciliation. Run this before any other work claims are made about the failure composition.*
