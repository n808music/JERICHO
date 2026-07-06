import React, { useState } from 'react';
import '@testing-library/jest-dom';
import { render, screen, waitFor, act, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, afterEach } from 'vitest';
import MatrixIntake from '../../src/ui/masterPlan/MatrixIntake.jsx';
import { IdentityProvider, buildBlankIdentityState, useIdentityStore } from '../../src/state/identityStore.js';

// Defect B acceptance: an in-flight intake survives a route-away/back-gesture
// and a full remount (refresh-equivalent), resuming at the exact slot with the
// captured answers intact — and is destroyed by a goal clear (Gap 4 class).

const CYCLE_ID = 'cycle-resume-1';

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
        goalContract: { goalId: 'goal-resume-1', goalText: 'Secure $25k', startDayKey: '2026-03-12', deadline: { dayKey: '2026-06-30' } },
      },
    },
  };
}

let capturedStore = null;
function StoreProbe() {
  capturedStore = useIdentityStore();
  return null;
}

// Provider stays mounted; only MatrixIntake toggles — modelling a route-away
// that unmounts the intake while the store (and its persisted session) survive.
function Harness() {
  const [mounted, setMounted] = useState(true);
  return (
    <IdentityProvider initialState={admittedGoalState()}>
      <StoreProbe />
      <button data-testid="toggle" onClick={() => setMounted((m) => !m)}>toggle</button>
      {mounted ? <MatrixIntake /> : <div data-testid="away">away</div>}
    </IdentityProvider>
  );
}

afterEach(() => { cleanup(); capturedStore = null; });

async function answerName(user, name) {
  // Roster flow (Defect E): add the name as a chip, continue to its detail pass.
  const input = await screen.findByTestId('roster-input');
  await user.type(input, `${name}{Enter}`);
  await user.click(screen.getByRole('button', { name: /Continue/i }));
  await waitFor(() => {
    const el = document.querySelector('[data-testid="intake-question"]');
    expect(el).toBeTruthy();
    expect(el.textContent).toContain(name);
  });
}

describe('MatrixIntake resume across route-away / remount (Defect B)', () => {
  it('resumes at the same slot with the captured answer after unmount+remount, and survives a second remount', async () => {
    const user = userEvent.setup();
    render(<Harness />);

    // Answer the entity name; the engine now holds a captured answer.
    await answerName(user, 'Acme Robotics');
    // roleTags probe should now be showing, referent-bound to the name.
    await waitFor(() => {
      const q = document.querySelector('[data-testid="intake-question"]');
      expect(q.textContent).toContain('Acme Robotics');
    });

    // Route away (unmount) then back (remount).
    await user.click(screen.getByTestId('toggle')); // unmount
    await waitFor(() => expect(screen.getByTestId('away')).toBeInTheDocument());
    await user.click(screen.getByTestId('toggle')); // remount

    // Resumed: banner shown, still on the roleTags probe, name preserved.
    await waitFor(() => {
      expect(screen.getByTestId('intake-resume-banner')).toBeInTheDocument();
      const q = document.querySelector('[data-testid="intake-question"]');
      expect(q.textContent).toContain('Acme Robotics');
    });

    // Survives a SECOND full remount (refresh-equivalent).
    await user.click(screen.getByTestId('toggle'));
    await waitFor(() => expect(screen.getByTestId('away')).toBeInTheDocument());
    await user.click(screen.getByTestId('toggle'));
    await waitFor(() => {
      const q = document.querySelector('[data-testid="intake-question"]');
      expect(q.textContent).toContain('Acme Robotics');
    });
  });

  it('goal clear destroys the in-flight session — no resume (Gap 4 class)', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await answerName(user, 'Acme Robotics');
    await waitFor(() => expect(capturedStore.intakeSessionByCycleId?.[CYCLE_ID]).toBeDefined());

    // Clear the goal.
    await act(async () => { await capturedStore.hardResetIdentity(); });

    // Session gone; if the intake is re-shown there is no resume affordance.
    await waitFor(() => {
      expect(capturedStore.intakeSessionByCycleId?.[CYCLE_ID]).toBeUndefined();
    });
    expect(screen.queryByTestId('intake-resume-banner')).not.toBeInTheDocument();
  });
});
