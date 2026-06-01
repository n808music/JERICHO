import { describe, expect, it } from 'vitest';
import { computeDerivedState } from '../../src/state/identityCompute.js';
import { createGeneratePlanWithLLM } from '../../src/state/storeLLMActions.ts';
import { gumBrandFounderIntake } from '../fixtures/gumBrandFounderIntake';

const cycleId = 'cycle-energy-gum-feasibility-1';
const goalId = 'goal-energy-gum-feasibility-1';
const startDayKey = '2026-04-24';
const deadlineDayKey = '2027-07-31';
const goalText = 'Launch a caffeinated functional energy gum brand';
const verificationCriteria =
  'Sellable gum offer, compliant label, merchant approval, production readiness, and first-sales evidence are complete.';

function buildState(answeredContext: Record<string, any>) {
  return {
    vector: { day: 1, direction: goalText, stability: 'steady', drift: 'contained', momentum: 'active' },
    lenses: {
      aim: { description: goalText, horizon: 'year', narrative: '' },
      pattern: { routines: { Body: [], Resources: [], Creation: [], Focus: [] }, dailyTargets: [], defaultMinutes: 30 },
      flow: { streams: [] },
    },
    today: { date: startDayKey, blocks: [], completionRate: 0, driftSignal: 'contained', loadByPractice: {}, practices: [] },
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
    constraints: { maxBlocksPerDay: 6, maxBlocksPerWeek: 30 },
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
          terminalOutcome: { text: goalText, verificationCriteria },
          workWindows: {},
          planningIntake: answeredContext,
          target: { count: 1, unit: 'launched energy gum brand', definitionOfDone: verificationCriteria },
        },
      },
    },
    pendingOnboardingInputs: {
      goalDraftV2: { goalText, goalLabel: goalText, executionType: 'BrandLaunch', startDate: startDayKey },
      goalText,
      executionType: 'BrandLaunch',
      startDate: startDayKey,
      deadline: deadlineDayKey,
      definitionOfDone: verificationCriteria,
      daysPerWeek: '5',
      minutesPerDay: '120',
      answeredContext,
    },
    proposedBlocks: [],
    proposedBlocksByCycleId: {},
    suggestedBlocks: [],
    suggestionEvents: [],
    deliverablesByCycleId: {},
    goalAdmissionByGoal: {
      [goalId]: { status: 'ADMITTED', reasonCodes: [], admittedAtISO: `${startDayKey}T12:00:00.000Z` },
    },
    goalExecutionContract: {
      goalId,
      goalText,
      goalLabel: goalText,
      executionType: 'BrandLaunch',
      startDayKey,
      deadline: { dayKey: deadlineDayKey },
      terminalOutcome: { text: goalText, verificationCriteria },
    },
    probabilityByGoal: {},
    feasibilityByGoal: {},
    goalWorkById: {},
    planRecovery: null,
    lastPlanError: null,
    profileLearning: {},
    directiveEligibilityByGoal: { [goalId]: { eligible: true } },
    goalDirective: { goalId, directiveId: 'dir-energy-gum-feasibility-1' },
  };
}

async function generateFullPlan(intake: Record<string, any>) {
  let state = buildState(intake);
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
  await generatePlanWithLLM({ cycleId, anchorDayKey: startDayKey, answeredContext: intake });

  if (state.lastPlanError) {
    return {
      status: state.lastPlanError.code === 'FEASIBILITY_BLOCKED' ? 'FEASIBILITY_BLOCKED' : state.lastPlanError.code,
      plan: null,
      feasibility:
        state.lastPlanError.code === 'FEASIBILITY_BLOCKED'
          ? (state.lastPlanError.feasibility || null)
          : { overallStatus: 'NOT_VIABLE_AS_STATED' },
      state,
    };
  }

  const cycle = state.cyclesById[cycleId];
  return {
    status: 'OK',
    plan: {
      actionGraph: cycle.llmActionGraph,
      scheduledBlocks: (state.proposedBlocks || []).filter((block: any) => block?.cycleId === cycleId),
      summary: cycle.autoAsanaPlan?.summary || null,
    },
    feasibility: cycle.autoAsanaPlan?.summary?.feasibilityAssessment || null,
    state,
  };
}

function sixMonthsFromNow() {
  return '2026-10-24';
}

