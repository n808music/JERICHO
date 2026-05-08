import { describe, expect, it } from 'vitest';
import { materializeBlocksFromEvents } from '../../src/state/engine/todayAuthority.ts';

describe('todayAuthority session labels', () => {
  it('labels repeated sessions distinctly while preserving single-session titles', () => {
    const { days } = materializeBlocksFromEvents([
      {
        id: 'evt-1',
        blockId: 'blk-1',
        dateISO: '2026-03-10',
        minutes: 60,
        rawLabel: 'Draft creative brief',
        canonicalTitle: 'Draft creative brief',
        domain: 'Creation',
        cycleId: 'cycle-1',
        deliverableId: 'deliv-1',
        actionId: 'act-1',
        sessionIndex: 0,
        completed: true,
        kind: 'create',
        startISO: '2026-03-10T09:00:00.000Z',
      },
      {
        id: 'evt-2',
        blockId: 'blk-2',
        dateISO: '2026-03-10',
        minutes: 60,
        rawLabel: 'Draft creative brief',
        canonicalTitle: 'Draft creative brief',
        domain: 'Creation',
        cycleId: 'cycle-1',
        deliverableId: 'deliv-1',
        actionId: 'act-1',
        sessionIndex: 1,
        completed: false,
        kind: 'create',
        startISO: '2026-03-10T10:00:00.000Z',
      },
      {
        id: 'evt-3',
        blockId: 'blk-3',
        dateISO: '2026-03-10',
        minutes: 30,
        rawLabel: 'Single pass block',
        canonicalTitle: 'Single pass block',
        domain: 'Creation',
        cycleId: 'cycle-1',
        deliverableId: 'deliv-2',
        actionId: 'act-2',
        sessionIndex: 0,
        completed: false,
        kind: 'create',
        startISO: '2026-03-10T11:00:00.000Z',
      },
    ]);

    const blocks = days.flatMap((day) => day.blocks || []);
    const repeated = blocks.filter((block) => block.deliverableId === 'deliv-1');
    const single = blocks.find((block) => block.deliverableId === 'deliv-2');

    expect(repeated).toHaveLength(2);
    expect(repeated[0].displayTitle).toBe('Draft creative brief — Session 1 of 2');
    expect(repeated[1].displayTitle).toBe('Draft creative brief — Session 2 of 2');
    expect(repeated[0].title).toBe('Draft creative brief');
    expect(repeated[1].title).toBe('Draft creative brief');
    expect(repeated[0].sessionOrdinal).toBe(1);
    expect(repeated[1].sessionOrdinal).toBe(2);
    expect(repeated[0].sessionCount).toBe(2);
    expect(repeated[1].sessionCount).toBe(2);
    expect(single?.displayTitle).toBe('Single pass block');
    expect(single?.title).toBe('Single pass block');
  });

  it('does not add ordinal display labels when grouped sessions already have distinct titles', () => {
    const { days } = materializeBlocksFromEvents([
      {
        id: 'evt-1',
        blockId: 'blk-1',
        dateISO: '2026-03-10',
        minutes: 60,
        rawLabel: 'Compare manufacturer MOQ, lead time, certifications, and sample cost',
        canonicalTitle: 'Compare manufacturer MOQ, lead time, certifications, and sample cost',
        domain: 'Creation',
        cycleId: 'cycle-1',
        deliverableId: 'deliv-1',
        actionId: 'act-1',
        sessionIndex: 0,
        completed: false,
        kind: 'create',
        startISO: '2026-03-10T09:00:00.000Z',
      },
      {
        id: 'evt-2',
        blockId: 'blk-2',
        dateISO: '2026-03-10',
        minutes: 60,
        rawLabel: 'Request packaging quote and dieline requirements from supplier A',
        canonicalTitle: 'Request packaging quote and dieline requirements from supplier A',
        domain: 'Creation',
        cycleId: 'cycle-1',
        deliverableId: 'deliv-1',
        actionId: 'act-1',
        sessionIndex: 1,
        completed: false,
        kind: 'create',
        startISO: '2026-03-10T10:00:00.000Z',
      },
    ]);

    const blocks = days.flatMap((day) => day.blocks || []);

    expect(blocks[0].displayTitle).toBe('Compare manufacturer MOQ, lead time, certifications, and sample cost');
    expect(blocks[1].displayTitle).toBe('Request packaging quote and dieline requirements from supplier A');
    expect(blocks.some((block) => /session\s+\d+\s+of\s+\d+/i.test(block.displayTitle))).toBe(false);
  });
});
