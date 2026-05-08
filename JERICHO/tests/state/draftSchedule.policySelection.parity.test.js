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
  };
  const withAuto = {
    ...onboarded,
    planDraft,
    cyclesById: {
      ...onboarded.cyclesById,
      [cycleId]: {
        ...cycle,
        planDraft,
      },
    },
  };
  return computeDerivedState(withAuto, { type: 'SET_CALIBRATION_DAYS', daysPerWeek: 5 });
}

describe('draft schedule policy selection parity', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(`${FIXED_DAY}T12:00:00.000Z`));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('keeps preview/apply policy parity and deterministic reasons', () => {
    const previewed = seedState();
    const previewPolicy = previewed.planPreview?.qualityPolicyIdUsed;
    const previewReasons = previewed.planPreview?.policySelectionReasonCodes;

    const applied = computeDerivedState(previewed, { type: 'APPLY_DRAFT_SCHEDULE' });
    expect(applied.qualityPolicyIdApplied).toBe(previewPolicy);
    expect(applied.policySelectionReasonCodesApplied).toEqual(previewReasons);
    expect(applied.policySelectionParity).toBe(true);

    const second = seedState();
    expect(second.planPreview?.qualityPolicyIdUsed).toBe(previewPolicy);
    expect(second.planPreview?.policySelectionReasonCodes).toEqual(previewReasons);
  });
});
