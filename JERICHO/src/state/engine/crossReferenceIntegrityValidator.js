/**
 * Cross-Reference Integrity Validator (Option B: Resolver Registry Architecture)
 *
 * Validates four drift patterns with one extensible infrastructure:
 * - Pattern 1: Convergence date consistency (temporal drift)
 * - Pattern 2: Convergence source reference validity (referential drift)
 * - Pattern 3: Deliverable↔Artifact parent integrity (structural consistency)
 * - Pattern 4: Cross-tab naming consistency (general case)
 *
 * Phase 1 scope (v1): Patterns 1, 2, 3, 4 all included via resolver pattern
 * Phase 2 scope: None (all patterns in Phase 1)
 *
 * Architecture: Each reference type registers a resolver function.
 * Resolvers are called to determine if a reference is valid or broken.
 *
 * Called before: cycle apply, plan commit, schedule save (application-level)
 * Returns: { isConsistent: boolean, issues: Issue[] }
 * Issues are advisory flags, not gate failures.
 */

// ─────────────────────────────────────────────────────────────────────────
// Reference Resolver Registry (Option B)
// ─────────────────────────────────────────────────────────────────────────

/**
 * Registry of reference resolvers.
 * Each resolver checks if a reference is valid (points to existing entity).
 *
 * Resolver signature: (state, referenceValue) => entity | null
 * Returns null if reference is broken, otherwise returns the referenced entity.
 */
const REFERENCE_RESOLVERS = {
  // Pattern 3: Artifact parent Deliverable reference
  'artifact-parent-deliverable': (state, parentId) => {
    return state.matrix?.projectsById?.[parentId] || null;
  },

  // Pattern 2: Convergence source Project reference
  'convergence-source-project': (state, sourceId) => {
    return state.matrix?.projectsById?.[sourceId] || null;
  },

  // Future resolvers can be added here with zero restructuring
  // 'entity-reference': (state, entityId) => ...
  // 'system-reference': (state, systemId) => ...
};

// ─────────────────────────────────────────────────────────────────────────
// Pattern 1: Convergence Date Consistency (Temporal Drift)
// ─────────────────────────────────────────────────────────────────────────

/**
 * Validates that all source Projects in a Convergence Declaration
 * have Terminal Dates matching the Convergence's shared date expectation.
 *
 * @param {object} state - Identity state
 * @returns {Issue[]} Issues array (empty if consistent)
 */
export function validateConvergenceDates(state) {
  const issues = [];
  const convergences = state.matrix?.convergenceEdgesById || {};
  const projects = state.matrix?.projectsById || {};

  for (const [edgeId, edge] of Object.entries(convergences)) {
    if (!edge.sourceProjectIds || edge.sourceProjectIds.length === 0) {continue;}

    const sharedDate = edge.expectedTerminalDate || edge.sharedDeadline;
    if (!sharedDate) {continue;}

    const mismatchedSources = [];

    for (const projectId of edge.sourceProjectIds) {
      const project = projects[projectId];
      if (!project) {continue;} // Will be caught by Pattern 2

      const projectTerminalDate = project.terminalDate || project.deadlineISO;
      if (projectTerminalDate && projectTerminalDate !== sharedDate) {
        mismatchedSources.push({
          projectId,
          projectName: project.name,
          projectTerminalDate,
        });
      }
    }

    if (mismatchedSources.length > 0) {
      issues.push({
        pattern: 'convergence-date-consistency',
        severity: 'high',
        convergenceId: edgeId,
        convergenceName: edge.name,
        expectedDate: sharedDate,
        mismatchedSources,
        message: `Convergence "${edge.name}" expects sources to share date ${sharedDate}, but ${mismatchedSources.length} source(s) have different Terminal Dates.`,
        recommendation: 'Either update the Project Terminal Dates to match, or reconfigure the Convergence Declaration with updated dates.',
      });
    }
  }

  return issues;
}

// ─────────────────────────────────────────────────────────────────────────
// Pattern 2: Convergence Source Reference Validity (Referential Drift)
// ─────────────────────────────────────────────────────────────────────────

/**
 * Validates that Projects referenced in Convergence Declarations still exist.
 * Uses the resolver registry pattern for extensibility.
 *
 * @param {object} state - Identity state
 * @returns {Issue[]} Issues array (empty if all references valid)
 */
export function validateConvergenceSources(state) {
  const issues = [];
  const convergences = state.matrix?.convergenceEdgesById || {};
  const resolver = REFERENCE_RESOLVERS['convergence-source-project'];

  if (!resolver) {
    console.warn('No resolver registered for convergence-source-project references');
    return issues;
  }

  for (const [edgeId, edge] of Object.entries(convergences)) {
    if (!edge.sourceProjectIds || edge.sourceProjectIds.length === 0) {continue;}

    const brokenReferences = [];

    for (const projectId of edge.sourceProjectIds) {
      const resolved = resolver(state, projectId);
      if (!resolved) {
        brokenReferences.push({ projectId });
      }
    }

    if (brokenReferences.length > 0) {
      issues.push({
        pattern: 'convergence-source-reference-validity',
        severity: 'high',
        convergenceId: edgeId,
        convergenceName: edge.name,
        brokenReferences,
        message: `Convergence "${edge.name}" references ${brokenReferences.length} Project(s) that no longer exist or cannot be found.`,
        recommendation: 'Update the Convergence Declaration to remove or replace broken Project references.',
      });
    }
  }

  return issues;
}

