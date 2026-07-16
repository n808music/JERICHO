import React from 'react';
import '@testing-library/jest-dom';
import { render, screen, waitFor, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, afterEach } from 'vitest';
import MatrixIntake from '../../src/ui/masterPlan/MatrixIntake.jsx';
import { IdentityProvider, buildBlankIdentityState, useIdentityStore } from '../../src/state/identityStore.js';

// Mid fan-out escape hatch (2026-07-10): the compound-readback advisory said
// "consider splitting" but offered no way to act on it — the only affordance
// was "Looks right — confirm" or redoing the section. Now any fan-out
// question (and the advisory itself) can queue another item, inserted right
// after the current one, touching nothing already answered.

const CYCLE_ID = 'cycle-add-another-1';
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
        goalContract: { goalId: 'goal-add-1', goalText: 'Secure $25k', startDayKey: '2026-03-12', deadline: { dayKey: '2026-06-30' } },
      },
    },
  };
}

let store = null;
function StoreProbe() { store = useIdentityStore(); return null; }
const entityCount = () => Object.keys(store?.matrix?.entitiesById || {}).length;

afterEach(() => { cleanup(); store = null; });

const SUBSTANTIVE = 'A concrete substantive description of the real current state and the evidence that proves it today.';

async function completeCurrentField(user) {
  await waitFor(() => {
    const has = document.querySelector('[data-testid="pickset-option"]') || document.querySelector('textarea');
    expect(has).toBeTruthy();
  });
  const opt = document.querySelector('[data-testid="pickset-option"]');
  if (opt) {
    await user.click(opt);
  } else {
    const ta = document.querySelector('textarea');
    await user.clear(ta);
    await user.type(ta, SUBSTANTIVE);
  }
  await user.click(screen.getByRole('button', { name: /^Next/i }));
}

describe('MatrixIntake — add another item mid fan-out', () => {
  it('queues a new name after the current item; it is asked next, prior answers untouched', async () => {
    const user = userEvent.setup();
    render(<IdentityProvider initialState={admittedGoalState()}><StoreProbe /><MatrixIntake /></IdentityProvider>);

    // Roster: one entity, continue into fan-out.
    const input = await screen.findByTestId('roster-input');
    await user.type(input, 'Acme Robotics{Enter}');
    await user.click(screen.getByRole('button', { name: /Continue/i }));
    await waitFor(() => expect(document.querySelector('[data-testid="intake-question"]')).toBeTruthy());

    // Mid-question: queue a second entity via the escape hatch.
    await user.click(screen.getByTestId('add-another-toggle'));
    await user.type(screen.getByTestId('add-another-input'), 'Beta Holdings');
    await user.click(screen.getByTestId('add-another-submit'));
    await waitFor(() => expect(screen.getByTestId('add-another-confirmation')).toBeInTheDocument());
    // PERSISTENT queue visibility — not just the transient confirmation.
    expect(screen.getByTestId('roster-queued-line')).toHaveTextContent('Beta Holdings');

    // Finish describing Acme — then Beta Holdings is asked next, by name.
    let guard = 0;
    while (entityCount() < 1 && guard < 30) { await completeCurrentField(user); guard += 1; }
    await waitFor(() => expect(entityCount()).toBe(1));
    await waitFor(() => {
      const q = document.querySelector('[data-testid="intake-question"]');
      expect(q?.textContent).toContain('Beta Holdings');
    });

    // And Beta can be completed into a second record.
    guard = 0;
    while (entityCount() < 2 && guard < 30) { await completeCurrentField(user); guard += 1; }
    await waitFor(() => expect(entityCount()).toBe(2));
    expect(store.matrix.entitiesById['entity-acme-robotics']).toBeTruthy();
    expect(store.matrix.entitiesById['entity-beta-holdings']).toBeTruthy();
  }, 60000);

  it('queued items are visible and removable — an accidental duplicate can be deleted', async () => {
    const user = userEvent.setup();
    render(<IdentityProvider initialState={admittedGoalState()}><StoreProbe /><MatrixIntake /></IdentityProvider>);
    const input = await screen.findByTestId('roster-input');
    await user.type(input, 'Acme Robotics{Enter}');
    await user.click(screen.getByRole('button', { name: /Continue/i }));
    await waitFor(() => expect(document.querySelector('[data-testid="intake-question"]')).toBeTruthy());

    // Queue two items.
    for (const name of ['Beta Holdings', 'Gamma Press']) {
      await user.click(screen.getByTestId('add-another-toggle'));
      await user.type(screen.getByTestId('add-another-input'), name);
      await user.click(screen.getByTestId('add-another-submit'));
    }
    await waitFor(() => expect(screen.getAllByTestId('roster-queued-chip')).toHaveLength(2));

    // Remove the first queued one (Beta was inserted, then Gamma before it).
    await user.click(screen.getByRole('button', { name: /remove gamma press/i }));
    await waitFor(() => expect(screen.getAllByTestId('roster-queued-chip')).toHaveLength(1));
    expect(screen.getByTestId('roster-queued-line')).toHaveTextContent('Beta Holdings');
    expect(screen.getByTestId('roster-queued-line')).not.toHaveTextContent('Gamma Press');
  }, 40000);

  it('skip-this-item discards ONLY the current item — the queue behind it survives', async () => {
    const user = userEvent.setup();
    render(<IdentityProvider initialState={admittedGoalState()}><StoreProbe /><MatrixIntake /></IdentityProvider>);
    const input = await screen.findByTestId('roster-input');
    await user.type(input, 'Acme Robotics{Enter}');
    await user.type(input, 'Beta Holdings{Enter}');
    await user.click(screen.getByRole('button', { name: /Continue/i }));
    await waitFor(() => {
      const q = document.querySelector('[data-testid="intake-question"]');
      expect(q?.textContent).toContain('Acme Robotics');
    });

    // Skip the current (duplicate) item — next roster name is asked, nothing declared.
    await user.click(screen.getByTestId('skip-current-item'));
    await waitFor(() => {
      const q = document.querySelector('[data-testid="intake-question"]');
      expect(q?.textContent).toContain('Beta Holdings');
    });
    expect(entityCount()).toBe(0);

    // Back undoes the skip — Acme's question returns.
    await user.click(screen.getByTestId('intake-back'));
    await waitFor(() => {
      const q = document.querySelector('[data-testid="intake-question"]');
      expect(q?.textContent).toContain('Acme Robotics');
    });
  }, 40000);

  it('rejects duplicates against names already in the roster', async () => {
    const user = userEvent.setup();
    render(<IdentityProvider initialState={admittedGoalState()}><StoreProbe /><MatrixIntake /></IdentityProvider>);
    const input = await screen.findByTestId('roster-input');
    await user.type(input, 'Acme Robotics{Enter}');
    await user.click(screen.getByRole('button', { name: /Continue/i }));
    await waitFor(() => expect(document.querySelector('[data-testid="intake-question"]')).toBeTruthy());

    await user.click(screen.getByTestId('add-another-toggle'));
    await user.type(screen.getByTestId('add-another-input'), 'acme robotics');
    await user.click(screen.getByTestId('add-another-submit'));
    // Not accepted: input stays open, no confirmation.
    expect(screen.queryByTestId('add-another-confirmation')).not.toBeInTheDocument();
    expect(screen.getByTestId('add-another-input')).toBeInTheDocument();
  }, 30000);
});
