import { describe, expect, it } from 'vitest';
import { materializeBlocksFromEvents } from '../../src/state/engine/todayAuthority.ts';

describe('execution event materialization', () => {
  it('applies create/update/reschedule/complete in order', () => {
    const events = [
      {
        id: 'e1',
        kind: 'create',
        blockId: 'b1',
        dateISO: '2025-12-10',
        startISO: '2025-12-10T09:00:00.000Z',
        endISO: '2025-12-10T10:00:00.000Z',
        minutes: 60,
        rawLabel: 'Alpha',
        domain: 'Focus',
        completed: false
      },
      {
        id: 'e2',
        kind: 'update',
        blockId: 'b1',
        rawLabel: 'Beta',
        minutes: 60,
        completed: false
      },
      {
        id: 'e3',
        kind: 'reschedule',
        blockId: 'b1',
        startISO: '2025-12-10T11:00:00.000Z',
        endISO: '2025-12-10T12:30:00.000Z',
        minutes: 90,
        completed: false
      },
      {
        id: 'e4',
        kind: 'complete',
        blockId: 'b1',
        completed: true
      }
    ];

    const { todayBlocks } = materializeBlocksFromEvents(events, { todayISO: '2025-12-10' });
    const block = todayBlocks.find((b) => b.id === 'b1');

    expect(block).toBeTruthy();
    expect(block.label).toBe('Beta');
    expect(block.status).toBe('completed');
    expect(block.start).toBe('2025-12-10T11:00:00.000Z');
    expect(block.end).toBe('2025-12-10T12:30:00.000Z');
  });

  it('removes blocks when delete arrives last', () => {
    const events = [
      {
        id: 'e1',
        kind: 'create',
        blockId: 'b2',
        dateISO: '2025-12-10',
        startISO: '2025-12-10T08:00:00.000Z',
        endISO: '2025-12-10T09:00:00.000Z',
        minutes: 60,
        rawLabel: 'To Remove',
        domain: 'Creation',
        completed: false
      },
      {
        id: 'e2',
        kind: 'delete',
        blockId: 'b2',
        completed: false
      }
    ];

    const { todayBlocks } = materializeBlocksFromEvents(events, { todayISO: '2025-12-10' });
    expect(todayBlocks.find((b) => b.id === 'b2')).toBeFalsy();
  });

  it('is deterministic and idempotent for the same events', () => {
    const events = [
      {
        id: 'e1',
        kind: 'create',
        blockId: 'b3',
        dateISO: '2025-12-10',
        startISO: '2025-12-10T07:00:00.000Z',
        minutes: 30,
        rawLabel: 'Deterministic',
        domain: 'Body',
        completed: false
      },
      {
        id: 'e2',
        kind: 'complete',
        blockId: 'b3',
        completed: true
      }
    ];

    const first = materializeBlocksFromEvents(events, { todayISO: '2025-12-10' });
    const second = materializeBlocksFromEvents(events, { todayISO: '2025-12-10' });

    expect(first.todayBlocks).toEqual(second.todayBlocks);
    expect(first.days).toEqual(second.days);
  });

  it('ignores updates for missing blocks and preserves completion', () => {
    const events = [
      {
        id: 'e1',
        kind: 'update',
        blockId: 'missing',
        rawLabel: 'Should not appear',
        completed: false
      },
      {
        id: 'e2',
        kind: 'create',
        blockId: 'b4',
        dateISO: '2025-12-10',
        startISO: '2025-12-10T09:00:00.000Z',
        minutes: 60,
        rawLabel: 'Before Complete',
        domain: 'Focus',
        completed: false
      },
      {
        id: 'e3',
        kind: 'complete',
        blockId: 'b4',
        completed: true
      },
      {
        id: 'e4',
        kind: 'update',
        blockId: 'b4',
        rawLabel: 'After Complete',
        completed: false
      }
    ];

    const { todayBlocks } = materializeBlocksFromEvents(events, { todayISO: '2025-12-10' });
    const missing = todayBlocks.find((b) => b.id === 'missing');
    const block = todayBlocks.find((b) => b.id === 'b4');

    expect(missing).toBeFalsy();
    expect(block?.label).toBe('After Complete');
    expect(block?.status).toBe('completed');
  });

  it('reschedule across day boundary moves the day group', () => {
    const events = [
      {
        id: 'e1',
        kind: 'create',
        blockId: 'b5',
        dateISO: '2025-12-10',
        startISO: '2025-12-10T23:30:00.000Z',
        minutes: 30,
        rawLabel: 'Late Block',
        domain: 'Resources',
        completed: false
      },
      {
        id: 'e2',
        kind: 'reschedule',
        blockId: 'b5',
        startISO: '2025-12-11T08:00:00.000Z',
        minutes: 30,
        completed: false
      }
    ];

    const { days } = materializeBlocksFromEvents(events, { todayISO: '2025-12-10' });
    const dayKeys = days.map((d) => d.date);

    expect(dayKeys).toContain('2025-12-11');
    expect(dayKeys).not.toContain('2025-12-10');
  });

  it('delete wins over later completion', () => {
    const events = [
      {
        id: 'e1',
        kind: 'create',
        blockId: 'b6',
        dateISO: '2025-12-10',
        startISO: '2025-12-10T10:00:00.000Z',
        minutes: 30,
        rawLabel: 'To Delete',
        domain: 'Creation',
        completed: false
      },
      {
        id: 'e2',
        kind: 'delete',
        blockId: 'b6',
        completed: false
      },
      {
        id: 'e3',
        kind: 'complete',
        blockId: 'b6',
        completed: true
      }
    ];

    const { todayBlocks } = materializeBlocksFromEvents(events, { todayISO: '2025-12-10' });
    expect(todayBlocks.find((b) => b.id === 'b6')).toBeFalsy();
  });

  it('keeps completion but allows metadata updates after completion', () => {
    const events = [
      {
        id: 'e1',
        kind: 'create',
        blockId: 'b7',
        dateISO: '2026-01-07',
        startISO: '2026-01-07T09:00:00.000Z',
        minutes: 30,
        rawLabel: 'Before',
        domain: 'Focus',
        completed: false
      },
      {
        id: 'e2',
        kind: 'complete',
        blockId: 'b7',
        completed: true
      },
      {
        id: 'e3',
        kind: 'update',
        blockId: 'b7',
        rawLabel: 'After',
        dateISO: '2026-01-08',
        startISO: '2026-01-08T09:00:00.000Z',
        completed: false
      }
    ];

    const { todayBlocks, days } = materializeBlocksFromEvents(events, { todayISO: '2026-01-07' });
    const block = todayBlocks.find((b) => b.id === 'b7');
    const dayKeys = days.map((d) => d.date);

    expect(block?.label).toBe('After');
    expect(block?.status).toBe('completed');
    expect(dayKeys).toContain('2026-01-07');
    expect(dayKeys).not.toContain('2026-01-08');
  });
});
