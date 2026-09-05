import { buildBlankIdentityState } from '../../state/identityStore.js';
import { computeDerivedState } from '../../state/identityCompute.js';

export function slugId(name) {
  return String(name).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

/**
 * Construct a node ID with class-specific prefix.
 * @param {string} nodeClass - one of 'Entity', 'Initiative', 'Project', 'Deliverable', 'Artifact', 'System'
 * @param {string} name - human-readable node name
 * @returns {string} prefixed ID (e.g. 'deliverable-my-node' for Deliverable)
 */
export function nodeId(nodeClass, name) {
  const slug = slugId(name);
  switch (nodeClass) {
    case 'Entity': return `entity-${slug}`;
    case 'Initiative': return `initiative-${slug}`;
    case 'Project': return `project-${slug}`;
    case 'Deliverable': return `deliverable-${slug}`;
    case 'System': return `system-${slug}`;
    case 'Artifact': return slug; // Artifact uses bare slug
    default: return slug;
  }
}

// Declaration order. Artifact follows Deliverable because an Artifact's
// producingProjectId is resolved through its parent Deliverable, which must
// already be declared. Artifact was absent here until 2026-08-29, which silently
// skipped every Artifact-class node in the fixture (122 of 304 in v2.0).
const CLASS_SEQUENCE = ['Entity', 'Initiative', 'Project', 'Deliverable', 'Artifact', 'System'];
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

  // Apply class-specific prefix to node ids (aligns with builder schemes).
  // Builder schemes: entity-${slug}, initiative-${slug}, project-${slug}, deliverable-${slug},
  // system-${slug}; artifact uses bare slug (matches loader).
  const getNodeIdForClass = (slug, nodeClass) => {
    switch (nodeClass) {
      case 'Entity': return `entity-${slug}`;
      case 'Initiative': return `initiative-${slug}`;
      case 'Project': return `project-${slug}`;
      case 'Deliverable': return `deliverable-${slug}`;
      case 'System': return `system-${slug}`;
      case 'Artifact': return slug; // Artifact builder uses bare slug
      default: return slug;
    }
  };

  // Class-specific resolvers for parent references (knows the class from the context).
  // These avoid collision issues because the reference field name implies the class.
  const resolveInitiative = (nm) => {
    const baseId = resolve(nm);
    return baseId ? getNodeIdForClass(baseId, 'Initiative') : null;
  };
  const resolveProject = (nm) => {
    const baseId = resolve(nm);
    return baseId ? getNodeIdForClass(baseId, 'Project') : null;
  };
  const resolveDeliverable = (nm) => {
    const baseId = resolve(nm);
    return baseId ? getNodeIdForClass(baseId, 'Deliverable') : null;
  };
  const resolveSystem = (nm) => {
    const baseId = resolve(nm);
    return baseId ? getNodeIdForClass(baseId, 'System') : null;
  };

  // For edges/milestones where the class is unknown, look up the node to determine class.
  // Cache the results to avoid repeated searches.
  const nodesByName = new Map(nodes.map((n) => [n.name, n]));
  const resolveGeneric = (nm) => {
    const node = nodesByName.get(nm);
    if (!node) return null;
    const baseId = resolve(nm);
    return baseId ? getNodeIdForClass(baseId, node.class) : null;
  };

  // Owner / produced_by resolution: apply the exact alias, then require an
  // EXACT match against an already-declared entity. Nothing fuzzy — a name
  // that is not an alias and not a declared entity (e.g. "Cross-cutting")
  // resolves to null. Entities are declared before any referencing class, so
  // state.matrix.entitiesById is populated by the time this runs for owners.
  // Entity IDs use type-prefix scheme (entity-${slug}) to align with builder.
  const resolveEntity = (nm) => {
    if (!nm) return null;
    const canonical = ENTITY_ALIASES[nm] || nm;
    const baseId = idByName.get(canonical);
    if (!baseId) return null;
    const entityId = getNodeIdForClass(baseId, 'Entity');
    return state.matrix?.entitiesById?.[entityId] ? entityId : null;
  };

  // Single shared verification source so Project/Deliverable required refs resolve.
  dispatch({
    type: 'DECLARE_VERIFICATION_SOURCE',
    payload: { id: VERIFICATION_SOURCE_ID, domain: 'reference', source: 'operator_attestation' },
  });

  for (const cls of CLASS_SEQUENCE) {
    for (const n of nodes.filter((x) => x.class === cls)) {
      const id = getNodeIdForClass(slugId(n.name), n.class);
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
            doneWhen: n.deadline || n.objective || 'reference',
            roleTags: Array.isArray(n.role_tags) ? n.role_tags.filter(Boolean) : [],
            // Step 3: Initiative intake fields
            function: n.function || null,
            boundary_type: n.boundary_type || null,
            completion_value: n.completion_value || null,
            ongoing_output: n.ongoing_output || null,
          },
        });
      } else if (cls === 'Project') {
        dispatch({
          type: 'DECLARE_PROJECT',
          payload: {
            ...common,
            owningEntityId: resolveEntity(n.owner),
            owningInitiativeId: resolveInitiative(n.parent_initiative),
            description: n.deliverable_summary || 'reference',
            verificationSourceId: VERIFICATION_SOURCE_ID,
            targetDate: n.target_date || null,
            terminalDate: n.terminal_date || n.target_date || null,
            // Step 3: Project intake fields
            executing_entity: resolveEntity(n.executing_entity),
            parent_initiative: resolveInitiative(n.parent_initiative),
            boundary_type: n.boundary_type || null,
            terminal_date: n.terminal_date || null,
          },
        });
      } else if (cls === 'Deliverable') {
        // Was DECLARE_ARTIFACT until 2026-08-29: fixture Deliverables were filed
        // into artifactsById, leaving deliverablesById empty. masterGridSelectors
        // has always mapped the two slices to two distinct classes, so the loader
        // was the single point of divergence.
        //
        // owningInitiativeId is required by declareMatrixDeliverable and has no
        // fixture field of its own — a Deliverable inherits it from the Project
        // that owns it, which is already declared (Project precedes Deliverable in
        // CLASS_SEQUENCE). A Project with no resolved initiative yields null here,
        // and the reducer rejects that Deliverable rather than inventing a parent.
        const owningProjectId = resolveProject(n.parent_project);
        const owningInitiativeId = owningProjectId
          ? state.matrix?.projectsById?.[owningProjectId]?.owningInitiativeId || null
          : null;
        dispatch({
          type: 'DECLARE_DELIVERABLE',
          payload: {
            ...common,
            owningProjectId,
            owningInitiativeId,
            successCriteria: n.what_ships || null,
            targetDate: n.target_date || null,
          },
        });
      } else if (cls === 'Artifact') {
        // Step 1 (node-shape): Artifact now stores parentDeliverableIds (array) instead of
        // producingProjectId (scalar). The fixture models Artifact -> Deliverable
        // (parent_deliverable). E15 amendment will derive the producing project and phase
        // from the parent Deliverable. In v2.0 every Artifact has parent_deliverable: null,
        // so this resolves to an empty array and the reducer rejects all 122 — the correct,
        // visible outcome for absent linkage. See docs/superpowers/specs/2026-08-29-bug-a-live-migration-spec.md
        // (preconditions P4 and P7) for the fixture-authoring work that closes this.
        const parentDeliverableId = resolveDeliverable(n.parent_deliverable);
        dispatch({
          type: 'DECLARE_ARTIFACT',
          payload: {
            ...common,
            parentDeliverableIds: parentDeliverableId ? [parentDeliverableId] : [],
            producedByEntityId: resolveEntity(n.produced_by),
            completionEvidence: n.what_ships || 'reference',
            verificationSourceId: VERIFICATION_SOURCE_ID,
            operatorAttestationMethod: 'operator',
            targetDate: n.target_date || null,
            buffer_anchor: n.buffer_anchor || null,         // Step 3: optional parent deliverable for buffer computation
            buffer_binding: n.buffer_binding || null,       // Step 3: 'hard' | 'advisory'
            // Step 3: Artifact intake fields
            satisfaction_mode: n.satisfaction_mode || null,
          },
        });
      } else if (cls === 'System') {
        dispatch({
          type: 'DECLARE_SYSTEM',
          payload: {
            ...common,
            name: n.name || '',
            owner: n.owner || '', // 'Cross-cutting' or entity name
            mechanism: n.mechanism || '',
            feeds_converges_into: n.feeds_converges_into || '',
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
      const laneIds = laneNames.map(resolveGeneric).filter(Boolean);
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
      const fromId = resolveGeneric(from);
      const toId = resolveGeneric(to);
      if (fromId && toId) {
        dispatch({ type: 'DECLARE_MATRIX_LINK', payload: { id: `link-${++linkSeq}`, kind: e.type, fromId, toId } });
      }
    }
  }

  return state;
}
