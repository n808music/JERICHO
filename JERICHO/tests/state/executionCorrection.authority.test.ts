import { describe, expect, it } from 'vitest';
import { evaluateExecutionCorrection, type ExecutionCorrectionInput } from '../../src/state/engine/executionCorrectionEvaluator.ts';

const GOAL_ID = 'goal-correction-authority';
const CYCLE_ID = 'cycle-correction-authority';
const DAY = '2026-05-02';

const ACTION_1 = {
  id: 'act-1',
  dependencyDetails: [],
};

const ACTION_2 = {
  id: 'act-2',
  dependencyDetails: [{ actionId: 'act-1', dependencyType: 'hard_gate' }],
};

function makeEvent({
  id,
  actionId = 'act-1',
  requiredSystemBlock = false,
  kind = 'complete',
  status = 'completed',
  reasonCode = null,
}: {
  id: string;
  actionId?: string;
  requiredSystemBlock?: boolean;
  kind?: 'complete' | 'missed' | 'skipped';
  status?: string;
  reasonCode?: string | null;
}) {
  return {
    id,
    blockId: `blk-${id}`,
    dateISO: DAY,
    minutes: 60,
    rawLabel: id,
    domain: 'Focus' as const,
    cycleId: CYCLE_ID,
    goalId: GOAL_ID,
    actionId,
    requiredSystemBlock,
    completed: kind === 'complete',
    kind,
    status,
    reasonCode,
  };
}

function baseInput(overrides: Partial<ExecutionCorrectionInput> = {}): ExecutionCorrectionInput {
  return {
    goalId: GOAL_ID,
    cycleId: CYCLE_ID,
    executionEvents: [],
    canonicalActions: [ACTION_1, ACTION_2],
    shotClock: null,
    ...overrides,
  };
}

describe('execution correction authority classification', () => {
  it('maps completed-only evidence to none/on_track', () => {
    const result = evaluateExecutionCorrection(
      baseInput({ executionEvents: [makeEvent({ id: 'complete-1' })] })
    );
    expect(result.level).toBe('none');
    expect(result.state).toBe('on_track');
    expect(result.correctionState).toBe('on_track');
  });

  it('maps a single recoverable miss to reschedule', () => {
    const result = evaluateExecutionCorrection(
      baseInput({
        executionEvents: [makeEvent({ id: 'miss-1', kind: 'missed', status: 'missed' })],
      })
    );
    expect(result.level).toBe('reschedule');
    expect(result.state).toBe('reschedule');
    expect(result.correctionState).toBe('watch');
    expect(result.recommendedActions[0]).toMatch(/reschedule/i);
  });

  it('maps deadline pressure to compression_warning', () => {
    const result = evaluateExecutionCorrection(
      baseInput({
        executionEvents: [
          makeEvent({
            id: 'miss-2',
            kind: 'missed',
            status: 'missed',
            requiredSystemBlock: true,
            actionId: 'act-2',
          }),
        ],
        shotClock: {
          paceState: 'behind',
          timedDeadlines: [{ deadlineState: 'due_soon', blockId: 'blk-deadline' }],
        },
      })
    );
    expect(result.level).toBe('compression_warning');
    expect(result.state).toBe('compression_warning');
    expect(result.correctionState).toBe('adjustment_recommended');
    expect(result.timedDeadlineRiskCount).toBe(1);
    expect(result.reasonCodes).toContain('timed_deadline_risk');
  });

  it('maps hard-gated downstream blockage to dependency_impact', () => {
    const result = evaluateExecutionCorrection(
      baseInput({
        executionEvents: [
          makeEvent({
            id: 'miss-3',
            kind: 'missed',
            status: 'missed',
            requiredSystemBlock: true,
            actionId: 'act-1',
          }),
        ],
      })
    );
    expect(result.level).toBe('dependency_impact');
    expect(result.state).toBe('dependency_impact');
    expect(result.correctionState).toBe('recovery_required');
    expect(result.blockedDownstreamCount).toBe(1);
  });

  it('maps repeated misses to plan_evolution_required', () => {
    const result = evaluateExecutionCorrection(
      baseInput({
        executionEvents: [
          makeEvent({ id: 'miss-4a', kind: 'missed', status: 'missed', actionId: 'act-1' }),
          makeEvent({ id: 'miss-4b', kind: 'missed', status: 'missed', actionId: 'act-2' }),
        ],
      })
    );
    expect(result.level).toBe('plan_evolution_required');
    expect(result.state).toBe('plan_evolution_required');
    expect(result.correctionState).toBe('recovery_required');
    expect(result.reasonCodes).toContain('repeated_missed_work');
  });

  it('preserves structured execution reason codes for later correction logic', () => {
    const result = evaluateExecutionCorrection(
      baseInput({
        executionEvents: [
          {
            ...makeEvent({ id: 'miss-reason', kind: 'missed', status: 'missed', reasonCode: 'dependency_blocked' }),
            dependencyRelation: 'dependency_suspicious',
          },
        ],
      })
    );
    expect(result.eventReasonCodes).toContain('dependency_blocked');
    expect(result.eventDependencyRelations).toContain('dependency_suspicious');
    expect(result.dependencyRiskCount).toBe(1);
  });

  it('flags required block removal as plan mutation risk', () => {
    const result = evaluateExecutionCorrection(
      baseInput({
        executionEvents: [makeEvent({ id: 'complete-keep' })],
        planMutationEvents: [
          {
            id: 'mut-remove-1',
            kind: 'remove_block',
            mutationType: 'plan_block_removed',
            blockId: 'blk-remove-1',
            goalId: GOAL_ID,
            cycleId: CYCLE_ID,
            scheduledDate: DAY,
            removedAtISO: `${DAY}T12:00:00.000Z`,
            source: 'user_action',
            reasonCode: 'bad_plan',
            requiredSystemBlock: true,
          },
        ],
      })
    );
    expect(result.planMutationCount).toBe(1);
    expect(result.requiredRemovedBlockCount).toBe(1);
    expect(result.mutationReasonCodes).toContain('bad_plan');
    expect(result.reasonCodes).toContain('required_block_removed');
    expect(result.reasonCodes).toContain('plan_mutation_review_required');
    expect(result.level).toBe('compression_warning');
  });
});
