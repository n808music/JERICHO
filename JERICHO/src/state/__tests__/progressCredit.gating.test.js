import { describe, it, expect } from 'vitest';
import { computeDerivedState } from '../identityCompute.js';
import { buildLocalStartISO } from '../time/time.ts';
import { buildExecutionEventFromBlock } from '../engine/todayAuthority.ts';

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
    }
  };
}

describe('progress credit gating', () => {
  it('does not credit progress for non-admitted goals', () => {
    const base = buildBaseState();
    const onboarded = computeDerivedState(base, {
      type: 'COMPLETE_ONBOARDING',
      onboarding: {
        direction: 'Goal A',
        goalText: 'Goal A',
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

    const created = computeDerivedState(onboarded, {
      type: 'CREATE_BLOCK',
      payload: {
        start: startISO,
        durationMinutes: 30,
        domain: 'FOCUS',
        title: 'Linked work',
        goalId,
        cycleId,
        deliverableId: 'deliv-1',
        criterionId: 'crit-1',
        timeZone: 'UTC'
      }
    });
    const block = created.today.blocks[0];
    const completed = buildExecutionEventFromBlock(block, {
      completed: true,
      kind: 'complete',
      dateISO: FIXED_DAY,
      minutes: 30
    });

    const rejected = {
      ...created,
      goalAdmissionByGoal: {
        ...(created.goalAdmissionByGoal || {}),
        [goalId]: { status: 'REJECTED_INFEASIBLE', reasonCodes: ['REQUIRED_PACE_EXCEEDS_MAX_PER_DAY'] }
      },
      executionEvents: [...(created.executionEvents || []), completed],
      cyclesById: {
        ...created.cyclesById,
        [cycleId]: {
          ...created.cyclesById[cycleId],
          executionEvents: [...(created.executionEvents || []), completed]
        }
      }
    };

    const recomputed = computeDerivedState(rejected, { type: 'NO_OP' });
    expect(recomputed.progressCreditByGoal?.[goalId]?.creditedUnits || 0).toBe(0);
    expect(recomputed.progressCreditByGoal?.[goalId]?.activityUnits || 0).toBeGreaterThan(0);
  });
});
