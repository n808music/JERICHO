import { describe, it, expect, vi } from 'vitest';
import { getAllBlocks } from '../../src/state/identityCompute.js';

function iso(dateStr, timeStr) {
  return `${dateStr}T${timeStr}:00.000Z`;
}

function makeBlock({ id, status }) {
  return { id, practice: 'Focus', label: 'SameId', start: iso('2025-12-03', '14:00'), end: iso('2025-12-03', '15:00'), status };
}

describe('identityCompute.getAllBlocks (canonical union order)', () => {
  it('prefers today → week → cycle for duplicate IDs', () => {
    const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const sameIdToday = makeBlock({ id: 'dup', status: 'completed' });
    const sameIdCycle = makeBlock({ id: 'dup', status: 'planned' });
    const state = {
      today: { blocks: [sameIdToday] },
      currentWeek: { days: [{ date: '2025-12-03', blocks: [] }] },
      cycle: [{ date: '2025-12-03', blocks: [sameIdCycle] }]
    };
    const blocks = getAllBlocks(state);
    expect(blocks).toHaveLength(1);
    expect(blocks[0].id).toBe('dup');
    expect(blocks[0].status).toBe('completed');
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });
});
