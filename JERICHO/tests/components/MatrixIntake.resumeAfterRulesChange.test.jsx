import React from 'react';
import '@testing-library/jest-dom';
import { render, screen, waitFor, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, afterEach } from 'vitest';
import MatrixIntake from '../../src/ui/masterPlan/MatrixIntake.jsx';
import { IdentityProvider, buildBlankIdentityState, useIdentityStore } from '../../src/state/identityStore.js';
import { INITIATIVE_SLOT_ID } from '../../src/domain/elicitation/elicitationEngine.js';

// Resume-after-rules-change (2026-07-10, corrected same day): the operator
// saved mid-§3 while a doneWhen answer was mid-reprobe; the validator was then
// loosened so the captured answer now passes every gate. Two wrong behaviors
// are locked out here:
//   1. restarting the survey at §2 (original defect), and
//   2. AUTO-SUBMITTING the answer and advancing past it (first fix's mistake —
//      the operator never confirmed that answer; the system must not press
//      Next for them).
// Correct: land ON the in-flight question with the answer prefilled, with
// Back history rebuilt so earlier answers can be double-checked.

const CYCLE_ID = 'cycle-rules-change-1';
// Use a doneWhen value that passes external verifiability: world-state verb + concrete signal
const DONE_WHEN = '10k streams live on Spotify for Artists by end of launch week';

function midReprobeSavedState() {
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
          goalId: 'goal-rules-1',
          goalText: 'Scale to 3.5B',
          startDayKey: '2026-07-10',
          deadline: { dayKey: '2031-07-10' },
        },
      },
    },
    intakeSessionByCycleId: {
      [CYCLE_ID]: {
        phase: 'engine',
        slotQueue: [INITIATIVE_SLOT_ID],
        currentSlotId: INITIATIVE_SLOT_ID,
        engineSnapshot: {
          goalType: 'generic',
          slotStack: [
            {
              slotId: INITIATIVE_SLOT_ID,
              captured: {
                name: 'Mission A',
                owningEntityId: 'entity-acme',
                roleTags: ['project'],
                purpose: 'Release tapes building the terminal album',
                purposeFor: 'Grow from 40k to 100k listeners and establish label credibility',
                purposeCompletion: '10k first-week streams with 1000+ unique listeners',
                classification: 'objective',
                // Now passes under the CURRENT validator (quantified metric evidence).
                doneWhen: DONE_WHEN,
              },
              completed: false,
              // lastFailureCode cleared — doneWhen value now passes validation
            },
          ],
          completedSlotIds: [],
        },
        inputValue: '',
        rosterNames: ['Mission A', 'Mission B'],
        rosterIndex: 0,
        rosterSlotId: INITIATIVE_SLOT_ID,
      },
    },
  };
}

let store = null;
function StoreProbe() { store = useIdentityStore(); return null; }

afterEach(() => { cleanup(); store = null; });

describe('MatrixIntake — resume when restored slot now passes all gates', () => {
  it('lands ON the in-flight question, answer prefilled, nothing auto-declared', async () => {
    render(
      <IdentityProvider initialState={midReprobeSavedState()}>
        <StoreProbe />
        <MatrixIntake />
      </IdentityProvider>
    );

    // The doneWhen question for Mission A is showing, answer prefilled.
    await waitFor(() => {
      const ta = document.querySelector('textarea');
      expect(ta).toBeTruthy();
      expect(ta.value).toBe(DONE_WHEN);
      // Verify this is the doneWhen field (may show base probe or reprobe)
      const q = document.querySelector('[data-testid="intake-question"]');
      expect(q?.textContent).toContain('Mission A');
      expect(q?.textContent?.toLowerCase()).toMatch(/done\s*when|mission.*condition/i);
    });

    // Nothing was declared on the operator's behalf.
    expect(Object.keys(store?.matrix?.initiativesById || {})).toHaveLength(0);
    // No restart at §2.
    expect(screen.queryByTestId('roster-input')).not.toBeInTheDocument();
    // Back history rebuilt from the answered fields (owner, purpose, classification, etc).
    expect(screen.getByTestId('intake-back')).toBeInTheDocument();
  }, 30000);

  it('Back steps into the previous answered field; Next confirms and declares, then advances to Mission B', async () => {
    const user = userEvent.setup();
    render(
      <IdentityProvider initialState={midReprobeSavedState()}>
        <StoreProbe />
        <MatrixIntake />
      </IdentityProvider>
    );
    // Wait for the doneWhen field to appear (may show NOT_VERIFIABLE reprobe first)
    await waitFor(() => expect(document.querySelector('textarea')).toBeTruthy());

    // Back → classification question, prior pick active.
    await user.click(screen.getByTestId('intake-back'));
    await waitFor(() => expect(document.querySelector('[data-testid="pickset-option"]')).toBeTruthy());

    // Forward again: re-answer classification, then confirm doneWhen with Next.
    const options = [...document.querySelectorAll('[data-testid="pickset-option"]')];
    await user.click(options[0]);
    await user.click(screen.getByRole('button', { name: /^Next/i }));
    await waitFor(() => expect(document.querySelector('textarea')).toBeTruthy());
    const ta = document.querySelector('textarea');
    if (!ta.value) await user.type(ta, DONE_WHEN);
    await user.click(screen.getByRole('button', { name: /^Next/i }));

    // NOW it declares — operator pressed Next themselves — and moves to Mission B.
    await waitFor(() => {
      expect(store?.matrix?.initiativesById?.['initiative-mission-a']).toBeTruthy();
    });
    await waitFor(() => {
      const q = document.querySelector('[data-testid="intake-question"]');
      expect(q?.textContent).toContain('Mission B');
    });
  }, 40000);
});
