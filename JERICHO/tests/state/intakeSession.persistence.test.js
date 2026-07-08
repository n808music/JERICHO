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

// Commit-boundary guard (primary defect, 2026-07-06 failure run): completing the
// intake must NOT silently delete an in-flight session that still holds
// uncommitted operator answers (captured fields beyond a bare name that never
// produced a DECLARE_*). Such a session is preserved (resumable) and flagged
// loudly; a clean/exhausted session is retired as before.
describe('matrix intake completion — commit boundary guard', () => {
  // A slot the operator answered follow-ups on but that never dispatched: its
  // captured bag carries fields beyond `name`. This is the data that was lost.
  const DIRTY_SESSION = {
    phase: 'engine',
    slotQueue: ['slot:initiative'],
    currentSlotId: 'slot:initiative',
    engineSnapshot: {
      goalType: 'generic',
      slotStack: [
        { slotId: 'slot:initiative', captured: { name: 'OFL Release Campaign', purpose: 'ship the release arc', classification: 'objective' } },
      ],
      completedSlotIds: [],
    },
    rosterNames: ['OFL Release Campaign'],
    rosterIndex: 0,
    rosterSlotId: 'slot:initiative',
    inputValue: '',
  };

  // A name-only / exhausted session carries no answered follow-ups — safe to retire.
  const CLEAN_SESSION = {
    phase: 'engine',
    slotQueue: ['slot:initiative'],
    currentSlotId: 'slot:initiative',
    engineSnapshot: {
      goalType: 'generic',
      slotStack: [{ slotId: 'slot:initiative', captured: { name: 'OFL Release Campaign' } }],
      completedSlotIds: [],
    },
    inputValue: '',
  };

  it('preserves a session with uncommitted answers and flags it (never silent-deletes)', () => {
    let next = computeDerivedState(stateWithActiveCycle(), {
      type: 'SET_INTAKE_SESSION',
      payload: { cycleId: CYCLE, session: DIRTY_SESSION },
    });
    next = computeDerivedState(next, {
      type: 'MARK_MATRIX_INTAKE_COMPLETE',
      payload: { cycleId: CYCLE },
    });
    expect(next.cyclesById[CYCLE].matrixIntakeComplete).toBe(true);
    // The uncommitted session survives — this is the guard against silent loss.
    expect(next.intakeSessionByCycleId[CYCLE]).toBeDefined();
    // And the failure is loud, not silent.
    expect(next.intakeCommitWarning).toBeTruthy();
    expect(next.intakeCommitWarning.cycleId).toBe(CYCLE);
  });

  it('retires a clean (name-only) session on completion', () => {
    let next = computeDerivedState(stateWithActiveCycle(), {
      type: 'SET_INTAKE_SESSION',
      payload: { cycleId: CYCLE, session: CLEAN_SESSION },
    });
    next = computeDerivedState(next, {
      type: 'MARK_MATRIX_INTAKE_COMPLETE',
      payload: { cycleId: CYCLE },
    });
    expect(next.cyclesById[CYCLE].matrixIntakeComplete).toBe(true);
    expect(next.intakeSessionByCycleId[CYCLE]).toBeUndefined();
    expect(next.intakeCommitWarning).toBeFalsy();
  });
});
