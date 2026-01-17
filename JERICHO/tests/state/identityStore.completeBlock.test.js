import { describe, it, expect } from 'vitest';
import { identityReducer } from '../../src/state/identityStore.js';

function iso(dateStr, timeStr) {
  return `${dateStr}T${timeStr}:00.000Z`;
}
function makeBlock({ id, status = 'planned' }) {
  return { id, practice: 'Focus', label: 'Outreach', start: iso('2025-12-03', '14:00'), end: iso('2025-12-03', '15:00'), status };
}
function clone(b) { return JSON.parse(JSON.stringify(b)); }
function makeStateWithBlockInAllProjections(block) {
  return {
    ledger: [],
    today: { blocks: [clone(block)], date: '2025-12-03' },
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

describe('identityStore COMPLETE_BLOCK', () => {
  it('marks status completed across projections and appends ledger once (finite, clamped minutes)', () => {
    const state1 = identityReducer(makeStateWithBlockInAllProjections(makeBlock({ id: 'b1' })), { type: 'COMPLETE_BLOCK', id: 'b1' });
    expect(state1.today?.blocks?.[0]?.status).toBe('completed');
    const weekBlock = state1.currentWeek?.days?.[0]?.blocks?.[0];
    if (weekBlock) expect(weekBlock.status).toBe('completed');
    const cycleBlock = (state1.cycle || []).flatMap((d) => d.blocks || []).find((b) => b.id === 'b1');
    if (cycleBlock) expect(cycleBlock.status).toBe('completed');
    expect(state1.ledger.length).toBe(1);
    expect(state1.ledger[0].blockId).toBe('b1');
    expect(Number.isFinite(state1.ledger[0].plannedMinutes)).toBe(true);
    expect(state1.ledger[0].plannedMinutes).toBeLessThanOrEqual(1440);
    expect(state1.ledger[0].plannedMinutes).toBeGreaterThanOrEqual(0);
  });

  it('is idempotent: completing twice does not append ledger twice', () => {
    const state1 = identityReducer(makeStateWithBlockInAllProjections(makeBlock({ id: 'b1' })), { type: 'COMPLETE_BLOCK', id: 'b1' });
    const state2 = identityReducer(state1, { type: 'COMPLETE_BLOCK', id: 'b1' });
    expect(state1.ledger.length).toBe(1);
    expect(state2.ledger.length).toBe(1);
    expect(state2.today.blocks[0].status).toBe('completed');
  });

  it('handles invalid start/end by writing plannedMinutes=0 (finite) and still appending', () => {
    const bad = { id: 'bad', practice: 'Focus', label: 'Bad', start: 'not-a-date', end: 'also-not-a-date', status: 'planned' };
    const state1 = identityReducer(makeStateWithBlockInAllProjections(bad), { type: 'COMPLETE_BLOCK', id: 'bad' });
    expect(state1.ledger.length).toBe(1);
    expect(state1.ledger[0].blockId).toBe('bad');
    expect(Number.isFinite(state1.ledger[0].plannedMinutes)).toBe(true);
    expect(state1.ledger[0].plannedMinutes).toBe(0);
  });
});
