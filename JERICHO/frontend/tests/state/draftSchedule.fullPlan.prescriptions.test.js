import { describe, expect, it } from 'vitest';
import { computeDerivedState } from '../../src/state/identityCompute.js';

function buildState() {
  const cycleId = 'cycle-prescriptions';
  const startDay = '2026-01-01';
  const deadlineDay = '2026-01-07';
  const actions = Array.from({ length: 12 }).map((_, index) => ({
    id: `a-${index + 1}`,
    goalId: 'goal-1',
    title: `Action ${index + 1}`,
    brief: `Detail ${index + 1}`,
    detail: `Detail ${index + 1}`,
    category: index % 2 === 0 ? 'Focus' : 'Resources',
    deps: index > 0 ? [`a-${index}`] : [],
    status: 'todo',
    topoIndex: index,
    priority: index + 1,
    estimateMin: 90,
  }));

  return {
    vector: {},
    lenses: { aim: { description: '', horizon: '90d' }, pattern: { dailyTargets: [] }, flow: { streams: [] } },
    today: { date: startDay, blocks: [] },
    currentWeek: { weekStart: startDay, days: [] },
    meta: { version: '1.0.0', onboardingComplete: true },
    recurringPatterns: [],
    ledger: [],
    executionEvents: [],
    suggestionEvents: [],
    suggestedBlocks: [],
    deliverablesByCycleId: { [cycleId]: { cycleId, deliverables: [] } },
    actionsByCycleId: { [cycleId]: { cycleId, goalId: 'goal-1', actions } },
    draftScheduleItemsByCycleId: {},
    draftScheduleDiagnosticsByCycleId: {},
    appTime: { timeZone: 'UTC', activeDayKey: startDay, nowISO: `${startDay}T08:00:00.000Z`, isFollowingNow: true },
    activeCycleId: cycleId,
    constraints: {
      maxScheduledMinutesPerDay: 60,
      maxScheduledMinutesPerWeek: 180,
    },
    cyclesById: {
      [cycleId]: {
        id: cycleId,
        status: 'active',
        actions,
        goalContract: {
          goalId: 'goal-1',
          startDate: startDay,
          deadline: { dayKey: deadlineDay },
          temporalBinding: { daysPerWeek: 7, activationTime: '09:00', sessionDurationMinutes: 30 },
        },
        coldPlan: { forecastByDayKey: {}, dailyProjection: { forecastByDayKey: {} } },
      },
    },
  };
}

describe('FULL_PLAN prescriptions diagnostics', () => {
  it('includes prescriptions bundle with primaryConstraint and at least one code', () => {
    const rebuilt = computeDerivedState(buildState(), {
      type: 'REBUILD_SCHEDULE',
      payload: { cycleId: 'cycle-prescriptions' },
    });
    const diagnostics = rebuilt.draftScheduleDiagnosticsByCycleId?.['cycle-prescriptions'] || {};

    expect(diagnostics.prescriptions).toBeTruthy();
    expect(typeof diagnostics.prescriptions.primaryConstraint).toBe('string');
    expect(Array.isArray(diagnostics.prescriptions.mustIncludeCodes)).toBe(true);
    expect(diagnostics.prescriptions.mustIncludeCodes.length).toBeGreaterThan(0);
  });
});
