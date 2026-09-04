# Constraint 1 — Full Scope Inventory (2026-09-03)

Repo-wide evidence for all six declaration classes (Entity, Initiative,
Project, Deliverable, Artifact, System): every intake builder, every
name→id / id→node consumer site relevant to Constraint 1, and every test
asserting an id value or format. Compiled after the `6e57ad7` revert, at a
tree confirmed byte-identical to `e19e7a9` (see
`constraint-1-revert-confirmation-2026-09-03.md`). No fixture file was
read, modified, or otherwise touched.

## Headline correction to a prior assumption

A prior session's memory recorded "11 builders exist, not one per class."
**This is not borne out by the evidence.** An exhaustive repo-wide search
for every production (non-test) file referencing the six action types
`DECLARE_ENTITY`, `DECLARE_INITIATIVE`, `DECLARE_PROJECT`,
`DECLARE_DELIVERABLE`, `DECLARE_ARTIFACT`, `DECLARE_SYSTEM` returns exactly
8 files:

- `src/state/identityCompute.js` — the reducer; **consumes** `payload.id`,
  mints nothing.
- `src/domain/masterGrid/loadReferenceMatrix.js` — the fixture loader;
  mints via `idByName.get(n.name)` (bare `slugId`), one dispatch site per
  class (lines 79, 90, 101, 128, 150, 163).
- `src/domain/elicitation/entitySlot.ts`, `initiativeSlot.ts`,
  `systemSlot.ts`, `slots/projectSlot.js`, `slots/deliverableSlot.js`,
  `artifactSlot.ts` — exactly **one builder function each**.

That's **6 production builders total, one per class**. `frontend/` (a
separate scheduling/optimizer subsystem) and `src/domain/masterPlan/masterPlanFactory.js`
(a different domain — Anchor/Lane/Milestone/Requirement) were checked and
contain none. If "11" referred to something else — e.g. counting the
loader's 6 dispatch sites plus the 6 elicitation builders (=12) under some
other tally — it could not be reconstructed from the code. Treat 6 as
authoritative.

### Related anomaly (pre-existing, out of scope)

`elicitationEngine.js` imports `buildDeliverableDeclarePayload` (line 57)
and registers `DELIVERABLE_SLOT_ID` in `SLOT_REGISTRY` (line 131), but
`dispatchForCompletedSlot` (lines 428–496) has no
`if (slotDef.slotId === DELIVERABLE_SLOT_ID)` branch — falls through to
`throw new Error('No dispatch builder registered for slot: ...')`. The
Deliverable builder exists and is unit-tested directly, but is not wired
into the live elicitation dispatch path the way the other 5 are. Not a
Constraint 1 defect; flagged for a future session.

### Related anomaly #2 (pre-existing, out of scope)

`deliverableSlot.js`'s `DELIVERABLE_PROJECT_MISSING` gate carries
`pickSet: 'declaredProjects'`, but `'declaredProjects'` is not an
implemented `kind` branch in `buildPickSet` (only `'producingProjectOptions'`
exists for Project options). Falls through to `{ kind, items: [] }` — the
operator UI would offer zero project choices for this gate. Independent of
id format; flagged for a future session.

---

## Entity

**Builder mint:** `src/domain/elicitation/entitySlot.ts:142` —
`id: \`entity-${idSlug}\`` (slug at lines 137–140, standard slugify).
One builder, no second found.

**Loader mint:** `loadReferenceMatrix.js:68` — `idByName.get(n.name)` →
bare `slugId(n.name)`.

**Consumer/read sites:**
- `loadReferenceMatrix.js:38-40` — `idByName` Map (all classes, bare
  slug) and `resolve(nm)`.
- `loadReferenceMatrix.js:53-58` — `resolveEntity(nm)`: applies
  `ENTITY_ALIASES`, then `idByName.get(canonical)`, gated on
  `state.matrix?.entitiesById?.[id]`. Used by Initiative (`:93`), Project
  (`:104`), Artifact (`:154`, as `produced_by`), System (`:166`) — all
  route through this one bare-slug function.
- `elicitationEngine.js:159,209,229` — `buildPickSet` reads
  `matrixSnapshot?.entitiesById` for `declaredEntities`,
  `initiativeOwnerOptions`, `systemOwnerOptions`.
- `elicitationEngine.js:271-290` — `allDeclaredNodeOptions`/
  `convergenceSourceOptions` iterate `entitiesById` among the 6 registries.
- `slots/projectSlot.js:38` — `PROJECT_OWNER_MISSING` gate,
  `pickSet: 'declaredEntities'`.
