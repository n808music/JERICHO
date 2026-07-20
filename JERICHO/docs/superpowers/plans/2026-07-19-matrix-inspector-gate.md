# Matrix-Inspector Gate Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** An advisory Structure-tab surface that shows the canonical matrix per section and computes a four-check coherence verdict inline — never blocking.

**Architecture:** A pure audit module (`auditMatrixCoherence(matrix) → { verdict, summary, findings }`) consumed by a read-only React panel that reads `store.matrix`. One-way data flow; the panel writes nothing.

**Tech Stack:** JavaScript (ESM) domain module + React (Vite) panel, Vitest + Testing Library, Tailwind classes matching sibling Structure panels.

**Design doc:** `docs/superpowers/specs/2026-07-19-matrix-inspector-gate-design.md`

## Global Constraints

- **Pure audit:** `matrixCoherenceAudit.js` is a pure function of `matrix` — no React, no imports from the store, no side effects. The panel is the only React piece.
- **Single phase validator:** the phase check MUST go through `classifyPhase` from `src/domain/masterGrid/phaseClassification.js`. Do not write a second phase parser.
- **Determinism:** findings are emitted check-by-check (1→4) and, within a check, nodes iterated in sorted-id order. Same `matrix` → deep-equal `findings`.
- **Disclosure Standard:** every finding `message` cites the rule, names the referent by name, and states the fix.
- **Advisory only:** nothing in this feature blocks `MARK_MATRIX_INTAKE_COMPLETE` or plan generation. `verdict` drives a badge color, nothing else.
- **Authority:** the panel is registered `ADVISORY` in `uiAuthorityMap.ts`; its `writes` array is empty.
- **Matrix slice keys (exact):** `entitiesById`, `initiativesById`, `projectsById`, `systemsById`, `artifactsById` (= deliverables), `verificationSourcesById` (= sources), `dependenciesById`. Dependency edges carry `upstreamId` / `downstreamId`.

---

## File Structure

- `src/domain/masterGrid/matrixCoherenceAudit.js` — new, pure. The audit.
- `src/domain/masterGrid/matrixCoherenceAudit.test.js` — new. Pure unit tests (the bulk).
- `src/components/zion/MatrixInspectorPanel.jsx` — new, read-only panel.
- `tests/components/MatrixInspectorPanel.render.test.jsx` — new. Light render test.
- `src/contracts/uiAuthorityMap.ts` — modify. Register the panel `ADVISORY`.
- `src/components/zion/StructurePageConsolidated.jsx` — modify. Import + render the panel.

---

## Task 1: Pure coherence audit module

**Files:**
- Create: `src/domain/masterGrid/matrixCoherenceAudit.js`
- Test: `src/domain/masterGrid/matrixCoherenceAudit.test.js`

**Interfaces:**
- Consumes: `classifyPhase(raw, nodeName)` from `src/domain/masterGrid/phaseClassification.js` — returns `1|2|3` for canonical, `null` for absent/blank, **throws** `NonCanonicalPhaseError` for out-of-set.
- Produces: `auditMatrixCoherence(matrix) → { verdict: 'clean'|'issues', summary, findings[] }`.
  - `Finding = { code, kind: 'structural'|'completeness', nodeType, nodeId, nodeName, message }`.
  - `summary = { entities, initiatives, projects, systems, deliverables, sources, dependencies, projectsPlaced, projectsResidual, initiativesPlaced, initiativesResidual }`.

- [ ] **Step 1: Write the failing test**

