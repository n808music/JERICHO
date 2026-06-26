import { describe, it, expect } from 'vitest';
import { resolveBlockPlainLanguage } from './resolveBlockPlainLanguage.js';

/**
 * ATTESTATION CONTRACT (Truth Communication layer)
 *
 * A generated block may only require Jericho to:
 *   1. place the block on the schedule, and
 *   2. communicate the block completely.
 *
 * Verification belongs to the operator. Therefore every completion condition
 * must be expressible as Target + Verification Source + Operator Attestation.
 * Jericho may never synthesize a completion claim it cannot point an operator
 * at an external source to verify.
 *
 * This suite enforces three invariants on resolveBlockPlainLanguage:
 *
 *   A. The result MUST expose three canonical fields:
 *      - target
 *      - verificationSource
 *      - operatorAttestation
 *
 *   B. When any of those three is absent on the input block (and no canonical
 *      hierarchy substitute is available), the molecular gate MUST emit:
 *      - MISSING_VERIFICATION_SOURCE
 *      - MISSING_OPERATOR_ATTESTATION
 *      The existing MISSING_COMPLETION_ASSERTION / MISSING_ACCEPTANCE_EVIDENCE
 *      codes remain for legacy callers but no longer satisfy the contract.
 *
 *   C. The resolver MUST NOT fabricate the attestation triple. The triple
 *      fields are canonical-only: if the block carries them, they pass
 *      through; if the block lacks them, they remain empty and the gate fires.
 *      (Synthesized doneWhen/acceptance/etc. are preserved for the
 *      "Operator instructions" section but they are NOT promoted into
 *      verificationSource or operatorAttestation.)
 */

const CANONICAL_HIERARCHY = {
  block: 'Validate Operation Endgame hard-anchor protection rules',
  phase: 'P1',
  operatingCycle: 'Foundation / Launch Proof',
  lane: 'Operation Endgame studio operations system',
  initiative: 'Operating System',
};

