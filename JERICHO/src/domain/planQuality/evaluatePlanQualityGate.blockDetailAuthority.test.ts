import { describe, expect, it } from 'vitest';

import { evaluatePlanQualityGate } from './evaluatePlanQualityGate.ts';
import { resolveBlockPlainLanguage } from '../product/resolveBlockPlainLanguage.js';

function baseInput(blocks: Record<string, unknown>[]) {
  return {
    goalText: 'Build and launch Operation Endgame through a stable multi-lane plan.',
    verificationText: 'Launch proof, runway proof, and strategic continuity must all be inspectable.',
    deliverables: [{ id: 'd1', title: 'Launch proof artifact', actionIds: ['a1'] }],
    actions: [{ id: 'a1', title: 'Build launch proof', deliverableId: 'd1' }],
    proposedBlocks: blocks,
    committedBlocks: [],
    temporalContext: {
      contractStartDayKey: '2026-06-08',
      contractEndDayKey: '2026-10-17',
      isRecurring: false,
    },
  };
}

function makeExecBlock(overrides: Record<string, unknown> = {}) {
  return {
    id: 'blk-1',
    title: 'Validate onboarding path for Operation Endgame app platform',
    deliverableId: 'd1',
    actionId: 'a1',
    dayKey: '2026-06-08',
    blockType: 'action',
    owner: 'Product Lead',
    durationMinutes: 60,
    producesArtifact: 'Onboarding test report with blocker log',
    consumedBy: ['phase:P1'],
    passEvidence: 'Passing test report or blocker log with reproduction steps',
    consumedByRef: { type: 'phaseObjective', id: 'P2' },
    phaseLabel: 'P1',
    laneId: 'lane-product',
    laneLabel: 'Operation Endgame app platform',
    executionContext: { laneFamily: 'product_software', laneStatus: 'active' },
    ...overrides,
  };
}

