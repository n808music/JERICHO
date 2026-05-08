import { describe, expect, it } from 'vitest';
import { getSpineBoundary } from '../../src/state/spineBoundary.ts';

function buildState() {
  return {
    activeCycleId: 'cycle-1',
    appTime: { timeZone: 'UTC', activeDayKey: '2026-01-20' },
    today: { date: '2026-01-20' },
    cyclesById: {
      'cycle-1': {
        id: 'cycle-1',
        goalContract: { deadline: { dayKey: '2026-03-01' } },
        actions: [{ id: 'a-1', status: 'todo' }],
      },
    },
    actionsByCycleId: { 'cycle-1': { actions: [{ id: 'a-1', status: 'todo' }] } },
    deliverablesByCycleId: {
      'cycle-1': {
        deliverables: [{ id: 'd-1', title: 'Milestone', dueDayKey: '2026-02-01', actionIds: ['a-1'] }],
      },
    },
  };
}

describe('spine boundary', () => {
  it('prefers earliest incomplete deliverable before goal deadline', () => {
    const boundary = getSpineBoundary(buildState(), 'cycle-1', 'DELIVERABLE_FIRST');
    expect(boundary.boundaryKind).toBe('DELIVERABLE');
    expect(boundary.boundaryEndISO).toContain('2026-02-01');
  });

  it('falls back to goal deadline when no incomplete deliverables remain', () => {
    const state = buildState();
    state.actionsByCycleId['cycle-1'].actions[0].status = 'done';
    state.cyclesById['cycle-1'].actions[0].status = 'done';
    const boundary = getSpineBoundary(state, 'cycle-1', 'DELIVERABLE_FIRST');
    expect(boundary.boundaryKind).toBe('GOAL');
    expect(boundary.boundaryEndISO).toContain('2026-03-01');
  });

  it('caps far deadline and marks horizon fallback deterministically', () => {
    const state = buildState();
    state.cyclesById['cycle-1'].goalContract.deadline.dayKey = '2030-01-01';
    state.deliverablesByCycleId['cycle-1'].deliverables = [];
    const boundary = getSpineBoundary(state, 'cycle-1', 'GOAL_ONLY');
    expect(boundary.boundaryKind).toBe('HORIZON_FALLBACK');
    expect(boundary.capped).toBe(true);
  });
});
