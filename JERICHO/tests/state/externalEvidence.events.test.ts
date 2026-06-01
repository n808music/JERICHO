import { describe, expect, it } from 'vitest';
import { buildGoalIntakeContract } from '../../src/domain/goal/GoalIntakeContract.ts';
import { computeDerivedState } from '../../src/state/identityCompute.js';
import { identityReducer } from '../../src/state/identityStore.js';
import { evaluateExecutionCorrection } from '../../src/state/engine/executionCorrectionEvaluator.ts';

const GOAL_ID = 'goal-external-evidence-1';
const CYCLE_ID = 'cycle-external-evidence-1';

function buildState({
  executionEvents = [
    {
      id: 'evt-complete-1',
      cycleId: CYCLE_ID,
      goalId: GOAL_ID,
      kind: 'complete',
      status: 'completed',
      dateISO: '2026-05-02',
      blockId: 'b1',
      actionId: 'a1',
      deliverableId: 'd1',
      linkageStatus: 'LINKED',
      requiredSystemBlock: true,
      completed: true,
      rawLabel: 'Reach out to supplier',
      domain: 'Focus',
      minutes: 60,
    },
  ],
  externalEvidenceEvents = [],
} = {}) {
  const intake = buildGoalIntakeContract({
    goalId: GOAL_ID,
    rawGoalText: 'Launch caffeinated gum brand to first real sales',
    verificationCriteria: 'First real sale confirmed',
    executionType: 'BrandLaunch',
    deadline: '2027-08-01',
  });

  return {
    today: {
      date: '2026-05-03',
      blocks: [],
      completionRate: 0,
      driftSignal: 'contained',
      loadByPractice: {},
      practices: [],
    },
    currentWeek: { weekStart: '2026-05-01', days: [], metrics: {} },
    cycle: [],
    viewDate: '2026-05-03',
    templates: { objectives: {} },
    lastAdaptedDate: null,
    stability: { headline: '', actionLine: '' },
    meta: { version: '1.0.0', onboardingComplete: false },
    recurringPatterns: [],
    lastSessionChange: null,
    nextSuggestion: null,
    ledger: [],
    executionEvents,
    externalEvidenceEvents,
    planMutationEvents: [],
    aspirations: [],
    aspirationsByCycleId: {},
    cyclesById: {
      [CYCLE_ID]: {
        id: CYCLE_ID,
        status: 'ACTIVE',
        startedAtDayKey: '2026-05-01',
        executionGraphReady: true,
        scheduleAppliedAtISO: '2026-05-01T12:00:00.000Z',
        goalContract: {
          goalId: GOAL_ID,
          cycleId: CYCLE_ID,
          goalIntakeContract: intake,
          familyClass: 'internally_controlled',
          archetype: 'BrandLaunch',
          terminalOutcome: {
            text: 'Launch caffeinated gum brand to first real sales',
            verificationCriteria: 'First real sale confirmed',
            isConcrete: true,
          },
          startDayKey: '2026-05-01',
          endDayKey: '2027-08-01',
          deadline: { dayKey: '2027-08-01' },
          workWindows: {
            mon: [{ start: '09:00', end: '11:00' }],
            tue: [{ start: '09:00', end: '11:00' }],
            wed: [{ start: '09:00', end: '11:00' }],
            thu: [{ start: '09:00', end: '11:00' }],
            fri: [{ start: '09:00', end: '11:00' }],
            sat: [],
            sun: [],
          },
        },
        goalGovernanceContract: {
          contractId: `gov-${GOAL_ID}`,
          version: 1,
          goalId: GOAL_ID,
          activeFromISO: '2026-05-01',
          activeUntilISO: '2027-08-01',
          scope: { domainsAllowed: ['Focus'], timeHorizon: 'week', timezone: 'UTC' },
          governance: { probabilityEnabled: true, minEvidenceEvents: 0 },
        },
        planProof: { feasibilityStatus: 'FEASIBLE' },
        actions: [
          { id: 'a1', title: 'Reach out to supplier', actionType: 'execution', dependencies: [], dependencyDetails: [] },
          { id: 'a2', title: 'Review quotes', actionType: 'execution', dependencies: ['a1'], dependencyDetails: [] },
        ],
        canonicalDeliverables: [
          { id: 'd1', title: 'Supplier outreach', actionIds: ['a1'] },
          { id: 'd2', title: 'Quote review', actionIds: ['a2'] },
        ],
        scheduleReviewBlocks: [
          {
            id: 'b1',
            goalId: GOAL_ID,
            cycleId: CYCLE_ID,
            deliverableId: 'd1',
            actionId: 'a1',
            title: 'Reach out to supplier',
            start: '2026-05-02T14:00:00.000Z',
            durationMinutes: 60,
            requiredSystemBlock: true,
          },
        ],
        proposedBlocks: [],
        suggestedBlocks: [],
        executionEvents: executionEvents.map((event) => ({ ...event })),
        externalEvidenceEvents: externalEvidenceEvents.map((event) => ({ ...event })),
        planMutationEvents: [],
      },
    },
    cycleOrder: [CYCLE_ID],
    activeCycleId: CYCLE_ID,
    appTime: {
      timeZone: 'UTC',
      nowISO: '2026-05-03T12:00:00.000Z',
      activeDayKey: '2026-05-03',
      isFollowingNow: true,
    },
    constraints: { maxBlocksPerDay: 4, maxBlocksPerWeek: 16 },
    goalAdmissionByGoal: { [GOAL_ID]: { status: 'ADMITTED' } },
    probabilityByGoal: {},
    probabilityStatusByGoal: { [GOAL_ID]: { status: 'computed' } },
    feasibilityByGoal: {},
    deliverablesByCycleId: {
      [CYCLE_ID]: {
        deliverables: [
          { id: 'd1', title: 'Supplier outreach', actionIds: ['a1'] },
          { id: 'd2', title: 'Quote review', actionIds: ['a2'] },
        ],
        scaffoldGroups: [],
      },
    },
  };
}

