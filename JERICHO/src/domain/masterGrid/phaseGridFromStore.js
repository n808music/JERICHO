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

// Relational link kinds render as convergence ties (mutual); directional kinds do not.
const RELATIONAL_KINDS = new Set(['ships_with', 'soundtrack_of', 'promotes', 'feeds', 'loop']);

// Full adapter: store.matrix -> { gridTitles, matrix } for sortByPhase(gridTitles, matrix).
// - rows: the execution-tier grid nodes, with verbatim fixture titles.
// - links: matrixLinksById tier-bridged to grid rows; relational kinds made mutual
//   so the sorter's mutual-tie detection fires.
// - milestones: milestonesById with lanes tier-bridged from deliverable ids to grid-row titles.
export function phaseGridFromStore(matrix = {}) {
  const artifacts = matrix.artifactsById || {};
  const gridNodes = selectGridNodes(matrix);
  const gridIds = new Set(gridNodes.map((n) => n.id));

  // any node id -> its grid-row id (itself if a grid row; else its parent project if that's a grid row)
  const toGridRowId = (id) => {
    if (gridIds.has(id)) return id;
    const d = artifacts[id];
    if (d && d.producingProjectId && gridIds.has(d.producingProjectId)) return d.producingProjectId;
    return null;
  };

  const rowById = {};
  for (const n of gridNodes) {
    // store carries phase as a string ("1"); sortByPhase groups on numeric 1/2/3.
    rowById[n.id] = { title: n.name, phase: Number(n.phase), target: n.targetDate ?? 'TBD', targetNote: null, links: [] };
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
