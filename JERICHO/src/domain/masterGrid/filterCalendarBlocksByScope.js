// Gate 8 — isolate calendar blocks by matrix category. Pure, non-destructive: returns the
// subset of blocks in the chosen scope; the caller keeps the full list, so returning to
// 'full' restores the complete schedule intact. This only scopes WHICH blocks render — it
// never mutates blocks and never disables execution (ruling 3: blocks stay executable in
// filter mode; that is the caller's affordance, unaffected here).
//
// Display blocks carry entityId / initiativeId (== laneId) / sourceProjectId / deliverableId
// directly. Systems carry no block id: a system's involved blocks derive from its owning
// entity (ruling 1 — every block involved in that system; independent systems, distinct owners,
// yield distinct sets).

export const BLOCK_SCOPE_KINDS = ['Entity', 'Initiative', 'Project', 'Deliverable', 'System'];

// scope: 'full' | null  →  all blocks.  { kind, id }  →  that node's isolated blocks.
export function filterCalendarBlocksByScope(blocks = [], scope = 'full', matrix = {}) {
  if (!scope || scope === 'full') return blocks;
  const { kind, id } = scope;
  if (id == null) return blocks;
  switch (kind) {
    case 'Entity':
      return blocks.filter((b) => b.entityId === id);
    case 'Initiative':
      return blocks.filter((b) => b.initiativeId === id);
    case 'Project':
      return blocks.filter((b) => b.sourceProjectId === id);
    case 'Deliverable':
      return blocks.filter((b) => b.deliverableId === id);
    case 'System': {
      const ownerEntityId = (matrix.systemsById || {})[id]?.owningEntityId || null;
      return ownerEntityId ? blocks.filter((b) => b.entityId === ownerEntityId) : [];
    }
    default:
      return blocks;
  }
}

// Enumerate, per class, the specific nodes that actually have blocks — so the toggle only
// offers categories the operator can meaningfully isolate. Returns { Entity: [{id,label,count}],
// Initiative: [...], Project: [...], Deliverable: [...], System: [...] }.
export function availableBlockScopes(blocks = [], matrix = {}) {
  const entities = matrix.entitiesById || {};
  const initiatives = matrix.initiativesById || {};
  const projects = matrix.projectsById || {};
  const artifacts = matrix.artifactsById || {};
  const systems = matrix.systemsById || {};

  const tally = (idOf) => {
    const counts = new Map();
    for (const b of blocks) {
      const id = idOf(b);
      if (id == null) continue;
      counts.set(id, (counts.get(id) || 0) + 1);
    }
    return counts;
  };

  const optionize = (counts, labelMap) =>
    [...counts.entries()].map(([id, count]) => ({ id, count, label: labelMap[id]?.name || labelMap[id]?.label || id }));

  const entityCounts = tally((b) => b.entityId);

  return {
    Entity: optionize(entityCounts, entities),
    Initiative: optionize(tally((b) => b.initiativeId), initiatives),
    Project: optionize(tally((b) => b.sourceProjectId), projects),
    Deliverable: optionize(tally((b) => b.deliverableId), artifacts),
    // A system is offered only when its owning entity actually has blocks; count = that entity's blocks.
    System: Object.values(systems)
      .filter((s) => s.owningEntityId && entityCounts.has(s.owningEntityId))
      .map((s) => ({ id: s.id, count: entityCounts.get(s.owningEntityId), label: s.name || s.id })),
  };
}
