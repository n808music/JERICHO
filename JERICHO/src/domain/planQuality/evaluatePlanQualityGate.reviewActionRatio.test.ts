/**
 * Plan quality gate enforces review/audit/validation discipline — every
 * review-class block must reference a prior produced artifact, and the
 * review:action ratio per (lane, phase) must remain defensible
 * (Phase 6 — Execution Professionalism Remediation).
 */
import { describe, expect, it } from 'vitest';

import { evaluatePlanQualityGate } from './evaluatePlanQualityGate.ts';

function baseInput(proposedBlocks: unknown[]) {
  return {
    goalText: 'goal',
    deliverables: [],
    actions: [],
    proposedBlocks,
    committedBlocks: [],
  } as Parameters<typeof evaluatePlanQualityGate>[0];
}

function actionBlock(overrides: Record<string, unknown> = {}) {
  return {
    id: 'a-1',
    blockType: 'action',
    title: 'Ship deliverable artifact',
    dayKey: '2026-06-01',
    phaseLabel: 'P1',
    laneId: 'lane-x',
    owner: 'product_owner',
    durationMinutes: 60,
    producesArtifact: 'Deliverable artifact ready',
    consumedBy: ['phase:P2'],
    consumedByRef: { type: 'phaseObjective', id: 'P2' },
    passEvidence: 'Deliverable shipped and recorded',
    executionContext: { laneFamily: 'product_software', laneStatus: 'active' },
    ...overrides,
  };
}

function reviewBlock(overrides: Record<string, unknown> = {}) {
  return {
    id: 'r-1',
    blockType: 'review',
    title: 'Review prior deliverable artifact',
    dayKey: '2026-06-08',
    phaseLabel: 'P1',
    laneId: 'lane-x',
    owner: 'reviewer',
    durationMinutes: 60,
    producesArtifact: 'Review note',
    consumedBy: ['phase:P2'],
    consumedByRef: { type: 'phaseObjective', id: 'P2' },
    passEvidence: 'Written review with pass/fail determination and evidence summary',
    executionContext: { laneFamily: 'product_software', laneStatus: 'active' },
    ...overrides,
  };
}

describe('plan quality gate — REVIEW_WITHOUT_PRIOR_ARTIFACT', () => {
  it('fires when a review block has no evidenceRequired pointer to upstream work', () => {
    const blocks = [actionBlock(), reviewBlock({ evidenceRequired: null })];
    const result = evaluatePlanQualityGate(baseInput(blocks));
    expect(result.failureCodes).toContain('REVIEW_WITHOUT_PRIOR_ARTIFACT');
  });

  it('does NOT fire when the review declares evidenceRequired', () => {
    const blocks = [
      actionBlock(),
      reviewBlock({ evidenceRequired: 'Shipped deliverable artifact log from prior cycle' }),
    ];
    const result = evaluatePlanQualityGate(baseInput(blocks));
    expect(result.failureCodes).not.toContain('REVIEW_WITHOUT_PRIOR_ARTIFACT');
  });

  it('also fires on audit blocks without evidenceRequired', () => {
    const blocks = [
      actionBlock(),
      reviewBlock({ id: 'a-1', blockType: 'audit', evidenceRequired: null, title: 'Audit X' }),
    ];
    const result = evaluatePlanQualityGate(baseInput(blocks));
    expect(result.failureCodes).toContain('REVIEW_WITHOUT_PRIOR_ARTIFACT');
  });

  it('also fires on validation blocks without evidenceRequired', () => {
    const blocks = [
      actionBlock(),
      reviewBlock({ id: 'v-1', blockType: 'validation', evidenceRequired: '', title: 'Validate X' }),
    ];
    const result = evaluatePlanQualityGate(baseInput(blocks));
    expect(result.failureCodes).toContain('REVIEW_WITHOUT_PRIOR_ARTIFACT');
  });

  it('does NOT fire on action blocks (only review-class blocks are checked)', () => {
    const blocks = [actionBlock({ evidenceRequired: null })];
    const result = evaluatePlanQualityGate(baseInput(blocks));
    expect(result.failureCodes).not.toContain('REVIEW_WITHOUT_PRIOR_ARTIFACT');
  });
});

