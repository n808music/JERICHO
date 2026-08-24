/**
 * matrixAggregation.js — Recursive hierarchy rollup for Matrix nodes
 *
 * Item 6: Matrix v2 aggregation layer. Two pure, read-time computed functions:
 *
 * 1. aggregatePhaseRollup() — Phase count rollup (Entity → Initiative → Project)
 * 2. aggregateUrgencyRollup() — Urgency computation with compounding floor
 *
 * Both are read-only, produce no side effects, and surface orphaned/unlinked
 * nodes as visible residuals per Section 2.1 ("never terminal, always traceable").
 *
 * Section 0 (scoping pass) findings embedded:
 * - Project.owningInitiativeId is optional/unvalidated; orphaned Projects must be surfaced
 * - Deliverable uses owningProjectId; Artifact uses producingProjectId; both must be handled
 *
 * Imported by consumers to compute aggregate views at read time. Never stored.
 */

import { computeProjectSpinePhase } from './projectSpinePhase.js';
import { toCanonicalPhase } from './phaseClassification.js';

/**
 * aggregatePhaseRollup(node, matrix): PhaseRollup
 *
 * Computes Phase distribution for a node and all its descendants.
 * Hierarchy: Entity → Initiative → Project → Deliverable/Artifact
 *
 * @param {Object} node — Entity or Initiative node
 * @param {Object} matrix — state.matrix (entitiesById, initiativesById, projectsById, deliverablesById, artifactsById)
 * @returns {Object} PhaseRollup { ownNode, leafCounts, leafRefs, displaySummary, orphanedProjects }
 */
export function aggregatePhaseRollup(node, matrix = {}) {
  if (!node || !matrix) {
    return {
      ownNode: node?.id || null,
      leafCounts: { P1: 0, P2: 0, P3: 0, null: 0 },
      leafRefs: { P1: [], P2: [], P3: [], null: [] },
      displaySummary: 'No data',
      orphanedProjects: [],
    };
  }

  const projects = matrix.projectsById || {};
  const deliverables = matrix.deliverablesById || {};
  const artifacts = matrix.artifactsById || {};
  const initiatives = matrix.initiativesById || {};
  const entities = matrix.entitiesById || {};

  const leafCounts = { P1: 0, P2: 0, P3: 0, null: 0 };
  const leafRefs = { P1: [], P2: [], P3: [], null: [] };
  const orphanedProjects = [];

  // Determine scope based on node type
  let projectsInScope = [];

  if (node.id && entities[node.id]) {
    // Entity node: collect all Projects owned by this Entity's Initiatives
    const entityId = node.id;
    const entityInitiatives = Object.values(initiatives).filter(
      (init) => init && (init.owningEntityId === entityId || (Array.isArray(init.owningEntityIds) && init.owningEntityIds.includes(entityId)))
    );
    for (const init of entityInitiatives) {
      if (!init) continue;
      projectsInScope.push(
        ...Object.values(projects).filter((proj) => proj && proj.owningInitiativeId === init.id)
      );
    }
    // Also collect Projects directly owned by Entity (no Initiative)
    projectsInScope.push(
      ...Object.values(projects).filter(
        (proj) => proj && proj.owningEntityId === entityId && !proj.owningInitiativeId
      )
    );
  } else if (node.id && initiatives[node.id]) {
    // Initiative node: collect all Projects owned by this Initiative
    projectsInScope = Object.values(projects).filter(
      (proj) => proj && proj.owningInitiativeId === node.id
    );
  }

  // Count leaf nodes (Projects) by Phase
  const seenProjects = new Set();
  for (const proj of projectsInScope) {
    if (!proj || seenProjects.has(proj.id)) continue;
    seenProjects.add(proj.id);

    // Compute Project's Phase using the same logic as Sites 1/4
    const projPhase = computeProjectSpinePhase(proj);
    const phaseKey = projPhase !== null ? `P${projPhase}` : 'null';

    leafCounts[phaseKey] = (leafCounts[phaseKey] || 0) + 1;
    leafRefs[phaseKey] = leafRefs[phaseKey] || [];
    leafRefs[phaseKey].push(proj.id);

    // Also count Deliverables under this Project (they roll up via parent Project's Phase)
    const projDeliverables = Object.values(deliverables).filter(
      (deliv) => deliv && deliv.owningProjectId === proj.id
    );
    for (const deliv of projDeliverables) {
      if (!deliv) continue;
      // Deliverable inherits parent Project's Phase (Section 2 locked doctrine)
      leafCounts[phaseKey] = (leafCounts[phaseKey] || 0) + 1;
      if (!leafRefs[phaseKey]) leafRefs[phaseKey] = [];
      leafRefs[phaseKey].push(`${deliv.id} (via ${proj.id})`);
    }

    // Also count Artifacts under this Project (same inheritance)
    const projArtifacts = Object.values(artifacts).filter(
      (art) => art && art.producingProjectId === proj.id
    );
    for (const art of projArtifacts) {
      if (!art) continue;
      leafCounts[phaseKey] = (leafCounts[phaseKey] || 0) + 1;
      if (!leafRefs[phaseKey]) leafRefs[phaseKey] = [];
      leafRefs[phaseKey].push(`${art.id} (via ${proj.id})`);
    }
  }

  // Detect orphaned Projects (Section 0 finding: owningInitiativeId is optional/unvalidated)
  // An orphaned Project is one that:
  // - Has invalid owningInitiativeId (points to non-existent Initiative)
  // - Or has owningInitiativeId === null but isn't directly owned by this Entity (if Entity scope)
  const ownNode = node.id;
  const nodeType = entities[ownNode] ? 'entity' : initiatives[ownNode] ? 'initiative' : null;

  for (const proj of Object.values(projects)) {
    if (!proj || seenProjects.has(proj.id)) continue;

    let isOrphaned = false;

    if (nodeType === 'initiative') {
      // At Initiative scope: Project is orphaned if owningInitiativeId !== this Initiative
      isOrphaned = proj.owningInitiativeId !== ownNode;
    } else if (nodeType === 'entity') {
      // At Entity scope: Project is orphaned if it belongs to a different Entity
      isOrphaned = proj.owningEntityId !== ownNode;
    }

    if (isOrphaned) {
      orphanedProjects.push(proj.id);
    }
  }

  // Build display summary (Section 2.1: "never terminal" — derived from data, never stored)
  const hasItems = Object.values(leafCounts).some((count) => count > 0);
  let displaySummary = '';
  if (leafCounts.P1 > 0) displaySummary += `${leafCounts.P1} P1`;
  if (leafCounts.P2 > 0) displaySummary += (displaySummary ? ', ' : '') + `${leafCounts.P2} P2`;
  if (leafCounts.P3 > 0) displaySummary += (displaySummary ? ', ' : '') + `${leafCounts.P3} P3`;
  if (leafCounts.null > 0) displaySummary += (displaySummary ? ', ' : '') + `${leafCounts.null} unphased`;
  if (!hasItems) displaySummary = 'No items';

  return {
    ownNode,
    leafCounts,
    leafRefs,
    displaySummary,
    orphanedProjects,
  };
}

