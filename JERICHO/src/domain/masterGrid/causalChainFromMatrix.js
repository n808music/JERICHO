/**
 * causalChainFromMatrix.js
 *
 * Bridges the Master Grid matrix (entities/initiatives/projects/systems/artifacts,
 * captured via MatrixIntake) to the schedule generator's `causalChainSteps` input
 * (deterministicPlanGenerator.ts).
 *
 * Root cause this closes: generateDeterministicPlan() only ever received
 * `cycle.goalContract.execution.causalChainSteps`, a field populated exclusively by
 * the manual CausalChainBuilder UI in Goal Admission — never by matrix intake. When
 * that field was empty (the normal case), the generator silently fell back to a
 * hardcoded 3-tier default (Planning & Setup / Core Work / Verification & Review),
 * regardless of how much CONFIRMED matrix data existed. This module derives real
 * causal steps from the matrix so that fallback stops firing once intake is done.
 *
 * Node choice: Project rows are used as steps. Per jericho_matrix_schema_v1.4,
 * Projects are the only node class carrying a concrete, verifiable unit of work
 * (successMetric, verificationSourceId, targetDate) parented under an Initiative —
 * Entities/Initiatives are org/objective nodes, Systems are infrastructure, and
 * Deliverables are outputs of a Project, not schedulable steps themselves.
 *
 * Only reviewStatus === 'CONFIRMED' projects are used (matches Master Grid's
 * `readyForIntake` predicate) — DRAFT/NEEDS_REVIEW rows are not yet operator-ready.
 *
 * Ordering: Primary is dependency-based execution layer (raw topological depth, 0-based).
 * Within the same layer, projects are ordered by computed Phase (Project.phase, computed
 * from Terminal Date), then owning Initiative's Phase, then name. Raw execution layers
 * preserve the full dependency chain depth (not bucketed into 1/2/3), giving finer-grained
 * scheduling order than phase windows alone could provide.
 */

import { computeDependencyExecutionLayer } from './dependencyExecutionOrdering.js';

function numericAwareCompare(a, b) {
  const na = Number(a);
  const nb = Number(b);
  if (Number.isFinite(na) && Number.isFinite(nb) && na !== nb) {return na - nb;}
  return String(a).localeCompare(String(b));
}

/**
 * Derive ordered causal chain steps from CONFIRMED Project rows in the matrix.
 *
 * Ordering: dependency execution layer (raw topological depth, primary), then
 * computed project phase, then owning-initiative phase, then project name —
 * deterministic and stable across calls for the same matrix contents.
 *
 * @param {object} matrix - state.matrix (entitiesById/initiativesById/projectsById/...)
 * @returns {Array<{sequence: number, description: string, projectId: string, targetDate: string|null}>} empty array
 *   if no CONFIRMED projects exist (caller falls back to the generic 3-tier default).
 *   targetDate is YYYY-MM-DD or null if not set on the project.
 */
export function buildCausalChainStepsFromMatrix(matrix = {}) {
  const projects = matrix.projectsById || {};
  const initiatives = matrix.initiativesById || {};

  const confirmed = Object.keys(projects)
    .map((id) => projects[id])
    .filter((project) => project && project.reviewStatus === 'CONFIRMED');

  if (confirmed.length === 0) {return [];}

  const executionLayers = computeDependencyExecutionLayer(matrix);
  const executionLayer = (project) =>
    executionLayers[project.id] != null ? executionLayers[project.id] : null;

  const sorted = [...confirmed].sort((a, b) => {
    // Primary: execution layer (raw dependency depth, 0-based)
    // Only use layer for differentiation when both projects have one (both participate in dependencies).
    // If either has no layer (no dependency signal), skip to phase tier — having no dependency signal
    // is not the same as sorting last; the phase tier handles priority correctly.
    const layerA = executionLayer(a);
    const layerB = executionLayer(b);
    if (layerA != null && layerB != null && layerA !== layerB) {
      const byLayer = numericAwareCompare(layerA, layerB);
      if (byLayer !== 0) {return byLayer;}
    }

    // Secondary: computed project phase (from Terminal Date, live via computeInitiativePhasesForAll)
    const phaseA = a.phase != null ? Number(a.phase) : null;
    const phaseB = b.phase != null ? Number(b.phase) : null;
    if (phaseA !== phaseB) {
      if (phaseA == null) {return 1;}
      if (phaseB == null) {return -1;}
      const byPhase = numericAwareCompare(phaseA, phaseB);
      if (byPhase !== 0) {return byPhase;}
    }

    // Tertiary: owning initiative's computed phase
    const initPhaseA = initiatives[a.owningInitiativeId]?.phase != null ? Number(initiatives[a.owningInitiativeId].phase) : null;
    const initPhaseB = initiatives[b.owningInitiativeId]?.phase != null ? Number(initiatives[b.owningInitiativeId].phase) : null;
    if (initPhaseA !== initPhaseB) {
      if (initPhaseA == null) {return 1;}
      if (initPhaseB == null) {return -1;}
      const byInitPhase = numericAwareCompare(initPhaseA, initPhaseB);
      if (byInitPhase !== 0) {return byInitPhase;}
    }

    // Final tiebreak: project name
    return String(a.name).localeCompare(String(b.name));
  });

  return sorted.map((project, idx) => ({
    sequence: idx + 1,
    description: project.name,
    // Carried through opaquely by the generic deterministic generator (it does not
    // interpret this field) so the canonical ScheduledBlock builder can trace a
    // deliverable back to its owning Project/Initiative/Entity for entityId/laneId
    // (2026-07-13 unified schedule generation design, §6/§3).
    projectId: project.id,
    // Per-project target deadline (2026-08-13, per-project deadline enforcement).
    // Format: YYYY-MM-DD. The scheduler respects this as a soft constraint (phase
    // ordering is hard; target dates are soft, used as tiebreaker within phase).
    // Undefined if project has no targetDate set.
    targetDate: project.targetDate || null,
  }));
}
