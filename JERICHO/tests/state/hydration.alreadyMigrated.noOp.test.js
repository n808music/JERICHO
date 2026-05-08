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
          workWindows: {
            mon: [{ start: '07:00', end: '08:00' }],
            tue: [],
            wed: [],
            thu: [],
            fri: [],
            sat: [],
            sun: [],
          },
          temporalBinding: {
            specificDays: 'Mon, Tue, Wed',
            activationTime: '09:00',
            sessionDurationMinutes: 90,
          },
        },
      },
    },
    activeCycleId: 'cycle-1',
  };
}

describe('hydration already migrated no-op', () => {
  it('does not override existing workWindows', () => {
    const state = buildState();
    const original = JSON.parse(JSON.stringify(state.cyclesById['cycle-1'].goalContract.workWindows));

    const hydrated = ensureTemplates(state);
    expect(hydrated.cyclesById['cycle-1'].goalContract.workWindows).toEqual(original);
  });
});
