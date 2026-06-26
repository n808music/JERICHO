import { describe, expect, it } from 'vitest';
import {
  deriveStructureSchedulingSemanticSummary,
  getStructureSchedulingLabels,
} from '../../src/state/structureSchedulingSemantics.js';

describe('structure scheduling semantics summary', () => {
  it('returns normalized diagnostic payload for semantic auditing', () => {
    const summary = deriveStructureSchedulingSemanticSummary({
      proposedBlocks: [{ id: 'p1', cycleId: 'c1', goalId: 'g1', status: 'suggested' }],
      suggestedBlocks: [],
      deliverables: [{ id: 'd1', title: 'Planning & setup', requiredBlocks: 4 }],
      workspace: { autoStrategy: { detectedType: 'generic' } },
      executionEvents: [],
      activeCycleId: 'c1',
      activeGoalId: 'g1',
      lastPlanError: null,
    });

    expect(summary).toEqual(
      expect.objectContaining({
        displayedGroupType: 'phase',
        displayedGroupCount: 1,
        displayedSessionCount: 4,
        proposedBlockCount: 1,
        proposedBlockScope: 'active_cycle_goal',
        scheduleStatus: 'draft_schedule_ready',
        scheduleLifecycle: 'draft_schedule_ready',
        sourcePaths: expect.any(Object),
      })
    );
  });

  it('surfaces horizon insufficiency distinctly from a normal draft schedule', () => {
    const summary = deriveStructureSchedulingSemanticSummary({
      proposedBlocks: [{ id: 'p1', cycleId: 'c1', goalId: 'g1', status: 'suggested' }],
      activeCycleId: 'c1',
      activeGoalId: 'g1',
      activePlanSummary: {
        planStatus: 'VALID_BUT_HORIZON_INSUFFICIENT',
        requiredBlockCount: 45,
        scheduledBlockCount: 26,
        unscheduledBlockCount: 19,
        candidateResolutionKinds: ['EXTEND_HORIZON', 'REDUCE_CYCLE_COUNT', 'ACCEPT_PARTIAL_PLAN'],
        recommendations: [
          {
            kind: 'EXTEND_HORIZON',
            extensionDays: 20,
            extensionWeeks: 4,
            earliestFeasibleCompletionDate: '2026-06-30',
            unscheduledBlockCount: 19,
          },
        ],
      },
      lastPlanError: null,
    });

    expect(summary).toEqual(
      expect.objectContaining({
        scheduleStatus: 'horizon_insufficient',
        planStatus: 'VALID_BUT_HORIZON_INSUFFICIENT',
        requiredBlockCount: 45,
        scheduledBlockCount: 26,
        unscheduledBlockCount: 19,
        candidateResolutionKinds: ['EXTEND_HORIZON', 'REDUCE_CYCLE_COUNT', 'ACCEPT_PARTIAL_PLAN'],
        recommendations: [
          expect.objectContaining({
            kind: 'EXTEND_HORIZON',
            extensionDays: 20,
          }),
        ],
      })
    );
    expect(getStructureSchedulingLabels(summary).scheduleStatusLabel).toMatch(/26\/45 blocks fit/i);
  });

  it('keeps draft schedule status when canonical proposed blocks exist alongside a stale feasibility error', () => {
    const summary = deriveStructureSchedulingSemanticSummary({
      proposedBlocks: [{ id: 'p1', cycleId: 'c1', goalId: 'g1', status: 'suggested' }],
      activeCycleId: 'c1',
      activeGoalId: 'g1',
      lastPlanError: {
        code: 'FEASIBILITY_MISSING_FOR_PLAN',
        reasonCodes: ['POS_FEASIBILITY_INPUT_MISSING'],
      },
    });

    expect(summary).toEqual(
      expect.objectContaining({
        scheduleStatus: 'draft_schedule_ready',
        proposedBlockCount: 1,
      })
    );
    expect(getStructureSchedulingLabels(summary).scheduleStatusLabel).toBe('Schedule draft ready.');
  });
});