/**
 * aggregateUrgencyRollup(node, matrix, constraintsByNode): UrgencyRollup
 *
 * Computes Urgency at a given node level, with compounding floor from child CONSTRAINTs.
 *
 * @param {Object} node — Entity or Initiative node
 * @param {Object} matrix — state.matrix
 * @param {Object} constraintsByNode — map of node IDs to their CONSTRAINT status (e.g., from executionContract)
 * @returns {Object} UrgencyRollup { ownNode, computedUrgency, compoundingFloor, effectiveUrgency, constraintSources }
 */
export function aggregateUrgencyRollup(node, matrix = {}, constraintsByNode = {}) {
  if (!node || !matrix) {
    return {
      ownNode: node?.id || null,
      computedUrgency: 'none',
      compoundingFloor: 'none',
      effectiveUrgency: 'none',
      constraintSources: [],
    };
  }

  const initiatives = matrix.initiativesById || {};
  const projects = matrix.projectsById || {};
  const entities = matrix.entitiesById || {};

  const URGENCY_LEVELS = { none: 0, watch: 1, urgent: 2 };
  const LEVEL_NAMES = { 0: 'none', 1: 'watch', 2: 'urgent' };

  const ownNode = node.id;
  const nodeType = entities[ownNode] ? 'entity' : initiatives[ownNode] ? 'initiative' : null;

  // Collect all descendant leaf nodes (Projects) in scope
  let leafNodes = [];

  if (nodeType === 'entity') {
    // Entity scope: all Projects owned by this Entity's Initiatives
    const entityInitiatives = Object.values(initiatives).filter(
      (init) => init && (init.owningEntityId === ownNode || (Array.isArray(init.owningEntityIds) && init.owningEntityIds.includes(ownNode)))
    );
    for (const init of entityInitiatives) {
      if (!init) continue;
      leafNodes.push(
        ...Object.values(projects).filter((proj) => proj && proj.owningInitiativeId === init.id)
      );
    }
    // Also collect Projects directly owned by Entity
    leafNodes.push(
      ...Object.values(projects).filter(
        (proj) => proj && proj.owningEntityId === ownNode && !proj.owningInitiativeId
      )
    );
  } else if (nodeType === 'initiative') {
    // Initiative scope: all Projects owned by this Initiative
    leafNodes = Object.values(projects).filter(
      (proj) => proj && proj.owningInitiativeId === ownNode
    );
  }

  // Compute this node's own urgency (simplified for now: based on count of items)
  // Production version would consider more complex heuristics (deadline closeness, blocker count, etc.)
  let computedUrgency = 'none';
  if (leafNodes.length > 10) {
    computedUrgency = 'watch'; // Many items → elevated attention
  }
  if (leafNodes.length > 20) {
    computedUrgency = 'urgent'; // Very many items → urgent
  }

  // Compounding floor: find all child CONSTRAINTs (Section 2.2 locked)
  let compoundingFloor = 0;
  const constraintSources = [];

  for (const leaf of leafNodes) {
    if (!leaf) continue;
    const leafConstraintLevel = constraintsByNode[leaf.id];
    if (leafConstraintLevel === 'CONSTRAINT') {
      compoundingFloor = Math.max(compoundingFloor, URGENCY_LEVELS.urgent);
      constraintSources.push(leaf.id);
    }
  }

  // Effective urgency is the max of computed and compounding floor (Section 2.2)
  const computedLevel = URGENCY_LEVELS[computedUrgency] || 0;
  const effectiveLevel = Math.max(computedLevel, compoundingFloor);
  const effectiveUrgency = LEVEL_NAMES[effectiveLevel] || 'none';

  return {
    ownNode,
    computedUrgency,
    compoundingFloor: LEVEL_NAMES[compoundingFloor] || 'none',
    effectiveUrgency,
    constraintSources,
  };
}
