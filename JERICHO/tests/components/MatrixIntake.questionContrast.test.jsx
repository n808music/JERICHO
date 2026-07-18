import React from 'react';
import '@testing-library/jest-dom';
import { render, screen, waitFor, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, afterEach } from 'vitest';
import MatrixIntake from '../../src/ui/masterPlan/MatrixIntake.jsx';
import { IdentityProvider, buildBlankIdentityState } from '../../src/state/identityStore.js';

// ACCEPTANCE (user's words): on the intake card, NOTHING is light grey. The
// live question is the largest, full-contrast (near-black), unmistakably-primary
// text; supporting text is smaller but fully legible near-black. Asserts the
// computed color/size/weight of the RENDERED nodes — the visual hierarchy —
// across both the roster screen (Defect E) and a detail probe.

const CYCLE_ID = 'cycle-intake-contrast-1';
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
        goalContract: { goalId: 'goal-contrast-1', goalText: 'Secure $25k', startDayKey: '2026-03-12', deadline: { dayKey: '2026-06-30' } },
      },
    },
  };
}

function luminance(cssColor) {
  const s = String(cssColor || '').trim();
  let r, g, b;
  const rgb = s.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i);
  if (rgb) {
    [r, g, b] = [Number(rgb[1]), Number(rgb[2]), Number(rgb[3])];
  } else {
    const hex = s.replace('#', '');
    if (hex.length !== 6) return null;
    r = parseInt(hex.slice(0, 2), 16);
    g = parseInt(hex.slice(2, 4), 16);
    b = parseInt(hex.slice(4, 6), 16);
  }
  return 0.299 * r + 0.587 * g + 0.114 * b;
}
const px = (v) => parseInt(String(v || '0'), 10) || 0;
const weight = (v) => parseInt(String(v || '400'), 10) || 400;

afterEach(() => cleanup());

describe('MatrixIntake — live question visual hierarchy (Gap 1 acceptance)', () => {
  it('the roster question is the largest, boldest, near-black element; supporting text legible; nothing light grey', async () => {
    render(<IdentityProvider initialState={admittedGoalState()}><MatrixIntake /></IdentityProvider>);

    const question = await waitFor(() => {
      const el = document.querySelector('[data-testid="roster-question"]');
      expect(el).toBeTruthy();
      return el;
    });
    const subtext = document.querySelector('[data-testid="roster-subtext"]');
    const framing = document.querySelector('[data-testid="intake-framing"]');
    expect(subtext).toBeTruthy();

    const qLum = luminance(question.style.color);
    expect(qLum).toBeLessThanOrEqual(70); // near-black, not the near-white it shipped as
    expect(px(question.style.fontSize)).toBeGreaterThanOrEqual(16);
    expect(px(question.style.fontSize)).toBeGreaterThan(px(subtext.style.fontSize));
    expect(weight(question.style.fontWeight)).toBeGreaterThanOrEqual(700);
    expect(luminance(subtext.style.color)).toBeLessThanOrEqual(110); // legible dark

    for (const node of [question, subtext, framing].filter(Boolean)) {
      expect(luminance(node.style.color), `${node.getAttribute('data-testid')} too light: ${node.style.color}`).toBeLessThan(170);
    }
  });

  it('a detail probe (after entering a name) is also near-black and carries no markdown markers', async () => {
    const user = userEvent.setup();
    render(<IdentityProvider initialState={admittedGoalState()}><MatrixIntake /></IdentityProvider>);
    const input = await screen.findByTestId('roster-input');
    await user.type(input, 'Acme Robotics{Enter}');
    await user.click(screen.getByRole('button', { name: /Continue/i }));

    const probe = await waitFor(() => {
      const el = document.querySelector('[data-testid="intake-question"]');
      expect(el).toBeTruthy();
      return el;
    });
    expect(probe.textContent).toContain('Acme Robotics');
    expect(probe.textContent).not.toContain('**');
    expect(luminance(probe.style.color)).toBeLessThanOrEqual(70);
  });
});
