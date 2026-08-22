import { describe, expect, it } from 'vitest';
import { computeDerivedState } from '../identityCompute.js';

const FIXED_DAY = '2026-03-12';

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
    meta: { version: '1.0.0', onboardingComplete: true },
    recurringPatterns: [],
    lastSessionChange: null,
    nextSuggestion: null,
    executionEvents: [],
    ledger: [],
    appTime: {
      timeZone: 'UTC',
      nowISO: `${FIXED_DAY}T12:00:00.000Z`,
      activeDayKey: FIXED_DAY,
        timeIsPinned: true,
      isFollowingNow: true,
        timeIsPinned: true,
    },
    activeCycleId: 'cycle-1',
    cyclesById: {
      'cycle-1': {
        id: 'cycle-1',
        planStatus: 'generating',
        planGenerationSource: 'LLM',
        goalContract: {
          executionType: 'Fundraising',
          goalLabel: 'Raise 25k',
          startDayKey: FIXED_DAY,
          deadline: { dayKey: '2026-06-30' },
        },
      },
    },
  };
}

describe('missing goal draft recovery routing', () => {
  it('stores non-terminal recovery metadata and prefills intake context', () => {
    const base = buildBaseState();
    const next = computeDerivedState(base, {
      type: 'GENERATE_PLAN_FAILED',
      payload: {
        cycleId: 'cycle-1',
        error: {
          code: 'MISSING_GOAL_DRAFT',
          reason: 'goalDraftV2 missing',
        },
        recovery: {
          required: 'GOAL_DRAFT_CONTEXT',
          route: 'STRUCTURE_GATE_2',
          prefill: {
            goalText: 'Raise 25k in sponsorship money',
            executionType: 'Fundraising',
            startDate: FIXED_DAY,
            deadline: '2026-06-30',
            goalDraftV2: {
              goalLabel: 'Raise 25k in sponsorship money',
              executionType: 'Fundraising',
            },
          },
        },
      },
    });

    expect(next.lastPlanError?.code).toBe('MISSING_GOAL_DRAFT');
    expect(next.planRecovery).toMatchObject({
      required: 'GOAL_DRAFT_CONTEXT',
      route: 'STRUCTURE_GATE_2',
      sourceErrorCode: 'MISSING_GOAL_DRAFT',
    });
    expect(next.pendingOnboardingInputs?.goalText).toBe('Raise 25k in sponsorship money');
    expect(next.pendingOnboardingInputs?.goalDraftV2?.goalLabel).toBe('Raise 25k in sponsorship money');

    const cleared = computeDerivedState(next, { type: 'CLEAR_PLAN_RECOVERY' });
    expect(cleared.planRecovery).toBeNull();
  });

  it('stores intake recovery metadata when generation is blocked by ambiguous boundary scope', () => {
    const base = buildBaseState();
    const next = computeDerivedState(base, {
      type: 'GENERATE_PLAN_FAILED',
      payload: {
        cycleId: 'cycle-1',
        error: {
          code: 'INTAKE_BOUNDARY_AMBIGUOUS',
          reason: 'What counts as complete by the deadline?',
        },
        recovery: {
          required: 'INTAKE_SCOPE_RESOLUTION',
          route: 'STRUCTURE_INTAKE',
          prefill: {
            goalContract: {
              goalId: 'goal-1',
              goalIntakeContract: {
                completionBoundaryStatus: 'ambiguous',
                requiredContextQuestions: [
                  {
                    id: 'podcast-completion-boundary',
                    domain: 'podcast',
                    prompt: 'What counts as complete by the deadline?',
                    field: 'completionBoundary',
                    answerType: 'single_select',
                    options: ['recorded', 'edited', 'publish_ready', 'published'],
                    required: true,
                    reasonCode: 'COMPLETION_BOUNDARY_REQUIRED',
                  },
                ],
              },
            },
          },
        },
      },
    });

    expect(next.lastPlanError?.code).toBe('INTAKE_BOUNDARY_AMBIGUOUS');
    expect(next.planRecovery).toMatchObject({
      required: 'INTAKE_SCOPE_RESOLUTION',
      route: 'STRUCTURE_INTAKE',
      sourceErrorCode: 'INTAKE_BOUNDARY_AMBIGUOUS',
    });
    expect(next.pendingOnboardingInputs?.goalContract?.goalIntakeContract?.completionBoundaryStatus).toBe('ambiguous');
    expect(
      next.pendingOnboardingInputs?.goalContract?.goalIntakeContract?.requiredContextQuestions?.[0]?.prompt
    ).toMatch(/what counts as complete/i);
  });
});
