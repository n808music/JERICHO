# Matrix-Inspector Gate — Design

**Status:** Approved for planning (2026-07-19)
**Context:** Pre-intake-readiness prerequisite #2 of 4 (the 2026-07-16 operator ruling). The others: phase elicitation (done, `b2bdb4c`), name-persistence (verified), taxonomy-workbook (later). Purpose: make the next real intake *meaningful, not experimental* — the operator can see the canonical matrix and an honest coherence verdict before treating it as the basis for the plan/grid.

## Goal

A single **advisory** Structure-tab surface that (1) shows the current canonical matrix per section and (2) computes a four-check coherence verdict inline. It **never blocks** — the operator's judgment stays authoritative (JERICHO authority model). It writes nothing; it is a pure read/derive surface.

## Non-goals (YAGNI)

- No blocking of `MARK_MATRIX_INTAKE_COMPLETE` or plan generation. Advisory only. (The audit is a pure function, so a future gate could consume it without rework — but wiring a block is out of scope.)
- No editing/mutation from the panel (no repoint, no declare, no jump-to-fix actions). Read-only.
- No new persistence. The audit is recomputed from `store.matrix` on render.

## Architecture

Strictly one-way data flow, no path back into the store:

```
store.matrix ──► MatrixInspectorPanel ──► auditMatrixCoherence(matrix) ──► { verdict, summary, findings } ──► render
```

### Files

| File | Change | Responsibility |
|------|--------|----------------|
| `src/domain/masterGrid/matrixCoherenceAudit.js` | **new (pure)** | `auditMatrixCoherence(matrix) → { verdict, summary, findings[] }`. No React, no writes. Reuses `phaseClassification.js` (same shared validator as Gate 1 — no second phase path). |
| `src/components/zion/MatrixInspectorPanel.jsx` | **new (read-only)** | `useIdentityStore()` → reads `store.matrix` → calls the audit → renders a per-section summary, a verdict badge, and the findings. No mutating controls. Collapsible, matching sibling Structure panels. |
| `src/components/zion/StructurePageConsolidated.jsx` | modify | Import and render `MatrixInspectorPanel` as one section. |
| `src/contracts/uiAuthorityMap.ts` | modify | Register the panel `ADVISORY`. |
| `src/domain/masterGrid/matrixCoherenceAudit.test.js` | **new** | Pure unit tests — the bulk of the coverage. |
| `tests/components/MatrixInspectorPanel.render.test.jsx` | **new** | Light render test — verdict badge + a finding render from a seeded store. |

## The audit module — `auditMatrixCoherence(matrix)`

### Output shape

```js
{
  verdict: 'clean' | 'issues',        // clean = zero findings
  summary: {
    entities, initiatives, projects, systems, deliverables, sources, dependencies, // counts
    projectsPlaced, projectsResidual,       // projects with canonical phase vs null
    initiativesPlaced, initiativesResidual, // initiatives with canonical phase vs null
  },
  findings: Finding[],
}

// Finding
{
  code,                                  // typed string, see below
  kind: 'structural' | 'completeness',   // display grouping only — NOTHING blocks
  nodeType,                              // 'project' | 'initiative' | 'entity' | 'dependency' | 'section'
  nodeId,                                // id of the offending node ('' for section-level)
  nodeName,                              // human name of the referent
  message,                              // Disclosure-compliant: cites the rule, names the referent, states the fix
}
```

`verdict` is `'issues'` iff `findings.length > 0`, else `'clean'`. Nothing about the verdict blocks anything; it drives the badge color only.

### Disclosure Standard

Every `message` follows the project Disclosure Standard: cite the rule, state the violation in plain words naming the referent, and (where useful) show the compliant shape. Example:
`Project "Romance Riot" is owned by "ent-x", which isn't declared in §2 Entities. Declare that entity, or repoint the project to a declared one.`

### The four checks (emitted in fixed order 1→4, nodes by id, for determinism)

**Check 1 — No dangling references** (`kind: structural`)
- `DANGLING_PROJECT_OWNER` — a project's `owningEntityId` is set but not in `entitiesById`.
- `DANGLING_INITIATIVE_OWNER` — an initiative owner (`owningEntityIds`, else `owningEntityId`) is set but not in `entitiesById`. Entity-less initiatives (`owningEntityId === null`, no owners) are legal — not flagged.
- `DANGLING_VERIFICATION_SOURCE` — a project's `verificationSourceId` is set but not in `verificationSourcesById`.
- `DANGLING_DEPENDENCY_ENDPOINT` — a dependency's `upstreamId` or `downstreamId` resolves to no node in any section.

