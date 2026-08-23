/**
 * phaseFromDependencies.js
 *
 * Phase (beginning/middle/end) is raw-attested at intake (the §5 project phase probe, Wave 2
 * Gate 1); this module derives phase from the dependency graph for scheduling ORDER and to fill
 * gaps where raw attestation is absent (Gate 5 precedence: raw-first display, derived-first
 * scheduling). The operator also declares "what must happen
 * before what" (DECLARE_DEPENDENCY, generalized to Project/Initiative nodes); this module
 * turns that graph into a Phase 1/2/3 classification per CONFIRMED Project, and separately
 * flags where the graph is too thin or self-contradictory to trust — "reorganization
 * recommendations" rather than a silent guess.
 *
 * Only 'hard_gate' and 'directional' edges impose ordering. 'informational' edges are
 * annotation only (per DEPENDENCY_TYPES in dependencySlot.ts) and are ignored here.
 *
 * Cycles are already rejected at capture time (declareDependency's cycle guard), but this
 * module defends against one anyway rather than trusting that invariant blindly.
 */

import { classifyPhase, NonCanonicalPhaseError } from './phaseClassification.js';
import { computeSpineWindowPhase } from './computeSpineWindowPhase.js';

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
    if (!edge || !ORDERING_TYPES.has(edge.type)) continue;
    const { downstreamId, upstreamId } = edge;
    if (!confirmed.has(downstreamId) || !confirmed.has(upstreamId)) continue; // not a Project-Project edge
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
      if (prereqLayers.some((l) => l === undefined)) continue; // not resolvable yet
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
 * Collapses however many distinct layer values exist into Phase 1/2/3, proportionally
 * across the layer range (not by node count) so a long dependency chain still reads as a
 * beginning/middle/end story rather than N discrete steps.
 */
function bucketLayersToPhases(layers) {
  const phases = new Map();
  if (layers.size === 0) return phases;

  const values = [...layers.values()];
  const minLayer = Math.min(...values);
  const maxLayer = Math.max(...values);
  const span = maxLayer - minLayer;

  for (const [id, layer] of layers) {
    if (span === 0) {
      phases.set(id, 1); // single layer, no depth signal beyond "these are ordered together"
      continue;
    }
    const fraction = (layer - minLayer) / span;
    const bucket = Math.min(3, 1 + Math.floor(fraction * 3));
    phases.set(id, bucket);
  }
  return phases;
}

/**
 * @param {object} matrix - state.matrix
 * @returns {Record<string, 1|2|3>} projectId -> derived phase, only for CONFIRMED projects
 *   that participate in at least one ordering edge (directly or transitively). Projects
 *   with no dependency signal at all are intentionally excluded — see
 *   buildPhaseReorganizationRecommendations for how those get surfaced instead of guessed.
 */
export function deriveProjectPhasesFromDependencies(matrix = {}) {
  const { requires, participates } = buildProjectRequiresMap(matrix);
  const layers = computeLayers(requires, participates);
  const phases = bucketLayersToPhases(layers);
  return Object.fromEntries(phases);
}

/**
 * Merges every phase signal available for a CONFIRMED project, most-specific first
 * (2026-07-13 phasing-scalability follow-up — see setInitiativePhase/SET_INITIATIVE_PHASE):
 *
 *   1. Dependency-derived phase (deriveProjectPhasesFromDependencies) — the project actually
 *      participates in a declared "X before Y" sequence. Most specific, wins over everything.
 *   2. The project's own hand-typed `phase` field — a fallback for a project the operator
 *      labeled directly but hasn't (yet) sequenced against anything else.
 *   3. The owning Initiative's declared phase (SET_INITIATIVE_PHASE) — the coarse default.
 *      Declared once per Initiative (~10 decisions across a real portfolio) instead of via
 *      pairwise Project dependencies, which don't scale once a portfolio holds many
 *      unrelated content lines (e.g. sequencing "OUR FEARLESS LEADER 3" against "I AM THE
 *      STATE" doesn't mean anything — they simply belong to different Initiatives, each with
 *      their own phase).
 *
 * A project with none of the three is intentionally left out of the result — see
 * buildPhaseReorganizationRecommendations for how that gap gets surfaced instead of guessed.
 *
 * @param {object} matrix - state.matrix
 * @returns {Record<string, string|number>} projectId -> effective phase
 */
export function deriveEffectiveProjectPhases(matrix = {}) {
  const projects = matrix.projectsById || {};
  const initiatives = matrix.initiativesById || {};
  const confirmed = confirmedProjectIds(matrix);
  const derivedPhases = deriveProjectPhasesFromDependencies(matrix);
  const effective = {};

  for (const id of confirmed) {
    if (derivedPhases[id] != null) {
      effective[id] = derivedPhases[id];
      continue;
    }
    const project = projects[id];
    if (project?.phase != null) {
      effective[id] = project.phase;
      continue;
    }
    const initiative = initiatives[project?.owningInitiativeId];
    if (initiative?.phase != null) {
      effective[id] = initiative.phase;
    }
  }

  return effective;
}

/**
 * @param {object} matrix - state.matrix
 * @returns {Array<{code: string, projectId: string, projectName: string, message: string}>}
 */
