import { describe, expect, it } from 'vitest';

import { computeDerivedState } from '../../src/state/identityCompute.js';
import { identityReducer } from '../../src/state/identityStore.js';
import { createGeneratePlanWithLLM } from '../../src/state/storeLLMActions.ts';

const cycleId = 'cycle-ep-loop-1';
const goalId = 'goal-ep-loop-1';
const startDayKey = '2026-05-05';
const deadlineDayKey = '2026-06-19';

const epGoalText =
  'Finish and release a polished 3-song EP in 45 days so I have final recordings, cover art, distribution setup, and a ready release package.';

const verificationCriteria = 'EP is published and live on streaming platforms';

const planningAnswers = {
  weeklyHoursAvailable: 20,
  executionContext: 'part_time',
  capitalAvailable: 1500,
  hardDeadline: deadlineDayKey,
  existingDomainRelationships: ['distributor account access pending'],
  audience: 'Independent music listeners on streaming platforms.',
  offer: 'A polished 3-song EP with artwork, metadata, and distribution setup.',
  proof: verificationCriteria,
  startingState: 'from scratch',
  releaseChannel: 'streaming_platforms',
  publishingGoal: 'release_live',
};

function buildState() {
  return {
    vector: { day: 1, direction: epGoalText, stability: 'steady', drift: 'contained', momentum: 'active' },
    lenses: {
      aim: { description: epGoalText, horizon: '45d', narrative: '' },
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
    externalEvidenceEvents: [],
    planMutationEvents: [],
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
          goalText: epGoalText,
          goalLabel: epGoalText,
          executionType: 'CreativeProduction',
          startDate: startDayKey,
          answeredContext: planningAnswers,
        },
        goalContract: {
          goalId,
          goalText: epGoalText,
          goalLabel: epGoalText,
          executionType: 'CreativeProduction',
          startDayKey,
          temporalBinding: { startDayKey },
          deadline: { dayKey: deadlineDayKey },
          terminalOutcome: {
            text: epGoalText,
            verificationCriteria,
          },
          workWindows: {
            mon: [{ start: '10:00', end: '14:00' }],
            tue: [{ start: '10:00', end: '14:00' }],
            wed: [{ start: '10:00', end: '14:00' }],
            thu: [{ start: '10:00', end: '14:00' }],
            fri: [{ start: '10:00', end: '14:00' }],
            sat: [],
            sun: [],
          },
          planningIntake: planningAnswers,
          target: {
            count: 1,
            unit: 'released EP',
            definitionOfDone: verificationCriteria,
          },
        },
      },
    },
    pendingOnboardingInputs: {
      goalDraftV2: {
        goalText: epGoalText,
        goalLabel: epGoalText,
        executionType: 'CreativeProduction',
        startDate: startDayKey,
        answeredContext: planningAnswers,
      },
      goalText: epGoalText,
      executionType: 'CreativeProduction',
      startDate: startDayKey,
      deadline: deadlineDayKey,
      definitionOfDone: verificationCriteria,
      daysPerWeek: '5',
      minutesPerDay: '240',
      answeredContext: planningAnswers,
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
      goalText: epGoalText,
      goalLabel: epGoalText,
      executionType: 'CreativeProduction',
      startDayKey,
      deadline: { dayKey: deadlineDayKey },
      terminalOutcome: {
        text: epGoalText,
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
    goalDirective: { goalId, directiveId: 'dir-ep-loop-1' },
  };
}

