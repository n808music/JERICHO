import fs from 'node:fs';
import { describe, expect, it } from 'vitest';
import { computeDerivedState } from '../../src/state/identityCompute.js';
import { createGeneratePlanWithLLM } from '../../src/state/storeLLMActions.ts';

const cycleId = 'cycle-brandlaunch-live-1';
const goalId = 'goal-brandlaunch-live-1';
const outputPath = '/tmp/jericho-live-regenerated-state.json';
const startDayKey = '2026-04-21';
const deadlineDayKey = '2027-07-31';
const goalText = 'Launch a caffeinated functional energy gum brand';
const terminalOutcomeText = goalText;
const verificationCriteria =
  'Sellable gum offer, compliant label, merchant approval, production readiness, and first-sales evidence are complete.';
const planningAnswers = {
  goalClassification: 'regulated_physical_consumable',
  goalDescription: 'Launch a caffeinated functional energy gum brand',
  targetCategory: 'functional_food',
  distributionChannel: 'direct_to_consumer',
  legalFoundation: {
    existingEntity: true,
    existingEntityType: 'LLC',
    existingEntityState: 'IL',
    existingEntityPurpose: 'project_management',
    gumEntityExists: false,
  },
  formulaPathway: 'undecided',
  formulaDirection: {
    caffeineSource: 'undecided',
    flavorDirection: 'has_ideas',
    texturePreference: 'undecided',
    differentiator: 'marketing_vision_defined_formula_undefined',
  },
  capitalAvailable: 0,
  capitalCommitmentConfidence: 'uncertain',
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
  weeklyHoursAvailable: 40,
  executionContext: 'full_time',
  employmentStatus: 'voluntarily_unemployed',
  employmentChangeRisk: true,
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
            text: terminalOutcomeText,
            verificationCriteria,
          },
          workWindows: {},
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
        goalText,
        goalLabel: goalText,
        executionType: 'BrandLaunch',
        startDate: startDayKey,
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
        text: terminalOutcomeText,
        verificationCriteria,
      },
    },
    probabilityByGoal: {},
    feasibilityByGoal: {},
    goalWorkById: {},
    planRecovery: null,
    lastPlanError: null,
    profileLearning: {},
    directiveEligibilityByGoal: { [goalId]: { eligible: true } },
    goalDirective: { goalId, directiveId: 'dir-brandlaunch-live-1' },
  };
}

describe('live planner regeneration artifact', () => {
  it(
    'writes a real generatePlanWithLLM state artifact',
    async () => {
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

      expect(state.lastPlanError).toBeFalsy();
      expect(Array.isArray(state.proposedBlocks)).toBe(true);
      expect(state.proposedBlocks.length).toBeGreaterThan(0);

      fs.writeFileSync(outputPath, JSON.stringify(state, null, 2));
    },
    120000
  );
});
