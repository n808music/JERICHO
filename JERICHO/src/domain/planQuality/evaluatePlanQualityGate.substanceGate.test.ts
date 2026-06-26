import { describe, expect, it } from 'vitest';
import { evaluatePlanQualityGate } from './evaluatePlanQualityGate';

// ---------------------------------------------------------------------------
// Minimal fixtures
// ---------------------------------------------------------------------------

const GOAL_TEXT = 'Build and launch a SaaS product to $10k MRR in 12 months';
const VERIFICATION_TEXT = 'Monthly recurring revenue reaches $10,000 as confirmed by Stripe dashboard';

const BASE_DELIVERABLE = { id: 'deliv-1', title: 'Core SaaS product shipped and generating revenue' };
const BASE_ACTION = { id: 'act-1', title: 'Build and ship SaaS product', deliverableId: 'deliv-1' };

function makeExecutionBlock(overrides: Record<string, unknown> = {}) {
  return {
    id: 'block-exec-1',
    title: 'Build authentication module',
    deliverableId: 'deliv-1',
    actionId: 'act-1',
    blockType: 'action',
    owner: 'executor',
    durationMinutes: 60,
    producesArtifact: 'Authentication module with login/logout flow',
    consumedBy: ['phase:P2'],
    passEvidence: 'Auth flow tested end-to-end with passing integration test',
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

function makeAuditBlock(overrides: Record<string, unknown> = {}) {
  return {
    id: 'block-audit-1',
    title: 'Audit codebase for security gaps',
    deliverableId: 'deliv-1',
    blockType: 'audit',
    owner: 'reviewer',
    ...overrides,
  };
}

function makeCheckpointBlock(overrides: Record<string, unknown> = {}) {
  return {
    id: 'block-checkpoint-1',
    title: 'Q1 progress checkpoint',
    deliverableId: 'deliv-1',
    blockType: 'checkpoint',
    ...overrides,
  };
}

function makeGoalLevelBlock(kind: 'PLANNING' | 'CORE' | 'VERIFICATION', overrides: Record<string, unknown> = {}) {
  return {
    id: `block-goal-${kind.toLowerCase()}`,
    title: `Goal-level ${kind} block`,
    deliverableId: 'deliv-1',
    kind,
    durationMinutes: 60,
    ...overrides,
  };
}

function runGate(blocks: Record<string, unknown>[], additionalBlocks: Record<string, unknown>[] = []) {
  return evaluatePlanQualityGate({
    goalText: GOAL_TEXT,
    verificationText: VERIFICATION_TEXT,
    deliverables: [BASE_DELIVERABLE],
    actions: [BASE_ACTION],
    proposedBlocks: [...blocks, ...additionalBlocks] as any,
    committedBlocks: [],
  });
}

// ---------------------------------------------------------------------------
// Plan Substance Gate — individual field checks
// ---------------------------------------------------------------------------

describe('Plan Substance Gate: missing substrate fields on execution blocks', () => {
  it('fails MISSING_EXECUTION_OWNER when a non-review block has no owner', () => {
    const result = runGate([makeExecutionBlock({ owner: null })]);
    expect(result.failureCodes).toContain('MISSING_EXECUTION_OWNER');
    expect(result.status).toBe('PLAN_QUALITY_WITHHELD');
  });

  it('fails MISSING_EXECUTION_OWNER when owner is empty string', () => {
    const result = runGate([makeExecutionBlock({ owner: '' })]);
    expect(result.failureCodes).toContain('MISSING_EXECUTION_OWNER');
  });

  it('fails MISSING_EXECUTION_DURATION when durationMinutes is 0', () => {
    const result = runGate([makeExecutionBlock({ durationMinutes: 0 })]);
    expect(result.failureCodes).toContain('MISSING_EXECUTION_DURATION');
    expect(result.status).toBe('PLAN_QUALITY_WITHHELD');
  });

  it('fails MISSING_EXECUTION_DURATION when durationMinutes is null', () => {
    const result = runGate([makeExecutionBlock({ durationMinutes: null })]);
    expect(result.failureCodes).toContain('MISSING_EXECUTION_DURATION');
  });

  it('fails MISSING_EXECUTION_ARTIFACT when producesArtifact is missing', () => {
    const result = runGate([makeExecutionBlock({ producesArtifact: null })]);
    expect(result.failureCodes).toContain('MISSING_EXECUTION_ARTIFACT');
    expect(result.status).toBe('PLAN_QUALITY_WITHHELD');
  });

  it('fails MISSING_EXECUTION_ARTIFACT when producesArtifact is empty string', () => {
    const result = runGate([makeExecutionBlock({ producesArtifact: '' })]);
    expect(result.failureCodes).toContain('MISSING_EXECUTION_ARTIFACT');
  });

  it('fails MISSING_EXECUTION_CONSUMER when consumedBy is empty array', () => {
    const result = runGate([makeExecutionBlock({ consumedBy: [] })]);
    expect(result.failureCodes).toContain('MISSING_EXECUTION_CONSUMER');
    expect(result.status).toBe('PLAN_QUALITY_WITHHELD');
  });

  it('fails MISSING_EXECUTION_CONSUMER when consumedBy is null', () => {
    const result = runGate([makeExecutionBlock({ consumedBy: null })]);
    expect(result.failureCodes).toContain('MISSING_EXECUTION_CONSUMER');
  });

  it('fails MISSING_EXECUTION_PASS_EVIDENCE when passEvidence is missing', () => {
    const result = runGate([makeExecutionBlock({ passEvidence: null })]);
    expect(result.failureCodes).toContain('MISSING_EXECUTION_PASS_EVIDENCE');
    expect(result.status).toBe('PLAN_QUALITY_WITHHELD');
  });

  it('fails MISSING_EXECUTION_PASS_EVIDENCE when passEvidence is empty string', () => {
    const result = runGate([makeExecutionBlock({ passEvidence: '' })]);
    expect(result.failureCodes).toContain('MISSING_EXECUTION_PASS_EVIDENCE');
  });

  it('reports substanceMissingBlockIds in meta for failing blocks', () => {
    const result = runGate([makeExecutionBlock({ owner: null, passEvidence: null })]);
    expect(result.meta?.substanceMissingBlockIds).toContain('block-exec-1');
  });
});

// ---------------------------------------------------------------------------
// Plan Substance Gate — review/audit/checkpoint blocks are exempt
// ---------------------------------------------------------------------------

describe('Plan Substance Gate: review-class blocks exempt from substrate requirements', () => {
  it('does not fail for a review block missing all substrate fields', () => {
    const result = runGate([makeReviewBlock()]);
    expect(result.failureCodes).not.toContain('MISSING_EXECUTION_OWNER');
    expect(result.failureCodes).not.toContain('MISSING_EXECUTION_DURATION');
    expect(result.failureCodes).not.toContain('MISSING_EXECUTION_ARTIFACT');
    expect(result.failureCodes).not.toContain('MISSING_EXECUTION_CONSUMER');
    expect(result.failureCodes).not.toContain('MISSING_EXECUTION_PASS_EVIDENCE');
  });

  it('does not fail for an audit block missing substrate fields', () => {
    const result = runGate([makeAuditBlock()]);
    expect(result.failureCodes).not.toContain('MISSING_EXECUTION_OWNER');
    expect(result.failureCodes).not.toContain('MISSING_EXECUTION_ARTIFACT');
  });

  it('does not fail for a checkpoint block missing substrate fields', () => {
    const result = runGate([makeCheckpointBlock()]);
    expect(result.failureCodes).not.toContain('MISSING_EXECUTION_OWNER');
    expect(result.failureCodes).not.toContain('MISSING_EXECUTION_ARTIFACT');
  });

  it('does not fail for a terminal-review block missing substrate fields', () => {
    const block = makeReviewBlock({ id: 'tr-1', blockType: 'terminal-review', owner: 'reviewer' });
    const result = runGate([block]);
    expect(result.failureCodes).not.toContain('MISSING_EXECUTION_OWNER');
    expect(result.failureCodes).not.toContain('MISSING_EXECUTION_ARTIFACT');
  });

  it('does not fail for a gate block missing substrate fields', () => {
    const block = { id: 'gate-1', title: 'P1 exit gate', deliverableId: 'deliv-1', blockType: 'gate', owner: 'system' };
    const result = runGate([block]);
    expect(result.failureCodes).not.toContain('MISSING_EXECUTION_OWNER');
    expect(result.failureCodes).not.toContain('MISSING_EXECUTION_ARTIFACT');
  });

  it('does not fail for a goal-level VERIFICATION block missing substrate fields', () => {
    const block = makeGoalLevelBlock('VERIFICATION');
    const result = runGate([block]);
    expect(result.failureCodes).not.toContain('MISSING_EXECUTION_OWNER');
    expect(result.failureCodes).not.toContain('MISSING_EXECUTION_ARTIFACT');
  });
});

// ---------------------------------------------------------------------------
// Plan Substance Gate — valid execution blocks pass
// ---------------------------------------------------------------------------

describe('Plan Substance Gate: valid execution blocks do not trigger substance failures', () => {
  it('does not add substance failure codes when execution block has all required fields', () => {
    const result = runGate([makeExecutionBlock()]);
    expect(result.failureCodes).not.toContain('MISSING_EXECUTION_OWNER');
    expect(result.failureCodes).not.toContain('MISSING_EXECUTION_DURATION');
    expect(result.failureCodes).not.toContain('MISSING_EXECUTION_ARTIFACT');
    expect(result.failureCodes).not.toContain('MISSING_EXECUTION_CONSUMER');
    expect(result.failureCodes).not.toContain('MISSING_EXECUTION_PASS_EVIDENCE');
    expect(result.failureCodes).not.toContain('MONITORING_WITHOUT_PRODUCTION');
  });

  it('does not add substance failure codes for goal-level PLANNING block (no blockType, exempt from field check)', () => {
    const block = makeGoalLevelBlock('PLANNING');
    const result = runGate([block]);
    expect(result.failureCodes).not.toContain('MISSING_EXECUTION_OWNER');
    expect(result.failureCodes).not.toContain('MISSING_EXECUTION_ARTIFACT');
    expect(result.failureCodes).not.toContain('MONITORING_WITHOUT_PRODUCTION');
  });
});

// ---------------------------------------------------------------------------
// MONITORING_WITHOUT_PRODUCTION ratio check
// ---------------------------------------------------------------------------

describe('MONITORING_WITHOUT_PRODUCTION: majority review-class blocks', () => {
  it('fails when more than 50% of classified blocks are review-class (3+ blocks)', () => {
    // 2 review blocks + 1 execution block = 67% review
    const result = runGate([
      makeReviewBlock({ id: 'r1' }),
      makeAuditBlock({ id: 'r2' }),
      makeExecutionBlock({ id: 'e1' }),
    ]);
    expect(result.failureCodes).toContain('MONITORING_WITHOUT_PRODUCTION');
    expect(result.status).toBe('PLAN_QUALITY_WITHHELD');
  });

  it('fails at exactly >50% threshold: 3 review + 2 execution = 60% review', () => {
    const result = runGate([
      makeReviewBlock({ id: 'r1' }),
      makeReviewBlock({ id: 'r2', blockType: 'review' }),
      makeReviewBlock({ id: 'r3', blockType: 'terminal-review' }),
      makeExecutionBlock({ id: 'e1' }),
      makeExecutionBlock({ id: 'e2', consumedBy: ['phase:P2'] }),
    ]);
    expect(result.failureCodes).toContain('MONITORING_WITHOUT_PRODUCTION');
  });

  it('does not fail when exactly 50% are review-class (not strictly >50%)', () => {
    // 2 review + 2 execution = exactly 50% — should NOT trigger
    const result = runGate([
      makeReviewBlock({ id: 'r1' }),
      makeAuditBlock({ id: 'r2' }),
      makeExecutionBlock({ id: 'e1' }),
      makeExecutionBlock({ id: 'e2', consumedBy: ['phase:P2'] }),
    ]);
    expect(result.failureCodes).not.toContain('MONITORING_WITHOUT_PRODUCTION');
  });

  it('does not fail when execution blocks dominate (< 50% review)', () => {
    const result = runGate([
      makeExecutionBlock({ id: 'e1' }),
      makeExecutionBlock({ id: 'e2', consumedBy: ['phase:P2'] }),
      makeReviewBlock({ id: 'r1' }),
    ]);
    expect(result.failureCodes).not.toContain('MONITORING_WITHOUT_PRODUCTION');
  });

  it('does not fire MONITORING_WITHOUT_PRODUCTION for fewer than 3 classified blocks', () => {
    // Only 2 blocks: 1 review + 1 execution — below minimum for ratio check
    const result = runGate([makeReviewBlock({ id: 'r1' }), makeExecutionBlock({ id: 'e1' })]);
    expect(result.failureCodes).not.toContain('MONITORING_WITHOUT_PRODUCTION');
  });

  it('fires for plans with all review blocks and no execution', () => {
    const result = runGate([
      makeReviewBlock({ id: 'r1' }),
      makeAuditBlock({ id: 'r2' }),
      makeCheckpointBlock({ id: 'r3' }),
    ]);
    expect(result.failureCodes).toContain('MONITORING_WITHOUT_PRODUCTION');
  });

  it('uses VERIFICATION kind blocks as review-class for goal-level plans', () => {
    // 2 VERIFICATION + 1 CORE = 67% review via kind proxy
    const result = runGate([
      makeGoalLevelBlock('VERIFICATION', { id: 'v1' }),
      makeGoalLevelBlock('VERIFICATION', { id: 'v2' }),
      makeGoalLevelBlock('CORE', { id: 'c1' }),
    ]);
    expect(result.failureCodes).toContain('MONITORING_WITHOUT_PRODUCTION');
  });
});
