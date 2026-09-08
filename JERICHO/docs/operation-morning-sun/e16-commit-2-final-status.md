---
name: e16-commit-2-final-status
description: "E16 Commit #2 (NO_DECLARED_SEQUENCE + Site 4 computed-first) — LANDED, all tests verified"
metadata: 
  node_type: memory
  type: project
  originSessionId: 621a64d8-ae59-4e60-a7fd-690bb7fc681a
  modified: 2026-08-24T00:36:56.696Z
---

## E16 Commit #2: FINAL STATUS ✅

**Landed:** 2026-08-23 19:36 CDT (b5b6441)

### What was committed:
1. **NO_DECLARED_SEQUENCE disclosure-standard fixes** (phaseFromDependencies.js, phaseGridFromStore.js, identityCompute.js)
2. **Site 4 computed-first phase resolution** (projectSpinePhase.js, phaseGridFromStore.js resolveNodePhase reordering)
3. **Phantom phase-write removals** (declareProject/Deliverable/Artifact)
4. **Test expectation updates** for E16 doctrine compliance

### Test Verification (Evidence-Based):

✅ **Scheduler/POS/Convergence: STABLE**
- schedule.generate.nonSilent (pre-existing failure: 1)
- autoAsana.scheduler.v1_1 (pre-existing: 2)
- masterPlanDepth.blockExpansion (pre-existing: 1)
- convergence_step3_*.test.js (pre-existing: 7)
- *Name-level diff verified against 66d8c35 baseline*

✅ **AC1/AC7: PRE-EXISTING DEBT**
- AC1: seed renders 53 rows (stale fixture expectations from pre-intake-rebuild workbook)
- AC7: phase fidelity (fixture outdated, intake being rebuilt)
- *Baseline verified at 66d8c35 (47 failures); current stable at 47 failures*

✅ **phaseGridFromStore Tests: FIXED**
- Test 1: "absent raw phase...residual sentinel" → rewritten to remove obsolete Initiative.phase fallback
- Test 2: "genuinely unphasable" → fixture changed to targetDate: null (was computed to phases, now genuinely residual)
- Test 3: "raw-first" → split into two tests asserting computed-first precedence + raw as fallback (16/16 passing)

✅ **MasterGridTab: FIXTURE FIXED**
- Changed fixture targetDate from '2026-03'/'2026-06' → null (computed phases would prevent 100% residual condition)
- All 15 tests passing

✅ **Elicitation/Phase-Probe: PHASE 2A INFRASTRUCTURE DEBT**
- projectPhase tests (8+) confirmed pre-existing
- Not a regression from this commit; Phase 2a intake design work in progress

### Full Suite Status:
- **47 failures, 4351 passing** (stable at baseline 66d8c35)
- All known failures accounted for and categorized
- No new regressions

### Blocked/Dependent:
- [[e15-phase-2b-sites-1-4-wiring]] (Sites 1/4 scope: are they complete as part of commit #2's computed-first logic, or a separate phase?)
