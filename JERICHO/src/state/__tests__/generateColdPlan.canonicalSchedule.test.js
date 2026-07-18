/**
 * generateColdPlan.canonicalSchedule.test.js
 *
 * Foundation stage of the full generateSchedule() engine (2026-07-13 unified schedule
 * generation design, §6): cycle.schedule (canonical ScheduledBlock[], §3) is now built
 * alongside cycle.coldPlan inside generateColdPlanForCycle, additive and low-risk — nothing
 * else reads cycle.schedule yet. This closes the gap between the day-bucketed-count shape
 * (coldPlan.forecastByDayKey) and the real ISO-timed, entity/lane-aware shape the rest of
 * the app (Generator B, createBlock, review/apply) already expects, without yet retiring
 * either existing generator.
 */

import { describe, it, expect } from 'vitest';
import { computeDerivedState } from '../identityCompute.js';

const NOW_ISO = '2026-01-10T12:00:00.000Z'; // Saturday
const START_DAY_KEY = '2026-01-10';
const DEADLINE_DAY_KEY = '2026-02-08';

function buildState({ matrix = {} } = {}) {
  const cycleId = 'cycle-1';
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
          goalId: 'goal-1',
          planGenerationMechanismClass: 'GENERIC_DETERMINISTIC',
          deadlineDayKey: DEADLINE_DAY_KEY,
        },
        strategy: {
          strategyId: `strategy-${cycleId}`,
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
    matrix,
  };
}

const FIVE_CONFIRMED_PROJECTS = {
  entitiesById: { e1: { id: 'e1', name: 'F8 Energy' } },
  initiativesById: { i1: { id: 'i1', name: 'Launch Initiative' } },
  projectsById: Object.fromEntries(
    [1, 2, 3, 4, 5].map((n) => [
      `p${n}`,
      {
        id: `p${n}`,
        name: `Project ${n}`,
        owningEntityId: 'e1',
        owningInitiativeId: n <= 2 ? 'i1' : null,
        reviewStatus: 'CONFIRMED',
        phase: String(n),
      },
    ])
  ),
};

describe('GENERATE_COLD_PLAN — canonical cycle.schedule (foundation of the unified engine)', () => {
  it('builds one real ScheduledBlock per confirmed causal step, with entity/lane resolved from the matrix', () => {
    const state = buildState({ matrix: FIVE_CONFIRMED_PROJECTS });
    const next = computeDerivedState(state, { type: 'GENERATE_COLD_PLAN' });
    const cycle = next.cyclesById['cycle-1'];

    expect(cycle.schedule).toBeDefined();
    expect(cycle.schedule.blocks).toHaveLength(5);
    cycle.schedule.blocks.forEach((block) => {
      expect(block.status).toBe('proposed');
      expect(block.origin).toBe('schedule_generation');
      expect(block.startISO).toBeTruthy();
      expect(block.endISO).toBeTruthy();
      expect(block.cycleId).toBe('cycle-1');
      expect(block.goalId).toBe('goal-1');
      expect(block.entityId).toBe('e1');
      expect(block.entityLabel).toBe('F8 Energy');
    });
    // p1/p2 own the initiative; p3-5 don't.
    const laned = cycle.schedule.blocks.filter((b) => b.laneId === 'i1');
    expect(laned.length).toBe(2);
    laned.forEach((b) => expect(b.laneLabel).toBe('Launch Initiative'));
  });

  it('cycle.schedule.blocks.length matches coldPlan\'s total block count (same allocation, two shapes)', () => {
    const state = buildState({ matrix: FIVE_CONFIRMED_PROJECTS });
    const next = computeDerivedState(state, { type: 'GENERATE_COLD_PLAN' });
    const cycle = next.cyclesById['cycle-1'];
    const coldPlanTotal = Object.values(cycle.coldPlan.forecastByDayKey || {}).reduce(
      (sum, f) => sum + f.totalBlocks,
      0
    );
    expect(cycle.schedule.blocks.length).toBe(coldPlanTotal);
  });

  it('carries capacityViolation onto cycle.schedule when confirmed scope exceeds confirmed capacity (mirrors coldPlan)', () => {
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
            mon: [{ start: '09:00', end: '10:00' }],
            tue: [], wed: [], thu: [], fri: [], sat: [], sun: [],
          },
        },
      },
    };
    const state = buildState({ matrix });
    const next = computeDerivedState(state, { type: 'GENERATE_COLD_PLAN' });
    const cycle = next.cyclesById['cycle-1'];

    expect(cycle.schedule.capacityViolation).toBeDefined();
    expect(cycle.schedule.capacityViolation.requiredBlocks).toBe(5);
    // Blocks that DID fit are still real ScheduledBlocks, not thrown away.
    expect(cycle.schedule.blocks.length).toBeGreaterThan(0);
    expect(cycle.schedule.blocks.length).toBeLessThan(5);
  });

  it('produces schedule blocks from the generic 3-tier fallback when the matrix has no CONFIRMED projects, with no entity/lane identity', () => {
    const state = buildState({ matrix: {} });
    const next = computeDerivedState(state, { type: 'GENERATE_COLD_PLAN' });
    const cycle = next.cyclesById['cycle-1'];

    expect(cycle.schedule.blocks.length).toBeGreaterThan(0);
    cycle.schedule.blocks.forEach((block) => {
      expect(block.entityId).toBeNull();
      expect(block.laneId).toBeNull();
    });
  });
});
