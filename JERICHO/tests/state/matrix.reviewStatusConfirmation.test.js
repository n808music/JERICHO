import { describe, it, expect } from 'vitest';
import { buildBlankIdentityState } from '../../src/state/identityStore.js';
import { computeDerivedState } from '../../src/state/identityCompute.js';
import { selectMasterGridRows } from '../../src/domain/masterGrid/masterGridSelectors.js';

// The §8 readback confirmation (MARK_MATRIX_INTAKE_COMPLETE, dispatched only when
// the operator confirms the system's recited copy against paper) is the producer
// of CONFIRMED. Without it, V8 (completion gate requires CONFIRMED) is unsatisfiable.
const CYCLE = 'cycle-rs-1';

function seededState() {
  const base = buildBlankIdentityState();
  let state = computeDerivedState(
    {
      ...base,
      appTime: { ...(base.appTime || {}), nowISO: '2026-07-09T00:00:00.000Z' },
      activeCycleId: CYCLE,
      cyclesById: {
        ...(base.cyclesById || {}),
        [CYCLE]: { id: CYCLE, status: 'active', goalContract: { goalId: 'g-rs-1', goalText: 'x' } },
      },
    },
    { type: 'NO_OP' },
  );
  state = computeDerivedState(state, {
    type: 'DECLARE_ENTITY',
    payload: { id: 'e1', name: 'Global State Corporation', roleTags: ['corp'], purpose: 'p', formationState: 'formed', statusEvidence: 'ev' },
  });
  state = computeDerivedState(state, {
    type: 'DECLARE_INITIATIVE',
    payload: { id: 'i1', name: 'Romance Riot', purpose: 'x', classification: 'objective', doneWhen: 'y' },
  });
  // An operator-flagged node — must NOT be auto-confirmed by the readback.
  state = computeDerivedState(state, {
    type: 'DECLARE_INITIATIVE',
    payload: { id: 'i2', name: 'Flagged One', purpose: 'x', classification: 'objective', doneWhen: 'y', reviewStatus: 'NEEDS_REVIEW' },
  });
  return state;
}

const cycleIdOf = () => CYCLE;

describe('reviewStatus readback confirmation (V8 producer)', () => {
  it('nodes default DRAFT and stay DRAFT with no completion (unconfirmed readback)', () => {
    const state = seededState();
    expect(state.matrix.entitiesById.e1.reviewStatus).toBe('DRAFT');
    expect(state.matrix.initiativesById.i1.reviewStatus).toBe('DRAFT');
    // Ready must be NO while unconfirmed.
    const row = selectMasterGridRows(state.matrix).find((r) => r.id === 'e1');
    expect(row.readyForIntake).toBe(false);
  });

  it('a confirmed readback (MARK_MATRIX_INTAKE_COMPLETE) advances DRAFT -> CONFIRMED and flips Ready', () => {
    let state = seededState();
    state = computeDerivedState(state, { type: 'MARK_MATRIX_INTAKE_COMPLETE', payload: { cycleId: cycleIdOf(state) } });
    expect(state.matrix.entitiesById.e1.reviewStatus).toBe('CONFIRMED');
    expect(state.matrix.initiativesById.i1.reviewStatus).toBe('CONFIRMED');
    const row = selectMasterGridRows(state.matrix).find((r) => r.id === 'e1');
    expect(row.readyForIntake).toBe(true);
  });

  it('NEEDS_REVIEW stays operator-set (readback does not auto-confirm it)', () => {
    let state = seededState();
    state = computeDerivedState(state, { type: 'MARK_MATRIX_INTAKE_COMPLETE', payload: { cycleId: cycleIdOf(state) } });
    expect(state.matrix.initiativesById.i2.reviewStatus).toBe('NEEDS_REVIEW');
  });
});
