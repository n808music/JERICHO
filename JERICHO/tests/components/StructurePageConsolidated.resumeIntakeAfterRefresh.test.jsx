import React from 'react';
import '@testing-library/jest-dom';
import { render, screen, waitFor, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, afterEach } from 'vitest';
import { StructurePageConsolidated } from '../../src/components/zion/StructurePageConsolidated.jsx';
import { IdentityProvider, buildBlankIdentityState } from '../../src/state/identityStore.js';
import { ENTITY_SLOT_ID } from '../../src/domain/elicitation/elicitationEngine.js';

// Refresh-mid-intake defect (2026-07-10): with an admitted goal, a page reload
// dropped the operator onto MODULE 2 (plan view) with NO way back into the
// survey — even though the resumable session was saved in the store (and
// pushed to the server via Save Progress).
//
// The first fix auto-mounted MODULE 1 whenever a persisted session existed.
// SUPERSEDED 2026-08-26: that made a reload force the survey back on, which is
// the opposite complaint. The requirement was never "mount the survey" — it was
// "do not strand the answers". So the plan view renders, and the session is
// reachable through the Resume Survey button. Both halves are pinned below:
// reload does NOT mount the survey, and the button DOES bring it back at the
// saved slot.

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
  it('admitted goal + persisted session → plan view with the offer, NOT the survey', async () => {
    render(
      <IdentityProvider initialState={refreshedMidIntakeState()}>
        <StructurePageConsolidated />
      </IdentityProvider>
    );

    // The way back exists…
    await waitFor(() => expect(screen.getByTestId('resume-unfinished-intake')).toBeInTheDocument());
    // …and the survey did not claim the render on load.
    expect(screen.queryByTestId('intake-resume-banner')).not.toBeInTheDocument();
    expect(screen.queryByTestId('intake-question')).not.toBeInTheDocument();
  }, 30000);

  it('clicking Resume Survey rehydrates the session at the slot it stopped on', async () => {
    const user = userEvent.setup();
    render(
      <IdentityProvider initialState={refreshedMidIntakeState()}>
        <StructurePageConsolidated />
      </IdentityProvider>
    );

    await user.click(await screen.findByTestId('resume-unfinished-intake'));

    // The banner is MatrixIntake's own resume path reporting that it rehydrated
    // the stored snapshot rather than starting a fresh survey; the question is
    // the slot it stopped on (ENTITY_SLOT_ID, mid-fan-out on entity 1).
    await waitFor(() => expect(screen.getByTestId('intake-resume-banner')).toBeInTheDocument());
    expect(screen.getByTestId('intake-question')).toBeInTheDocument();
  }, 30000);

  it('admitted goal with NO persisted session → plan view, and no offer to resume', () => {
    const state = refreshedMidIntakeState();
    state.intakeSessionByCycleId = {};
    render(
      <IdentityProvider initialState={state}>
        <StructurePageConsolidated />
      </IdentityProvider>
    );
    expect(screen.queryByTestId('intake-resume-banner')).not.toBeInTheDocument();
    expect(screen.queryByTestId('resume-unfinished-intake')).not.toBeInTheDocument();
  }, 30000);
});
