/**
 * Originally a scratch debugging file (used to trace a 5-vs-4 committed-block discrepancy
 * while closing the matrix-engine review/apply loop, 2026-07-13). The "discrepancy" turned
 * out to be a correct day-boundary behavior, not a bug — see
 * generateSchedule.routing.test.js's "closes the loop end to end" test for the full
 * assertion. Kept as a small, permanent regression test for that specific finding: a
 * multi-day generated schedule commits blocks across every day it spans, and
 * `state.today.blocks` only ever reflects the current day's share of that — never confuse
 * the two when auditing activation counts.
 */
import { describe, it, expect } from 'vitest';
import { computeDerivedState } from '../identityCompute.js';

const NOW_ISO = '2026-01-10T12:00:00.000Z';
const START_DAY_KEY = '2026-01-10';
const DEADLINE_DAY_KEY = '2026-02-08';

const FIVE_CONFIRMED_PROJECTS = {
  entitiesById: { e1: { id: 'e1', name: 'F8 Energy' } },
  projectsById: Object.fromEntries(
    [1, 2, 3, 4, 5].map((n) => [
      `p${n}`,
      { id: `p${n}`, name: `Project ${n}`, owningEntityId: 'e1', reviewStatus: 'CONFIRMED', phase: String(n) },
    ])
  ),
};

function buildMatrixOnlyState() {
  const cycleId = 'cycle-matrix-only';
  return {
    appTime: { nowISO: NOW_ISO, timeZone: 'UTC', activeDayKey: START_DAY_KEY },
    activeCycleId: cycleId,
    cyclesById: {
      [cycleId]: {
        id: cycleId,
        status: 'Active',
        startedAtDayKey: START_DAY_KEY,
        matrixIntakeComplete: true,
        goalContract: {
          goalId: 'goal-matrix-1',
          planGenerationMechanismClass: 'GENERIC_DETERMINISTIC',
          deadlineDayKey: DEADLINE_DAY_KEY,
        },
        strategy: {
          strategyId: 'strategy-cycle-matrix-only',
          deliverables: [{ id: 'seed', title: 'Seed', requiredBlocks: 1 }],
          constraints: { tz: 'UTC' },
        },
        executionEvents: [],
      },
    },
    cycleOrder: [cycleId],
    aspirations: [],
    aspirationsByCycleId: {},
    deliverablesByCycleId: {},
    matrix: FIVE_CONFIRMED_PROJECTS,
  };
}

describe('activation across a multi-day generated schedule (day-boundary regression)', () => {
  it('commits every block across every day the schedule spans, even though state.today.blocks only shows the current day', () => {
    const state = buildMatrixOnlyState();
    const generated = computeDerivedState(state, { type: 'GENERATE_SCHEDULE' });
    // Default 4/day cap spreads 5 required blocks across two days: 4 on day 1, 1 on day 2.
    expect(generated.proposedBlocks.filter((b) => b.dayKey === '2026-01-10')).toHaveLength(4);
    expect(generated.proposedBlocks.filter((b) => b.dayKey === '2026-01-11')).toHaveLength(1);

    const applied = computeDerivedState(generated, {
      type: 'APPLY_DRAFT_SCHEDULE',
      payload: { cycleId: 'cycle-matrix-only' },
    });
    const activated = computeDerivedState(applied, {
      type: 'ACTIVATE_SCHEDULE',
      payload: { cycleId: 'cycle-matrix-only' },
    });

    const commitEvents = (activated.executionEvents || []).filter(
      (e) => e?.kind === 'create' && e?.cycleId === 'cycle-matrix-only'
    );
    expect(commitEvents).toHaveLength(5);

    // state.today.blocks (today = 2026-01-10) only shows that day's 4 — the 5th (tomorrow)
    // is real and committed, just not part of "today"'s view.
    const committedToday = (activated.today?.blocks || []).filter((b) => b?.cycleId === 'cycle-matrix-only');
    expect(committedToday).toHaveLength(4);
    expect(activated.lastPlanError).toBeNull();
  });
});
