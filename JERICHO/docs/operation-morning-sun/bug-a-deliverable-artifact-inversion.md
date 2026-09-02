---
name: bug-a-deliverable-artifact-inversion
description: Bug A root cause and what is still blocking the live Deliverable/Artifact migration after commit baf3acd
metadata: 
  node_type: memory
  type: project
  originSessionId: 124fde5c-c2c6-43d0-8320-7a567e1dc348
  modified: 2026-08-30T00:22:56.376Z
---

**Bug A was a swapped mapping, not a missing branch.** `loadReferenceMatrix.js` omitted
`'Artifact'` from `CLASS_SEQUENCE` (skipping 122 of 304 v2.0 nodes) AND dispatched
`DECLARE_ARTIFACT` for fixture Deliverables — so `artifactsById` held the 64 Deliverables and
`deliverablesById` was empty. Fixed 2026-08-29 in commit `baf3acd`, atomically with the
14-consumer sweep (P5). Suite 48 → 46 by name, zero regressions.

`loadReferenceMatrix.js` is **test-only** — zero production importers, verified across 1084
files. Fixing it changed nothing live.

**Live state (all 5 `user_states` rows): `deliverablesById` 0, `artifactsById` 0,
`systemsById` 0.** Live IDs use `<class>-<slug>`; the loader uses bare `<slug>` — zero key
overlap, so the loader's ids must NOT be reused in a migration.

**Still blocking the live migration** (spec: `docs/superpowers/specs/2026-08-29-bug-a-live-migration-spec.md`):
- 14 Projects have `parent_initiative: null`, which blocks 17 of 64 Deliverables
  (`declareMatrixDeliverable` requires `owningInitiativeId`). Worth investigating together with
  the initiativesById 41→38→30 reconciliation — both now confirmed real.
- All 122 Artifacts have `parent_deliverable: null`, plus `completionEvidence` empty and
  `operatorAttestationMethod` absent — 3 of 6 required fields have no fixture source.
- **All 46 live `owningInitiativeId` refs are dangling** (`project-` prefix where the keys are
  `initiative-`). Task 1 recorded the count as success but never resolution-checked them.
- Bug B Case 1 merges (original 3 + the OFL-family trio) and the abbreviation renames.

**Direction note that is easy to get backwards:** live already has the expanded names
(`Our Fearless Leader 7 Seals Foundation`, mojibake gone). The fixture is STALE relative to
live, so the rename work is a fixture catch-up and the migration must never import fixture
names over live ones. See [[named-test-diff-needs-whitespace-trim]].
