/**
 * generateSchedule.routing.test.js
 *
 * 2026-07-13 unified schedule generation design, §6.2 (revised): GENERATE_SCHEDULE is a
 * single entry point that routes to whichever existing engine already applies to a cycle —
 * generatePlan (admitted goal + real action graph, via compileAutoAsanaPlan) or
 * generateColdPlanForCycle (matrix-driven, no admitted action graph yet) — instead of the
 * engine being decided by which UI button the operator happened to press. Neither engine's
 * internals change; this only tests the routing.
 */

import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest';
import { computeDerivedState } from '../identityCompute.js';

const FIXED_DAY = '2026-01-08';

function buildBaseState() {
  return {
    vector: { day: 1, direction: '', stability: 'steady', drift: 'contained', momentum: 'active' },
    lenses: {
      aim: { description: '', horizon: '90d', narrative: '' },
      pattern: { routines: { Body: [], Resources: [], Creation: [], Focus: [] }, dailyTargets: [], defaultMinutes: 30 },
      flow: { streams: [] },
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
    appTime: { timeZone: 'UTC', nowISO: `${FIXED_DAY}T12:00:00.000Z`, activeDayKey: FIXED_DAY, isFollowingNow: true },
    constraints: { maxBlocksPerDay: 4, maxBlocksPerWeek: 16 },
  };
}

const EQUATION_PAYLOAD = {
  label: 'Skill Goal',
  family: 'SKILL',
  mechanismClass: 'THROUGHPUT',
  objective: 'PRACTICE_HOURS_TOTAL',
  objectiveValue: 20,
  deadlineDayKey: '2026-02-08',
  deadlineType: 'HARD',
  workingFullTime: true,
  workDaysPerWeek: 4,
  workStartWindow: 'MID',
  workEndWindow: 'MID',
  minSleepHours: 8,
  sleepFixedWindow: false,
  sleepStartWindow: 'LATE',
  sleepEndWindow: 'EARLY',
  hasWeeklyRestDay: true,
  restDay: 0,
  blackoutBlocks: [],
  hasGymAccess: true,
  canCookMostDays: true,
  hasTransportLimitation: false,
  currentlyInjured: false,
  beginnerLevel: false,
  maxDailyWorkMinutes: 120,
  noEveningWork: false,
  noMorningWork: false,
  weekendsAllowed: true,
  travelThisPeriod: 'NONE',
  acceptsDailyMinimum: true,
  acceptsFixedSchedule: true,
  acceptsNoRenegotiation7d: true,
  acceptsAutomaticCatchUp: true,
};

function buildCompiledStateWithActionGraph() {
  const base = buildBaseState();
  const onboarded = computeDerivedState(base, {
    type: 'COMPLETE_ONBOARDING',
    onboarding: {
      direction: 'Skill Goal',
      goalText: 'Skill Goal',
      horizon: '30d',
      narrative: '',
      focusAreas: ['Focus'],
      successDefinition: 'Practice complete',
      minimumDaysPerWeek: 4,
    },
  });
  return computeDerivedState(onboarded, {
    type: 'COMPILE_GOAL_EQUATION',
    payload: { equation: EQUATION_PAYLOAD },
  });
}

const NOW_ISO = '2026-01-10T12:00:00.000Z';
const START_DAY_KEY = '2026-01-10';
const DEADLINE_DAY_KEY = '2026-02-08';

const FIVE_CONFIRMED_PROJECTS = {
  entitiesById: { e1: { id: 'e1', name: 'F8 Energy' } },
  projectsById: Object.fromEntries(
    [1, 2, 3, 4, 5].map((n) => [`p${n}`, { id: `p${n}`, name: `Project ${n}`, owningEntityId: 'e1', reviewStatus: 'CONFIRMED', phase: String(n) }])
  ),
};

function buildMatrixOnlyState() {
  const cycleId = 'cycle-matrix-only';
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

describe('GENERATE_SCHEDULE — routes to the right existing engine without changing either', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(`${FIXED_DAY}T12:00:00.000Z`));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('when a real action graph exists, GENERATE_SCHEDULE produces the exact same result as GENERATE_PLAN', () => {
    const compiledA = buildCompiledStateWithActionGraph();
    const compiledB = buildCompiledStateWithActionGraph();

    const viaSchedule = computeDerivedState(compiledA, { type: 'GENERATE_SCHEDULE' });
    const viaPlan = computeDerivedState(compiledB, { type: 'GENERATE_PLAN' });

    expect(viaSchedule.scheduleApplied).toBe(viaPlan.scheduleApplied);
    expect(viaSchedule.pendingPlanConfirmation).toBe(viaPlan.pendingPlanConfirmation);
    expect((viaSchedule.proposedBlocks || []).length).toBe((viaPlan.proposedBlocks || []).length);
    expect((viaSchedule.proposedBlocks || []).some((b) => b?.status === 'suggested')).toBe(true);

    const cycle = viaSchedule.cyclesById[viaSchedule.activeCycleId];
    expect(cycle.autoAsanaPlan).toBeTruthy();
  });

  it('falls back to the matrix-driven engine when generatePlan reports NO_ACTION_GRAPH, and still produces a real schedule', () => {
    const state = buildMatrixOnlyState();
    const viaGeneratePlanOnly = computeDerivedState(state, { type: 'GENERATE_PLAN' });
    // Document the premise this fallback depends on: without GENERATE_SCHEDULE's routing,
    // this cycle (matrix intake, no admitted action graph) dead-ends on GENERATE_PLAN alone.
    expect(viaGeneratePlanOnly.lastPlanError?.code).toBe('NO_ACTION_GRAPH');

    const viaSchedule = computeDerivedState(state, { type: 'GENERATE_SCHEDULE' });
    const cycle = viaSchedule.cyclesById['cycle-matrix-only'];
    expect(cycle.coldPlan).toBeTruthy();
    expect(cycle.schedule?.blocks?.length).toBe(5);
    expect(viaSchedule.lastPlanError).toBeNull();
  });

  it('bridges the fallback schedule into state.proposedBlocks — the dashboard Review screen has something to show', () => {
    const state = buildMatrixOnlyState();
    const viaSchedule = computeDerivedState(state, { type: 'GENERATE_SCHEDULE' });

    const proposed = viaSchedule.proposedBlocks || [];
    expect(proposed.length).toBe(5);
    proposed.forEach((block) => {
      expect(block.status).toBe('suggested');
      expect(block.startISO).toBeTruthy();
      expect(block.cycleId).toBe('cycle-matrix-only');
      expect(block.entityId).toBe('e1');
    });
  });

  it('closes the loop end to end: GENERATE_SCHEDULE -> APPLY_DRAFT_SCHEDULE -> ACTIVATE_SCHEDULE actually commits real blocks', () => {
    const state = buildMatrixOnlyState();
    const generated = computeDerivedState(state, { type: 'GENERATE_SCHEDULE' });
    expect((generated.proposedBlocks || []).length).toBe(5);

    const applied = computeDerivedState(generated, {
      type: 'APPLY_DRAFT_SCHEDULE',
      payload: { cycleId: 'cycle-matrix-only' },
    });
    const appliedCycle = applied.cyclesById['cycle-matrix-only'];
    expect(appliedCycle.scheduleReviewBlocks?.length).toBe(5);
    expect(appliedCycle.scheduleLifecycle).toBe('applied_review');

    const activated = computeDerivedState(applied, {
      type: 'ACTIVATE_SCHEDULE',
      payload: { cycleId: 'cycle-matrix-only' },
    });
    const activatedCycle = activated.cyclesById['cycle-matrix-only'];
    expect(activatedCycle.scheduleLifecycle).toBe('active_schedule');
    expect(activatedCycle.scheduleReviewBlocks).toEqual([]);
    // state.today.blocks is a day-scoped view (today only) — count commits via the
    // execution-event ledger instead, which reflects every day the schedule spans.
    const commitEvents = (activated.executionEvents || []).filter(
      (e) => e?.kind === 'create' && e?.cycleId === 'cycle-matrix-only'
    );
    expect(commitEvents.length).toBe(5);
    // And the day that IS today should show its share in the day-scoped view.
    const committedToday = (activated.today?.blocks || []).filter((b) => b?.cycleId === 'cycle-matrix-only');
    expect(committedToday.length).toBe(4);
  });

  it('does NOT fall back when generatePlan reports a real block (CYCLE_READ_ONLY) — the specific error stands', () => {
    const state = buildMatrixOnlyState();
    state.cyclesById['cycle-matrix-only'].status = 'ended';

    const viaSchedule = computeDerivedState(state, { type: 'GENERATE_SCHEDULE' });
    expect(viaSchedule.lastPlanError?.code).toBe('CYCLE_READ_ONLY');
    // No fallback attempted — coldPlan/schedule must not have been generated.
    expect(viaSchedule.cyclesById['cycle-matrix-only'].coldPlan).toBeUndefined();
  });
});
