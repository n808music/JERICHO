---
name: execution-readiness-wip-rebase-note
description: Rebase complete — execution-readiness-wip is on main (2205297); failure profile documented
metadata: 
  node_type: memory
  type: project
  originSessionId: d9aa3e0a-9279-48f1-8703-ec80e0d881c1
---

**Rebase done (2026-06-27).** `execution-readiness-wip` is now 1 commit ahead of main (`98cd1f4`). 9 of 19 original WIP commits were auto-dropped as already upstream via PR #17.

**Matrix CRUD now wired:** `declareVerificationSource/Node/Project/Artifact` + `update*/remove*` + `seedCanonicalEntities` are all in `identityCompute.js` and dispatched. The 4 "duplicate" reducers were resolved by keeping HEAD's stable base + WIP's field additions (expanded `declareProject`, complete `ensureMatrixSlot` guards).

**Test failures:** 93 total (27 pre-existing from main + ~66 from WIP's half-finished `auditExecutionBlockAdmission`). The audit marks proposed blocks as `deferredReason: 'admission_audit_failed'` / `'rejected'` — breaks tests expecting `'suggested'`. Expected for "do not merge" WIP.

**How to apply:** Next session picking up this WIP: the admission audit in `identityCompute.js` (search for `audited = ` near `proposedBlocks`) needs to be completed or selectively disabled for the test suite to go green. The gate logic lives in `evaluatePlanQualityGate.ts` → `auditExecutionBlockAdmission`.
