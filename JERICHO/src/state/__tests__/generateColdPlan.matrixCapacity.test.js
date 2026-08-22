/**
 * generateColdPlan.matrixCapacity.test.js
 *
 * Closes the second half of the 2026-07-13 unified-schedule-generation design: constraints
 * (capacity) now flow from a CONFIRMED matrix.capacityById row into generateColdPlanForCycle
 * the same way the causal chain does — precedence-gated, unchanged fallback when nothing is
 * confirmed yet, no re-entry required.
 */

import { describe, it, expect } from 'vitest';
import { computeDerivedState } from '../identityCompute.js';

const NOW_ISO = '2026-01-10T12:00:00.000Z'; // Saturday
const START_DAY_KEY = '2026-01-10';
const DEADLINE_DAY_KEY = '2026-02-08'; // ~4 weeks later, spans 4 Mondays: 12, 19, 26, Feb 2

function buildState({ matrix = {}, strategyConstraints = undefined } = {}) {
  const cycleId = 'cycle-1';
  return {
    appTime: { nowISO: NOW_ISO, timeZone: 'UTC', activeDayKey: START_DAY_KEY },
        timeIsPinned: true,
    activeCycleId: cycleId,
    cyclesById: {
      [cycleId]: {
        id: cycleId,
        status: 'Active',
        startedAtDayKey: START_DAY_KEY,
        matrixIntakeComplete: true,
        goalContract: {
          planGenerationMechanismClass: 'GENERIC_DETERMINISTIC',
          deadlineDayKey: DEADLINE_DAY_KEY,
        },
        strategy: {
          strategyId: `strategy-${cycleId}`,
          deliverables: [{ id: 'seed', title: 'Seed', requiredBlocks: 1 }],
          constraints: strategyConstraints || { tz: 'UTC' },
        },
        executionEvents: [],
      },
    },
    cycleOrder: [cycleId],
    aspirations: [],
    aspirationsByCycleId: {},
    deliverablesByCycleId: {},
    matrix,
  };
}

function allDayKeys(coldPlan) {
  return Object.keys(coldPlan.forecastByDayKey || {});
}

function totalBlocks(coldPlan) {
  return Object.values(coldPlan.forecastByDayKey || {}).reduce((sum, f) => sum + f.totalBlocks, 0);
}

function dayOfWeek(dayKey) {
  return new Date(`${dayKey}T12:00:00Z`).getUTCDay();
}

const FIVE_CONFIRMED_PROJECTS = {
  entitiesById: { e1: { id: 'e1', name: 'Global State Corp.', reviewStatus: 'CONFIRMED' } },
  projectsById: Object.fromEntries(
    [1, 2, 3, 4, 5].map((n) => [
      `p${n}`,
      { id: `p${n}`, name: `Project ${n}`, owningEntityId: 'e1', reviewStatus: 'CONFIRMED', phase: String(n) },
    ])
  ),
};

describe('GENERATE_COLD_PLAN — matrix-derived capacity/constraints', () => {
  it('falls back to the 4/16 hardcoded defaults when no capacity is CONFIRMED (unchanged behavior)', () => {
    const state = buildState({ matrix: FIVE_CONFIRMED_PROJECTS });
    const next = computeDerivedState(state, { type: 'GENERATE_COLD_PLAN' });
    const coldPlan = next.cyclesById['cycle-1'].coldPlan;

    // 5 confirmed causal steps, default caps (4/day, 16/week) easily fit all 5.
    expect(totalBlocks(coldPlan)).toBe(5);
  });

  it('constrains the schedule to a CONFIRMED capacity row — only the declared day(s), capped by the actual window', () => {
    const matrix = {
      ...FIVE_CONFIRMED_PROJECTS,
      capacityById: {
        c1: {
          id: 'c1',
          owningEntityId: 'e1',
          reviewStatus: 'CONFIRMED',
          maxBlocksPerDay: 4,
          maxBlocksPerWeek: 16,
          blackoutDayKeys: [],
          workWindows: {
            mon: [{ start: '09:00', end: '10:00' }], // 60 min = 1 block/week, Mondays only
            tue: [], wed: [], thu: [], fri: [], sat: [], sun: [],
          },
        },
      },
    };
    const state = buildState({ matrix });
    const next = computeDerivedState(state, { type: 'GENERATE_COLD_PLAN' });
    const coldPlan = next.cyclesById['cycle-1'].coldPlan;

    const dayKeys = allDayKeys(coldPlan);
    expect(dayKeys.length).toBeGreaterThan(0);
    // Every scheduled day must be a Monday — no other day of week has any window.
    expect(dayKeys.every((dk) => dayOfWeek(dk) === 1)).toBe(true);
    // The narrow window (1 block/week) means not all 5 required blocks fit in the horizon.
    expect(totalBlocks(coldPlan)).toBeLessThan(5);
  });

  it('flags lastPlanWarning (CAPACITY_VIOLATION) when confirmed scope exceeds confirmed capacity, without a lastPlanError', () => {
    const matrix = {
      ...FIVE_CONFIRMED_PROJECTS,
      capacityById: {
        c1: {
          id: 'c1',
          owningEntityId: 'e1',
          reviewStatus: 'CONFIRMED',
          maxBlocksPerDay: 4,
          maxBlocksPerWeek: 16,
          blackoutDayKeys: [],
          workWindows: {
            mon: [{ start: '09:00', end: '10:00' }], // 60 min = 1 block/week, Mondays only
            tue: [], wed: [], thu: [], fri: [], sat: [], sun: [],
          },
        },
      },
    };
    const state = buildState({ matrix });
    const next = computeDerivedState(state, { type: 'GENERATE_COLD_PLAN' });
    const coldPlan = next.cyclesById['cycle-1'].coldPlan;

    // Same narrow-window scenario as above: not everything fits. This must surface as a
    // named, acknowledgeable warning (2026-07-13 §5 capacity-violation contract) — not
    // a silent SUCCESS, and not conflated with lastPlanError (which still only gates on
    // zero-blocks/true infeasibility).
    expect(totalBlocks(coldPlan)).toBeLessThan(5);
    expect(coldPlan.capacityViolation).toBeDefined();
    expect(coldPlan.capacityViolation.requiredBlocks).toBe(5);
    expect(next.lastPlanWarning?.code).toBe('CAPACITY_VIOLATION');
    expect(next.lastPlanError).toBeNull();
  });

  it('an explicit cycle.strategy.constraints still takes precedence over matrix capacity', () => {
    const matrix = {
      ...FIVE_CONFIRMED_PROJECTS,
      capacityById: {
        c1: {
          id: 'c1',
          owningEntityId: 'e1',
          reviewStatus: 'CONFIRMED',
          maxBlocksPerDay: 1,
          maxBlocksPerWeek: 1,
          workWindows: { mon: [{ start: '09:00', end: '10:00' }], tue: [], wed: [], thu: [], fri: [], sat: [], sun: [] },
        },
      },
    };
    const state = buildState({
      matrix,
      strategyConstraints: { tz: 'UTC', maxBlocksPerDay: 4, maxBlocksPerWeek: 16 },
    });
    const next = computeDerivedState(state, { type: 'GENERATE_COLD_PLAN' });
    const coldPlan = next.cyclesById['cycle-1'].coldPlan;

    // Explicit strategy constraints (4/16) win — all 5 confirmed steps fit, not gated to Mondays.
    expect(totalBlocks(coldPlan)).toBe(5);
  });
});
