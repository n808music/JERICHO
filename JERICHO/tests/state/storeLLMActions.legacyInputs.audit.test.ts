import { describe, expect, it } from 'vitest';

import { computeDerivedState } from '../../src/state/identityCompute.js';
import { createGeneratePlanWithLLM } from '../../src/state/storeLLMActions.ts';

const cycleId = 'cycle-legacy-audit-1';
const goalId = 'goal-legacy-audit-1';
const startDayKey = '2026-04-21';
const deadlineDayKey = '2027-03-31';
const goalText = 'Build a caffeinated gum brand and take it to first real sales';
const verificationCriteria =
  'Sellable gum offer, compliant claims, sample path, checkout path, and first-sales evidence are complete.';

const planningAnswers = {
  executionContext: 'part_time',
  weeklyHoursAvailable: 20,
  capitalAvailable: 45000,
  hardDeadline: deadlineDayKey,
  existingDomainRelationships: [],
  formulaPathway: 'base_modification',
  targetCategory: 'food_product',
  distributionChannel: 'direct_to_consumer',
};

function buildState(options: { includeLegacySacrifice?: boolean; includeLegacyCasualSteps?: boolean } = {}) {
  const legacySacrifice = options.includeLegacySacrifice
    ? {
        whatIsGivenUp: 'Evening leisure time',
        duration: 'Until launch readiness',
        quantifiedImpact: '10 hours/week',
        rationale: 'Legacy admission framing',
      }
    : undefined;

  const legacyCasualSteps = options.includeLegacyCasualSteps
    ? 'I work best in the morning and like casual, low-pressure next steps.'
    : undefined;

  return {
    vector: { day: 1, direction: goalText, stability: 'steady', drift: 'contained', momentum: 'active' },
    lenses: {
      aim: { description: goalText, horizon: '90d', narrative: '' },
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
      maxBlocksPerDay: 6,
      maxBlocksPerWeek: 30,
    },
    activeCycleId: cycleId,
    cyclesById: {
      [cycleId]: {
        id: cycleId,
        status: 'active',
        goalDraftV2: {
          goalText,
          goalLabel: goalText,
          executionType: 'BrandLaunch',
          startDate: startDayKey,
          answeredContext: planningAnswers,
          casualSteps: legacyCasualSteps,
        },
        goalContract: {
          goalId,
          goalText,
          goalLabel: goalText,
          executionType: 'BrandLaunch',
          startDayKey,
          temporalBinding: { startDayKey },
          deadline: { dayKey: deadlineDayKey },
          terminalOutcome: {
            text: goalText,
            verificationCriteria,
          },
          workWindows: {},
          target: {
            count: 1,
            unit: 'first real sales system',
            definitionOfDone: verificationCriteria,
          },
          sacrifice: legacySacrifice,
        },
      },
    },
    pendingOnboardingInputs: {
      goalDraftV2: {
        goalText,
        goalLabel: goalText,
        executionType: 'BrandLaunch',
        startDate: startDayKey,
        casualSteps: legacyCasualSteps,
      },
      goalText,
      executionType: 'BrandLaunch',
      startDate: startDayKey,
      deadline: deadlineDayKey,
      definitionOfDone: verificationCriteria,
      daysPerWeek: '5',
      minutesPerDay: '90',
      answeredContext: {
        ...planningAnswers,
        customer: 'Consumers seeking a caffeinated gum product for alertness and convenience.',
        offer: 'A sellable caffeinated gum offer with packaging, sourcing, checkout, and fulfillment path.',
        proof: 'First real sales and evidence review by the deadline.',
      },
      sacrifice: legacySacrifice,
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
      goalText,
      goalLabel: goalText,
      executionType: 'BrandLaunch',
      startDayKey,
      deadline: { dayKey: deadlineDayKey },
      terminalOutcome: {
        text: goalText,
        verificationCriteria,
      },
      sacrifice: legacySacrifice,
    },
    probabilityByGoal: {},
    feasibilityByGoal: {},
    goalWorkById: {},
    planRecovery: null,
    lastPlanError: null,
    profileLearning: {},
    directiveEligibilityByGoal: { [goalId]: { eligible: true } },
    goalDirective: { goalId, directiveId: 'dir-legacy-audit-1' },
  };
}

async function generateState(options: { includeLegacySacrifice?: boolean; includeLegacyCasualSteps?: boolean } = {}) {
  let state = buildState(options);
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
  return state;
}

function summarizeState(state: any) {
  const cycle = state.cyclesById?.[cycleId] || {};
  return {
    feasibility: cycle.goalContract?.prePlanFeasibility,
    planningIntake: cycle.goalContract?.planningIntake,
    actionGraph: (cycle.llmActionGraph?.actions || []).map((action: any) => ({
      id: action.id,
      title: action.title,
      dependencies: action.dependencies || [],
      dependencyDetails: action.dependencyDetails || [],
    })),
    proposedBlocks: (state.proposedBlocks || []).map((block: any) => ({
      actionId: block.actionId,
      title: block.title,
      startISO: block.startISO,
      endISO: block.endISO,
      placementBasis: block.placementBasis,
      directDependencyIds: block.directDependencyIds || [],
      transitiveDependencyIds: block.transitiveDependencyIds || [],
    })),
  };
}

describe('legacy planning input audit', () => {
  it('does not materially change planner output when casual steps and sacrifice differ but structured intake is identical', async () => {
    const baseState = await generateState();
    const legacyState = await generateState({
      includeLegacySacrifice: true,
      includeLegacyCasualSteps: true,
    });

    expect(summarizeState(legacyState)).toEqual(summarizeState(baseState));
  });

  it('resolves goalDraftV2 from the mirrored legacy goalExecutionContract path when the cycle is missing it', async () => {
    let state = buildState({
      includeLegacySacrifice: true,
      includeLegacyCasualSteps: true,
    });

    state.cyclesById[cycleId].goalDraftV2 = null;
    state.cyclesById[cycleId].goalContract.goalDraftV2 = null;
    state.cyclesById[cycleId].contract = {
      goalId,
      goalText,
      goalLabel: goalText,
      executionType: 'BrandLaunch',
      startDayKey,
      deadline: { dayKey: deadlineDayKey },
      terminalOutcome: {
        text: goalText,
        verificationCriteria,
      },
    };
    state.goalExecutionContract.goalDraftV2 = {
      goalText,
      goalLabel: goalText,
      executionType: 'BrandLaunch',
      startDate: startDayKey,
      answeredContext: planningAnswers,
      casualSteps: 'I work best in the morning and like casual, low-pressure next steps.',
    };

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

    expect(state.lastPlanError?.code).not.toBe('MISSING_GOAL_DRAFT');
    expect(state.cyclesById[cycleId].goalDraftV2).toBeTruthy();
    expect(state.cyclesById[cycleId].goalContract.goalDraftV2).toBeTruthy();
    expect(state.goalExecutionContract.goalDraftV2).toBeTruthy();
  });
});
