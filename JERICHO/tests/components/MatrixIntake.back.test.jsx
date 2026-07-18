import React from 'react';
import '@testing-library/jest-dom';
import { render, screen, waitFor, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, afterEach } from 'vitest';
import MatrixIntake from '../../src/ui/masterPlan/MatrixIntake.jsx';
import { IdentityProvider, buildBlankIdentityState, useIdentityStore } from '../../src/state/identityStore.js';

// Back button acceptance: once Continue/Next is pressed, the operator can step
// backwards — the previous question returns with the prior answer intact, and
// any entity declared in between is rolled back out of the matrix (no more
// "clear the whole goal and start over" to fix one wrong answer).

const CYCLE_ID = 'cycle-back-1';
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
        goalContract: { goalId: 'goal-back-1', goalText: 'Secure $25k', startDayKey: '2026-03-12', deadline: { dayKey: '2026-06-30' } },
      },
    },
  };
}

let store = null;
function StoreProbe() { store = useIdentityStore(); return null; }
const entityCount = () => Object.keys(store?.matrix?.entitiesById || {}).length;

afterEach(() => { cleanup(); store = null; });

async function addChips(user, names) {
  const input = await screen.findByTestId('roster-input');
  for (const n of names) {
    await user.type(input, `${n}{Enter}`);
  }
  await waitFor(() => expect(screen.getAllByTestId('roster-chip').length).toBe(names.length));
  await user.click(screen.getByRole('button', { name: /Continue/i }));
}

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

async function describeEntitiesUntil(user, target) {
  let guard = 0;
  while (entityCount() < target && guard < 60) {
    await completeCurrentField(user);
    guard += 1;
  }
}

describe('MatrixIntake Back navigation', () => {
  it('no Back button before any forward step; Back appears after the first transition', async () => {
    const user = userEvent.setup();
    render(<IdentityProvider initialState={admittedGoalState()}><StoreProbe /><MatrixIntake /></IdentityProvider>);
    await screen.findByTestId('roster-input');
    expect(screen.queryByTestId('intake-back')).not.toBeInTheDocument();
    await addChips(user, ['Acme Robotics']);
    await waitFor(() => expect(screen.getByTestId('intake-back')).toBeInTheDocument());
  }, 30000);

  it('Back from the first detail question returns to the roster with chips intact', async () => {
    const user = userEvent.setup();
    render(<IdentityProvider initialState={admittedGoalState()}><StoreProbe /><MatrixIntake /></IdentityProvider>);
    await addChips(user, ['Acme Robotics', 'Northwind Logistics']);
    // First detail question (role tags for Acme) is showing.
    await waitFor(() => expect(document.querySelector('[data-testid="intake-question"]')).toBeTruthy());
    await user.click(screen.getByTestId('intake-back'));
    // Roster screen returns WITH both typed chips — nothing lost.
    await screen.findByTestId('roster-input');
    const chips = screen.getAllByTestId('roster-chip').map((el) => el.textContent);
    expect(chips.join('|')).toContain('Acme Robotics');
    expect(chips.join('|')).toContain('Northwind Logistics');
  }, 30000);

  it('Back within a slot restores the previous question and the typed answer', async () => {
    const user = userEvent.setup();
    render(<IdentityProvider initialState={admittedGoalState()}><StoreProbe /><MatrixIntake /></IdentityProvider>);
    await addChips(user, ['Acme Robotics']);

    // Field 1: roleTags (pick-set). Answer it.
    await waitFor(() => expect(document.querySelector('[data-testid="pickset-option"]')).toBeTruthy());
    await user.click(document.querySelector('[data-testid="pickset-option"]'));
    await user.click(screen.getByRole('button', { name: /^Next/i }));

    // Field 2: purpose (free text). Type an answer, advance.
    await waitFor(() => expect(document.querySelector('textarea')).toBeTruthy());
    await user.type(document.querySelector('textarea'), SUBSTANTIVE);
    await user.click(screen.getByRole('button', { name: /^Next/i }));
    await waitFor(() => {
      const ta = document.querySelector('textarea');
      // advanced: field 2's textarea cleared for the next field, or a pick-set showed
      expect(!ta || ta.value === '').toBeTruthy();
    });

    // Back → purpose question returns with the typed answer intact for editing.
    await user.click(screen.getByTestId('intake-back'));
    await waitFor(() => {
      const ta = document.querySelector('textarea');
      expect(ta).toBeTruthy();
      expect(ta.value).toBe(SUBSTANTIVE);
    });

    // Back again → roleTags pick-set returns with the prior selection active.
    await user.click(screen.getByTestId('intake-back'));
    await waitFor(() => expect(document.querySelector('[data-testid="pickset-option"]')).toBeTruthy());
  }, 30000);

  it('Back across an entity boundary rolls the declared entity out of the matrix', async () => {
    const user = userEvent.setup();
    render(<IdentityProvider initialState={admittedGoalState()}><StoreProbe /><MatrixIntake /></IdentityProvider>);
    await addChips(user, ['Acme Robotics', 'Northwind Logistics']);

    // Fully describe entity 1 → DECLARE_ENTITY dispatched.
    await describeEntitiesUntil(user, 1);
    await waitFor(() => expect(entityCount()).toBe(1));

    // Now on entity 2's first question. Back → undoes the entity-1 declaration
    // and returns to entity 1's final field with the answer restored.
    await waitFor(() => expect(screen.getByTestId('intake-back')).toBeInTheDocument());
    await user.click(screen.getByTestId('intake-back'));
    await waitFor(() => expect(entityCount()).toBe(0));

    // Forward again: re-answer the restored field → entity 1 re-declared.
    await describeEntitiesUntil(user, 1);
    await waitFor(() => expect(entityCount()).toBe(1));
    expect(store.matrix.entitiesById['entity-acme-robotics']?.name).toBe('Acme Robotics');
  }, 60000);
});
