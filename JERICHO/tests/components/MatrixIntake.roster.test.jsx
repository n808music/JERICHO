import React from 'react';
import '@testing-library/jest-dom';
import { render, screen, waitFor, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, afterEach } from 'vitest';
import MatrixIntake from '../../src/ui/masterPlan/MatrixIntake.jsx';
import { IdentityProvider, buildBlankIdentityState, useIdentityStore } from '../../src/state/identityStore.js';

// Defect E acceptance (user-verified live shape): entering N entity NAMES as N
// chips produces N entities — each described one at a time BY NAME in plain
// text — and stored keyed per entity. Asserts that behaviour, not the mechanism.

const CYCLE_ID = 'cycle-roster-1';
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
        goalContract: { goalId: 'goal-roster-1', goalText: 'Secure $25k', startDayKey: '2026-03-12', deadline: { dayKey: '2026-06-30' } },
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

// Answer whatever field is currently shown (pick-set → first option; text → a
// substantive sentence), then advance.
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
    await user.type(ta, 'A concrete substantive description of the real current state and the evidence that proves it today.');
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

describe('MatrixIntake roster fan-out (Defect E)', () => {
  it('N=3 chips → each entity described by name (plain text) → 3 keyed records', async () => {
    const user = userEvent.setup();
    render(<IdentityProvider initialState={admittedGoalState()}><StoreProbe /><MatrixIntake /></IdentityProvider>);

    await addChips(user, ['Acme Robotics', 'Northwind Logistics', 'Beacon Health Partners']);

    // First detail screen asks about the first entity BY NAME, in plain text.
    const q = await waitFor(() => {
      const el = document.querySelector('[data-testid="intake-question"]');
      expect(el).toBeTruthy();
      return el;
    });
    expect(q.textContent).toContain('Acme Robotics');
    expect(q.textContent).not.toContain('**');

    await describeEntitiesUntil(user, 3);

    await waitFor(() => expect(entityCount()).toBe(3));
    const keys = Object.keys(store.matrix.entitiesById);
    expect(keys).toEqual(
      expect.arrayContaining(['entity-acme-robotics', 'entity-northwind-logistics', 'entity-beacon-health-partners'])
    );
    expect(store.matrix.entitiesById['entity-acme-robotics'].name).toBe('Acme Robotics');
    expect(store.matrix.entitiesById['entity-beacon-health-partners'].name).toBe('Beacon Health Partners');
  }, 60000);

  it('N=1 chip → exactly one keyed entity', async () => {
    const user = userEvent.setup();
    render(<IdentityProvider initialState={admittedGoalState()}><StoreProbe /><MatrixIntake /></IdentityProvider>);
    await addChips(user, ['Acme Robotics']);
    await describeEntitiesUntil(user, 1);
    await waitFor(() => expect(entityCount()).toBe(1));
    expect(Object.keys(store.matrix.entitiesById)).toEqual(['entity-acme-robotics']);
  }, 60000);

  it('zero chips → skip declares no entities and advances past the section', async () => {
    const user = userEvent.setup();
    render(<IdentityProvider initialState={admittedGoalState()}><StoreProbe /><MatrixIntake /></IdentityProvider>);
    // Roster screen renders; Continue is disabled with no chips — skip instead.
    await screen.findByTestId('roster-input');
    expect(screen.getByRole('button', { name: /Continue/i })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: /skip this section/i }));
    // Advanced to the next section (Initiative scope gate); no entity declared.
    await waitFor(() => expect(screen.getByRole('button', { name: /yes, include this/i })).toBeInTheDocument());
    expect(entityCount()).toBe(0);
  }, 30000);
});