describe('jericho creative production ep loop e2e regression', () => {
  it('generalizes the first complete loop from planning through execution evidence for an EP release', async () => {
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

    const generatedCycle = state.cyclesById?.[cycleId];
    const generatedPrePolicy = state.goalPolicyByGoalId?.[goalId];
    if (generatedCycle?.planStatus === 'error' || state.lastPlanError) {
      throw new Error(
        [
          'EP loop generation failed before apply.',
          `cycle.planStatus=${String(generatedCycle?.planStatus || 'missing')}`,
          `lastPlanError=${JSON.stringify(state.lastPlanError)}`,
          `llmActionCount=${String(generatedCycle?.llmActionGraph?.actions?.length || 0)}`,
          `actionCount=${String(generatedCycle?.actions?.length || 0)}`,
          `sessionCount=${String(generatedCycle?.llmSessionPlan?.length || 0)}`,
          `deliverableCount=${String(state.deliverablesByCycleId?.[cycleId]?.deliverables?.length || 0)}`,
          `proposedBlocksCount=${String(state.proposedBlocksByCycleId?.[cycleId]?.length || 0)}`,
          `feasibility.state=${String(generatedPrePolicy?.feasibility?.state || 'missing')}`,
          `feasibility.reasonCodes=${JSON.stringify(generatedPrePolicy?.feasibility?.reasonCodes || [])}`,
        ].join(' ')
      );
    }

    const applied = computeDerivedState(state as any, {
      type: 'APPLY_DRAFT_SCHEDULE',
      payload: { cycleId },
    } as any);
    const prePolicy = applied.goalPolicyByGoalId?.[goalId];
    const preShotClock = applied.systemShotClockByGoal?.[goalId];
    const cyclePlanStatus = applied.cyclesById?.[cycleId]?.planStatus || null;
    const cycleLastPlanError = applied.lastPlanError || null;
    const appliedReviewBlock = (applied.cyclesById?.[cycleId]?.scheduleReviewBlocks || []).find(
      (block: any) => block?.goalId === goalId
    );

    expect(prePolicy).toBeDefined();
    if (prePolicy?.planQuality?.state !== 'policy_clean') {
      throw new Error(
        [
          'EP loop plan-quality substrate failed.',
          `planQuality.state=${String(prePolicy?.planQuality?.state || 'missing')}`,
          `planQuality.reasonCodes=${JSON.stringify(prePolicy?.planQuality?.reasonCodes || [])}`,
          `endpointClarity=${String(prePolicy?.planQuality?.endpointClarity || 'missing')}`,
          `feasibility.state=${String(prePolicy?.feasibility?.state || 'missing')}`,
          `feasibility.reasonCodes=${JSON.stringify(prePolicy?.feasibility?.reasonCodes || [])}`,
          `cycle.planStatus=${String(cyclePlanStatus || 'missing')}`,
          `lastPlanError=${JSON.stringify(cycleLastPlanError)}`,
        ].join(' ')
      );
    }
    if (!appliedReviewBlock) {
      throw new Error(
        [
          'EP loop schedule apply produced no review block.',
          `planQuality.state=${String(prePolicy?.planQuality?.state || 'missing')}`,
          `planQuality.reasonCodes=${JSON.stringify(prePolicy?.planQuality?.reasonCodes || [])}`,
          `endpointClarity=${String(prePolicy?.planQuality?.endpointClarity || 'missing')}`,
          `feasibility.state=${String(prePolicy?.feasibility?.state || 'missing')}`,
          `feasibility.reasonCodes=${JSON.stringify(prePolicy?.feasibility?.reasonCodes || [])}`,
          `cycle.planStatus=${String(cyclePlanStatus || 'missing')}`,
          `lastPlanError=${JSON.stringify(cycleLastPlanError)}`,
        ].join(' ')
      );
    }
    expect(prePolicy?.planQuality?.state).toBe('policy_clean');
    expect(prePolicy?.planQuality?.endpointClarity).toBe('clear');
    expect(prePolicy?.planQuality?.reasonCodes || []).not.toEqual(
      expect.arrayContaining(['INTAKE_CONTEXT_REQUIRED', 'PLAN_SCOPE_INFLATED', 'PLAN_MEASURABILITY_WEAK'])
    );
    expect(prePolicy?.feasibility?.state).not.toBe('withheld');
    expect(prePolicy?.feasibility?.percent).not.toBeNull();
    expect(prePolicy?.feasibility?.score).not.toBeNull();
    expect(prePolicy?.livePos?.state).toBe('withheld');
    expect(preShotClock?.paceState).toBe('insufficient_evidence');
    expect(preShotClock?.completionRatio).toBe(0);
    expect(appliedReviewBlock).toBeDefined();

    const activated = computeDerivedState(applied as any, {
      type: 'ACTIVATE_SCHEDULE',
      payload: { cycleId },
    } as any);

    const todayBlock = (activated.today?.blocks || []).find(
      (block: any) => block?.goalId === goalId && block?.cycleId === cycleId && block?.status === 'planned'
    );
    expect(todayBlock).toBeDefined();

    const afterComplete = identityReducer(activated as any, {
      type: 'COMPLETE_BLOCK',
      id: todayBlock.id,
      source: 'user_action',
    });
    const postPolicy = afterComplete.goalPolicyByGoalId?.[goalId];
    const postShotClock = afterComplete.systemShotClockByGoal?.[goalId];
    const correction = afterComplete.executionCorrectionByGoal?.[goalId];
    const completionEvent = (afterComplete.executionEvents || []).find(
      (event: any) => event?.kind === 'complete' && event?.blockId === todayBlock.id
    );

    expect(completionEvent).toBeDefined();
    expect(completionEvent?.goalId).toBe(goalId);
    expect(completionEvent?.cycleId).toBe(cycleId);
    expect(completionEvent?.blockId).toBe(todayBlock.id);
    expect(completionEvent?.dateISO).toBe(String(todayBlock.start || '').slice(0, 10));
    expect(completionEvent?.temporalRelation).toBe('on_time');
    expect(completionEvent?.source).toBe('user_action');

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

    const afterExternalEvidence = identityReducer(afterComplete as any, {
      type: 'ADD_EXTERNAL_EVIDENCE',
      payload: {
        goalId,
        cycleId,
        blockId: todayBlock.id,
        actionId: todayBlock.actionId,
        evidenceType: 'artifact_published',
        dateISO: String(todayBlock.start || '').slice(0, 10),
        source: 'user_confirmed',
        confidence: 'high',
        note: 'EP published to streaming platforms.',
      },
    });
    const externalEvidenceEvent = (afterExternalEvidence.externalEvidenceEvents || []).find(
      (event: any) => event?.evidenceType === 'artifact_published' && event?.goalId === goalId
    );
    const postExternalPolicy = afterExternalEvidence.goalPolicyByGoalId?.[goalId];

    expect(externalEvidenceEvent).toBeDefined();
    expect(externalEvidenceEvent?.kind).toBe('external_evidence');
    expect((afterExternalEvidence.executionEvents || []).some((event: any) => event?.kind === 'external_evidence')).toBe(
      false
    );
    expect(postExternalPolicy?.feasibility?.percent).toBe(prePolicy?.feasibility?.percent);
    expect(postExternalPolicy?.livePos?.externalEvidenceCount).toBeGreaterThan(0);
    expect(postExternalPolicy?.livePos?.percent).toBeGreaterThanOrEqual(postPolicy?.livePos?.percent || 0);
  });
});
