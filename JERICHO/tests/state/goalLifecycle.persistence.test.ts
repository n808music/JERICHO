import { describe, expect, it } from 'vitest';

import { computeDerivedState } from '../../src/state/identityCompute.js';
import {
  buildBlankIdentityState,
  DEFAULT_PROFILE_ID,
  identityReducer,
  rehydratePersistedState,
} from '../../src/state/identityStore.js';

const cycleId = 'cycle-persist-1';
const goalId = 'goal-persist-1';
const dayKey = '2026-05-10';
const blockId = 'blk-persist-1';

function buildPersistenceGovernanceContract() {
  return {
    contractId: `gov-${goalId}`,
    version: 1,
    goalId,
    activeFromISO: dayKey,
    activeUntilISO: '2026-06-09',
    scope: { domainsAllowed: ['Focus'], timeHorizon: 'week', timezone: 'UTC' },
    governance: {
      suggestionsEnabled: true,
      probabilityEnabled: true,
      minEvidenceEvents: 0,
      cooldowns: { resuggestMinutes: 30, maxSuggestionsPerDay: 6 },
    },
    constraints: {
      forbiddenDirectives: ['repair'],
      maxActiveBlocks: 6,
    },
  };
}

function buildAppliedReviewState() {
  const state = buildBlankIdentityState({
    timeZone: 'UTC',
    nowISO: `${dayKey}T12:00:00.000Z`,
    todayDate: dayKey,
  }) as any;
  state.activeCycleId = cycleId;
  state.activeGoalId = goalId;
  state.goalExecutionContract = {
    goalId,
    goalText: 'Create a case study',
    startDayKey: dayKey,
    deadline: { dayKey: '2026-06-09' },
    terminalOutcome: { text: 'Published case-study page', verificationCriteria: 'Published case-study page' },
  };
  state.goalAdmissionByGoal = {
    [goalId]: {
      status: 'ADMITTED',
      reasonCodes: [],
    },
  };
  state.cyclesById = {
    [cycleId]: {
      id: cycleId,
      status: 'active',
      startedAtDayKey: dayKey,
      goalContract: {
        goalId,
        goalText: 'Create a project-management portfolio case study',
        familyClass: 'internally_controlled',
        executionType: 'ProfessionalQualification',
        archetype: 'ProfessionalQualification',
        startDayKey: dayKey,
        endDayKey: '2026-06-09',
        workWindows: {
          mon: [{ start: '09:00', end: '17:00' }],
          tue: [{ start: '09:00', end: '17:00' }],
          wed: [{ start: '09:00', end: '17:00' }],
          thu: [{ start: '09:00', end: '17:00' }],
          fri: [{ start: '09:00', end: '17:00' }],
          sat: [],
          sun: [],
        },
        deadline: { dayKey: '2026-06-09' },
        terminalOutcome: { text: 'Published case-study page', verificationCriteria: 'Published case-study page' },
      },
      goalGovernanceContract: buildPersistenceGovernanceContract(),
      scheduleLifecycle: 'applied_review',
      scheduleAppliedAtISO: `${dayKey}T12:00:00.000Z`,
      scheduleReviewBlocks: [
        {
          id: blockId,
          cycleId,
          goalId,
          title: 'Draft charter and timeline',
          label: 'Draft charter and timeline',
          practice: 'Focus',
          domain: 'Focus',
          startISO: `${dayKey}T18:00:00.000Z`,
          endISO: `${dayKey}T19:00:00.000Z`,
          start: `${dayKey}T18:00:00.000Z`,
          end: `${dayKey}T19:00:00.000Z`,
          status: 'planned',
          requiredSystemBlock: true,
        },
      ],
      executionEvents: [],
      externalEvidenceEvents: [],
      planMutationEvents: [],
    },
  };
  state.scheduleLifecycle = 'applied_review';
  state.scheduleApplied = true;
  state.scheduleReviewBlocks = [...state.cyclesById[cycleId].scheduleReviewBlocks];
  state.today.blocks = [...state.scheduleReviewBlocks];
  state.blockStore.blocks = {
    [blockId]: { ...state.scheduleReviewBlocks[0] },
  };
  return computeDerivedState(state, { type: 'NO_OP' });
}

