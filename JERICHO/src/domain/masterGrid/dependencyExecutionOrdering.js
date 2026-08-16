/**
 * dependencyExecutionOrdering.js
 *
 * Computes execution order (topological layering) from the dependency graph.
 * The operator declares "what must happen before what" (DECLARE_DEPENDENCY,
 * generalized to Project/Initiative nodes); this module turns that graph into
 * execution layers (0-based depth in dependency chain) per CONFIRMED Project.
 *
 * Separately flags where the graph is too thin or self-contradictory to trust —
 * "reorganization recommendations" rather than a silent guess.
 *
 * Only 'hard_gate' and 'directional' edges impose ordering. 'informational' edges
 * are annotation only (per DEPENDENCY_TYPES in dependencySlot.ts) and are ignored here.
 *
 * Cycles are already rejected at capture time (declareDependency's cycle guard),
 * but this module defends against one anyway rather than trusting that invariant blindly.
 *
 * RETIRED: dependency-based phase derivation (bucketLayersToPhases).
 * Execution layers are now returned raw (0..N) for direct use in scheduling/ordering,
 * not forced into Phase-shaped buckets (1/2/3). Phase comes from Terminal Dates via
 * spine windows (computeInitiativePhasesForAll), not from dependency position.
 */

import { classifyPhase, NonCanonicalPhaseError } from './phaseClassification.js';
import { validateInitiativePhaseHierarchy } from './spinePhaseComputation.js';

const ORDERING_TYPES = new Set(['hard_gate', 'directional']);

function confirmedProjectIds(matrix) {
  const projects = matrix.projectsById || {};
  return new Set(Object.keys(projects).filter((id) => projects[id]?.reviewStatus === 'CONFIRMED'));
}

/**
 * Builds the project-to-project ordering graph: for each CONFIRMED project, which other
 * CONFIRMED projects must happen before it (its "requires" set).
 */
function buildProjectRequiresMap(matrix) {
  const confirmed = confirmedProjectIds(matrix);
  const dependencies = matrix.dependenciesById || {};
  const requires = new Map(); // projectId -> Set(prerequisite projectIds)
  const participates = new Set(); // any project touched by a qualifying edge, either side

  for (const id of confirmed) {
    requires.set(id, new Set());
  }

  for (const edge of Object.values(dependencies)) {
    if (!edge || !ORDERING_TYPES.has(edge.type)) {continue;}
    const { downstreamId, upstreamId } = edge;
    if (!confirmed.has(downstreamId) || !confirmed.has(upstreamId)) {continue;} // not a Project-Project edge
    requires.get(downstreamId).add(upstreamId);
    participates.add(downstreamId);
    participates.add(upstreamId);
  }

  return { confirmed, requires, participates };
}

/**
 * Longest-path-from-source layering, defensive against cycles (caps iteration at the
 * node count rather than trusting the capture-time guard blindly).
 * @returns {Map<string, number>} projectId -> layer (0-based), only for participating projects
 */
function computeLayers(requires, participates) {
  const layers = new Map();
  const nodes = [...participates];
  let changed = true;
  let iterations = 0;
  const maxIterations = nodes.length + 1;

  while (changed && iterations <= maxIterations) {
    changed = false;
    iterations += 1;
    for (const id of nodes) {
      const prereqs = [...requires.get(id)].filter((p) => participates.has(p));
      if (prereqs.length === 0) {
        if (!layers.has(id)) {
          layers.set(id, 0);
          changed = true;
        }
        continue;
      }
      const prereqLayers = prereqs.map((p) => layers.get(p));
      if (prereqLayers.some((l) => l === undefined)) {continue;} // not resolvable yet
      const candidate = 1 + Math.max(...prereqLayers);
      if (layers.get(id) !== candidate) {
        layers.set(id, candidate);
        changed = true;
      }
    }
  }

  // Anything still unresolved after maxIterations is part of an undetected cycle —
  // defensively drop it rather than loop forever or report a bogus layer.
  return layers;
}

/**
 * Computes raw execution layers (0-based depth in dependency chain) for CONFIRMED projects.
 * Returns only projects that participate in at least one ordering edge (directly or transitively).
 * Projects with no dependency signal are intentionally excluded — see
 * buildPhaseReorganizationRecommendations for how those get surfaced instead of guessed.
 *
 * @param {object} matrix - state.matrix
 * @returns {Record<string, number>} projectId -> executionLayer (0..N), only for participating projects
 */
export function computeDependencyExecutionLayer(matrix = {}) {
  const { requires, participates } = buildProjectRequiresMap(matrix);
  const layers = computeLayers(requires, participates);
  return Object.fromEntries(layers);
}