describe('feasibility derivation energy gum acceptance', () => {
  it(
    'produces an honest, specific, and actionable assessment for the gum founder intake',
    async () => {
      const result = await generateFullPlan(gumBrandFounderIntake as any);
      const plan = result.plan;
      const assessment = result.feasibility;

      expect(result.status).toBe('OK');
      expect(assessment.overallStatus).toBe('VIABLE_WITH_IDENTIFIED_RISKS');

      expect(assessment.dimensions.capital.rating).toBe('MODERATE');
      expect(assessment.dimensions.capital.explanation).toMatch(/200/);
      expect(assessment.dimensions.capital.explanation).toMatch(/\$8,000|\$8000/);
      expect(assessment.dimensions.capital.explanation).toMatch(/0\.87%|0\.0087/);
      expect(assessment.dimensions.capital.explanation).toMatch(/23,000|24000/);
      expect(assessment.dimensions.capital.earlyWarningSignal).toMatch(/content|engagement|Founder Journey/i);
      expect(assessment.dimensions.capital.gateAtRisk).toBe('moq_deposit');

      expect(['LOW', 'MODERATE']).toContain(assessment.dimensions.timeline.rating);
      expect(assessment.dimensions.timeline.primaryRisk).toMatch(/production|queue/i);
      expect(assessment.dimensions.timeline.earlyWarningSignal).toMatch(/queue/i);

      expect(assessment.dimensions.execution.explanation).toMatch(/full-time|unemployed|velocity/i);
      expect(assessment.dimensions.execution.explanation).toMatch(/employ|return to work/i);
      expect(assessment.dimensions.execution.explanation).toMatch(/\d+\s+weeks?/i);
      expect(assessment.dimensions.execution.velocityWindow).toMatch(/months?\s+1-6|months?\s+1–6|phase|early/i);

      expect(assessment.dimensions.domain.rating).toBe('MODERATE');
      expect(assessment.dimensions.domain.explanation).toMatch(/25/);
      expect(assessment.dimensions.domain.explanation).toMatch(/manufacturer/i);
      expect(
        assessment.dimensions.domain.mitigations.some((mitigation: string) =>
          /manufacturer/i.test(mitigation) && /12|more|multiple/i.test(mitigation)
        )
      ).toBe(true);

      expect(assessment.dimensions.market.rating).toBe('MODERATE');
      expect(assessment.dimensions.market.explanation).toMatch(/music/i);
      expect(assessment.dimensions.market.explanation).toMatch(/product|functional food|gum/i);
      expect(assessment.dimensions.market.explanation).toMatch(/unproven|do not yet know you as a product founder/i);
      expect(assessment.dimensions.market.earlyWarningSignal).toMatch(/30%|0\.30|engagement/i);
      expect(assessment.dimensions.market.revisionTrigger).toBeTruthy();

      expect(assessment.topRisks).toHaveLength(3);
      expect(assessment.topRisks[0].risk).toMatch(/presale|capital|\$8,000|\$8000/i);
      expect(assessment.topRisks[1].risk).toMatch(/production|queue|manufacturing/i);
      expect(assessment.topRisks[2].risk).toMatch(/employ|velocity|full-time/i);
      assessment.topRisks.forEach((risk: any) => {
        expect(risk.earlyWarningSignal).toBeTruthy();
        expect(risk.earlyWarningSignal.length).toBeGreaterThan(20);
        expect(risk.mitigation).toBeTruthy();
        expect(risk.mitigation.length).toBeGreaterThan(20);
      });

      expect(assessment.confidenceStatement).toMatch(/Founder.?Journey|content/i);
      expect(assessment.confidenceStatement).toMatch(/first 30 days|most important/i);
      ['your situation', 'this type of goal', 'many founders', 'in general', 'typically speaking'].forEach((phrase) => {
        expect(String(assessment.confidenceStatement).toLowerCase()).not.toContain(phrase);
      });

      const conversionTrace = assessment.derivedFrom.find(
        (trace: any) => trace.claim.includes('conversion') || trace.sourceId.includes('conversionRate')
      );
      expect(conversionTrace).toBeTruthy();
      expect(conversionTrace.value).toBeCloseTo(0.0087, 3);

      const queueTrace = assessment.derivedFrom.find(
        (trace: any) => trace.sourceId.includes('productionRun') || trace.claim.includes('queue')
      );
      expect(queueTrace).toBeTruthy();

      ['capital', 'timeline', 'execution', 'domain', 'market'].forEach((dimension) => {
        const traces = assessment.derivedFrom.filter(
          (trace: any) => trace.sourceId.includes(dimension) || trace.claim.includes(dimension)
        );
        expect(traces.length).toBeGreaterThan(0);
      });

      expect(plan.summary.feasibilityAssessment).toBeTruthy();
      expect(plan.actionGraph).toBeTruthy();
      expect(plan.scheduledBlocks.length).toBeGreaterThan(0);
      expect(plan.summary.planStatus).toBe('VALID_AND_FULLY_SCHEDULED');
    },
    120000
  );

  it('blocks clearly impossible versions of the founder case', async () => {
    const impossibleIntake = {
      ...gumBrandFounderIntake,
      formulaPathway: 'custom_development',
      capitalAvailable: 500,
      capitalAcquisitionRequired: false,
      hardDeadline: sixMonthsFromNow(),
    };

    const result = await generateFullPlan(impossibleIntake as any);
    expect(['FEASIBILITY_BLOCKED', 'CAPITAL_CONSTRAINED', 'PATHWAY_MISMATCH', 'VIABLE_WITH_ADJUSTED_TIMELINE']).toContain(
      result.status
    );
    expect(result.plan).toBeNull();
    expect(result.feasibility?.overallStatus || 'NOT_VIABLE_AS_STATED').toBe('NOT_VIABLE_AS_STATED');
  });
});
