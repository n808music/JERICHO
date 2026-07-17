// Adapter: canonical store.matrix -> sortByPhase input.
//
// Grid default-tier rule (operator ruling, Gate 5): the phase groups render the
// EXECUTION TIER — all Projects, plus any Deliverable promoted to a first-class
// row because it is a milestone lane whose parent project is already claimed by
// an earlier lane (so promoting keeps the convergence's lanes distinct).
//
//   gridNodes = allProjects ∪ { promoted lane deliverables }
//
// Fully attested-data-driven: add a Project → grid grows by one; a new
// convergence naming a deliverable lane whose parent is already a lane → that
// deliverable promotes. No hand list. See phaseGridFromStore.test for the
// causality assertion (Patent's membership is CAUSED by its lane membership).

// Lane→grid projection. Returns { claimedProjectByLane, promotedDeliverableIds }.
function projectLanes(matrix) {
  const projects = matrix.projectsById || {};
  const artifacts = matrix.artifactsById || {};
  const milestones = matrix.milestonesById || {};
  const claimedProjects = new Set();
  const promotedDeliverableIds = new Set();
  for (const ms of Object.values(milestones)) {
    for (const laneId of ms.laneIds || []) {
      const deliv = artifacts[laneId];
      if (!deliv) continue;
      const parentId = deliv.producingProjectId;
      if (parentId && projects[parentId] && !claimedProjects.has(parentId)) {
        claimedProjects.add(parentId); // lane collapses into its (still-free) parent project
      } else {
        promotedDeliverableIds.add(laneId); // parent already claimed (or missing) → standalone
      }
    }
  }
  return { promotedDeliverableIds };
}

// The grid's execution-tier node set (17 projects + promoted lane deliverables).
export function selectGridNodes(matrix = {}) {
  const projects = matrix.projectsById || {};
  const artifacts = matrix.artifactsById || {};
  const { promotedDeliverableIds } = projectLanes(matrix);
  const nodes = [];
  for (const id of Object.keys(projects)) nodes.push({ ...projects[id], id, primaryClass: 'Project' });
  for (const id of promotedDeliverableIds) if (artifacts[id]) nodes.push({ ...artifacts[id], id, primaryClass: 'Deliverable' });
  return nodes;
}

import { deriveEffectiveProjectPhases } from './phaseFromDependencies.js';

// Relational link kinds render as convergence ties (mutual); directional kinds do not.
const RELATIONAL_KINDS = new Set(['ships_with', 'soundtrack_of', 'promotes', 'feeds', 'loop']);

// Lenient canonical read (does NOT throw) — for INHERITED phases (owning initiative, producing
// project) where a non-canonical value is someone else's field, not this node's own attestation.
// The node's OWN raw phase is guarded by classifyPhase (which rejects corruption); see below.
function toCanonicalPhase(raw) {
  if (raw == null || String(raw).trim() === '') return null;
  const n = Number(String(raw).trim());
  return n === 1 || n === 2 || n === 3 ? n : null;
}

// Effective phase for a grid node. Phase is DERIVED, not entered: a real intake store leaves
// project.phase near-always-null and expresses order through dependency edges. So resolve the
// same way the rest of masterGrid does — dependency-derived first (deriveEffectiveProjectPhases
// already folds derived → raw → initiative for CONFIRMED projects) — then the node's own
// canonical raw phase (covers non-CONFIRMED projects and the reference fixture), then owning
// initiative, then a promoted deliverable inheriting its producing project's phase. No signal
// anywhere → null → residual (a legitimate unknown, surfaced as a question).
function resolveNodePhase(node, canonicalRaw, derivedEffective, projects, initiatives) {
  // DISPLAY raw-first (2026-07-16 ruling, scope (a) display-only): the node's own hand-attested
  // phase outranks its dependency-derived phase when they disagree — the operator attests, the
  // system proposes. This override lives ONLY here; the shared deriveEffectiveProjectPhases stays
  // derived-first so causalChain scheduling still honors hard dependencies for execution order.
  if (canonicalRaw != null) return canonicalRaw;
  // Raw absent → fall to the shared resolver (dependency-derived, else initiative). It returns a
  // NUMBER from the dependency tier but the RAW STRING ("1") from its raw/initiative tiers —
  // normalize, since sortByPhase groups on numeric 1/2/3 and phases.get("1") would bucket residual.
  const derived = toCanonicalPhase(derivedEffective[node.id]);
  if (derived != null) return derived;
  const initCanon = toCanonicalPhase(initiatives[node.owningInitiativeId]?.phase);
  if (initCanon != null) return initCanon;
  const pid = node.producingProjectId;
  if (pid) {
    const parentDerived = toCanonicalPhase(derivedEffective[pid]);
    if (parentDerived != null) return parentDerived;
    const parentCanon = toCanonicalPhase(projects[pid]?.phase);
    if (parentCanon != null) return parentCanon;
  }
  return null;
}

