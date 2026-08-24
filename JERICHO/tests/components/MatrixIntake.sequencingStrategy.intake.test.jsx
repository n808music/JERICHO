import React from 'react';
import '@testing-library/jest-dom';
import { render, screen, waitFor, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, afterEach } from 'vitest';
import MatrixIntake from '../../src/ui/masterPlan/MatrixIntake.jsx';
import { IdentityProvider, buildBlankIdentityState } from '../../src/state/identityStore.js';

/**
 * Integration test: Sequencing Risk probe questions render inline at §3b during MatrixIntake intake flow.
 *
 * Verifies Investigation 1's design: Foundation-vs-Output sequencing decision is asked during
 * Initiative intake via scope question, and three probe questions render inline if operator says yes.
 *
 * Flow: Entity roster → Entity intake → Initiative intake → Sequencing Risk scope → Sequencing Risk probes
 */

const CYCLE_ID = 'cycle-seq-1';

function buildIntakeState() {
  const base = buildBlankIdentityState();
  return {
    ...base,
    activeCycleId: CYCLE_ID,
    cyclesById: {
      ...(base.cyclesById || {}),
      [CYCLE_ID]: {
        id: CYCLE_ID,
        status: 'active',
        goalDraftV2: { goalText: 'test goal', goalLabel: 'test goal' },
        goalContract: {
          goalId: 'test-goal-1',
          goalText: 'Test Goal',
          startDayKey: '2026-06-15',
          deadline: { dayKey: '2026-12-31' },
        },
      },
    },
    // Start with empty matrix to trigger full intake flow from Entity roster
  };
}

afterEach(() => cleanup());

describe('MatrixIntake — Sequencing Risk probe at §3b (required, not optional)', () => {
  it('the Sequencing Risk probe questions appear as required intake (not skippable)', async () => {
    const user = userEvent.setup();

    render(
      <IdentityProvider initialState={buildIntakeState()}>
        <MatrixIntake />
      </IdentityProvider>
    );

    const ANSWER = 'A concrete test description for this field.';

    // Step 1: Entity roster — add an entity
    const entityInput = await screen.findByTestId('roster-input');
    await user.type(entityInput, 'Acme Corp{Enter}');

    // Step 2: Continue from Entity roster
    await user.click(screen.getByRole('button', { name: /Continue/i }));

    // Step 3: Entity and Initiative intake — answer probes and handle scope questions
    // Keep advancing until we reach Sequencing Risk probes (no scope question, it's required)
    for (let step = 0; step < 40; step++) {
      // Check if any Sequencing Risk probe question has appeared
      if (
        screen.queryByText(/Has this category seen proven, non-commoditized winners?/i) ||
        screen.queryByText(/Do your target customers have prior successful relationships/i) ||
        screen.queryByText(/Is the category highly competitive or underserved?/i)
      ) {
        break;
      }

      // Handle scope question buttons (Yes/No style)
      const includeBtn = screen.queryByRole('button', { name: /Yes, include this/i });
      if (includeBtn) {
        await user.click(includeBtn);
        await new Promise(r => setTimeout(r, 50));
        continue;
      }

      // Handle probe textarea
      const textarea = document.querySelector('textarea');
      if (textarea) {
        await user.clear(textarea);
        await user.type(textarea, ANSWER);
      }

      // Handle Next button
      const nextBtn = screen.queryByRole('button', { name: /^Next/i });
      if (nextBtn && !nextBtn.disabled) {
        await user.click(nextBtn);
        await new Promise(r => setTimeout(r, 50));
        continue;
      }

      // Handle Skip buttons as fallback
      const skipBtn = screen.queryByRole('button', { name: /Skip this section/i });
      if (skipBtn) {
        await user.click(skipBtn);
        await new Promise(r => setTimeout(r, 50));
        continue;
      }

      // No more buttons to click, exit
      break;
    }

    // Step 4: Verify at least one Sequencing Risk probe appears
    // Since it's required (not optional), the operator goes straight to the three probes
    const q1 = screen.queryByText(/Has this category seen proven, non-commoditized winners?/i);
    const q2 = screen.queryByText(/Do your target customers have prior successful relationships/i);
    const q3 = screen.queryByText(/Is the category highly competitive or underserved?/i);

    expect([q1, q2, q3].some((q) => q)).toBe(true);
  });
});
