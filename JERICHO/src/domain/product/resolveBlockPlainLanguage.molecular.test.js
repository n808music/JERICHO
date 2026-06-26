import { describe, it, expect } from 'vitest';
import { resolveBlockPlainLanguage } from './resolveBlockPlainLanguage.js';

const HIERARCHY = {
  block: 'Operator review',
  lane: 'Operations',
  phase: 'P1',
};

describe('resolveBlockPlainLanguage molecular sections', () => {
  it('synthesizes a usable detail scaffold when explicit fields are empty', () => {
    const block = {
      id: 'a',
      label: '',
      laneId: 'operations',
      expectedOutput: '',
      acceptanceEvidence: '',
      passEvidence: '',
      plainAction: '',
      steps: [],
      doneWhen: '',
    };
    const result = resolveBlockPlainLanguage(block, { hierarchy: HIERARCHY });
    expect(result.quality?.status).toBe('under_specified');
    expect(result.plainAction).toMatch(/concrete operator work for operations/i);
    expect(result.expectedOutput).toMatch(/Operations with completion record/i);
    expect(result.completionAssertion).toMatch(/Completing this asserts the operator produced/i);
  });

  it('flags under_specified when explicit output stays generic after synthesis', () => {
    const block = {
      id: 'b',
      label: '',
      laneId: 'operations',
      expectedOutput: 'TBD',
      acceptanceEvidence: 'TBD',
      passEvidence: '',
      plainAction: '',
      steps: [],
      doneWhen: '',
    };
    const result = resolveBlockPlainLanguage(block, { hierarchy: HIERARCHY });
    expect(result.quality?.status).toBe('under_specified');
    expect(result.quality?.failureCodes).toContain('BLOCK_DETAIL_TOO_ABSTRACT');
  });

  it('replaces generic explicit action detail with synthesized execution guidance', () => {
    const block = {
      id: 'c',
      label: '',
      laneId: 'operations',
      expectedOutput: 'Operations control sheet',
      acceptanceEvidence: 'A saved sheet reviewed in May',
      plainAction: 'TBD',
      steps: [],
      doneWhen: 'TBD',
      // Attestation contract — molecular tests focus on legacy synthesis,
      // so the canonical triple is supplied here to keep the gate isolated
      // to the molecular concerns under test.
      target: 'Operations control sheet reviewed and saved',
      verificationSource: 'Operations control sheet (shared workspace)',
      operatorAttestation: 'Operator opens the sheet and attests review completion',
    };
    const result = resolveBlockPlainLanguage(block, { hierarchy: HIERARCHY });
    expect(result.quality?.status).toBe('passes');
    expect(result.plainAction).not.toMatch(/^TBD$/i);
    expect(result.doneWhen).not.toMatch(/^TBD$/i);
    expect(result.steps.length).toBeGreaterThan(0);
  });

  it('passes when all five molecular sections have concrete content', () => {
    const block = {
      id: 'd',
      label: 'Operations control sheet review',
      laneId: 'operations',
      expectedOutput:
        'Operations checklist with each control, owner, review cadence, dependency, and next gate date.',
      acceptanceEvidence:
        'A saved checklist that can be opened and reviewed during the May 2026 operating review.',
      plainAction: 'Open the operations checklist and review each control.',
      steps: [
        'Open the operations checklist file in the shared workspace.',
        'For every row, confirm owner, cadence, dependency, and next gate date.',
        'Save and notify the operating review chair.',
      ],
      doneWhen: 'All rows reviewed and the checklist is saved.',
      target: 'Operations checklist reviewed end-to-end with all rows confirmed',
      verificationSource: 'Operations checklist (shared workspace)',
      operatorAttestation: 'Operator opens the checklist and attests the review is complete',
    };
    const result = resolveBlockPlainLanguage(block, { hierarchy: HIERARCHY });
    expect(result.quality?.status).not.toBe('under_specified');
    expect(result.quality?.failureCodes || []).toHaveLength(0);
  });

  it('derives concrete detail from first-cycle execution metadata', () => {
    const block = {
      id: 'e',
      title: 'Prepare EP distribution metadata package',
      laneId: 'creative',
      laneLabel: 'Global State Corp.',
      durationMinutes: 45,
      producesArtifact: 'EP distributor metadata package with UPC, ISRC mapping, release date, and store copy',
      passEvidence: 'Distributor-ready metadata package is saved and linked to the EP release lane',
      consumedByRef: { type: 'masterPlanLane', id: 'lane-ep' },
      consumedBy: ['masterPlanLane:lane-ep'],
      directDependencyIds: ['masterplan-action:upstream-distribution-approval'],
      target: 'EP distributor metadata package saved and linked to the EP release lane',
      verificationSource: 'EP release lane workspace',
      operatorAttestation: 'Operator opens the EP release lane workspace and attests the metadata package is saved',
    };
    const result = resolveBlockPlainLanguage(block, { hierarchy: HIERARCHY });
    expect(result.quality?.status).toBe('passes');
    expect(result.plainAction).toMatch(/Gather the required inputs for ep distribution metadata package/i);
    expect(result.steps.join(' ')).toMatch(/upstream milestone upstream-distribution-approval/i);
    expect(result.expectedOutput).toMatch(/EP distributor metadata package/i);
    expect(result.acceptanceEvidence).toMatch(/Distributor-ready metadata package/i);
    expect(result.doneWhen).toMatch(/assembled with the inputs the next execution step needs to proceed/i);
    expect(result.dependencies?.unlocks).toContain('Global State Corp. lane');
  });

  it('keeps generic review fallback fields semantically distinct and purpose-shaped', () => {
    const block = {
      id: 'f',
      title: 'Review founder narrative memo',
      laneId: 'operations',
      laneLabel: 'Operation Endgame studio operations system',
    };
    const result = resolveBlockPlainLanguage(block, { hierarchy: HIERARCHY });
    expect(result.whyThisExists).toMatch(/^(Because|So that|To) /);
    expect(result.whyThisExists).not.toEqual(result.acceptanceEvidence);
    expect(result.doneWhen).not.toEqual(result.expectedOutput);
    expect(result.plainAction).not.toEqual(result.whyThisExists);
    expect(result.expectedOutput).toMatch(/Reviewed founder narrative memo record with findings and next actions/i);
    expect(result.acceptanceEvidence).toMatch(/saved review record for founder narrative memo/i);
  });
});
