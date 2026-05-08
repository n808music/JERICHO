import { describe, expect, it } from 'vitest';
import { computeDerivedState } from '../../src/state/identityCompute.js';

function buildState() {
  const cycleId = 'cycle-sticky-commit';
  const actions = Array.from({ length: 16 }).map((_, i) => ({
    id: `a-${i + 1}`,
    goalId: 'goal-1',
    title: `Action ${i + 1}`,
    detail: `Detail ${i + 1}`,
    category: 'Focus',
    deps: i > 0 ? [`a-${i}`] : [],
    status: 'todo',
    topoIndex: i,
    priority: i + 1,
    estimateMin: 30,
  }));

  return {
    vector: {},
    lenses: { aim: { description: '', horizon: '90d' }, pattern: { dailyTargets: [] }, flow: { streams: [] } },
    today: { date: '2026-01-01', blocks: [] },
    currentWeek: { weekStart: '2026-01-01', days: [] },
    meta: { version: '1.0.0', onboardingComplete: true },
    recurringPatterns: [],
    ledger: [],
    executionEvents: [],
    suggestionEvents: [],
    suggestedBlocks: [],
    deliverablesByCycleId: { [cycleId]: { cycleId, deliverables: [] } },
    goalAdmissionByGoal: {},
    constraints: {},
    dependencies: { defaultBufferMinutes: 0 },
    probabilityByGoal: {},
    feasibilityByGoal: {},
    goalWorkById: {},
    appTime: { timeZone: 'UTC', activeDayKey: '2026-01-01', nowISO: '2026-01-01T08:00:00.000Z', isFollowingNow: true },
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
          startDate: '2026-01-01',
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

describe('apply draft schedule full commit sticky', () => {
  it('keeps parity and zero churn on unchanged rebuild/apply flow', () => {
    const cycleId = 'cycle-sticky-commit';
    const seeded = buildState();

    const rebuilt = computeDerivedState(seeded, { type: 'REBUILD_SCHEDULE', payload: { cycleId } });
    const firstPreview = rebuilt.draftScheduleItemsByCycleId?.[cycleId] || [];
    const firstDiagnostics = rebuilt.draftScheduleDiagnosticsByCycleId?.[cycleId] || {};

    const applied = computeDerivedState(rebuilt, { type: 'APPLY_DRAFT_SCHEDULE_FULL', payload: { cycleId } });
    const firstCreates = (applied.executionEvents || []).filter(
      (event) => event?.kind === 'create' && event?.cycleId === cycleId
    );

    const rebuiltAgain = computeDerivedState(applied, { type: 'REBUILD_SCHEDULE', payload: { cycleId } });
    const secondPreview = rebuiltAgain.draftScheduleItemsByCycleId?.[cycleId] || [];
    const secondDiagnostics = rebuiltAgain.draftScheduleDiagnosticsByCycleId?.[cycleId] || {};

    const appliedAgain = computeDerivedState(rebuiltAgain, { type: 'APPLY_DRAFT_SCHEDULE_FULL', payload: { cycleId } });
    const secondCreates = (appliedAgain.executionEvents || []).filter(
      (event) => event?.kind === 'create' && event?.cycleId === cycleId
    );

    expect(secondPreview).toEqual(firstPreview);
    expect(secondCreates).toEqual(firstCreates);
    expect(firstDiagnostics.movedChunkCount || 0).toBe(0);
    expect(firstDiagnostics.droppedChunkCount || 0).toBe(0);
    expect(secondDiagnostics.movedChunkCount || 0).toBe(0);
    expect(secondDiagnostics.droppedChunkCount || 0).toBe(0);
    expect(secondDiagnostics.reservationInputCount || 0).toBeGreaterThan(0);
  });
});
