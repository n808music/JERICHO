import { describe, it, expect } from 'vitest';
import { buildScheduledBlocksFromDeterministicResult } from './scheduledBlocksFromDeterministicResult.js';

function infeasibleResult() {
  return { status: 'INFEASIBLE', proposedBlocks: [], autoDeliverables: [], error: { code: 'NO_ELIGIBLE_DAYS', message: 'x' } };
}

function successResultTwoBlocksSameDay() {
  return {
    status: 'SUCCESS',
    proposedBlocks: [
      { id: 'block-0', dayKey: '2026-02-02', deliverableId: 'deliv-causal-1', deliverableTitle: 'Foundation', kind: 'PLANNING', durationMinutes: 60, order: 0, sourceProjectId: 'p1' },
      { id: 'block-1', dayKey: '2026-02-02', deliverableId: 'deliv-causal-2', deliverableTitle: 'Finish', kind: 'VERIFICATION', durationMinutes: 60, order: 0, sourceProjectId: 'p2' },
    ],
    autoDeliverables: [],
  };
}

function partialResultOneBlock() {
  return {
    status: 'PARTIAL',
    proposedBlocks: [
      { id: 'block-0', dayKey: '2026-02-02', deliverableId: 'deliv-causal-1', deliverableTitle: 'Foundation', kind: 'PLANNING', durationMinutes: 60, order: 0 },
    ],
    autoDeliverables: [],
    capacityViolation: { requiredBlocks: 3, availableBlocks: 1, overageMinutes: 120, cutSteps: [] },
  };
}

const MATRIX = {
  entitiesById: { e1: { id: 'e1', name: 'F8 Energy' } },
  initiativesById: { i1: { id: 'i1', name: 'Launch Initiative' } },
  projectsById: {
    p1: { id: 'p1', name: 'Foundation Project', owningEntityId: 'e1', owningInitiativeId: 'i1' },
    p2: { id: 'p2', name: 'Finish Project', owningEntityId: 'e1', owningInitiativeId: null },
  },
};

describe('buildScheduledBlocksFromDeterministicResult', () => {
  it('returns [] for an INFEASIBLE result', () => {
    expect(buildScheduledBlocksFromDeterministicResult({ result: infeasibleResult(), cycleId: 'c1' })).toEqual([]);
  });

  it('returns [] when proposedBlocks is empty', () => {
    const result = { status: 'SUCCESS', proposedBlocks: [], autoDeliverables: [] };
    expect(buildScheduledBlocksFromDeterministicResult({ result, cycleId: 'c1' })).toEqual([]);
  });

  it('returns [] when result is missing/undefined (defensive)', () => {
    expect(buildScheduledBlocksFromDeterministicResult({ cycleId: 'c1' })).toEqual([]);
  });

  it('produces one ScheduledBlock per proposedBlock, with core fields passed through', () => {
    const blocks = buildScheduledBlocksFromDeterministicResult({
      result: successResultTwoBlocksSameDay(),
      matrix: MATRIX,
      cycleId: 'cycle-1',
      goalId: 'goal-1',
    });
    expect(blocks).toHaveLength(2);
    expect(blocks[0]).toMatchObject({
      cycleId: 'cycle-1',
      goalId: 'goal-1',
      dayKey: '2026-02-02',
      durationMinutes: 60,
      origin: 'schedule_generation',
      status: 'proposed',
      deliverableId: 'deliv-causal-1',
      deliverableTitle: 'Foundation',
      kind: 'PLANNING',
      order: 0,
    });
  });

  it('stacks same-day blocks back-to-back starting at dayStartTime (default 09:00)', () => {
    const blocks = buildScheduledBlocksFromDeterministicResult({
      result: successResultTwoBlocksSameDay(),
      matrix: MATRIX,
      cycleId: 'cycle-1',
      timeZone: 'UTC',
    });
    expect(blocks[0].startISO).toBe('2026-02-02T09:00:00.000Z');
    expect(blocks[0].endISO).toBe('2026-02-02T10:00:00.000Z');
    // Second block on the same day starts where the first left off.
    expect(blocks[1].startISO).toBe('2026-02-02T10:00:00.000Z');
    expect(blocks[1].endISO).toBe('2026-02-02T11:00:00.000Z');
  });

  it('resolves entityId/entityLabel/initiativeId/laneId/laneLabel from the matrix via sourceProjectId', () => {
    const blocks = buildScheduledBlocksFromDeterministicResult({
      result: successResultTwoBlocksSameDay(),
      matrix: MATRIX,
      cycleId: 'cycle-1',
    });
    expect(blocks[0]).toMatchObject({
      entityId: 'e1',
      entityLabel: 'F8 Energy',
      initiativeId: 'i1',
      laneId: 'i1',
      laneLabel: 'Launch Initiative',
      // Gate 8: the project id is carried onto the block (not just the entity/initiative it
      // resolves), so the calendar scope toggle can isolate by Project on real blocks.
      sourceProjectId: 'p1',
    });
    expect(blocks[1].sourceProjectId).toBe('p2');
    // p2 has no owningInitiativeId -> laneId/laneLabel null, but entity still resolves.
    expect(blocks[1]).toMatchObject({
      entityId: 'e1',
      entityLabel: 'F8 Energy',
      initiativeId: null,
      laneId: null,
      laneLabel: null,
    });
  });

  it('leaves entity/lane fields null when the block has no sourceProjectId (manual/fallback deliverables)', () => {
    const blocks = buildScheduledBlocksFromDeterministicResult({
      result: partialResultOneBlock(),
      matrix: MATRIX,
      cycleId: 'cycle-1',
    });
    expect(blocks[0]).toMatchObject({
      entityId: null,
      entityLabel: null,
      initiativeId: null,
      laneId: null,
      laneLabel: null,
    });
  });

  it('a PARTIAL result still produces real, schedulable blocks for whatever fit (not silently emptied)', () => {
    const blocks = buildScheduledBlocksFromDeterministicResult({
      result: partialResultOneBlock(),
      matrix: MATRIX,
      cycleId: 'cycle-1',
    });
    expect(blocks).toHaveLength(1);
    expect(blocks[0].status).toBe('proposed');
  });

  it('every block starts life as status "proposed", regardless of SUCCESS vs PARTIAL', () => {
    const successBlocks = buildScheduledBlocksFromDeterministicResult({ result: successResultTwoBlocksSameDay(), matrix: MATRIX, cycleId: 'c1' });
    const partialBlocks = buildScheduledBlocksFromDeterministicResult({ result: partialResultOneBlock(), matrix: MATRIX, cycleId: 'c1' });
    [...successBlocks, ...partialBlocks].forEach((b) => expect(b.status).toBe('proposed'));
  });

  it('assigns deterministic, unique ids scoped to the cycle', () => {
    const blocks = buildScheduledBlocksFromDeterministicResult({
      result: successResultTwoBlocksSameDay(),
      matrix: MATRIX,
      cycleId: 'cycle-42',
    });
    expect(blocks.map((b) => b.id)).toEqual(['sched-cycle-42-1', 'sched-cycle-42-2']);
  });
});