describe('evaluatePlanQualityGate block-detail authority', () => {
  it('fails when block detail explanation is generic and under-specified', () => {
    const block = makeExecBlock({
      title: 'Clarify next move',
      laneLabel: '',
      producesArtifact: '',
      passEvidence: '',
      consumedBy: [],
    });

    const result = evaluatePlanQualityGate(baseInput([block]));

    expect(result.status).toBe('PLAN_QUALITY_WITHHELD');
    expect(result.failureCodes).toEqual(
      expect.arrayContaining([
        'BLOCK_GOAL_OBJECT_MISSING',
        'MISSING_EXECUTION_ARTIFACT',
        'MISSING_EXECUTION_PASS_EVIDENCE',
        'GENERIC_EXECUTION_INSTRUCTION',
        'UNKNOWN_WORK_TYPE',
        'ABSTRACT_BLOCK_MEANING',
        'INITIATIVE_LABEL_MISSING',
        'BLOCK_DETAIL_AMBIGUOUS',
      ])
    );
  });

  it('fails unjustified P1 Real Estate activation', () => {
    const block = makeExecBlock({
      title: 'Decide whether the district execution path is ready for execution',
      laneId: 'lane-real-estate',
      laneLabel: 'Operation Endgame district coalition development',
      phaseLabel: 'P1',
      producesArtifact: 'Real-estate prerequisite memo with gating status and next dependency',
      passEvidence: 'Gating memo with prerequisite status',
      consumedByRef: { type: 'phaseObjective', id: 'P2' },
    });

    const result = evaluatePlanQualityGate(baseInput([block]));

    expect(result.status).toBe('PLAN_QUALITY_WITHHELD');
    expect(result.failureCodes).toEqual(
      expect.arrayContaining([
        'PREMATURE_INITIATIVE_ACTIVATION',
        'DEFERRED_LANE_SCHEDULED_AS_ACTIVE',
        'LONG_HORIZON_LANE_OVERWEIGHTED_IN_P1',
        'PHASE_PRIORITY_MISCLASSIFIED',
        'USER_DECISION_DUMPING',
      ])
    );
  });

  it('keeps gate enforcement aligned with the block-detail resolver', () => {
    const block = makeExecBlock({
      title: 'Clarify next move',
      laneLabel: '',
      producesArtifact: '',
      passEvidence: '',
      consumedBy: [],
    });

    const detail = resolveBlockPlainLanguage(block, {
      hierarchy: { phase: 'P1' },
    });
    const result = evaluatePlanQualityGate(baseInput([block]));

    expect(detail.quality.status).toBe('under_specified');
    detail.quality.failureCodes.forEach((code) => {
      expect(result.failureCodes).toContain(code);
    });
  });

  it('passes the hard-anchor protection example with concrete lane identity and completed artifact output', () => {
    const block = makeExecBlock({
      title: 'Validate Operation Endgame hard-anchor protection rules',
      laneId: 'brand',
      laneLabel: 'Operation Endgame studio operations system',
      producesArtifact: 'Validated hard-anchor rule set',
      passEvidence: 'Written hard-anchor protection rule set linked to fixed anchors and preserved mandatory work.',
      blockType: 'validation',
      // Attestation contract — operator verifies, Jericho does not.
      target: 'Validated hard-anchor protection rule set covering every fixed anchor',
      verificationSource: 'Operation Endgame plan-quality review record',
      operatorAttestation:
        'Operator opens the plan-quality review record and attests the hard-anchor protection rules are validated.',
    });

    const detail = resolveBlockPlainLanguage(block, {
      hierarchy: { phase: 'P1' },
    });

    expect(detail.laneLabel).toBe('Operation Endgame studio operations system');
    expect(detail.entityLabel).toBe('Global State Solutions');
    expect(detail.workType).toBe('Validation');
    expect(detail.expectedOutput).toBe('Validated hard-anchor rule set');
    expect(detail.quality.failureCodes).toEqual([]);
  });

  it('withholds active readiness when a scheduled block has unknown lane and entity identity', () => {
    const block = makeExecBlock({
      title: 'Clarify next move',
      laneId: null,
      laneLabel: '',
      producesArtifact: '',
      passEvidence: '',
    });

    const result = evaluatePlanQualityGate(baseInput([block]));

    expect(result.status).toBe('PLAN_QUALITY_WITHHELD');
    expect(result.failureCodes).toEqual(
      expect.arrayContaining(['ACTIVE_BLOCK_UNKNOWN_LANE', 'ACTIVE_BLOCK_UNKNOWN_ENTITY', 'LANE_CONTEXT_NOT_APPLIED'])
    );
  });

  it('withholds deferred P2/P3 work in P1 when no prerequisite justification is present', () => {
    const block = makeExecBlock({
      title: 'Define institutional partner sequencing baseline',
      laneId: 'academy',
      laneLabel: 'Operation Endgame apprenticeship institution design',
      phaseLabel: 'P1',
      executionContext: { laneFamily: 'institution', laneStatus: 'deferred' },
      producesArtifact: 'Defined institutional sequencing baseline with defer recommendation',
      passEvidence: 'Saved sequencing baseline with current status, next owner, and defer recommendation.',
    });

    const result = evaluatePlanQualityGate(baseInput([block]));

    expect(result.status).toBe('PLAN_QUALITY_WITHHELD');
    expect(result.failureCodes).toEqual(
      expect.arrayContaining([
        'PHASE_SCOPE_CONFLICT',
        'DEFERRED_LANE_SCHEDULED_WITHOUT_JUSTIFICATION',
        'FUTURE_PHASE_WORK_REQUIRES_PREREQUISITE_PROOF',
      ])
    );
  });

  it('allows justified future-phase prerequisite work to avoid phase-conflict failures', () => {
    const block = makeExecBlock({
      title: 'Real-estate or asset thesis validated',
      laneId: 'civic',
      laneLabel: 'Operation Endgame district coalition development',
      phaseLabel: 'P1',
      executionContext: { laneFamily: 'capital_real_estate', laneStatus: 'active' },
      producesArtifact: 'Validated asset or real-estate thesis memo with prerequisite proof',
      passEvidence: 'Saved thesis memo with prerequisite proof evidence and missing-proof list.',
      gatesJustification: 'prerequisite proof',
    });

    const result = evaluatePlanQualityGate(baseInput([block]));

    expect(result.failureCodes).not.toEqual(
      expect.arrayContaining([
        'PHASE_SCOPE_CONFLICT',
        'DEFERRED_LANE_SCHEDULED_WITHOUT_JUSTIFICATION',
        'FUTURE_PHASE_WORK_REQUIRES_PREREQUISITE_PROOF',
      ])
    );
  });

  it('detects entity-purpose mismatch when support calendar work is forced into F8', () => {
    const block = makeExecBlock({
      title: 'Map job-search and income demands against the execution calendar',
      laneId: 'energy_gym',
      laneLabel: 'Operation Endgame services revenue bridge',
      producesArtifact: 'Mapped job-search and income demand calendar alignment',
      passEvidence: 'Saved calendar map showing job-search obligations and protected execution windows.',
    });

    const result = evaluatePlanQualityGate(baseInput([block]));

    expect(result.status).toBe('PLAN_QUALITY_WITHHELD');
    expect(result.failureCodes).toContain('ENTITY_PURPOSE_MISMATCH');
  });

  it('preserves execution readiness once media work resolves to a concrete project/program', () => {
    const block = makeExecBlock({
      title: 'Record next Operation Endgame media narrative pipeline episode',
      laneId: 'media',
      laneLabel: 'Operation Endgame media narrative pipeline',
      producesArtifact: 'Recorded media narrative episode source session',
      passEvidence: 'Saved source session with raw media file, notes, and next edit handoff.',
    });

    const result = evaluatePlanQualityGate(baseInput([block]));

    expect(result.failureCodes).not.toContain('PROJECT_CONTEXT_MISSING');
  });

  it('flags P1 energy leakage when noncritical future-lane work crowds the active phase', () => {
    const result = evaluatePlanQualityGate(
      baseInput([
        makeExecBlock({
          id: 'critical-1',
          title: 'Validate onboarding path for Operation Endgame app platform',
          laneId: 'lane-product',
          laneLabel: 'Operation Endgame app platform',
          producesArtifact: 'Validated onboarding path report',
          passEvidence: 'Saved onboarding validation report with blocker status.',
        }),
        makeExecBlock({
          id: 'future-1',
          title: 'Real-estate or asset thesis validated',
          laneId: 'civic',
          laneLabel: 'Operation Endgame district coalition development',
          executionContext: { laneFamily: 'capital_real_estate', laneStatus: 'active' },
          producesArtifact: 'Validated asset or real-estate thesis memo with prerequisite proof',
          passEvidence: 'Saved thesis memo with prerequisite proof evidence and missing-proof list.',
        }),
        makeExecBlock({
          id: 'future-2',
          title: 'Define institutional partner sequencing baseline',
          laneId: 'academy',
          laneLabel: 'Operation Endgame apprenticeship institution design',
          executionContext: { laneFamily: 'institution', laneStatus: 'deferred' },
          producesArtifact: 'Defined institutional sequencing baseline with defer recommendation',
          passEvidence: 'Saved sequencing baseline with current status, next owner, and defer recommendation.',
        }),
      ])
    );

    expect(result.status).toBe('PLAN_QUALITY_WITHHELD');
    expect(result.failureCodes).toEqual(
      expect.arrayContaining([
        'PHASE_SCOPE_CONFLICT',
        'DEFERRED_LANE_SCHEDULED_WITHOUT_JUSTIFICATION',
        'PHASE_ENERGY_VIOLATION',
      ])
    );
  });
});
