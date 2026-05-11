import { describe, expect, it } from 'vitest';

import { computeDerivedState } from '../../src/state/identityCompute.js';
import { identityReducer } from '../../src/state/identityStore.js';
import { createGeneratePlanWithLLM } from '../../src/state/storeLLMActions.ts';

const cycleId = 'cycle-gum-loop-1';
const goalId = 'goal-gum-loop-1';
const startDayKey = '2026-04-21';
const deadlineDayKey = '2027-07-30';

const liveGoalText =
  'Launch a caffeinated energy gum brand to first real sales in 15 months with product concept validation, branding, packaging, sourcing, checkout setup, launch execution, and first sales proof completed.';

const verificationCriteria = 'Complete the admitted goal as defined in the intake review';

const planningAnswers = {
  goalClassification: 'regulated_physical_consumable',
  goalDescription: 'Launch a caffeinated energy gum brand',
  targetCategory: 'functional_food',
  distributionChannel: 'marketplace',
  formulaPathway: 'white_label',
  capitalAvailable: 0,
  capitalCommitmentConfidence: 'uncertain',
  capitalAcquisitionRequired: true,
  capitalAcquisitionAssets: {
    existingAudience: {
      spotifyListeners: 0,
      instagramFollowers: 1000,
      audienceRelationship: 'early_social',
      influencerNetwork: false,
      entrepreneurNetwork: false,
    },
    existingRevenue: null,
  },
  weeklyHoursAvailable: 20,
  executionContext: 'part_time',
  employmentStatus: 'employed',
  employmentChangeRisk: false,
  hardDeadline: null,
  recommendedTimeline: '15_months',
  timelineSensitivity: 'marketing_window_protection',
  existingDomainRelationships: [],
  industryExperience: 'none',
  location: {
    state: 'IL',
    country: 'US',
  },
  stopCondition: 'unknown',
  personalProfile: {
    resourceConstraint: 'high',
    ambitionLevel: 'high',
    directionNeed: 'high',
    selfAwareness: 'high',
    realityCheckTolerance: 'high',
  },
};