// ─────────────────────────────────────────────────────────────────────────
// Pattern 3: Deliverable↔Artifact Parent Integrity (Structural Consistency)
// ─────────────────────────────────────────────────────────────────────────

/**
 * Validates that Artifacts' parent Deliverable references are valid.
 * Uses the resolver registry pattern for extensibility.
 *
 * @param {object} state - Identity state
 * @returns {Issue[]} Issues array (empty if all references valid)
 */
export function validateArtifactParents(state) {
  const issues = [];
  const artifacts = state.matrix?.artifactsById || {};
  const resolver = REFERENCE_RESOLVERS['artifact-parent-deliverable'];

  if (!resolver) {
    console.warn('No resolver registered for artifact-parent-deliverable references');
    return issues;
  }

  for (const [artifactId, artifact] of Object.entries(artifacts)) {
    const parentId = artifact.parentDeliverableId || artifact.parentProjectId;
    if (!parentId) {continue;} // No parent reference, not an error

    const resolved = resolver(state, parentId);
    if (!resolved) {
      issues.push({
        pattern: 'artifact-parent-integrity',
        severity: 'medium',
        artifactId,
        artifactName: artifact.name,
        parentId,
        message: `Artifact "${artifact.name}" references parent Deliverable/Project ${parentId}, which does not exist or cannot be found.`,
        recommendation: 'Update or remove the parent reference, or restore the parent Deliverable/Project.',
      });
    }
  }

  return issues;
}

// ─────────────────────────────────────────────────────────────────────────
// Pattern 4: Cross-Tab Naming Consistency (General Case)
// ─────────────────────────────────────────────────────────────────────────

/**
 * Validates naming consistency across entity references.
 * Detects when an entity name changes and breaks references elsewhere.
 *
 * Phase 1 implementation: Check common reference patterns
 * (Convergence→Project by name, Deliverable→Artifact parent, etc.)
 *
 * @param {object} state - Identity state
 * @returns {Issue[]} Issues array (empty if consistent)
 */
export function validateNamingConsistency(state) {
  const issues = [];

  // Check Convergence→Project name references
  const convergences = state.matrix?.convergenceEdgesById || {};
  const projects = state.matrix?.projectsById || {};

  for (const [edgeId, edge] of Object.entries(convergences)) {
    if (!edge.sourceProjectNames || edge.sourceProjectNames.length === 0) {continue;}

    const missingNameReferences = [];

    for (const projectName of edge.sourceProjectNames) {
      const found = Object.values(projects).some((p) => p.name === projectName);
      if (!found) {
        missingNameReferences.push(projectName);
      }
    }

    if (missingNameReferences.length > 0) {
      issues.push({
        pattern: 'cross-tab-naming-consistency',
        severity: 'high',
        convergenceId: edgeId,
        convergenceName: edge.name,
        missingNames: missingNameReferences,
        message: `Convergence "${edge.name}" references Project(s) by name: ${missingNameReferences.join(', ')}. These names no longer exist in the Projects list.`,
        recommendation: 'Update Convergence Declaration with current Project names, or rename the Projects back to match.',
      });
    }
  }

  return issues;
}

// ─────────────────────────────────────────────────────────────────────────
// Master Validator: All Patterns
// ─────────────────────────────────────────────────────────────────────────

/**
 * Validates all cross-reference patterns in one pass.
 * Called before cycle apply/save to check data consistency.
 *
 * @param {object} state - Identity state
 * @returns {object} { isConsistent: boolean, issues: Issue[] }
 */
export function validateCrossReferenceIntegrity(state) {
  const issues = [];

  // Pattern 1: Convergence date consistency
  issues.push(...validateConvergenceDates(state));

  // Pattern 2: Convergence source reference validity
  issues.push(...validateConvergenceSources(state));

  // Pattern 3: Deliverable↔Artifact parent integrity
  issues.push(...validateArtifactParents(state));

  // Pattern 4: Cross-tab naming consistency
  issues.push(...validateNamingConsistency(state));

  return {
    isConsistent: issues.length === 0,
    issues,
  };
}

/**
 * Register a new reference resolver for extensibility.
 * Called during initialization or when adding support for new reference types.
 *
 * @param {string} referenceType - Type key (e.g., 'entity-reference')
 * @param {Function} resolver - Function: (state, referenceValue) => entity | null
 */
export function registerReferenceResolver(referenceType, resolver) {
  if (typeof resolver !== 'function') {
    throw new Error(`Resolver must be a function, got ${typeof resolver}`);
  }
  REFERENCE_RESOLVERS[referenceType] = resolver;
}
