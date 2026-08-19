import { describe, expect, it } from 'vitest';
import { attemptGoalAdmissionPure } from '../../src/state/identityStore.js';
import { buildValidGoalContract } from '../../src/domain/goal/testHelpers.ts';

function buildState() {
  return {
    appTime: { nowISO: '2026-01-10T12:00:00.000Z', timeZone: 'UTC', activeDayKey: '2026-01-10' },
    cyclesById: {},
    activeCycleId: null,
    cycleOrder: [],
    aspirations: [],
    aspirationsByCycleId: {},
  };
}

describe('weekly capacity derivation from workWindows', () => {
  it('stores weeklyCapacityMinutes using goalContract.workWindows', () => {
    const contract = buildValidGoalContract({
      workWindows: {
        mon: [{ start: '06:00', end: '09:00' }],
        tue: [{ start: '09:00', end: '12:00' }],
        wed: [],
        thu: [{ start: '16:00', end: '18:00' }],
        fri: [],
        sat: [],
        sun: [],
      },
    });

    const { nextState, result } = attemptGoalAdmissionPure(buildState(), {
      contract,
      goalDraftV2: { executionType: 'VentureLaunch', goalText: contract.terminalOutcome.text },
    });

    expect(result.status).toBe('ADMITTED');
    const cycle = nextState.cyclesById[result.cycleId];
    expect(cycle).toBeTruthy();
    expect(cycle.strategy?.constraints?.weeklyCapacityMinutes).toBe(480);
    expect(cycle.strategy?.constraints?.maxBlocksPerWeek).toBe(4);
  });
});
