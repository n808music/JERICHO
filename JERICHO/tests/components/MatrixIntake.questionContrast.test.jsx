import React from 'react';
import '@testing-library/jest-dom';
import { render, waitFor, cleanup } from '@testing-library/react';
import { describe, expect, it, afterEach } from 'vitest';
import MatrixIntake from '../../src/ui/masterPlan/MatrixIntake.jsx';
import { IdentityProvider, buildBlankIdentityState } from '../../src/state/identityStore.js';

// ACCEPTANCE (user's words): on the intake card, NOTHING is light grey. The
// live question is the largest, full-contrast (near-black), unmistakably-primary
// text. Example text is smaller but fully legible near-black. The framing
// eyebrow may be muted, but readable. This test asserts that VISUAL HIERARCHY
// (computed color/size/weight of the rendered nodes) — not the isFirstField
// mechanism. Gap 1 shipped with 6 green tests and the defect on screen because
// the tests asserted the mechanism, not this contrast property.

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
        goalContract: {
          goalId: 'goal-contrast-1',
          goalText: 'Secure $25k sponsorship commitments',
          startDayKey: '2026-03-12',
          deadline: { dayKey: '2026-06-30' },
        },
      },
    },
  };
}

// Parse a CSS color (jsdom normalizes inline hex to `rgb(r, g, b)`, but accept
// hex too) and return perceptual luminance 0..255 (higher = lighter).
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
  it('renders the live question as the largest, boldest, near-black element; nothing light grey', async () => {
    render(
      <IdentityProvider initialState={admittedGoalState()}>
        <MatrixIntake />
      </IdentityProvider>
    );

    const question = await waitFor(() => {
      const el = document.querySelector('[data-testid="intake-question"]');
      expect(el).toBeTruthy();
      expect(el.textContent.trim().length).toBeGreaterThan(0);
      return el;
    });

    const examples = document.querySelector('[data-testid="intake-examples"]');
    const framing = document.querySelector('[data-testid="intake-framing"]');
    expect(examples, 'entity-name probe should render example text to compare against').toBeTruthy();

    const qLum = luminance(question.style.color);
    const qSize = px(question.style.fontSize);
    const qWeight = weight(question.style.fontWeight);
    const eLum = luminance(examples.style.color);
    const eSize = px(examples.style.fontSize);
    const eWeight = weight(examples.style.fontWeight);

    // 1. The question must be near-black (full contrast on a light card),
    //    NOT the near-white/light-grey it ships as today.
    expect(qLum).not.toBeNull();
    expect(qLum).toBeLessThanOrEqual(70);

    // 2. Largest and boldest text on the card, strictly above the example text.
    expect(qSize).toBeGreaterThanOrEqual(16);
    expect(qSize).toBeGreaterThan(eSize);
    expect(qWeight).toBeGreaterThanOrEqual(700);
    expect(qWeight).toBeGreaterThan(eWeight);

    // 3. Example text is smaller but fully legible (dark, not light grey).
    expect(eLum).not.toBeNull();
    expect(eLum).toBeLessThanOrEqual(110);

    // 4. Framing eyebrow may be muted but must be readable (not near-white).
    if (framing) {
      const fLum = luminance(framing.style.color);
      expect(fLum).not.toBeNull();
      expect(fLum).toBeLessThanOrEqual(160);
    }

    // 5. Blanket "nothing light grey": none of the three card texts is near-white.
    for (const node of [question, examples, framing].filter(Boolean)) {
      const lum = luminance(node.style.color);
      expect(lum, `${node.getAttribute('data-testid')} is too light: ${node.style.color}`).toBeLessThan(170);
    }
  });
});
