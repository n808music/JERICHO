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
  return computeDerivedState(seeded, {
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
}

describe('draft schedule scoring parity', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(`${FIXED_DAY}T12:00:00.000Z`));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('keeps preview/apply score parity', () => {
    const seeded = seedState();
    const previewPolicy = seeded.planPreview?.qualityPolicyIdUsed;
    const previewScore = seeded.planPreview?.qualityScoreBaseline;
    const applied = computeDerivedState(seeded, { type: 'APPLY_DRAFT_SCHEDULE' });
    expect(applied.qualityPolicyIdApplied).toBe(previewPolicy);
    expect(applied.policySelectionParity).toBe(true);
    expect(Number.isFinite(previewScore)).toBe(true);
  });
});
