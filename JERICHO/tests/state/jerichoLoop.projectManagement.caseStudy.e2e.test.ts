import { describe, expect, it } from 'vitest';

import { computeDerivedState } from '../../src/state/identityCompute.js';
import { identityReducer } from '../../src/state/identityStore.js';
import { createGeneratePlanWithLLM } from '../../src/state/storeLLMActions.ts';

const cycleId = 'cycle-pm-case-study-loop-1';
const goalId = 'goal-pm-case-study-loop-1';
const startDayKey = '2026-05-06';
const deadlineDayKey = '2026-07-05';

const goalText =
  'Create a project-management portfolio case study in 60 days that documents a real or simulated project, includes a clear project charter, timeline, stakeholder map, risk register, execution notes, retrospective, and a polished shareable case-study page.';

const verificationCriteria =
  'A polished, shareable project-management portfolio case-study page exists with project charter, timeline, stakeholder map, risk register, execution notes, and retrospective included.';

const planningAnswers = {
  weeklyHoursAvailable: 12,
  executionContext: 'part_time',
  capitalAvailable: 250,
  hardDeadline: deadlineDayKey,
  existingDomainRelationships: [],
  startingState: 'from scratch',
  projectContext: 'simulated_project',
  qualificationTarget: 'project-management portfolio proof artifact',
  workSampleRequirement: 'one polished case study with PM documentation artifacts',
  completionMode: 'shareable_case_study_page_published',
  projectType: 'internal operations improvement initiative',
  audience: 'Hiring managers and recruiters evaluating project-management proof of work.',
  offer: 'A polished shareable project-management case-study page with concrete artifacts and lessons learned.',
  proof: verificationCriteria,
};

function buildState() {
  return {
    vector: { day: 1, direction: goalText, stability: 'steady', drift: 'contained', momentum: 'active' },
    lenses: {
      aim: { description: goalText, horizon: '60d', narrative: '' },
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
          goalText,
          goalLabel: goalText,
          executionType: 'ProfessionalQualification',
          startDate: startDayKey,
          answeredContext: planningAnswers,
        },
        goalContract: {
          goalId,
          goalText,
          goalLabel: goalText,
          executionType: 'ProfessionalQualification',
          startDayKey,
          temporalBinding: { startDayKey },
          deadline: { dayKey: deadlineDayKey },
          terminalOutcome: {
            text: goalText,
            verificationCriteria,
          },
          workWindows: {
            mon: [{ start: '18:00', end: '20:00' }],
            tue: [{ start: '18:00', end: '20:00' }],
            wed: [{ start: '18:00', end: '20:00' }],
            thu: [{ start: '18:00', end: '20:00' }],
            fri: [{ start: '18:00', end: '20:00' }],
            sat: [{ start: '10:00', end: '12:00' }],
            sun: [],
          },
          planningIntake: planningAnswers,
          target: {
            count: 1,
            unit: 'published project-management case study',
            definitionOfDone: verificationCriteria,
          },
        },
      },
    },
    pendingOnboardingInputs: {
      goalDraftV2: {
        goalText,
        goalLabel: goalText,
        executionType: 'ProfessionalQualification',
        startDate: startDayKey,
        answeredContext: planningAnswers,
      },
      goalText,
      executionType: 'ProfessionalQualification',
      startDate: startDayKey,
      deadline: deadlineDayKey,
      definitionOfDone: verificationCriteria,
      daysPerWeek: '6',
      minutesPerDay: '120',
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
      goalText,
      goalLabel: goalText,
      executionType: 'ProfessionalQualification',
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
    goalDirective: { goalId, directiveId: 'dir-pm-case-study-loop-1' },
  };
}

