import React from 'react';
import '@testing-library/jest-dom';
import { render, screen, waitFor, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, afterEach } from 'vitest';
import MatrixIntake from '../../src/ui/masterPlan/MatrixIntake.jsx';
import { IdentityProvider, buildBlankIdentityState } from '../../src/state/identityStore.js';

// Defect C: one ask per probe. These assert the PROPERTY (a framing/scope line
// is a single ask) and the scope-question BRANCH BEHAVIOR (Yes enters, Skip
// advances) — not the exact new strings, so they don't become copy mirrors.

const CYCLE_ID = 'cycle-copy-1';
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
        goalContract: { goalId: 'goal-copy-1', goalText: 'Secure $25k', startDayKey: '2026-03-12', deadline: { dayKey: '2026-06-30' } },
      },
    },
  };
}

// A line is "compound" if it stacks distinct asks: an X, Y, or Z list, two
// or-clauses, or more than one question mark.
function isCompoundAsk(s) {
  const text = String(s || '');
  if ((text.match(/\?/g) || []).length > 1) return true;
  if (/,\s*[^,]+,\s*or\b/i.test(text)) return true; // "X, Y, or Z"
  if (/\bor\b.*\bor\b/i.test(text)) return true; // two or-clauses
  return false;
}

afterEach(() => cleanup());

describe('MatrixIntake copy — one ask per probe (Defect C)', () => {
  it('the entity framing eyebrow is a single ask (not a triple-barreled list)', async () => {
    render(<IdentityProvider initialState={admittedGoalState()}><MatrixIntake /></IdentityProvider>);
    const framing = await waitFor(() => {
      const el = document.querySelector('[data-testid="intake-framing"]');
      expect(el).toBeTruthy();
      return el;
    });
    expect(isCompoundAsk(framing.textContent), `framing is compound: "${framing.textContent}"`).toBe(false);
  });

  it('scope question is single-ask AND "Yes" enters the section (affirmative polarity preserved)', async () => {
    const user = userEvent.setup();
    render(<IdentityProvider initialState={admittedGoalState()}><MatrixIntake /></IdentityProvider>);
    await screen.findByTestId('roster-input');

    // Skip the mandatory entity slot to reach the first optional section's scope gate.
    await user.click(screen.getByRole('button', { name: /skip this section/i }));
    const yesBtn = await screen.findByRole('button', { name: /yes, include this/i });

    // The scope question itself is a single ask.
    const scopeQuestion = yesBtn.closest('div').parentElement.querySelector('p');
    expect(isCompoundAsk(scopeQuestion?.textContent), `scope question compound: "${scopeQuestion?.textContent}"`).toBe(false);

    // "Yes" enters the section — its roster screen now renders (Defect E).
    await user.click(yesBtn);
    await waitFor(() => expect(document.querySelector('[data-testid="roster-input"]')).toBeTruthy());
    // The scope screen's Yes button is gone (we left the gate, entered the section).
    expect(screen.queryByRole('button', { name: /yes, include this/i })).not.toBeInTheDocument();
  });

  it('"Skip" on a scope gate advances past the section without entering it', async () => {
    const user = userEvent.setup();
    render(<IdentityProvider initialState={admittedGoalState()}><MatrixIntake /></IdentityProvider>);
    await screen.findByTestId('roster-input');
    await user.click(screen.getByRole('button', { name: /skip this section/i }));
    await screen.findByRole('button', { name: /not for this goal — skip/i });

    // First optional section shown is Initiative.
    expect(screen.getByText('Initiative')).toBeInTheDocument();
    // Skip it — flow advances to the next section (Project roster, per the
    // 2026-07-10 workbook order: Projects/Deliverables before Systems),
    // not into Initiative.
    await user.click(screen.getByRole('button', { name: /not for this goal — skip/i }));
    await waitFor(() => expect(screen.getByText('Project')).toBeInTheDocument());
    expect(screen.queryByText('Initiative')).not.toBeInTheDocument();
  });
});
