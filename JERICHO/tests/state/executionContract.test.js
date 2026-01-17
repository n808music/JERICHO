import { describe, expect, it } from 'vitest';
import { canEmitExecutionEvent } from '../../src/state/engine/executionContract.ts';

describe('execution contract', () => {
  it('rejects update with time fields', () => {
    const events = [
      { id: 'e1', kind: 'create', blockId: 'b1', dateISO: '2026-01-07', completed: false }
    ];
    const update = { id: 'e2', kind: 'update', blockId: 'b1', startISO: '2026-01-08T09:00:00.000Z', completed: false };
    expect(canEmitExecutionEvent(events, update)).toBe(false);
  });

  it('rejects reschedule without existing block', () => {
    const events = [];
    const reschedule = { id: 'e1', kind: 'reschedule', blockId: 'b1', startISO: '2026-01-07T09:00:00.000Z', completed: false };
    expect(canEmitExecutionEvent(events, reschedule)).toBe(false);
  });

  it('rejects complete after delete', () => {
    const events = [
      { id: 'e1', kind: 'create', blockId: 'b1', dateISO: '2026-01-07', completed: false },
      { id: 'e2', kind: 'delete', blockId: 'b1', completed: false }
    ];
    const complete = { id: 'e3', kind: 'complete', blockId: 'b1', completed: true };
    expect(canEmitExecutionEvent(events, complete)).toBe(false);
  });

  it('allows update after completion when no time fields are present', () => {
    const events = [
      { id: 'e1', kind: 'create', blockId: 'b1', dateISO: '2026-01-07', completed: false },
      { id: 'e2', kind: 'complete', blockId: 'b1', completed: true }
    ];
    const update = { id: 'e3', kind: 'update', blockId: 'b1', rawLabel: 'After', completed: false };
    expect(canEmitExecutionEvent(events, update)).toBe(true);
  });
});
