/**
 * Matrix Selectors — Derived Relationships
 *
 * Compute relationships that aren't stored directly but are derivable from
 * graph traversal. Never stored, always computed on read. Consistent pattern:
 * reverse-lookup via graph structure.
 */

/**
 * Compute Owning Initiatives for a Convergence edge.
 *
 * Given a convergence edge with fromNodeIds, find the parent Initiative
 * for each source node. Sources can be Projects, Deliverables, Artifacts, etc.
 * Returns the set of unique Initiative IDs that own those sources.
 *
 * @param {Object} convergenceEdge - edge from convergenceEdgesById
 * @param {Object} matrix - state.matrix
 * @returns {string[]} owningInitiativeIds - array of unique Initiative IDs
 */
export function getConvergenceOwningInitiatives(convergenceEdge, matrix) {
  if (!convergenceEdge?.fromNodeIds || !Array.isArray(convergenceEdge.fromNodeIds)) {
    return [];
  }

  const owningInitiativeIds = new Set();

  for (const sourceId of convergenceEdge.fromNodeIds) {
    // Check if source is a Project
    const project = matrix?.projectsById?.[sourceId];
    if (project?.owningInitiativeId) {
      owningInitiativeIds.add(project.owningInitiativeId);
      continue;
    }

    // Check if source is a Deliverable
    const deliverable = matrix?.deliverablesById?.[sourceId];
    if (deliverable?.owningInitiativeId) {
      owningInitiativeIds.add(deliverable.owningInitiativeId);
      continue;
    }

    // Check if source is an Initiative directly
    const initiative = matrix?.initiativesById?.[sourceId];
    if (initiative) {
      owningInitiativeIds.add(sourceId);
      continue;
    }

    // Check if source is an Artifact (trace back to producing Project → Initiative)
    const artifact = matrix?.artifactsById?.[sourceId];
    if (artifact?.producingProjectId) {
      const producingProject = matrix?.projectsById?.[artifact.producingProjectId];
      if (producingProject?.owningInitiativeId) {
        owningInitiativeIds.add(producingProject.owningInitiativeId);
      }
    }
  }

  return Array.from(owningInitiativeIds);
}

/**
 * Compute Executing Entity rollup for a Project.
 *
 * A Project's Executing Entity is derived as the union of Executing Entities
 * across all Deliverables that belong to that Project. If no Deliverables
 * have an executingEntityId set, returns empty array.
 *
 * @param {string} projectId - ID of the Project
 * @param {Object} matrix - state.matrix
 * @returns {string[]} executingEntityIds - array of unique Entity IDs executing work
 */
export function getProjectExecutingEntities(projectId, matrix) {
  if (!projectId || !matrix?.deliverablesById || !matrix?.projectsById?.[projectId]) {
    return [];
  }

  const executingEntityIds = new Set();

  // Find all Deliverables owned by this Project
  for (const [delivId, deliverable] of Object.entries(matrix.deliverablesById)) {
    if (!deliverable) continue;
    if (deliverable.owningProjectId !== projectId) continue;

    // Collect the executingEntityId if present
    if (deliverable.executingEntityId) {
      executingEntityIds.add(deliverable.executingEntityId);
    }
  }

  return Array.from(executingEntityIds);
}

/**
 * Compute Parent Deliverables for an Artifact.
 *
 * An Artifact's parent Deliverables are those whose work produced or
 * defined this artifact. Derivable by scanning Deliverables for artifacts
 * that mention this artifact ID (once parentDeliverableIds is added to Artifact,
 * this becomes a direct lookup instead of scan).
 *
 * NOTE: Currently artifacts may already have `parentDeliverableIds` stored directly.
 * This selector provides the fallback scan if that field is not populated.
 *
 * @param {string} artifactId - ID of the Artifact
 * @param {Object} matrix - state.matrix
 * @returns {string[]} parentDeliverableIds - array of parent Deliverable IDs
 */
export function getArtifactParentDeliverables(artifactId, matrix) {
  if (!artifactId) {
    return [];
  }

  // Prefer stored parentDeliverableIds if present (primary source)
  const artifact = matrix?.artifactsById?.[artifactId];
  if (artifact?.parentDeliverableIds && Array.isArray(artifact.parentDeliverableIds)) {
    return artifact.parentDeliverableIds;
  }

  // Fallback: scan Deliverables (should not be needed once field is consistently populated)
  const parentIds = new Set();
  for (const [delivId, deliverable] of Object.entries(matrix?.deliverablesById || {})) {
    if (!deliverable?.artifactIds || !Array.isArray(deliverable.artifactIds)) continue;
    if (deliverable.artifactIds.includes(artifactId)) {
      parentIds.add(delivId);
    }
  }

  return Array.from(parentIds);
}
