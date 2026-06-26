import { describe, it, expect } from 'vitest';
import { evaluatePlanQualityGate } from './evaluatePlanQualityGate';

const GOAL = 'Build and launch SaaS product to $10k MRR in 12 months';
const VERIFY = 'MRR of $10,000 confirmed by Stripe dashboard';

function makeExecBlock(title: string, overrides: Record<string, unknown> = {}) {
  return {
    id: 'block-exec-1',
    title,
    deliverableId: 'deliv-1',
    blockType: 'action',
    owner: 'executor',
    durationMinutes: 60,
    producesArtifact: 'Authentication module with login/logout flow and token management',
    consumedBy: ['phase:P2'],
    consumedByRef: { type: 'phaseObjective', id: 'P2' },
    passEvidence: 'Auth flow tested end-to-end with integration test passing',
    phaseLabel: 'P1',
    dayKey: '2026-02-01',
    ...overrides,
  };
}

function makeReviewBlock(title: string) {
  return {
    id: 'block-review-1',
    title,
    deliverableId: 'deliv-1',
    blockType: 'review',
    owner: 'reviewer',
  };
}

function runGate(blocks: Record<string, unknown>[]) {
  return evaluatePlanQualityGate({
    goalText: GOAL,
    verificationText: VERIFY,
    proposedBlocks: blocks as any,
    committedBlocks: [],
  });
}

// ---------------------------------------------------------------------------
// FRAGMENTARY_BLOCK_TITLE: word count < 3
// ---------------------------------------------------------------------------

describe('Action Title: FRAGMENTARY_BLOCK_TITLE', () => {
  it('fails for a one-word title "Drop"', () => {
    const result = runGate([makeExecBlock('Drop')]);
    expect(result.failureCodes).toContain('FRAGMENTARY_BLOCK_TITLE');
    expect(result.status).toBe('PLAN_QUALITY_WITHHELD');
  });

  it('fails for a one-word title "Launch"', () => {
    const result = runGate([makeExecBlock('Launch')]);
    expect(result.failureCodes).toContain('FRAGMENTARY_BLOCK_TITLE');
  });

  it('fails for a two-word title "Validate offer"', () => {
    const result = runGate([makeExecBlock('Validate offer')]);
    expect(result.failureCodes).toContain('FRAGMENTARY_BLOCK_TITLE');
  });

  it('records the block id in fragmentaryBlockIds meta', () => {
    const result = runGate([makeExecBlock('Ship')]);
    expect(result.meta?.fragmentaryBlockIds).toContain('block-exec-1');
  });

  it('does not fail for a three-word title "Define the offer"', () => {
    const result = runGate([makeExecBlock('Define the offer')]);
    expect(result.failureCodes).not.toContain('FRAGMENTARY_BLOCK_TITLE');
  });
});

// ---------------------------------------------------------------------------
// QUESTION_BLOCK_TITLE: interrogative or question mark
// ---------------------------------------------------------------------------

describe('Action Title: QUESTION_BLOCK_TITLE', () => {
  it('fails for a title ending in "?"', () => {
    const result = runGate([makeExecBlock('What is the offer?')]);
    expect(result.failureCodes).toContain('QUESTION_BLOCK_TITLE');
    expect(result.status).toBe('PLAN_QUALITY_WITHHELD');
  });

  it('fails when title starts with "How"', () => {
    const result = runGate([makeExecBlock('How do we acquire beta users?')]);
    expect(result.failureCodes).toContain('QUESTION_BLOCK_TITLE');
  });

  it('fails when title starts with "Why"', () => {
    const result = runGate([makeExecBlock('Why is conversion low for this segment?')]);
    expect(result.failureCodes).toContain('QUESTION_BLOCK_TITLE');
  });

  it('fails when title starts with "Is" (yes/no question)', () => {
    const result = runGate([makeExecBlock('Is the beta ready for users?')]);
    expect(result.failureCodes).toContain('QUESTION_BLOCK_TITLE');
  });

  it('records the block id in questionBlockIds meta', () => {
    const result = runGate([makeExecBlock('What is the product roadmap?')]);
    expect(result.meta?.questionBlockIds).toContain('block-exec-1');
  });

  it('does not fire for a statement starting with "Define" that contains a question mark in body', () => {
    // Edge case: "Define offer scope (what? how much?)" — has "?" but is a statement with inline question
    // This SHOULD fire because it contains '?' — confirming the check is strict
    const result = runGate([makeExecBlock('Define offer scope for all pricing variants?')]);
    expect(result.failureCodes).toContain('QUESTION_BLOCK_TITLE');
  });
});

// ---------------------------------------------------------------------------
// NON_ACTIONABLE_BLOCK_TITLE: ≥3 words but first word is not an action verb
// ---------------------------------------------------------------------------

