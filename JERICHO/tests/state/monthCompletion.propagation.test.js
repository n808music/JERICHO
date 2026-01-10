import { describe, it, expect } from 'vitest';
import { getAllBlocks, projectMonthDays } from '../../src/state/identityCompute.js';
import { identityReducer } from '../../src/state/identityStore.js';

function iso(dateStr, timeStr) {
  return `${dateStr}T${timeStr}:00.000Z`;
}

function makeBlock({ id, status = 'planned' }) {
  return {
    id,
    practice: 'Focus',
    label: 'Outreach',
    start: iso('2025-12-03', '14:00'),
    end: iso('2025-12-03', '15:00'),
    status
  };
}

function clone(b) { return JSON.parse(JSON.stringify(b)); }
function makeStateWithBlockEverywhere(block) {
  return {
    ledger: [],
    today: { date: '2025-12-03', blocks: [clone(block)] },
    currentWeek: { days: [{ date: '2025-12-03', blocks: [clone(block)] }], metrics: {} },
    cycle: [{ date: '2025-12-03', blocks: [clone(block)] }],
    vector: { day: 1, direction: '', stability: 'steady', drift: 'contained', momentum: 'active' },
    lenses: { pattern: { dailyTargets: [], routines: {}, defaultMinutes: 30 }, aim: { description: '', horizon: '90d' }, flow: { streams: [] }, practice: { defaults: {} } },
    viewDate: '2025-12-03',
    templates: { objectives: {} },
    meta: { version: '1.0.0', onboardingComplete: true, lastActiveDate: '2025-12-03', scenarioLabel: '', demoScenarioEnabled: false, showHints: false },
    stability: { headline: '', actionLine: '' },
    recurringPatterns: [],
    lastSessionChange: null,
    nextSuggestion: null
  };
}

describe('Month projection responds to COMPLETE_BLOCK (propagation)', () => {
  it('after COMPLETE_BLOCK, month day reflects completed status and CR updates; ledger increments once', () => {
    const state0 = makeStateWithBlockEverywhere(makeBlock({ id: 'b1', status: 'planned' }));
    const state1 = identityReducer(state0, { type: 'COMPLETE_BLOCK', id: 'b1' });

    expect(state1.ledger.length).toBe(1);
    expect(state1.ledger[0].blockId).toBe('b1');

    const blocks = getAllBlocks(state1);
    const monthDays = projectMonthDays({ monthKey: '2025-12-15', blocks, includePadding: true });
    const day = monthDays.find((d) => d.date === '2025-12-03');
    expect(day).toBeTruthy();

    const b = day.blocks.find((x) => x.id === 'b1');
    expect(b).toBeTruthy();
    expect(b.status).toBe('completed');

    expect(Math.round(day.plannedMinutes)).toBe(60);
    expect(Math.round(day.completedMinutes)).toBe(60);
    expect(Number.isFinite(day.completionRate)).toBe(true);
    expect(day.completionRate).toBeGreaterThanOrEqual(0);
    expect(day.completionRate).toBeLessThanOrEqual(1);
    expect(day.completionRate).toBe(1);

    const state2 = identityReducer(state1, { type: 'COMPLETE_BLOCK', id: 'b1' });
    expect(state2.ledger.length).toBe(1);
  });
});
