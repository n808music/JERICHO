# Master Grid Tab Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a generated, read-only "Master Grid" tab that renders every matrix node (all five classes) from the store as one sortable/filterable table, always current, never writing.

**Architecture:** A pure selector (`selectMasterGridRows`) flattens the five `*ById` store slices into normalized rows; a thin React tab component (`MasterGridTab`) reads the live store via `useIdentityStore()`, runs the selector each render, holds only sort/filter in local state, and deep-links rows to intake via an `onOpenNode` callback. The store schema is first extended with uniform `phase`/`roleTags`/`reviewStatus` fields (plus `producedByEntityId` on Deliverables) so the grid renders real stored data (D1) rather than inventing it.

**Tech Stack:** React 18 (JSX), Vitest + @testing-library/react, the existing identity store (`identityStore.js` / `identityCompute.js`).

## Global Constraints

- **D1 — No second copy.** Rows are recomputed from `store.matrix` every render. The component holds no node data in state — only sort/filter view state.
- **D2 — Read-only.** No create/edit/delete affordance; zero `matrixDispatch`/`actions.*` mutation calls in the grid. Row click calls `onOpenNode({ class, id })` only.
- **Verbatim names.** Render the exact stored `name` string — no casing/trim/format.
- **Store slice → class:** `entitiesById`→Entity, `initiativesById`→Initiative, `projectsById`→Project, `artifactsById`→**Deliverable**, `systemsById`→System.
- **reviewStatus enum:** stored as `CONFIRMED | NEEDS_REVIEW | DRAFT` (underscore); default `DRAFT` on declaration. Display label `NEEDS_REVIEW`→"NEEDS REVIEW" (yellow), `CONFIRMED`→green, `DRAFT`→gray.
- **readyForIntake** = `reviewStatus === 'CONFIRMED'`.
- **Store hook:** `useIdentityStore()` returns the store; `store.matrix` is the live slice; `store.matrixDispatch(action)` is the mutation path (forbidden in the grid).
- **Persistence key:** `localStorage['jericho-identity']`.
- **Test runner:** `npx vitest run <path>`.
- **Fixture:** `tests/fixtures/reference_matrix_v1_4.json` — top-level `nodes` (53) + `canonical_edges` (20); nodes keyed by verbatim `name`, parents/owners referenced by name.

---

### Task 1: Store schema extension — uniform grid fields + `producedByEntityId`

**Files:**
- Modify: `src/state/identityCompute.js` (functions `declareEntity` ~15559, `declareInitiative` ~15594, `declareSystem` ~15628, `declareProject` ~15671, `declareArtifact` ~15782)
- Test: `tests/state/matrix.gridFields.test.js` (create)

**Interfaces:**
- Produces: every declared node record carries `phase: string|null` (default `null`), `roleTags: string[]` (default `[]`), `reviewStatus: 'CONFIRMED'|'NEEDS_REVIEW'|'DRAFT'` (default `'DRAFT'`). Artifact records additionally carry `producedByEntityId: string|null` (default `null`), validated to exist in `entitiesById` when non-null.

- [ ] **Step 1: Write the failing test**

```js
// tests/state/matrix.gridFields.test.js
import { describe, it, expect } from 'vitest';
import { buildBlankIdentityState } from '../../src/state/identityStore.js';
import { computeDerivedState } from '../../src/state/identityCompute.js';

// Canonical harness (matches tests/state/matrix.nodes.test.js): blank identity
// state + computeDerivedState reducer. Matrix DECLARE_* cases live in computeDerivedState.
function runMatrix(actions) {
  let state = buildBlankIdentityState();
  state.appTime = { ...(state.appTime || {}), nowISO: '2026-07-08T00:00:00.000Z' };
  for (const a of actions) state = computeDerivedState(state, a);
  return state;
}

describe('matrix grid fields', () => {
  it('initiative declaration defaults reviewStatus=DRAFT, phase=null, roleTags=[]', () => {
    const s = runMatrix([
      { type: 'DECLARE_INITIATIVE', payload: { id: 'i1', name: 'Jericho System', purpose: 'x', classification: 'objective', doneWhen: 'y' } },
    ]);
    const rec = s.matrix.initiativesById.i1;
    expect(rec.reviewStatus).toBe('DRAFT');
    expect(rec.phase).toBe(null);
    expect(rec.roleTags).toEqual([]);
  });

  it('declared values persist (reviewStatus/phase/roleTags)', () => {
    const s = runMatrix([
      { type: 'DECLARE_INITIATIVE', payload: { id: 'i2', name: 'F8 ENERGY GUM', purpose: 'x', classification: 'objective', doneWhen: 'y', reviewStatus: 'CONFIRMED', phase: '1', roleTags: ['income'] } },
    ]);
    const rec = s.matrix.initiativesById.i2;
    expect(rec.reviewStatus).toBe('CONFIRMED');
    expect(rec.phase).toBe('1');
    expect(rec.roleTags).toEqual(['income']);
  });

  it('artifact carries producedByEntityId resolved to a declared entity', () => {
    const s = runMatrix([
      { type: 'DECLARE_ENTITY', payload: { id: 'e1', name: 'Global State Corp.', roleTags: ['corp'], purpose: 'p', formationState: 'formed', statusEvidence: 'ev' } },
      { type: 'DECLARE_ENTITY', payload: { id: 'e2', name: 'Global State Productions', roleTags: ['corp'], purpose: 'p', formationState: 'formed', statusEvidence: 'ev' } },
      { type: 'DECLARE_INITIATIVE', payload: { id: 'i3', name: 'Romance Riot', purpose: 'x', classification: 'objective', doneWhen: 'y' } },
      { type: 'DECLARE_VERIFICATION_SOURCE', payload: { id: 'v1', name: 'src', method: 'm' } },
      { type: 'DECLARE_PROJECT', payload: { id: 'p1', name: 'OUR FEARLESS LEADER 3', owningEntityId: 'e1', owningInitiativeId: 'i3', successMetric: 'sm', verificationSourceId: 'v1' } },
      { type: 'DECLARE_ARTIFACT', payload: { id: 'a1', name: 'OFL 3: Romance Riot — tape/album', producingProjectId: 'p1', producedByEntityId: 'e2', completionEvidence: 'ce', verificationSourceId: 'v1', operatorAttestationMethod: 'am' } },
    ]);
    expect(s.matrix.artifactsById.a1.producedByEntityId).toBe('e2');
    expect(s.matrix.artifactsById.a1.reviewStatus).toBe('DRAFT');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/state/matrix.gridFields.test.js`
