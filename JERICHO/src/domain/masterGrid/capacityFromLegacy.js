/**
 * capacityFromLegacy.js
 *
 * Carries forward whatever time-constraint data already exists (goalContract.workWindows,
 * the global availabilityPolicy fallback, or the simpler strategy.constraints block cap
 * model) into a single matrix.capacityById row — DRAFT, not CONFIRMED, so it goes through
 * the same one-click reconfirm every other matrix row does, without asking the operator to
 * retype anything they already entered.
 *
 * Resolution order for "which entity is this for": the owning entity of the first
 * (phase-sorted) CONFIRMED Project — the same entity the causal chain is already anchored
 * to (see causalChainFromMatrix.js) — falling back to the sole entity in entitiesById when
 * there's exactly one. Ambiguous multi-entity cases with no confirmed causal chain yet are
 * left unseeded (returns null) rather than guessing which entity owns the legacy data.
 *
 * Idempotent: returns null if a capacityById row already exists for the resolved entity, or
 * if there is nothing to carry forward.
 */

export const DAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

function hasAnyWorkWindows(workWindows) {
  if (!workWindows || typeof workWindows !== 'object') {return false;}
  return DAY_KEYS.some((day) => Array.isArray(workWindows[day]) && workWindows[day].length > 0);
}

/**
 * Resolves "which entity is this capacity/schedule for" — the owning entity of the
 * first (phase-sorted) CONFIRMED Project, falling back to the sole entity when there's
 * exactly one. Shared by capacity seeding and constraints-from-matrix resolution so both
 * agree on the same acting entity.
 */
export function resolveActingEntityId(matrix) {
  const entities = matrix.entitiesById || {};
  const projects = matrix.projectsById || {};

  const confirmedProjects = Object.values(projects)
    .filter((p) => p && p.reviewStatus === 'CONFIRMED' && p.owningEntityId)
    .sort((a, b) => {
      const pa = a.phase;
      const pb = b.phase;
      if (pa === pb) {return String(a.name).localeCompare(String(b.name));}
      if (pa == null) {return 1;}
      if (pb == null) {return -1;}
      const na = Number(pa);
      const nb = Number(pb);
      if (Number.isFinite(na) && Number.isFinite(nb) && na !== nb) {return na - nb;}
      return String(pa).localeCompare(String(pb));
    });
  if (confirmedProjects.length > 0) {
    return confirmedProjects[0].owningEntityId;
  }

  const entityIds = Object.keys(entities);
  if (entityIds.length === 1) {
    return entityIds[0];
  }
  return null;
}

function minutesToWindow(startHHMM, durationHours) {
  const [h, m] = startHHMM.split(':').map(Number);
  const endTotalMinutes = h * 60 + m + Math.max(1, Math.round(durationHours * 60));
  const endH = String(Math.min(23, Math.floor(endTotalMinutes / 60))).padStart(2, '0');
  const endM = String(endTotalMinutes % 60).padStart(2, '0');
  return { start: startHHMM, end: `${endH}:${endM}` };
}

function synthesizeWorkWindowsFromStrategyConstraints(strategyConstraints) {
  const maxBlocksPerDay = Number(strategyConstraints.maxBlocksPerDay) || 4;
  const preferred = Array.isArray(strategyConstraints.preferredDaysOfWeek)
    ? strategyConstraints.preferredDaysOfWeek
    : [];
  const activeDows = preferred.length > 0 ? preferred : [1, 2, 3, 4, 5]; // default: weekdays
  const window = minutesToWindow('09:00', maxBlocksPerDay);
  return DAY_KEYS.reduce((acc, day, dow) => {
    acc[day] = activeDows.includes(dow) ? [window] : [];
    return acc;
  }, {});
}

/**
 * @param {object} params
 * @param {object} params.matrix - state.matrix
 * @param {object|null} params.goalContractWorkWindows - cycle.goalContract.workWindows
 * @param {object|null} params.availabilityPolicyWorkWindows - state.availabilityPolicy.workWindows
 * @param {object|null} params.strategyConstraints - cycle.strategy.constraints
 * @returns {{ entityId: string, row: object } | null}
 */
export function seedCapacityFromLegacyConstraints({
  matrix = {},
  goalContractWorkWindows = null,
  availabilityPolicyWorkWindows = null,
  strategyConstraints = null,
} = {}) {
  const entityId = resolveActingEntityId(matrix);
  if (!entityId) {return null;}

  const capacityById = matrix.capacityById || {};
  const alreadySeeded = Object.values(capacityById).some((row) => row && row.owningEntityId === entityId);
  if (alreadySeeded) {return null;}

  let workWindows = null;
  let source = 'carried_forward';

  if (hasAnyWorkWindows(goalContractWorkWindows)) {
    workWindows = goalContractWorkWindows;
  } else if (hasAnyWorkWindows(availabilityPolicyWorkWindows)) {
    workWindows = availabilityPolicyWorkWindows;
  } else if (strategyConstraints && (strategyConstraints.maxBlocksPerDay || strategyConstraints.maxBlocksPerWeek)) {
    workWindows = synthesizeWorkWindowsFromStrategyConstraints(strategyConstraints);
  }

  if (!workWindows) {
    return null; // nothing to carry forward — leave unseeded rather than inventing data
  }

  const entities = matrix.entitiesById || {};
  const entityName = entities[entityId]?.name || null;

  const row = {
    id: `capacity-${entityId}`,
    name: entityName ? `${entityName} Capacity` : 'Capacity',
    owningEntityId: entityId,
    workWindows,
    blackoutDayKeys: Array.isArray(strategyConstraints?.blackoutDayKeys) ? strategyConstraints.blackoutDayKeys : [],
    maxBlocksPerDay: Number(strategyConstraints?.maxBlocksPerDay) || 4,
    maxBlocksPerWeek: Number(strategyConstraints?.maxBlocksPerWeek) || 16,
    roleTags: [],
    phase: null,
    reviewStatus: 'DRAFT',
    source,
  };

  return { entityId, row };
}
