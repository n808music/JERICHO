import { describe, expect, it } from 'vitest';

import { computeDerivedState } from '../../src/state/identityCompute.js';
import { createGeneratePlanWithLLM } from '../../src/state/storeLLMActions.ts';

const cycleId = 'cycle-gum-live-parity-1';
const goalId = 'goal-gum-live-parity-1';
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

function dayKeyFromBlock(block: any) {
  return String(block?.dayKey || block?.start || '').slice(0, 10);
}

function endDayKeyFromBlock(block: any) {
  return String(block?.endDayKey || block?.endISO || block?.end || block?.dayKey || block?.start || '').slice(0, 10);
}

function diffDays(a: string, b: string) {
  const start = Date.parse(`${a}T12:00:00.000Z`);
  const end = Date.parse(`${b}T12:00:00.000Z`);
  return Math.round((end - start) / 86400000);
}

function analyzeGapStats(blocks: any[], contractStart: string, contractEnd: string) {
  const scheduledDayKeys = blocks
    .map((block) => dayKeyFromBlock(block))
    .filter((dayKey) => /^\d{4}-\d{2}-\d{2}$/.test(dayKey))
    .sort();
  const occupiedIntervals = blocks
    .map((block) => {
      const startDayKey = dayKeyFromBlock(block);
      const endDayKey = endDayKeyFromBlock(block);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(startDayKey)) return null;
      return {
        startDayKey,
        endDayKey: /^\d{4}-\d{2}-\d{2}$/.test(endDayKey) && endDayKey >= startDayKey ? endDayKey : startDayKey,
      };
    })
    .filter(Boolean)
    .sort((left: any, right: any) => String(left.startDayKey).localeCompare(String(right.startDayKey)));
  const mergedIntervals = occupiedIntervals.reduce((intervals: Array<{ startDayKey: string; endDayKey: string }>, interval: any) => {
    const previous = intervals[intervals.length - 1];
    if (!previous) {
      intervals.push({ startDayKey: interval.startDayKey, endDayKey: interval.endDayKey });
      return intervals;
    }
    if (interval.startDayKey <= previous.endDayKey) {
      if (interval.endDayKey > previous.endDayKey) {
        previous.endDayKey = interval.endDayKey;
      }
      return intervals;
    }
    intervals.push({ startDayKey: interval.startDayKey, endDayKey: interval.endDayKey });
    return intervals;
  }, []);
  const distinctDayKeys = Array.from(new Set(scheduledDayKeys));
  const gaps = mergedIntervals
    .slice(1)
    .map((interval, index) => {
      const previousInterval = mergedIntervals[index];
      const gapDays = diffDays(previousInterval.endDayKey, interval.startDayKey);
      return {
        previousDayKey: previousInterval.endDayKey,
        nextDayKey: interval.startDayKey,
        gapDays,
        previousBlocks: blocks
          .filter((block) => dayKeyFromBlock(block) === previousInterval.startDayKey || endDayKeyFromBlock(block) === previousInterval.endDayKey)
          .slice(0, 3)
          .map((block) => ({ title: block.title, blockType: block.blockType || null, actionId: block.actionId || null })),
        nextBlocks: blocks
          .filter((block) => dayKeyFromBlock(block) === interval.startDayKey)
          .slice(0, 3)
          .map((block) => ({ title: block.title, blockType: block.blockType || null, actionId: block.actionId || null })),
      };
    })
    .sort((left, right) => right.gapDays - left.gapDays);

  return {
    scheduledBlockCount: blocks.length,
    firstScheduledDayKey: distinctDayKeys[0] || null,
    lastScheduledDayKey: distinctDayKeys[distinctDayKeys.length - 1] || null,
    contractStartDayKey: contractStart,
    contractEndDayKey: contractEnd,
    distinctScheduledDayCount: distinctDayKeys.length,
    averageBlocksPerWeek: Number((blocks.length / Math.max(1, (diffDays(contractStart, contractEnd) + 1) / 7)).toFixed(2)),
    maxInterBlockGapDays: gaps[0]?.gapDays || 0,
    topGaps: gaps.slice(0, 8),
  };
}

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
    },
    probabilityByGoal: {},
    feasibilityByGoal: {},
    goalWorkById: {},
    planRecovery: null,
    lastPlanError: null,
    profileLearning: {},
    directiveEligibilityByGoal: { [goalId]: { eligible: true } },
    goalDirective: { goalId, directiveId: 'dir-gum-live-parity-1' },
  };
}

