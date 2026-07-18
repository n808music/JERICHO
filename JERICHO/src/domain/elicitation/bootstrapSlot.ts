// Section 10 (Bootstrap) — the PAYOFF section. It INVERTS the elicitation
// pattern: every prior section asked "what is true?" and gated the answer.
// Bootstrap READS the completed graph and COMPUTES an answer the operator never
// directly input — "given your dependency graph, here are the artifacts nothing
// is blocking; ordered by what binds you; pick one to begin."
//
// The operator's decision is the NARROWEST in the entire matrix: select one
// node from a computed, ordered set of startable candidates. Nine sections of
// elicitation collapse into a single, well-founded choice. The system did the
// graph analysis; the human makes one maximally-informed decision.
//
// Three rulings encoded:
//   1. Only 'hard_gate' dependency edges block candidacy. directional /
//      informational edges inform but do not block.
//   2. Broken convergence edges do NOT disqualify — they're value-flow gaps,
//      not hard blocks; disqualifying them would prevent bootstrapping onto the
//      very work that closes them. (Future enhancement, not a rule now: a
//      candidate that CLOSES a broken convergence is high-leverage.)
//   3. The binding constraint ORDERS but never EXCLUDES. Validity is structural
//      (hard_gate DAG root); the binding dimension only sorts the valid set,
//      degrading to "unknown" (never excluding) when the resource chain breaks.

export const BOOTSTRAP_SLOT_ID = 'slot:bootstrap';

// Resolve the binding-dimension gap for an artifact by walking:
//   artifact -> producingProjectId -> project.owningInitiativeId
//   -> resourceProfile(initiativeId) -> dimensions[bindingDim].gap
// Returns 'no-gap' (gap === null, tier 0), 'gap' (substantive, tier 2), or
// 'unknown' (chain incomplete, tier 1). NEVER excludes — worst case is 'unknown'.
export function bindingGapForArtifact(artifactId, matrix, bindingDim) {
  if (!bindingDim) return 'unknown';
  const art = matrix?.artifactsById?.[artifactId];
  if (!art?.producingProjectId) return 'unknown';
  const proj = matrix?.projectsById?.[art.producingProjectId];
  const initiativeId = proj?.owningInitiativeId;
  if (!initiativeId) return 'unknown';
  const profile = Object.values(matrix?.resourceProfilesById || {}).find(
    (p) => p?.initiativeId === initiativeId,
  );
  if (!profile) return 'unknown';
  // Profile shape: { dimensions: { money: { need, gap }, time: { need, gap }, ... } }
  const gap = profile?.dimensions?.[bindingDim]?.gap;
  if (gap === null) return 'no-gap'; // assessed, no gap on the binding dimension
  if (gap) return 'gap'; // assessed gap = harder on the binding dimension
  return 'unknown';
}

const TIER = { 'no-gap': 0, unknown: 1, gap: 2 };

// Compute the ordered candidate set. Validity = artifact is NOT the downstream
// of any hard_gate edge (a hard_gate DAG root). Ordering = binding-dimension
// tier (no-gap first). Because Section 7 guarantees the dependency graph is a
// DAG, a non-empty artifact set always yields >= 1 root — candidates is never
// empty when artifacts exist.
export function computeBootstrapCandidates(matrix) {
  const artifactIds = Object.keys(matrix?.artifactsById || {});
  const hardBlocked = new Set(
    Object.values(matrix?.dependenciesById || {})
      .filter((e) => e?.type === 'hard_gate')
      .map((e) => e?.downstreamId),
  );
  // NOTE: field is bindingDimension (not dimension) — confirmed against
  // declareBindingConstraint reducer which stores { bindingDimension, rationale }.
  const bindingDim = matrix?.bindingConstraint?.bindingDimension || null;

  const roots = artifactIds.filter((id) => !hardBlocked.has(id));
  const ranked = roots.map((id) => {
    const status = bindingGapForArtifact(id, matrix, bindingDim);
    return { artifactId: id, tier: TIER[status], bindingStatus: status };
  });
  // Stable sort by tier ascending (no-gap first, gap last, unknown middle).
  ranked.sort((a, b) => a.tier - b.tier);
  return ranked;
}

// The bootstrap "gate ladder" is a SELECTION validator, not an authored-field
// validator. The candidate set is computed (pickSet); the operator selects one.
export const BOOTSTRAP_SLOT = {
  slotId: BOOTSTRAP_SLOT_ID,
  section: 10,
  matrixBinding: {
    action: 'DECLARE_BOOTSTRAP',
    fields: ['selectedNodeId'],
  },
  // Reads the whole graph; sequenced last. Depends on artifacts (candidates)
  // and resources/binding (ordering).
  dependsOn: ['slot:artifact', 'slot:bindingConstraint'],
  gate: [
    {
      code: 'BOOTSTRAP_SELECTION_MISSING',
      fieldName: 'selectedNodeId',
      detect: (captured) => !captured?.selectedNodeId,
      pickSet: 'bootstrapCandidateOptions', // = computeBootstrapCandidates
    },
    {
      // Backstop: the pickSet only offers valid candidates, but if selectedNodeId
      // arrives by any other path, reject a selection that isn't a computed
      // candidate (i.e. the operator can't start on a hard-gated node).
      code: 'BOOTSTRAP_SELECTION_NOT_CANDIDATE',
      fieldName: 'selectedNodeId',
      detect: (captured, ctx) => {
        if (!captured?.selectedNodeId) return false;
        const candidates = computeBootstrapCandidates(ctx?.matrixSnapshot || {});
        return !candidates.some((c) => c.artifactId === captured.selectedNodeId);
      },
    },
  ],
};

export function fieldNameForCode(code) {
  const found = BOOTSTRAP_SLOT.gate.find((g) => g.code === code);
  return found?.fieldName || null;
}

export function buildBootstrapDeclarePayload(captured, matrix) {
  return {
    candidates: computeBootstrapCandidates(matrix).map((c) => c.artifactId),
    selectedNodeId: captured.selectedNodeId,
  };
}
