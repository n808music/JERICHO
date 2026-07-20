import { describe, it, expect } from 'vitest';
import { buildProposedBlocksFromSchedule } from './proposedBlocksFromSchedule.js';

const SAMPLE_SCHEDULED_BLOCKS = [
  {
    id: 'sched-cycle-1-1',
    cycleId: 'cycle-1',
    goalId: 'goal-1',
    dayKey: '2026-02-02',
    startISO: '2026-02-02T09:00:00.000Z',
    endISO: '2026-02-02T10:00:00.000Z',
    durationMinutes: 60,
    origin: 'schedule_generation',
    status: 'proposed',
    deliverableId: 'deliv-causal-1',
    deliverableTitle: 'Foundation Project',
    sourceProjectId: 'p1',
    entityId: 'e1',
    entityLabel: 'F8 Energy',
    initiativeId: 'i1',
    laneId: 'i1',
    laneLabel: 'Launch Initiative',
    kind: 'PLANNING',
    order: 0,
  },
  {
    id: 'sched-cycle-1-2',
    cycleId: 'cycle-1',
    goalId: 'goal-1',
    dayKey: '2026-02-03',
    startISO: '2026-02-03T09:00:00.000Z',
    endISO: '2026-02-03T10:00:00.000Z',
    durationMinutes: 60,
    origin: 'schedule_generation',
    status: 'proposed',
    deliverableId: 'deliv-causal-2',
    deliverableTitle: 'Finish Project',
    sourceProjectId: 'p2',
    entityId: 'e1',
    entityLabel: 'F8 Energy',
    initiativeId: null,
    laneId: null,
    laneLabel: null,
    kind: 'VERIFICATION',
    order: 0,
  },
];

describe('buildProposedBlocksFromSchedule', () => {
  it('returns [] for an empty/missing schedule', () => {
    expect(buildProposedBlocksFromSchedule([])).toEqual([]);
    expect(buildProposedBlocksFromSchedule(undefined)).toEqual([]);
  });

  it('produces one "suggested" proposal per ScheduledBlock with startISO carried through unchanged', () => {
    const proposals = buildProposedBlocksFromSchedule(SAMPLE_SCHEDULED_BLOCKS);
    expect(proposals).toHaveLength(2);
    proposals.forEach((p) => expect(p.status).toBe('suggested'));
    expect(proposals[0].startISO).toBe('2026-02-02T09:00:00.000Z');
    expect(proposals[0].endISO).toBe('2026-02-02T10:00:00.000Z');
  });

  it('maps deliverableTitle to title (the field buildScheduleReviewBlock/UI actually read)', () => {
    const proposals = buildProposedBlocksFromSchedule(SAMPLE_SCHEDULED_BLOCKS);
    expect(proposals[0].title).toBe('Foundation Project');
    expect(proposals[1].title).toBe('Finish Project');
  });

  it('carries entity/lane identity through untouched', () => {
    const proposals = buildProposedBlocksFromSchedule(SAMPLE_SCHEDULED_BLOCKS);
    expect(proposals[0]).toMatchObject({ entityId: 'e1', entityLabel: 'F8 Energy', laneId: 'i1', laneLabel: 'Launch Initiative' });
    expect(proposals[1]).toMatchObject({ entityId: 'e1', laneId: null, laneLabel: null });
  });

  it('carries initiativeId and sourceProjectId through (Project/Initiative isolation identity — Gate 2)', () => {
    const proposals = buildProposedBlocksFromSchedule(SAMPLE_SCHEDULED_BLOCKS);
    // Both are needed so the calendar scope toggle can isolate by Initiative AND Project on
    // matrix-derived blocks; the adapter previously dropped both.
    expect(proposals[0]).toMatchObject({ initiativeId: 'i1', sourceProjectId: 'p1' });
    expect(proposals[1]).toMatchObject({ initiativeId: null, sourceProjectId: 'p2' });
  });

  it('carries cycleId/goalId/deliverableId through for lineage', () => {
    const proposals = buildProposedBlocksFromSchedule(SAMPLE_SCHEDULED_BLOCKS);
    expect(proposals[0].cycleId).toBe('cycle-1');
    expect(proposals[0].goalId).toBe('goal-1');
    expect(proposals[0].deliverableId).toBe('deliv-causal-1');
  });

  it('tags the source so this origin is distinguishable from LLM-generated proposals', () => {
    const proposals = buildProposedBlocksFromSchedule(SAMPLE_SCHEDULED_BLOCKS);
    proposals.forEach((p) => expect(p.source).toBe('matrix_schedule_generation'));
  });

  it('falls back to a generic title if deliverableTitle is missing', () => {
    const proposals = buildProposedBlocksFromSchedule([{ ...SAMPLE_SCHEDULED_BLOCKS[0], deliverableTitle: undefined }]);
    expect(proposals[0].title).toBe('Scheduled action');
  });
});
