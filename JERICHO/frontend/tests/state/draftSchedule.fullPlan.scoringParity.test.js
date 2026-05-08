import { describe, expect, it } from 'vitest';
import { computeDerivedState } from '../../src/state/identityCompute.js';

function buildState() {
  const cycleId = 'cycle-score-parity';
  const actions = [
    {
      id: 'a-1',
      goalId: 'goal-1',
      title: 'Action 1',
      detail: 'Detail',
      category: 'Focus',
      deps: [],
      status: 'todo',
      topoIndex: 0,
      priority: 1,
      estimateMin: 30,
    },
    {
      id: 'a-2',
      goalId: 'goal-1',
      title: 'Action 2',
      detail: 'Detail',
      category: 'Creation',
      deps: ['a-1'],
      status: 'todo',
      topoIndex: 1,
      priority: 2,
      estimateMin: 30,
    },
  ];

  return {
    vector: {},
    lenses: { aim: { description: '', horizon: '90d' }, pattern: { dailyTargets: [] }, flow: { streams: [] } },
    today: { date: '2026-02-01', blocks: [] },
    currentWeek: { weekStart: '2026-02-01', days: [] },
    meta: { version: '1.0.0', onboardingComplete: true },
    recurringPatterns: [],
    ledger: [],
    executionEvents: [],
    suggestionEvents: [],
    suggestedBlocks: [],
    deliverablesByCycleId: { [cycleId]: { cycleId, deliverables: [] } },
    goalAdmissionByGoal: {},
    constraints: { maxScheduledMinutesPerDay: 240 },
    dependencies: { defaultBufferMinutes: 0 },
    probabilityByGoal: {},
    feasibilityByGoal: {},
    goalWorkById: {},
    appTime: { timeZone: 'UTC', activeDayKey: '2026-02-01', nowISO: '2026-02-01T08:00:00.000Z', isFollowingNow: true },
    profileLearning: {},
    activeCycleId: cycleId,
    planDraft: { routeMinutes: 30, executionHorizonDays: 90 },
    actionsByCycleId: { [cycleId]: { cycleId, goalId: 'goal-1', actions } },
    cyclesById: {
      [cycleId]: {
        id: cycleId,
        status: 'active',
        actions,
        goalContract: {
          goalId: 'goal-1',
          startDate: '2026-02-01',
          deadline: { dayKey: '2026-03-31' },
          temporalBinding: {
            daysPerWeek: 7,
            specificDays: 'mon,tue,wed,thu,fri,sat,sun',
            sessionDurationMinutes: 30,
          },
        },
        coldPlan: { forecastByDayKey: {}, dailyProjection: { forecastByDayKey: {} } },
      },
    },
  };
}

describe('draftSchedule full plan scoring parity', () => {
  it('keeps quality score parity across preview and apply', () => {
    const cycleId = 'cycle-score-parity';
    const seeded = buildState();

    const rebuilt = computeDerivedState(seeded, { type: 'REBUILD_SCHEDULE', payload: { cycleId } });
    const previewDiagnostics = rebuilt.draftScheduleDiagnosticsByCycleId?.[cycleId] || {};
    const previewTotal = Number(
      previewDiagnostics?.qualityScoreOptimized?.total || previewDiagnostics?.qualityScoreBaseline?.total || 0
    );

    const applied = computeDerivedState(rebuilt, { type: 'APPLY_DRAFT_SCHEDULE_FULL', payload: { cycleId } });
    const rebuiltAfterApply = computeDerivedState(applied, { type: 'REBUILD_SCHEDULE', payload: { cycleId } });
    const applyDiagnostics = rebuiltAfterApply.draftScheduleDiagnosticsByCycleId?.[cycleId] || {};
    const appliedTotal = Number(
      applyDiagnostics?.qualityScoreOptimized?.total || applyDiagnostics?.qualityScoreBaseline?.total || 0
    );

    expect(previewTotal).toBe(appliedTotal);
  });
});
