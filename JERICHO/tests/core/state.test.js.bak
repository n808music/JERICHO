import { describe, it, expect } from 'vitest';
import { jerichoReducer, initialStore } from '../../src/core/state.js';

const cloneStore = () => JSON.parse(JSON.stringify(initialStore));

describe('jericho state', () => {
  it('switchMode toggles between discipline and zion', () => {
    const store = cloneStore();
    const next = jerichoReducer(store, { type: 'switchMode', nextMode: 'zion' });
    expect(next.mode).toBe('zion');
    const back = jerichoReducer(next, { type: 'switchMode', nextMode: 'discipline' });
    expect(back.mode).toBe('discipline');
  });

  it('completeTask updates task status', () => {
    const store = cloneStore();
    const next = jerichoReducer(store, { type: 'completeTask', taskId: 't1' });
    const task = next.state.tasks.find((t) => t.id === 't1');
    expect(task.status).toBe('completed');
    expect(next.state.metrics.completionRate).toBeGreaterThan(store.state.metrics.completionRate);
  });

  it('acknowledgeTask marks task acknowledged', () => {
    const store = cloneStore();
    const next = jerichoReducer(store, { type: 'acknowledgeTask', taskId: 't2' });
    const task = next.state.tasks.find((t) => t.id === 't2');
    expect(task.acknowledged).toBe(true);
  });

  it('setUserCondition updates userToday condition', () => {
    const store = cloneStore();
    const next = jerichoReducer(store, { type: 'setUserCondition', condition: 'overwhelmed' });
    expect(next.state.userToday.condition).toBe('overwhelmed');
  });
});
