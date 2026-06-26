import { describe, it, expect } from 'vitest';
import { resolveBlockPlainLanguage } from './resolveBlockPlainLanguage.js';

/**
 * Regression: live first activated block detail-authority failure.
 *
 * Symptom — BlockDetailsPanel renders the first visible activated calendar block
 * with "Plan quality failed for this block detail" and the failure codes:
 *   - UNKNOWN_LANE_IDENTITY
 *   - LANE_CONTEXT_NOT_APPLIED
 *
 * Even though the panel displays canonical hierarchy (lane "Operation Endgame
 * studio operations system", entity, program), the gate sees the activated
 * block with stripped lane fields and treats it as having no lane identity.
 *
 * The projection layer that feeds computeMolecularQuality must accept the
 * canonical hierarchy.lane (passed in from the panel's hierarchyContext, NOT
 * inferred from title text) as a fallback for rawLaneLabel when the block's
 * own lane fields are missing.
 */
describe('resolveBlockPlainLanguage — activated block with canonical hierarchy', () => {
  const CANONICAL_HARD_ANCHOR_HIERARCHY = {
    block: 'Validate Operation Endgame hard-anchor protection rules',
    phase: 'P1',
    operatingCycle: 'Foundation / Launch Proof',
    sprint: 'Jun 22 — Oct 17',
    lane: 'Operation Endgame studio operations system',
    initiative: 'Operating System',
  };

  it('does not emit UNKNOWN_LANE_IDENTITY when activated block lacks raw lane fields but hierarchy.lane is canonical', () => {
    const activatedShapeBlock = {
      id: 'activated-confirm-hard-anchors',
      origin: 'schedule_active',
      title: 'Validate Operation Endgame hard-anchor protection rules',
      label: 'Validate Operation Endgame hard-anchor protection rules',
      // Activation step strips canonical lane fields today. This shape
      // reproduces that post-activation block.
      laneId: null,
      laneLabel: null,
      entityId: null,
      entityLabel: null,
      phaseId: null,
      phaseLabel: null,
      workType: null,
      practice: 'FOCUS',
      domain: 'FOCUS',
      start: '2026-06-22T16:00:00.000Z',
      end: '2026-06-22T16:45:00.000Z',
      status: 'planned',
    };

    const result = resolveBlockPlainLanguage(activatedShapeBlock, { hierarchy: CANONICAL_HARD_ANCHOR_HIERARCHY });
    const failureCodes = result?.quality?.failureCodes || [];

    // Lane-recovery test only — attestation MISSING_* codes are out of scope here
    // (the block intentionally lacks the attestation triple to focus on the
    // lane-recovery path). The attestation contract is tested separately in
    // resolveBlockPlainLanguage.attestationContract.test.js.
    expect(failureCodes).not.toContain('UNKNOWN_LANE_IDENTITY');
    expect(failureCodes).not.toContain('LANE_CONTEXT_NOT_APPLIED');
  });

  it('still emits UNKNOWN_LANE_IDENTITY when neither the block nor the hierarchy carries lane context', () => {
    const blockWithoutLane = {
      id: 'orphan',
      title: 'Some block',
    };
    const emptyHierarchy = { phase: 'P1' };

    const result = resolveBlockPlainLanguage(blockWithoutLane, { hierarchy: emptyHierarchy });
    const failureCodes = result?.quality?.failureCodes || [];

    expect(failureCodes).toContain('UNKNOWN_LANE_IDENTITY');
    expect(failureCodes).toContain('LANE_CONTEXT_NOT_APPLIED');
  });
});
