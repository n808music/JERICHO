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
      flow: { streams: [] }
    },
    today: { date: FIXED_DAY, blocks: [], completionRate: 0, driftSignal: 'contained', loadByPractice: {}, practices: [] },
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
      isFollowingNow: true
    },
    constraints: {
      maxBlocksPerDay: 4,
      maxBlocksPerWeek: 16
    }
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
        minimumDaysPerWeek: 4
      }
    });
    const goalId = onboarded.goalExecutionContract?.goalId;
    const rejected = {
      ...onboarded,
      goalAdmissionByGoal: {
        ...(onboarded.goalAdmissionByGoal || {}),
        [goalId]: { status: 'REJECTED_INFEASIBLE', reasonCodes: ['REQUIRED_PACE_EXCEEDS_MAX_PER_DAY'] }
      }
    };
    const planned = computeDerivedState(rejected, { type: 'GENERATE_PLAN' });
    expect(planned.lastPlanError?.code).toBe('GOAL_NOT_ADMITTED');
    expect(planned.cyclesById?.[planned.activeCycleId]?.autoAsanaPlan).toBeFalsy();
  });

  it('blocks apply when plan is UNSCHEDULABLE', () => {
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
        minimumDaysPerWeek: 4
      }
    });
    const goalId = onboarded.goalExecutionContract?.goalId;
    const cycleId = onboarded.activeCycleId;
    const startISO = buildLocalStartISO(FIXED_DAY, '09:00', 'UTC').startISO;
    const blocked = {
      ...onboarded,
      goalAdmissionByGoal: {
        ...(onboarded.goalAdmissionByGoal || {}),
        [goalId]: { status: 'ADMITTED', reasonCodes: [], admittedAtISO: `${FIXED_DAY}T10:00:00.000Z` }
      },
      cyclesById: {
        ...onboarded.cyclesById,
        [cycleId]: {
          ...onboarded.cyclesById[cycleId],
          autoAsanaPlan: {
            horizon: { startDayKey: FIXED_DAY, endDayKey: FIXED_DAY, daysCount: 1 },
            horizonBlocks: [{ id: 'blk-1', startISO, durationMinutes: 60, title: 'Block' }],
            conflicts: [{ kind: 'UNSCHEDULABLE', code: 'OVERLAP_ALL_SLOTS' }]
          }
        }
      }
    };
    const applied = computeDerivedState(blocked, { type: 'APPLY_PLAN' });
    expect(applied.lastPlanError?.code).toBe('PLAN_UNSCHEDULABLE');
    const creates = (applied.executionEvents || []).filter((e) => e?.kind === 'create');
    expect(creates.length).toBe(0);
  });
});