describe('jericho project-management case study loop e2e regression', () => {
  it('generalizes the full loop from planning through execution evidence for a project-management case-study artifact lane', async () => {
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
          'Project-management case-study loop generation failed before apply.',
          `cycle.planStatus=${String(generatedCycle?.planStatus || 'missing')}`,
          `lastPlanError=${JSON.stringify(state.lastPlanError)}`,
          `llmActionCount=${String(generatedCycle?.llmActionGraph?.actions?.length || 0)}`,
          `actionCount=${String(generatedCycle?.actions?.length || 0)}`,
          `sessionCount=${String(generatedCycle?.llmSessionPlan?.length || 0)}`,
          `deliverableCount=${String(state.deliverablesByCycleId?.[cycleId]?.deliverables?.length || 0)}`,
          `proposedBlocksCount=${String(state.proposedBlocksByCycleId?.[cycleId]?.length || 0)}`,
          `endpointClarity=${String(generatedPrePolicy?.planQuality?.endpointClarity || 'missing')}`,
          `planQuality.state=${String(generatedPrePolicy?.planQuality?.state || 'missing')}`,
          `planQuality.reasonCodes=${JSON.stringify(generatedPrePolicy?.planQuality?.reasonCodes || [])}`,
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
    const deliverableCount = state.deliverablesByCycleId?.[cycleId]?.deliverables?.length || 0;
    const actionCount = applied.cyclesById?.[cycleId]?.actions?.length || 0;
    const sessionPlanCount = applied.cyclesById?.[cycleId]?.llmSessionPlan?.length || 0;
    const proposedBlocksCount = applied.proposedBlocksByCycleId?.[cycleId]?.length || 0;
    const appliedReviewBlock = (applied.cyclesById?.[cycleId]?.scheduleReviewBlocks || []).find(
      (block: any) => block?.goalId === goalId
    );

    expect(prePolicy).toBeDefined();
    if (prePolicy?.planQuality?.state !== 'policy_clean') {
      throw new Error(
        [
          'Project-management case-study loop plan-quality substrate failed.',
          `planQuality.state=${String(prePolicy?.planQuality?.state || 'missing')}`,
          `planQuality.reasonCodes=${JSON.stringify(prePolicy?.planQuality?.reasonCodes || [])}`,
          `endpointClarity=${String(prePolicy?.planQuality?.endpointClarity || 'missing')}`,
          `feasibility.state=${String(prePolicy?.feasibility?.state || 'missing')}`,
          `feasibility.reasonCodes=${JSON.stringify(prePolicy?.feasibility?.reasonCodes || [])}`,
          `cycle.planStatus=${String(cyclePlanStatus || 'missing')}`,
          `lastPlanError=${JSON.stringify(cycleLastPlanError)}`,
          `deliverableCount=${String(deliverableCount)}`,
          `actionCount=${String(actionCount)}`,
          `sessionPlanCount=${String(sessionPlanCount)}`,
          `proposedBlocksCount=${String(proposedBlocksCount)}`,
        ].join(' ')
      );
    }
    if (!appliedReviewBlock) {
      throw new Error(
        [
          'Project-management case-study loop schedule apply produced no review block.',
          `planQuality.state=${String(prePolicy?.planQuality?.state || 'missing')}`,
          `planQuality.reasonCodes=${JSON.stringify(prePolicy?.planQuality?.reasonCodes || [])}`,
          `endpointClarity=${String(prePolicy?.planQuality?.endpointClarity || 'missing')}`,
          `feasibility.state=${String(prePolicy?.feasibility?.state || 'missing')}`,
          `feasibility.reasonCodes=${JSON.stringify(prePolicy?.feasibility?.reasonCodes || [])}`,
          `cycle.planStatus=${String(cyclePlanStatus || 'missing')}`,
          `lastPlanError=${JSON.stringify(cycleLastPlanError)}`,
          `deliverableCount=${String(deliverableCount)}`,
          `actionCount=${String(actionCount)}`,
          `sessionPlanCount=${String(sessionPlanCount)}`,
          `proposedBlocksCount=${String(proposedBlocksCount)}`,
        ].join(' ')
      );
    }

    expect(prePolicy?.planQuality?.endpointClarity).toBe('clear');
    expect(prePolicy?.planQuality?.state).toBe('policy_clean');
    expect(prePolicy?.feasibility?.state).not.toBe('withheld');
    expect(prePolicy?.feasibility?.percent).not.toBeNull();
    expect(prePolicy?.feasibility?.score).not.toBeNull();
    expect(prePolicy?.livePos?.state).toBe('withheld');
    expect(preShotClock?.paceState).toBe('insufficient_evidence');
    expect(preShotClock?.completionRatio).toBe(0);
    expect(cyclePlanStatus).toBe('ready');
    expect(cycleLastPlanError).toBeNull();
    expect(deliverableCount).toBeGreaterThan(0);
    expect(actionCount).toBeGreaterThan(0);
    expect(sessionPlanCount).toBeGreaterThan(0);
    expect(proposedBlocksCount).toBeGreaterThan(0);
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

    expect(['provisional', 'available']).toContain(postPolicy?.livePos?.state);
    expect(postPolicy?.livePos?.percent).not.toBeNull();
    expect(postPolicy?.livePos?.scoreValue).not.toBeNull();
    expect(postPolicy?.livePos?.percent).toBeGreaterThanOrEqual(prePolicy?.feasibility?.percent || 0);
    expect(postPolicy?.livePos?.evidenceCount).toBeGreaterThan(0);

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
        note: 'Case-study page published and shareable.',
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
