import { describe, it, expect } from 'vitest';
import { compileAutoAsanaPlan } from '../engine/autoAsanaPlan.ts';
import { buildLocalStartISO } from '../time/time.ts';

const NOW_ISO = '2026-01-08T12:00:00.000Z';

describe('autoAsana scheduler v1.1', () => {
  it('avoids forbidden windows and places at earliest valid slot', () => {
    const plan = compileAutoAsanaPlan({
      goalId: 'goal-1',
      cycleId: 'cycle-1',
      nowISO: NOW_ISO,
      horizonDays: 1,
      planProof: {
        workableDaysRemaining: 1,
        totalRequiredUnits: 1,
        requiredPacePerDay: 1,
        maxPerDay: 2,
        maxPerWeek: 7,
        slackUnits: 1,
        slackRatio: 0.5,
        intensityRatio: 0.5
      },
      constraints: {
        timezone: 'America/Chicago',
        maxBlocksPerDay: 2,
        workingHoursWindows: [{ startMin: 9 * 60, endMin: 17 * 60 }],
        forbiddenTimeWindows: [{ startMin: 12 * 60, endMin: 13 * 60 }]
      }
    });
    const placed = plan.horizonBlocks[0];
    expect(placed).toBeTruthy();
    expect(minutesFromISO(placed.startISO, 'America/Chicago')).toBe(9 * 60);
  });

  it('avoids overlap with accepted blocks', () => {
    const plan = compileAutoAsanaPlan({
      goalId: 'goal-2',
      cycleId: 'cycle-2',
      nowISO: NOW_ISO,
      horizonDays: 1,
      planProof: {
        workableDaysRemaining: 1,
        totalRequiredUnits: 1,
        requiredPacePerDay: 1,
        maxPerDay: 2,
        maxPerWeek: 7,
        slackUnits: 1,
        slackRatio: 0.5,
        intensityRatio: 0.5
      },
      constraints: {
        timezone: 'America/Chicago',
        maxBlocksPerDay: 2,
        workingHoursWindows: [{ startMin: 9 * 60, endMin: 11 * 60 }]
      },
      acceptedBlocks: [
        {
          id: 'blk-1',
          startISO: buildLocalStartISO('2026-01-08', '09:00', 'America/Chicago').startISO,
          durationMinutes: 60
        }
      ]
    });
    const placed = plan.horizonBlocks[0];
    expect(placed).toBeTruthy();
    expect(minutesFromISO(placed.startISO, 'America/Chicago')).toBe(10 * 60);
  });

  it('skips forbidden day keys', () => {
    const plan = compileAutoAsanaPlan({
      goalId: 'goal-3',
      cycleId: 'cycle-3',
      nowISO: NOW_ISO,
      horizonDays: 2,
      planProof: {
        workableDaysRemaining: 2,
        totalRequiredUnits: 2,
        requiredPacePerDay: 1,
        maxPerDay: 2,
        maxPerWeek: 7,
        slackUnits: 1,
        slackRatio: 0.5,
        intensityRatio: 0.5
      },
      constraints: {
        timezone: 'America/Chicago',
        maxBlocksPerDay: 2,
        forbiddenDayKeys: ['2026-01-08']
      }
    });
    expect(plan.horizonBlocks.every((b) => b.dayKey !== '2026-01-08')).toBe(true);
  });

  it('returns overlap conflict when no slots are free', () => {
    const plan = compileAutoAsanaPlan({
      goalId: 'goal-4',
      cycleId: 'cycle-4',
      nowISO: NOW_ISO,
      horizonDays: 1,
      planProof: {
        workableDaysRemaining: 1,
        totalRequiredUnits: 1,
        requiredPacePerDay: 1,
        maxPerDay: 1,
        maxPerWeek: 7,
        slackUnits: 0,
        slackRatio: 0,
        intensityRatio: 1
      },
      constraints: {
        timezone: 'America/Chicago',
        maxBlocksPerDay: 1,
        workingHoursWindows: [{ startMin: 9 * 60, endMin: 10 * 60 }]
      },
      acceptedBlocks: [
        {
          id: 'blk-2',
          startISO: '2026-01-08T09:00:00.000Z',
          durationMinutes: 60
        }
      ]
    });
    expect(plan.conflicts.some((c) => c.code === 'OVERLAP_ALL_SLOTS')).toBe(true);
  });

  it('enforces max per day', () => {
    const plan = compileAutoAsanaPlan({
      goalId: 'goal-5',
      cycleId: 'cycle-5',
      nowISO: NOW_ISO,
      horizonDays: 1,
      planProof: {
        workableDaysRemaining: 1,
        totalRequiredUnits: 2,
        requiredPacePerDay: 2,
        maxPerDay: 1,
        maxPerWeek: 7,
        slackUnits: 0,
        slackRatio: 0,
        intensityRatio: 1
      },
      constraints: {
        timezone: 'America/Chicago',
        maxBlocksPerDay: 1,
        workingHoursWindows: [{ startMin: 9 * 60, endMin: 12 * 60 }]
      }
    });
    expect(plan.horizonBlocks.length).toBe(1);
    expect(plan.conflicts.some((c) => c.code === 'EXCEEDS_MAX_PER_DAY')).toBe(true);
  });

  it('is deterministic with identical inputs', () => {
    const payload = {
      goalId: 'goal-6',
      cycleId: 'cycle-6',
      nowISO: NOW_ISO,
      horizonDays: 3,
      planProof: {
        workableDaysRemaining: 3,
        totalRequiredUnits: 3,
        requiredPacePerDay: 1,
        maxPerDay: 2,
        maxPerWeek: 7,
        slackUnits: 2,
        slackRatio: 0.5,
        intensityRatio: 0.5
      },
      constraints: {
        timezone: 'America/Chicago',
        maxBlocksPerDay: 2,
        workingHoursWindows: [{ startMin: 9 * 60, endMin: 17 * 60 }]
      }
    };
    const planA = compileAutoAsanaPlan(payload);
    const planB = compileAutoAsanaPlan(payload);
    expect(planA.horizonBlocks).toEqual(planB.horizonBlocks);
    expect(planA.conflicts).toEqual(planB.conflicts);
  });
});

function minutesFromISO(iso, timeZone) {
  const date = new Date(iso);
  const parts = new Intl.DateTimeFormat('en-US', { timeZone, hour: '2-digit', minute: '2-digit', hour12: false })
    .formatToParts(date);
  const map = {};
  parts.forEach((p) => {
    if (p.type !== 'literal') map[p.type] = p.value;
  });
  const hours = Number(map.hour || 0);
  const minutes = Number(map.minute || 0);
  return hours * 60 + minutes;
}
