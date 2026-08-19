import React from 'react';
import '@testing-library/jest-dom';
import { describe, expect, it, vi, afterEach } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';

import BlockDetailsPanel from '../../src/components/zion/BlockDetailsPanel.jsx';

const noop = vi.fn();

afterEach(() => cleanup());

/**
 * ATTESTATION CONTRACT — panel-surface enforcement (Option C).
 *
 * Every block must surface three labeled rows in BlockDetailsPanel:
 *   - Target
 *   - Verification source
 *   - Operator attestation
 *
 * When any of the three is absent, the row renders "Missing" and the
 * plan-quality failure banner names MISSING_VERIFICATION_SOURCE /
 * MISSING_OPERATOR_ATTESTATION so the violation surface is visible inline.
 *
 * Legacy synthesized doneWhen / passEvidence / completionAssertion are
 * preserved but reframed as Operator instructions — they are NOT presented
 * as truth claims.
 */

const FULL_ATTEST_BLOCK = {
  id: 'attest-complete',
  origin: 'derived',
  title: 'Confirm release distribution submission',
  label: 'Confirm release distribution submission',
  laneId: 'lane-creative',
  laneLabel: 'Operation Endgame album release engine',
  start: '2026-07-15T16:00:00.000Z',
  end: '2026-07-15T16:45:00.000Z',
  status: 'planned',
  practice: 'FOCUS',
  domain: 'FOCUS',
  target: 'Release submitted to primary distributor with confirmation receipt',
  verificationSource: 'DistroKid dashboard',
  operatorAttestation: 'Operator confirms submission status in DistroKid and attests completion',
  expectedOutput: 'Distribution submission record with confirmation receipt',
  producesArtifact: 'Distribution submission record with confirmation receipt',
  passEvidence: 'Saved DistroKid confirmation screenshot with timestamp and release identifier',
  acceptanceEvidence: 'Saved DistroKid confirmation screenshot with timestamp and release identifier',
  missConsequence: 'Without verified submission the release window slips silently.',
  consumedBy: ['masterPlanLane:lane-creative'],
  consumedByRef: { type: 'masterPlanLane', id: 'lane-creative' },
};

const ATTEST_MISSING_BLOCK = {
  id: 'attest-missing',
  origin: 'derived',
  title: 'Validate Operation Endgame hard-anchor protection rules',
  label: 'Validate Operation Endgame hard-anchor protection rules',
  laneId: 'lane-operations',
  laneLabel: 'Operation Endgame studio operations system',
  start: '2026-07-15T16:00:00.000Z',
  end: '2026-07-15T16:45:00.000Z',
  status: 'planned',
  practice: 'FOCUS',
  domain: 'FOCUS',
  // Target IS declared — under the attestation contract this means the
  // verification source and operator attestation MUST also be declared.
  // They are intentionally absent here to reproduce the violation.
  target: 'Validated hard-anchor protection rule set covering every fixed anchor',
  // verificationSource / operatorAttestation intentionally absent
};

const HIERARCHY_CONTEXT = {
  phase: 'P1 / Foundation / Launch Proof',
  operatingCycle: 'Foundation / Launch Proof',
  sprint: 'Jul 15 — Oct 17',
};

describe('BlockDetailsPanel — attestation contract surface (Option C)', () => {
  it('renders Target / Verification source / Operator attestation as three labeled rows when all are present', () => {
    render(
      <BlockDetailsPanel
        blockId="attest-complete"
        blocks={[FULL_ATTEST_BLOCK]}
        hierarchyContext={HIERARCHY_CONTEXT}
        onEdit={noop}
      />
    );
    const section = screen.getByTestId('attestation-triple');
    expect(within(section).getByText(/^Target:?$/i)).toBeInTheDocument();
    expect(within(section).getByText(/^Verification source:?$/i)).toBeInTheDocument();
    expect(within(section).getByText(/^Operator attestation:?$/i)).toBeInTheDocument();
    expect(
      within(section).getByText(/Release submitted to primary distributor/i)
    ).toBeInTheDocument();
    expect(within(section).getByText(/DistroKid dashboard/)).toBeInTheDocument();
    expect(within(section).getByText(/Operator confirms submission status/i)).toBeInTheDocument();
  });

  it('renders "Missing" for each absent attestation-triple field', () => {
    render(
      <BlockDetailsPanel
        blockId="attest-missing"
        blocks={[ATTEST_MISSING_BLOCK]}
        hierarchyContext={HIERARCHY_CONTEXT}
        onEdit={noop}
      />
    );
    const section = screen.getByTestId('attestation-triple');
    // Two "Missing" markers — target is declared in this fixture so the
    // gate fires for the two absent fields (verificationSource, operatorAttestation).
    expect(within(section).getAllByText(/^Missing$/).length).toBeGreaterThanOrEqual(2);
  });

  it('surfaces MISSING_VERIFICATION_SOURCE and MISSING_OPERATOR_ATTESTATION in the failure banner when absent', () => {
    render(
      <BlockDetailsPanel
        blockId="attest-missing"
        blocks={[ATTEST_MISSING_BLOCK]}
        hierarchyContext={HIERARCHY_CONTEXT}
        onEdit={noop}
      />
    );
    expect(screen.getByText(/Plan quality failed for this block detail/i)).toBeInTheDocument();
    expect(screen.getByText(/MISSING_VERIFICATION_SOURCE/)).toBeInTheDocument();
    expect(screen.getByText(/MISSING_OPERATOR_ATTESTATION/)).toBeInTheDocument();
  });

  it('does NOT show the failure banner when full attestation triple is present (and lane is canonical)', () => {
    render(
      <BlockDetailsPanel
        blockId="attest-complete"
        blocks={[FULL_ATTEST_BLOCK]}
        hierarchyContext={HIERARCHY_CONTEXT}
        onEdit={noop}
      />
    );
    expect(screen.queryByText(/MISSING_VERIFICATION_SOURCE/)).not.toBeInTheDocument();
    expect(screen.queryByText(/MISSING_OPERATOR_ATTESTATION/)).not.toBeInTheDocument();
  });

  it('reframes the legacy synthesized completion content as "Operator instructions" (suggestion, not truth claim)', () => {
    render(
      <BlockDetailsPanel
        blockId="attest-missing"
        blocks={[ATTEST_MISSING_BLOCK]}
        hierarchyContext={HIERARCHY_CONTEXT}
        onEdit={noop}
      />
    );
    expect(screen.getByText(/Operator instructions/i)).toBeInTheDocument();
    expect(
      screen.getByText(/operator must verify and attest/i)
    ).toBeInTheDocument();
  });
});
