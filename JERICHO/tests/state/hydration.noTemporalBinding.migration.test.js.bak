import { describe, expect, it } from 'vitest';
import { ensureTemplates } from '../../src/state/identityStore.js';

function buildState() {
  return {
    meta: { version: '1.0.0' },
    templates: { objectives: {} },
    today: { date: '2026-01-10', blocks: [] },
    currentWeek: { days: [], metrics: {} },
    cycle: [],
    ledger: [],
    executionEvents: [],
    suggestionEvents: [],
    suggestedBlocks: [],
    proposedBlocks: [],
    proposedBlocksByCycleId: {},
    cyclesById: {
      'cycle-1': {
        id: 'cycle-1',
        status: 'Active',
        goalContract: {
          goalId: 'goal-1',
        },
      },
    },
    activeCycleId: 'cycle-1',
  };
}

describe('hydration no temporalBinding migration', () => {
  it('hydrates empty workWindows map when neither temporalBinding nor workWindows exists', () => {
    const hydrated = ensureTemplates(buildState());
    const windows = hydrated.cyclesById['cycle-1'].goalContract.workWindows;

    expect(windows).toEqual({
      mon: [],
      tue: [],
      wed: [],
      thu: [],
      fri: [],
      sat: [],
      sun: [],
    });
  });
});
