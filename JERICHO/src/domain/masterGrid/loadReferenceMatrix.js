import { buildBlankIdentityState } from '../../state/identityStore.js';
import { computeDerivedState } from '../../state/identityCompute.js';

export function slugId(name) {
  return String(name).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

const CLASS_SEQUENCE = ['Entity', 'Initiative', 'Project', 'Deliverable', 'System'];
const VERIFICATION_SOURCE_ID = 'vs-reference';

// Some reference-matrix rows carry an abbreviated owner/produced_by string
// (e.g. "Global State Corp.") that names the same entity declared under its
// full name ("Global State Corporation"). This is a deterministic, exact
// alias — NOT fuzzy matching. Prefix matching is unsafe here because all 7
// entities share the "Global State" prefix. Resolution applies the alias,
// then requires an EXACT match against a declared entity; anything else
// (including sentinels like "Cross-cutting") resolves to null. No node's own
// `name` field is ever rewritten.
const ENTITY_ALIASES = { 'Global State Corp.': 'Global State Corporation' };

/**
 * Loads the reference-matrix fixture through the real DECLARE_* reducer
 * actions (computeDerivedState), resolving by-name parent/owner references
 * to ids via a name->id pass built before any node is declared. Declares in
 * class order (Entity -> Initiative -> Project -> Deliverable -> System) so
 * referenced ids already exist by the time they're referenced. Never
 * rewrites a fixture node's `name`.
 */
export function loadReferenceMatrix(fixture, { nowISO = new Date().toISOString() } = {}) {
  const nodes = fixture.nodes || [];

  // Full name -> id map (all classes) for parent_initiative / parent_project
  // references, which appear in the fixture with exact names.
  const idByName = new Map();
  for (const n of nodes) idByName.set(n.name, slugId(n.name));
  const resolve = (nm) => (nm && idByName.has(nm) ? idByName.get(nm) : null);

  let state = buildBlankIdentityState({ nowISO });
  state.appTime = { ...(state.appTime || {}), nowISO };
  const dispatch = (action) => {
    state = computeDerivedState(state, action);
  };

  // Owner / produced_by resolution: apply the exact alias, then require an
  // EXACT match against an already-declared entity. Nothing fuzzy — a name
  // that is not an alias and not a declared entity (e.g. "Cross-cutting")
  // resolves to null. Entities are declared before any referencing class, so
  // state.matrix.entitiesById is populated by the time this runs for owners.
  const resolveEntity = (nm) => {
    if (!nm) return null;
    const canonical = ENTITY_ALIASES[nm] || nm;
    const id = idByName.get(canonical);
    return id && state.matrix?.entitiesById?.[id] ? id : null;
  };

  // Single shared verification source so Project/Deliverable required refs resolve.
  dispatch({
    type: 'DECLARE_VERIFICATION_SOURCE',
    payload: { id: VERIFICATION_SOURCE_ID, domain: 'reference', source: 'operator_attestation' },
  });

  for (const cls of CLASS_SEQUENCE) {
    for (const n of nodes.filter((x) => x.class === cls)) {
      const id = idByName.get(n.name);
      const common = {
        id,
        name: n.name,
        phase: n.phase ?? null,
        reviewStatus: n.status || 'DRAFT',
      };

      if (cls === 'Entity') {
        const roleTags = Array.isArray(n.role_tags) ? n.role_tags.filter(Boolean) : [];
        dispatch({
          type: 'DECLARE_ENTITY',
          payload: {
            ...common,
            roleTags: roleTags.length ? roleTags : ['entity'],
            purpose: n.purpose || 'reference',
            formationState: n.legal_status || 'formed',
            statusEvidence: n.notes || 'reference',
          },
        });
      } else if (cls === 'Initiative') {
        dispatch({
          type: 'DECLARE_INITIATIVE',
          payload: {
            ...common,
            owningEntityId: resolveEntity(n.owner),
            purpose: n.objective || 'reference',
            classification: 'objective',
            doneWhen: n.deadline || n.objective || 'reference',
            roleTags: Array.isArray(n.role_tags) ? n.role_tags.filter(Boolean) : [],
          },
        });
      } else if (cls === 'Project') {
        dispatch({
          type: 'DECLARE_PROJECT',
          payload: {
            ...common,
            owningEntityId: resolveEntity(n.owner),
            owningInitiativeId: resolve(n.parent_initiative),
            successMetric: n.deliverable_summary || 'reference',
            verificationSourceId: VERIFICATION_SOURCE_ID,
            targetDate: n.target_date || null,
          },
        });
      } else if (cls === 'Deliverable') {
        dispatch({
          type: 'DECLARE_ARTIFACT',
          payload: {
            ...common,
            producingProjectId: resolve(n.parent_project),
            producedByEntityId: resolveEntity(n.produced_by),
            completionEvidence: n.what_ships || 'reference',
            verificationSourceId: VERIFICATION_SOURCE_ID,
            operatorAttestationMethod: 'operator',
            targetDate: n.target_date || null,
          },
        });
      } else if (cls === 'System') {
        dispatch({
          type: 'DECLARE_SYSTEM',
          payload: {
            ...common,
            owningEntityId: resolveEntity(n.owner),
            cycle: n.mechanism || 'ongoing',
            activationState: 'planned',
          },
        });
      }
    }
  }

  // Attested edges: typed relational links → matrixLinksById; the named
  // convergence → milestonesById. from/to reference node names (resolved to ids).
  // Edges whose endpoints are descriptive strings (e.g. "software system",
  // "2026-11 provisional expiry") don't resolve to declared nodes and are skipped.
  const edges = fixture.canonical_edges || [];
  let linkSeq = 0;
  let msSeq = 0;
  for (const e of edges) {
    const from = e.from ?? e.source;
    const to = e.to ?? e.target;
    if (e.type === 'converges') {
      // "from" is the milestone name; "to" is a semicolon list of lane node names.
      const laneNames = String(to || '').split(';').map((s) => s.trim()).filter(Boolean);
      const laneIds = laneNames.map(resolve).filter(Boolean);
      // Derive the milestone date from the latest lane target_date (the anchor).
      const laneDates = laneNames
        .map((nm) => (nodes.find((n) => n.name === nm) || {}).target_date)
        .filter((d) => d && /^\d{4}-\d{2}-\d{2}$/.test(d))
        .sort();
      const date = laneDates.length ? laneDates[laneDates.length - 1] : null;
      if (laneIds.length) {
        dispatch({ type: 'DECLARE_MILESTONE', payload: { id: `ms-${++msSeq}`, name: String(from || '').trim(), date, laneIds } });
      }
    } else {
      const fromId = resolve(from);
      const toId = resolve(to);
      if (fromId && toId) {
        dispatch({ type: 'DECLARE_MATRIX_LINK', payload: { id: `link-${++linkSeq}`, kind: e.type, fromId, toId } });
      }
    }
  }

  return state;
}