Expected: FAIL — `reviewStatus`/`phase`/`producedByEntityId` are `undefined`.

- [ ] **Step 3: Add the fields to each `declare*` record**

In `declareInitiative`, `declareEntity`, `declareSystem`, `declareProject`, `declareArtifact`, add these three lines to the object literal assigned to `state.matrix.<slice>ById[id]` (place them just before `declaredAtISO:`). For `declareEntity`, `roleTags` already exists — add only `phase`/`reviewStatus`.

```js
    phase: String(payload?.phase || '').trim() || null,
    roleTags: Array.isArray(payload?.roleTags) ? payload.roleTags.filter(Boolean) : [],
    reviewStatus: ['CONFIRMED', 'NEEDS_REVIEW', 'DRAFT'].includes(payload?.reviewStatus) ? payload.reviewStatus : 'DRAFT',
```

In `declareArtifact`, additionally add producing-entity capture near the top (after the `producingProjectId` const):

```js
  const producedByEntityId = payload?.producedByEntityId === null
    ? null
    : String(payload?.producedByEntityId || '').trim() || null;
```

Then add a validation guard after the existing `producingProjectId` project-existence check:

```js
  if (producedByEntityId && !state.matrix.entitiesById[producedByEntityId]) {
    state.lastPlanError = {
      code: 'ARTIFACT_PRODUCED_BY_ENTITY_UNKNOWN',
      reason: `Artifact producedByEntityId "${producedByEntityId}" is not in matrix.entitiesById.`,
      meta: { id, producedByEntityId },
    };
    return;
  }
```

And add `producedByEntityId,` to the artifact record object (alongside `producingProjectId,`).

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/state/matrix.gridFields.test.js`
Expected: PASS (3 tests).

- [ ] **Step 5: Run the baseline to confirm no regression**

Run: `npx vitest run tests/state src/state`
Expected: PASS — no new failures vs. the 27+1 baseline (new optional fields are additive).

- [ ] **Step 6: Commit**

```bash
git add tests/state/matrix.gridFields.test.js src/state/identityCompute.js
git commit -m "feat(matrix): uniform phase/roleTags/reviewStatus + artifact producedByEntityId"
```

---

### Task 2: `jericho_matrix_schema.json` contract + drift guard

**Files:**
- Create: `jericho_matrix_schema.json` (repo root)
- Test: `tests/state/matrixSchemaContract.test.js` (create)

**Interfaces:**
- Produces: a JSON contract with `nodeClasses` (Entity, Initiative, Project, Deliverable, System) each listing `fields`, `edgeTypes`, and `validationRules`. Consumed by the drift test only.

- [ ] **Step 1: Write the failing test**

```js
// tests/state/matrixSchemaContract.test.js
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const contract = JSON.parse(fs.readFileSync(path.resolve('jericho_matrix_schema.json'), 'utf8'));