describe('gum goal live/test parity', () => {
  it('materializes a commercially continuous long-horizon schedule for the exact gum goal text', async () => {
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

    const generatedCycle = state.cyclesById[cycleId];
    const generatedGate = generatedCycle?.planQualityGate;
    const generatedPolicy = generatedCycle?.policyState?.goalPolicy;
    const generatedGapStats = analyzeGapStats(generatedCycle?.proposedBlocks || [], startDayKey, deadlineDayKey);

    expect(Array.isArray(generatedCycle?.proposedBlocks)).toBe(true);
    expect(generatedCycle.proposedBlocks.length).toBe(245);
    expect(generatedGate?.status).toBe('PLAN_QUALITY_PASSED');
    expect(generatedCycle?.goalContract?.goalIntakeContract?.terminalEndpoint?.status).not.toBe('missing');
    expect(generatedGate?.failureCodes).not.toContain('OUTCOME_ENDPOINT_MISSING');
    expect(generatedGate?.failureCodes).not.toContain('BLOCK_GOAL_OBJECT_MISSING');
    expect(generatedGate?.failureCodes).not.toContain('LONG_HORIZON_WORK_GAPS');
    expect(generatedGapStats.scheduledBlockCount).toBe(245);
    expect(generatedGapStats.contractStartDayKey).toBe(startDayKey);
    expect(generatedGapStats.contractEndDayKey).toBe(deadlineDayKey);
    expect(generatedGapStats.averageBlocksPerWeek).toBeGreaterThanOrEqual(2);
    expect(generatedGapStats.maxInterBlockGapDays).toBeLessThanOrEqual(6);
    expect(generatedGate?.meta?.temporalDistribution?.averageBlocksPerWeek).toBeGreaterThanOrEqual(2);
    expect(generatedGate?.meta?.temporalDistribution?.maxInterBlockGapDays).toBeLessThanOrEqual(6);
    expect(generatedGate?.meta?.temporalDistribution?.firstScheduledDayKey).toBe(startDayKey);
    expect(generatedGate?.meta?.temporalDistribution?.lastScheduledDayKey).toBe(generatedGapStats.lastScheduledDayKey);

    const applied = computeDerivedState(state as any, {
      type: 'APPLY_DRAFT_SCHEDULE',
      payload: { cycleId },
    } as any);

    const appliedCycle = applied.cyclesById[cycleId];
    const appliedGate = appliedCycle?.planQualityGate;
    const appliedPolicy = appliedCycle?.policyState?.goalPolicy;
    const appliedGapStats = analyzeGapStats(appliedCycle?.scheduleReviewBlocks || [], startDayKey, deadlineDayKey);

    expect(Array.isArray(appliedCycle?.scheduleReviewBlocks)).toBe(true);
    expect(appliedCycle.scheduleReviewBlocks.length).toBe(245);
    expect(appliedGate?.status).toBe('PLAN_QUALITY_PASSED');
    expect(appliedGate?.failureCodes).not.toContain('OUTCOME_ENDPOINT_MISSING');
    expect(appliedGate?.failureCodes).not.toContain('BLOCK_GOAL_OBJECT_MISSING');
    expect(appliedGate?.failureCodes).not.toContain('LONG_HORIZON_WORK_GAPS');
    expect(appliedGapStats.scheduledBlockCount).toBe(245);
    expect(appliedGapStats.maxInterBlockGapDays).toBe(generatedGapStats.maxInterBlockGapDays);
    expect(appliedGapStats.maxInterBlockGapDays).toBeLessThanOrEqual(6);
    expect(appliedGate?.meta?.temporalDistribution?.averageBlocksPerWeek).toBeGreaterThanOrEqual(2);
    expect(appliedGate?.meta?.temporalDistribution?.maxInterBlockGapDays).toBeLessThanOrEqual(6);
    expect(appliedGate?.meta?.temporalDistribution?.firstScheduledDayKey).toBe(startDayKey);
    expect(appliedGate?.meta?.temporalDistribution?.lastScheduledDayKey).toBe(appliedGapStats.lastScheduledDayKey);
    expect(appliedPolicy?.feasibility?.state).not.toBe('withheld');
    expect(appliedPolicy?.feasibility?.percent).not.toBeNull();
    expect(appliedPolicy?.feasibility?.score).not.toBeNull();
    expect(appliedPolicy?.feasibility?.range).not.toBeNull();
    expect(appliedPolicy?.feasibility?.reasonCodes).not.toContain('FEASIBILITY_CANONICAL_TRUTH_THIN');
  });
});
