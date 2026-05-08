import { describe, expect, it } from 'vitest';

import { computeDerivedState } from '../../src/state/identityCompute.js';
import { createGeneratePlanWithLLM } from '../../src/state/storeLLMActions.ts';
import { buildGoalIntakeContract } from '../../src/domain/goal/GoalIntakeContract.ts';

const cycleId = 'cycle-feasibility-gate-1';
const goalId = 'goal-feasibility-gate-1';
const startDayKey = '2026-06-01';
const deadlineDayKey = '2026-10-01';
const goalText = 'Build a caffeinated gum brand and take it to first real sales';

function buildState(answeredContext: Record<string, unknown>) {
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
          answeredContext,
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
            verificationCriteria:
              'Sellable gum offer, compliant claims, manufacturer sample path, checkout path, and first-sales evidence are complete.',
          },
          workWindows: {},
        },
      },
    },
    pendingOnboardingInputs: {
      goalDraftV2: {
        goalText,
        goalLabel: goalText,
        executionType: 'BrandLaunch',
        startDate: startDayKey,
        answeredContext,
      },
      goalText,
      executionType: 'BrandLaunch',
      startDate: startDayKey,
      deadline: deadlineDayKey,
      answeredContext,
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
      executionType: 'BrandLaunch',
      startDayKey,
      deadline: { dayKey: deadlineDayKey },
    },
    probabilityByGoal: {},
    feasibilityByGoal: {},
    goalWorkById: {},
    planRecovery: null,
    lastPlanError: null,
    profileLearning: {},
  };
}

