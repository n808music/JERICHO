/**
 * Plan quality gate refuses an active cycle that begins in the past with
 * unaddressed stale blocks (Phase 7 — Execution Professionalism Remediation).
 *
 * A plan generated on day X should not silently schedule actionable blocks
 * before X; if it does, those blocks are either backfilled history (must
 * be flagged) or evidence that the cycle is stale and has drifted off
 * the real execution timeline.
 */
import { describe, expect, it } from 'vitest';

import { evaluatePlanQualityGate } from './evaluatePlanQualityGate.ts';

function baseInput(proposedBlocks: unknown[], extras: Record<string, unknown> = {}) {
  return {
    goalText: 'goal',
    deliverables: [],
    actions: [],
    proposedBlocks,
    committedBlocks: [],
    ...extras,
  } as Parameters<typeof evaluatePlanQualityGate>[0];
}

function block(overrides: Record<string, unknown> = {}) {
  return {
    id: 'a-1',
    blockType: 'action',
    title: 'Do work',
    dayKey: '2026-06-15',
    phaseLabel: 'P1',
    laneId: 'lane-x',
    owner: 'product_owner',
    durationMinutes: 60,
    producesArtifact: 'Work artifact',
    consumedBy: ['phase:P2'],
    consumedByRef: { type: 'phaseObjective', id: 'P2' },
    passEvidence: 'Work artifact recorded',
    executionContext: { laneFamily: 'product_software', laneStatus: 'active' },
    ...overrides,
  };
}

describe('plan quality gate — STALE_ACTIVE_CYCLE_STATE', () => {
  it('fires when proposed blocks exist before evaluationDate without historical/backfilled flags', () => {
    const blocks = [
      block({ id: 'a-1', dayKey: '2026-05-01' }),
      block({ id: 'a-2', dayKey: '2026-05-15' }),
      block({ id: 'a-3', dayKey: '2026-06-15' }),
    ];
    const result = evaluatePlanQualityGate(baseInput(blocks, { evaluationDate: '2026-06-01' }));
    expect(result.failureCodes).toContain('STALE_ACTIVE_CYCLE_STATE');
  });

  it('does NOT fire when past-dated blocks are explicitly flagged historical', () => {
    const blocks = [
      block({ id: 'a-1', dayKey: '2026-05-01', isHistorical: true }),
      block({ id: 'a-2', dayKey: '2026-05-15', isBackfilled: true }),
      block({ id: 'a-3', dayKey: '2026-06-15' }),
    ];
    const result = evaluatePlanQualityGate(baseInput(blocks, { evaluationDate: '2026-06-01' }));
    expect(result.failureCodes).not.toContain('STALE_ACTIVE_CYCLE_STATE');
  });

  it('does NOT fire when evaluationDate is absent (legacy callers unaffected)', () => {
    const blocks = [block({ id: 'a-1', dayKey: '2026-05-01' })];
    const result = evaluatePlanQualityGate(baseInput(blocks));
    expect(result.failureCodes).not.toContain('STALE_ACTIVE_CYCLE_STATE');
  });

  it('does NOT fire when all blocks are on or after evaluationDate', () => {
    const blocks = [
      block({ id: 'a-1', dayKey: '2026-06-01' }),
      block({ id: 'a-2', dayKey: '2026-06-15' }),
    ];
    const result = evaluatePlanQualityGate(baseInput(blocks, { evaluationDate: '2026-06-01' }));
    expect(result.failureCodes).not.toContain('STALE_ACTIVE_CYCLE_STATE');
  });
});

describe('plan quality gate — ACTIVE_CYCLE_STARTS_IN_PAST_WITHOUT_CONFIRMATION', () => {
  it('fires when the earliest proposed block predates evaluationDate without explicit confirmation', () => {
    const blocks = [
      block({ id: 'a-1', dayKey: '2026-04-01' }),
      block({ id: 'a-2', dayKey: '2026-07-01' }),
    ];
    const result = evaluatePlanQualityGate(baseInput(blocks, { evaluationDate: '2026-06-01' }));
    expect(result.failureCodes).toContain('ACTIVE_CYCLE_STARTS_IN_PAST_WITHOUT_CONFIRMATION');
  });

  it('does NOT fire when allowsBackdatedStart is true (user explicitly confirmed)', () => {
    const blocks = [
      block({ id: 'a-1', dayKey: '2026-04-01', isBackfilled: true }),
      block({ id: 'a-2', dayKey: '2026-07-01' }),
    ];
    const result = evaluatePlanQualityGate(baseInput(blocks, { evaluationDate: '2026-06-01', allowsBackdatedStart: true }));
    expect(result.failureCodes).not.toContain('ACTIVE_CYCLE_STARTS_IN_PAST_WITHOUT_CONFIRMATION');
  });

  it('does NOT fire when the earliest block is on or after evaluationDate', () => {
    const blocks = [
      block({ id: 'a-1', dayKey: '2026-06-01' }),
      block({ id: 'a-2', dayKey: '2026-07-01' }),
    ];
    const result = evaluatePlanQualityGate(baseInput(blocks, { evaluationDate: '2026-06-01' }));
    expect(result.failureCodes).not.toContain('ACTIVE_CYCLE_STARTS_IN_PAST_WITHOUT_CONFIRMATION');
  });

  it('does NOT fire when evaluationDate is absent', () => {
    const blocks = [block({ id: 'a-1', dayKey: '2026-04-01' })];
    const result = evaluatePlanQualityGate(baseInput(blocks));
    expect(result.failureCodes).not.toContain('ACTIVE_CYCLE_STARTS_IN_PAST_WITHOUT_CONFIRMATION');
  });
});
