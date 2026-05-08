import { describe, expect, it } from 'vitest';

import { computeDerivedState } from '../../src/state/identityCompute.js';
import { identityReducer } from '../../src/state/identityStore.js';

const cycleId = 'cycle-activation-1';
const goalId = 'goal-activation-1';
const dayKey = '2026-05-10';
const blockId = 'blk-activation-1';

function buildGovernanceContract() {
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
    constraints: { forbiddenDirectives: ['repair'], maxActiveBlocks: 6 },
  };
}

function buildAppliedReviewState() {
  const state: any = {
    activeProfileId: 'profile-local-default',
    profilesById: {
      'profile-local-default': {
        id: 'profile-local-default',
        label: 'Local Profile',
        goalIds: [goalId],
        activeGoalId: goalId,
        status: 'active',
      },
    },
    goalsById: {
      [goalId]: {
        id: goalId,
        profileId: 'profile-local-default',
        cycleIds: [cycleId],
        activeCycleId: cycleId,
        status: 'active',
      },
    },
    activeCycleId: cycleId,
    activeGoalId: goalId,
    goalExecutionContract: {
      goalId,
      profileId: 'profile-local-default',
      goalText: 'Create a case study',
      startDayKey: dayKey,
      deadline: { dayKey: '2026-06-09' },
      terminalOutcome: { text: 'Published case-study page', verificationCriteria: 'Published case-study page' },
    },
    goalAdmissionByGoal: { [goalId]: { status: 'ADMITTED', reasonCodes: [] } },
    cyclesById: {
      [cycleId]: {
        id: cycleId,
        status: 'active',
        goalId,
        profileId: 'profile-local-default',
        startedAtDayKey: dayKey,
        goalContract: {
          goalId,
          profileId: 'profile-local-default',
          goalText: 'Create a project-management portfolio case study',
          familyClass: 'internally_controlled',
          executionType: 'ProfessionalQualification',
          archetype: 'ProfessionalQualification',
          startDayKey: dayKey,
          endDayKey: '2026-06-09',
          deadline: { dayKey: '2026-06-09' },
          terminalOutcome: { text: 'Published case-study page', verificationCriteria: 'Published case-study page' },
        },
        goalGovernanceContract: buildGovernanceContract(),
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
    },
    scheduleLifecycle: 'applied_review',
    scheduleApplied: true,
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
    today: { date: dayKey, blocks: [] },
    cycle: [],
    currentWeek: { days: [], metrics: {} },
    blockStore: { blocks: {} },
    appTime: { nowISO: `${dayKey}T12:00:00.000Z`, activeDayKey: dayKey, timeZone: 'UTC', isFollowingNow: true },
    vector: { day: 1, direction: '', stability: 'steady', drift: 'contained', momentum: 'quiet' },
    lenses: {
      pattern: { dailyTargets: [], routines: {}, defaultMinutes: 30 },
      aim: { description: '', horizon: '90d' },
      flow: { streams: [] },
      practice: { defaults: {} },
    },
    viewDate: dayKey,
    templates: { objectives: {} },
    meta: { version: '1.0.0', onboardingComplete: true },
    stability: {},
    recurringPatterns: [],
    ledger: [],
  };
  state.today.blocks = [...state.scheduleReviewBlocks];
  state.cycle = [{ date: dayKey, blocks: [...state.scheduleReviewBlocks] }];
  state.currentWeek = { weekStart: dayKey, days: [{ date: dayKey, blocks: [...state.scheduleReviewBlocks] }], metrics: {} };
  state.blockStore.blocks = { [blockId]: { ...state.scheduleReviewBlocks[0] } };
  return computeDerivedState(state, { type: 'NO_OP' });
}

function buildActivatedState() {
  return computeDerivedState(buildAppliedReviewState(), {
    type: 'ACTIVATE_SCHEDULE',
    payload: { cycleId },
  } as any);
}

describe('activation containment for execution mutations', () => {
  it('blocks begin, update, and reschedule before activation', () => {
    const applied = buildAppliedReviewState();

    const begun = identityReducer(applied, { type: 'BEGIN_BLOCK', id: blockId } as any);
    expect(begun.lastPlanError?.code).toBe('EXECUTION_REQUIRES_ACTIVATION');
    expect(begun.today.blocks.find((block: any) => block.id === blockId)?.status).toBe('planned');

    const updated = identityReducer(applied, {
      type: 'UPDATE_BLOCK',
      payload: { id: blockId, title: 'Updated before activation' },
    } as any);
    expect(updated.lastPlanError?.code).toBe('EXECUTION_REQUIRES_ACTIVATION');
    expect(updated.today.blocks.find((block: any) => block.id === blockId)?.title).toBe('Draft charter and timeline');

    const rescheduled = identityReducer(applied, {
      type: 'RESCHEDULE_BLOCK',
      id: blockId,
      start: `${dayKey}T20:00:00.000Z`,
      end: `${dayKey}T21:00:00.000Z`,
    } as any);
    expect(rescheduled.lastPlanError?.code).toBe('EXECUTION_REQUIRES_ACTIVATION');
    expect(rescheduled.today.blocks.find((block: any) => block.id === blockId)?.start).toBe(`${dayKey}T18:00:00.000Z`);
  });

  it('blocks external evidence attachment before activation', () => {
    const applied = buildAppliedReviewState();
    const next = identityReducer(applied, {
      type: 'ADD_EXTERNAL_EVIDENCE',
      payload: { cycleId, goalId, evidenceType: 'submission_confirmed' },
    } as any);

    expect(next.lastPlanError?.code).toBe('EXECUTION_REQUIRES_ACTIVATION');
    expect(next.externalEvidenceEvents || []).toHaveLength(0);
  });

  it('allows begin, reschedule, and external evidence after activation', () => {
    const activated = buildActivatedState();

    const begun = identityReducer(activated, { type: 'BEGIN_BLOCK', id: blockId } as any);
    expect(begun.lastPlanError).toBeNull();

    const rescheduled = identityReducer(activated, {
      type: 'RESCHEDULE_BLOCK',
      id: blockId,
      start: `${dayKey}T20:00:00.000Z`,
      end: `${dayKey}T21:00:00.000Z`,
    } as any);
    expect(rescheduled.lastPlanError).toBeNull();
    expect(rescheduled.today.blocks.find((block: any) => block.id === blockId)?.start).toBe(`${dayKey}T20:00:00.000Z`);

    const withEvidence = identityReducer(activated, {
      type: 'ADD_EXTERNAL_EVIDENCE',
      payload: { cycleId, goalId, evidenceType: 'submission_confirmed' },
    } as any);
    expect(withEvidence.lastPlanError).toBeNull();
    expect(withEvidence.externalEvidenceEvents || []).toHaveLength(1);
  });
});
