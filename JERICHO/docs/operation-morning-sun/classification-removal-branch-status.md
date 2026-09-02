---
name: classification-removal-branch-status
description: "Item 6 Phase 4 classification removal branch complete, 7 stale fixtures identified and need fixing before merge"
metadata: 
  node_type: memory
  type: project
  originSessionId: 8654010a-e2c6-443c-af93-2043195292f9
  modified: 2026-08-25T02:19:20.304Z
---

**Branch:** `item-6-phase4-classification-removal`

**Changes applied:** 10 files modified
- initiativeSlot.ts: classification field removed from matrixBinding (already had gates/reprobes deleted)
- initiativeReprobes.ts: INITIATIVE_CLASSIFICATION_MISSING/INVALID reprobes removed (11 lines)
- identityCompute.js: declareInitiative validation gate removed (requires classification check deleted)
- elicitationEngine.js, masterPlanFactory.js, masterPlanSemanticModel.js, masterPlanStore.js, MatrixInstrument.jsx, MatrixIntake.jsx: classification usage removed

**Test Status:** Full suite shows 169 failed (needs baseline comparison, likely includes unrelated failures)

**Stale fixtures to fix (7 total):**
1. elicitationEngine.initiativeSlot.test.js:115 - "drives the full gate sequence" expects 'classification' in probe fieldNames array
2. elicitationEngine.initiativeSlot.test.js:220-248 - "classificationOptions pickSet" describe block (entire suite, classification no longer exists)
3. elicitationEngine.initiativeSlot.test.js:268 - test includes `{ classification: 'objective' }` in answers
4. elicitationEngine.initiativeSlot.test.js:296 - test includes `{ classification: 'objective' }` in answers
5. elicitationEngine.initiativeSlot.test.js:312 - "dispatches DECLARE_INITIATIVE with null owner" expects `decl.payload.classification` = 'constraint'
6. elicitationEngine.initiativeSlot.test.js:321 - "dispatches DECLARE_INITIATIVE with real owner" expects `decl.payload.classification` = 'objective'
7. reprobes.subjectBinding.contract.test.js:36 - expects `INITIATIVE_REPROBES.INITIATIVE_CLASSIFICATION_MISSING.spine` (doesn't exist)

**Next action:** Fix all 7 stale fixtures by removing classification assertions/references, re-run full suite to verify clean baseline, then prepare for merge/PR decision.

**Why:** Leaving known-failing tests erodes baseline trust; better to fix as part of this branch work.