function buildState() {
  return {
    vector: { day: 1, direction: liveGoalText, stability: 'steady', drift: 'contained', momentum: 'active' },
    lenses: {
      aim: { description: liveGoalText, horizon: '90d', narrative: '' },
      pattern: { routines: { Body: [], Resources: [], Creation: [], Focus: [] }, dailyTargets: [], defaultMinutes: 30 },
      flow: { streams: [] },
    },
    today: {
      date: startDayKey,
      blocks: [],
      completionRate: 0,
      driftSignal: 'contained',
      loadByPractice: {},
      practices: [],
    },
    currentWeek: { weekStart: startDayKey, days: [], metrics: {} },
    cycle: [],
    viewDate: startDayKey,
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
      nowISO: `${startDayKey}T12:00:00.000Z`,
      activeDayKey: startDayKey,
      isFollowingNow: true,
    },
    constraints: {
      maxBlocksPerDay: 4,
      maxBlocksPerWeek: 20,
    },
    activeCycleId: cycleId,
    cyclesById: {
      [cycleId]: {
        id: cycleId,
        status: 'active',
        goalDraftV2: {
          goalText: liveGoalText,
          goalLabel: liveGoalText,
          executionType: 'BrandLaunch',
          startDate: startDayKey,
          answeredContext: planningAnswers,
        },
        goalContract: {
          goalId,
          goalText: liveGoalText,
          goalLabel: liveGoalText,
          executionType: 'BrandLaunch',
          startDayKey,
          temporalBinding: { startDayKey },
          deadline: { dayKey: deadlineDayKey },
          terminalOutcome: {
            text: liveGoalText,
            verificationCriteria,
          },
          workWindows: {
            mon: [{ start: '09:00', end: '13:00' }],
            tue: [{ start: '09:00', end: '13:00' }],
            wed: [{ start: '09:00', end: '13:00' }],
            thu: [{ start: '09:00', end: '13:00' }],
            fri: [{ start: '09:00', end: '13:00' }],
            sat: [],
            sun: [],
          },
          planningIntake: planningAnswers,
          target: {
            count: 1,
            unit: 'first real sales system',
            definitionOfDone: verificationCriteria,
          },
        },
      },
    },
    pendingOnboardingInputs: {
      goalDraftV2: {
        goalText: liveGoalText,
        goalLabel: liveGoalText,
        executionType: 'BrandLaunch',
        startDate: startDayKey,
        answeredContext: planningAnswers,
      },
      goalText: liveGoalText,
      executionType: 'BrandLaunch',
      startDate: startDayKey,
      deadline: deadlineDayKey,
      definitionOfDone: verificationCriteria,
      daysPerWeek: '5',
      minutesPerDay: '240',
      answeredContext: {
        ...planningAnswers,
        customer: 'Consumers seeking a caffeinated gum product for alertness and convenience.',
        offer: 'A sellable caffeinated gum offer with packaging, sourcing, checkout, and fulfillment path.',
        proof: 'First sales proof completed.',
      },
    },
    proposedBlocks: [],
    proposedBlocksByCycleId: {},
    suggestedBlocks: [],
    suggestionEvents: [],
    deliverablesByCycleId: {},
    goalAdmissionByGoal: {
      [goalId]: {
        status: 'ADMITTED',
        reasonCodes: [],
        admittedAtISO: `${startDayKey}T12:00:00.000Z`,
      },
    },
    goalExecutionContract: {
      goalId,
      goalText: liveGoalText,
      goalLabel: liveGoalText,
      executionType: 'BrandLaunch',
      startDayKey,
      deadline: { dayKey: deadlineDayKey },
      terminalOutcome: {
        text: liveGoalText,
        verificationCriteria,
      },
      workWindows: {
        mon: [{ start: '09:00', end: '13:00' }],
        tue: [{ start: '09:00', end: '13:00' }],
        wed: [{ start: '09:00', end: '13:00' }],
        thu: [{ start: '09:00', end: '13:00' }],
        fri: [{ start: '09:00', end: '13:00' }],
        sat: [],
        sun: [],
      },
      workWindowsSource: 'user_defined',
      constraintsStatus: 'approved',
      capacityValidation: {
        status: 'approved',
        availableWeeklyMinutes: 1200,
        requiredWeeklyMinutes: 450,
        gapWeeklyMinutes: 0,
        mitigationSuggestions: [],
        proposedBlockCount: 20,
      },
    },
    availabilityPolicy: {
      workWindows: {
        mon: [{ start: '09:00', end: '13:00' }],
        tue: [{ start: '09:00', end: '13:00' }],
        wed: [{ start: '09:00', end: '13:00' }],
        thu: [{ start: '09:00', end: '13:00' }],
        fri: [{ start: '09:00', end: '13:00' }],
        sat: [],
        sun: [],
      },
      constraintsStatus: 'approved',
      workWindowsSource: 'user_defined',
      capacityValidation: {
        status: 'approved',
        availableWeeklyMinutes: 1200,
        requiredWeeklyMinutes: 450,
        gapWeeklyMinutes: 0,
        mitigationSuggestions: [],
        proposedBlockCount: 20,
      },
      availableWeeklyMinutes: 1200,
    },
    probabilityByGoal: {},
    feasibilityByGoal: {},
    goalWorkById: {},
    planRecovery: null,
    lastPlanError: null,
    profileLearning: {},
    directiveEligibilityByGoal: { [goalId]: { eligible: true } },
    goalDirective: { goalId, directiveId: 'dir-gum-loop-1' },
  };
}

