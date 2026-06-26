import { describe, it, expect } from 'vitest';
import { evaluatePlanQualityGate } from './evaluatePlanQualityGate';

const GOAL_TEXT = 'Build and launch a SaaS product to $10k MRR in 12 months';
const VERIFICATION_TEXT = 'Monthly recurring revenue reaches $10,000 confirmed by Stripe dashboard';

function makeExecBlock(overrides: Record<string, unknown> = {}) {
  return {
    id: 'block-exec-1',
    title: 'Build authentication module',
    deliverableId: 'deliv-1',
    blockType: 'action',
    owner: 'executor',
    durationMinutes: 60,
    producesArtifact: 'Authentication module with login/logout flow',
    consumedBy: ['phase:P2'],
    passEvidence: 'Auth flow tested end-to-end',
    consumedByRef: { type: 'phaseObjective', id: 'P2' },
    phaseLabel: 'P1',
    ...overrides,
  };
}

function makeReviewBlock(overrides: Record<string, unknown> = {}) {
  return {
    id: 'block-review-1',
    title: 'Review authentication module',
    deliverableId: 'deliv-1',
    blockType: 'review',
    owner: 'reviewer',
    ...overrides,
  };
}

function runGate(blocks: Record<string, unknown>[]) {
  return evaluatePlanQualityGate({
    goalText: GOAL_TEXT,
    verificationText: VERIFICATION_TEXT,
    proposedBlocks: blocks as any,
    committedBlocks: [],
  });
}

// ---------------------------------------------------------------------------
// MISSING_CONSUMED_BY_REF
// ---------------------------------------------------------------------------

describe('Dependency Chain: MISSING_CONSUMED_BY_REF', () => {
  it('fails when execution block has no consumedByRef', () => {
    const result = runGate([makeExecBlock({ consumedByRef: null })]);
    expect(result.failureCodes).toContain('MISSING_CONSUMED_BY_REF');
    expect(result.status).toBe('PLAN_QUALITY_WITHHELD');
  });

  it('fails when consumedByRef id is empty string', () => {
    const result = runGate([makeExecBlock({ consumedByRef: { type: 'phaseObjective', id: '' } })]);
    expect(result.failureCodes).toContain('MISSING_CONSUMED_BY_REF');
  });

  it('fails when consumedByRef id is the vague label "plan"', () => {
    const result = runGate([makeExecBlock({ consumedByRef: { type: 'block', id: 'plan' } })]);
    expect(result.failureCodes).toContain('MISSING_CONSUMED_BY_REF');
  });

  it('fails when consumedByRef id is "downstream"', () => {
    const result = runGate([makeExecBlock({ consumedByRef: { type: 'block', id: 'downstream' } })]);
    expect(result.failureCodes).toContain('MISSING_CONSUMED_BY_REF');
  });

  it('fails when consumedByRef id is "unknown" (lane ID fallback)', () => {
    const result = runGate([makeExecBlock({ consumedByRef: { type: 'terminalOutcome', id: 'unknown' } })]);
    expect(result.failureCodes).toContain('MISSING_CONSUMED_BY_REF');
  });

  it('records the block id in consumedByRefMissingBlockIds meta', () => {
    const result = runGate([makeExecBlock({ consumedByRef: null })]);
    expect(result.meta?.consumedByRefMissingBlockIds).toContain('block-exec-1');
  });
});

// ---------------------------------------------------------------------------
// UNRESOLVED_CONSUMED_BY_REF
// ---------------------------------------------------------------------------

describe('Dependency Chain: UNRESOLVED_CONSUMED_BY_REF', () => {
  it('fails when phaseObjective type has an unknown phase id', () => {
    const result = runGate([makeExecBlock({ consumedByRef: { type: 'phaseObjective', id: 'P99' } })]);
    expect(result.failureCodes).toContain('UNRESOLVED_CONSUMED_BY_REF');
    expect(result.status).toBe('PLAN_QUALITY_WITHHELD');
  });

  it('fails when phaseObjective type has a freeform id not matching P1/P2/P3', () => {
    const result = runGate([makeExecBlock({ consumedByRef: { type: 'phaseObjective', id: 'phase-four' } })]);
    expect(result.failureCodes).toContain('UNRESOLVED_CONSUMED_BY_REF');
  });

  it('records the block id in consumedByRefUnresolvedBlockIds meta', () => {
    const result = runGate([makeExecBlock({ consumedByRef: { type: 'phaseObjective', id: 'BOGUS' } })]);
    expect(result.meta?.consumedByRefUnresolvedBlockIds).toContain('block-exec-1');
  });
});

// ---------------------------------------------------------------------------
// NON_DOWNSTREAM_CONSUMED_BY_REF
// ---------------------------------------------------------------------------

