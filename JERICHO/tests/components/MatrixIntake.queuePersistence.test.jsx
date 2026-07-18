import React from 'react';
import '@testing-library/jest-dom';
import { render, screen, waitFor, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, afterEach } from 'vitest';
import MatrixIntake from '../../src/ui/masterPlan/MatrixIntake.jsx';
import { IdentityProvider, buildBlankIdentityState, useIdentityStore } from '../../src/state/identityStore.js';

// Queued roster items must survive a remount/reload (2026-07-10 live loss:
// a split queued at the readback vanished because only question transitions
// persisted the session). The persist effect now fires on rosterNames change;
// this locks the full loop: queue -> unmount -> remount -> still queued.

const CYCLE_ID = 'cycle-queue-persist-1';
function admittedGoalState() {
  const base = buildBlankIdentityState();
  return {
    ...base,
    activeCycleId: CYCLE_ID,
    cyclesById: {
      ...(base.cyclesById || {}),
      [CYCLE_ID]: {
        id: CYCLE_ID,
        status: 'active',
        goalDraftV2: { goalText: 'raise 25k', goalLabel: 'raise 25k' },
        goalContract: { goalId: 'goal-qp-1', goalText: 'Secure $25k', startDayKey: '2026-03-12', deadline: { dayKey: '2026-06-30' } },
      },
    },
  };
}

let store = null;
function StoreProbe() { store = useIdentityStore(); return null; }

afterEach(() => { cleanup(); store = null; });

describe('MatrixIntake — queued items survive remount', () => {
  it('queue mid fan-out, remount (reload), queue still shown and session holds it', async () => {
    const user = userEvent.setup();
    const { rerender } = render(
      <IdentityProvider initialState={admittedGoalState()}>
        <StoreProbe />
        <MatrixIntake key="mount-1" />
      </IdentityProvider>
    );

    const input = await screen.findByTestId('roster-input');
    await user.type(input, 'Acme Robotics{Enter}');
    await user.click(screen.getByRole('button', { name: /Continue/i }));
    await waitFor(() => expect(document.querySelector('[data-testid="intake-question"]')).toBeTruthy());

    await user.click(screen.getByTestId('add-another-toggle'));
    await user.type(screen.getByTestId('add-another-input'), 'Beta Holdings');
    await user.click(screen.getByTestId('add-another-submit'));
    await waitFor(() => expect(screen.getByTestId('roster-queued-line')).toHaveTextContent('Beta Holdings'));

    // The store session was updated with the queued name (not just React state).
    await waitFor(() => {
      const session = store?.intakeSessionByCycleId?.[CYCLE_ID];
      expect(session?.rosterNames).toContain('Beta Holdings');
    });

    // Remount MatrixIntake (same store) — simulates reload/resume.
    rerender(
      <IdentityProvider initialState={admittedGoalState()}>
        <StoreProbe />
        <MatrixIntake key="mount-2" />
      </IdentityProvider>
    );

    // Resumed with the queued item intact and visible.
    await waitFor(() => expect(screen.getByTestId('roster-queued-line')).toHaveTextContent('Beta Holdings'));
  }, 40000);
});
