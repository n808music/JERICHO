import { describe, it, expect } from 'vitest';
import {
  buildBlankIdentityState,
  buildPersistableIdentityState,
  identityReducer,
} from '../../src/state/identityStore.js';
import { computeDerivedState } from '../../src/state/identityCompute.js';

// Defect B store contract: an in-flight matrix-intake session is persisted per
// cycle, retired on completion/clear, and — the Gap 4 amendment — never survives
// a goal clear or the persistence boundary for a dropped cycle.

const CYCLE = 'cycle-b-1';

function stateWithActiveCycle() {
  const base = buildBlankIdentityState();
  return computeDerivedState(
    {
      ...base,
      activeCycleId: CYCLE,
      cyclesById: {
        ...(base.cyclesById || {}),
        [CYCLE]: { id: CYCLE, status: 'active', goalContract: { goalId: 'g-b-1', goalText: 'x' } },
      },
    },
    { type: 'NO_OP' }
  );
}

const SESSION = { phase: 'engine', slotQueue: ['slot:entity'], currentSlotId: 'slot:entity', engineSnapshot: { goalType: 'generic', slotStack: [{ slotId: 'slot:entity', captured: { name: 'Acme' } }], completedSlotIds: [] }, inputValue: '' };

describe('intake session persistence (Defect B)', () => {
  it('SET_INTAKE_SESSION stores the session under the cycle', () => {
    const next = computeDerivedState(stateWithActiveCycle(), {
      type: 'SET_INTAKE_SESSION',
      payload: { cycleId: CYCLE, session: SESSION },
    });
    expect(next.intakeSessionByCycleId[CYCLE]).toEqual(SESSION);
  });

  it('CLEAR_INTAKE_SESSION removes it', () => {
    let next = computeDerivedState(stateWithActiveCycle(), {
      type: 'SET_INTAKE_SESSION',
      payload: { cycleId: CYCLE, session: SESSION },
    });
    next = computeDerivedState(next, { type: 'CLEAR_INTAKE_SESSION', payload: { cycleId: CYCLE } });
    expect(next.intakeSessionByCycleId[CYCLE]).toBeUndefined();
  });

  it('RESET_IDENTITY (goal clear) wipes any in-flight session — Gap 4 class', () => {
    const withSession = computeDerivedState(stateWithActiveCycle(), {
      type: 'SET_INTAKE_SESSION',
      payload: { cycleId: CYCLE, session: SESSION },
    });
    expect(withSession.intakeSessionByCycleId[CYCLE]).toBeDefined();
    const afterClear = identityReducer(withSession, { type: 'RESET_IDENTITY' });
    expect(afterClear.intakeSessionByCycleId).toEqual({});
  });

  it('buildPersistableIdentityState drops sessions for cycles that are not retained', () => {
    const withSession = computeDerivedState(stateWithActiveCycle(), {
      type: 'SET_INTAKE_SESSION',
      payload: { cycleId: CYCLE, session: SESSION },
    });
    // Add a session for a cycle that has no live record — must not persist.
    withSession.intakeSessionByCycleId['cycle-dead'] = { ...SESSION };
    const persist = buildPersistableIdentityState(withSession);
    expect(persist.intakeSessionByCycleId[CYCLE]).toBeDefined();
    expect(persist.intakeSessionByCycleId['cycle-dead']).toBeUndefined();
  });
});
