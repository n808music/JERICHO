import { describe, expect, it } from 'vitest';
import { buildHistoryProfile, type CycleHistorySignals } from '../../src/planner/scoring/historySignals.ts';

function mk(id: string, endDayKey: string, completionRate: number, churnIndex: number): CycleHistorySignals {
  return {
    cycleId: id,
    startDayKey: '2026-01-01',
    endDayKey,
    scheduledMinutesTotal: 1000,
    completedMinutesTotal: Math.round(1000 * completionRate),
    completionRate,
    completionVelocityMinPerDay: Math.round(100 * completionRate),
    movedMinutesTotal: 20,
    droppedMinutesTotal: 10,
    churnIndex,
    rescheduleCount: 2,
    overCapDaysCount: 0,
    avgDailyScheduledMin: 100,
    maxDailyScheduledMin: 160,
    depTightCount: 2,
    depWindowBlockedCount: 0,
    milestoneAtRiskCount: id === 'c5' ? 1 : 0,
    placementAnchoringMissCount: id === 'c5' ? 3 : 1,
    outsideExecutionHorizonMinutes: 30,
    unplacedEstimateMinTotal: 15,
  };
}

describe('history profile aggregation', () => {
  it('aggregates bounded windows and computes deterministic trends', () => {
    const signals: CycleHistorySignals[] = [
      mk('c1', '2026-01-10', 0.9, 10),
      mk('c2', '2026-01-20', 0.8, 12),
      mk('c3', '2026-01-30', 0.7, 16),
      mk('c4', '2026-02-09', 0.6, 22),
      mk('c5', '2026-02-19', 0.5, 30),
    ];

    const profile = buildHistoryProfile(signals, { windowCycles: 5 });

    expect(profile.window.cycleCount).toBe(5);
    expect(profile.window.usedCycleIds).toEqual(['c1', 'c2', 'c3', 'c4', 'c5']);
    expect(profile.window.minEndDayKey).toBe('2026-01-10');
    expect(profile.window.maxEndDayKey).toBe('2026-02-19');
    expect(profile.aggregates.avgCompletionRate).toBeGreaterThan(0.5);
    expect(profile.aggregates.avgCompletionRate).toBeLessThan(0.9);
    expect(profile.aggregates.avgChurnIndex).toBeGreaterThan(10);
    expect(profile.trends.completionRateTrend).toBe('down');
    expect(profile.trends.churnTrend).toBe('up');
  });
});
