import { buildBlankIdentityState } from '../../state/identityStore.js';
import { computeDerivedState } from '../../state/identityCompute.js';

export function slugId(name) {
  return String(name).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

const CLASS_SEQUENCE = ['Entity', 'Initiative', 'Project', 'Deliverable', 'System'];
const VERIFICATION_SOURCE_ID = 'vs-reference';

// Some reference-matrix rows carry an abbreviated owner/produced_by string
// (e.g. "Global State Corp.") rather than the declared entity's full name
// ("Global State Corporation"). Resolution must not rewrite any node's own
// `name` field — it only widens how an owner/produced_by reference finds
// the entity id it means. Exact match is tried first; a case-insensitive
// prefix match is the fallback for abbreviated references.
function resolveEntityId(rawName, entityNameToId) {
  if (!rawName) return null;
  const name = String(rawName).trim();
  if (!name) return null;
  if (entityNameToId.has(name)) return entityNameToId.get(name);
  const norm = name.replace(/\.+$/, '').toLowerCase();
  if (!norm) return null;
  for (const [entName, id] of entityNameToId) {
    if (entName.toLowerCase().startsWith(norm)) return id;
  }
  return null;
}

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

  // Entity-only name -> id map for owner / produced_by references, which
  // resolveEntityId matches exactly or via abbreviation prefix.
  const entityNameToId = new Map();
  for (const n of nodes) {
    if (n.class === 'Entity') entityNameToId.set(n.name, slugId(n.name));
  }
  const resolveEntity = (nm) => resolveEntityId(nm, entityNameToId);

  let state = buildBlankIdentityState({ nowISO });
  state.appTime = { ...(state.appTime || {}), nowISO };
  const dispatch = (action) => {
    state = computeDerivedState(state, action);
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

  return state;
}