- `slots/deliverableSlot.js:45` — `DELIVERABLE_EXECUTING_ENTITY_MISSING`
  gate, `pickSet: 'declaredEntities'` for `executing_entity`. **Presence-only**
  — no `*_UNRESOLVED` gate checks membership in `entitiesById`. A stale/invalid
  `executing_entity` id would pass this gate silently.
- `initiativeSlot.ts:74-81` (`INITIATIVE_OWNER_UNRESOLVED`),
  `systemSlot.ts:58-60` (`SYSTEM_OWNER_UNRESOLVED`) — presence-only checks
  on `owningEntityId`, not membership checks.
- `convergenceSlot.ts:6-15`, `dependencySlot.ts:33-35` — build `Set`s from
  `entitiesById` (among others) for `*_UNRESOLVED` membership checks.
  Format-agnostic.
- `masterGridSelectors.js:7-20`, `matrixAggregation.js:48-52`,
  `capacityFromLegacy.js:34-35,118`, `causalChainFromMatrix.js:62`,
  `filterCalendarBlocksByScope.js:51`,
  `scheduledBlocksFromDeterministicResult.js:70,108` — pure id→node reads,
  format-agnostic.

**Test assertions:**
- `src/state/__tests__/entity.noroletags.test.js:57` —
  `expect(createdEntity.id).toBe('entity-test-1')`. Dispatches
  `DECLARE_ENTITY` directly (bypasses loader/builder) with a hand-authored
  prefixed literal. Unaffected by a loader format change.
- `tests/state/matrix.referenceSeed.test.js:52-54,66` — `slugId(...)`
  computed inline and used as the lookup key into `entitiesById`, and as
  the expected `owningEntityId` value on a Project. **Breaks the moment the
  loader mints `entity-${slug}`.**
- `tests/state/masterGrid.acceptance.test.jsx:62` — `byId[slugId(node.name)]`
  spans Entity via `matrix.entitiesById`. Same dependency.

---

## Initiative

**Builder mint:** `initiativeSlot.ts:244` — `id: \`initiative-${idSlug}\``
(slug at lines 223–226). One builder, no second found.

**Loader mint:** bare `slugId(n.name)`, same as all classes.

**Consumer/read sites:**
- `loadReferenceMatrix.js:105` — `owningInitiativeId: resolve(n.parent_initiative)`
  for Project.
- `loadReferenceMatrix.js:124-126` — Deliverable's `owningInitiativeId`
  inherited via `projectsById[owningProjectId]?.owningInitiativeId`
  (id→id, chained off the above).
- `elicitationEngine.js:295,358` — `unprofiledInitiativeOptions` pickSet
  reads `initiativesById`; `subjectNameFor` (convergence destination-name
  resolution) iterates it too.
- `resourceProfileSlot.ts:11,20,100` — reads `initiativesById` keys.
- `convergenceSlot.ts:9` — included in `declaredAllNodeIds`.
- `matrixAggregation.js:51,193`, `masterGridSelectors.js:8,19`,
  `filterCalendarBlocksByScope.js:52`,
  `scheduledBlocksFromDeterministicResult.js:71,111` — id-key reads,
  format-agnostic.

**Test assertions:**
- `tests/state/matrix.referenceSeed.test.js:83` — `bucket[slugId(n.name)]`
  where `bucket` = `m.initiativesById`. **Breaks on loader format change.**
- `tests/domain/elicitation/initiativeSlot.multiOwner.test.js:24-61` —
  asserts `owningEntityId`/`owningEntityIds` echo `'entity-gs-corp'` etc.
  (Entity-formatted reference field pass-through, not Initiative's own
  `.id`). No direct `.id` assertion on Initiative's own minted id exists
  anywhere in the repo.

---

## Project

**Builder mint:** `slots/projectSlot.js:77` — `id: \`project-${idSlug}\``
(slug at lines 72–75). One builder, no second found.

**Loader mint:** bare `slugId(n.name)`.

**Consumer/read sites:**
- `loadReferenceMatrix.js:123` — `owningProjectId: resolve(n.parent_project)`
  for Deliverable.
- `loadReferenceMatrix.js:125` — `projectsById[owningProjectId]?.owningInitiativeId`
  (id→id, chained).
- `loadReferenceMatrix.js:146-147` — Artifact's `producingProjectId`
  derived from `deliverablesById[parentDeliverableId]?.owningProjectId`
  (id→id, chained through Deliverable).
