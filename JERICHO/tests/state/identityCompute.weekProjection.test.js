import { describe, it, expect } from 'vitest';
import { computeDerivedState, projectWeekDays } from '../../src/state/identityCompute.js';

function iso(dateStr, timeStr) {
  return `${dateStr}T${timeStr}:00.000Z`;
}

function makeBlock({ id, start, end, practice = 'Focus', label = 'Outreach', status = 'planned' } = {}) {
  return { id, practice, label, start, end, status };
}

function makeState(overrides = {}) {
  return {
    vector: { day: 1, direction: 'Test', stability: 'steady', drift: 'contained', momentum: 'active' },
    lenses: {
      aim: { description: 'Test', horizon: '90d' },
      pattern: { routines: { Body: [], Resources: [], Creation: [], Focus: [] }, dailyTargets: [], defaultMinutes: 30 },
      flow: { streams: [] }
    },
    activeCycleId: 'cycle-1',
    cyclesById: {
      'cycle-1': {
        id: 'cycle-1',
        status: 'active',
        startedAtDayKey: '2026-02-01',
        definiteGoal: { outcome: 'Test', deadlineDayKey: '2026-12-31' },
        pattern: { dailyTargets: [] },
        goalGovernanceContract: {
          contractId: 'gov-1',
          version: 1,
          goalId: 'goal-1',
          activeFromISO: '2026-01-01',
          activeUntilISO: '2026-12-31',
          scope: {
            domainsAllowed: ['Body', 'Focus', 'Creation', 'Resources'],
            timeHorizon: 'week',
            timezone: 'America/Chicago'
          },
          governance: {
            suggestionsEnabled: true,
            probabilityEnabled: true,
            minEvidenceEvents: 1
          }
        }
      }
    },
    history: { cycles: [] },
    today: { date: '2026-02-01', blocks: [], completionRate: 0, driftSignal: 'contained', loadByPractice: {}, practices: [] },
    currentWeek: { weekStart: '2026-02-01', days: [] },
    cycle: [],
    templates: { objectives: {} },
    meta: { version: '1.0.0', onboardingComplete: false },
    recurringPatterns: [],
    ledger: [],
    executionEvents: [{ id: 'e1', dateISO: '2026-02-01', completed: true }],
    ...overrides
  };
}

describe('identityCompute.projectWeekDays (Week projection)', () => {
  it('places block on correct UTC day and computes finite CR', () => {
    const block = makeBlock({
      id: 'b1',
      start: iso('2025-12-03', '14:00'),
      end: iso('2025-12-03', '15:00'),
      status: 'planned'
    });

    const days = projectWeekDays({ anchorDate: '2025-12-03', blocks: [block] });
    expect(days).toHaveLength(7);
    const day = days.find((d) => d.date === '2025-12-03');
    expect(day).toBeTruthy();
    expect(day.blocks).toHaveLength(1);
    expect(day.blocks[0].id).toBe('b1');
    expect(Math.round(day.plannedMinutes)).toBe(60);
    expect(Math.round(day.completedMinutes || 0)).toBe(0);
    expect(Number.isFinite(day.completionRate)).toBe(true);
    expect(day.completionRate).toBeGreaterThanOrEqual(0);
    expect(day.completionRate).toBeLessThanOrEqual(1);
  });

  it('planned=0 yields CR=0 (finite)', () => {
    const block = makeBlock({
      id: 'b0',
      start: iso('2025-12-03', '14:00'),
      end: iso('2025-12-03', '14:00'),
      status: 'planned'
    });
    const day = projectWeekDays({ anchorDate: '2025-12-03', blocks: [block] }).find((d) => d.date === '2025-12-03');
    expect(day).toBeTruthy();
    expect(Math.round(day.plannedMinutes)).toBe(0);
    expect(Math.round(day.completedMinutes || 0)).toBe(0);
    expect(Number.isFinite(day.completionRate)).toBe(true);
    expect(day.completionRate).toBe(0);
  });

  it('cross-midnight duration computes 60m (23:30→00:30)', () => {
    const block = makeBlock({
      id: 'x',
      start: iso('2025-12-03', '23:30'),
      end: iso('2025-12-04', '00:30'),
      status: 'planned'
    });
    const day = projectWeekDays({ anchorDate: '2025-12-03', blocks: [block] }).find((d) => d.date === '2025-12-03');
    expect(day).toBeTruthy();
    expect(day.blocks.some((b) => b.id === 'x')).toBe(true);
    expect(Math.round(day.plannedMinutes)).toBe(60);
    expect(Number.isFinite(day.plannedMinutes)).toBe(true);
  });

  it('completed block counts toward completedMinutes and CR', () => {
    const block = makeBlock({
      id: 'c1',
      start: iso('2025-12-03', '14:00'),
      end: iso('2025-12-03', '15:00'),
      status: 'completed'
    });
    const day = projectWeekDays({ anchorDate: '2025-12-03', blocks: [block] }).find((d) => d.date === '2025-12-03');
    expect(day).toBeTruthy();
    expect(Math.round(day.plannedMinutes)).toBe(60);
    expect(Math.round(day.completedMinutes)).toBe(60);
    expect(day.completionRate).toBe(1);
  });
});

describe('probabilityStatusByGoal plumbing', () => {
  it('populates status per goal when contract active', () => {
    const state = makeState({
      cyclesById: {
        'cycle-1': {
          ...makeState().cyclesById['cycle-1'],
          goalGovernanceContract: {
            ...makeState().cyclesById['cycle-1'].goalGovernanceContract,
            governance: { suggestionsEnabled: true, probabilityEnabled: true, minEvidenceEvents: 2 }
          }
        }
      }
    });
    const next = computeDerivedState(state, { type: 'NO_OP' });
    const status = next.probabilityStatusByGoal?.['goal-1'];
    expect(status).toBeTruthy();
    expect(['computed', 'insufficient_evidence'].includes(status.status)).toBe(true);
    expect(Number.isFinite(status.evidenceSummary.totalEvents)).toBe(true);
    expect(status.evidenceSummary.totalEvents).toBeGreaterThanOrEqual(0);
    expect(status.evidenceSummary.completedCount).toBeLessThanOrEqual(status.evidenceSummary.totalEvents);
    expect(status.evidenceSummary.daysCovered).toBeGreaterThanOrEqual(0);
  });

  it('disables when contract inactive', () => {
    const state = makeState({
      cyclesById: {
        'cycle-1': {
          ...makeState().cyclesById['cycle-1'],
          goalGovernanceContract: {
            ...makeState().cyclesById['cycle-1'].goalGovernanceContract,
            activeUntilISO: '2000-01-01'
          }
        }
      }
    });
    const next = computeDerivedState(state, { type: 'NO_OP' });
    const status = next.probabilityStatusByGoal?.['goal-1'];
    expect(status).toBeTruthy();
    expect(status.status).toBe('disabled');
    expect(status.reasons.length).toBeGreaterThan(0);
  });

  it('is deterministic across identical inputs', () => {
    const state = makeState();
    const first = computeDerivedState(state, { type: 'NO_OP' });
    const second = computeDerivedState(state, { type: 'NO_OP' });
    expect(first.probabilityStatusByGoal).toEqual(second.probabilityStatusByGoal);
  });
});