describe('Dependency Chain: NON_DOWNSTREAM_CONSUMED_BY_REF', () => {
  it('fails when a P1 block references P1 (same phase) as its consumer', () => {
    const result = runGate([makeExecBlock({
      consumedByRef: { type: 'phaseObjective', id: 'P1' },
      phaseLabel: 'P1',
    })]);
    expect(result.failureCodes).toContain('NON_DOWNSTREAM_CONSUMED_BY_REF');
    expect(result.status).toBe('PLAN_QUALITY_WITHHELD');
  });

  it('fails when a P2 block references P1 as its consumer', () => {
    const result = runGate([makeExecBlock({
      consumedByRef: { type: 'phaseObjective', id: 'P1' },
      phaseLabel: 'P2',
    })]);
    expect(result.failureCodes).toContain('NON_DOWNSTREAM_CONSUMED_BY_REF');
  });

  it('fails when a P3 block references P2 as its consumer', () => {
    const result = runGate([makeExecBlock({
      consumedByRef: { type: 'phaseObjective', id: 'P2' },
      phaseLabel: 'P3',
    })]);
    expect(result.failureCodes).toContain('NON_DOWNSTREAM_CONSUMED_BY_REF');
  });

  it('records the block id in consumedByRefNonDownstreamBlockIds meta', () => {
    const result = runGate([makeExecBlock({
      consumedByRef: { type: 'phaseObjective', id: 'P1' },
      phaseLabel: 'P2',
    })]);
    expect(result.meta?.consumedByRefNonDownstreamBlockIds).toContain('block-exec-1');
  });
});

// ---------------------------------------------------------------------------
// Passing cases
// ---------------------------------------------------------------------------

describe('Dependency Chain: valid downstream references pass', () => {
  it('passes when a P1 block references P2 as phaseObjective consumer', () => {
    const result = runGate([makeExecBlock({
      consumedByRef: { type: 'phaseObjective', id: 'P2' },
      phaseLabel: 'P1',
    })]);
    expect(result.failureCodes).not.toContain('MISSING_CONSUMED_BY_REF');
    expect(result.failureCodes).not.toContain('UNRESOLVED_CONSUMED_BY_REF');
    expect(result.failureCodes).not.toContain('NON_DOWNSTREAM_CONSUMED_BY_REF');
  });

  it('passes when a P2 block references P3 as phaseObjective consumer', () => {
    const result = runGate([makeExecBlock({
      consumedByRef: { type: 'phaseObjective', id: 'P3' },
      phaseLabel: 'P2',
    })]);
    expect(result.failureCodes).not.toContain('MISSING_CONSUMED_BY_REF');
    expect(result.failureCodes).not.toContain('UNRESOLVED_CONSUMED_BY_REF');
    expect(result.failureCodes).not.toContain('NON_DOWNSTREAM_CONSUMED_BY_REF');
  });

  it('passes when a P3 block references terminalOutcome with a real lane id', () => {
    const result = runGate([makeExecBlock({
      consumedByRef: { type: 'terminalOutcome', id: 'lane-saas' },
      phaseLabel: 'P3',
      consumedBy: ['terminal-review:lane-saas'],
    })]);
    expect(result.failureCodes).not.toContain('MISSING_CONSUMED_BY_REF');
    expect(result.failureCodes).not.toContain('UNRESOLVED_CONSUMED_BY_REF');
    expect(result.failureCodes).not.toContain('NON_DOWNSTREAM_CONSUMED_BY_REF');
  });

  it('passes when a block references laneOutcome with a non-unknown id', () => {
    const result = runGate([makeExecBlock({
      consumedByRef: { type: 'laneOutcome', id: 'lane-saas:conversion-readiness' },
      phaseLabel: 'P1',
    })]);
    expect(result.failureCodes).not.toContain('MISSING_CONSUMED_BY_REF');
    expect(result.failureCodes).not.toContain('UNRESOLVED_CONSUMED_BY_REF');
    expect(result.failureCodes).not.toContain('NON_DOWNSTREAM_CONSUMED_BY_REF');
  });

  it('does not apply dependency chain check to review/audit/checkpoint blocks', () => {
    const result = runGate([makeReviewBlock({ consumedByRef: null })]);
    expect(result.failureCodes).not.toContain('MISSING_CONSUMED_BY_REF');
    expect(result.failureCodes).not.toContain('UNRESOLVED_CONSUMED_BY_REF');
    expect(result.failureCodes).not.toContain('NON_DOWNSTREAM_CONSUMED_BY_REF');
  });

  it('does not apply dependency chain check to goal-level blocks with no blockType', () => {
    const goalBlock = {
      id: 'goal-block-1',
      title: 'Build feature',
      deliverableId: 'deliv-1',
      kind: 'CORE',
      durationMinutes: 60,
      // no blockType, no consumedByRef
    };
    const result = runGate([goalBlock]);
    expect(result.failureCodes).not.toContain('MISSING_CONSUMED_BY_REF');
  });
});
