import { describe, expect, it } from 'vitest';
import { deriveWhatMovedToday } from '../whatMovedToday.ts';

describe('what moved today', () => {
  it('returns criteria closed and deliverables advanced for today', () => {
    const dayKey = '2026-01-08';
    const workspace = {
      deliverables: [
        {
          id: 'd1',
          title: 'Ship MVP',
          criteria: [
            { id: 'c1', text: 'Draft', isDone: true, doneAtDayKey: dayKey },
            { id: 'c2', text: 'Polish', isDone: false }
          ]
        },
        {
          id: 'd2',
          title: 'Launch',
          criteria: [{ id: 'c3', text: 'Email', isDone: true, doneAtDayKey: dayKey }]
        }
      ]
    };

    const result = deriveWhatMovedToday({ deliverableWorkspace: workspace, dayKey });
    expect(result.criteriaClosed.length).toBe(2);
    expect(result.deliverablesAdvanced.length).toBe(2);
    expect(result.deliverablesAdvanced[0].delta).toBeGreaterThan(0);
  });
});
