export const DEPENDENCY_SLOT_ID = 'slot:dependency';

export const DEPENDENCY_TYPES = ['hard_gate', 'directional', 'informational'] as const;
export type DependencyType = (typeof DEPENDENCY_TYPES)[number];

// BFS transitive reachability: starting from `from`, following REQUIRES edges
// (downstreamId → upstreamId), returns true if `to` is reachable.
//
// Cycle guard call: reaches(upstreamId, downstreamId, existingEdges).
// If upstreamId already transitively requires downstreamId, adding
// downstreamId REQUIRES upstreamId would close a cycle.
export function reaches(
  from: string,
  to: string,
  edges: Array<{ upstreamId: string; downstreamId: string }>
): boolean {
  const visited = new Set<string>();
  const queue: string[] = [from];
  while (queue.length > 0) {
    const current = queue.shift()!;
    if (current === to) return true;
    if (visited.has(current)) continue;
    visited.add(current);
    for (const edge of edges) {
      if (edge.downstreamId === current) {
        queue.push(edge.upstreamId);
      }
    }
  }
  return false;
}

function declaredNodeIds(matrixSnapshot: unknown): Set<string> {
  const snap = matrixSnapshot as Record<string, unknown> | undefined;
  return new Set(Object.keys((snap?.artifactsById as Record<string, unknown>) || {}));
}

export const DEPENDENCY_SLOT = {
  slotId: DEPENDENCY_SLOT_ID,
  section: 7,
  dependsOn: ['slot:artifact'], // declared, not enforced by engine
  gate: [
    {
      code: 'DEPENDENCY_DOWNSTREAM_MISSING',
      fieldName: 'downstreamId',
      detect: (captured: unknown) => {
        const c = captured as Record<string, unknown>;
        return !c?.downstreamId;
      },
    },
    {
      code: 'DEPENDENCY_DOWNSTREAM_UNRESOLVED',
      fieldName: 'downstreamId',
      detect: (captured: unknown, ctx?: unknown) => {
        const c = captured as Record<string, unknown>;
        if (!c?.downstreamId) return false;
        const snap = (ctx as Record<string, unknown>)?.matrixSnapshot;
        return !declaredNodeIds(snap).has(String(c.downstreamId));
      },
    },
    {
      code: 'DEPENDENCY_UPSTREAM_MISSING',
      fieldName: 'upstreamId',
      detect: (captured: unknown) => {
        const c = captured as Record<string, unknown>;
        return !c?.upstreamId;
      },
    },
    {
      code: 'DEPENDENCY_SELF_EDGE',
      fieldName: 'upstreamId',
      detect: (captured: unknown) => {
        const c = captured as Record<string, unknown>;
        return Boolean(c?.upstreamId) && c.upstreamId === c.downstreamId;
      },
    },
    {
      code: 'DEPENDENCY_UPSTREAM_UNRESOLVED',
      fieldName: 'upstreamId',
      detect: (captured: unknown, ctx?: unknown) => {
        const c = captured as Record<string, unknown>;
        if (!c?.upstreamId) return false;
        const snap = (ctx as Record<string, unknown>)?.matrixSnapshot;
        return !declaredNodeIds(snap).has(String(c.upstreamId));
      },
    },
    {
      code: 'DEPENDENCY_CYCLE',
      fieldName: 'upstreamId',
      // ctx.matrixSnapshot must be the current matrix — injected by the engine.
      // If the engine passes no ctx, existingEdges = [] and the guard never fires.
      // The engine MUST pass ctx = { matrixSnapshot } or cycles pass silently.
      detect: (captured: unknown, ctx?: unknown) => {
        const c = captured as Record<string, unknown>;
        if (!c?.upstreamId || !c?.downstreamId) return false;
        const snap = (ctx as Record<string, unknown>)?.matrixSnapshot as Record<string, unknown> | undefined;
        const existingEdges = Object.values(
          (snap?.dependenciesById as Record<string, unknown>) || {}
        ) as Array<{ upstreamId: string; downstreamId: string }>;
        return reaches(String(c.upstreamId), String(c.downstreamId), existingEdges);
      },
    },
    {
      code: 'DEPENDENCY_TYPE_MISSING',
      fieldName: 'type',
      detect: (captured: unknown) => {
        const c = captured as Record<string, unknown>;
        return !c?.type;
      },
    },
  ],
};

export function buildDependencyDeclarePayload(captured: unknown) {
  const c = captured as Record<string, unknown>;
  const downstreamId = String(c?.downstreamId || '').trim();
  const upstreamId = String(c?.upstreamId || '').trim();
  const id = `dep-${upstreamId}-to-${downstreamId}`.slice(0, 80);
  const satisfactionMode = String(c?.satisfactionMode || 'ALL').trim();
  return {
    id,
    downstreamId,
    upstreamId,
    type: String(c?.type || '').trim(),
    label: String(c?.label || '').trim() || null,
    satisfactionMode: (satisfactionMode === 'ANY_ONE' ? 'ANY_ONE' : 'ALL') as 'ALL' | 'ANY_ONE',
  };
}
