import { describe, expect, it } from 'vitest';
import { computeDerivedState } from '../../src/state/identityCompute.js';

describe('DRAFT_BLOCK_CREATE reducer', () => {
  it('appends a create event and materializes the block', () => {
    const baseState = {
      executionEvents: [],
      appTime: { nowISO: '2026-01-20T00:00:00.000Z', timeZone: 'UTC', activeDayKey: '2026-01-20' },
      today: { date: '2026-01-20', blocks: [] },
      activeCycleId: 'cycle-1',
      cyclesById: {
        'cycle-1': {
          id: 'cycle-1',
          status: 'active',
          goalContract: { goalId: 'goal-1', startDateISO: '2026-01-01T00:00:00.000Z' }
        }
      },
      goalExecutionContract: { goalId: 'goal-1', startDateISO: '2026-01-01T00:00:00.000Z' },
      probabilityByGoal: {},
      feasibilityByGoal: {}
    };
    const next = computeDerivedState(baseState, {
      type: 'DRAFT_BLOCK_CREATE',
      startISO: '2026-01-20T09:00:00.000Z',
      endISO: '2026-01-20T10:00:00.000Z',
      domain: 'CREATION',
      title: 'Promoted suggestion',
      durationMinutes: 60
    });
    const createEvent = (next.executionEvents || []).find((event) => event.kind === 'create');
    expect(createEvent).toBeTruthy();
    const blockExists = next.today?.blocks?.some((block) => block.id === createEvent.blockId);
    expect(blockExists).toBe(true);
  });

  it('applies draft schedule items into create events', () => {
    const baseState = {
      executionEvents: [],
      appTime: { nowISO: '2026-01-20T00:00:00.000Z', timeZone: 'UTC', activeDayKey: '2026-01-20' },
      today: { date: '2026-01-20', blocks: [] },
      activeCycleId: 'cycle-1',
      planDraft: { blocksPerWeek: 2, daysPerWeek: 4, minutesPerDay: 60 },
      suggestedBlocks: [
        {
          id: 's1',
          title: 'Suggested block',
          startISO: '2026-01-20T09:30:00.000Z',
          durationMinutes: 30,
          domain: 'CREATION',
          status: 'suggested'
        }
      ],
      cyclesById: {
        'cycle-1': {
          id: 'cycle-1',
          status: 'active',
          goalContract: { goalId: 'goal-1', startDateISO: '2026-01-01T00:00:00.000Z' },
          coldPlan: {
            forecastByDayKey: {
              '2026-01-20': { totalBlocks: 1, summary: 'Forecast' }
            }
          }
        }
      },
      goalExecutionContract: { goalId: 'goal-1', startDateISO: '2026-01-01T00:00:00.000Z' },
      probabilityByGoal: {},
      feasibilityByGoal: {},
    };
    const next = computeDerivedState(baseState, { type: 'APPLY_DRAFT_SCHEDULE' });
    const createEvents = (next.executionEvents || []).filter((event) => event.kind === 'create');
    expect(createEvents.length).toBeGreaterThan(0);
    expect(next.today?.blocks?.length).toBeGreaterThan(0);
  });
});
