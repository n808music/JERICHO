import React from 'react';
import '@testing-library/jest-dom';
import { render, screen, waitFor, cleanup } from '@testing-library/react';
import { describe, it, expect, afterEach } from 'vitest';
import { StructurePageConsolidated } from '../../src/components/zion/StructurePageConsolidated.jsx';
import { IdentityProvider, buildBlankIdentityState } from '../../src/state/identityStore.js';
import { ENTITY_SLOT_ID } from '../../src/domain/elicitation/elicitationEngine.js';

// Refresh-mid-intake defect (2026-07-10): with an admitted goal, a page reload
// dropped the operator onto MODULE 2 (plan view) with NO way back into the
// survey — even though the resumable session was saved in the store (and
// pushed to the server via Save Progress). The Structure gate must treat a
// persisted intake session as "survey in flight" and mount MODULE 1 so
// MatrixIntake's resume path rehydrates it.

const CYCLE_ID = 'cycle-refresh-1';

function refreshedMidIntakeState() {
  const base = buildBlankIdentityState();
  return {
    ...base,
    activeCycleId: CYCLE_ID,
    cyclesById: {
      ...(base.cyclesById || {}),
      [CYCLE_ID]: {
        id: CYCLE_ID,
        status: 'active',
        matrixIntakeComplete: false,
        goalDraftV2: { goalText: 'Scale the ecosystem', goalLabel: 'Scale the ecosystem' },
        goalContract: {
          goalId: 'goal-refresh-1',
          goalText: 'Scale the ecosystem to 3.5B',
          startDayKey: '2026-07-10',
          deadline: { dayKey: '2031-07-10' },
        },
      },
    },
    // What persistSession wrote before the refresh: mid-fan-out on entity 1.
    intakeSessionByCycleId: {
      [CYCLE_ID]: {
        phase: 'engine',
        slotQueue: [ENTITY_SLOT_ID],
        currentSlotId: ENTITY_SLOT_ID,
        engineSnapshot: {
          goalType: 'generic',
          slotStack: [
            { slotId: ENTITY_SLOT_ID, captured: { name: 'Global State Solutions' }, completed: false, lastFailureCode: null },
          ],
          completedSlotIds: [],
        },
        inputValue: '',
        rosterNames: ['Global State Solutions'],
        rosterIndex: 0,
        rosterSlotId: ENTITY_SLOT_ID,
      },
    },
  };
}

afterEach(cleanup);

describe('StructurePageConsolidated — resume intake after refresh', () => {
  it('admitted goal + persisted session → intake resumes instead of plan view', async () => {
    render(
      <IdentityProvider initialState={refreshedMidIntakeState()}>
        <StructurePageConsolidated />
      </IdentityProvider>
    );

    // MODULE 1 with the rehydrated survey: resume banner + the in-flight question.
    await waitFor(() => expect(screen.getByTestId('intake-resume-banner')).toBeInTheDocument());
    expect(screen.getByTestId('intake-question')).toBeInTheDocument();
    // And NOT the read-only post-admission plan view.
    expect(screen.queryByText(/Definite Goal/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /clear goal/i })).not.toBeInTheDocument();
  }, 30000);

  it('admitted goal with NO persisted session → plan view as before (external admission stays test-safe)', () => {
    const state = refreshedMidIntakeState();
    state.intakeSessionByCycleId = {};
    render(
      <IdentityProvider initialState={state}>
        <StructurePageConsolidated />
      </IdentityProvider>
    );
    expect(screen.queryByTestId('intake-resume-banner')).not.toBeInTheDocument();
  }, 30000);
});
