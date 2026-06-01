/**
 * Plan quality gate refuses gate blocks that lack pass/fail criteria
 * (Phase 4 — Execution Professionalism Remediation).
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

function gateBlock(overrides: Record<string, unknown> = {}) {
  return {
    id: 'gate-1',
    blockType: 'gate',
    title: 'Sample gate',
    dayKey: '2027-01-01',
    phaseLabel: 'P2',
    owner: 'gate_authority',
    durationMinutes: 60,
    producesArtifact: 'Gate decision',
    consumedBy: ['phase:P3'],
    consumedByRef: { type: 'phaseObjective', id: 'P3' },
    passEvidence: 'Gate decision recorded',
    gateName: 'Sample gate',
    passCriteria: 'Criteria met',
    failCriteria: 'Criteria unmet',
    evidenceRequired: 'Evidence package',
    decisionAuthority: 'gate_authority',
    passBranch: 'phase:P3',
    failBranch: 'Replan to extend prior phase',
    ...overrides,
  };
}

describe('plan quality gate — MISSING_GATE_PASS_CRITERIA', () => {
  it('fires when a gate block has empty passCriteria', () => {
    const result = evaluatePlanQualityGate(baseInput([gateBlock({ passCriteria: '' })]));
    expect(result.failureCodes).toContain('MISSING_GATE_PASS_CRITERIA');
  });

  it('does NOT fire when gate block declares passCriteria', () => {
    const result = evaluatePlanQualityGate(baseInput([gateBlock()]));
    expect(result.failureCodes).not.toContain('MISSING_GATE_PASS_CRITERIA');
  });
});

describe('plan quality gate — MISSING_GATE_FAIL_CRITERIA', () => {
  it('fires when a gate block has empty failCriteria', () => {
    const result = evaluatePlanQualityGate(baseInput([gateBlock({ failCriteria: null })]));
    expect(result.failureCodes).toContain('MISSING_GATE_FAIL_CRITERIA');
  });

  it('does NOT fire when failCriteria is declared', () => {
    const result = evaluatePlanQualityGate(baseInput([gateBlock()]));
    expect(result.failureCodes).not.toContain('MISSING_GATE_FAIL_CRITERIA');
  });
});

describe('plan quality gate — MISSING_GATE_FAILURE_BRANCH', () => {
  it('fires when a gate block has empty failBranch', () => {
    const result = evaluatePlanQualityGate(baseInput([gateBlock({ failBranch: '' })]));
    expect(result.failureCodes).toContain('MISSING_GATE_FAILURE_BRANCH');
  });

  it('does NOT fire when failBranch is declared', () => {
    const result = evaluatePlanQualityGate(baseInput([gateBlock()]));
    expect(result.failureCodes).not.toContain('MISSING_GATE_FAILURE_BRANCH');
  });
});

describe('plan quality gate — non-gate blocks unaffected', () => {
  it('does NOT fire any gate-criteria code for a review block', () => {
    const review = gateBlock({
      id: 'rev-1',
      blockType: 'review',
      gateName: null,
      passCriteria: null,
      failCriteria: null,
      failBranch: null,
    });
    const result = evaluatePlanQualityGate(baseInput([review]));
    expect(result.failureCodes).not.toContain('MISSING_GATE_PASS_CRITERIA');
    expect(result.failureCodes).not.toContain('MISSING_GATE_FAIL_CRITERIA');
    expect(result.failureCodes).not.toContain('MISSING_GATE_FAILURE_BRANCH');
  });
});
