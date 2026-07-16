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

// A source answer may be a single id (legacy) or an array (multi-source —
// several parts of the operation feeding one destination, 2026-07-10).
function normalizeSourceIds(value: unknown): string[] {
  const arr = Array.isArray(value) ? value : value ? [value] : [];
  return arr.map((v) => String(v).trim()).filter(Boolean);
}

export const CONVERGENCE_SLOT = {
  slotId: CONVERGENCE_SLOT_ID,
  section: 8,
  // Destination-first (2026-07-10): a convergence has no name of its own, so
  // asking for the sources first produced a subject-less question ("where
  // does THIS flow start?" — this what?). The destination is captured first
  // and becomes the subject every later question binds to ("What feeds
  // Marketing flywheel?").
  gate: [
    {
      code: 'CONVERGENCE_TO_MISSING',
      fieldName: 'toNodeId',
      detect: (captured: unknown) => {
        const c = captured as Record<string, unknown>;
        return !c?.toNodeId;
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
      code: 'CONVERGENCE_FROM_MISSING',
      fieldName: 'fromNodeId',
      detect: (captured: unknown) => {
        const c = captured as Record<string, unknown>;
        return normalizeSourceIds(c?.fromNodeId).length === 0;
      },
    },
    {
      code: 'CONVERGENCE_FROM_UNRESOLVED',
      fieldName: 'fromNodeId',
      // ctx.matrixSnapshot must be injected — resolves against ALL declared-node registries.
      detect: (captured: unknown, ctx?: unknown) => {
        const c = captured as Record<string, unknown>;
        const sources = normalizeSourceIds(c?.fromNodeId);
        if (sources.length === 0) return false;
        const snap = (ctx as Record<string, unknown>)?.matrixSnapshot;
        const declared = declaredAllNodeIds(snap);
        return sources.some((id) => !declared.has(id));
      },
    },
    {
      code: 'CONVERGENCE_SELF_EDGE',
      // Destination is captured first, so the self-edge is detected on the
      // SOURCES answer: the destination cannot be one of its own feeders.
      fieldName: 'fromNodeId',
      detect: (captured: unknown) => {
        const c = captured as Record<string, unknown>;
        if (!c?.toNodeId) return false;
        return normalizeSourceIds(c?.fromNodeId).includes(String(c.toNodeId));
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
  const fromNodeIds = normalizeSourceIds(c?.fromNodeId);
  const fromNodeId = fromNodeIds[0] || '';
  const toNodeId = String(c?.toNodeId || '').trim();
  const id = `conv-${fromNodeId}-to-${toNodeId}`.slice(0, 80);
  return {
    id,
    // Legacy scalar (first source) kept for downstream consumers; the full
    // multi-source list rides alongside.
    fromNodeId,
    fromNodeIds,
    toNodeId,
    gives: String(c?.gives || '').trim(),
    broken: Boolean(c?.broken) || false,
    label: String(c?.label || '').trim() || null,
  };
}
