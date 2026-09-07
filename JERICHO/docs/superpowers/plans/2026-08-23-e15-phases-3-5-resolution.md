# E15 Phases 3–5: Resolution Summary (2026-08-23)

**Status:** All three effectively RESOLVED via tonight's commits (E16 + Site 1/4 wiring). Not "pending scope review" — already completed as byproducts of primary work.

---

## Phase 3: Migrate/Remove Initiative Phase Write Paths

**Original scope:** Remove `initiative.phase` dispatcher and all writes.

**Resolution:** **DONE via E16, 2026-08-23.**
- Commits: `9bc12fc` (declaration path), `55bc4c5` (identified and removed second undiscovered write path)
- Status: Initiative has zero write paths to `phase` field
- Evidence: E15 spec Section 7, criterion 4 — confirmed "for Initiative, that **zero** remain: no write path"

---

## Phase 4: Remove Dependency-Derived Priority from deriveEffectiveProjectPhases()

**Original scope:** Demote dependency-derived phase from first-tier priority, so computed phase can rank above it.

**Resolution:** **DONE tonight as part of Site 1 wiring, 2026-08-23, f166780.**
- Old hierarchy: dependency-derived → raw
- New hierarchy: computed → dependency-derived → raw
- Why it happened: Site 1 (deriveEffectiveProjectPhases) now calls `computeProjectSpinePhase()` first (computed-first doctrine)
- Evidence: phaseFromDependencies.js lines 156–186 (Site 1 wiring), mirrors phaseGridFromStore.js Site 4 precedence

**Note:** dependency-derived was not deleted — it remains as second tier for projects lacking a computed phase (no target date). This is by design: computed outranks it, not replaces it.

---

## Phase 5: Remove Dead Raw-First Display Override

**Original scope:** Remove the 2026-07-16 "raw-first" display ruling that let hand-typed phase outrank computed.

**Resolution:** **DONE as part of Site 4 implementation, committed 2026-08-23 b5b6441.**
- Old phaseGridFromStore.resolveNodePhase() hierarchy (pre-tonight): raw → derived → (no computed)
- New hierarchy (Site 4, computed-first): computed → raw → derived
- Site 1 mirrors this: computed → derived → raw (derived moved; raw stays as fallback-of-last-resort)
- Result: raw-first override is functionally superseded. Raw is now the fallback-of-last-resort, not the override.
- Evidence: phaseGridFromStore.js lines 73–104, comment lines 78–83 explicitly document demotion of raw-first display ruling

**Note:** raw is not deleted — it remains as a fallback for legacy/fixture data where no computed or derived phase exists. This is appropriate, not a gap.

---

## Summary: All Phases Resolved

| Phase | Scope | Resolution | Commit | Date |
|-------|-------|-----------|--------|------|
| **3** | Initiative write paths | Zero remaining (deleted) | 9bc12fc, 55bc4c5 | E16 |
| **4** | Dependency-derived priority | Demoted below computed (Site 1) | f166780 | 2026-08-23 |
| **5** | Raw-first override | Functionally superseded (Site 4) | b5b6441 | 2026-08-23 |

No remaining Phase 3–5 work. E15 implementation complete at the code level.

---

## Remaining Open Items (Outside Phase 3–5 Scope)

- **E15 Definition of Done, criterion #2:** full name-level test diff (flagged, deferred)
- **E15 Definition of Done, criterion #3:** CONFIRMED-Project re-verification table (scope TBD — separate from Phases 3–5)
- **Item 6 (Matrix v2):** unblocked by E15 completion

---

**Prepared for:** E15 spec update and scope clarification, 2026-08-23 20:15 CDT
