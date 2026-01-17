import { describe, it, expect } from 'vitest';
import { computeDerivedState } from '../identityCompute.js';
import { dayKeyFromISO } from '../time/time.ts';

function buildBaseState() {
  const nowISO = '2026-01-20T08:00:00.000Z';
  return {
    appTime: { nowISO, timeZone: 'UTC', activeDayKey: '2026-01-20' },
    today: { date: '2026-01-20', blocks: [] },
    currentWeek: { days: [] },
    cyclesById: {
      c1: {
        id: 'c1',
        status: 'Active',
        goalContract: {
          goalId: 'goal-album',
          startDate: '2026-01-20',
          deadline: { dayKey: '2026-01-25', isHardDeadline: true }
        }
      }
    },
    activeCycleId: 'c1',
    executionEvents: [],
    goalExecutionContract: null,
    planDraft: null,
    suggestionEvents: [],
    suggestedBlocks: [],
    lastPlanError: null
  };
}

describe('commitPreviewItems invariant', () => {
  it('commits exactly the visible preview list', () => {
    const state = buildBaseState();
    const action = {
      type: 'COMMIT_PREVIEW_ITEMS',
      payload: {
        cycleId: 'c1',
        items: [
          {
            dayKey: '2026-01-20',
            startISO: '2026-01-20T03:00:00.000Z',
            minutes: 60,
            title: 'Outline: Tracklist',
            domainKey: 'CREATION'
          },
          {
            dayKey: '2026-01-21',
            startISO: '2026-01-21T11:00:00.000Z',
            minutes: 60,
            title: 'Draft: Verse pass',
            domainKey: 'CREATION'
          }
        ]
      }
    };

    const next = computeDerivedState(state, action);
    expect(next.lastPlanError).toBeNull();
    expect(next.executionEvents.length).toBe(2);
    const committedDayKeys = next.executionEvents.map((event) => dayKeyFromISO(event.dateISO, 'UTC'));
    expect(new Set(committedDayKeys)).toEqual(
      new Set([
        dayKeyFromISO('2026-01-20T03:00:00.000Z', 'UTC'),
        dayKeyFromISO('2026-01-21T11:00:00.000Z', 'UTC')
      ])
    );
  });

  it('returns NO_PROPOSED_BLOCKS only when visible preview list empty', () => {
    const state = buildBaseState();
    const next = computeDerivedState(state, { type: 'COMMIT_PREVIEW_ITEMS', payload: { cycleId: 'c1', items: [] } });
    expect(next.lastPlanError?.code).toBe('NO_PROPOSED_BLOCKS');
    expect(next.today.blocks.length).toBe(0);
  });
});
