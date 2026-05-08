/**
 * e2eChain.harness.ts
 *
 * Shared fixture builders for Phase D end-to-end chain validation.
 *
 * All trust-critical fields (familyClass, executionType, qualifying external stages,
 * compositeGrammar) must be set via these builders, not via inline objects.
 * See Phase D fixture invariants FI-01 through FI-05.
 */

import type { MigratedArchetype } from '../../src/state/engine/archetypeLiveTraceEvaluation';

// ─── Archetype → stored executionType ────────────────────────────────────────
//
// FI-01: GenericStructured.TVWriting is derived from contract text by deriveExecutionTypeKey().
// The stored value in goalContract.executionType is 'GenericStructured', not the dotted form.

export function storedExecutionType(archetype: MigratedArchetype): string {
  if (archetype === 'GenericStructured.TVWriting') return 'GenericStructured';
  return archetype;
}

// ─── Family class mapping ─────────────────────────────────────────────────────
//
// FI-02: familyClass must always be set explicitly. Source of truth:
// QUALIFYING_EXTERNAL_STAGES in probabilityScore.ts defines which archetypes are externally mediated.
// All others are internally controlled.

export const FAMILY_CLASS_BY_ARCHETYPE: Record<MigratedArchetype, 'internally_controlled' | 'externally_mediated'> = {
  ProfessionalQualification: 'internally_controlled',
  VentureLaunch: 'internally_controlled',
  'GenericStructured.TVWriting': 'internally_controlled',
  PhysicalTraining: 'internally_controlled',
  CreativeProduction: 'internally_controlled',
  BrandLaunch: 'internally_controlled',
  JobSearchPipeline: 'externally_mediated',
  SalesPipeline: 'externally_mediated',
  Fundraising: 'externally_mediated',
};

// ─── Qualifying external stages ───────────────────────────────────────────────
//
// FI-03: must use the exact stage name from QUALIFYING_EXTERNAL_STAGES in probabilityScore.ts.
// One representative stage per archetype — the first stage that triggers the trust upgrade.

export const QUALIFYING_STAGE_BY_ARCHETYPE: Record<string, string> = {
  JobSearchPipeline: 'recruiter_reply',
  SalesPipeline: 'qualified_response',
  Fundraising: 'investor_reply',
};

// ─── Goal contract builder ────────────────────────────────────────────────────
//
// Builds a minimal goalContract with all trust-critical fields set explicitly.
// FI-01: executionType uses the stored form via storedExecutionType().
// FI-02: familyClass set from FAMILY_CLASS_BY_ARCHETYPE.

export function buildGoalContract(opts: {
  goalId: string;
  archetype: MigratedArchetype;
  startDayKey?: string;
  endDayKey?: string;
  compositeGrammar?: Record<string, unknown>;
}) {
  const { goalId, archetype, startDayKey = '2026-03-12', endDayKey = '2026-06-12', compositeGrammar } = opts;
  return {
    goalId,
    executionType: storedExecutionType(archetype),
    familyClass: FAMILY_CLASS_BY_ARCHETYPE[archetype],
    archetype,
    startDayKey,
    endDayKey,
    deadline: { dayKey: endDayKey },
    // goalText and terminalOutcome.text are required for GenericStructured TVWriting routing.
    // Tests must override these for SC-03 (TVWriting).
    goalText: '',
    ...(compositeGrammar ? { compositeGrammar } : {}),
  };
}

// ─── Governance contract builder ──────────────────────────────────────────────
//
// FI-05: scoreGoalSuccessProbability requires a governance contract with probabilityEnabled: true.

export function buildGovernanceContract(goalId: string) {
  return {
    contractId: `gov-${goalId}`,
    version: 1,
    goalId,
    activeFromISO: '2026-03-01',
    activeUntilISO: '2026-12-31',
    scope: { domainsAllowed: ['Focus'], timeHorizon: 'week', timezone: 'UTC' },
    governance: { probabilityEnabled: true, minEvidenceEvents: 0 },
  };
}

// ─── P.O.S. state builder ─────────────────────────────────────────────────────
//
// Builds the minimal state object for scoreGoalSuccessProbability().
// FI-02: goalContract.familyClass is derived from buildGoalContract() — already set correctly.

export function buildPOSState(opts: {
  goalId: string;
  cycleId: string;
  archetype: MigratedArchetype;
  startDayKey?: string;
  endDayKey?: string;
  executionEvents?: any[];
  externalEvidenceEvents?: any[];
  compositeGrammar?: Record<string, unknown>;
}) {
  const {
    goalId,
    cycleId,
    archetype,
    startDayKey = '2026-03-12',
    endDayKey = '2026-06-12',
    executionEvents = [],
    externalEvidenceEvents = [],
    compositeGrammar,
  } = opts;

  const goalContract = buildGoalContract({ goalId, archetype, startDayKey, endDayKey, compositeGrammar });

  return {
    activeCycleId: cycleId,
    cyclesById: {
      [cycleId]: {
        id: cycleId,
        status: 'active',
        goalContract,
        goalGovernanceContract: buildGovernanceContract(goalId),
      },
    },
    goalAdmissionByGoal: {
      [goalId]: { status: 'ADMITTED', reasonCodes: [], admittedAtISO: `${startDayKey}T12:00:00.000Z` },
    },
    goalWorkById: {
      [goalId]: [{ workItemId: `work-${goalId}-1`, blocksRemaining: 5 }],
    },
    executionEvents,
    externalEvidenceEvents,
    proposedBlocks: [],
    suggestedBlocks: [],
    deliverablesByCycleId: {},
  };
}

