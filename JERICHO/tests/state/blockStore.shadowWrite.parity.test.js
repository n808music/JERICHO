import { beforeEach, describe, expect, it, vi } from 'vitest';

const compileAutoAsanaPlanMock = vi.fn();

vi.mock('../../src/state/engine/autoAsanaPlan.ts', () => ({
  compileAutoAsanaPlan: (...args) => compileAutoAsanaPlanMock(...args),
}));

import { computeDerivedState, getAllBlocks, getCanonicalBlocks } from '../../src/state/identityCompute.js';

const DAY = '2026-03-10';
const CYCLE_ID = 'cycle-parity-1';
const GOAL_ID = 'goal-parity-1';

function buildState() {
  return {
    appTime: { timeZone: 'UTC', nowISO: `${DAY}T12:00:00.000Z`, activeDayKey: DAY, isFollowingNow: true },
    viewDate: DAY,
    today: { date: DAY, blocks: [], completionRate: 0, driftSignal: 'contained', loadByPractice: {}, practices: [] },
    currentWeek: { weekStart: DAY, days: [] },
    cycle: [],
    vector: { day: 1, direction: '', stability: 'steady', drift: 'contained', momentum: 'active' },
    lenses: { aim: {}, pattern: { dailyTargets: [] }, flow: {} },
    executionEvents: [],
    suggestionEvents: [],
    proposedBlocks: [],
    suggestedBlocks: [],
    blockStore: { blocks: {} },
    constraints: {},
    cyclesById: {
      [CYCLE_ID]: {
        id: CYCLE_ID,
        status: 'active',
        goalContract: {
          goalId: GOAL_ID,
          startDayKey: DAY,
          endDayKey: '2026-03-31',
          workWindows: {
            mon: [{ start: '08:00', end: '10:00' }],
            tue: [],
            wed: [],
            thu: [],
            fri: [],
            sat: [],
            sun: [],
          },
        },
        planProof: {
          workableDaysRemaining: 10,
          totalRequiredUnits: 10,
          requiredPacePerDay: 1,
          maxPerDay: 1,
          maxPerWeek: 10,
          slackUnits: 0,
          slackRatio: 0,
          intensityRatio: 0,
        },
      },
    },
    activeCycleId: CYCLE_ID,
    goalExecutionContract: { goalId: GOAL_ID, startDayKey: DAY, endDayKey: '2026-03-31' },
    goalAdmissionByGoal: { [GOAL_ID]: { status: 'ADMITTED', reasonCodes: [] } },
  };
}

describe('blockStore shadow-write parity', () => {
  beforeEach(() => {
    compileAutoAsanaPlanMock.mockReset();
  });

  it('getCanonicalBlocks matches getAllBlocks after GENERATE_PLAN commits blocks', () => {
    compileAutoAsanaPlanMock.mockReturnValue({
      horizonBlocks: [
        { id: 'hb-parity-1', title: 'Parity block A', dayKey: DAY, startISO: `${DAY}T08:00:00.000Z`, durationMinutes: 60 },
        { id: 'hb-parity-2', title: 'Parity block B', dayKey: DAY, startISO: `${DAY}T09:00:00.000Z`, durationMinutes: 60 },
      ],
      conflicts: [],
    });

    const next = computeDerivedState(buildState(), {
      type: 'GENERATE_PLAN',
      payload: { cycleId: CYCLE_ID },
    });

    const fromSlices = getAllBlocks(next);
    const fromStore = getCanonicalBlocks(next);
    const sliceIds = new Set(fromSlices.map((b) => b.id));
    const storeIds = new Set(fromStore.map((b) => b.id));

    expect(storeIds.size).toBeGreaterThan(0);
    sliceIds.forEach((id) => expect(storeIds.has(id)).toBe(true));
    storeIds.forEach((id) => expect(sliceIds.has(id)).toBe(true));
  });

  it('getCanonicalBlocks contains zero blocks when GENERATE_PLAN produces no blocks', () => {
    compileAutoAsanaPlanMock.mockReturnValue({
      horizonBlocks: [],
      conflicts: [{ code: 'NO_ALLOWED_WINDOWS' }],
    });

    const next = computeDerivedState(buildState(), {
      type: 'GENERATE_PLAN',
      payload: { cycleId: CYCLE_ID },
    });

    expect(getCanonicalBlocks(next)).toHaveLength(0);
    expect(getAllBlocks(next)).toHaveLength(0);
  });

  it('store blocks carry the correct persisted fields and exclude projection fields', () => {
    compileAutoAsanaPlanMock.mockReturnValue({
      horizonBlocks: [
        { id: 'hb-schema-1', title: 'Schema check', dayKey: DAY, startISO: `${DAY}T08:00:00.000Z`, durationMinutes: 60 },
      ],
      conflicts: [],
    });

    const next = computeDerivedState(buildState(), {
      type: 'GENERATE_PLAN',
      payload: { cycleId: CYCLE_ID },
    });

    const storeBlocks = getCanonicalBlocks(next);
    expect(storeBlocks.length).toBeGreaterThan(0);

    storeBlocks.forEach((block) => {
      expect(block.id).toBeDefined();
      expect(block.start).toBeDefined();
      expect(block.end).toBeDefined();
      expect(block.status).toBeDefined();
      expect(block.title).toBeDefined();
      expect(block.completionRate).toBeUndefined();
      expect(block.plannedMinutes).toBeUndefined();
      expect(block.summaryLine).toBeUndefined();
      expect(block.driftSignal).toBeUndefined();
      expect(block.loadByPractice).toBeUndefined();
    });
  });
});
