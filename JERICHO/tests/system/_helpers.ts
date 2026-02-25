import { computeDerivedState } from '../../src/state/identityCompute.js';

export const FIXED_DAY = '2026-01-02';

export function buildBaseState(date = FIXED_DAY) {
  return {
    vector: { day: 1, direction: '', stability: 'steady', drift: 'contained', momentum: 'active' },
    lenses: {
      aim: { description: '', horizon: '90d', narrative: '' },
      pattern: { routines: { Body: [], Resources: [], Creation: [], Focus: [] }, dailyTargets: [], defaultMinutes: 30 },
      flow: { streams: [] },
    },
    today: { date, blocks: [], completionRate: 0, driftSignal: 'contained', loadByPractice: {}, practices: [] },
    currentWeek: { weekStart: date, days: [], metrics: {} },
    cycle: [],
    viewDate: date,
    templates: { objectives: {} },
    meta: { version: '1.0.0', onboardingComplete: false },
    recurringPatterns: [],
    executionEvents: [],
    ledger: [],
  };
}

export function historyEntry(cycleId: string, endDayKey: string, completionRate: number, velocity = 45, churn = 15) {
  return {
    cycleId,
    startDayKey: '2025-01-01',
    endDayKey,
    scheduledMinutesTotal: 1000,
    completedMinutesTotal: Math.round(1000 * completionRate),
    completionRate,
    completionVelocityMinPerDay: velocity,
    movedMinutesTotal: 30,
    droppedMinutesTotal: 10,
    churnIndex: churn,
    rescheduleCount: 2,
    overCapDaysCount: 0,
    avgDailyScheduledMin: 100,
    maxDailyScheduledMin: 160,
    depTightCount: 1,
    depWindowBlockedCount: 0,
    milestoneAtRiskCount: 0,
    placementAnchoringMissCount: 1,
    outsideExecutionHorizonMinutes: 120,
    unplacedEstimateMinTotal: 60,
  };
}

export type ScenarioFlags = {
  enableQualityOptimizer?: boolean;
  autoPolicySelection?: boolean;
  enableHistoryPolicySelection?: boolean;
  enableMilestonePacing?: boolean;
  withCapacityCaps?: boolean;
};

export function seedScenario(flags: ScenarioFlags = {}) {
  const base = buildBaseState();
  const withView = computeDerivedState(base, { type: 'SET_VIEW_DATE', date: base.today.date });
  const onboarded = computeDerivedState(withView, {
    type: 'COMPLETE_ONBOARDING',
    onboarding: {
      direction: 'Ship v0',
      goalText: 'Ship v0',
      horizon: '90d',
      narrative: 'determinism harness',
      focusAreas: ['Creation', 'Focus'],
      successDefinition: 'MVP shipped',
    },
  });

  const cycleId = onboarded.activeCycleId;
  const cycle = onboarded.cyclesById[cycleId];
  const startDayKey = onboarded.goalExecutionContract?.startDayKey || FIXED_DAY;
  const actions = Array.from({ length: 24 }, (_, i) => ({
    id: `A${String(i + 1).padStart(4, '0')}`,
    estimateMin: [30, 45, 60, 90][i % 4],
    category: ['FOCUS', 'CREATION', 'ADMIN'][i % 3],
    dependencies: i === 0 ? [] : [`A${String(i).padStart(4, '0')}`],
  }));
  const milestones = [
    {
      milestoneId: 'M01',
      windowStartDayKey: startDayKey,
      windowEndDayKey: startDayKey,
      actionIds: actions.slice(0, 8).map((a) => a.id),
      checkpointActionIds: [],
    },
  ];

  const planDraft = {
    ...onboarded.planDraft,
    autoPolicySelection: flags.autoPolicySelection === true,
    minPolicyHoldDays: 7,
    qualityPolicyId: 'BALANCED',
    enableQualityOptimizer: flags.enableQualityOptimizer === true,
    optimizerMaxIterations: 2,
    optimizerMaxCandidates: 30,
    enableMilestonePacing: flags.enableMilestonePacing === true,
    pacingCadenceMode: 'adaptive',
    enableHistoryPolicySelection: flags.enableHistoryPolicySelection === true,
    historyWindowCycles: 5,
    historyInfluenceStrength: 'standard',
    maxScheduledMinutesPerDay: flags.withCapacityCaps ? 240 : undefined,
    maxScheduledMinutesPerWeek: flags.withCapacityCaps ? 1200 : undefined,
    executionHorizonDays: 30,
    actions,
    milestones,
  };

  const seeded = {
    ...onboarded,
    planDraft,
    historySignalsByCycleId:
      flags.enableHistoryPolicySelection === true
        ? {
            c1: historyEntry('c1', '2025-09-01', 0.45, 42, 20),
            c2: historyEntry('c2', '2025-10-01', 0.44, 41, 21),
            c3: historyEntry('c3', '2025-11-01', 0.43, 40, 22),
            c4: historyEntry('c4', '2025-12-01', 0.42, 39, 23),
            c5: historyEntry('c5', '2025-12-20', 0.41, 38, 24),
          }
        : onboarded.historySignalsByCycleId,
    cyclesById: {
      ...onboarded.cyclesById,
      [cycleId]: {
        ...cycle,
        planDraft,
      },
    },
  };

  return computeDerivedState(seeded, { type: 'SET_CALIBRATION_DAYS', daysPerWeek: 5 });
}

export function rebuildPreview(state: any) {
  return computeDerivedState(state, { type: 'SET_CALIBRATION_DAYS', daysPerWeek: 5 });
}

export function applyDraft(state: any) {
  return computeDerivedState(state, { type: 'APPLY_DRAFT_SCHEDULE' });
}
