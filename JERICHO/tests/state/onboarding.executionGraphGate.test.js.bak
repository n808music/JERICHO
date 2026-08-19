import { describe, expect, it } from 'vitest';
import { computeDerivedState } from '../../src/state/identityCompute.js';

const FIXED_DAY = '2026-01-08';

function buildBaseState() {
  return {
    vector: { day: 1, direction: '', stability: 'steady', drift: 'contained', momentum: 'active' },
    lenses: {
      aim: { description: '', horizon: '90d', narrative: '' },
      pattern: { routines: { Body: [], Resources: [], Creation: [], Focus: [] }, dailyTargets: [], defaultMinutes: 30 },
      flow: { streams: [] },
    },
    today: {
      date: FIXED_DAY,
      blocks: [],
      completionRate: 0,
      driftSignal: 'contained',
      loadByPractice: {},
      practices: [],
    },
    currentWeek: { weekStart: FIXED_DAY, days: [], metrics: {} },
    cycle: [],
    viewDate: FIXED_DAY,
    templates: { objectives: {} },
    lastAdaptedDate: null,
    stability: { headline: '', actionLine: '' },
    meta: { version: '1.0.0', onboardingComplete: false },
    recurringPatterns: [],
    lastSessionChange: null,
    nextSuggestion: null,
    executionEvents: [],
    ledger: [],
    appTime: {
      timeZone: 'UTC',
      nowISO: `${FIXED_DAY}T12:00:00.000Z`,
      activeDayKey: FIXED_DAY,
      isFollowingNow: true,
    },
  };
}

function buildOnboarding() {
  return {
    direction: 'Launch a waitlist',
    goalText: 'Launch a waitlist for new product',
    horizon: '30d',
    narrative: '',
    focusAreas: ['Creation'],
    successDefinition: 'Waitlist live',
    minimumDaysPerWeek: 4,
  };
}

describe('onboarding execution graph gate', () => {
  it('supports gate-1 completion without creating an active cycle', () => {
    const next = computeDerivedState(buildBaseState(), {
      type: 'FINISH_ONBOARDING_GATE',
      onboarding: {
        goalText: 'Raise 25k in sponsorship commitments',
        executionType: 'Fundraising',
        goalDraftV2: {
          executionType: 'Fundraising',
          goalLabel: 'Raise 25k in sponsorship commitments',
          goalText: 'Raise 25k in sponsorship commitments',
        },
      },
    });
    expect(next.meta?.onboardingComplete).toBe(true);
    expect(next.activeCycleId).toBeFalsy();
    expect(next.pendingOnboardingInputs?.goalDraftV2?.executionType).toBe('Fundraising');
  });

  it('persists gate-2 contract edits in pending onboarding inputs before admission', () => {
    const gateOneState = computeDerivedState(buildBaseState(), {
      type: 'FINISH_ONBOARDING_GATE',
      onboarding: {
        goalText: 'Raise 25k in sponsorship commitments',
        executionType: 'Fundraising',
        goalDraftV2: {
          executionType: 'Fundraising',
          goalLabel: 'Raise 25k in sponsorship commitments',
          goalText: 'Raise 25k in sponsorship commitments',
        },
      },
    });

    const admissionDraft = {
      executionType: 'Fundraising',
      terminalOutcome: {
        text: 'Raise 25k in sponsorship commitments',
        verificationCriteria: '25k committed',
        isConcrete: true,
      },
      deadline: {
        dayKey: '2026-04-15',
        isHardDeadline: true,
      },
      workWindows: {
        mon: [{ start: '09:00', end: '11:00' }],
        tue: [],
        wed: [],
        thu: [],
        fri: [],
        sat: [],
        sun: [],
      },
    };

    const next = computeDerivedState(gateOneState, {
      type: 'UPDATE_PENDING_ONBOARDING_INPUTS',
      onboarding: {
        ...(gateOneState.pendingOnboardingInputs || {}),
        goalContract: admissionDraft,
      },
    });

    expect(next.pendingOnboardingInputs?.goalDraftV2?.executionType).toBe('Fundraising');
    expect(next.pendingOnboardingInputs?.goalContract?.deadline?.dayKey).toBe('2026-04-15');
    expect(next.pendingOnboardingInputs?.goalContract?.workWindows?.mon).toEqual([{ start: '09:00', end: '11:00' }]);
  });

  it('maps CREATE_GOAL alias and provisions a concrete action graph', () => {
    const next = computeDerivedState(buildBaseState(), {
      type: 'CREATE_GOAL',
      payload: {
        ...buildOnboarding(),
        executionType: 'Fundraising',
      },
    });
    const cycleId = next.activeCycleId;
    expect(cycleId).toBeTruthy();
    expect(next.meta?.onboardingComplete).toBe(true);
    expect((next.deliverablesByCycleId?.[cycleId]?.deliverables || []).length).toBeGreaterThan(0);
    expect((next.cyclesById?.[cycleId]?.actions || []).length).toBeGreaterThan(0);
    expect(next.lastPlanError?.code).not.toBe('ACTION_GRAPH_MISSING');
  });

  it('keeps COMPLETE_ONBOARDING deterministic: deliverables and actions both exist', () => {
    const next = computeDerivedState(buildBaseState(), {
      type: 'COMPLETE_ONBOARDING',
      onboarding: {
        ...buildOnboarding(),
        executionType: 'Fundraising',
      },
    });
    const cycleId = next.activeCycleId;
    expect(cycleId).toBeTruthy();
    const deliverables = next.deliverablesByCycleId?.[cycleId]?.deliverables || [];
    const actions = next.cyclesById?.[cycleId]?.actions || [];
    expect(deliverables.length).toBeGreaterThan(0);
    expect(actions.length).toBeGreaterThan(0);
    expect(next.lastPlanError?.code).not.toBe('ACTION_GRAPH_MISSING');
  });
});
