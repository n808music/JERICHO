import { describe, it, expect } from 'vitest';
import { buildExecutionEventFromBlock, materializeBlocksFromEvents } from '../../src/state/engine/todayAuthority.ts';
import { buildBackendHydratedState, buildInitialIdentityState } from '../../src/state/identityStore.js';
import { getAllBlocks } from '../../src/state/identityCompute.js';
import { standardAlbumGoalContract } from '../fixtures/standardAlbumGoalContract.js';

describe('backend persistence hydration', () => {
  it('reconstructs the same calendar from persisted events', () => {
    const contract = standardAlbumGoalContract({
      goalId: 'goal-1',
      cycleId: 'cycle-1',
      temporalBinding: { startDayKey: '2026-01-20' },
    });
    const block = {
      id: 'blk-1',
      cycleId: 'cycle-1',
      goalId: 'goal-1',
      deliverableId: 'deliv-causal-1',
      criterionId: 'crit-deliv-causal-1-1',
      label: 'Draft tracklist',
      start: '2026-01-20T09:00:00.000Z',
      end: '2026-01-20T10:00:00.000Z',
      status: 'planned',
      domain: 'Focus',
    };
    const createEvent = buildExecutionEventFromBlock(block, {
      id: 'evt-create',
      kind: 'create',
      completed: false,
      startISO: block.start,
      endISO: block.end,
      minutes: 60,
    });
    const completeEvent = buildExecutionEventFromBlock(block, {
      id: 'evt-complete',
      kind: 'complete',
      completed: true,
      minutes: 60,
    });
    const events = [createEvent, completeEvent];
    const expected = materializeBlocksFromEvents(events, { todayISO: '2026-01-20' });

    const baseState = buildInitialIdentityState();
    baseState.appTime = {
      ...(baseState.appTime || {}),
      nowISO: '2026-01-20T12:00:00.000Z',
      activeDayKey: '2026-01-20',
      timeZone: 'UTC',
    };
    const hydrated = buildBackendHydratedState(baseState, {
      activeCycleId: 'cycle-1',
      goalContract: contract,
      events,
    });
    const blocks = getAllBlocks(hydrated);
    const hydratedMaterialized = materializeBlocksFromEvents(hydrated.executionEvents || [], {
      todayISO: '2026-01-20',
    });
    const hydratedBlocks = hydratedMaterialized.days.flatMap((d) => d.blocks || []);

    expect(hydratedBlocks).toHaveLength(expected.days.flatMap((d) => d.blocks || []).length);
    expect(hydratedBlocks[0].id).toBe('blk-1');
    expect(hydratedBlocks[0].status).toBe('completed');
    const deliverable = hydrated.deliverablesByCycleId['cycle-1'].deliverables.find((d) => d.id === 'deliv-causal-1');
    const criterion = deliverable.criteria.find((c) => c.id === 'crit-deliv-causal-1-1');
    expect(criterion.isDone).toBe(true);
  });

  it('rehydrate twice does not duplicate blocks', () => {
    const contract = standardAlbumGoalContract({
      goalId: 'goal-2',
      cycleId: 'cycle-2',
      temporalBinding: { startDayKey: '2026-02-10' },
    });
    const block = {
      id: 'blk-2',
      cycleId: 'cycle-2',
      goalId: 'goal-2',
      deliverableId: 'deliv-causal-1',
      criterionId: 'crit-deliv-causal-1-1',
      label: 'Record rough vocals',
      start: '2026-02-10T09:00:00.000Z',
      end: '2026-02-10T10:00:00.000Z',
      status: 'planned',
      domain: 'Focus',
    };
    const createEvent = buildExecutionEventFromBlock(block, {
      id: 'evt-create-2',
      kind: 'create',
      completed: false,
      startISO: block.start,
      endISO: block.end,
      minutes: 60,
    });
    const events = [createEvent];

    const baseState = buildInitialIdentityState();
    baseState.appTime = {
      ...(baseState.appTime || {}),
      nowISO: '2026-02-10T12:00:00.000Z',
      activeDayKey: '2026-02-10',
      timeZone: 'UTC',
    };
    const first = buildBackendHydratedState(baseState, {
      activeCycleId: 'cycle-2',
      goalContract: contract,
      events,
    });
    const second = buildBackendHydratedState(first, {
      activeCycleId: 'cycle-2',
      goalContract: contract,
      events,
    });
    const blocks = getAllBlocks(second);

    expect(blocks).toHaveLength(1);
    expect(blocks[0].id).toBe('blk-2');
  });
});
