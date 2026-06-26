import { describe, it, expect } from 'vitest';
import { evaluatePlanQualityGate } from './evaluatePlanQualityGate';

const GOAL = 'Build and launch SaaS product to $10k MRR in 12 months';
const VERIFY = 'MRR of $10,000 confirmed by Stripe dashboard';

function makeExecBlock(overrides: Record<string, unknown> = {}) {
  return {
    id: 'block-exec-1',
    title: 'Build authentication module',
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

function makeReviewBlock() {
  return {
    id: 'block-review-1',
    title: 'Review authentication module',
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
// VAGUE_EXECUTION_ARTIFACT
// ---------------------------------------------------------------------------

describe('Artifact Specificity: VAGUE_EXECUTION_ARTIFACT', () => {
  it('fails when producesArtifact is "Work product matching expected output" (default fallback)', () => {
    const result = runGate([makeExecBlock({ producesArtifact: 'Work product matching expected output' })]);
    expect(result.failureCodes).toContain('VAGUE_EXECUTION_ARTIFACT');
    expect(result.status).toBe('PLAN_QUALITY_WITHHELD');
  });

  it('fails when producesArtifact is "Completed artifact matching expected output"', () => {
    const result = runGate([makeExecBlock({ producesArtifact: 'Completed artifact matching expected output' })]);
    expect(result.failureCodes).toContain('VAGUE_EXECUTION_ARTIFACT');
  });

  it('fails when producesArtifact is a single shell word "artifact"', () => {
    const result = runGate([makeExecBlock({ producesArtifact: 'artifact' })]);
    expect(result.failureCodes).toContain('VAGUE_EXECUTION_ARTIFACT');
  });

  it('fails when producesArtifact is "output"', () => {
    const result = runGate([makeExecBlock({ producesArtifact: 'output' })]);
    expect(result.failureCodes).toContain('VAGUE_EXECUTION_ARTIFACT');
  });

  it('fails when producesArtifact is "progress"', () => {
    const result = runGate([makeExecBlock({ producesArtifact: 'progress' })]);
    expect(result.failureCodes).toContain('VAGUE_EXECUTION_ARTIFACT');
  });

  it('fails when producesArtifact consists only of shell tokens (no substantive content)', () => {
    const result = runGate([makeExecBlock({ producesArtifact: 'strategy framework package' })]);
    expect(result.failureCodes).toContain('VAGUE_EXECUTION_ARTIFACT');
  });

  it('records the block id in vagueArtifactBlockIds meta', () => {
    const result = runGate([makeExecBlock({ producesArtifact: 'work product' })]);
    expect(result.meta?.vagueArtifactBlockIds).toContain('block-exec-1');
  });

  it('does not fire when producesArtifact is missing (MISSING_EXECUTION_ARTIFACT fires instead)', () => {
    const result = runGate([makeExecBlock({ producesArtifact: null })]);
    expect(result.failureCodes).toContain('MISSING_EXECUTION_ARTIFACT');
    expect(result.failureCodes).not.toContain('VAGUE_EXECUTION_ARTIFACT');
  });
});

// ---------------------------------------------------------------------------
// VAGUE_PASS_EVIDENCE
// ---------------------------------------------------------------------------

describe('Artifact Specificity: VAGUE_PASS_EVIDENCE', () => {
  it('fails when passEvidence is "Work product matching expected output"', () => {
    const result = runGate([makeExecBlock({ passEvidence: 'Work product matching expected output' })]);
    expect(result.failureCodes).toContain('VAGUE_PASS_EVIDENCE');
    expect(result.status).toBe('PLAN_QUALITY_WITHHELD');
  });

  it('fails when passEvidence is "done"', () => {
    const result = runGate([makeExecBlock({ passEvidence: 'done' })]);
    expect(result.failureCodes).toContain('VAGUE_PASS_EVIDENCE');
  });

  it('fails when passEvidence is "completed"', () => {
    const result = runGate([makeExecBlock({ passEvidence: 'completed' })]);
    expect(result.failureCodes).toContain('VAGUE_PASS_EVIDENCE');
  });

  it('fails when passEvidence is "assembled"', () => {
    const result = runGate([makeExecBlock({ passEvidence: 'assembled' })]);
    expect(result.failureCodes).toContain('VAGUE_PASS_EVIDENCE');
  });

  it('fails when passEvidence is "evidence exists"', () => {
    const result = runGate([makeExecBlock({ passEvidence: 'evidence exists' })]);
    expect(result.failureCodes).toContain('VAGUE_PASS_EVIDENCE');
  });

  it('fails when passEvidence consists only of shell tokens', () => {
    const result = runGate([makeExecBlock({ passEvidence: 'strategy framework' })]);
    expect(result.failureCodes).toContain('VAGUE_PASS_EVIDENCE');
  });

  it('records the block id in vagueEvidenceBlockIds meta', () => {
    const result = runGate([makeExecBlock({ passEvidence: 'done' })]);
    expect(result.meta?.vagueEvidenceBlockIds).toContain('block-exec-1');
  });

  it('does not fire when passEvidence is missing (MISSING_EXECUTION_PASS_EVIDENCE fires instead)', () => {
    const result = runGate([makeExecBlock({ passEvidence: null })]);
    expect(result.failureCodes).toContain('MISSING_EXECUTION_PASS_EVIDENCE');
    expect(result.failureCodes).not.toContain('VAGUE_PASS_EVIDENCE');
  });
});

// ---------------------------------------------------------------------------
// Specific values pass
// ---------------------------------------------------------------------------

describe('Artifact Specificity: specific values do not trigger vagueness codes', () => {
  it('passes when producesArtifact is a specific artifact with lane context', () => {
    const result = runGate([makeExecBlock({
      producesArtifact: 'Authentication module with login/logout flow and token management',
    })]);
    expect(result.failureCodes).not.toContain('VAGUE_EXECUTION_ARTIFACT');
  });

  it('passes when producesArtifact is "launch-proof packet" (family-specific artifact label)', () => {
    const result = runGate([makeExecBlock({ producesArtifact: 'launch-proof packet' })]);
    expect(result.failureCodes).not.toContain('VAGUE_EXECUTION_ARTIFACT');
  });

  it('passes when producesArtifact is "conversion operating brief" (2+ non-shell tokens)', () => {
    const result = runGate([makeExecBlock({ producesArtifact: 'conversion operating brief' })]);
    expect(result.failureCodes).not.toContain('VAGUE_EXECUTION_ARTIFACT');
  });

  it('passes when producesArtifact is "Release cadence standard with owner and review rhythm"', () => {
    const result = runGate([makeExecBlock({
      producesArtifact: 'Release cadence standard with owner and review rhythm',
    })]);
    expect(result.failureCodes).not.toContain('VAGUE_EXECUTION_ARTIFACT');
  });

  it('passes when passEvidence is "Validation result with evidence collected and criteria checked"', () => {
    const result = runGate([makeExecBlock({
      passEvidence: 'Validation result with evidence collected and criteria checked',
    })]);
    expect(result.failureCodes).not.toContain('VAGUE_PASS_EVIDENCE');
  });

  it('passes when passEvidence is "Readiness checklist with binary go/no-go decision"', () => {
    const result = runGate([makeExecBlock({
      passEvidence: 'Readiness checklist with binary go/no-go decision',
    })]);
    expect(result.failureCodes).not.toContain('VAGUE_PASS_EVIDENCE');
  });

  it('passes when passEvidence is specific descriptor expectedOutput with measurable content', () => {
    const result = runGate([makeExecBlock({
      passEvidence: 'P1 proof sequence with ordered milestones, dependencies, and completion criteria for each phase goal',
    })]);
    expect(result.failureCodes).not.toContain('VAGUE_PASS_EVIDENCE');
  });
});

// ---------------------------------------------------------------------------
// Review/checkpoint blocks are exempt
// ---------------------------------------------------------------------------

describe('Artifact Specificity: review-class blocks are exempt', () => {
  it('does not fire vagueness codes for a review block with no artifact fields', () => {
    const result = runGate([makeReviewBlock()]);
    expect(result.failureCodes).not.toContain('VAGUE_EXECUTION_ARTIFACT');
    expect(result.failureCodes).not.toContain('VAGUE_PASS_EVIDENCE');
  });

  it('does not fire for a terminal-readiness block', () => {
    const block = {
      id: 'tr-1',
      title: 'Terminal readiness review',
      deliverableId: 'deliv-1',
      blockType: 'terminal-readiness',
      owner: 'reviewer',
      producesArtifact: 'evidence package',
      passEvidence: 'done',
    };
    const result = runGate([block]);
    expect(result.failureCodes).not.toContain('VAGUE_EXECUTION_ARTIFACT');
    expect(result.failureCodes).not.toContain('VAGUE_PASS_EVIDENCE');
  });
});

// ---------------------------------------------------------------------------
// Goal-level blocks (no blockType) are not checked
// ---------------------------------------------------------------------------

describe('Artifact Specificity: goal-level blocks without blockType are not checked', () => {
  it('does not fire for a CORE goal-level block with vague artifact text', () => {
    const block = {
      id: 'goal-1',
      title: 'Build feature',
      deliverableId: 'deliv-1',
      kind: 'CORE',
      durationMinutes: 60,
      producesArtifact: 'output',
      passEvidence: 'done',
    };
    const result = runGate([block]);
    expect(result.failureCodes).not.toContain('VAGUE_EXECUTION_ARTIFACT');
    expect(result.failureCodes).not.toContain('VAGUE_PASS_EVIDENCE');
  });
});
