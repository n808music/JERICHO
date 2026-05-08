import fs from 'node:fs';
import path from 'node:path';
import { computeDerivedState } from '../JERICHO/src/state/identityCompute.js';
import { createGeneratePlanWithLLM } from '../JERICHO/src/state/storeLLMActions.ts';

const cycleId = 'cycle-brandlaunch-live-1';
const goalId = 'goal-brandlaunch-live-1';
const outputPath = process.argv[2] || '/tmp/jericho-live-regenerated-state.json';
const startDayKey = '2026-04-21';
const deadlineDayKey = '2026-08-31';
const goalText = 'Build a caffeinated gum brand and take it to first real sales';
const terminalOutcomeText =
  'Launch the caffeinated gum product with packaging, sourcing, purchase path, and first real sales.';
const verificationCriteria =
  'Sellable gum offer, checkout path, and first-sales evidence are complete.';

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

let state = buildState();
const store = {
  getState: () => state,
  dispatch: (action) => {
    state = computeDerivedState(state, action);
  },
  generatePlan: (payload = {}) => {
    state = computeDerivedState(state, { type: 'GENERATE_PLAN', payload });
  },
  getAnthropicApiKey: () => 'dev-mock-key',
};

const generatePlanWithLLM = createGeneratePlanWithLLM(store);
await generatePlanWithLLM({ cycleId, anchorDayKey: startDayKey });

fs.writeFileSync(outputPath, JSON.stringify(state, null, 2));

const blockCount = Array.isArray(state.proposedBlocks) ? state.proposedBlocks.length : 0;
const finalPath = path.resolve(outputPath);
console.log(`WROTE ${finalPath} (${blockCount} proposedBlocks)`);

