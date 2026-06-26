import React from 'react';
import '@testing-library/jest-dom';
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

import BlockDetailsPanel from '../../src/components/zion/BlockDetailsPanel.jsx';

const noop = vi.fn();

/**
 * Browser-surface regression: the first activated calendar block must not
 * render "Plan quality failed for this block detail" or surface the codes
 * UNKNOWN_LANE_IDENTITY / LANE_CONTEXT_NOT_APPLIED. This guards the
 * BlockDetailsPanel against the live failure observed when the panel rendered
 * the Operation Endgame hard-anchor protection block as not execution-ready
 * despite the audit reporting STANDARD_COMPLIANT.
 */

function buildActivatedHardAnchorBlock(overrides = {}) {
  // Shape mirrors the activated schedule_active block produced by
  // activateSchedule after the canonical-context preservation fix —
  // i.e. what state.blockStore.blocks now stores.
  return {
    id: 'activated-confirm-hard-anchors',
    cycleId: 'cycle-hard-anchor',
    goalId: 'goal-operation-endgame',
    origin: 'schedule_active',
    suggestionId: 'p-hard-anchor',
    laneId: 'lane-operations',
    laneLabel: 'Operation Endgame studio operations system',
    entityId: 'global-state-solutions',
    entityLabel: 'Global State Solutions',
    phaseId: 'phase-p1',
    phaseLabel: 'P1',
    workType: 'Validation',
    masterPlanId: 'plan-operation-endgame',
    masterPlanLaneId: 'lane-operations',
    initiativeLabel: 'Operating System',
    projectLabel: 'Operating System',
    milestoneType: 'gate',
    derivedFrom: 'master_plan_fixed_anchors',
    derivationReason: 'master_plan_fixed_anchors',
    producesArtifact: 'Validated hard-anchor rule set with explicit non-movable constraints and allowed reflow rules.',
    expectedOutput: 'Validated hard-anchor rule set with explicit non-movable constraints and allowed reflow rules.',
    passEvidence:
      'Written hard-anchor protection rule set showing preserved fixed anchors, allowed schedule reflow boundaries, and the next reassessment trigger.',
    acceptanceEvidence:
      'Written hard-anchor protection rule set showing preserved fixed anchors, allowed schedule reflow boundaries, and the next reassessment trigger.',
    missConsequence: 'Anchor drift weakens every downstream lane sequence.',
    completionAssertion:
      'Completing this asserts the operator produced a validated hard-anchor rule set and it meets the stated completion condition.',
    consumedBy: ['masterPlanLane:lane-operations'],
    consumedByRef: { type: 'masterPlanLane', id: 'lane-operations' },
    // Attestation contract — canonical triple
    target: 'Validated hard-anchor protection rules linked to fixed anchors and preserved mandatory work',
    verificationSource: 'Operation Endgame plan-quality review record',
    operatorAttestation:
      'Operator opens the plan-quality review record, confirms the hard-anchor protection rules cover every fixed anchor, and attests completion.',
    title: 'Validate Operation Endgame hard-anchor protection rules',
    label: 'Validate Operation Endgame hard-anchor protection rules',
    practice: 'Focus',
    domain: 'FOCUS',
    start: '2026-06-22T16:00:00.000Z',
    end: '2026-06-22T16:45:00.000Z',
    status: 'planned',
    requiredSystemBlock: true,
    ...overrides,
  };
}

describe('BlockDetailsPanel — first activated calendar block detail-authority', () => {
  it('does not render the plan-quality failure banner or lane-identity failure codes for the hard-anchor protection block', () => {
    render(
      <BlockDetailsPanel
        blockId="activated-confirm-hard-anchors"
        blocks={[buildActivatedHardAnchorBlock()]}
        hierarchyContext={{
          operatingCycle: 'Foundation / Launch Proof',
          sprint: 'Jun 22 — Oct 17',
          lane: 'Operation Endgame studio operations system',
          initiative: 'Operating System',
        }}
        onEdit={noop}
      />
    );

    expect(screen.queryByText(/Plan quality failed for this block detail/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/UNKNOWN_LANE_IDENTITY/)).not.toBeInTheDocument();
    expect(screen.queryByText(/LANE_CONTEXT_NOT_APPLIED/)).not.toBeInTheDocument();
    expect(
      screen.queryByText(/Jericho should not treat this breakdown as execution-ready\./i)
    ).not.toBeInTheDocument();

    // Sanity — canonical hierarchy still surfaces.
    expect(screen.getByText(/^Hierarchy$/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Operation Endgame studio operations system/i).length).toBeGreaterThan(0);
  });

  it('still surfaces the failure banner when an activated block has no lane identity anywhere', () => {
    render(
      <BlockDetailsPanel
        blockId="orphan-activated"
        blocks={[
          buildActivatedHardAnchorBlock({
            id: 'orphan-activated',
            laneId: null,
            laneLabel: null,
            masterPlanLaneId: null,
            masterPlanId: null,
            entityId: null,
            entityLabel: null,
            initiativeLabel: null,
            projectLabel: null,
            derivedFrom: null,
            derivationReason: null,
            title: 'Unspecified validation block',
            label: 'Unspecified validation block',
          }),
        ]}
        hierarchyContext={null}
        onEdit={noop}
      />
    );

    expect(screen.getByText(/Plan quality failed for this block detail/i)).toBeInTheDocument();
    expect(screen.getByText(/UNKNOWN_LANE_IDENTITY/)).toBeInTheDocument();
  });
});