**Check 2 — Required sections non-empty** (`kind: structural`, `nodeType: 'section'`)
- `EMPTY_ENTITIES` — `entitiesById` empty. A plan needs at least one owner.
- `EMPTY_PROJECTS` — `projectsById` empty. A plan needs at least one execution unit.
- `MISSING_SOURCES_FOR_PROJECTS` — `projectsById` non-empty but `verificationSourcesById` empty. Projects imply at least one verification source (Law 2). (Initiatives, systems, deliverables remain genuinely optional — not flagged when empty.)

**Check 3 — Phase attested on placeable nodes** (projects *and* initiatives)
- `PHASE_RESIDUAL` (`kind: completeness`) — a project or initiative whose phase is null (via `toCanonicalPhase`). Legitimate unknown, but it won't appear in the phase grid — this is the visibility that explains a `0·0·0` grid *before* re-intaking.
- `PHASE_NON_CANONICAL` (`kind: structural`) — a raw phase outside {1,2,3}. Should not occur post-Gate-1; the audit uses `classifyPhase` defensively (catches the throw) and reports it if seen.

**Check 4 — Law 2 completeness per project** (`kind: completeness`)
- `LAW2_MISSING_METRIC` — a project with empty `successMetric`.
- `LAW2_MISSING_SOURCE` — a project with no `verificationSourceId`.
- (Committed projects already satisfy this via the `declareProject` reducer; the check is defensive and also catches any DRAFT/partial node.)

### Determinism

Findings are emitted check-by-check (1→4), and within a check, nodes are iterated in sorted-id order. The same `matrix` always yields a byte-identical `findings` array — matches the JERICHO determinism invariant and makes the audit snapshot-testable.

## The panel — `MatrixInspectorPanel.jsx`

A collapsible Structure-tab section titled **"Matrix Inspector"**, read-only. Layout top to bottom:

1. **Verdict badge** — green "Coherent" when `verdict === 'clean'`; amber "N issue(s)" otherwise (N = `findings.length`).
2. **Per-section summary** — a compact table from `summary`: §2 Entities, §3 Initiatives, §5 Projects, §1A Sources, §4 Systems, §6 Deliverables, Dependencies (counts). For projects and initiatives, also show `placed / residual` (e.g. "Projects 18 — 0 placed · 18 residual"), which is the direct read on why the grid is empty.
3. **Findings list** — grouped by `kind` (structural first, then completeness), each row showing the `message`. Empty state: "No coherence issues found." for `clean`.

No buttons that mutate state. Copy is theme-aware and high-contrast (Gate-5 legibility standard). Registered `ADVISORY` in `uiAuthorityMap.ts`.

## Testing

### `matrixCoherenceAudit.test.js` (pure — the bulk)

- **Clean matrix → `verdict: 'clean'`, `findings: []`** (one fully-coherent entity+source+project+initiative).
- **Each code fires once** on a crafted matrix isolating that violation:
  - dangling project owner, dangling initiative owner, dangling verification source, dangling dependency endpoint
  - empty entities, empty projects, projects-without-sources
  - residual project, residual initiative, non-canonical phase (defensive)
  - Law-2 missing metric, Law-2 missing source
- **`summary` counts** correct, including `projectsPlaced/Residual` and `initiativesPlaced/Residual`.
- **Determinism** — same matrix run twice yields deep-equal `findings`.
- **Entity-less initiative is not flagged** as dangling owner.

### `MatrixInspectorPanel.render.test.jsx` (light)

- Renders inside `IdentityProvider` with a seeded matrix that has one structural finding.
- Asserts the amber verdict badge shows the issue count and the finding `message` text is in the document.
- Asserts a `clean` seeded matrix shows the green "Coherent" badge and the empty-state text.

## Invariants honored

- **Engine authority** — the audit is a pure function of `matrix`; the panel writes nothing. No derived field is written from UI.
- **Determinism** — fixed finding order; same matrix → same output.
- **Disclosure Standard** — every finding cites rule + referent + fix.
- **Single phase validator** — the phase check goes through `phaseClassification.js`, not a second copy.