describe('plan quality gate — EXCESSIVE_REVIEW_AUDIT_RATIO', () => {
  it('fires when P1 has more review-class blocks than action-class blocks', () => {
    const blocks = [
      actionBlock({ id: 'a-1', dayKey: '2026-06-01' }),
      reviewBlock({ id: 'r-1', dayKey: '2026-06-08', evidenceRequired: 'evidence' }),
      reviewBlock({ id: 'r-2', dayKey: '2026-06-15', evidenceRequired: 'evidence' }),
      reviewBlock({ id: 'r-3', dayKey: '2026-06-22', evidenceRequired: 'evidence' }),
      reviewBlock({ id: 'r-4', dayKey: '2026-06-29', evidenceRequired: 'evidence' }),
    ];
    const result = evaluatePlanQualityGate(baseInput(blocks));
    expect(result.failureCodes).toContain('EXCESSIVE_REVIEW_AUDIT_RATIO');
  });

  it('does NOT fire when P1 is action-heavy (2:1 or better action:review)', () => {
    const blocks = [
      actionBlock({ id: 'a-1', dayKey: '2026-06-01' }),
      actionBlock({ id: 'a-2', dayKey: '2026-06-08' }),
      actionBlock({ id: 'a-3', dayKey: '2026-06-15' }),
      actionBlock({ id: 'a-4', dayKey: '2026-06-22' }),
      reviewBlock({ id: 'r-1', dayKey: '2026-06-29', evidenceRequired: 'evidence' }),
    ];
    const result = evaluatePlanQualityGate(baseInput(blocks));
    expect(result.failureCodes).not.toContain('EXCESSIVE_REVIEW_AUDIT_RATIO');
  });

  it('does NOT fire on gated/incubating lanes (allowed to be readiness-heavy)', () => {
    const blocks = [
      reviewBlock({ id: 'r-1', dayKey: '2026-06-08', evidenceRequired: 'ev', executionContext: { laneFamily: 'capital_real_estate', laneStatus: 'gated' } }),
      reviewBlock({ id: 'r-2', dayKey: '2026-06-15', evidenceRequired: 'ev', executionContext: { laneFamily: 'capital_real_estate', laneStatus: 'gated' } }),
      reviewBlock({ id: 'r-3', dayKey: '2026-06-22', evidenceRequired: 'ev', executionContext: { laneFamily: 'capital_real_estate', laneStatus: 'gated' } }),
      reviewBlock({ id: 'r-4', dayKey: '2026-06-29', evidenceRequired: 'ev', executionContext: { laneFamily: 'capital_real_estate', laneStatus: 'gated' } }),
    ];
    const result = evaluatePlanQualityGate(baseInput(blocks));
    expect(result.failureCodes).not.toContain('EXCESSIVE_REVIEW_AUDIT_RATIO');
  });
});

describe('plan quality gate — MECHANICAL_CADENCE_LOOP', () => {
  it('fires when 4+ review-class blocks in a (lane, phase) share the same titleFamily', () => {
    const blocks = [
      actionBlock({ id: 'a-1', dayKey: '2026-06-01' }),
      reviewBlock({ id: 'r-1', dayKey: '2026-06-08', evidenceRequired: 'e', titleFamily: 'p1_loop_check' }),
      reviewBlock({ id: 'r-2', dayKey: '2026-06-15', evidenceRequired: 'e', titleFamily: 'p1_loop_check' }),
      reviewBlock({ id: 'r-3', dayKey: '2026-06-22', evidenceRequired: 'e', titleFamily: 'p1_loop_check' }),
      reviewBlock({ id: 'r-4', dayKey: '2026-06-29', evidenceRequired: 'e', titleFamily: 'p1_loop_check' }),
    ];
    const result = evaluatePlanQualityGate(baseInput(blocks));
    expect(result.failureCodes).toContain('MECHANICAL_CADENCE_LOOP');
  });

  it('does NOT fire when action blocks interleave the review-class blocks', () => {
    const blocks = [
      actionBlock({ id: 'a-1', dayKey: '2026-06-01' }),
      reviewBlock({ id: 'r-1', dayKey: '2026-06-08', evidenceRequired: 'e', titleFamily: 'fam-a' }),
      actionBlock({ id: 'a-2', dayKey: '2026-06-12' }),
      reviewBlock({ id: 'r-2', dayKey: '2026-06-15', evidenceRequired: 'e', titleFamily: 'fam-b' }),
      actionBlock({ id: 'a-3', dayKey: '2026-06-19' }),
      reviewBlock({ id: 'r-3', dayKey: '2026-06-22', evidenceRequired: 'e', titleFamily: 'fam-c' }),
      actionBlock({ id: 'a-4', dayKey: '2026-06-26' }),
      reviewBlock({ id: 'r-4', dayKey: '2026-06-29', evidenceRequired: 'e', titleFamily: 'fam-d' }),
    ];
    const result = evaluatePlanQualityGate(baseInput(blocks));
    expect(result.failureCodes).not.toContain('MECHANICAL_CADENCE_LOOP');
  });
});
