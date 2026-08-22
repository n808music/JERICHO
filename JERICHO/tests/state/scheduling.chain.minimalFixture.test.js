import { beforeEach, describe, expect, it, vi } from 'vitest';

const compileAutoAsanaPlanMock = vi.fn();

vi.mock('../../src/state/engine/autoAsanaPlan.ts', () => ({
  compileAutoAsanaPlan: (...args) => compileAutoAsanaPlanMock(...args),
}));

import { computeDerivedState, getAllBlocks, projectMonthDays } from '../../src/state/identityCompute.js';

function buildState() {
  const dayKey = '2026-03-01';
  const cycleId = 'cycle-fixture-1';
  const goalId = 'goal-fixture-1';
  return {
    appTime: { timeZone: 'UTC', nowISO: `${dayKey}T12:00:00.000Z`, activeDayKey: dayKey, isFollowingNow: true, timeIsPinned: true },
    today: { date: dayKey, blocks: [] },
    currentWeek: { weekStart: dayKey, days: [] },
    cycle: [],
    vector: {},
    lenses: { aim: {}, pattern: { dailyTargets: [] }, flow: {} },
    executionEvents: [],
    suggestionEvents: [],
    proposedBlocks: [],
    suggestedBlocks: [],
    constraints: {
      weeklyWindows: {
        MON: [{ startHHMM: '09:00', endHHMM: '11:00' }],
      },
      dayEndAtHHMM: '23:59',
    },
    deliverablesByCycleId: {
      [cycleId]: {
        cycleId,
        deliverables: [{ id: 'deliv-1', title: 'Single deliverable', estimateMin: 60 }],
        suggestionLinks: {},
        lastUpdatedAtISO: `${dayKey}T12:00:00.000Z`,
      },
    },
    cyclesById: {
      [cycleId]: {
        id: cycleId,
        status: 'active',
        goalContract: {
          goalId,
          startDayKey: dayKey,
          endDayKey: '2026-03-31',
          workWindows: {
            mon: [{ start: '09:00', end: '11:00' }],
            tue: [],
            wed: [],
            thu: [],
            fri: [],
            sat: [],
            sun: [],
          },
        },
        planProof: {},
        actions: [{ id: 'act-1', title: 'One task', estimateMin: 60 }],
      },
    },
    activeCycleId: cycleId,
    goalExecutionContract: { goalId, startDayKey: dayKey, endDayKey: '2026-03-31' },
    goalAdmissionByGoal: { [goalId]: { status: 'ADMITTED', reasonCodes: [] } },
    lastPlanError: null,
  };
}

describe('scheduling chain minimal fixture', () => {
  beforeEach(() => {
    compileAutoAsanaPlanMock.mockReset();
  });

  it('generate -> apply -> render works from canonical proposed and committed sources', () => {
    compileAutoAsanaPlanMock.mockReturnValue({
      horizonBlocks: [
        {
          id: 'hb-fixture-1',
          title: 'Action 1',
          dayKey: '2026-03-02',
          startISO: '2026-03-02T09:00:00.000Z',
          durationMinutes: 60,
        },
        {
          id: 'hb-fixture-2',
          title: 'Action 2',
          dayKey: '2026-03-20',
          startISO: '2026-03-20T09:00:00.000Z',
          durationMinutes: 60,
        },
      ],
      conflicts: [],
    });

    const generated = computeDerivedState(buildState(), {
      type: 'GENERATE_PLAN',
      payload: { cycleId: 'cycle-fixture-1' },
    });
    expect(compileAutoAsanaPlanMock).toHaveBeenCalledTimes(1);
    const compileInput = compileAutoAsanaPlanMock.mock.calls[0][0];
    expect(compileInput.horizonDays).toBe(31);
    expect(Array.isArray(compileInput.actionSequence)).toBe(true);
    expect(compileInput.actionSequence.length).toBeGreaterThan(0);
    const suggested = (generated.proposedBlocks || []).filter((b) => b?.status === 'suggested');
    expect(suggested).toHaveLength(2);
    expect(generated.scheduleApplied).toBe(false);
    expect(generated.lastPlanError).toBeNull();
    const generateTraceLog = (generated.debug?.traceLog || []).filter((entry) => entry?.transition);
    expect(generateTraceLog).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ transition: 'generate', blockId: expect.any(String), label: 'Action 1' }),
        expect.objectContaining({ transition: 'generate', blockId: expect.any(String), label: 'Action 2' }),
      ])
    );
    expect(generateTraceLog.every((entry) => entry.transition === 'generate')).toBe(true);

    const applied = computeDerivedState(generated, {
      type: 'APPLY_DRAFT_SCHEDULE',
      payload: { cycleId: 'cycle-fixture-1' },
    });
    const accepted = (applied.proposedBlocks || []).filter((b) => b?.status === 'accepted');
    expect(accepted).toHaveLength(2);
    expect(applied.scheduleApplied).toBe(true);
    expect(applied.scheduleLifecycle).toBe('applied_review');
    expect((applied.executionEvents || []).filter((event) => event?.kind === 'create')).toHaveLength(0);
    const applyTraceLog = (applied.debug?.traceLog || []).filter((entry) => entry?.transition);
    expect(applyTraceLog).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ transition: 'apply', blockId: expect.any(String), label: 'Action 1' }),
        expect.objectContaining({ transition: 'apply', blockId: expect.any(String), label: 'Action 2' }),
      ])
    );

    const activated = computeDerivedState(applied, {
      type: 'ACTIVATE_SCHEDULE',
      payload: { cycleId: 'cycle-fixture-1' },
    });
    expect(activated.scheduleLifecycle).toBe('active_schedule');
    const createEvents = (activated.executionEvents || []).filter(
      (event) => event?.kind === 'create' && event?.cycleId === 'cycle-fixture-1'
    );
    expect(createEvents.length).toBeGreaterThanOrEqual(1);

    const proposedDays = accepted.map((b) => b.dayKey).sort();
    expect(proposedDays[0]).toBe('2026-03-02');
    expect(proposedDays[proposedDays.length - 1]).toBe('2026-03-20');
    expect(proposedDays[proposedDays.length - 1] > '2026-03-15').toBe(true);

    const committed = getAllBlocks(activated).filter((b) => b?.cycleId === 'cycle-fixture-1');
    expect(committed.length).toBeGreaterThanOrEqual(1);
    expect(committed.some((b) => (b.start || '').slice(0, 10) === '2026-03-02')).toBe(true);
    expect(committed.some((b) => (b.start || '').slice(0, 10) === '2026-03-20')).toBe(true);

    const monthDays = projectMonthDays({ monthKey: '2026-03-01', blocks: committed, includePadding: true });
    const monday = monthDays.find((d) => d.date === '2026-03-02');
    expect(monday).toBeTruthy();
    expect(Number(monday.plannedMinutes || 0)).toBeGreaterThan(0);
  });
});