describe('storeLLMActions pre-plan feasibility gate', () => {
  it('fails before graph generation when regulated consumable capital is below the first gate', async () => {
    let state = buildState({
      executionContext: 'part_time',
      weeklyHoursAvailable: 12,
      capitalAvailable: 1000,
      hardDeadline: deadlineDayKey,
      existingDomainRelationships: [],
      formulaPathway: 'base_modification',
      targetCategory: 'food_product',
      distributionChannel: 'direct_to_consumer',
    });

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
    await generatePlanWithLLM({ cycleId });

    expect(state.lastPlanError?.code).toBe('CAPITAL_CONSTRAINED');
    expect(state.lastPlanError?.reason).toMatch(/capital/i);
    expect(state.planRecovery?.required).toBe('PRE_PLAN_FEASIBILITY_RESOLUTION');
    expect(state.planRecovery?.route).toBe('STRUCTURE_INTAKE');
    expect(state.cyclesById[cycleId]?.llmActionGraph).toBeFalsy();
  });

  it('synthesizes goalDraftV2 from the admitted contract when the cycle lacks one', async () => {
    let state = buildState({
      goalClassification: 'regulated_physical_consumable',
      executionContext: 'full_time',
      weeklyHoursAvailable: 40,
      capitalAvailable: 35000,
      capitalAcquisitionRequired: false,
      hardDeadline: null,
      existingDomainRelationships: [],
      formulaPathway: 'white_label',
      targetCategory: 'functional_food',
      distributionChannel: 'direct_to_consumer',
      capitalCommitmentConfidence: 'confirmed',
    });

    state.cyclesById[cycleId].goalDraftV2 = null;
    state.goalExecutionContract = {
      ...state.goalExecutionContract,
      planningIntake: {
        goalDescription: goalText,
        goalClassification: 'regulated_physical_consumable',
        startDayKey,
        executionContext: 'full_time',
        weeklyHoursAvailable: 40,
        workWindows: null,
        capitalAvailable: 35000,
        capitalAcquisitionRequired: false,
        capitalAcquisitionAssets: null,
        hardDeadline: null,
        existingDomainRelationships: [],
        blackoutPeriods: [],
        stopCondition: null,
        capitalCommitmentConfidence: 'confirmed',
        formulaPathway: 'white_label',
        targetCategory: 'functional_food',
        distributionChannel: 'direct_to_consumer',
      },
    };
    state.cyclesById[cycleId].goalContract = {
      ...state.cyclesById[cycleId].goalContract,
      planningIntake: state.goalExecutionContract.planningIntake,
      goalIntakeContract: {
        planningIntake: state.goalExecutionContract.planningIntake,
        readiness: { isReadyForPlanning: true },
      },
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
    await generatePlanWithLLM({ cycleId });

    expect(state.lastPlanError?.code).not.toBe('MISSING_GOAL_DRAFT');
    expect(state.cyclesById[cycleId].goalDraftV2).toBeTruthy();
    expect(state.cyclesById[cycleId].goalDraftV2.goalText).toBe(goalText);
  });

  it('upgrades regulated consumable legacy GenericStructured cycles to BrandLaunch for generation', async () => {
    let state = buildState({
      goalClassification: 'regulated_physical_consumable',
      executionContext: 'full_time',
      weeklyHoursAvailable: 40,
      capitalAvailable: 35000,
      capitalAcquisitionRequired: false,
      hardDeadline: null,
      existingDomainRelationships: [],
      formulaPathway: 'white_label',
      targetCategory: 'functional_food',
      distributionChannel: 'direct_to_consumer',
      capitalCommitmentConfidence: 'confirmed',
    });

    state.cyclesById[cycleId].goalDraftV2 = null;
    state.cyclesById[cycleId].goalContract = {
      ...state.cyclesById[cycleId].goalContract,
      executionType: 'GenericStructured',
      goalText: '',
      goalLabel: '',
      planningIntake: {
        goalDescription: goalText,
        goalClassification: 'regulated_physical_consumable',
        startDayKey,
        executionContext: 'full_time',
        weeklyHoursAvailable: 40,
        workWindows: null,
        capitalAvailable: 35000,
        capitalAcquisitionRequired: false,
        capitalAcquisitionAssets: null,
        hardDeadline: null,
        existingDomainRelationships: [],
        blackoutPeriods: [],
        stopCondition: null,
        capitalCommitmentConfidence: 'confirmed',
        formulaPathway: 'white_label',
        targetCategory: 'functional_food',
        distributionChannel: 'direct_to_consumer',
      },
    };
    state.cyclesById[cycleId].definiteGoal = {
      outcome: goalText,
      deadlineDayKey,
    };
    state.goalExecutionContract = {
      ...state.goalExecutionContract,
      executionType: 'GenericStructured',
      planningIntake: state.cyclesById[cycleId].goalContract.planningIntake,
      goalText,
      startDayKey,
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
    await generatePlanWithLLM({ cycleId });

    expect(state.cyclesById[cycleId].goalDraftV2).toBeTruthy();
    expect(state.cyclesById[cycleId].goalDraftV2.executionType).toBe('BrandLaunch');
    expect(state.lastPlanError?.code).not.toBe('MISSING_GOAL_DRAFT');
  });

  it('preserves recovered acquisition-path intake when rebuilding the goal intake contract', () => {
    const contract = {
      goalId,
      goalText,
      executionType: 'BrandLaunch',
      startDayKey,
      deadline: { dayKey: deadlineDayKey },
      planningIntake: {
        goalDescription: goalText,
        goalClassification: 'regulated_physical_consumable',
        startDayKey,
        executionContext: 'full_time',
        weeklyHoursAvailable: 40,
        workWindows: null,
        capitalAvailable: 0,
        capitalAcquisitionRequired: true,
        capitalAcquisitionAssets: {
          existingAudience: {
            spotifyListeners: 23000,
            instagramFollowers: 1000,
            audienceRelationship: 'music_career',
            influencerNetwork: true,
            entrepreneurNetwork: true,
          },
          existingRevenue: {
            projectManagementCompany: true,
            allocationToPossible: true,
          },
        },
        hardDeadline: null,
        existingDomainRelationships: [],
        blackoutPeriods: [],
        stopCondition: null,
        capitalCommitmentConfidence: 'uncertain',
        formulaPathway: 'white_label',
        targetCategory: 'functional_food',
        distributionChannel: 'direct_to_consumer',
      },
    };

    const intakeContract = buildGoalIntakeContract({
      goalId,
      rawGoalText: goalText,
      executionType: 'BrandLaunch',
      deadline: deadlineDayKey,
      contract,
      goalDraftV2: {
        goalText,
        goalLabel: goalText,
        executionType: 'BrandLaunch',
        startDate: startDayKey,
        answeredContext: {
          executionContext: 'full_time',
          weeklyHoursAvailable: 40,
        },
      },
      answeredContext: {
        executionContext: 'full_time',
        weeklyHoursAvailable: 40,
      },
    });

    expect(intakeContract.planningIntake?.capitalAcquisitionRequired).toBe(true);
    expect(intakeContract.planningIntake?.formulaPathway).toBe('white_label');
    expect(intakeContract.prePlanFeasibility?.status).toBe('VIABLE_WITH_CAPITAL_ACQUISITION_REQUIRED');
  });

  it('recovers a stale zero-capital white-label acquisition path instead of failing as CAPITAL_CONSTRAINED', async () => {
    let state = buildState({
      goalClassification: 'regulated_physical_consumable',
      executionContext: 'full_time',
      weeklyHoursAvailable: 40,
      capitalAvailable: 0,
      capitalAcquisitionRequired: false,
      hardDeadline: null,
      existingDomainRelationships: [],
      formulaPathway: null,
      targetCategory: 'functional_food',
      distributionChannel: 'direct_to_consumer',
      capitalCommitmentConfidence: 'uncertain',
      capitalAcquisitionAssets: {
        existingAudience: {
          spotifyListeners: 23000,
          instagramFollowers: 1000,
          audienceRelationship: 'music_career',
          influencerNetwork: true,
          entrepreneurNetwork: true,
        },
        existingRevenue: {
          projectManagementCompany: true,
          allocationToPossible: true,
        },
      },
    });

    state.cyclesById[cycleId].goalContract = {
      ...state.cyclesById[cycleId].goalContract,
      selectedFeasibilityPivot: 'white_label_lower_capital',
      planningIntake: {
        goalDescription: goalText,
        goalClassification: 'regulated_physical_consumable',
        startDayKey,
        executionContext: 'full_time',
        weeklyHoursAvailable: 40,
        workWindows: null,
        capitalAvailable: 0,
        capitalAcquisitionRequired: false,
        capitalAcquisitionAssets: {
          existingAudience: {
            spotifyListeners: 23000,
            instagramFollowers: 1000,
            audienceRelationship: 'music_career',
            influencerNetwork: true,
            entrepreneurNetwork: true,
          },
          existingRevenue: {
            projectManagementCompany: true,
            allocationToPossible: true,
          },
        },
        hardDeadline: null,
        existingDomainRelationships: [],
        blackoutPeriods: [],
        stopCondition: null,
        capitalCommitmentConfidence: 'uncertain',
        formulaPathway: null,
        targetCategory: 'functional_food',
        distributionChannel: 'direct_to_consumer',
      },
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
    await generatePlanWithLLM({ cycleId });

    expect(state.lastPlanError?.code).not.toBe('CAPITAL_CONSTRAINED');
    expect(state.cyclesById[cycleId].goalContract.planningIntake.capitalAcquisitionRequired).toBe(true);
    expect(state.cyclesById[cycleId].goalContract.planningIntake.formulaPathway).toBe('white_label');
  });
});
