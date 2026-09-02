---
name: failure-baseline-2026-08-17
description: "Snapshot of 109 failing tests (78 files) after phase elicitation work; categorized into fixture refactoring (15), schedule/timestamp (13), unmapped (81); replaces unverified pre-existing claims with actual bucketed data."
metadata: 
  node_type: memory
  type: project
  originSessionId: 8b8fe96f-00c5-4506-8f13-1c1dedaddf00
  modified: 2026-08-18T00:32:02.681Z
---

# Test Failure Baseline — 2026-08-17

**Official snapshot after phase elicitation integration work.**

- **Test Files**: 78 failed | 576 passed (654 total)
- **Tests**: 109 failed | 4063 passed (4172 total)
- **Timestamp**: 18:50–19:00 UTC

## Three Categories

**Category A: Fixture Refactoring (15 tests)**
- Root cause: operationEndgameRestore.js → sampleProfileRestore.js rename (Item D)
- Function names not updated in test imports
- Error: `summarizeOperationEndgameFixtureState is not a function`
- Files: sampleProfileRestore.test.jsx, sampleProfileRestore.capacitySeed.test.js

**Category B: Schedule/Timestamp Mismatches (13 tests)**
- Root cause: appTime clock handling or fixture horizon dates
- Error samples: Expected `2026-06-21T12:00:00.000Z` but got `2026-05-19T12:00:00.000Z`
- Files: schedule.generate.nonSilent.test.js, autoCallingIntegration.test.js, phaseRetroactiveAudit.test.js

**Category C: Unmapped (81 tests)**
- Requires investigation
- Includes component integration, master plan, convergence, product display, export tests
- Action: Sample 5–10 to identify dominant failure pattern

## Phase Elicitation Work Verified

✅ 8 failures fixed (117 → 109)
✅ 10 phase tests passing
✅ No breaking changes in isolated code paths

❓ Cannot verify "no new failures" without diff of original 117 names

## Baseline Discrepancy Alert

June 2026: 27 failures across 20 files  
Current: 109 failures across 78 files (4x expansion)

Reconciliation needed — unclear if this is:
- Legitimate test suite expansion
- June baseline outdated/incomplete
- Genuine new breakage accumulation

See [[project_phase_status]].

---

*Snapshot checkpoint for future failure-list diffs.*  
*Phase elicitation work: COMPLETE, VERIFIED for its own scope.*  
*Remaining failures: tracked, categorized, deferred as separate backlog items.*