describe('Action Title: NON_ACTIONABLE_BLOCK_TITLE', () => {
  it('fails for "Album promo episodes" (bare noun phrase, no verb)', () => {
    const result = runGate([makeExecBlock('Album promo episodes for release')]);
    expect(result.failureCodes).toContain('NON_ACTIONABLE_BLOCK_TITLE');
    expect(result.status).toBe('PLAN_QUALITY_WITHHELD');
  });

  it('fails for "Beta user onboarding flow" (starts with noun)', () => {
    const result = runGate([makeExecBlock('Beta user onboarding flow complete')]);
    expect(result.failureCodes).toContain('NON_ACTIONABLE_BLOCK_TITLE');
  });

  it('fails for "Monthly revenue report from Stripe" (starts with adjective+noun)', () => {
    const result = runGate([makeExecBlock('Monthly revenue report from Stripe dashboard')]);
    expect(result.failureCodes).toContain('NON_ACTIONABLE_BLOCK_TITLE');
  });

  it('records the block id in nonActionableBlockIds meta', () => {
    const result = runGate([makeExecBlock('SaaS product launch event planning')]);
    expect(result.meta?.nonActionableBlockIds).toContain('block-exec-1');
  });

  it('does not fail for "Publish album release announcement across priority channels"', () => {
    const result = runGate([makeExecBlock('Publish album release announcement across priority channels')]);
    expect(result.failureCodes).not.toContain('NON_ACTIONABLE_BLOCK_TITLE');
  });

  it('does not fail for "Build beta onboarding issue log from first-user signup test"', () => {
    const result = runGate([makeExecBlock('Build beta onboarding issue log from first-user signup test')]);
    expect(result.failureCodes).not.toContain('NON_ACTIONABLE_BLOCK_TITLE');
  });

  it('does not fail for "Define paid acquisition test budget and stop-loss threshold"', () => {
    const result = runGate([makeExecBlock('Define paid acquisition test budget and stop-loss threshold')]);
    expect(result.failureCodes).not.toContain('NON_ACTIONABLE_BLOCK_TITLE');
  });
});

// ---------------------------------------------------------------------------
// Review/checkpoint blocks are exempt
// ---------------------------------------------------------------------------

describe('Action Title: review-class blocks are exempt from title checks', () => {
  it('does not fire title codes for a review block with one-word title', () => {
    const result = runGate([makeReviewBlock('Review')]);
    expect(result.failureCodes).not.toContain('FRAGMENTARY_BLOCK_TITLE');
    expect(result.failureCodes).not.toContain('NON_ACTIONABLE_BLOCK_TITLE');
    expect(result.failureCodes).not.toContain('QUESTION_BLOCK_TITLE');
  });

  it('does not fire for a terminal-readiness block with a noun-first title', () => {
    const block = {
      id: 'tr-1',
      title: 'Terminal evidence review window',
      deliverableId: 'deliv-1',
      blockType: 'terminal-readiness',
      owner: 'reviewer',
    };
    const result = runGate([block]);
    expect(result.failureCodes).not.toContain('NON_ACTIONABLE_BLOCK_TITLE');
  });
});

// ---------------------------------------------------------------------------
// Goal-level blocks are not checked
// ---------------------------------------------------------------------------

describe('Action Title: goal-level blocks without blockType are not checked', () => {
  it('does not fire title codes for a CORE goal-level block with one-word title', () => {
    const block = {
      id: 'goal-1',
      title: 'Work',
      deliverableId: 'deliv-1',
      kind: 'CORE',
      durationMinutes: 60,
    };
    const result = runGate([block]);
    expect(result.failureCodes).not.toContain('FRAGMENTARY_BLOCK_TITLE');
    expect(result.failureCodes).not.toContain('NON_ACTIONABLE_BLOCK_TITLE');
  });
});

// ---------------------------------------------------------------------------
// All good titles from generator format pass
// ---------------------------------------------------------------------------

describe('Action Title: generated full-horizon title patterns pass', () => {
  const GOOD_TITLES = [
    'Validate onboarding path for the app in P1 product/software lane using revenue focus for the Q1 2026 review window',
    'Define repeatable release cadence for the SaaS product in P2 product/software lane using conversion focus',
    'Package product proof for capital and institution review for the app using evidence focus for the Q3 2027 review window',
    'Assess product/software onboarding evidence against P2 conversion-readiness criteria for the app',
    'Confirm operating handoff readiness for the SaaS product in P3 product/software lane',
    'Build repeatable operating dashboard for the SaaS product tracking scale signals and owner accountability',
    'Stress-test audience-to-demand conversion for the media channel in P3 media/content lane',
    'Map credibility dependencies for the civic lane in P1 civic/district lane',
  ];

  GOOD_TITLES.forEach((title) => {
    it(`passes: "${title.slice(0, 60)}..."`, () => {
      const result = runGate([makeExecBlock(title)]);
      expect(result.failureCodes).not.toContain('FRAGMENTARY_BLOCK_TITLE');
      expect(result.failureCodes).not.toContain('QUESTION_BLOCK_TITLE');
      expect(result.failureCodes).not.toContain('NON_ACTIONABLE_BLOCK_TITLE');
    });
  });
});
