# Master Grid Tab — Design Spec

**Date:** 2026-07-08
**Branch:** execution-readiness-wip
**Status:** Approved (design), pending spec review

## Purpose

A generated, read-only enterprise rollup of the entire matrix datastore — one
row per node across all five classes (Entity, Initiative, Project, Deliverable,
System). It is Jericho's equivalent of a spreadsheet master sheet, except nobody
fills it: it renders from the store, always current, always last. It exists to
make the whole matrix legible at a glance and to be the persistence-integrity
canary — the historical failure mode is nodes silently not surviving a reload,
and this grid makes that failure visible immediately.

## Hard Directives (non-negotiable)

- **D1 — No second copy.** The grid holds no data of its own. Rows are recomputed
  from the store on every render/store change. If the grid can ever disagree with
  the store, the implementation is wrong by definition.
- **D2 — Read-only, deep-link to edit.** No create/edit/delete affordance on this
  tab. Row click navigates to that node's Intake form section. The grid may link,
  never write.
- **Verbatim names.** Render the exact stored string — no casing changes, no
  trimming, no "smart" formatting.

## Where the store lives

The datastore already exists — it is the `matrix` slice of the identity store:

- Provider / reducer: `src/state/identityStore.js`
- Reducer logic + `declare*` helpers: `src/state/identityCompute.js`
- Read hook: `useIdentity()` / `IdentityContext`
- Persistence: `localStorage` under key `jericho-identity`

Slices, one per node class plus two edge maps:

| Grid class  | Store slice      |
| ----------- | ---------------- |
| Entity      | `entitiesById`   |
| Initiative  | `initiativesById`|
| Project     | `projectsById`   |
| Deliverable | `artifactsById`  |
| System      | `systemsById`    |
| edges       | `dependenciesById`, `convergenceEdgesById` |

Note the naming: the store calls the Deliverable class `artifact`. The grid
labels it **Deliverable**; the selector maps `artifactsById` → `Deliverable`.

## Approach

**A pure selector + a thin read-only component.**

`selectMasterGridRows(matrix)` flattens all five `*ById` maps into one normalized
row array. The tab component calls `useIdentity()`, runs the selector on every
render, and holds **only** sort/filter in local `useState`. No copy of store data
ever persists in the component, so the grid physically cannot diverge from the
store (D1-safe by construction).

Rejected alternatives:
- *Inline flattening in the component* — logic not unit-testable in isolation;
  "no write path" harder to prove.
- *Compute rows inside `computeDerivedState`* — couples a read-only view to the
  derivation pipeline; over-engineered for view state.

## Section 1 — Store schema extension (prerequisite)

Add three **uniform** fields to every node class, via the `declare*`/`update*`
helpers in `identityCompute.js`:

- `phase` — string, default `null`.
- `roleTags` — string array, default `[]`. (Entities already carry this; add to
  the other four classes.)
- `reviewStatus` — enum `CONFIRMED | NEEDS_REVIEW | DRAFT`, **default `DRAFT`** on
  declaration.

`reviewStatus` is deliberately a **new, uniform** field, separate from the
class-specific lifecycle fields that already exist and stay untouched:
`entity.formationState`, `project.status`, `system.activationState`. Those mean
"where is this thing in its own lifecycle"; `reviewStatus` means "is this node's
intake data confirmed." Conflating them was the naming-drift risk; keeping them
distinct is the fix.

All three fields are additive and optional, so existing declarations and the
~27-test baseline stay green. Defaults are applied in the reducer, not the grid.

### Deliverable-specific addition — `producedByEntityId`

The store's `declareArtifact` record carries only `producingProjectId` (a project
reference) and has **no producing-entity field**. But `produced_by` is the point
of the Deliverable class — it is the only place cross-entity work is recorded
(e.g. a deliverable whose parent project is owned by one entity but produced by
another). All 12 deliverables in the fixture carry a `produced_by` distinct from
`parent_project`. This is a schema gap, not a display nit.

Add `producedByEntityId` (nullable string, resolves into `entitiesById`) to the
`declareArtifact` record. The seed loader maps the fixture's `produced_by` name
through the name→id pass. The Deliverable `ownerParentLabel` becomes
**producer-entity name / parent-project name**.

### Contract file — `jericho_matrix_schema.json`

Written as the authoritative contract for all five node classes + edge types +
validation rules. **Amendment 1:** the uniform field is named `reviewStatus` in
the contract, matching the implementation exactly — the contract must not drift
from code. The contract also retains `work_state` on the relevant classes even
though the grid does not display that column.

Enum form: the contract stores `reviewStatus` as `CONFIRMED | NEEDS_REVIEW |
DRAFT` (underscore), matching the stored values. The spaced `"NEEDS REVIEW"` form
is display-only and never appears in the contract or the store.

## Section 2 — Selector (`selectMasterGridRows`)

Pure function, no React. For each slice, emit a row:

```
{
  id,                 // store id
  name,               // verbatim stored string
  primaryClass,       // 'Entity' | 'Initiative' | 'Project' | 'Deliverable' | 'System'
  roleTags,           // string[]
  ownerParentLabel,   // resolved per rules below (verbatim names)
  phase,              // string | null
  reviewStatus,       // 'CONFIRMED' | 'NEEDS_REVIEW' | 'DRAFT'
  readyForIntake,     // boolean = (reviewStatus === 'CONFIRMED')
  intakeTarget,       // { class, id } for deep-link
}
```

