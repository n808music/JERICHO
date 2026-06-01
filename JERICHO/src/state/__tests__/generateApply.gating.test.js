import { describe, it, expect } from 'vitest';
import { computeDerivedState } from '../identityCompute.js';
import { buildLocalStartISO } from '../time/time.ts';

const FIXED_DAY = '2026-01-08';

function buildBaseState() {
  return {
    vector: { day: 1, direction: '', stability: 'steady', drift: 'contained', momentum: 'active' },
    lenses: {
      aim: { description: '', horizon: '90d', narrative: '' },
      pattern: { routines: { Body: [], Resources: [], Creation: [], Focus: [] }, dailyTargets: [], defaultMinutes: 30 },
      flow: { streams: [] },
    },
    today: {
      date: FIXED_DAY,
      blocks: [],
      completionRate: 0,
      driftSignal: 'contained',
      loadByPractice: {},
      practices: [],
    },
    currentWeek: { weekStart: FIXED_DAY, days: [], metrics: {} },
    cycle: [],
    viewDate: FIXED_DAY,
    templates: { objectives: {} },
    lastAdaptedDate: null,
    stability: { headline: '', actionLine: '' },
    meta: { version: '1.0.0', onboardingComplete: false },
    recurringPatterns: [],
    lastSessionChange: null,
    nextSuggestion: null,
    executionEvents: [],
    ledger: [],
    appTime: {
      timeZone: 'UTC',
      nowISO: `${FIXED_DAY}T12:00:00.000Z`,
      activeDayKey: FIXED_DAY,
      isFollowingNow: true,
    },
    constraints: {
      maxBlocksPerDay: 4,
      maxBlocksPerWeek: 16,
    },
  };
}

