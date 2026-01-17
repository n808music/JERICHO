import { describe, it, expect } from 'vitest';
import { computeDerivedState } from '../identityCompute.js';
import { buildLocalStartISO } from '../time/time.ts';
import { buildExecutionEventFromBlock } from '../engine/todayAuthority.ts';
import { computeCompletedThroughput } from '../engine/probabilityScore.ts';

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
    meta: {
      version: '1.0.0',
      onboardingComplete: false,
      lastActiveDate: FIXED_DAY,
      scenarioLabel: '',
      demoScenarioEnabled: false,
      showHints: false
    },
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

describe('manual blocks contribute to evidence by goal link', () => {
  it('linked manual completion affects probability evidence; unlinked does not', () => {
    const base = buildBaseState();
    const onboarded = computeDerivedState(base, {
      type: 'COMPLETE_ONBOARDING',
      onboarding: {
        direction: 'Goal A',
        goalText: 'Goal A',
        horizon: '30d',
        narrative: '',
        focusAreas: ['Creation'],
        successDefinition: 'A shipped',
        minimumDaysPerWeek: 4
      }
    });
    const goalId = onboarded.goalExecutionContract?.goalId;
    const cycleId = onboarded.activeCycleId;
    const startISO = buildLocalStartISO(FIXED_DAY, '09:00', 'UTC').startISO;

    const linked = computeDerivedState(onboarded, {
      type: 'CREATE_BLOCK',
      payload: {
        start: startISO,
        durationMinutes: 30,
        domain: 'FOCUS',
        title: 'Manual linked',
        timeZone: 'UTC',
        linkToGoal: true
      }
    });
    const linkedBlock = linked.today.blocks[0];
    const completeLinked = buildExecutionEventFromBlock(linkedBlock, {
      completed: true,
      kind: 'complete',
      dateISO: FIXED_DAY,
      minutes: 30
    });
    const linkedState = {
      ...linked,
      executionEvents: [...(linked.executionEvents || []), completeLinked],
      cyclesById: {
        ...linked.cyclesById,
        [cycleId]: {
          ...linked.cyclesById[cycleId],
          executionEvents: [...(linked.executionEvents || []), completeLinked]
        }
      }
    };
    const linkedThroughput = computeCompletedThroughput({
      events: [completeLinked],
      goalId,
      dayKeys: [FIXED_DAY]
    });
    expect(linkedThroughput.completedBlocksTotal).toBe(1);

    const unlinked = computeDerivedState(onboarded, {
      type: 'CREATE_BLOCK',
      payload: {
        start: startISO,
        durationMinutes: 30,
        domain: 'FOCUS',
        title: 'Manual unlinked',
        timeZone: 'UTC',
        linkToGoal: false
      }
    });
    const unlinkedBlock = unlinked.today.blocks[0];
    const completeUnlinked = buildExecutionEventFromBlock(unlinkedBlock, {
      completed: true,
      kind: 'complete',
      dateISO: FIXED_DAY,
      minutes: 30
    });
    const unlinkedState = {
      ...unlinked,
      executionEvents: [...(unlinked.executionEvents || []), completeUnlinked],
      cyclesById: {
        ...unlinked.cyclesById,
        [cycleId]: {
          ...unlinked.cyclesById[cycleId],
          executionEvents: [...(unlinked.executionEvents || []), completeUnlinked]
        }
      }
    };
    const unlinkedThroughput = computeCompletedThroughput({
      events: [completeUnlinked],
      goalId,
      dayKeys: [FIXED_DAY]
    });
    expect(unlinkedThroughput.completedBlocksTotal).toBe(0);
  });
});