Create `src/domain/masterGrid/matrixCoherenceAudit.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { auditMatrixCoherence } from './matrixCoherenceAudit.js';

// A fully-coherent minimal matrix: one entity, one source, one placed project, one placed initiative.
function coherentMatrix() {
  return {
    entitiesById: { e1: { id: 'e1', name: 'Global State Corp.' } },
    verificationSourcesById: { v1: { id: 'v1', source: 'Spotify for Artists', domain: 'streams' } },
    initiativesById: { i1: { id: 'i1', name: 'OFL Campaign', owningEntityId: 'e1', phase: 2 } },
    projectsById: {
      p1: { id: 'p1', name: 'Romance Riot', owningEntityId: 'e1', successMetric: '10k streams', verificationSourceId: 'v1', phase: 2 },
    },
    systemsById: {}, artifactsById: {}, dependenciesById: {},
  };
}

describe('auditMatrixCoherence', () => {
  it('a coherent matrix returns clean with no findings', () => {
    const r = auditMatrixCoherence(coherentMatrix());
    expect(r.verdict).toBe('clean');
    expect(r.findings).toEqual([]);
    expect(r.summary.projectsPlaced).toBe(1);
    expect(r.summary.projectsResidual).toBe(0);
    expect(r.summary.initiativesPlaced).toBe(1);
  });

  it('Check 1: flags a dangling project owner', () => {
    const m = coherentMatrix();
    m.projectsById.p1.owningEntityId = 'ghost';
    const codes = auditMatrixCoherence(m).findings.map((f) => f.code);
    expect(codes).toContain('DANGLING_PROJECT_OWNER');
  });

  it('Check 1: flags a dangling initiative owner but NOT an entity-less initiative', () => {
    const m = coherentMatrix();
    m.initiativesById.i1.owningEntityId = 'ghost';
    expect(auditMatrixCoherence(m).findings.map((f) => f.code)).toContain('DANGLING_INITIATIVE_OWNER');
    const m2 = coherentMatrix();
    m2.initiativesById.i1.owningEntityId = null;
    m2.initiativesById.i1.owningEntityIds = [];
    expect(auditMatrixCoherence(m2).findings.map((f) => f.code)).not.toContain('DANGLING_INITIATIVE_OWNER');
  });

  it('Check 1: flags a dangling verification source and a dangling dependency endpoint', () => {
    const m = coherentMatrix();
    m.projectsById.p1.verificationSourceId = 'ghost';
    m.dependenciesById = { d1: { id: 'd1', upstreamId: 'p1', downstreamId: 'nope' } };
    const codes = auditMatrixCoherence(m).findings.map((f) => f.code);
    expect(codes).toContain('DANGLING_VERIFICATION_SOURCE');
    expect(codes).toContain('DANGLING_DEPENDENCY_ENDPOINT');
  });

  it('Check 2: flags empty required sections and projects-without-sources', () => {
    expect(auditMatrixCoherence({}).findings.map((f) => f.code)).toEqual(
      expect.arrayContaining(['EMPTY_ENTITIES', 'EMPTY_PROJECTS'])
    );
    const m = coherentMatrix();
    m.verificationSourcesById = {};
    m.projectsById.p1.verificationSourceId = ''; // avoid also tripping the dangling check
    expect(auditMatrixCoherence(m).findings.map((f) => f.code)).toContain('MISSING_SOURCES_FOR_PROJECTS');
  });

  it('Check 3: residual (null) phase is a completeness finding; non-canonical is structural', () => {
    const m = coherentMatrix();
    m.projectsById.p1.phase = null;
    m.initiativesById.i1.phase = null;
    let r = auditMatrixCoherence(m);
    const residual = r.findings.filter((f) => f.code === 'PHASE_RESIDUAL');
    expect(residual.map((f) => f.nodeType).sort()).toEqual(['initiative', 'project']);
    expect(residual.every((f) => f.kind === 'completeness')).toBe(true);
    expect(r.summary.projectsResidual).toBe(1);
    expect(r.summary.initiativesResidual).toBe(1);

    const m2 = coherentMatrix();
    m2.projectsById.p1.phase = '7';
    r = auditMatrixCoherence(m2);
    const nc = r.findings.find((f) => f.code === 'PHASE_NON_CANONICAL');
    expect(nc?.kind).toBe('structural');
  });

  it('Check 4: flags a project missing metric or source', () => {
    const m = coherentMatrix();
    m.projectsById.p1.successMetric = '';
    expect(auditMatrixCoherence(m).findings.map((f) => f.code)).toContain('LAW2_MISSING_METRIC');
    const m2 = coherentMatrix();
    m2.projectsById.p1.verificationSourceId = '';
    expect(auditMatrixCoherence(m2).findings.map((f) => f.code)).toContain('LAW2_MISSING_SOURCE');
  });

  it('every finding message names its referent and the fix (Disclosure)', () => {
    const m = coherentMatrix();
    m.projectsById.p1.owningEntityId = 'ghost';
    const f = auditMatrixCoherence(m).findings.find((x) => x.code === 'DANGLING_PROJECT_OWNER');
    expect(f.message).toContain('Romance Riot'); // referent named
    expect(f.message.length).toBeGreaterThan(40); // carries a plain-words fix, not a bare code
  });

  it('is deterministic — same matrix yields deep-equal findings', () => {
    const m = coherentMatrix();
    m.projectsById.p1.owningEntityId = 'ghost';
    m.projectsById.p1.phase = null;
    expect(auditMatrixCoherence(m).findings).toEqual(auditMatrixCoherence(m).findings);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/domain/masterGrid/matrixCoherenceAudit.test.js`
