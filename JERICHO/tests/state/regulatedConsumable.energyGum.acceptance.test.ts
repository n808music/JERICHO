import { describe, expect, it } from 'vitest';
import { computeDerivedState } from '../../src/state/identityCompute.js';
import { createGeneratePlanWithLLM } from '../../src/state/storeLLMActions.ts';
import { buildGoalIntakeContract } from '../../src/domain/goal/GoalIntakeContract.ts';
import { gumBrandFounderIntake } from '../fixtures/gumBrandFounderIntake';

const cycleId = 'cycle-energy-gum-founder-1';
const goalId = 'goal-energy-gum-founder-1';
const startDayKey = '2026-04-24';
const deadlineDayKey = '2027-07-31';
const goalText = 'Launch a caffeinated functional energy gum brand';
const verificationCriteria =
  'Sellable gum offer, compliant label, merchant approval, production readiness, and first-sales evidence are complete.';

const EXACT_INTAKE = gumBrandFounderIntake;

function buildState() {
  return {
    vector: { day: 1, direction: goalText, stability: 'steady', drift: 'contained', momentum: 'active' },
    lenses: {
      aim: { description: goalText, horizon: 'year', narrative: '' },
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
          answeredContext: EXACT_INTAKE,
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
          planningIntake: EXACT_INTAKE,
          target: {
            count: 1,
            unit: 'launched energy gum brand',
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
      minutesPerDay: '120',
      answeredContext: EXACT_INTAKE,
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
    },
    probabilityByGoal: {},
    feasibilityByGoal: {},
    goalWorkById: {},
    planRecovery: null,
    lastPlanError: null,
    profileLearning: {},
    directiveEligibilityByGoal: { [goalId]: { eligible: true } },
    goalDirective: { goalId, directiveId: 'dir-energy-gum-founder-1' },
  };
}

function indexByTitle(items: Array<Record<string, any>>) {
  return new Map(items.map((item) => [String(item.title || ''), item]));
}

function findActionIndex(actions: Array<Record<string, any>>, title: string) {
  return actions.findIndex((action) => String(action?.title || '') === title);
}

describe('regulated consumable energy gum founder acceptance', () => {
  it('produces the founder-specific capital-acquisition feasibility report from the exact intake', () => {
    const contract = buildGoalIntakeContract({
      goalId,
      rawGoalText: goalText,
      verificationCriteria,
      executionType: 'BrandLaunch',
      deadline: deadlineDayKey,
      contract: {
        goalId,
        goalText,
        executionType: 'BrandLaunch',
        planningIntake: EXACT_INTAKE,
        startDayKey,
        terminalOutcome: { text: goalText, verificationCriteria },
      },
      goalDraftV2: {
        goalText,
        goalLabel: goalText,
        executionType: 'BrandLaunch',
      },
      answeredContext: EXACT_INTAKE as any,
    });

    expect(contract.prePlanFeasibility?.status).toBe('VIABLE_WITH_CAPITAL_ACQUISITION_REQUIRED');
    expect(contract.capitalAcquisitionFeasibility?.status).toBe('VIABLE_WITH_CAPITAL_ACQUISITION_REQUIRED');
    expect(contract.capitalAcquisitionFeasibility?.standardPathCompletionMonths).toBe(15);
    expect(contract.capitalAcquisitionFeasibility?.recommendedPathway).toBe('white_label');
    expect(contract.capitalAcquisitionFeasibility?.totalCapitalRequired.criticalGate).toBe('moq_deposit');
    expect(contract.capitalAcquisitionFeasibility?.totalCapitalRequired.criticalGateAmount).toBe(8000);
    expect(contract.capitalAcquisitionFeasibility?.capitalAcquisitionPath?.primaryStrategy).toBe('presale_campaign');
    expect(contract.capitalAcquisitionFeasibility?.capitalAcquisitionPath?.presaleMath).toMatchObject({
      target: 8000,
      suggestedUnitPrice: 40,
      unitsRequired: 200,
      audienceConversionRequired: 0.0087,
    });
    expect(contract.capitalAcquisitionFeasibility?.velocityAsset).toContain('highest-velocity window');
  });

  it(
    'generates the Illinois white-label founder plan instead of a generic regulated consumable plan',
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
      await generatePlanWithLLM({ cycleId, anchorDayKey: startDayKey, answeredContext: EXACT_INTAKE as any });

      expect(state.lastPlanError).toBeFalsy();
      const cycle = state.cyclesById[cycleId];
      expect(cycle.goalContract?.capitalAcquisitionFeasibility?.status).toBe('VIABLE_WITH_CAPITAL_ACQUISITION_REQUIRED');
      expect(cycle.autoAsanaPlan?.summary?.planStatus).toBe('VALID_AND_FULLY_SCHEDULED');

      const actions = Array.isArray(cycle.llmActionGraph?.actions) ? cycle.llmActionGraph.actions : [];
      const byTitle = indexByTitle(actions);
      const byId = new Map(actions.map((action: any) => [String(action?.id || ''), action]));

      [
        'Investigate Illinois Series LLC option',
        'File gum brand entity (Series cell or standalone LLC)',
        'Open dedicated business bank account for gum brand',
        'Research stock caffeinated functional gum manufacturers',
        'Confirm GRAS status for caffeine source',
        'Build the presale offer',
        'Presale campaign launch',
        'Third-party food label review',
        'Purchase product liability insurance',
        'Dead space management - production queue',
        'Research high-risk merchant processing options for caffeine functional food',
        'Set up 3PL account and inbound shipment plan',
        "Fulfill Founder's Kit pre-orders",
        'First cold sale tracking',
      ].forEach((title) => {
        expect(byTitle.has(title), `missing founder-specific action: ${title}`).toBe(true);
      });

      expect(String(byTitle.get('Open dedicated business bank account for gum brand')?.description || '')).toMatch(
        /Mercury or Novo/i
      );
      expect(String(byTitle.get('Confirm GRAS status for caffeine source')?.description || '')).toMatch(/GRAS/i);
      expect(String(byTitle.get('Build the presale offer')?.description || '')).toMatch(/200 units x \$40 = \$8,000/i);
      expect(String(byTitle.get('Presale campaign launch')?.description || '')).toMatch(
        /If you do not raise the \$8,000 in this phase, you do not move to production/i
      );
      expect(String(byTitle.get('Third-party food label review')?.description || '')).toMatch(
        /Illinois has strict food labeling requirements/i
      );
      expect(String(byTitle.get('Purchase product liability insurance')?.description || '')).toMatch(
        /before the manufacturer will sign/i
      );
      expect(String(byTitle.get('Dead space management - production queue')?.description || '')).toMatch(
        /not dead time/i
      );
      expect(String(byTitle.get('Research high-risk merchant processing options for caffeine functional food')?.description || '')).toMatch(
        /during the production wait/i
      );
      expect(String(byTitle.get('Set up 3PL account and inbound shipment plan')?.description || '')).toMatch(
        /before the first Founders Kit order ships/i
      );
      expect(String(byTitle.get('First cold sale tracking')?.description || '')).toMatch(
        /distinct proof-of-market gate/i
      );

      const requiredFamilies = new Set(
        actions.map((action: any) => String(action?.requiredWorkFamily || '')).filter(Boolean)
      );
      expect(requiredFamilies.has('REGULATORY_AND_LABEL_REVIEW')).toBe(true);
      expect(requiredFamilies.has('MERCHANT_ACCOUNT_UNDERWRITING')).toBe(true);
      expect(requiredFamilies.has('CAPITAL_GATE_CHECKPOINTS')).toBe(true);
      expect(requiredFamilies.has('HERO_IMAGERY_PRODUCTION')).toBe(true);
      expect(requiredFamilies.has('PARALLEL_PACKAGING_TRACK')).toBe(true);

      const presaleOfferIndex = findActionIndex(actions, 'Build the presale offer');
      const presaleLaunchIndex = findActionIndex(actions, 'Presale campaign launch');
      const presaleTrackIndex = findActionIndex(actions, 'Track presale revenue in dedicated account');
      const moqCheckpointIndex = findActionIndex(actions, 'Capital checkpoint 4 - MOQ production deposit');
      const depositIndex = findActionIndex(actions, 'Pay 50% manufacturing deposit');

      expect(presaleOfferIndex).toBeGreaterThanOrEqual(0);
      expect(presaleLaunchIndex).toBeGreaterThan(presaleOfferIndex);
      expect(presaleTrackIndex).toBeGreaterThan(presaleLaunchIndex);
      expect(moqCheckpointIndex).toBeGreaterThan(presaleTrackIndex);
      expect(depositIndex).toBeGreaterThan(moqCheckpointIndex);

      const moqCheckpoint = byTitle.get('Capital checkpoint 4 - MOQ production deposit');
      const depositAction = byTitle.get('Pay 50% manufacturing deposit');
      expect(Array.isArray(moqCheckpoint?.dependencies)).toBe(true);
      const moqDependencyTitles = (moqCheckpoint?.dependencies || []).map((dependencyId: string) =>
        String(byId.get(String(dependencyId))?.title || '')
      );
      expect(moqDependencyTitles).toContain('Track presale revenue in dedicated account');
      expect(moqDependencyTitles).toContain('Lock compliance-safe claims with consultant sign-off');
      expect(moqDependencyTitles).toContain('Purchase product liability insurance');
      expect(moqDependencyTitles).toContain('Packaging production lead time');
      expect(depositAction?.dependencies).toEqual([moqCheckpoint?.id]);

      const blocks = (state.proposedBlocks || []).filter((block: any) => block?.cycleId === cycleId);

      expect(Array.isArray(blocks)).toBe(true);
      expect(blocks.length).toBeGreaterThan(0);

      const firstPresaleBlock = blocks.find((block: any) => {
        const title = String(block?.title || block?.task || '');
        return /presale/i.test(title) || /Founder'?s Kit/i.test(title);
      });
      const depositBlock = blocks.find((block: any) => {
        const title = String(block?.title || block?.task || '');
        return /manufacturing deposit/i.test(title);
      });
      expect(firstPresaleBlock).toBeTruthy();
      expect(depositBlock).toBeTruthy();
      expect(String(firstPresaleBlock?.startISO || '') < String(depositBlock?.startISO || '')).toBe(true);
    },
    120000
  );
});