describe('resolveBlockPlainLanguage — attestation contract', () => {
  it('A1: exposes target, verificationSource, operatorAttestation fields on the result', () => {
    const block = {
      id: 'attest-fields-present',
      title: 'Confirm release distribution submission',
      laneId: 'lane-creative',
      laneLabel: 'Operation Endgame album release engine',
      target: 'Release submitted to primary distributor with confirmation receipt',
      verificationSource: 'DistroKid dashboard',
      operatorAttestation: 'Operator confirms submission status in DistroKid and attests completion',
    };
    const result = resolveBlockPlainLanguage(block, { hierarchy: CANONICAL_HIERARCHY });
    expect(result).toHaveProperty('target');
    expect(result).toHaveProperty('verificationSource');
    expect(result).toHaveProperty('operatorAttestation');
  });

  it('A2: passes through canonical attestation triple verbatim when present on the block', () => {
    const block = {
      id: 'attest-pass-through',
      title: 'Confirm release distribution submission',
      laneId: 'lane-creative',
      laneLabel: 'Operation Endgame album release engine',
      target: 'Release submitted to primary distributor with confirmation receipt',
      verificationSource: 'DistroKid dashboard',
      operatorAttestation: 'Operator confirms submission status in DistroKid and attests completion',
    };
    const result = resolveBlockPlainLanguage(block, { hierarchy: CANONICAL_HIERARCHY });
    expect(result.target).toBe('Release submitted to primary distributor with confirmation receipt');
    expect(result.verificationSource).toBe('DistroKid dashboard');
    expect(result.operatorAttestation).toBe(
      'Operator confirms submission status in DistroKid and attests completion'
    );
  });

  it('B1: emits MISSING_VERIFICATION_SOURCE when block lacks verificationSource', () => {
    const block = {
      id: 'no-source',
      title: 'Confirm release distribution submission',
      laneId: 'lane-creative',
      laneLabel: 'Operation Endgame album release engine',
      target: 'Release submitted',
      operatorAttestation: 'Operator attests submission completed',
      // verificationSource absent
    };
    const result = resolveBlockPlainLanguage(block, { hierarchy: CANONICAL_HIERARCHY });
    expect(result.quality?.failureCodes || []).toContain('MISSING_VERIFICATION_SOURCE');
  });

  it('B2: emits MISSING_OPERATOR_ATTESTATION when block lacks operatorAttestation', () => {
    const block = {
      id: 'no-attestation',
      title: 'Confirm release distribution submission',
      laneId: 'lane-creative',
      laneLabel: 'Operation Endgame album release engine',
      target: 'Release submitted',
      verificationSource: 'DistroKid dashboard',
      // operatorAttestation absent
    };
    const result = resolveBlockPlainLanguage(block, { hierarchy: CANONICAL_HIERARCHY });
    expect(result.quality?.failureCodes || []).toContain('MISSING_OPERATOR_ATTESTATION');
  });

  it('B3: emits both MISSING_* codes when target is declared but both verificationSource AND operatorAttestation are absent', () => {
    const block = {
      id: 'no-attest-no-source',
      title: 'Some generic block',
      laneId: 'lane-creative',
      laneLabel: 'Operation Endgame album release engine',
      target: 'Some measurable target the operator is claiming',
      // verificationSource AND operatorAttestation both absent
    };
    const result = resolveBlockPlainLanguage(block, { hierarchy: CANONICAL_HIERARCHY });
    const codes = result.quality?.failureCodes || [];
    expect(codes).toContain('MISSING_VERIFICATION_SOURCE');
    expect(codes).toContain('MISSING_OPERATOR_ATTESTATION');
  });

  it('B5: does NOT emit either MISSING_* code when block has NO target (no measurable claim being made)', () => {
    const block = {
      id: 'no-target-no-claim',
      title: 'Some generic block',
      laneId: 'lane-creative',
      laneLabel: 'Operation Endgame album release engine',
      // target absent — block makes no measurable claim, so triple is not required
    };
    const result = resolveBlockPlainLanguage(block, { hierarchy: CANONICAL_HIERARCHY });
    const codes = result.quality?.failureCodes || [];
    expect(codes).not.toContain('MISSING_VERIFICATION_SOURCE');
    expect(codes).not.toContain('MISSING_OPERATOR_ATTESTATION');
  });

  it('B4: does NOT emit either MISSING_* code when all three triple fields are present', () => {
    const block = {
      id: 'attest-complete',
      title: 'Confirm release distribution submission',
      laneId: 'lane-creative',
      laneLabel: 'Operation Endgame album release engine',
      target: 'Release submitted to primary distributor with confirmation receipt',
      verificationSource: 'DistroKid dashboard',
      operatorAttestation: 'Operator confirms submission status in DistroKid and attests completion',
      // populate enough other fields so OTHER gates do not fire
      expectedOutput: 'Distribution submission record with confirmation receipt',
      producesArtifact: 'Distribution submission record with confirmation receipt',
      passEvidence: 'Saved DistroKid confirmation screenshot with timestamp and release identifier',
      acceptanceEvidence: 'Saved DistroKid confirmation screenshot with timestamp and release identifier',
      missConsequence: 'Without verified submission the release window slips silently.',
      plainAction: 'Open DistroKid, confirm submission status, save the confirmation receipt to the project archive.',
      steps: [
        'Open DistroKid dashboard.',
        'Locate the release record.',
        'Verify submission status.',
        'Save the confirmation screenshot.',
      ],
      doneWhen: 'A saved DistroKid confirmation receipt exists for this release.',
      consumedBy: ['masterPlanLane:lane-creative'],
      consumedByRef: { type: 'masterPlanLane', id: 'lane-creative' },
    };
    const result = resolveBlockPlainLanguage(block, { hierarchy: CANONICAL_HIERARCHY });
    const codes = result.quality?.failureCodes || [];
    expect(codes).not.toContain('MISSING_VERIFICATION_SOURCE');
    expect(codes).not.toContain('MISSING_OPERATOR_ATTESTATION');
  });

  it('C1: does NOT fabricate verificationSource when block lacks it (no synthesis)', () => {
    const block = {
      id: 'no-source-no-fab',
      title: 'Validate Operation Endgame hard-anchor protection rules',
      laneId: 'lane-operations',
      laneLabel: 'Operation Endgame studio operations system',
      // verificationSource absent; resolver must not invent one
    };
    const result = resolveBlockPlainLanguage(block, { hierarchy: CANONICAL_HIERARCHY });
    expect(result.verificationSource || '').toBe('');
  });

  it('C2: does NOT fabricate operatorAttestation from the synthesized completionAssertion (no synthesis)', () => {
    const block = {
      id: 'no-attest-no-fab',
      title: 'Validate Operation Endgame hard-anchor protection rules',
      laneId: 'lane-operations',
      laneLabel: 'Operation Endgame studio operations system',
      // operatorAttestation absent; resolver must not invent one even though
      // the legacy completionAssertion synthesizer would produce a string.
    };
    const result = resolveBlockPlainLanguage(block, { hierarchy: CANONICAL_HIERARCHY });
    expect(result.operatorAttestation || '').toBe('');
    // The legacy synthesized completionAssertion may still be present in the
    // "operator instructions" surface — but it MUST NOT be the operatorAttestation.
    expect(result.operatorAttestation || '').not.toEqual(result.completionAssertion || '');
  });

  it('C3: does NOT fabricate target from doneWhen synthesis when block lacks target', () => {
    const block = {
      id: 'no-target-no-fab',
      title: 'Validate Operation Endgame hard-anchor protection rules',
      laneId: 'lane-operations',
      laneLabel: 'Operation Endgame studio operations system',
      // target absent; resolver must not invent one
    };
    const result = resolveBlockPlainLanguage(block, { hierarchy: CANONICAL_HIERARCHY });
    expect(result.target || '').toBe('');
  });
});
