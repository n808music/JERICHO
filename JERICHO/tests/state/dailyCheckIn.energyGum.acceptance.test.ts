import { describe, expect, it } from 'vitest';
import { computeDerivedState } from '../../src/state/identityCompute.js';
import { createGeneratePlanWithLLM } from '../../src/state/storeLLMActions.ts';
import { gumBrandFounderIntake } from '../fixtures/gumBrandFounderIntake';
import { deriveDailyCheckIn } from '../../src/domain/live/dailyCheckIn';
import { addBusinessDays } from '../../src/domain/goal/planQualityAudit';

const cycleId = 'cycle-energy-gum-live-checkin-1';
const goalId = 'goal-energy-gum-live-checkin-1';
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
      planningIntake: answeredContext,
    },
    probabilityByGoal: {},
    feasibilityByGoal: {},
    goalWorkById: {},
    planRecovery: null,
    lastPlanError: null,
    profileLearning: {},
    directiveEligibilityByGoal: { [goalId]: { eligible: true } },
    goalDirective: { goalId, directiveId: 'dir-energy-gum-live-checkin-1' },
  };
}

async function generatePlan() {
  let state = buildState(gumBrandFounderIntake as any);
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
  await generatePlanWithLLM({ cycleId, anchorDayKey: startDayKey, answeredContext: gumBrandFounderIntake as any });
  const cycle = state.cyclesById[cycleId];
  return {
    plan: {
      scheduledBlocks: (state.proposedBlocks || []).filter((block: any) => block?.cycleId === cycleId),
      summary: {
        feasibilityAssessment: cycle.autoAsanaPlan?.summary?.feasibilityAssessment || null,
        capitalAcquisitionFeasibility:
          cycle.goalContract?.capitalAcquisitionFeasibility || cycle.goalContract?.prePlanFeasibility || null,
      },
    },
    state,
  };
}

function buildCompletionLogForGap(plan: { scheduledBlocks: any[] }, asOfISO: string, targetGap: number) {
  const allDue = (plan.scheduledBlocks || [])
    .filter((block) => String(block?.blockType || 'execution') !== 'waiting_period' && String(block?.startISO || '') <= asOfISO)
    .sort((left, right) => String(left?.startISO || '').localeCompare(String(right?.startISO || '')));
  const checkpoints = allDue.filter((block) => String(block?.blockType || '') === 'capital_checkpoint');
  const executionSessions = allDue.filter((block) => String(block?.blockType || '') !== 'capital_checkpoint');
  const targetCompletedExecutions = Math.max(0, executionSessions.length + targetGap);
  return [...checkpoints, ...executionSessions.slice(0, targetCompletedExecutions)].map((block) => ({
    blockId: block.id,
    actionId: block.actionId || null,
    kind: 'complete' as const,
    completed: true,
    dateISO: block.endISO || block.startISO,
    canonicalTitle: block.title,
  }));
}

function subtractCalendarDays(iso: string, days: number) {
  const date = new Date(iso);
  date.setUTCDate(date.getUTCDate() - days);
  return date.toISOString();
}

describe('daily check-in energy gum acceptance', () => {
  it('surfaces week-6 on-track manufacturer outreach state honestly', async () => {
    const { plan } = await generatePlan();
    const manufacturerWait = plan.scheduledBlocks.find((block: any) => block.waitType === 'manufacturer_initial_response');
    expect(manufacturerWait).toBeTruthy();
    const asOf = addBusinessDays(manufacturerWait.startISO, 7) || manufacturerWait.startISO;
    const completionLog = buildCompletionLogForGap(plan, asOf, -1);
    const view = deriveDailyCheckIn({
      plan,
      asOf,
      completionLog,
      intake: gumBrandFounderIntake as any,
    });

    expect(view.liveState.liveStatus).toBe('ON_TRACK');
    expect(view.sections[0].lines.join(' ')).toMatch(/Week \d+ of \d+/);
    expect(view.sections[0].lines.join(' ')).toMatch(/Manufacturer outreach/i);
    expect(view.sections[0].lines.join(' ')).toMatch(/days remaining|day \d+ of \d+/i);
    expect(view.sections[0].lines.join(' ')).toMatch(/Parallel work available/i);
    expect(view.sections[1].signals[0]).toMatch(/within normal range|No signals to surface/i);
    expect(view.sections[2].primary).toMatch(/manufacturer|catalog|outreach|packaging|supplier/i);
  });

  it('surfaces the capital problem first when presale is aging badly', async () => {
    const { plan } = await generatePlan();
    const asOf = '2026-06-10T00:00:00.000Z';
    const planWithPresale = {
      ...plan,
      scheduledBlocks: [
        ...plan.scheduledBlocks,
        {
          id: 'synthetic-presale-launch',
          title: 'Presale campaign launch',
          actionId: 'synthetic-presale-launch',
          startISO: '2026-05-09T00:00:00.000Z',
          endISO: '2026-05-09T00:30:00.000Z',
          blockType: 'execution',
        },
      ],
    };
    const completionLog = buildCompletionLogForGap(plan, asOf, -2);
    const view = deriveDailyCheckIn({
      plan: planWithPresale,
      asOf,
      completionLog,
      runtimeEvents: [{ kind: 'presale_update', recordedAt: asOf, orderCount: 18, conversionRate: 0.0009, balance: 720 }],
      intake: gumBrandFounderIntake as any,
    });

    expect(view.liveState.liveStatus).toBe('DRIFTING');
    expect(view.liveState.dimensionFlags.some((flag) => flag.dimension === 'capital' && flag.severity === 'alert')).toBe(true);
    expect(view.sections[1].signals[0]).toMatch(/Presale conversion|capital/i);
    expect(view.sections[2].primary).toMatch(/capital|Founder Journey|offer/i);
  });

  it('gives an honest gap recap and changes today’s action after an 18-day absence', async () => {
    const { plan } = await generatePlan();
    const manufacturerWait = plan.scheduledBlocks.find((block: any) => block.waitType === 'manufacturer_initial_response');
    const responseDate = addBusinessDays(manufacturerWait.startISO, 12) || manufacturerWait.startISO;
    const asOf = addBusinessDays(responseDate, 5) || responseDate;
    const completionLog = buildCompletionLogForGap(plan, asOf, -12);
    const view = deriveDailyCheckIn({
      plan,
      asOf,
      lastCheckInISO: subtractCalendarDays(asOf, 18),
      completionLog,
      runtimeEvents: [
        {
          kind: 'manufacturer_response',
          manufacturerName: 'Manufacturer B',
          respondedAt: responseDate,
          detail: 'a catalog',
        },
      ],
      intake: gumBrandFounderIntake as any,
    });

    expect(view.gapRecap.length).toBeGreaterThan(0);
    expect(view.gapRecap[0].message).toMatch(/18 days since your last check-in/i);
    expect(view.gapRecap.some((event) => /Manufacturer B responded/i.test(event.message))).toBe(true);
    expect(view.gapRecap.some((event) => /12 sessions/i.test(event.message))).toBe(true);
    expect(view.gapRecap.some((event) => /Projected completion/i.test(event.message))).toBe(true);
    expect(view.sections[2].primary).toMatch(/Review Manufacturer B catalog/i);
  });
});
