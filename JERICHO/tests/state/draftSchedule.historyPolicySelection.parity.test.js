import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { computeDerivedState } from '../../src/state/identityCompute.js';

const FIXED_DAY = '2026-01-02';

function buildBaseState(date = FIXED_DAY) {
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

function historyEntry(cycleId, endDayKey, completionRate, velocity, churn) {
  return {
    cycleId,
    startDayKey: '2025-01-01',
    endDayKey,
    scheduledMinutesTotal: 1000,
    completedMinutesTotal: Math.round(1000 * completionRate),
    completionRate,
    completionVelocityMinPerDay: velocity,
    movedMinutesTotal: 40,
    droppedMinutesTotal: 20,
    churnIndex: churn,
    rescheduleCount: 3,
    overCapDaysCount: 0,
    avgDailyScheduledMin: 100,
    maxDailyScheduledMin: 160,
    depTightCount: 1,
    depWindowBlockedCount: 0,
    milestoneAtRiskCount: 0,
    placementAnchoringMissCount: 0,
    outsideExecutionHorizonMinutes: 120,
    unplacedEstimateMinTotal: 60,
  };
}

function seedState() {
  const base = buildBaseState();
  const seeded = computeDerivedState(base, { type: 'SET_VIEW_DATE', date: base.today.date });
  const onboarded = computeDerivedState(seeded, {
    type: 'COMPLETE_ONBOARDING',
    onboarding: {
      direction: 'Ship v0',
      goalText: 'Ship v0',
      horizon: '30d',
      narrative: '',
      focusAreas: ['Creation', 'Focus'],
      successDefinition: 'MVP shipped',
    },
  });
  const cycleId = onboarded.activeCycleId;
  const cycle = onboarded.cyclesById[cycleId];
  const planDraft = {
    ...onboarded.planDraft,
    autoPolicySelection: true,
    minPolicyHoldDays: 7,
    qualityPolicyId: 'BALANCED',
    enableHistoryPolicySelection: true,
    historyWindowCycles: 5,
    historyInfluenceStrength: 'standard',
  };
  const withHistory = {
    ...onboarded,
    historySignalsByCycleId: {
      c1: historyEntry('c1', '2025-09-01', 0.4, 45, 12),
      c2: historyEntry('c2', '2025-10-01', 0.42, 46, 13),
      c3: historyEntry('c3', '2025-11-01', 0.41, 44, 14),
      c4: historyEntry('c4', '2025-12-01', 0.39, 43, 15),
      c5: historyEntry('c5', '2025-12-20', 0.38, 42, 16),
    },
    planDraft,
    cyclesById: {
      ...onboarded.cyclesById,
      [cycleId]: {
        ...cycle,
        planDraft,
      },
    },
  };
  return computeDerivedState(withHistory, { type: 'SET_CALIBRATION_DAYS', daysPerWeek: 5 });
}

describe('draft schedule history policy selection parity', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(`${FIXED_DAY}T12:00:00.000Z`));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('keeps preview/apply history-informed policy parity and deterministic reasons', () => {
    const previewed = seedState();
    const previewPolicy = previewed.planPreview?.qualityPolicyIdUsed;
    const previewReasons = previewed.planPreview?.policySelectionReasonCodes;
    const previewHistorySnapshot = previewed.planPreview?.historyProfileSnapshotUsed;

    const applied = computeDerivedState(previewed, { type: 'APPLY_DRAFT_SCHEDULE' });
    expect(applied.qualityPolicyIdApplied).toBe(previewPolicy);
    expect(applied.policySelectionReasonCodesApplied).toEqual(previewReasons);
    expect(applied.policySelectionParity).toBe(true);
    expect(applied.historyProfileSnapshotUsedApplied).toEqual(previewHistorySnapshot);

    const second = seedState();
    expect(second.planPreview?.qualityPolicyIdUsed).toBe(previewPolicy);
    expect(second.planPreview?.policySelectionReasonCodes).toEqual(previewReasons);
    expect(second.planPreview?.historyProfileSnapshotUsed).toEqual(previewHistorySnapshot);
  });
});