export function buildPhaseReorganizationRecommendations(matrix = {}) {
  const projects = matrix.projectsById || {};
  const initiatives = matrix.initiativesById || {};
  const { confirmed, participates } = buildProjectRequiresMap(matrix);
  const derivedPhases = deriveProjectPhasesFromDependencies(matrix);
  const recommendations = [];

  for (const id of confirmed) {
    const project = projects[id];
    const name = project?.name || id;
    const owningInitiative = initiatives[project?.owningInitiativeId];
    const initiativeHasDeclaredPhase = owningInitiative?.phase != null;

    if (!participates.has(id)) {
      // 2026-07-13 phasing-scalability follow-up: a project with no pairwise dependency is
      // no longer automatically a gap — it may simply inherit a phase from its owning
      // Initiative instead (the coarse, tractable default at real portfolio size).
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

    // Gate 3: validate declared phase via classifyPhase. Advisory never blocks on bad data —
    // if phase is corrupted, flag it and continue checking other recommendations.
    let declaredPhase = null;
    if (project?.phase != null) {
      try {
        declaredPhase = classifyPhase(project.phase, name);
      } catch (err) {
        if (err instanceof NonCanonicalPhaseError) {
          recommendations.push({
            code: 'PHASE_DATA_CORRUPTED',
            projectId: id,
            projectName: name,
            message: `"${name}" has invalid phase data: "${project.phase}" (violates §5 canonical rule). Phase must be exactly 1 (beginning), 2 (middle), or 3 (end). Correct to one of these values before scheduling. Example: set phase to 2 for a middle-of-timeline project.`,
          });
          declaredPhase = null; // treat as unattested, continue checking
        } else {
          throw err; // re-throw unexpected errors
        }
      }
    }

    const derivedPhase = derivedPhases[id];
    if (declaredPhase != null && Number.isFinite(declaredPhase) && derivedPhase != null && declaredPhase !== derivedPhase) {
      recommendations.push({
        code: 'DECLARED_PHASE_CONTRADICTS_DEPENDENCIES',
        projectId: id,
        projectName: name,
        message: `"${name}" is attested phase ${declaredPhase} (raw §5), but its declared dependencies order it to phase ${derivedPhase} (derived §5). Choose: correct the manual phase to ${derivedPhase}, or re-check the dependencies.`,
      });
    }

    // Gate 3: validate initiative phase via classifyPhase.
    let initiativePhase = null;
    if (initiativeHasDeclaredPhase) {
      try {
        initiativePhase = classifyPhase(owningInitiative.phase, owningInitiative.name || project.owningInitiativeId);
      } catch (err) {
        if (err instanceof NonCanonicalPhaseError) {
          recommendations.push({
            code: 'PHASE_DATA_CORRUPTED',
            projectId: project.owningInitiativeId,
            projectName: owningInitiative.name || project.owningInitiativeId,
            message: `Initiative "${owningInitiative.name || project.owningInitiativeId}" has invalid phase data: "${owningInitiative.phase}" (violates §5 canonical rule). Phase must be exactly 1 (beginning), 2 (middle), or 3 (end). Correct to one of these values before scheduling. Example: set phase to 1 for an early-timeline initiative.`,
          });
          initiativePhase = null; // treat as unattested, continue checking
        } else {
          throw err;
        }
      }
    }

    if (
      initiativePhase != null &&
      Number.isFinite(initiativePhase) &&
      derivedPhase != null &&
      initiativePhase !== derivedPhase
    ) {
      recommendations.push({
        code: 'PROJECT_PHASE_CONTRADICTS_INITIATIVE',
        projectId: id,
        projectName: name,
        message: `"${name}" is ordered to phase ${derivedPhase} by its dependencies, but owning initiative "${owningInitiative.name || project.owningInitiativeId}" is attested phase ${initiativePhase} (Gate 1 §5). Initiative phase must encompass all its projects. Correct the initiative to phase ${derivedPhase}, or re-order "${name}"'s dependencies.`,
      });
    }
  }

  // Requires-cycle detection is a capture-time guard (declareDependency), but if the graph
  // was ever mutated directly, surface it here too rather than silently dropping the nodes.
  // A participating project missing from derivedPhases means computeLayers's iteration cap
  // was hit before it resolved — the layering fixed point never settled, i.e. a cycle.
  for (const id of participates) {
    if (!(id in derivedPhases)) {
      recommendations.push({
        code: 'UNRESOLVABLE_SEQUENCE',
        projectId: id,
        projectName: projects[id]?.name || id,
        message: `"${projects[id]?.name || id}" is part of a circular dependency — its dependencies (directly or transitively) form a cycle, preventing phase resolution. Deferred: cycle visualization UI is not yet available. Manually inspect declared dependencies and remove or redirect one edge to break the cycle.`,
      });
    }
  }

  // Initiative-level gap: an Initiative that owns at least one CONFIRMED project but has
  // never had its phase declared at all — the new "recommend reorganization" surface, moved
  // to the more natural altitude (10 Initiatives, not 18+ Projects or ~153 pairwise edges).
  const initiativeHasConfirmedProject = new Set();
  for (const id of confirmed) {
    const owningInitiativeId = projects[id]?.owningInitiativeId;
    if (owningInitiativeId) initiativeHasConfirmedProject.add(owningInitiativeId);
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