function buildActivatedState() {
  return computeDerivedState(buildAppliedReviewState(), {
    type: 'ACTIVATE_SCHEDULE',
    payload: { cycleId },
  } as any);
}

describe('goal lifecycle persistence and activation integrity', () => {
  it('rehydrates an applied review schedule with the same active goal and review substrate', () => {
    const applied = buildAppliedReviewState();
    const rehydrated = rehydratePersistedState(JSON.parse(JSON.stringify(applied))) as any;

    expect(rehydrated.activeProfileId).toBe(DEFAULT_PROFILE_ID);
    expect(rehydrated.profilesById[DEFAULT_PROFILE_ID].activeGoalId).toBe(goalId);
    expect(rehydrated.goalsById[goalId].profileId).toBe(DEFAULT_PROFILE_ID);
    expect(rehydrated.activeCycleId).toBe(cycleId);
    expect(rehydrated.activeGoalId).toBe(goalId);
    expect(rehydrated.scheduleLifecycle).toBe('applied_review');
    expect(rehydrated.cyclesById[cycleId].scheduleLifecycle).toBe('applied_review');
    expect(rehydrated.cyclesById[cycleId].scheduleReviewBlocks).toHaveLength(1);
    expect(rehydrated.goalLifecycleState).toBe('schedule_applied');
    expect(rehydrated.cyclesById[cycleId].goalLifecycleState).toBe('schedule_applied');
  });

  it('rehydrates activated execution substrate with schedule and evidence intact', () => {
    const activated = buildActivatedState();
    const completed = identityReducer(activated, {
      type: 'COMPLETE_BLOCK',
      id: blockId,
      source: 'user_action',
    } as any);
    const rehydrated = rehydratePersistedState(JSON.parse(JSON.stringify(completed))) as any;

    expect(rehydrated.activeProfileId).toBe(DEFAULT_PROFILE_ID);
    expect(rehydrated.profilesById[DEFAULT_PROFILE_ID].activeGoalId).toBe(goalId);
    expect(rehydrated.activeCycleId).toBe(cycleId);
    expect(rehydrated.activeGoalId).toBe(goalId);
    expect(rehydrated.scheduleLifecycle).toBe('active_schedule');
    expect(rehydrated.cyclesById[cycleId].scheduleLifecycle).toBe('active_schedule');
    expect((rehydrated.executionEvents || []).some((event: any) => event?.kind === 'complete' && event?.blockId === blockId)).toBe(
      true
    );
    expect(rehydrated.goalLifecycleState).toBe('in_execution');
    expect(rehydrated.today.blocks.some((block: any) => block?.id === blockId)).toBe(true);
  });

  it('rehydrates active execution by rebasing owed pre-floor work into review schedule', () => {
    const activated = buildActivatedState() as any;
    activated.appTime = {
      ...activated.appTime,
      nowISO: '2026-06-08T12:00:00.000Z',
      activeDayKey: '2026-06-08',
      isFollowingNow: true,
    };
    activated.today = {
      ...activated.today,
      date: '2026-06-08',
      blocks: [],
    };
    activated.currentWeek = { weekStart: '2026-06-08', days: [] };
    activated.cycle = [];
    activated.cyclesById[cycleId].executionStartDayKey = null;
    activated.cyclesById[cycleId].reassessmentCompletedAtISO = '2026-06-07T02:29:09.880Z';
    activated.cyclesById[cycleId].scheduleGeneratedAtISO = '2026-06-07T03:11:21.442Z';
    activated.executionEvents = [
      {
        id: 'evt-stale',
        kind: 'create',
        blockId: 'blk-stale',
        cycleId,
        goalId,
        dateISO: '2026-05-19',
        startISO: '2026-05-19T09:00:00.000Z',
        endISO: '2026-05-19T10:00:00.000Z',
        origin: 'schedule_active',
        status: 'planned',
      },
      {
        id: 'evt-forward',
        kind: 'create',
        blockId: 'blk-forward',
        cycleId,
        goalId,
        dateISO: '2026-06-08',
        startISO: '2026-06-08T09:00:00.000Z',
        endISO: '2026-06-08T10:00:00.000Z',
        origin: 'schedule_active',
        status: 'planned',
      },
    ];
    activated.cyclesById[cycleId].executionEvents = [...activated.executionEvents];

    const rehydrated = rehydratePersistedState(JSON.parse(JSON.stringify(activated))) as any;
    expect(rehydrated.cyclesById[cycleId].executionStartDayKey).toBe('2026-06-07');
    expect(rehydrated.cyclesById[cycleId].scheduleLifecycle).toBe('applied_review');
    expect(rehydrated.scheduleLifecycle).toBe('applied_review');
    expect((rehydrated.cyclesById[cycleId].scheduleReviewBlocks || []).length).toBeGreaterThan(0);
    expect(
      (rehydrated.cyclesById[cycleId].scheduleReviewBlocks || []).every((block: any) => {
        const dayKey = block?.dayKey || block?.startISO?.slice(0, 10) || '';
        return dayKey >= '2026-06-07';
      })
    ).toBe(true);
    expect(rehydrated.cyclesById[cycleId].activationDelayAssessment?.selectedResolution).toBe('rebase');
    expect((rehydrated.executionEvents || []).some((event: any) => event?.blockId === 'blk-stale' && event?.kind === 'create')).toBe(false);
  });

  it('blocks completion before official activation', () => {
    const applied = buildAppliedReviewState();
    const next = identityReducer(applied, {
      type: 'COMPLETE_BLOCK',
      id: blockId,
      source: 'user_action',
    } as any);

    expect(next.lastPlanError?.code).toBe('EXECUTION_REQUIRES_ACTIVATION');
    expect((next.executionEvents || []).some((event: any) => event?.kind === 'complete' && event?.blockId === blockId)).toBe(false);
    expect(next.today.blocks.find((block: any) => block?.id === blockId)?.status).toBe('planned');
  });

  it('allows completion after activation', () => {
    const activated = buildActivatedState();
    const next = identityReducer(activated, {
      type: 'COMPLETE_BLOCK',
      id: blockId,
      source: 'user_action',
    } as any);

    const completionEvent = (next.executionEvents || []).find((event: any) => event?.kind === 'complete' && event?.blockId === blockId);
    expect(completionEvent).toBeDefined();
    expect(next.goalLifecycleState).toBe('in_execution');
  });

  it('reset returns a true blank state without ghost goal substrate', () => {
    const activated = buildActivatedState();
    const reset = identityReducer(activated, { type: 'RESET_IDENTITY' } as any);

    expect(reset.activeProfileId).toBe(DEFAULT_PROFILE_ID);
    expect(reset.profilesById[DEFAULT_PROFILE_ID]).toBeDefined();
    expect(reset.activeCycleId).toBeNull();
    expect(reset.activeGoalId).toBeNull();
    expect(reset.profilesById[DEFAULT_PROFILE_ID].activeGoalId).toBeNull();
    expect(reset.goalExecutionContract).toBeNull();
    expect(reset.scheduleLifecycle).toBe('no_schedule');
    expect(reset.goalLifecycleState).toBe('blank');
    expect(Object.keys(reset.cyclesById || {})).toHaveLength(0);
    expect(reset.executionEvents || []).toHaveLength(0);
    expect(reset.externalEvidenceEvents || []).toHaveLength(0);
    expect(reset.planMutationEvents || []).toHaveLength(0);
    expect(reset.today.blocks || []).toHaveLength(0);
    expect(Object.keys(reset.blockStore?.blocks || {})).toHaveLength(0);
  });
});