describe('generate/apply gating', () => {
  it('blocks generate when goal is not admitted', () => {
    const base = buildBaseState();
    const onboarded = computeDerivedState(base, {
      type: 'COMPLETE_ONBOARDING',
      onboarding: {
        direction: 'Goal A',
        goalText: 'Goal A',
        horizon: '30d',
        narrative: '',
        focusAreas: ['Focus'],
        successDefinition: 'Outcome',
        minimumDaysPerWeek: 4,
      },
    });
    const goalId = onboarded.goalExecutionContract?.goalId;
    const rejected = {
      ...onboarded,
      goalAdmissionByGoal: {
        ...(onboarded.goalAdmissionByGoal || {}),
        [goalId]: { status: 'REJECTED_INFEASIBLE', reasonCodes: ['REQUIRED_PACE_EXCEEDS_MAX_PER_DAY'] },
      },
    };
    const planned = computeDerivedState(rejected, { type: 'GENERATE_PLAN' });
    expect(planned.lastPlanError?.code).toBe('GOAL_NOT_ADMITTED');
    expect(planned.cyclesById?.[planned.activeCycleId]?.autoAsanaPlan).toBeFalsy();
  });

  it('blocks apply when no reviewed draft proposals exist, even if legacy auto plan conflicts are present', () => {
    const base = buildBaseState();
    const onboarded = computeDerivedState(base, {
      type: 'COMPLETE_ONBOARDING',
      onboarding: {
        direction: 'Goal B',
        goalText: 'Goal B',
        horizon: '30d',
        narrative: '',
        focusAreas: ['Creation'],
        successDefinition: 'Outcome',
        minimumDaysPerWeek: 4,
      },
    });
    const goalId = onboarded.goalExecutionContract?.goalId;
    const cycleId = onboarded.activeCycleId;
    const startISO = buildLocalStartISO(FIXED_DAY, '09:00', 'UTC').startISO;
    const blocked = {
      ...onboarded,
      goalAdmissionByGoal: {
        ...(onboarded.goalAdmissionByGoal || {}),
        [goalId]: { status: 'ADMITTED', reasonCodes: [], admittedAtISO: `${FIXED_DAY}T10:00:00.000Z` },
      },
      cyclesById: {
        ...onboarded.cyclesById,
        [cycleId]: {
          ...onboarded.cyclesById[cycleId],
          autoAsanaPlan: {
            horizon: { startDayKey: FIXED_DAY, endDayKey: FIXED_DAY, daysCount: 1 },
            horizonBlocks: [{ id: 'blk-1', startISO, durationMinutes: 60, title: 'Block' }],
            conflicts: [{ kind: 'UNSCHEDULABLE', code: 'OVERLAP_ALL_SLOTS' }],
          },
        },
      },
    };
    const applied = computeDerivedState(blocked, { type: 'APPLY_PLAN' });
    expect(applied.lastPlanError?.code).toBe('NO_PROPOSED_BLOCKS');
    const creates = (applied.executionEvents || []).filter((e) => e?.kind === 'create');
    expect(creates.length).toBe(0);
  });

  it('requires explicit ACCEPT_PARTIAL_PLAN before applying a horizon-insufficient draft', () => {
    const base = buildBaseState();
    const onboarded = computeDerivedState(base, {
      type: 'COMPLETE_ONBOARDING',
      onboarding: {
        direction: 'Goal C',
        goalText: 'Goal C',
        horizon: '30d',
        narrative: '',
        focusAreas: ['Creation'],
        successDefinition: 'Outcome',
        minimumDaysPerWeek: 4,
      },
    });
    const goalId = onboarded.goalExecutionContract?.goalId;
    const cycleId = onboarded.activeCycleId;
    const startISO = buildLocalStartISO(FIXED_DAY, '09:00', 'UTC').startISO;
    const blocked = {
      ...onboarded,
      pendingPlanConfirmation: true,
      proposedBlocks: [
        {
          id: 'pb-1',
          goalId,
          cycleId,
          status: 'suggested',
          title: 'Partial block',
          startISO,
          endISO: buildLocalStartISO(FIXED_DAY, '10:00', 'UTC').startISO,
          dayKey: FIXED_DAY,
          durationMinutes: 60,
        },
      ],
      suggestedBlocks: [
        {
          id: 'pb-1',
          goalId,
          cycleId,
          status: 'suggested',
          title: 'Partial block',
          startISO,
          endISO: buildLocalStartISO(FIXED_DAY, '10:00', 'UTC').startISO,
          dayKey: FIXED_DAY,
          durationMinutes: 60,
        },
      ],
      proposedBlocksByCycleId: {
        [cycleId]: [
          {
            id: 'pb-1',
            goalId,
            cycleId,
            status: 'suggested',
            title: 'Partial block',
            startISO,
            endISO: buildLocalStartISO(FIXED_DAY, '10:00', 'UTC').startISO,
            dayKey: FIXED_DAY,
            durationMinutes: 60,
          },
        ],
      },
      goalAdmissionByGoal: {
        ...(onboarded.goalAdmissionByGoal || {}),
        [goalId]: { status: 'ADMITTED', reasonCodes: [], admittedAtISO: `${FIXED_DAY}T10:00:00.000Z` },
      },
      cyclesById: {
        ...onboarded.cyclesById,
        [cycleId]: {
          ...onboarded.cyclesById[cycleId],
          proposedBlocks: [
            {
              id: 'pb-1',
              goalId,
              cycleId,
              status: 'suggested',
              title: 'Partial block',
              startISO,
              endISO: buildLocalStartISO(FIXED_DAY, '10:00', 'UTC').startISO,
              dayKey: FIXED_DAY,
              durationMinutes: 60,
            },
          ],
          autoAsanaPlan: {
            horizon: { startDayKey: FIXED_DAY, endDayKey: FIXED_DAY, daysCount: 1 },
            horizonBlocks: [{ id: 'blk-1', startISO, durationMinutes: 60, title: 'Block' }],
            conflicts: [],
            unscheduledDrafts: [
              {
                id: 'unscheduled-1',
                title: 'Deferred block',
                actionId: 'cycle-4-action',
                targetDayKey: FIXED_DAY,
                hardGateFloorISO: `${FIXED_DAY}T09:00:00.000Z`,
              },
            ],
            summary: {
              planStatus: 'VALID_BUT_HORIZON_INSUFFICIENT',
              requiredBlockCount: 2,
              scheduledBlockCount: 1,
              unscheduledBlockCount: 1,
              acceptedBlockCount: 0,
              horizonDayCount: 1,
              candidateResolutionKinds: ['EXTEND_HORIZON', 'ACCEPT_PARTIAL_PLAN'],
              recommendations: [
                { kind: 'EXTEND_HORIZON', extensionDays: 1, extensionWeeks: 1, earliestFeasibleCompletionDate: '2026-01-09', unscheduledBlockCount: 1 },
                { kind: 'ACCEPT_PARTIAL_PLAN', scheduledBlockCount: 1, unscheduledBlockCount: 1, scheduledThroughDate: FIXED_DAY, unscheduledFromDate: FIXED_DAY },
              ],
            },
          },
        },
      },
    };

    const rejected = computeDerivedState(blocked, { type: 'APPLY_PLAN', payload: { cycleId } });
    expect(rejected.lastPlanError?.code).toBe('HORIZON_RESOLUTION_REQUIRED');

    const applied = computeDerivedState(blocked, {
      type: 'APPLY_PLAN',
      payload: { cycleId, resolutionKind: 'ACCEPT_PARTIAL_PLAN' },
    });
    expect(applied.lastPlanError).toBeNull();
    expect(applied.scheduleLifecycle).toBe('applied_review');
    expect(applied.cyclesById[cycleId].selectedPlanResolutionKind).toBe('ACCEPT_PARTIAL_PLAN');
    expect(applied.cyclesById[cycleId].lastResolvedPlanSummary?.planStatus).toBe('VALID_PARTIAL_BY_USER_CHOICE');
    expect(applied.cyclesById[cycleId].deferredScheduleBlocks).toEqual([
      expect.objectContaining({
        id: 'unscheduled-1',
        deferredReason: 'horizon_insufficient',
      }),
    ]);
  });
});
