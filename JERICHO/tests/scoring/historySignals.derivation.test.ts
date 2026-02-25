import { describe, expect, it } from 'vitest';
import { deriveCycleHistorySignals } from '../../src/planner/scoring/historySignals.ts';

describe('history signals derivation', () => {
  it('derives stable throughput/churn/load signals from cycle artifacts', () => {
    const cycle = {
      id: 'cycle-1',
      startedAtDayKey: '2026-01-01',
      endedAtDayKey: '2026-01-03',
      planDraft: { maxScheduledMinutesPerDay: 120 },
    };
    const blocks = [
      {
        id: 'b1',
        start: '2026-01-01T09:00:00.000Z',
        end: '2026-01-01T10:00:00.000Z',
        status: 'completed',
      },
      {
        id: 'b2',
        start: '2026-01-02T09:00:00.000Z',
        end: '2026-01-02T10:30:00.000Z',
        status: 'planned',
      },
    ];
    const events = [
      { kind: 'create', cycleId: 'cycle-1', blockId: 'b1', minutes: 60 },
      { kind: 'reschedule', cycleId: 'cycle-1', blockId: 'b2', minutes: 30 },
      { kind: 'delete', cycleId: 'cycle-1', blockId: 'b3', minutes: 15 },
    ];

    const out = deriveCycleHistorySignals(cycle, blocks, events, {
      depTightCount: 2,
      milestoneAtRiskCount: 1,
      placementAnchoringMissCount: 3,
      outsideExecutionHorizonMinutes: 120,
      unplacedEstimateMinTotal: 45,
    });

    expect(out.cycleId).toBe('cycle-1');
    expect(out.scheduledMinutesTotal).toBe(150);
    expect(out.completedMinutesTotal).toBe(60);
    expect(out.completionRate).toBe(0.4);
    expect(out.completionVelocityMinPerDay).toBe(30);
    expect(out.movedMinutesTotal).toBe(30);
    expect(out.droppedMinutesTotal).toBe(15);
    expect(out.rescheduleCount).toBe(1);
    expect(out.overCapDaysCount).toBe(0);
    expect(out.avgDailyScheduledMin).toBe(75);
    expect(out.maxDailyScheduledMin).toBe(90);
    expect(out.depTightCount).toBe(2);
    expect(out.milestoneAtRiskCount).toBe(1);
    expect(out.placementAnchoringMissCount).toBe(3);
    expect(out.outsideExecutionHorizonMinutes).toBe(120);
    expect(out.unplacedEstimateMinTotal).toBe(45);
  });
});
