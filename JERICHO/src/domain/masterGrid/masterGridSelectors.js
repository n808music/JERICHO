// Capacity is NOT a matrix class (operator ruling). matrix.capacityById is a
// separate store namespace (constraints/computed availability), never a grid row.
// Deliverable and Artifact are two distinct, visible classes — never collapsed.
export const CLASS_ORDER = ['Entity', 'Initiative', 'Project', 'Deliverable', 'Artifact', 'System'];

const SLICES = [
  ['entitiesById', 'Entity'],
  ['initiativesById', 'Initiative'],
  ['projectsById', 'Project'],
  ['deliverablesById', 'Deliverable'],
  ['artifactsById', 'Artifact'],
  ['systemsById', 'System'],
];

const nameOf = (map, id) => (id && map[id] ? map[id].name : null);

function ownerParentLabel(matrix, primaryClass, node) {
  const entities = matrix.entitiesById || {};
  const initiatives = matrix.initiativesById || {};
  const projects = matrix.projectsById || {};
  if (primaryClass === 'Entity') {return '—';}
  if (primaryClass === 'Initiative') {return nameOf(entities, node.owningEntityId) || '—';}
  if (primaryClass === 'System') {return nameOf(entities, node.owningEntityId) || '—';}
  if (primaryClass === 'Project') {
    const owner = nameOf(entities, node.owningEntityId) || '—';
    const parent = nameOf(initiatives, node.owningInitiativeId) || '—';
    return `${owner} / ${parent}`;
  }
  // Deliverable: show owning initiative and project
  if (primaryClass === 'Deliverable') {
    const initiative = nameOf(initiatives, node.owningInitiativeId) || '—';
    const project = nameOf(projects, node.owningProjectId) || '—';
    return `${initiative} / ${project}`;
  }
  // Artifact: show producing project (and entity if present)
  const producer = node.producedByEntityId ? nameOf(entities, node.producedByEntityId) : null;
  const project = nameOf(projects, node.producingProjectId) || '—';
  return producer ? `${producer} / ${project}` : project;
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
    if (c !== 0) {return c;}
    const pa = a.phase, pb = b.phase;
    if (pa !== pb) {
      if (pa == null) {return 1;}
      if (pb == null) {return -1;}
      const na = Number(pa), nb = Number(pb);
      if (Number.isFinite(na) && Number.isFinite(nb) && na !== nb) {return na - nb;}
      return String(pa).localeCompare(String(pb));
    }
    return String(a.name).localeCompare(String(b.name));
  });
  return rows;
}

export function countByClass(rows) {
  const out = { total: rows.length, Entity: 0, Initiative: 0, Project: 0, Deliverable: 0, Artifact: 0, System: 0 };
  for (const r of rows) {out[r.primaryClass] = (out[r.primaryClass] || 0) + 1;}
  return out;
}