Expected: FAIL — `auditMatrixCoherence` is not defined / module not found.

- [ ] **Step 3: Write the implementation**

Create `src/domain/masterGrid/matrixCoherenceAudit.js`:

```js
// Pure coherence audit for the canonical matrix (Matrix-Inspector Gate, advisory).
// Input: state.matrix. Output: { verdict, summary, findings }. No React, no writes.
// The phase check goes through the single shared classifyPhase (no second validator).
import { classifyPhase } from './phaseClassification.js';

const idsSorted = (map) => Object.keys(map || {}).sort();

// classifyPhase: canonical → number, absent/blank → null, non-canonical → throws.
function phaseBucket(raw, nodeName) {
  try {
    const p = classifyPhase(raw, nodeName);
    return p == null ? { residual: true } : { placed: true };
  } catch {
    return { nonCanonical: true };
  }
}

export function auditMatrixCoherence(matrix = {}) {
  const entities = matrix.entitiesById || {};
  const initiatives = matrix.initiativesById || {};
  const projects = matrix.projectsById || {};
  const systems = matrix.systemsById || {};
  const deliverables = matrix.artifactsById || {};
  const sources = matrix.verificationSourcesById || {};
  const dependencies = matrix.dependenciesById || {};

  const findings = [];
  const push = (code, kind, nodeType, nodeId, nodeName, message) =>
    findings.push({ code, kind, nodeType, nodeId, nodeName, message });

  // ---- Check 1: dangling references (structural) ----
  for (const id of idsSorted(projects)) {
    const p = projects[id];
    if (p?.owningEntityId && !entities[p.owningEntityId]) {
      push('DANGLING_PROJECT_OWNER', 'structural', 'project', id, p.name || id,
        `Project "${p.name || id}" is owned by "${p.owningEntityId}", which isn't declared in §2 Entities. Declare that entity, or repoint the project to a declared one.`);
    }
  }
  for (const id of idsSorted(initiatives)) {
    const init = initiatives[id];
    const owners = Array.isArray(init?.owningEntityIds) && init.owningEntityIds.length
      ? init.owningEntityIds
      : (init?.owningEntityId ? [init.owningEntityId] : []);
    for (const ownerId of owners) {
      if (!entities[ownerId]) {
        push('DANGLING_INITIATIVE_OWNER', 'structural', 'initiative', id, init.name || id,
          `Initiative "${init.name || id}" names owner "${ownerId}", which isn't declared in §2 Entities. Declare that entity, or repoint the initiative.`);
      }
    }
  }
  for (const id of idsSorted(projects)) {
    const p = projects[id];
    if (p?.verificationSourceId && !sources[p.verificationSourceId]) {
      push('DANGLING_VERIFICATION_SOURCE', 'structural', 'project', id, p.name || id,
        `Project "${p.name || id}" reads its result from source "${p.verificationSourceId}", which isn't declared in §1A Verification Sources. Declare the source, or repoint the project.`);
    }
  }
  const nodeExists = (nid) =>
    Boolean(entities[nid] || initiatives[nid] || projects[nid] || systems[nid] || deliverables[nid]);
  for (const id of idsSorted(dependencies)) {
    const edge = dependencies[id];
    for (const endKey of ['upstreamId', 'downstreamId']) {
      const endId = edge?.[endKey];
      if (endId && !nodeExists(endId)) {
        push('DANGLING_DEPENDENCY_ENDPOINT', 'structural', 'dependency', id, id,
          `Dependency "${id}" points to "${endId}" (${endKey}), which resolves to no declared node. Remove the edge, or declare the missing node.`);
      }
    }
  }

  // ---- Check 2: required sections non-empty (structural) ----
  if (Object.keys(entities).length === 0) {
    push('EMPTY_ENTITIES', 'structural', 'section', '', '§2 Entities',
      `No entities are declared. A plan needs at least one entity to own the work — declare one in §2.`);
  }
  if (Object.keys(projects).length === 0) {
    push('EMPTY_PROJECTS', 'structural', 'section', '', '§5 Projects',
      `No projects are declared. A plan needs at least one project to execute — declare one in §5.`);
  } else if (Object.keys(sources).length === 0) {
    push('MISSING_SOURCES_FOR_PROJECTS', 'structural', 'section', '', '§1A Verification Sources',
      `Projects exist but no verification source is declared. Every project's result must be readable somewhere (Law 2) — declare at least one source in §1A.`);
  }

  // ---- Check 3: phase attested on projects + initiatives ----
  let projectsPlaced = 0, projectsResidual = 0, initiativesPlaced = 0, initiativesResidual = 0;
  for (const id of idsSorted(projects)) {
    const p = projects[id];
    const b = phaseBucket(p?.phase, p?.name || id);
    if (b.placed) projectsPlaced += 1;
    else if (b.residual) {
      projectsResidual += 1;
      push('PHASE_RESIDUAL', 'completeness', 'project', id, p.name || id,
        `Project "${p.name || id}" has no attested phase, so it drops to the residual bucket and won't appear in the phase grid. Attest a phase (1, 2, or 3) to place it.`);
    } else {
      push('PHASE_NON_CANONICAL', 'structural', 'project', id, p.name || id,
        `Project "${p.name || id}" carries a non-canonical phase ${JSON.stringify(p?.phase)} (allowed: 1, 2, 3). This is corruption — re-attest a canonical phase.`);
    }
  }
  for (const id of idsSorted(initiatives)) {
    const init = initiatives[id];
    const b = phaseBucket(init?.phase, init?.name || id);
    if (b.placed) initiativesPlaced += 1;
    else if (b.residual) {
      initiativesResidual += 1;
      push('PHASE_RESIDUAL', 'completeness', 'initiative', id, init.name || id,
        `Initiative "${init.name || id}" has no attested phase, so its projects can't inherit an order from it. Attest a phase (1, 2, or 3).`);
    } else {
      push('PHASE_NON_CANONICAL', 'structural', 'initiative', id, init.name || id,
        `Initiative "${init.name || id}" carries a non-canonical phase ${JSON.stringify(init?.phase)} (allowed: 1, 2, 3). This is corruption — re-attest a canonical phase.`);
    }
  }

  // ---- Check 4: Law 2 completeness per project (completeness) ----
  for (const id of idsSorted(projects)) {
    const p = projects[id];
    if (!String(p?.successMetric || '').trim()) {
      push('LAW2_MISSING_METRIC', 'completeness', 'project', id, p.name || id,
        `Project "${p.name || id}" has no success metric — there's no measurable finish line. State what counts as done (a number or a clear event).`);
    }
    if (!String(p?.verificationSourceId || '').trim()) {
      push('LAW2_MISSING_SOURCE', 'completeness', 'project', id, p.name || id,
        `Project "${p.name || id}" has no verification source — there's nowhere to read the result. Name the tool or record you'd open to confirm it.`);
    }
  }

  const summary = {
    entities: Object.keys(entities).length,
    initiatives: Object.keys(initiatives).length,
    projects: Object.keys(projects).length,
    systems: Object.keys(systems).length,
    deliverables: Object.keys(deliverables).length,
    sources: Object.keys(sources).length,
    dependencies: Object.keys(dependencies).length,
    projectsPlaced, projectsResidual, initiativesPlaced, initiativesResidual,
  };

  return { verdict: findings.length ? 'issues' : 'clean', summary, findings };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/domain/masterGrid/matrixCoherenceAudit.test.js`
Expected: PASS (9 tests).

- [ ] **Step 5: Commit**

```bash
git add src/domain/masterGrid/matrixCoherenceAudit.js src/domain/masterGrid/matrixCoherenceAudit.test.js
git commit -m "feat(matrix): pure coherence audit (matrix-inspector gate, advisory)"
```

---

## Task 2: Read-only inspector panel + Structure-tab wiring

**Files:**
- Create: `src/components/zion/MatrixInspectorPanel.jsx`
- Create: `tests/components/MatrixInspectorPanel.render.test.jsx`
- Modify: `src/contracts/uiAuthorityMap.ts` (add one entry)
- Modify: `src/components/zion/StructurePageConsolidated.jsx` (import + render)

**Interfaces:**
- Consumes: `auditMatrixCoherence` (Task 1); `useIdentityStore()` from `src/state/identityStore.js` (exposes `store.matrix`).
- Produces: `export default function MatrixInspectorPanel()` — a self-contained read-only section.

- [ ] **Step 1: Write the failing render test**

Create `tests/components/MatrixInspectorPanel.render.test.jsx`:

```jsx
import React from 'react';
import '@testing-library/jest-dom';
import { render, screen, cleanup } from '@testing-library/react';
import { describe, it, expect, afterEach } from 'vitest';
import MatrixInspectorPanel from '../../src/components/zion/MatrixInspectorPanel.jsx';
import { IdentityProvider, buildBlankIdentityState } from '../../src/state/identityStore.js';
import { computeDerivedState } from '../../src/state/identityCompute.js';

