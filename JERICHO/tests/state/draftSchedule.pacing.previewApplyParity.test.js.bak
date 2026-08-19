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

  const actions = Array.from({ length: 12 }, (_, i) => ({
    id: `A${String(i + 1).padStart(4, '0')}`,
    estimateMin: 45,
    category: i % 2 === 0 ? 'FOCUS' : 'CREATION',
    dependencies: i === 0 ? [] : [`A${String(i).padStart(4, '0')}`],
  }));
  const milestones = [
    {
      milestoneId: 'M01',
      windowStartDayKey: '2026-01-03',
      windowEndDayKey: '2026-03-31',
      actionIds: actions.map((a) => a.id),
    },
  ];

  const cycleId = onboarded.activeCycleId;
  const cycle = onboarded.cyclesById[cycleId];
  const planDraft = {
    ...onboarded.planDraft,
    enableMilestonePacing: true,
    pacingCadenceMode: 'adaptive',
    actions,
    milestones,
  };
  const withPlan = {
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
  const firstId = withPlan.suggestedBlocks?.[0]?.id;
  return computeDerivedState(withPlan, {
    type: 'REJECT_SUGGESTED_BLOCK',
    proposalId: firstId,
    reason: 'parity_probe',
  });
}

describe('draft schedule pacing preview/apply parity', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(`${FIXED_DAY}T12:00:00.000Z`));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('keeps checkpoint IDs/counts parity across preview/apply', () => {
    const previewed = seedState();
    const previewCount = Number(previewed.planPreview?.pacingInjectedCheckpointCount || 0);
    const previewMap = previewed.planPreview?.pacingInjectedByMilestone || {};
    const applied = computeDerivedState(previewed, { type: 'APPLY_DRAFT_SCHEDULE' });

    expect(applied.pacingInjectedCheckpointCountApplied).toBe(previewCount);
    expect(applied.pacingInjectedByMilestoneApplied).toEqual(previewMap);
    expect(applied.pacingParity).toBe(true);
    expect(applied.policySelectionParity).toBe(true);
    expect(applied.scoreParity).toBe(true);
  });
});
