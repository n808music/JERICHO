import { hasAuthoredSubstance } from '../planQuality/hasAuthoredSubstance';

export const CONVERGENCE_SLOT_ID = 'slot:convergence';

// All declared-node registries: convergence endpoints can be any node type.
function declaredAllNodeIds(matrixSnapshot: unknown): Set<string> {
  const snap = matrixSnapshot as Record<string, unknown> | undefined;
  const ids = new Set<string>();
  for (const reg of ['entitiesById', 'initiativesById', 'systemsById', 'projectsById', 'artifactsById']) {
    for (const id of Object.keys((snap?.[reg] as Record<string, unknown>) || {})) {
      ids.add(id);
    }
  }
  return ids;
}

export const CONVERGENCE_SLOT = {
  slotId: CONVERGENCE_SLOT_ID,
  section: 8,
  gate: [
    {
      code: 'CONVERGENCE_FROM_MISSING',
      fieldName: 'fromNodeId',
      detect: (captured: unknown) => {
        const c = captured as Record<string, unknown>;
        return !c?.fromNodeId;
      },
    },
    {
      code: 'CONVERGENCE_FROM_UNRESOLVED',
      fieldName: 'fromNodeId',
      // ctx.matrixSnapshot must be injected — resolves against ALL declared-node registries.
      detect: (captured: unknown, ctx?: unknown) => {
        const c = captured as Record<string, unknown>;
        if (!c?.fromNodeId) return false;
        const snap = (ctx as Record<string, unknown>)?.matrixSnapshot;
        return !declaredAllNodeIds(snap).has(String(c.fromNodeId));
      },
    },
    {
      code: 'CONVERGENCE_TO_MISSING',
      fieldName: 'toNodeId',
      detect: (captured: unknown) => {
        const c = captured as Record<string, unknown>;
        return !c?.toNodeId;
      },
    },
    {
      code: 'CONVERGENCE_SELF_EDGE',
      fieldName: 'toNodeId',
      detect: (captured: unknown) => {
        const c = captured as Record<string, unknown>;
        return Boolean(c?.fromNodeId) && c.fromNodeId === c.toNodeId;
      },
    },
    {
      code: 'CONVERGENCE_TO_UNRESOLVED',
      fieldName: 'toNodeId',
      detect: (captured: unknown, ctx?: unknown) => {
        const c = captured as Record<string, unknown>;
        if (!c?.toNodeId) return false;
        const snap = (ctx as Record<string, unknown>)?.matrixSnapshot;
        return !declaredAllNodeIds(snap).has(String(c.toNodeId));
      },
    },
    {
      code: 'CONVERGENCE_GIVES_MISSING',
      fieldName: 'gives',
      detect: (captured: unknown) => {
        const c = captured as Record<string, unknown>;
        return !c?.gives || String(c.gives).trim() === '';
      },
    },
    {
      code: 'CONVERGENCE_GIVES_NOT_SUBSTANTIVE',
      fieldName: 'gives',
      detect: (captured: unknown) => {
        const c = captured as Record<string, unknown>;
        if (!c?.gives) return false;
        return !hasAuthoredSubstance(String(c.gives));
      },
    },
  ],
};

export function buildConvergenceDeclarePayload(captured: unknown) {
  const c = captured as Record<string, unknown>;
  const fromNodeId = String(c?.fromNodeId || '').trim();
  const toNodeId = String(c?.toNodeId || '').trim();
  const id = `conv-${fromNodeId}-to-${toNodeId}`.slice(0, 80);
  return {
    id,
    fromNodeId,
    toNodeId,
    gives: String(c?.gives || '').trim(),
    broken: Boolean(c?.broken) || false,
    label: String(c?.label || '').trim() || null,
  };
}
