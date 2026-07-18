import React from 'react';
import '@testing-library/jest-dom';
import { describe, expect, it, vi, afterEach } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';

import BlockDetailsPanel from '../../src/components/zion/BlockDetailsPanel.jsx';

const noop = vi.fn();

afterEach(() => cleanup());

/**
 * Regression: live first-block / planned-block detail authority continued to
 * emit UNKNOWN_LANE_IDENTITY / LANE_CONTEXT_NOT_APPLIED on screenshots where
 * the displayed lane string was visible (via title inference) but the
 * underlying block was missing its canonical laneLabel — only carrying
 * laneId / masterPlanLaneId.
 *
 * ZionDashboard now threads `lanesById` (the masterPlanLanesById map) through
 * hierarchyContext. BlockDetailsPanel looks the block's laneId up in that map
 * and feeds the canonical lane title to the hierarchy resolver, so the
 * downstream molecular gate sees canonical context instead of an empty fallback.
 */

const STRIPPED_BLOCK = {
  id: 'planned-hard-anchor',
  origin: 'derived',
  title: 'Validate hard-anchor protection rules',
  label: 'Validate hard-anchor protection rules',
  laneId: 'lane-operations',
  laneLabel: null, // ← intentionally stripped to reproduce the live defect
  start: '2026-07-15T16:00:00.000Z',
  end: '2026-07-15T16:45:00.000Z',
  status: 'planned',
  practice: 'FOCUS',
  domain: 'FOCUS',
  // Attestation contract — canonical triple so this lane-recovery test
  // does not also fail on the attestation contract codes.
  target: 'Validated hard-anchor protection rules linked to fixed anchors',
  verificationSource: 'Operation Endgame plan-quality review record',
  operatorAttestation:
    'Operator opens the plan-quality review record and attests the hard-anchor rules are validated.',
};

const CANONICAL_LANES_BY_ID = {
  'lane-operations': {
    id: 'lane-operations',
    domain: 'brand',
    title: 'Operation Endgame studio operations system',
    label: 'Operation Endgame studio operations system',
  },
};

describe('BlockDetailsPanel — canonical lane lookup via lanesById', () => {
  it('does NOT render plan-quality failure when block has laneId but lanesById exposes the canonical lane', () => {
    render(
      <BlockDetailsPanel
        blockId="planned-hard-anchor"
        blocks={[STRIPPED_BLOCK]}
        hierarchyContext={{
          phase: 'P1 / Foundation / Launch Proof',
          operatingCycle: 'Foundation / Launch Proof',
          sprint: 'Jul 15 — Oct 17',
          lanesById: CANONICAL_LANES_BY_ID,
        }}
        onEdit={noop}
      />
    );

    expect(screen.queryByText(/Plan quality failed for this block detail/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/UNKNOWN_LANE_IDENTITY/)).not.toBeInTheDocument();
    expect(screen.queryByText(/LANE_CONTEXT_NOT_APPLIED/)).not.toBeInTheDocument();
  });

  it('still renders the plan-quality failure when block has neither laneId nor a lanesById entry', () => {
    render(
      <BlockDetailsPanel
        blockId="orphan-planned"
        blocks={[
          {
            ...STRIPPED_BLOCK,
            id: 'orphan-planned',
            laneId: null,
            masterPlanLaneId: null,
            title: 'Unspecified validation block',
            label: 'Unspecified validation block',
          },
        ]}
        hierarchyContext={{
          phase: 'P1 / Foundation / Launch Proof',
          operatingCycle: 'Foundation / Launch Proof',
          sprint: 'Jul 15 — Oct 17',
          lanesById: CANONICAL_LANES_BY_ID,
        }}
        onEdit={noop}
      />
    );

    expect(screen.getByText(/Plan quality failed for this block detail/i)).toBeInTheDocument();
    expect(screen.getByText(/UNKNOWN_LANE_IDENTITY/)).toBeInTheDocument();
  });
});
