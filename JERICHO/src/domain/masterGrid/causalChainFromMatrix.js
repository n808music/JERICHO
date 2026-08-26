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
 * (description, verificationSourceId, targetDate) parented under an Initiative —
 * Entities/Initiatives are org/objective nodes, Systems are infrastructure, and
 * Deliverables are outputs of a Project, not schedulable steps themselves.
 *
 * Only reviewStatus === 'CONFIRMED' projects are used (matches Master Grid's
 * `readyForIntake` predicate) — DRAFT/NEEDS_REVIEW rows are not yet operator-ready.
 *
 * Ordering (2026-07-13 phase/sequencing design, extended same day for the
 * phasing-scalability follow-up): the raw `phase` field on a Project is almost never
 * populated — nothing in the operator-facing intake survey ever asks for it, and pairwise
 * dependency declaration doesn't scale once a portfolio holds many unrelated content lines
 * (confirmed by the operator at ~18 CONFIRMED Projects). Effective phase per Project now
 * comes from deriveEffectiveProjectPhases (phaseFromDependencies.js), which merges, most
 * specific first: (1) dependency-derived phase, (2) the project's own hand-typed phase,
 * (3) its owning Initiative's declared phase — the coarse default a project inherits when
 * it has no more specific signal of its own.
 *
 * STALE as of 2026-08-23 (E16): tier (3) is dead. `SET_INITIATIVE_PHASE` and the Initiative
 * `phase` field are removed — an Initiative has no Phase, by doctrine. Tier (3) can no longer
 * fire and is itemized for deletion in
 * docs/superpowers/plans/2026-08-23-e16-initiative-terminal-date.md §6.
 */

import { deriveEffectiveProjectPhases } from './phaseFromDependencies.js';

function numericAwareCompare(a, b) {
  const na = Number(a);
  const nb = Number(b);
  if (Number.isFinite(na) && Number.isFinite(nb) && na !== nb) return na - nb;
  return String(a).localeCompare(String(b));
}

/**
 * Derive ordered causal chain steps from CONFIRMED Project rows in the matrix.
 *
 * Ordering: numeric-aware project phase, then numeric-aware owning-initiative
 * phase, then project name — deterministic and stable across calls for the same
 * matrix contents.
 *
 * @param {object} matrix - state.matrix (entitiesById/initiativesById/projectsById/...)
 * @returns {Array<{sequence: number, description: string, projectId: string}>} empty array
 *   if no CONFIRMED projects exist (caller falls back to the generic 3-tier default).
 */
export function buildCausalChainStepsFromMatrix(matrix = {}) {
  const projects = matrix.projectsById || {};

  const confirmed = Object.keys(projects)
    .map((id) => projects[id])
    .filter((project) => project && project.reviewStatus === 'CONFIRMED');

  if (confirmed.length === 0) return [];

  const effectivePhases = deriveEffectiveProjectPhases(matrix);
  const effectivePhase = (project) =>
    effectivePhases[project.id] != null ? effectivePhases[project.id] : null;

  const sorted = [...confirmed].sort((a, b) => {
    const pa = effectivePhase(a);
    const pb = effectivePhase(b);
    if (pa !== pb) {
      if (pa == null) return 1;
      if (pb == null) return -1;
      const byPhase = numericAwareCompare(pa, pb);
      if (byPhase !== 0) return byPhase;
    }

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
  }));
}
