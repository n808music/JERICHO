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
          temporalBinding: {
            specificDays: 'Mon, Wed, Fri',
            activationTime: '06:00',
            sessionDurationMinutes: 120,
          },
        },
      },
    },
    activeCycleId: 'cycle-1',
    goalExecutionContract: {
      goalId: 'goal-root',
      temporalBinding: {
        specificDays: 'Tue, Thu',
        activationTime: '09:00',
        sessionDurationMinutes: 60,
      },
    },
  };
}

describe('hydration temporalBinding migration', () => {
  it('migrates cycle and root contract temporalBinding to workWindows', () => {
    const hydrated = ensureTemplates(buildState());
    const windows = hydrated.cyclesById['cycle-1'].goalContract.workWindows;

    expect(windows.mon).toEqual([{ start: '06:00', end: '08:00' }]);
    expect(windows.wed).toEqual([{ start: '06:00', end: '08:00' }]);
    expect(windows.fri).toEqual([{ start: '06:00', end: '08:00' }]);
    expect(windows.tue).toEqual([]);

    expect(hydrated.goalExecutionContract.workWindows.tue).toEqual([{ start: '09:00', end: '10:00' }]);
    expect(hydrated.goalExecutionContract.workWindows.thu).toEqual([{ start: '09:00', end: '10:00' }]);
  });
});