- `elicitationEngine.js:234-240` — `producingProjectOptions` pickSet
  reads `projectsById` (used by Artifact's `producingProjectId`).
- `slots/deliverableSlot.js:38-39` — `DELIVERABLE_PROJECT_MISSING` gate,
  `pickSet: 'declaredProjects'` — **currently unimplemented** (see anomaly
  #2 above); non-functional regardless of id format.
- `bootstrapSlot.ts:34` — `projectsById[art.producingProjectId]` id→id.
- `convergenceSlot.ts:9` — included in `declaredAllNodeIds`.
- `matrixAggregation.js`, `capacityFromLegacy.js`, `causalChainFromMatrix.js`,
  `phaseFromDependencies.js`, `masterGridSelectors.js`,
  `phaseGridFromStore.js`, `filterCalendarBlocksByScope.js`,
  `scheduledBlocksFromDeterministicResult.js` — numerous id-key reads,
  format-agnostic.

**Test assertions:**
- `tests/state/matrix.referenceSeed.test.js:64,66` —
  `m.projectsById[slugId(p.name)]`, then `.owningEntityId` compared against
  a bare-slug entity id. **Breaks on loader format change.**
- No `.id` equality/format assertion found on Project's own minted id
  anywhere else in the repo (checked
  `elicitationEngine.projectSlot.requiresLegal.test.js` and
  `projectSlot.requiresLegalFormation.unit.test.js` — zero hits).

---

## Deliverable

**Builder mint:** `slots/deliverableSlot.js:91` —
`id: \`deliverable-${idSlug}\`` (slug at lines 85–88). One builder, no
second found. (Not wired into live dispatch — see anomaly #1 above.)

**Loader mint:** bare `slugId(n.name)`.

**Consumer/read sites:**
- `loadReferenceMatrix.js:123,145,147` — `resolve(n.parent_project)` to
  derive `owningProjectId`; Artifact resolves through
  `resolve(n.parent_deliverable)` then
  `deliverablesById[parentDeliverableId]?.owningProjectId`.
- `elicitationEngine.js:282` — `deliverablesById` in
  `allDeclaredNodeOptions`/`convergenceSourceOptions`.
- `convergenceSlot.ts:9` — included in `declaredAllNodeIds`.
- `slots/deliverableSlot.js:39,45` — the slot's own `parent_project`/
  `executing_entity` pickSets (see Project/Entity sections).
- `phaseGridFromStore.js:18-23,44-45,120-121`,
  `filterCalendarBlocksByScope.js:54,57`, `masterGridSelectors.js:10` —
  id-key reads, format-agnostic. (`phaseGridFromStore.js:18` comment notes
  this slice was historically miscounted as Artifacts pre-2026-08-29 —
  same class of loader/builder-divergence bug as Constraint 1.)

**Test assertions:**
- `tests/domain/elicitation/deliverableIntakeAcceptance.test.js:26` —
  `expect(payload.id).toMatch(/^deliverable-/)`.
- `tests/domain/elicitation/deliverableIntakeAcceptance.test.js:226-247` —
  table-driven `expect(payload.id).toBe(expected)` × 3 (`'deliverable-first-album'`,
  `'deliverable-ai-training-model-v2'`, `'deliverable-api-documentation'`).
- `tests/domain/elicitation/deliverableSlot.test.js:72,127-128,141` —
  three more `payload.id` equality/format assertions
  (`'deliverable-first-album'`, `'deliverable-manuscript-draft'`,
  `/^deliverable-/`).
- `src/domain/masterGrid/phaseGridFromStore.test.js:22,24,26,28,33-34` —
  `slugId('Behavioral Execution Engine Patent')` and
  `slugId('State of Control pt. 3')` used as expected node ids.
  **Breaks on loader format change.**
- `tests/state/masterGrid.acceptance.test.jsx:62` — AC7's
  `byId[slugId(node.name)]` spans Deliverable via `matrix.deliverablesById`.

---

## Artifact

**Builder mint:** `artifactSlot.ts:63-68` — bare slug, with a
non-deterministic `artifact-${Date.now()}` fallback only when the name
slugifies to empty:
```js
const id = name.toLowerCase().replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '').slice(0, 64) || `artifact-${Date.now()}`;
```
This is the one class where builder and loader **already agree** (both
bare slug on the normal path). One builder, no second found.

**Loader mint:** bare `slugId(n.name)` (same uniform mechanism as every
other class in the loader).

**Consumer/read sites:**
- `loadReferenceMatrix.js:145-148` — `producingProjectId` resolved via
  `resolve(n.parent_deliverable)` → `deliverablesById[...]?.owningProjectId`.
- `elicitationEngine.js:252-258` — `declaredNodeOptions` pickSet:
  "Cross-registry: artifact-only per canonical matrix Section 7" — reads
  `artifactsById` for Dependency's downstream/upstream and Bootstrap
  candidate selection.
- `elicitationEngine.js:313-330` — `bootstrapCandidateOptions`:
  `computeBootstrapCandidates` + `artifactsById` lookups.
- `dependencySlot.ts:33-35` — `declaredNodeIds = Set(Object.keys(snap?.artifactsById))`
  — Dependency's `upstreamId`/`downstreamId` `*_UNRESOLVED` gates validate
  against this set **exclusively** (Artifact-only).
- `bootstrapSlot.ts:32,56-66` — `artifactsById` used throughout
  `bindingGapForArtifact`/`computeBootstrapCandidates`.
- `convergenceSlot.ts:9` — included in `declaredAllNodeIds`.
- `matrixAggregation.js:50`, `phaseFromDependencies.js`,
  `masterGridSelectors.js:11` — id-key reads, format-agnostic.

**Test assertions:**
- `tests/domain/elicitation/elicitationEngine.artifactSlot.test.js:373-377` —
  `expect(decl.payload.id).toBe('romance-riot-tape')`. Bare-slug format,
  consistent with the builder's actual mint pattern. This is the only
  `.id`-assertion hit in that file.

---

## System

**Builder mint:** `systemSlot.ts:118` — `id: \`system-${idSlug}\``
(slug at lines 111–114). One builder, no second found.

**Loader mint:** bare `slugId(n.name)`.

**Consumer/read sites:**
- `loadReferenceMatrix.js:166` — `resolveEntity(n.owner)` for System's
  `owningEntityId` (shares the same bare-slug entity resolution as
  Initiative/Project).
- `elicitationEngine.js:226-232` — `systemOwnerOptions` pickSet reads
  `entitiesById` (not `systemsById` — offers entity choices for System
  ownership).
- `elicitationEngine.js:280` — `systemsById` included in
  `allDeclaredNodeOptions`/`convergenceSourceOptions`.
- `convergenceSlot.ts:9` — included in `declaredAllNodeIds`.
- `systemSlot.ts:58-60` — `SYSTEM_OWNER_UNRESOLVED` gate, presence-only
  (same pattern as Initiative/Entity above).
- `filterCalendarBlocksByScope.js:29,58` — `systemsById` id-key reads,
  `masterGridSelectors.js:12`.

**Test assertions:**
- `tests/state/matrix.referenceSeed.test.js:82-86` — shared with
  Initiative: `bucket = n.class === 'Initiative' ? m.initiativesById : m.systemsById; bucket[slugId(n.name)]`.
  **Breaks on loader format change.**
- `tests/domain/elicitation/elicitationEngine.systemSlot.test.js:253-256` —
  `activationStateOptions` enum-value ids (`'running'`/`'missing'`/`'planned'`),
  not System node ids — not Constraint-1-relevant. No `payload.id`
  assertion on System's own minted id exists anywhere in the repo.

---

## Summary table

| Class | Builder mint format | Loader mint format (current, post-revert) | Bare-slug test dependency (breaks on loader format change) |
|---|---|---|---|
| Entity | `entity-${slug}` | bare `slug` | `matrix.referenceSeed.test.js:52-54,66`; `masterGrid.acceptance.test.jsx:62` |
| Initiative | `initiative-${slug}` | bare `slug` | `matrix.referenceSeed.test.js:83` |
| Project | `project-${slug}` | bare `slug` | `matrix.referenceSeed.test.js:64,66` |
| Deliverable | `deliverable-${slug}` | bare `slug` | `phaseGridFromStore.test.js:22,24,26,28,33-34`; `masterGrid.acceptance.test.jsx:62` |
| Artifact | bare `slug` (already matches loader) | bare `slug` | none — formats already aligned |
| System | `system-${slug}` | bare `slug` | `matrix.referenceSeed.test.js:83` |

**6 production builders total, one per class** (corrects the prior "11
builders" note). 3 test files carry a hard bare-slug dependency that
**must** change once the loader mints class-prefixed ids:
`matrix.referenceSeed.test.js`, `masterGrid.acceptance.test.jsx`,
`phaseGridFromStore.test.js`. Their movement on the next implementation is
required evidence the fix reached the resolution sites, not a regression.

The elicitation-path tests that already assert type-prefixed formats
(`deliverableIntakeAcceptance.test.js`, `deliverableSlot.test.js`,
`elicitationEngine.artifactSlot.test.js`, `entity.noroletags.test.js`)
exercise the builders directly and are unaffected by a loader change.

No fixture file (`reference_matrix_v3_0.json` or similar) was read,
modified, or otherwise touched.