`ownerParentLabel` resolution (id → name lookups, verbatim):
- Entity → `—`
- Initiative → owner (`owningEntityId` → entity name)
- System → owner
- Project → `owner / parent-initiative` (`owningEntityId` name + `owningInitiativeId` name)
- Deliverable → `producer-entity / parent-project` (`producedByEntityId` name + `producingProjectId` name)

Default sort: class order (Entity → Initiative → Project → Deliverable → System),
then phase, then name. All logic lives here; trivially unit-testable.

## Section 3 — Tab component (read-only, deep-link)

- New entry in `TAB_CONFIG` (`ZionDashboard.jsx`):
  `{ key: 'mastergrid', label: 'Master Grid', tagline: 'Rollup' }`.
- Tab switching uses the existing `changeView(tab.key)` mechanism.
- Header shows live counts: total nodes + per-class breakdown
  (e.g., `53 nodes — 7 Entities · 11 Initiatives · 17 Projects · 12 Deliverables · 6 Systems`).
- Table: sortable by any column, filterable by class / phase / reviewStatus.
  Sort/filter is view state only (`useState`) — never touches the store.
- Status column display: stored `CONFIRMED` → "CONFIRMED" (green), `NEEDS_REVIEW`
  → "NEEDS REVIEW" (yellow), `DRAFT` → "DRAFT" (gray). Display label only; the
  stored value keeps its underscore form.
- **D2:** no create/edit/delete handlers, no `dispatch`/`actions.*` mutation calls
  anywhere in the component. Row click calls `changeView('structure')` and targets
  the `MatrixIntake` section for that node (exact scroll/open mechanism confirmed
  at plan time).
- Empty store → empty grid, counts at 0, not an error state.

## Section 4 — Seed loader (name→id resolution)

**Amendment 2:** `reference_matrix_v1_4.json` keys nodes by **verbatim `name`**
and references parents/owners **by name**, not by store id. Its shape (verified):
top-level `nodes` (53) and `canonical_edges` (20); deliverable fields are
`name, class, parent_project, produced_by, what_ships, phase, target_date,
work_state, status, notes` (fixture `status` → `reviewStatus`, `work_state` →
lifecycle, `phase` → `phase`). The seed loader must run a **name→id resolution
pass**:

1. Assign/derive a store id for each node (declare order or slug of name).
2. Build a `name → id` map across all declared nodes.
3. When declaring a node, translate its by-name parent/owner references
   (`owningEntityId`, `owningInitiativeId`, `producingProjectId`,
   `producedByEntityId`, and `canonical_edges` endpoints) through the map into
   store ids.
4. Preserve the `name` string byte-for-byte — the loader classifies and links,
   but never rewrites a name.

The loader is test-fixture infrastructure (declares nodes through the real
reducer actions, so it exercises the same commit path as live intake).

## Section 5 — Tests

Write where the repo has a test pattern (Vitest; `tests/**` and `src/**/*.test.*`).

**Buildable immediately (no seed file needed):**
- Selector units: class mapping, owner/parent name resolution, sort order,
  `readyForIntake` derivation.
- Component: add-node-to-store → row appears without reload (AC3).
- Component: no write path — assert the component has zero dispatch/mutation
  handlers (AC4).
- Component: row click navigates to the correct Intake node (AC5).
- Empty store renders 0 counts, no error.

**Unblocked once `reference_matrix_v1_4.json` is in `tests/fixtures/`:**
- Seed → grid renders exactly 53 rows; counts read 7/11/17/12/6 (AC1).
- Names byte-identical to the seed file — exact string equality on all 53 (AC2).
- **Kill/relaunch → grid re-renders all 53 from persisted `localStorage`
  (`jericho-identity`)** — the historical failure mode, highest-priority test (AC6).

## Amendments applied (from design approval)

1. Contract field named `reviewStatus` (not `status`) in
   `jericho_matrix_schema.json`; `work_state` retained in the contract though the
   grid ignores it.
2. Seed loader performs a name→id resolution pass; `reference_matrix_v1_4.json`
   keys by verbatim name. Fixture is on disk at
   `tests/fixtures/reference_matrix_v1_4.json` (verified: 53 nodes, 7/11/17/12/6,
   20 `canonical_edges`). Tests 1/2/6 are unblocked.

### From spec review (second pass)

3. Deliverables gain a producing-entity field `producedByEntityId` (schema gap:
   `declareArtifact` had only `producingProjectId`). Seed loader maps the
   fixture's `produced_by` name; Deliverable `ownerParentLabel` renders as
   producer-entity / parent-project.
4. Contract `reviewStatus` enum normalized to `NEEDS_REVIEW` (underscore) to match
   stored values; spaced `"NEEDS REVIEW"` is display-only.

## Deliverables

- `jericho_matrix_schema.json` (contract).
- Store schema extension in `identityCompute.js` (`phase`, `roleTags`,
  `reviewStatus` across all five classes).
- `selectMasterGridRows` selector.
- Master Grid tab wired into `TAB_CONFIG` / `ZionDashboard.jsx`.
- Seed loader (name→id) + `reference_matrix_v1_4.json` fixture.
- Tests (AC1–AC6).
- PR/summary note: where the store lives and how the grid subscribes.