afterEach(() => cleanup());

function stateWithMatrix(mutations) {
  let state = buildBlankIdentityState({});
  for (const m of mutations) state = computeDerivedState(state, m);
  return state;
}

describe('MatrixInspectorPanel', () => {
  it('shows an issue verdict and a finding message when the matrix is incoherent', () => {
    // Blank matrix → EMPTY_ENTITIES + EMPTY_PROJECTS findings.
    render(
      <IdentityProvider initialState={stateWithMatrix([])}>
        <MatrixInspectorPanel />
      </IdentityProvider>
    );
    expect(screen.getByText(/issue/i)).toBeInTheDocument();
    expect(screen.getByText(/No entities are declared/i)).toBeInTheDocument();
  });

  it('shows the Coherent verdict when the matrix passes all checks', () => {
    const seed = [
      { type: 'DECLARE_ENTITY', payload: { id: 'e1', name: 'Global State Corp.', roleTags: ['business'], purpose: 'Holding', formationState: 'functioning', statusEvidence: 'operating' } },
      { type: 'DECLARE_VERIFICATION_SOURCE', payload: { id: 'v1', domain: 'streams', source: 'Spotify for Artists' } },
      { type: 'DECLARE_PROJECT', payload: { id: 'p1', name: 'Romance Riot', owningEntityId: 'e1', successMetric: '10k streams', verificationSourceId: 'v1', phase: 2 } },
    ];
    render(
      <IdentityProvider initialState={stateWithMatrix(seed)}>
        <MatrixInspectorPanel />
      </IdentityProvider>
    );
    expect(screen.getByText(/Coherent/i)).toBeInTheDocument();
    expect(screen.getByText(/No coherence issues found/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/components/MatrixInspectorPanel.render.test.jsx`
Expected: FAIL — cannot resolve `MatrixInspectorPanel.jsx`.

- [ ] **Step 3: Implement the panel**

Create `src/components/zion/MatrixInspectorPanel.jsx` (Tailwind classes mirror sibling panels — `rounded-lg border p-3`, `text-muted`, `text-jericho-text`; high-contrast, theme-aware):

```jsx
import React, { useState } from 'react';
import { useIdentityStore } from '../../state/identityStore';
import { auditMatrixCoherence } from '../../domain/masterGrid/matrixCoherenceAudit.js';

const SECTION_ROWS = [
  ['§2 Entities', 'entities'],
  ['§3 Initiatives', 'initiatives'],
  ['§5 Projects', 'projects'],
  ['§1A Sources', 'sources'],
  ['§4 Systems', 'systems'],
  ['§6 Deliverables', 'deliverables'],
  ['Dependencies', 'dependencies'],
];

export default function MatrixInspectorPanel() {
  const store = useIdentityStore();
  const [open, setOpen] = useState(true);
  const { verdict, summary, findings } = auditMatrixCoherence(store?.matrix || {});
  const structural = findings.filter((f) => f.kind === 'structural');
  const completeness = findings.filter((f) => f.kind === 'completeness');

  return (
    <div className="rounded-lg border p-3">
      <button type="button" className="flex w-full items-center justify-between" onClick={() => setOpen((v) => !v)}>
        <span className="text-[11px] font-semibold tracking-[0.14em] text-muted">MATRIX INSPECTOR</span>
        <span
          className={`rounded px-2 py-0.5 text-xs font-semibold ${
            verdict === 'clean' ? 'bg-emerald-500/15 text-emerald-400' : 'bg-amber-500/15 text-amber-400'
          }`}
        >
          {verdict === 'clean' ? 'Coherent' : `${findings.length} issue${findings.length === 1 ? '' : 's'}`}
        </span>
      </button>

      {open && (
        <div className="mt-3 space-y-3">
          <table className="w-full text-xs text-jericho-text">
            <tbody>
              {SECTION_ROWS.map(([label, key]) => (
                <tr key={key}>
                  <td className="py-0.5 text-muted">{label}</td>
                  <td className="py-0.5 text-right tabular-nums">
                    {summary[key]}
                    {key === 'projects' && summary.projects > 0
                      ? ` — ${summary.projectsPlaced} placed · ${summary.projectsResidual} residual`
                      : ''}
                    {key === 'initiatives' && summary.initiatives > 0
                      ? ` — ${summary.initiativesPlaced} placed · ${summary.initiativesResidual} residual`
                      : ''}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {findings.length === 0 ? (
            <p className="text-xs text-muted">No coherence issues found.</p>
          ) : (
            <div className="space-y-2">
              {[['Structural', structural], ['Completeness', completeness]].map(([heading, list]) =>
                list.length === 0 ? null : (
                  <div key={heading} className="space-y-1">
                    <p className="text-[11px] font-semibold tracking-[0.14em] text-muted">{heading}</p>
                    {list.map((f, i) => (
                      <p key={`${f.code}-${f.nodeId}-${i}`} className="text-xs text-jericho-text">
                        {f.message}
                      </p>
                    ))}
                  </div>
                )
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Register the panel in the authority map**

Modify `src/contracts/uiAuthorityMap.ts` — add this entry inside `UI_AUTHORITY_MAP` (place it after the last existing entry, before the closing `};`):

```ts
  'structure.matrixInspector': {
    id: 'structure.matrixInspector',
    label: 'Matrix inspector',
    authority: 'ADVISORY',
    unit: 'matrix.coherence',
    scope: 'cycle',
    reads: ['identityStore:matrix'],
    writes: [],
    enforcedBy: ['masterGrid:auditMatrixCoherence'],
    notes: 'Read-only coherence verdict over the canonical matrix; never blocks.',
  },
```

- [ ] **Step 5: Wire the panel into the Structure page**

Modify `src/components/zion/StructurePageConsolidated.jsx`:

1. Add the import beside the other panel imports (near the `HorizonResolutionPanel` import, ~line 38):

```jsx
import MatrixInspectorPanel from './MatrixInspectorPanel.jsx';
```

2. Render it as a section inside the Structure page's returned JSX. Place `<MatrixInspectorPanel />` alongside the existing structure sections (e.g., immediately after the `MasterPlanStructureSection` block in the main content column). It takes no props:

```jsx
<MatrixInspectorPanel />
```

- [ ] **Step 6: Run the render test to verify it passes**

Run: `npx vitest run tests/components/MatrixInspectorPanel.render.test.jsx`
Expected: PASS (2 tests).

- [ ] **Step 7: Commit**

```bash
git add src/components/zion/MatrixInspectorPanel.jsx tests/components/MatrixInspectorPanel.render.test.jsx src/contracts/uiAuthorityMap.ts src/components/zion/StructurePageConsolidated.jsx
git commit -m "feat(matrix): read-only matrix-inspector panel in Structure tab (advisory)"
```

---

## Final verification

- [ ] Run the two new test files together: `npx vitest run src/domain/masterGrid/matrixCoherenceAudit.test.js tests/components/MatrixInspectorPanel.render.test.jsx` — all green.
- [ ] Reconcile the full suite against the frozen baseline (27 failed tests + 1 pre-existing collection error / 19 files). No new failures attributable to this change.
- [ ] Confirm `MatrixInspectorPanel` renders in the live Structure tab (dev server) — verdict badge + per-section summary + findings, no console errors.