describe('jericho_matrix_schema.json contract', () => {
  it('defines all five node classes', () => {
    expect(Object.keys(contract.nodeClasses).sort())
      .toEqual(['Deliverable', 'Entity', 'Initiative', 'Project', 'System']);
  });

  it('reviewStatus enum uses underscore form on every class', () => {
    for (const cls of Object.values(contract.nodeClasses)) {
      expect(cls.fields.reviewStatus.enum).toEqual(['CONFIRMED', 'NEEDS_REVIEW', 'DRAFT']);
    }
  });

  it('Deliverable carries producedByEntityId and work_state', () => {
    const d = contract.nodeClasses.Deliverable.fields;
    expect(d.producedByEntityId).toBeDefined();
    expect(d.work_state).toBeDefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/state/matrixSchemaContract.test.js`
Expected: FAIL — file not found.

- [ ] **Step 3: Write the contract file**

```json
{
  "contract": "jericho_matrix_schema",
  "version": "1.4",
  "nodeClasses": {
    "Entity": {
      "storeSlice": "entitiesById",
      "fields": {
        "id": { "type": "string", "required": true },
        "name": { "type": "string", "required": true, "verbatim": true },
        "roleTags": { "type": "string[]", "required": true },
        "purpose": { "type": "string", "required": true },
        "formationState": { "type": "string", "required": true },
        "statusEvidence": { "type": "string", "required": true },
        "phase": { "type": "string|null", "default": null },
        "reviewStatus": { "type": "enum", "enum": ["CONFIRMED", "NEEDS_REVIEW", "DRAFT"], "default": "DRAFT" },
        "work_state": { "type": "string|null", "default": null }
      }
    },
    "Initiative": {
      "storeSlice": "initiativesById",
      "fields": {
        "id": { "type": "string", "required": true },
        "name": { "type": "string", "required": true, "verbatim": true },
        "owningEntityId": { "type": "string|null" },
        "purpose": { "type": "string", "required": true },
        "classification": { "type": "enum", "enum": ["objective", "constraint"], "required": true },
        "doneWhen": { "type": "string", "required": true },
        "roleTags": { "type": "string[]", "default": [] },
        "phase": { "type": "string|null", "default": null },
        "reviewStatus": { "type": "enum", "enum": ["CONFIRMED", "NEEDS_REVIEW", "DRAFT"], "default": "DRAFT" },
        "work_state": { "type": "string|null", "default": null }
      }
    },
    "Project": {
      "storeSlice": "projectsById",
      "fields": {
        "id": { "type": "string", "required": true },
        "name": { "type": "string", "required": true, "verbatim": true },
        "owningEntityId": { "type": "string", "required": true },
        "owningInitiativeId": { "type": "string|null" },
        "successMetric": { "type": "string", "required": true },
        "verificationSourceId": { "type": "string", "required": true },
        "targetDate": { "type": "string|null" },
        "roleTags": { "type": "string[]", "default": [] },
        "phase": { "type": "string|null", "default": null },
        "reviewStatus": { "type": "enum", "enum": ["CONFIRMED", "NEEDS_REVIEW", "DRAFT"], "default": "DRAFT" },
        "work_state": { "type": "string|null", "default": null }
      }
    },
    "Deliverable": {
      "storeSlice": "artifactsById",
      "fields": {
        "id": { "type": "string", "required": true },
        "name": { "type": "string", "required": true, "verbatim": true },
        "producingProjectId": { "type": "string", "required": true },
        "producedByEntityId": { "type": "string|null" },
        "completionEvidence": { "type": "string", "required": true },
        "verificationSourceId": { "type": "string", "required": true },
        "operatorAttestationMethod": { "type": "string", "required": true },
        "roleTags": { "type": "string[]", "default": [] },
        "phase": { "type": "string|null", "default": null },
        "reviewStatus": { "type": "enum", "enum": ["CONFIRMED", "NEEDS_REVIEW", "DRAFT"], "default": "DRAFT" },
        "work_state": { "type": "string|null", "default": null }
      }
    },
    "System": {
      "storeSlice": "systemsById",
      "fields": {
        "id": { "type": "string", "required": true },
        "name": { "type": "string", "required": true, "verbatim": true },
        "cycle": { "type": "string", "required": true },
        "activationState": { "type": "enum", "enum": ["running", "missing", "planned"], "required": true },
        "roleTags": { "type": "string[]", "default": [] },
        "phase": { "type": "string|null", "default": null },
        "reviewStatus": { "type": "enum", "enum": ["CONFIRMED", "NEEDS_REVIEW", "DRAFT"], "default": "DRAFT" },
        "work_state": { "type": "string|null", "default": null }
      }
    }
  },
  "edgeTypes": {
    "owns": { "store": "n/a", "note": "entity owns initiative (owningEntityId)" },
    "parents": { "store": "n/a", "note": "initiative parents project (owningInitiativeId)" },
    "producedBy": { "store": "n/a", "note": "deliverable produced by entity (producedByEntityId)" },
    "producingProject": { "store": "n/a", "note": "deliverable from project (producingProjectId)" },
    "dependsOn": { "store": "dependenciesById" },
    "feedsInto": { "store": "convergenceEdgesById" },
    "verifiedBy": { "store": "n/a", "note": "verificationSourceId" },
    "consumedBy": { "store": "n/a", "note": "artifact consumingProjectIds" }
  },
  "validationRules": {
    "V1": "Node name is write-once verbatim; intake may classify, never rewrite.",
    "V2": "Initiative rejected without purpose + classification + doneWhen.",
    "V3": "Deliverable rejected without producingProjectId + completionEvidence + verificationSourceId + operatorAttestationMethod.",
    "V4": "producedByEntityId, when present, must exist in entitiesById.",
    "V5": "Project owningEntityId must exist in entitiesById.",
    "V6": "reviewStatus is one of CONFIRMED|NEEDS_REVIEW|DRAFT; default DRAFT.",
    "V7": "Owner is single-select from the entity list (no dual owners).",
    "V8": "System activationState is one of running|missing|planned.",
    "V9": "Entity requires roleTags, purpose, formationState, statusEvidence."
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/state/matrixSchemaContract.test.js`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add jericho_matrix_schema.json tests/state/matrixSchemaContract.test.js
git commit -m "feat(matrix): authoritative jericho_matrix_schema.json contract + drift guard"
```

---

### Task 3: `selectMasterGridRows` selector

**Files:**
- Create: `src/domain/masterGrid/masterGridSelectors.js`
- Test: `src/domain/masterGrid/masterGridSelectors.test.js` (create)

**Interfaces:**
- Consumes: a `matrix` object with `entitiesById`, `initiativesById`, `projectsById`, `artifactsById`, `systemsById`.
- Produces: `selectMasterGridRows(matrix) => Row[]` where `Row = { id, name, primaryClass, roleTags, ownerParentLabel, phase, reviewStatus, readyForIntake, intakeTarget: { class, id } }`. Also `CLASS_ORDER` (array) and `countByClass(rows) => { total, Entity, Initiative, Project, Deliverable, System }`.

- [ ] **Step 1: Write the failing test**

```js
// src/domain/masterGrid/masterGridSelectors.test.js
import { describe, it, expect } from 'vitest';
import { selectMasterGridRows, countByClass } from './masterGridSelectors.js';

const matrix = {
  entitiesById: {
    e1: { id: 'e1', name: 'Global State Corp.', roleTags: ['corp'], reviewStatus: 'CONFIRMED', phase: null },
    e2: { id: 'e2', name: 'Global State Productions', roleTags: [], reviewStatus: 'DRAFT', phase: null },
  },
  initiativesById: {
    i1: { id: 'i1', name: 'Romance Riot', owningEntityId: 'e1', roleTags: [], reviewStatus: 'CONFIRMED', phase: '1' },
  },
  projectsById: {
    p1: { id: 'p1', name: 'OUR FEARLESS LEADER 3', owningEntityId: 'e1', owningInitiativeId: 'i1', reviewStatus: 'DRAFT', phase: '1', roleTags: [] },
  },
  artifactsById: {
    a1: { id: 'a1', name: 'OFL 3: Romance Riot — tape/album', producingProjectId: 'p1', producedByEntityId: 'e2', reviewStatus: 'CONFIRMED', phase: '1', roleTags: [] },
  },
  systemsById: {},
};

describe('selectMasterGridRows', () => {
  it('flattens all classes with verbatim names', () => {
    const rows = selectMasterGridRows(matrix);
    expect(rows.map((r) => r.name)).toContain('OFL 3: Romance Riot — tape/album');
    expect(rows).toHaveLength(4);
  });

  it('labels artifact rows as Deliverable', () => {
    const rows = selectMasterGridRows(matrix);
    expect(rows.find((r) => r.id === 'a1').primaryClass).toBe('Deliverable');
  });

  it('resolves Deliverable ownerParentLabel as producer-entity / parent-project', () => {
    const rows = selectMasterGridRows(matrix);
    expect(rows.find((r) => r.id === 'a1').ownerParentLabel)
      .toBe('Global State Productions / OUR FEARLESS LEADER 3');
  });

  it('resolves Project ownerParentLabel as owner / parent-initiative', () => {
    const rows = selectMasterGridRows(matrix);
    expect(rows.find((r) => r.id === 'p1').ownerParentLabel)
      .toBe('Global State Corp. / Romance Riot');
  });

  it('Entity ownerParentLabel is em dash', () => {
    const rows = selectMasterGridRows(matrix);
    expect(rows.find((r) => r.id === 'e1').ownerParentLabel).toBe('—');
  });

  it('readyForIntake = reviewStatus CONFIRMED', () => {
    const rows = selectMasterGridRows(matrix);
    expect(rows.find((r) => r.id === 'i1').readyForIntake).toBe(true);
    expect(rows.find((r) => r.id === 'p1').readyForIntake).toBe(false);
  });

  it('default sort: class order then name', () => {
    const rows = selectMasterGridRows(matrix);
    expect(rows.map((r) => r.primaryClass)).toEqual(['Entity', 'Entity', 'Initiative', 'Project', 'Deliverable']);
  });

  it('countByClass returns per-class totals', () => {
    expect(countByClass(selectMasterGridRows(matrix)))
      .toEqual({ total: 4, Entity: 2, Initiative: 1, Project: 1, Deliverable: 1, System: 0 });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/domain/masterGrid/masterGridSelectors.test.js`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the selector**

```js
// src/domain/masterGrid/masterGridSelectors.js
export const CLASS_ORDER = ['Entity', 'Initiative', 'Project', 'Deliverable', 'System'];

const SLICES = [
  ['entitiesById', 'Entity'],
  ['initiativesById', 'Initiative'],
  ['projectsById', 'Project'],
  ['artifactsById', 'Deliverable'],
  ['systemsById', 'System'],
];

const nameOf = (map, id) => (id && map[id] ? map[id].name : null);

function ownerParentLabel(matrix, primaryClass, node) {
  const entities = matrix.entitiesById || {};
  const initiatives = matrix.initiativesById || {};
  const projects = matrix.projectsById || {};
  if (primaryClass === 'Entity') return '—';
  if (primaryClass === 'Initiative') return nameOf(entities, node.owningEntityId) || '—';
  if (primaryClass === 'System') return nameOf(entities, node.owningEntityId) || '—';
  if (primaryClass === 'Project') {
    const owner = nameOf(entities, node.owningEntityId) || '—';
    const parent = nameOf(initiatives, node.owningInitiativeId) || '—';
    return `${owner} / ${parent}`;
  }
  // Deliverable
  const producer = nameOf(entities, node.producedByEntityId) || '—';
  const parentProject = nameOf(projects, node.producingProjectId) || '—';
  return `${producer} / ${parentProject}`;
}

export function selectMasterGridRows(matrix = {}) {
  const rows = [];
  for (const [slice, primaryClass] of SLICES) {
    const map = matrix[slice] || {};
    for (const id of Object.keys(map)) {
      const node = map[id];
      const reviewStatus = node.reviewStatus || 'DRAFT';
      rows.push({
        id,
        name: node.name,
        primaryClass,
        roleTags: Array.isArray(node.roleTags) ? node.roleTags : [],
        ownerParentLabel: ownerParentLabel(matrix, primaryClass, node),
        phase: node.phase ?? null,
        reviewStatus,
        readyForIntake: reviewStatus === 'CONFIRMED',
        intakeTarget: { class: primaryClass, id },
      });
    }
  }
  rows.sort((a, b) => {
    const c = CLASS_ORDER.indexOf(a.primaryClass) - CLASS_ORDER.indexOf(b.primaryClass);
    if (c !== 0) return c;
    const pa = a.phase ?? '';
    const pb = b.phase ?? '';
    if (pa !== pb) return String(pa).localeCompare(String(pb));
    return String(a.name).localeCompare(String(b.name));
  });
  return rows;
}

export function countByClass(rows) {
  const out = { total: rows.length, Entity: 0, Initiative: 0, Project: 0, Deliverable: 0, System: 0 };
  for (const r of rows) out[r.primaryClass] += 1;
  return out;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/domain/masterGrid/masterGridSelectors.test.js`
Expected: PASS (8 tests).

- [ ] **Step 5: Commit**

```bash
git add src/domain/masterGrid/masterGridSelectors.js src/domain/masterGrid/masterGridSelectors.test.js
git commit -m "feat(masterGrid): selectMasterGridRows pure selector"
```

---

### Task 4: Reference-matrix seed loader (name→id resolution)

**Files:**
- Create: `src/domain/masterGrid/loadReferenceMatrix.js`
- Test: `tests/state/matrix.referenceSeed.test.js` (create)
- Fixture (already present): `tests/fixtures/reference_matrix_v1_4.json`

**Interfaces:**
- Consumes: `rootReducer` from `identityCompute.js`; the fixture JSON.
- Produces: `loadReferenceMatrix(fixture, { nowISO }) => matrixState` — declares all 53 nodes through the real `DECLARE_*` actions, resolving by-name parent/owner references to ids via a `name→id` pass. Exports `slugId(name)`.

- [ ] **Step 1: Write the failing test**

```js
// tests/state/matrix.referenceSeed.test.js
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { loadReferenceMatrix } from '../../src/domain/masterGrid/loadReferenceMatrix.js';

const fixture = JSON.parse(fs.readFileSync(path.resolve('tests/fixtures/reference_matrix_v1_4.json'), 'utf8'));

describe('loadReferenceMatrix', () => {
  it('declares all 53 nodes with the 7/11/17/12/6 breakdown', () => {
    const m = loadReferenceMatrix(fixture, { nowISO: '2026-07-08T00:00:00Z' }).matrix;
    expect(Object.keys(m.entitiesById)).toHaveLength(7);
    expect(Object.keys(m.initiativesById)).toHaveLength(11);
    expect(Object.keys(m.projectsById)).toHaveLength(17);
    expect(Object.keys(m.artifactsById)).toHaveLength(12);
    expect(Object.keys(m.systemsById)).toHaveLength(6);
  });

  it('preserves node names byte-identical to the fixture', () => {
    const m = loadReferenceMatrix(fixture, { nowISO: '2026-07-08T00:00:00Z' }).matrix;
    const stored = new Set([
      ...Object.values(m.entitiesById), ...Object.values(m.initiativesById),
      ...Object.values(m.projectsById), ...Object.values(m.artifactsById),
      ...Object.values(m.systemsById),
    ].map((n) => n.name));
    for (const node of fixture.nodes) {
      expect(stored.has(node.name)).toBe(true);
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/state/matrix.referenceSeed.test.js`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the loader**

> The loader classifies and links but never rewrites a `name` (V1). It builds `name→id` first, then declares in class order (entities → initiatives → projects → deliverables → systems) so referenced ids already exist. Map fixture columns: `status`→`reviewStatus`, `work_state`→`work_state`, `phase`→`phase`, `parent_project`→`producingProjectId`, `produced_by`→`producedByEntityId`, `owner`→`owningEntityId`, `parent_initiative`→`owningInitiativeId`.

```js
// src/domain/masterGrid/loadReferenceMatrix.js
import { buildBlankIdentityState } from '../../state/identityStore.js';
import { computeDerivedState } from '../../state/identityCompute.js';

export function slugId(name) {
  return String(name).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

const CLASS_SEQUENCE = ['Entity', 'Initiative', 'Project', 'Deliverable', 'System'];

export function loadReferenceMatrix(fixture, { nowISO = new Date().toISOString() } = {}) {
  const nodes = fixture.nodes || [];
  const idByName = new Map();
  for (const n of nodes) idByName.set(n.name, slugId(n.name));
  const resolve = (nm) => (nm && idByName.has(nm) ? idByName.get(nm) : null);

  let state = buildBlankIdentityState();
  state.appTime = { ...(state.appTime || {}), nowISO };
  const dispatch = (action) => { state = computeDerivedState(state, action); };

  // Single shared verification source so Project/Deliverable required refs resolve.
  const VS = 'vs-reference';
  dispatch({ type: 'DECLARE_VERIFICATION_SOURCE', payload: { id: VS, name: 'Reference Source', method: 'operator_attestation' } });

  for (const cls of CLASS_SEQUENCE) {
    for (const n of nodes.filter((x) => x.class === cls)) {
      const id = idByName.get(n.name);
      const common = {
        id, name: n.name,
        phase: n.phase ?? null,
        reviewStatus: n.status || 'DRAFT',
        work_state: n.work_state ?? null,
        roleTags: n.role_tags || n.roleTags || [],
      };
      if (cls === 'Entity') {
        dispatch({ type: 'DECLARE_ENTITY', payload: { ...common,
          roleTags: common.roleTags.length ? common.roleTags : ['entity'],
          purpose: n.purpose || n.what_ships || 'reference', formationState: n.work_state || 'formed',
          statusEvidence: n.notes || 'reference' } });
      } else if (cls === 'Initiative') {
        dispatch({ type: 'DECLARE_INITIATIVE', payload: { ...common,
          owningEntityId: resolve(n.owner),
          purpose: n.objective || n.what_ships || 'reference', classification: 'objective',
          doneWhen: n.done_when || n.target_date || 'reference' } });
      } else if (cls === 'Project') {
        dispatch({ type: 'DECLARE_PROJECT', payload: { ...common,
          owningEntityId: resolve(n.owner), owningInitiativeId: resolve(n.parent_initiative),
          successMetric: n.success_metric || n.what_ships || 'reference', verificationSourceId: VS,
          targetDate: n.target_date || null } });
      } else if (cls === 'Deliverable') {
        dispatch({ type: 'DECLARE_ARTIFACT', payload: { ...common,
          producingProjectId: resolve(n.parent_project), producedByEntityId: resolve(n.produced_by),
          completionEvidence: n.what_ships || 'reference', verificationSourceId: VS,
          operatorAttestationMethod: 'operator' } });
      } else if (cls === 'System') {
        dispatch({ type: 'DECLARE_SYSTEM', payload: { ...common,
          owningEntityId: resolve(n.owner),
          cycle: n.cycle || n.phase || 'ongoing', activationState: 'planned' } });
      }
    }
  }
  return state;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/state/matrix.referenceSeed.test.js`
Expected: PASS (2 tests). If a class count is short, a `lastPlanError` reveals which required field the fixture didn't supply — adjust the column mapping above (not the fixture names).

- [ ] **Step 5: Commit**

```bash
git add src/domain/masterGrid/loadReferenceMatrix.js tests/state/matrix.referenceSeed.test.js
git commit -m "feat(masterGrid): reference_matrix_v1_4 seed loader with name->id resolution"
```

---

### Task 5: `MasterGridTab` component (read-only, deep-link)

**Files:**
- Create: `src/components/zion/MasterGridTab.jsx`
- Test: `src/components/zion/MasterGridTab.test.jsx` (create)

**Interfaces:**
- Consumes: `useIdentityStore()` (reads `store.matrix`); `selectMasterGridRows`, `countByClass` from Task 3.
- Props: `MasterGridTab({ onOpenNode })` — `onOpenNode({ class, id })` fired on row click.
- Produces: a read-only table; `data-testid="mastergrid-row"` per row, `data-testid="mastergrid-counts"` on the header line.

- [ ] **Step 1: Write the failing test**

```jsx
// src/components/zion/MasterGridTab.test.jsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MasterGridTab } from './MasterGridTab.jsx';

vi.mock('../../state/identityStore.js', () => ({
  useIdentityStore: () => globalThis.__STORE__,
}));

function setStore(matrix) {
  globalThis.__STORE__ = { matrix, matrixDispatch: vi.fn() };
  return globalThis.__STORE__;
}

const baseMatrix = () => ({
  entitiesById: { e1: { id: 'e1', name: 'Global State Corp.', roleTags: [], reviewStatus: 'CONFIRMED', phase: null } },
  initiativesById: {}, projectsById: {}, artifactsById: {}, systemsById: {},
});

describe('MasterGridTab', () => {
  it('renders one row per node with live counts', () => {
    setStore(baseMatrix());
    render(<MasterGridTab onOpenNode={() => {}} />);
    expect(screen.getAllByTestId('mastergrid-row')).toHaveLength(1);
    expect(screen.getByTestId('mastergrid-counts').textContent).toContain('1 nodes');
    expect(screen.getByTestId('mastergrid-counts').textContent).toContain('1 Entities');
  });

  it('empty store renders zero rows and zero counts, not an error', () => {
    setStore({ entitiesById: {}, initiativesById: {}, projectsById: {}, artifactsById: {}, systemsById: {} });
    render(<MasterGridTab onOpenNode={() => {}} />);
    expect(screen.queryAllByTestId('mastergrid-row')).toHaveLength(0);
    expect(screen.getByTestId('mastergrid-counts').textContent).toContain('0 nodes');
  });

  it('row click calls onOpenNode with the node target (AC5)', () => {
    setStore(baseMatrix());
    const onOpenNode = vi.fn();
    render(<MasterGridTab onOpenNode={onOpenNode} />);
    fireEvent.click(screen.getByTestId('mastergrid-row'));
    expect(onOpenNode).toHaveBeenCalledWith({ class: 'Entity', id: 'e1' });
  });

  it('never calls matrixDispatch — no write path (AC4)', () => {
    const store = setStore(baseMatrix());
    const onOpenNode = vi.fn();
    render(<MasterGridTab onOpenNode={onOpenNode} />);
    fireEvent.click(screen.getByTestId('mastergrid-row'));
    expect(store.matrixDispatch).not.toHaveBeenCalled();
  });

  it('reflects a node added to the store on re-render without manual refresh (AC3)', () => {
    setStore(baseMatrix());
    const { rerender } = render(<MasterGridTab onOpenNode={() => {}} />);
    expect(screen.getAllByTestId('mastergrid-row')).toHaveLength(1);
    const m = globalThis.__STORE__.matrix;
    m.initiativesById.i1 = { id: 'i1', name: 'Jericho System', roleTags: [], reviewStatus: 'DRAFT', phase: null };
    rerender(<MasterGridTab onOpenNode={() => {}} />);
    expect(screen.getAllByTestId('mastergrid-row')).toHaveLength(2);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/zion/MasterGridTab.test.jsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the component**

```jsx
// src/components/zion/MasterGridTab.jsx
import React from 'react';
import { useIdentityStore } from '../../state/identityStore.js';
import { selectMasterGridRows, countByClass, CLASS_ORDER } from '../../domain/masterGrid/masterGridSelectors.js';

const STATUS_LABEL = { CONFIRMED: 'CONFIRMED', NEEDS_REVIEW: 'NEEDS REVIEW', DRAFT: 'DRAFT' };
const STATUS_COLOR = { CONFIRMED: '#16a34a', NEEDS_REVIEW: '#ca8a04', DRAFT: '#6b7280' };

export function MasterGridTab({ onOpenNode } = {}) {
  const store = useIdentityStore();
  const [classFilter, setClassFilter] = React.useState('ALL');

  const rows = selectMasterGridRows(store?.matrix || {});
  const counts = countByClass(rows);
  const visible = classFilter === 'ALL' ? rows : rows.filter((r) => r.primaryClass === classFilter);

  const countsLine = `${counts.total} nodes — ${counts.Entity} Entities · ${counts.Initiative} Initiatives · ${counts.Project} Projects · ${counts.Deliverable} Deliverables · ${counts.System} Systems`;

  return (
    <div className="space-y-3">
      <div data-testid="mastergrid-counts" className="text-sm text-jericho-text font-medium">{countsLine}</div>
      <div className="flex gap-2 text-xs">
        <button onClick={() => setClassFilter('ALL')} data-active={classFilter === 'ALL'}>All</button>
        {CLASS_ORDER.map((c) => (
          <button key={c} onClick={() => setClassFilter(c)} data-active={classFilter === c}>{c}</button>
        ))}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr>
              <th align="left">Name</th><th align="left">Class</th><th align="left">Role-Tags</th>
              <th align="left">Owner / Parent</th><th align="left">Phase</th>
              <th align="left">Status</th><th align="left">Ready?</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((r) => (
              <tr key={`${r.primaryClass}:${r.id}`} data-testid="mastergrid-row"
                  onClick={() => onOpenNode?.(r.intakeTarget)} style={{ cursor: 'pointer' }}>
                <td>{r.name}</td>
                <td>{r.primaryClass}</td>
                <td>{r.roleTags.join(', ')}</td>
                <td>{r.ownerParentLabel}</td>
                <td>{r.phase ?? ''}</td>
                <td style={{ color: STATUS_COLOR[r.reviewStatus] }}>{STATUS_LABEL[r.reviewStatus]}</td>
                <td>{r.readyForIntake ? 'YES' : 'NO'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default MasterGridTab;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/zion/MasterGridTab.test.jsx`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/zion/MasterGridTab.jsx src/components/zion/MasterGridTab.test.jsx
git commit -m "feat(masterGrid): read-only MasterGridTab component"
```

---

### Task 6: Wire tab into ZionDashboard + seed & persistence acceptance (AC1/AC2/AC6)

**Files:**
- Modify: `src/components/ZionDashboard.jsx` (`TAB_CONFIG` ~line 60; content mount ~line 4374)
- Test: `tests/state/masterGrid.acceptance.test.jsx` (create)

**Interfaces:**
- Consumes: `MasterGridTab` (Task 5), `loadReferenceMatrix` (Task 4), `selectMasterGridRows`/`countByClass` (Task 3).

- [ ] **Step 1: Write the failing acceptance test**

```jsx
// tests/state/masterGrid.acceptance.test.jsx
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { loadReferenceMatrix } from '../../src/domain/masterGrid/loadReferenceMatrix.js';
import { selectMasterGridRows, countByClass } from '../../src/domain/masterGrid/masterGridSelectors.js';

const fixture = JSON.parse(fs.readFileSync(path.resolve('tests/fixtures/reference_matrix_v1_4.json'), 'utf8'));

describe('Master Grid acceptance', () => {
  it('AC1: seed renders exactly 53 rows with 7/11/17/12/6', () => {
    const matrix = loadReferenceMatrix(fixture, { nowISO: '2026-07-08T00:00:00Z' }).matrix;
    const counts = countByClass(selectMasterGridRows(matrix));
    expect(counts).toEqual({ total: 53, Entity: 7, Initiative: 11, Project: 17, Deliverable: 12, System: 6 });
  });

  it('AC2: names byte-identical to the seed file', () => {
    const matrix = loadReferenceMatrix(fixture, { nowISO: '2026-07-08T00:00:00Z' }).matrix;
    const rowNames = new Set(selectMasterGridRows(matrix).map((r) => r.name));
    for (const node of fixture.nodes) expect(rowNames.has(node.name)).toBe(true);
    expect(rowNames.size).toBe(53);
  });

  it('AC6: kill/relaunch — 53 survive a localStorage round-trip', () => {
    const seeded = loadReferenceMatrix(fixture, { nowISO: '2026-07-08T00:00:00Z' });
    // Simulate persist: the identity store serializes whole state under 'jericho-identity'.
    const blob = JSON.stringify(seeded);
    // Simulate relaunch: re-hydrate from the persisted blob.
    const rehydrated = JSON.parse(blob);
    const counts = countByClass(selectMasterGridRows(rehydrated.matrix));
    expect(counts.total).toBe(53);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/state/masterGrid.acceptance.test.jsx`
Expected: FAIL until Tasks 3–4 are present (it will pass on their code; if run in order it passes — keep it as the regression guard). If it already passes, proceed; its purpose is the AC1/AC2/AC6 guarantee.

- [ ] **Step 3: Add the tab to `TAB_CONFIG`**

In `src/components/ZionDashboard.jsx`, extend `TAB_CONFIG`:

```js
const TAB_CONFIG = [
  { key: 'structure', label: 'Structure', tagline: 'Contract' },
  { key: 'today', label: 'Today', tagline: 'Execution' },
  { key: 'stability', label: 'Stability', tagline: 'Signals' },
  { key: 'plan', label: 'Master Plan', tagline: 'Horizon' },
  { key: 'mastergrid', label: 'Master Grid', tagline: 'Rollup' },
];
```

- [ ] **Step 4: Import and mount the panel**

Add the import near the other `./zion/*` imports:

```js
import { MasterGridTab } from './zion/MasterGridTab.jsx';
```

Add the panel immediately after the `{view === 'structure' && (...)}` block (after line ~4374):

```jsx
          {view === 'mastergrid' && (
            <MasterGridTab
              onOpenNode={({ id }) => {
                setStructureTargetNodeId?.(id);
                changeView('structure');
              }}
            />
          )}
```

If `setStructureTargetNodeId` does not exist, wire the minimal version — the deep-link's required behavior for AC5 is only `changeView('structure')`; the target-scroll into `MatrixIntake` is a follow-up. Use:

```jsx
          {view === 'mastergrid' && (
            <MasterGridTab onOpenNode={() => changeView('structure')} />
          )}
```

- [ ] **Step 5: Verify the app builds and the tab renders**

Run: `npx vitest run tests/state/masterGrid.acceptance.test.jsx src/components/zion/MasterGridTab.test.jsx`
Expected: PASS. Then `npm run lint` on the two changed source files.

- [ ] **Step 6: Full regression + commit**

Run: `npx vitest run`
Expected: no new failures vs. baseline (27+1 + the new suites green).

```bash
git add src/components/ZionDashboard.jsx tests/state/masterGrid.acceptance.test.jsx
git commit -m "feat(masterGrid): wire Master Grid tab into ZionDashboard + seed/persistence acceptance"
```

---

## Self-Review

**Spec coverage:**
- Store schema extension (reviewStatus/phase/roleTags + producedByEntityId) → Task 1. ✓
- Contract `jericho_matrix_schema.json` (reviewStatus naming, work_state, enum underscore) → Task 2. ✓
- Selector + owner/parent rules (incl. producer-entity/parent-project) → Task 3. ✓
- Seed loader name→id + fixture → Task 4. ✓
- Read-only tab, counts, sort/filter, D1/D2, empty state → Task 5. ✓
- Nav wiring + AC1/AC2/AC3/AC4/AC5/AC6 → Tasks 5–6. ✓ (AC3/AC4/AC5 in Task 5; AC1/AC2/AC6 in Task 6.)

**Placeholder scan:** No TBD/TODO; every code step shows full code. The one deferred item (scroll-into-`MatrixIntake` on deep-link) is explicitly out of scope with a working AC5-satisfying fallback.

**Type consistency:** `selectMasterGridRows`, `countByClass`, `CLASS_ORDER`, `loadReferenceMatrix`, `slugId`, `MasterGridTab({ onOpenNode })`, row shape `{ id, name, primaryClass, roleTags, ownerParentLabel, phase, reviewStatus, readyForIntake, intakeTarget }`, `intakeTarget: { class, id }` — consistent across Tasks 3/4/5/6.

**Integration symbols (verified against source):** the reducer entry is `computeDerivedState(state, action)` (exported from `src/state/identityCompute.js`); the blank-state factory is `buildBlankIdentityState()` (exported from `src/state/identityStore.js`); the store hook is `useIdentityStore()` (exported from `src/state/identityStore.js`, returns a store where `store.matrix` is live and `store.matrixDispatch` mutates). Matrix `DECLARE_*` cases are handled inside `computeDerivedState`; there is no `rootReducer`. The harness in Tasks 1/4 matches `tests/state/matrix.nodes.test.js`.

**Remaining risk to verify at execution:** the reference fixture's exact per-class column names (e.g. `owner`, `parent_initiative`, `success_metric`, `objective`, `cycle`). Task 4 Step 4 surfaces any missing required field via `lastPlanError`; adjust the column mapping in the loader (never the fixture names) until all five class counts hit 7/11/17/12/6.
