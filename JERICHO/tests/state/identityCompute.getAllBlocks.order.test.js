import { describe, it, expect, vi } from 'vitest';
import { getAllBlocks } from '../../src/state/identityCompute.js';

function iso(dateStr, timeStr) {
  return `${dateStr}T${timeStr}:00.000Z`;
}

function makeBlock({ id, status }) {
  return {
    id,
    practice: 'Focus',
    label: 'SameId',
    start: iso('2025-12-03', '14:00'),
    end: iso('2025-12-03', '15:00'),
    status,
  };
}

describe('identityCompute.getAllBlocks (canonical union order)', () => {
  it('prefers today → week → cycle for duplicate IDs', () => {
    const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const sameIdToday = makeBlock({ id: 'dup', status: 'completed' });
    const sameIdCycle = makeBlock({ id: 'dup', status: 'planned' });
    const state = {
      today: { blocks: [sameIdToday] },
      currentWeek: { days: [{ date: '2025-12-03', blocks: [] }] },
      cycle: [{ date: '2025-12-03', blocks: [sameIdCycle] }],
    };
    const blocks = getAllBlocks(state);
    expect(blocks).toHaveLength(1);
    expect(blocks[0].id).toBe('dup');
    expect(blocks[0].status).toBe('completed');
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it('lets execution outcome status override planned projection without warning', () => {
    const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const sameIdToday = makeBlock({ id: 'dup', status: 'completed' });
    const sameIdStore = makeBlock({ id: 'dup', status: 'planned' });
    const state = {
      today: { blocks: [sameIdToday] },
      currentWeek: { days: [] },
      cycle: [],
      blockStore: { blocks: { dup: sameIdStore } },
    };
    const blocks = getAllBlocks(state);
    expect(blocks).toHaveLength(1);
    expect(blocks[0].status).toBe('completed');
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it('prefers missed status over planned projection without creating duplicates', () => {
    const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const sameIdToday = makeBlock({ id: 'dup-missed', status: 'missed' });
    const sameIdCycle = makeBlock({ id: 'dup-missed', status: 'planned' });
    const state = {
      today: { blocks: [sameIdToday] },
      currentWeek: { days: [] },
      cycle: [{ date: '2025-12-03', blocks: [sameIdCycle] }],
      blockStore: { blocks: { 'dup-missed': sameIdCycle } },
    };
    const blocks = getAllBlocks(state);
    expect(blocks).toHaveLength(1);
    expect(blocks[0].status).toBe('missed');
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it('prefers skipped status over planned projection without creating duplicates', () => {
    const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const sameIdToday = makeBlock({ id: 'dup-skipped', status: 'skipped' });
    const sameIdWeek = makeBlock({ id: 'dup-skipped', status: 'planned' });
    const state = {
      today: { blocks: [sameIdToday] },
      currentWeek: { days: [{ date: '2025-12-03', blocks: [sameIdWeek] }] },
      cycle: [],
    };
    const blocks = getAllBlocks(state);
    expect(blocks).toHaveLength(1);
    expect(blocks[0].status).toBe('skipped');
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it('keeps pending planned blocks planned when no execution outcome exists', () => {
    const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const planned = makeBlock({ id: 'pending', status: 'planned' });
    const state = {
      today: { blocks: [planned] },
      currentWeek: { days: [{ date: '2025-12-03', blocks: [planned] }] },
      cycle: [{ date: '2025-12-03', blocks: [planned] }],
      blockStore: { blocks: { pending: planned } },
    };
    const blocks = getAllBlocks(state);
    expect(blocks).toHaveLength(1);
    expect(blocks[0].status).toBe('planned');
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });
});
