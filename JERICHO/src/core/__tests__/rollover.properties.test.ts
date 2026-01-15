import { describe, it, expect } from 'vitest';
import { rolloverAtMidnight } from '../../core/engine/rollover.ts';
import { dayKeyFromISO, APP_TIME_ZONE } from '../../state/time/time.ts';

function seededRandom(seed = 1) {
  let value = seed >>> 0;
  return () => {
    value = (value * 1664525 + 1013904223) >>> 0;
    return value / 0x100000000;
  };
}

function createCommittedEvent(blockId, startHour, cycleId = 'cycle-1') {
  const start = `2026-01-13T${String(startHour).padStart(2, '0')}:00:00.000Z`;
  return {
    id: `evt-${blockId}`,
    blockId,
    kind: 'create',
    startISO: start,
    endISO: `2026-01-13T${String(startHour + 1).padStart(2, '0')}:00:00.000Z`,
    dateISO: '2026-01-13',
    minutes: 60,
    status: 'in_progress',
    placementState: 'COMMITTED',
    cycleId,
    domain: 'CREATION',
    origin: 'manual',
    completed: false
  };
}

describe('Rollover property checks', () => {
  it('emits MISSED + CREATE per committed block and keeps next-day timestamps', () => {
    const rng = seededRandom(99);
    const nowISO = '2026-01-14T08:00:00.000Z';
    const nextDayKey = dayKeyFromISO(nowISO, APP_TIME_ZONE);
    for (let run = 0; run < 20; run += 1) {
      const blockCount = 1 + Math.floor(rng() * 3);
      const state = {
        executionEvents: [] as any[],
        today: { date: '2026-01-13', blocks: [] },
        currentWeek: { days: [] },
        cyclesById: {},
        lastRolloverDayISO: undefined,
        appTime: { timeZone: APP_TIME_ZONE, nowISO }
      } as any;
      const blockIds = [];
      state.today.blocks = [];
      state.currentWeek.days = [];
      for (let idx = 0; idx < blockCount; idx += 1) {
        const hour = 8 + Math.floor(rng() * 6);
        const blockId = `blk-${run}-${idx}`;
        blockIds.push(blockId);
        state.executionEvents.push(createCommittedEvent(blockId, hour));
        const blockRecord = {
          id: blockId,
          start: `2026-01-13T${String(hour).padStart(2, '0')}:00:00.000Z`,
          end: `2026-01-13T${String(hour + 1).padStart(2, '0')}:00:00.000Z`,
          placementState: 'COMMITTED',
          status: 'in_progress',
          domain: 'CREATION',
          cycleId: 'cycle-1'
        };
        state.today.blocks.push(blockRecord);
        state.currentWeek.days.push({
          date: '2026-01-13',
          blocks: [blockRecord],
          completionRate: 0,
          driftSignal: 'balanced',
          loadByPractice: {},
          practices: [],
          plannedMinutes: 0,
          completedMinutes: 0
        });
      }
      state.cyclesById = {
        'cycle-1': { id: 'cycle-1', status: 'active', blocks: state.today.blocks, startedAtDayKey: '2026-01-13' }
      };
      const result = rolloverAtMidnight({ state, nowISO, timezone: APP_TIME_ZONE });
      const missed = result.eventsEmitted.filter((event) => event.kind === 'missed');
      const created = result.eventsEmitted.filter((event) => event.kind === 'create');
      expect(missed).toHaveLength(blockCount);
      expect(created).toHaveLength(blockCount);
      blockIds.forEach((id) => {
        expect(missed.some((event) => event.blockId === id)).toBeTruthy();
      });
      created.forEach((event) => {
        expect(event.blockId).toMatch(/^overdue/);
        expect(dayKeyFromISO(event.startISO, APP_TIME_ZONE)).toBe(nextDayKey);
        expect(event.cycleId).toBe('cycle-1');
      });
    }
  });
});
