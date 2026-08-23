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
import { classifyPhase, NonCanonicalPhaseError, toCanonicalPhase } from './phaseClassification.js';
// Re-exported for backward compatibility — the phase validators now live in phaseClassification.js,
// the single source of truth shared with the elicitation §5 phase gate (no second validator).
export { classifyPhase, NonCanonicalPhaseError };

// Relational link kinds render as convergence ties (mutual); directional kinds do not.
const RELATIONAL_KINDS = new Set(['ships_with', 'soundtrack_of', 'promotes', 'feeds', 'loop']);

// Effective phase for a grid node. Phase is DERIVED, not entered: a real intake store leaves
// project.phase near-always-null and expresses order through dependency edges. So resolve the
// same way the rest of masterGrid does — dependency-derived first (deriveEffectiveProjectPhases
// already folds derived → raw for CONFIRMED projects) — then the node's own canonical raw phase
// (covers non-CONFIRMED projects and the reference fixture), then a promoted deliverable
// inheriting its producing project's phase. No signal anywhere → null → residual (a legitimate
// unknown, surfaced as a question).
//
// The owning-Initiative rung was removed 2026-08-23 (E16): an Initiative has no Phase, so it can
// never supply one to a Project. Note the direction this ran — Project fell back to Initiative —
// which is why deriving Initiative phase FROM Projects (E16 Option B) risked a cycle. With both
// the rung and the option gone, that risk is moot rather than merely unmeasured. Any future
// Initiative-level Phase display must be a read-time rollup over owned Projects, computed here
// or above, never a stored value read back out of the node.
function resolveNodePhase(node, canonicalRaw, derivedEffective, projects) {
  // DISPLAY raw-first (2026-07-16 ruling, scope (a) display-only): the node's own hand-attested
  // phase outranks its dependency-derived phase when they disagree — the operator attests, the
  // system proposes. This override lives ONLY here; the shared deriveEffectiveProjectPhases stays
  // derived-first so causalChain scheduling still honors hard dependencies for execution order.
  if (canonicalRaw != null) return canonicalRaw;
  // Raw absent → fall to the shared resolver (dependency-derived, else the project's own raw).
  // It returns a NUMBER from the dependency tier but the RAW STRING ("1") from its raw tier —
  // normalize, since sortByPhase groups on numeric 1/2/3 and phases.get("1") would bucket residual.
  const derived = toCanonicalPhase(derivedEffective[node.id]);
  if (derived != null) return derived;
  const pid = node.producingProjectId;
  if (pid) {
    const parentDerived = toCanonicalPhase(derivedEffective[pid]);
    if (parentDerived != null) return parentDerived;
    const parentCanon = toCanonicalPhase(projects[pid]?.phase);
    if (parentCanon != null) return parentCanon;
  }
  return null;
}

// Full adapter: store.matrix -> { gridTitles, matrix } for sortByPhase(gridTitles, matrix).
// - rows: the execution-tier grid nodes, with verbatim fixture titles.
// - links: matrixLinksById tier-bridged to grid rows; relational kinds made mutual
//   so the sorter's mutual-tie detection fires.
// - milestones: milestonesById with lanes tier-bridged from deliverable ids to grid-row titles.
export function phaseGridFromStore(matrix = {}) {
  const artifacts = matrix.artifactsById || {};
  const projects = matrix.projectsById || {};
  const gridNodes = selectGridNodes(matrix);
  const gridIds = new Set(gridNodes.map((n) => n.id));

  // Dependency-derived effective phase per CONFIRMED project (derived → raw).
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
    // Validate raw phase via classifyPhase. If corrupted, treat as absent (null) so the grid
    // still renders and the advisory panel can flag it. This keeps the grid robust against
    // data integrity issues while surfacing them via recommendations.
    let canonicalRaw = null;
    if (n.phase != null) {
      try {
        canonicalRaw = classifyPhase(n.phase, n.name);
      } catch (err) {
        if (err instanceof NonCanonicalPhaseError) {
          canonicalRaw = null; // treat corrupted phase as absent, grid renders
        } else {
          throw err; // re-throw unexpected errors
        }
      }
    }
    const phase = resolveNodePhase(n, canonicalRaw, derivedEffective, projects);
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
