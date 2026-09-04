---
name: e15-phase-2b-sites-scope
description: "E15 Phase 2b Sites 1/4 scope — separate from E16 Initiative work, pending as next phase"
metadata: 
  node_type: memory
  type: project
  originSessionId: 621a64d8-ae59-4e60-a7fd-690bb7fc681a
  modified: 2026-08-24T00:37:21.816Z
---

## E15 Phase 2b: Sites 1 & 4 Migration Scope

**Status:** PENDING (separate from E16 Commit #2)

### Clarification

E16 Commit #2 did **NOT** complete Sites 1/4. It resolved **Sites 2–3** by deletion (E16's Initiative phase-less decision made them unreachable).

Sites 1 & 4 are the remaining migration work for Phase 2b, to be approached as a separate initiative after E16 commit #2 lands.

### What Sites 1 & 4 actually are

From E15 Phase 2b original plan: Four read-site migrations from static fields to `computeSpineWindowPhase()`:
- **Site 1:** Project-level phase resolution
- **Site 2:** ~~Initiative terminal deadline~~ (E16: Initiative phase-less → deleted)
- **Site 3:** ~~Initiative terminal deadline~~ (E16: Initiative phase-less → deleted)
- **Site 4:** Master Grid display-tier phase grouping

### NOT the same as "Site 4 computed-first"

The "computed-first" logic landed in commit #2 (phaseGridFromStore Site 4 *display* layer was reordered: computed → raw → derived), but this is **not the same as the full "Site 4 migration"** scoped in E15 Phase 2b.

Sites 1/4 are for **moving static phase-read paths to derived-phase signals** across different layers. The computed-first reordering was part of that but not a complete Sites 1/4 closure.

### Next phase

Once E16 commit #2 is stable, revisit the original E15 §4 Sites 1/4 scope to determine which parts are now done vs. which still need migration.