describe('external evidence events', () => {
  it('adds a sale_occurred event as external evidence, not execution evidence, and persists it', () => {
    const base = computeDerivedState(buildState(), { type: 'NO_OP' });
    const next = identityReducer(base, {
      type: 'ADD_EXTERNAL_EVIDENCE',
      payload: {
        evidenceType: 'sale_occurred',
        goalId: GOAL_ID,
        cycleId: CYCLE_ID,
        dateISO: '2026-05-03',
        source: 'user_confirmed',
        confidence: 'high',
        note: 'First sale landed on Shopify',
      },
    });

    expect(next.executionEvents).toHaveLength(1);
    expect(next.externalEvidenceEvents).toHaveLength(1);
    expect(next.externalEvidenceEvents[0].kind).toBe('external_evidence');
    expect(next.externalEvidenceEvents[0].evidenceType).toBe('sale_occurred');
    expect(next.externalEvidenceEvents[0].goalId).toBe(GOAL_ID);
    expect(next.externalEvidenceEvents[0].cycleId).toBe(CYCLE_ID);
    expect(next.cyclesById[CYCLE_ID].externalEvidenceEvents).toHaveLength(1);

    const persisted = computeDerivedState(next, { type: 'NO_OP' });
    expect(persisted.externalEvidenceEvents).toHaveLength(1);
    expect(persisted.cyclesById[CYCLE_ID].externalEvidenceEvents).toHaveLength(1);
  });

  it('raises correction risk for negative external evidence and repeated no response', () => {
    const rejected = evaluateExecutionCorrection({
      goalId: GOAL_ID,
      cycleId: CYCLE_ID,
      executionEvents: buildState().executionEvents,
      externalEvidenceEvents: [
        {
          id: 'ext-reject-1',
          kind: 'external_evidence',
          evidenceType: 'rejection_received',
          goalId: GOAL_ID,
          cycleId: CYCLE_ID,
          dateISO: '2026-05-03',
          recordedAtISO: '2026-05-03T12:00:00.000Z',
          source: 'user_confirmed',
          confidence: 'high',
        },
      ],
      canonicalActions: [
        { id: 'a1', dependencyDetails: [] },
        { id: 'a2', dependencyDetails: [] },
      ],
    });
    expect(rejected.level).toBe('compression_warning');
    expect(rejected.reasonCodes).toContain('negative_external_evidence');

    const noResponse = evaluateExecutionCorrection({
      goalId: GOAL_ID,
      cycleId: CYCLE_ID,
      executionEvents: buildState().executionEvents,
      externalEvidenceEvents: [
        {
          id: 'ext-noresp-1',
          kind: 'external_evidence',
          evidenceType: 'no_response',
          goalId: GOAL_ID,
          cycleId: CYCLE_ID,
          dateISO: '2026-05-03',
          recordedAtISO: '2026-05-03T12:00:00.000Z',
          source: 'user_confirmed',
          confidence: 'moderate',
        },
        {
          id: 'ext-noresp-2',
          kind: 'external_evidence',
          evidenceType: 'no_response',
          goalId: GOAL_ID,
          cycleId: CYCLE_ID,
          dateISO: '2026-05-05',
          recordedAtISO: '2026-05-05T12:00:00.000Z',
          source: 'user_confirmed',
          confidence: 'moderate',
        },
      ],
      canonicalActions: [
        { id: 'a1', dependencyDetails: [] },
        { id: 'a2', dependencyDetails: [] },
      ],
    });
    expect(noResponse.level).toBe('plan_evolution_required');
    expect(noResponse.reasonCodes).toContain('external_no_response_pattern');
  });

  it('maps external dependency blocked to dependency impact', () => {
    const next = evaluateExecutionCorrection({
      goalId: GOAL_ID,
      cycleId: CYCLE_ID,
      executionEvents: buildState().executionEvents,
      externalEvidenceEvents: [
        {
          id: 'ext-blocked-1',
          kind: 'external_evidence',
          evidenceType: 'external_dependency_blocked',
          goalId: GOAL_ID,
          cycleId: CYCLE_ID,
          dateISO: '2026-05-03',
          recordedAtISO: '2026-05-03T12:00:00.000Z',
          source: 'user_confirmed',
          confidence: 'high',
        },
      ],
      canonicalActions: [
        { id: 'a1', dependencyDetails: [] },
        { id: 'a2', dependencyDetails: [] },
      ],
    });

    expect(next.level).toBe('dependency_impact');
    expect(next.reasonCodes).toContain('external_dependency_blocked');
  });

  it('lets positive external evidence lift live pos without changing initial feasibility', () => {
    const before = computeDerivedState(buildState(), { type: 'NO_OP' });
    const after = computeDerivedState(
      buildState({
        externalEvidenceEvents: [
          {
            id: 'ext-sale-1',
            kind: 'external_evidence',
            evidenceType: 'sale_occurred',
            goalId: GOAL_ID,
            cycleId: CYCLE_ID,
            dateISO: '2026-05-03',
            recordedAtISO: '2026-05-03T12:00:00.000Z',
            source: 'user_confirmed',
            confidence: 'high',
          },
        ],
      }),
      { type: 'NO_OP' }
    );

    expect(after.goalPolicyByGoalId[GOAL_ID].feasibility.percent).toBe(before.goalPolicyByGoalId[GOAL_ID].feasibility.percent);
    expect(after.goalPolicyByGoalId[GOAL_ID].livePos.state).toMatch(/^(provisional|available|eligible)$/);
    expect(after.goalPolicyByGoalId[GOAL_ID].livePos.percent).toBeGreaterThanOrEqual(
      before.goalPolicyByGoalId[GOAL_ID].livePos.percent || 0
    );
    expect(after.goalPolicyByGoalId[GOAL_ID].livePos.externalEvidenceCount).toBe(1);
    expect(after.goalPolicyByGoalId[GOAL_ID].livePos.positiveExternalEvidenceCount).toBe(1);
  });
});