describe('jericho gum loop e2e regression', () => {
  it('freezes the first complete loop from initial feasibility through first execution evidence', async () => {
    let state = buildState();
    const store = {
      getState: () => state,
      dispatch: (action: any) => {
        state = computeDerivedState(state as any, action as any);
      },
      generatePlan: (payload?: any) => {
        state = computeDerivedState(state as any, { type: 'GENERATE_PLAN', payload } as any);
      },
      getAnthropicApiKey: () => 'dev-mock-key',
    };

    const generatePlanWithLLM = createGeneratePlanWithLLM(store as any);
    await generatePlanWithLLM({ cycleId, anchorDayKey: startDayKey });

    const applied = computeDerivedState(state as any, {
      type: 'APPLY_DRAFT_SCHEDULE',
      payload: { cycleId },
    } as any);
    const prePolicy = applied.goalPolicyByGoalId?.[goalId];
    const preShotClock = applied.systemShotClockByGoal?.[goalId];
    const appliedReviewBlock = (applied.cyclesById?.[cycleId]?.scheduleReviewBlocks || []).find(
      (block: any) => block?.goalId === goalId
    );

    expect(prePolicy?.feasibility?.state).not.toBe('withheld');
    expect(prePolicy?.feasibility?.percent).not.toBeNull();
    expect(prePolicy?.feasibility?.score).not.toBeNull();
    expect(prePolicy?.livePos?.state).toBe('withheld');
    expect(preShotClock?.paceState).toBe('insufficient_evidence');
    expect(preShotClock?.completionRatio).toBe(0);
    expect(appliedReviewBlock).toBeDefined();

    const fauxCompleted = computeDerivedState(
      {
        ...applied,
        blockStore: {
          ...(applied.blockStore || {}),
          blocks: {
            ...(applied.blockStore?.blocks || {}),
            [appliedReviewBlock.id]: {
              ...appliedReviewBlock,
              status: 'completed',
            },
          },
        },
      } as any,
      { type: 'NO_OP' } as any
    );
    expect(fauxCompleted.goalPolicyByGoalId?.[goalId]?.livePos?.state).toBe('withheld');

    const activated = computeDerivedState(applied as any, {
      type: 'ACTIVATE_SCHEDULE',
      payload: { cycleId },
    } as any);

    const todayBlock = (activated.today?.blocks || []).find(
      (block: any) => block?.goalId === goalId && block?.cycleId === cycleId && block?.status === 'planned'
    );
    expect(todayBlock).toBeDefined();

    const afterComplete = identityReducer(activated as any, { type: 'COMPLETE_BLOCK', id: todayBlock.id });
    const postPolicy = afterComplete.goalPolicyByGoalId?.[goalId];
    const postShotClock = afterComplete.systemShotClockByGoal?.[goalId];
    const correction = afterComplete.executionCorrectionByGoal?.[goalId];
    const completionEvent = (afterComplete.executionEvents || []).find(
      (event: any) => event?.kind === 'complete' && event?.blockId === todayBlock.id
    );

    expect(completionEvent).toBeDefined();
    expect(completionEvent?.goalId).toBe(goalId);
    expect(completionEvent?.cycleId).toBe(cycleId);
    expect(completionEvent?.dateISO).toBe(String(todayBlock.start || '').slice(0, 10));

    expect(postPolicy?.feasibility?.state).toBe(prePolicy?.feasibility?.state);
    expect(postPolicy?.feasibility?.percent).toBe(prePolicy?.feasibility?.percent);
    expect(postPolicy?.feasibility?.score).toBe(prePolicy?.feasibility?.score);

    expect(['provisional', 'available', 'eligible']).toContain(postPolicy?.livePos?.state);
    expect(postPolicy?.livePos?.percent).not.toBeNull();
    expect(postPolicy?.livePos?.scoreValue).not.toBeNull();
    expect(postPolicy?.livePos?.percent).toBeGreaterThanOrEqual(prePolicy?.feasibility?.percent || 0);
    expect(postPolicy?.livePos?.evidenceCount).toBeGreaterThan(0);
    expect(postPolicy?.livePos?.baselineInitialFeasibilityPercent).toBe(prePolicy?.feasibility?.percent);

    expect(postShotClock?.completionRatio).toBeGreaterThan(0);
    expect(postShotClock?.paceState).toBe('on_track');

    expect(correction?.level).toBe('none');
    expect(correction?.correctionState).toBe('on_track');
  });
});