/**
 * @param {object} matrix - state.matrix
 * @returns {Array<{code: string, projectId: string, projectName: string, message: string}>}
 */
export function buildPhaseReorganizationRecommendations(matrix = {}) {
  const projects = matrix.projectsById || {};
  const initiatives = matrix.initiativesById || {};
  const { confirmed, participates } = buildProjectRequiresMap(matrix);
  const executionLayers = computeDependencyExecutionLayer(matrix);
  const recommendations = [];

  for (const id of confirmed) {
    const project = projects[id];
    const name = project?.name || id;
    const owningInitiative = initiatives[project?.owningInitiativeId];
    const initiativeHasDeclaredPhase = owningInitiative?.phase != null;

    if (!participates.has(id)) {
      // A project with no pairwise dependency is no longer automatically a gap — it may
      // simply inherit a phase from its owning Initiative instead (the coarse, tractable
      // default at real portfolio size).
      if (!initiativeHasDeclaredPhase) {
        recommendations.push({
          code: 'NO_DECLARED_SEQUENCE',
          projectId: id,
          projectName: name,
          message: `"${name}" has no declared dependency relationship to any other CONFIRMED project, and its owning initiative has no declared phase (§5). Either: declare a dependency edge to sequence it relative to another project, or assign the initiative a phase (1=beginning, 2=middle, 3=end) so this project inherits. Deferred: dedicated sequencing UI is not yet available; use dependency declaration modal.`,
        });
      }
      continue;
    }

    // Gate: PROJECT_PHASE_HIERARCHY_VIOLATION — Live gate (Task 6, 2026-08-15):
    // Project Phase must be >= owning Initiative's Phase (child >= parent).
    // Per new doctrine, both Phases are independently computed from their Terminal Dates
    // via spine windows. This gate validates the hierarchy invariant at runtime.
    // Uses validateInitiativePhaseHierarchy (shared validator, also in retroactive audit).
    // Advisory (non-blocking): violations surface to operator for remediation.
    const initiativePhase = owningInitiative?.phase ? Number(owningInitiative.phase) : null;
    const projectPhase = project?.phase ? Number(project.phase) : null;

    if (
      initiativePhase != null &&
      Number.isFinite(initiativePhase) &&
      projectPhase != null &&
      Number.isFinite(projectPhase)
    ) {
      const hierarchyValidation = validateInitiativePhaseHierarchy(projectPhase, initiativePhase);
      if (!hierarchyValidation.valid) {
        recommendations.push({
          code: 'PROJECT_PHASE_HIERARCHY_VIOLATION',
          projectId: id,
          projectName: name,
          message: hierarchyValidation.message,
        });
      }
    }
  }

  // Requires-cycle detection is a capture-time guard (declareDependency), but if the graph
  // was ever mutated directly, surface it here too rather than silently dropping the nodes.
  // A participating project missing from executionLayers means computeLayers's iteration cap
  // was hit before it resolved — the layering fixed point never settled, i.e. a cycle.
  for (const id of participates) {
    if (!(id in executionLayers)) {
      recommendations.push({
        code: 'UNRESOLVABLE_SEQUENCE',
        projectId: id,
        projectName: projects[id]?.name || id,
        message: `"${projects[id]?.name || id}" is part of a circular dependency — its dependencies (directly or transitively) form a cycle, preventing layer resolution. Deferred: cycle visualization UI is not yet available. Manually inspect declared dependencies and remove or redirect one edge to break the cycle.`,
      });
    }
  }

  // Initiative-level gap: an Initiative that owns at least one CONFIRMED project but has
  // never had its phase declared at all — the "recommend reorganization" surface at the
  // more natural altitude (10 Initiatives, not 18+ Projects or ~153 pairwise edges).
  const initiativeHasConfirmedProject = new Set();
  for (const id of confirmed) {
    const owningInitiativeId = projects[id]?.owningInitiativeId;
    if (owningInitiativeId) {initiativeHasConfirmedProject.add(owningInitiativeId);}
  }
  for (const initiativeId of initiativeHasConfirmedProject) {
    const initiative = initiatives[initiativeId];
    if (initiative && initiative.phase == null) {
      recommendations.push({
        code: 'INITIATIVE_NO_PHASE_DECLARED',
        projectId: initiativeId,
        projectName: initiative.name || initiativeId,
        message: `Initiative "${initiative.name || initiativeId}" has ${[...confirmed].filter(id => projects[id]?.owningInitiativeId === initiativeId).length} CONFIRMED projects but no declared phase (§5). Set phase to 1 (beginning), 2 (middle), or 3 (end) so all projects under it inherit a consistent phase and schedule together.`,
      });
    }
  }

  return recommendations;
}
