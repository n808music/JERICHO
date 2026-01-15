import { describe, test, expect } from 'vitest';
import { computeDerivedState } from '../../state/identityCompute.js';

describe('Auto-Placement Draft Schedule', () => {
  const timeZone = 'America/Chicago';
  const nowISO = '2026-01-14T00:01:00.000Z';

  test('should generate DRAFT_SCHEDULE_CLEAR and DRAFT_BLOCK_CREATE events', () => {
    const baseState = {
      appTime: {
        timeZone,
        nowISO,
        activeDayKey: '2026-01-13',
        isFollowingNow: true
      },
      today: {
        date: '2026-01-13',
        blocks: [
          {
            id: 'block-1',
            practice: 'Creation',
            label: 'Build feature',
            start: '2026-01-13T21:00:00.000Z',
            end: '2026-01-13T22:30:00.000Z',
            status: 'in_progress',
            placementState: 'COMMITTED'
          }
        ]
      },
      executionEvents: [],
      cyclesById: {}
    };

    const result = computeDerivedState(baseState, { 
      type: 'DRAFT_SCHEDULE_CLEAR',
      cycleId: 'cycle-1'
    });

    expect(result.draftEvents).toHaveLength(1);
    expect(result.draftEvents?.[0]?.type).toBe('DRAFT_SCHEDULE_CLEAR');
    expect(result.executionEvents).toHaveLength(1);
    expect(result.executionEvents[0].kind).toBe('create');
    expect(result.executionEvents[0].blockId).toBe('block-1');
    expect(result.today?.blocks?.length).toBe(1);
    expect(result.today?.blocks[0].isDraft).toBe(true);
    expect(result.today?.blocks[0].id).toBe('block-1');
  });

  test('should generate DRAFT_BLOCK_CREATE events for new blocks', () => {
    const baseState = {
      appTime: {
        timeZone,
        nowISO,
        activeDayKey: '2026-01-13',
        isFollowingNow: true
      },
      today: {
        date: '2026-01-13',
        blocks: [
          {
            id: 'block-1',
            practice: 'Creation',
            label: 'Build feature',
            start: '2026-01-13T21:00:00.000Z',
            end: '2026-01-13T22:30:00.000Z',
            status: 'in_progress',
            placementState: 'COMMITTED'
          }
        ]
      },
      executionEvents: [],
      cyclesById: {}
    };

    const result = computeDerivedState(baseState, { 
      type: 'DRAFT_BLOCK_CREATE',
      cycleId: 'cycle-1',
      blockId: 'block-1',
      startISO: '2026-01-13T21:00:00.000Z',
      endISO: '2026-01-13T22:30:00.000Z',
      status: 'committed'
    });

    expect(result.executionEvents).toHaveLength(1);
    expect(result.executionEvents[0].kind).toBe('create');
    expect(result.executionEvents[0].blockId).toBe('block-1');
    expect(result.executionEvents[0].status).toBe('committed');
    expect(result.draftEvents).toHaveLength(1);
    expect(result.draftEvents?.[0]?.type).toBe('DRAFT_BLOCK_CREATE');
  });

  test('should preserve determinism with same inputs', () => {
    const baseState = {
      appTime: {
        timeZone,
        nowISO,
        activeDayKey: '2026-01-13',
        isFollowingNow: true
      },
      today: {
        date: '2026-01-13',
        blocks: [
          {
            id: 'block-1',
            practice: 'Creation',
            label: 'Build feature',
            start: '2026-01-13T21:00:00.000Z',
            end: '2026-01-13T22:30:00.000Z',
            status: 'in_progress',
            placementState: 'COMMITTED'
          }
        ]
      }
    };

    const action = { type: 'DRAFT_BLOCK_CREATE', blockId: 'block-1' };
    
    const result1 = computeDerivedState(baseState, action);
    const result2 = computeDerivedState(baseState, action);

    expect(JSON.stringify(result1)).toEqual(JSON.stringify(result2));
  });

  test('should generate multiple blocks in order', () => {
    const baseState = {
      appTime: {
        timeZone,
        nowISO,
        activeDayKey: '2026-01-13',
        isFollowingNow: true
      },
      today: {
        date: '2026-01-13',
        blocks: []
      }
    };

    const result1 = computeDerivedState(baseState, { 
      type: 'DRAFT_BLOCK_CREATE',
      blockId: 'block-A',
      startISO: '2026-01-13T09:00:00.000Z',
      endISO: '2026-01-13T11:00:00.000Z',
      status: 'committed'
    });

    const result2 = computeDerivedState(result1, { 
      type: 'DRAFT_BLOCK_CREATE',
      blockId: 'block-B',
      startISO: '2026-01-13T13:00:00.000Z',
      endISO: '2026-01-13T15:00:00.000Z',
      status: 'committed'
    });

    const result3 = computeDerivedState(result2, { 
      type: 'DRAFT_BLOCK_CREATE',
      blockId: 'block-C',
      startISO: '2026-01-13T17:00:00.000Z',
      endISO: '2026-01-13T19:00:00.000Z',
      status: 'committed'
    });

    // Should generate blocks in consistent order
    expect(result3.executionEvents).toHaveLength(3);
    expect(result3.today?.blocks).toHaveLength(3);
    expect(result3.today?.blocks[0].start).toBe('2026-01-13T09:00:00.000Z');
    expect(result3.today?.blocks[1].start).toBe('2026-01-13T13:00:00.000Z');
    expect(result3.today?.blocks[2].start).toBe('2026-01-13T17:00:00.000Z');
  });
});