// A grid node claims a phase outside the canonical set {1,2,3}. This is corruption,
// not a missing assignment — it is rejected loudly at the ingest boundary rather than
// laundered into the residual bucket, so canonical-matrix integrity holds.
export class NonCanonicalPhaseError extends Error {
  constructor(nodeName, rawPhase) {
    super(
      `Matrix node "${nodeName}" declares a non-canonical phase ${JSON.stringify(rawPhase)} ` +
        `(allowed: 1, 2, 3). This is data corruption, not a missing assignment — rejected at ` +
        `ingest rather than laundered into the residual bucket.`,
    );
    this.name = 'NonCanonicalPhaseError';
    this.code = 'NON_CANONICAL_PHASE';
    this.nodeName = nodeName;
    this.rawPhase = rawPhase;
  }
}

// Classify a RAW phase value BEFORE any numeric coercion — the coercion (Number()) is
// exactly what destroys the absent-vs-corrupt distinction, collapsing both to 0/NaN.
//   absent (null/undefined/blank)  → null sentinel  (legitimate unknown → residual bucket)
//   present & canonical (1|2|3)     → the number     (placed in its phase group)
//   present & non-canonical         → throw          (corruption, rejected at the boundary)
export function classifyPhase(raw, nodeName) {
  if (raw == null || String(raw).trim() === '') return null;
  const n = Number(String(raw).trim());
  if (n === 1 || n === 2 || n === 3) return n;
  throw new NonCanonicalPhaseError(nodeName, raw);
}

// Full adapter: store.matrix -> { gridTitles, matrix } for sortByPhase(gridTitles, matrix).
// - rows: the execution-tier grid nodes, with verbatim fixture titles.
// - links: matrixLinksById tier-bridged to grid rows; relational kinds made mutual
//   so the sorter's mutual-tie detection fires.
// - milestones: milestonesById with lanes tier-bridged from deliverable ids to grid-row titles.
export function phaseGridFromStore(matrix = {}) {
  const artifacts = matrix.artifactsById || {};
  const projects = matrix.projectsById || {};
  const initiatives = matrix.initiativesById || {};
  const gridNodes = selectGridNodes(matrix);
  const gridIds = new Set(gridNodes.map((n) => n.id));

  // Dependency-derived effective phase per CONFIRMED project (derived → raw → initiative).
  const derivedEffective = deriveEffectiveProjectPhases(matrix);

  // any node id -> its grid-row id (itself if a grid row; else its parent project if that's a grid row)
  const toGridRowId = (id) => {
    if (gridIds.has(id)) return id;
    const d = artifacts[id];
    if (d && d.producingProjectId && gridIds.has(d.producingProjectId)) return d.producingProjectId;
    return null;
  };

  const rowById = {};
  for (const n of gridNodes) {
    // Reject corruption FIRST: a present-but-non-canonical raw phase throws here, before any
    // resolution can launder it. classifyPhase returns the canonical number, or null (absent).
    const canonicalRaw = classifyPhase(n.phase, n.name);
    const phase = resolveNodePhase(n, canonicalRaw, derivedEffective, projects, initiatives);
    rowById[n.id] = { title: n.name, phase, target: n.targetDate ?? 'TBD', targetNote: null, links: [] };
  }

  for (const l of Object.values(matrix.matrixLinksById || {})) {
    const a = toGridRowId(l.fromId);
    const b = toGridRowId(l.toId);
    if (!a || !b || a === b) continue;
    rowById[a].links.push({ kind: l.kind, to: rowById[b].title });
    if (RELATIONAL_KINDS.has(l.kind)) rowById[b].links.push({ kind: l.kind, to: rowById[a].title });
  }

  const milestones = Object.values(matrix.milestonesById || {}).map((ms) => ({
    name: ms.name,
    date: ms.date,
    lanes: (ms.laneIds || []).map(toGridRowId).filter(Boolean).map((id) => rowById[id]?.title).filter(Boolean),
  }));

  return { gridTitles: gridNodes.map((n) => n.name), matrix: { rows: Object.values(rowById), milestones, aliases: {} } };
}
