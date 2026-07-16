import React from 'react';
import '@testing-library/jest-dom';
import { render, screen, waitFor, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, afterEach } from 'vitest';
import MatrixIntake from '../../src/ui/masterPlan/MatrixIntake.jsx';
import { IdentityProvider, buildBlankIdentityState, useIdentityStore } from '../../src/state/identityStore.js';
import { PROJECT_SLOT_ID } from '../../src/domain/elicitation/elicitationEngine.js';
import { computeDerivedState } from '../../src/state/identityCompute.js';

// Resume INTO a readback (2026-07-10 live defect): after reloading while a
// project readback was showing, every button on it — the reopen-a-field chips
// AND 'Looks right — confirm' — did nothing. The restored engine's state
// lacked readbackPending (nextStep computes it transiently), so confirm/
// reopen threw 'no readback pending' into the void. The resume path must
// register the readback on the engine it stores.

const CYCLE_ID = 'cycle-readback-resume-1';

function savedAtReadbackState() {
  let base = buildBlankIdentityState();
  base = computeDerivedState(base, {
    type: 'DECLARE_ENTITY',
    payload: {
      id: 'ent-gs-systems',
      name: 'Global State Systems',
      roleTags: ['business', 'project'],
      purpose: 'Technology company that builds and ships Jericho',
      formationState: 'functioning',
      statusEvidence: 'Jericho running locally, provisional patent filed',
    },
  });
  base = computeDerivedState(base, {
    type: 'DECLARE_VERIFICATION_SOURCE',
    payload: { id: 'vs-registry', domain: 'filings', source: 'USPTO and application store' },
  });
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
          goalId: 'goal-rb-1',
          goalText: 'Scale to 3.5B',
          startDayKey: '2026-07-10',
          deadline: { dayKey: '2031-07-10' },
        },
      },
    },
    intakeSessionByCycleId: {
      [CYCLE_ID]: {
        phase: 'engine',
        slotQueue: [PROJECT_SLOT_ID],
        currentSlotId: PROJECT_SLOT_ID,
        engineSnapshot: {
          goalType: 'generic',
          slotStack: [
            {
              slotId: PROJECT_SLOT_ID,
              captured: {
                name: 'JERICHO 1.0',
                owningEntityId: 'ent-gs-systems',
                successMetric: '1.0 App and Behavioral Execution Engine non-provisional patent',
                verificationSource: 'USPTO and application store',
                verificationSourceId: 'vs-registry',
              },
              completed: false,
              lastFailureCode: null,
            },
          ],
          completedSlotIds: [],
        },
        inputValue: '',
        rosterNames: ['JERICHO 1.0', 'HELP YOURSELF BROADCAST'],
        rosterIndex: 0,
        rosterSlotId: PROJECT_SLOT_ID,
      },
    },
  };
}

let store = null;
function StoreProbe() { store = useIdentityStore(); return null; }

afterEach(() => { cleanup(); store = null; });

describe('MatrixIntake — resume into a readback keeps its buttons alive', () => {
  it('reopen chip responds: clicking successMetric re-asks the metric question', async () => {
    const user = userEvent.setup();
    render(
      <IdentityProvider initialState={savedAtReadbackState()}>
        <StoreProbe />
        <MatrixIntake />
      </IdentityProvider>
    );

    // Resumed straight into the readback.
    await waitFor(() => expect(screen.getByText(/is that the check you'?ll perform/i)).toBeInTheDocument());

    // Chip click must RESPOND: the metric question replaces the readback.
    await user.click(screen.getByRole('button', { name: /successMetric/i }));
    await waitFor(() => {
      expect(screen.queryByText(/is that the check you'?ll perform/i)).not.toBeInTheDocument();
      expect(document.querySelector('textarea')).toBeTruthy();
    });
  }, 30000);

  it('confirm responds: the project is declared and fan-out advances', async () => {
    const user = userEvent.setup();
    render(
      <IdentityProvider initialState={savedAtReadbackState()}>
        <StoreProbe />
        <MatrixIntake />
      </IdentityProvider>
    );
    await waitFor(() => expect(screen.getByText(/is that the check you'?ll perform/i)).toBeInTheDocument());

    await user.click(screen.getByRole('button', { name: /looks right — confirm/i }));
    await waitFor(() => {
      expect(store?.matrix?.projectsById?.['project-jericho-1-0']).toBeTruthy();
    });
    // Next roster item asked by name.
    await waitFor(() => {
      const q = document.querySelector('[data-testid="intake-question"]');
      expect(q?.textContent).toContain('HELP YOURSELF BROADCAST');
    });
  }, 30000);
});