// ─── Execution event builder ──────────────────────────────────────────────────
//
// Generates N consecutive days of internal completion evidence.
// Used for P.O.S. Layer 6 tests to produce execution activity without external evidence.

export function buildExecutionEvents(goalId: string, cycleId: string, count: number, startISO = '2026-03-13'): any[] {
  const start = new Date(startISO);
  return Array.from({ length: count }, (_, i) => {
    const d = new Date(start);
    d.setDate(d.getDate() + i);
    return {
      goalId,
      cycleId,
      completed: true,
      kind: 'complete',
      dateISO: d.toISOString().slice(0, 10),
    };
  });
}

// ─── External evidence event builder ─────────────────────────────────────────
//
// FI-03: uses the exact qualifying stage name from QUALIFYING_STAGE_BY_ARCHETYPE.

export function buildExternalEvidenceEvent(
  goalId: string,
  cycleId: string,
  archetype: MigratedArchetype,
  dateISO = '2026-03-20'
): any {
  const stage = QUALIFYING_STAGE_BY_ARCHETYPE[archetype];
  if (!stage) {
    throw new Error(
      `buildExternalEvidenceEvent: archetype '${archetype}' is not externally mediated or has no qualifying stage`
    );
  }
  return {
    goalId,
    cycleId,
    stage,
    dateISO,
    confirmed: true,
    evidenceType: 'external',
  };
}

// ─── Scheduler arg builder ────────────────────────────────────────────────────
//
// Builds the arguments for compileAutoAsanaPlan() from a compileGoalToDeliverables() result.
// FI-05: weeklyWindows must be explicit for hasExplicitWeeklyWindows() to return true.

export function buildSchedulerArgs(opts: {
  goalId: string;
  cycleId: string;
  actions: any[];
  deliverables: any[];
  startDayKey?: string;
  endDayKey?: string;
  nowISO?: string;
}) {
  const {
    goalId,
    cycleId,
    actions,
    deliverables,
    startDayKey = '2026-03-12',
    endDayKey = '2026-06-12',
    nowISO = '2026-03-12T12:00:00.000Z',
  } = opts;

  // Build action ID → deliverable ID map from compiled deliverables.
  const deliverableIdByActionId = new Map<string, string>();
  deliverables.forEach((deliverable) => {
    (deliverable.actionIds || []).forEach((actionId: string) => {
      deliverableIdByActionId.set(actionId, deliverable.id);
    });
  });

  const actionSequence = actions.map((action: any, index: number) => ({
    id: String(action?.id || `action-${index + 1}`),
    title: String(action?.title || `Action ${index + 1}`),
    estimateMin: Number(action?.estimateMin || 60),
    dependencies: Array.isArray(action?.dependencies) ? action.dependencies : [],
    deliverableId: deliverableIdByActionId.get(String(action?.id || '')) || null,
    deliverableTitle: null,
  }));

  const horizonDays = Math.ceil(
    (new Date(endDayKey).getTime() - new Date(startDayKey).getTime()) / (1000 * 60 * 60 * 24)
  );

  return {
    goalId,
    cycleId,
    planProof: {
      workableDaysRemaining: Math.max(horizonDays, 1),
      totalRequiredUnits: actionSequence.length,
      requiredPacePerDay: Math.max(1, actionSequence.length / Math.max(horizonDays, 1)),
      maxPerDay: 6,
      maxPerWeek: 30,
      slackUnits: 0,
      slackRatio: 0,
      intensityRatio: 0.5,
    },
    constraints: {
      timezone: 'UTC',
      maxBlocksPerDay: 6,
      maxBlocksPerWeek: 30,
      weeklyWindows: {
        MON: [{ startHHMM: '08:00', endHHMM: '20:00' }],
        TUE: [{ startHHMM: '08:00', endHHMM: '20:00' }],
        WED: [{ startHHMM: '08:00', endHHMM: '20:00' }],
        THU: [{ startHHMM: '08:00', endHHMM: '20:00' }],
        FRI: [{ startHHMM: '08:00', endHHMM: '20:00' }],
        SAT: [{ startHHMM: '08:00', endHHMM: '20:00' }],
        SUN: [{ startHHMM: '08:00', endHHMM: '20:00' }],
      },
      cycleStartDayKey: startDayKey,
      cycleEndDayKey: endDayKey,
    },
    nowISO,
    horizonDays,
    acceptedBlocks: [],
    actionSequence,
    sessionPlan: [],
  };
}
