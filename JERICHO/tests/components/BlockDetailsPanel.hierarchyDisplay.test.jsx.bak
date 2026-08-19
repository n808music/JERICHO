import React from 'react';
import '@testing-library/jest-dom';
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

import BlockDetailsPanel from '../../src/components/zion/BlockDetailsPanel.jsx';

const noop = vi.fn();

function sampleBlock(overrides = {}) {
  return {
    id: 'blk-1',
    start: '2026-06-08T09:00:00.000Z',
    end: '2026-06-08T10:00:00.000Z',
    startDayKey: '2026-06-08',
    endDayKey: '2026-06-19',
    status: 'planned',
    title: 'Clarify launch-blocker requirements',
    label: 'Clarify launch-blocker requirements',
    practice: 'Focus',
    domain: 'FOCUS',
    phaseLabel: 'P1',
    laneLabel: 'Product / Software',
    ...overrides,
  };
}

describe('BlockDetailsPanel hierarchy display', () => {
  it('renders the full hierarchy when metadata is present', () => {
    render(
      <BlockDetailsPanel
        blockId="blk-1"
        blocks={[sampleBlock({ initiative: 'Jericho System' })]}
        hierarchyContext={{
          operatingCycle: 'June 2026 Operating Cycle',
        }}
        onEdit={noop}
      />
    );

    expect(screen.getByText(/^Hierarchy$/i)).toBeInTheDocument();
    expect(
      screen.getByText(
        /Operation Endgame → P1 Launch \/ Proof → June 2026 Operating Cycle → Jun 8–Jun 19 Sprint → Product \/ Software → Jericho System/i
      )
    ).toBeInTheDocument();
    expect(
      screen.getByText((_, node) => node?.textContent === 'Block: Clarify launch-blocker requirements')
    ).toBeInTheDocument();
    expect(screen.getByText(/What this means/i)).toBeInTheDocument();
    expect(
      screen.getByText(/Translate Clarify launch-blocker requirements into plain operator work with a concrete result and observable completion standard\./i)
    ).toBeInTheDocument();
    expect(screen.getByText(/Formal title:/i)).toBeInTheDocument();
  });

  it('falls back to the lane when initiative is missing', () => {
    render(<BlockDetailsPanel blockId="blk-1" blocks={[sampleBlock()]} onEdit={noop} />);

    expect(
      screen.getByText(/Operation Endgame → P1 Launch \/ Proof → Jun 8–Jun 19 Sprint → Product \/ Software/i)
    ).toBeInTheDocument();
  });

  it('handles missing sprint and cycle metadata gracefully', () => {
    render(
      <BlockDetailsPanel
        blockId="blk-1"
        blocks={[
          sampleBlock({
            startDayKey: null,
            endDayKey: null,
            laneLabel: 'Operations / Systems',
            phaseLabel: 'P2',
          }),
        ]}
        onEdit={noop}
      />
    );

    expect(screen.getByText(/Operation Endgame → P2 Conversion \/ Operating System → Operations \/ Systems/i)).toBeInTheDocument();
    expect(screen.queryByText(/Sprint/i)).not.toBeInTheDocument();
  });

  it('keeps execution controls available alongside hierarchy display', () => {
    render(
      <BlockDetailsPanel
        blockId="blk-1"
        blocks={[sampleBlock({ initiative: 'Jericho System' })]}
        hierarchyContext={{ operatingCycle: 'June 2026 Operating Cycle' }}
        onComplete={noop}
        onMiss={noop}
        onEdit={noop}
      />
    );

    expect(screen.getByRole('button', { name: /^Complete$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Missed$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Reschedule$/i })).toBeInTheDocument();
  });

  it('shows initiative-aware names when a block uses Operation Endgame substrate labels', () => {
    render(
      <BlockDetailsPanel
        blockId="blk-1"
        blocks={[
          sampleBlock({
            title: 'Validate onboarding path for Operation Endgame app platform in P1 product/software lane',
            label: 'Validate onboarding path for Operation Endgame app platform in P1 product/software lane',
            laneLabel: 'Operation Endgame app platform',
          }),
        ]}
        hierarchyContext={{ operatingCycle: 'June 2026 Operating Cycle' }}
        onEdit={noop}
      />
    );

    expect(
      screen.getByText(
        /Operation Endgame → P1 Launch \/ Proof → June 2026 Operating Cycle → Jun 8–Jun 19 Sprint → Product \/ Software → Jericho System/i
      )
    ).toBeInTheDocument();
  });

  it('renders a plain-language onboarding breakdown for formal launch-blocker test work', () => {
    render(
      <BlockDetailsPanel
        blockId="blk-1"
        blocks={[
          sampleBlock({
            title:
              'Run unit and integration tests for Operation Endgame product platform onboarding implementation using launch blocker clearance for the May 2026 review window',
            label:
              'Run unit and integration tests for Operation Endgame product platform onboarding implementation using launch blocker clearance for the May 2026 review window',
            laneLabel: 'Operation Endgame app platform',
          }),
        ]}
        hierarchyContext={{ operatingCycle: 'June 2026 Operating Cycle' }}
        onEdit={noop}
      />
    );

    expect(screen.getByText(/What this means/i)).toBeInTheDocument();
    expect(screen.getByText(/Test Jericho onboarding and login behavior enough to clear the current launch blocker/i)).toBeInTheDocument();
    expect(screen.getByText(/Open the app as a user/i)).toBeInTheDocument();
    expect(screen.getByText(/Produces:/i)).toBeInTheDocument();
    expect(
      screen.getByText(
        (_, node) => node?.textContent === 'Produces: Run unit and integration tests with handoff record'
      )
    ).toBeInTheDocument();
    expect(screen.getByText(/Original May 2026 review window · Current June 2026 Operating Cycle/i)).toBeInTheDocument();
  });

  it('resolves raw lane ids to canonical enterprise labels instead of showing Lane: Missing', () => {
    render(
      <BlockDetailsPanel
        blockId="blk-1"
        blocks={[
          sampleBlock({
            laneId: 'product',
            laneLabel: '',
            title: 'Validate onboarding path for the current product lane',
            label: 'Validate onboarding path for the current product lane',
            requiredSystemBlock: true,
          }),
        ]}
        hierarchyContext={{ operatingCycle: 'June 2026 Operating Cycle' }}
        enterpriseContext={{
          intakeSignals: {
            goalText: 'Build product, creative, media, operations, revenue, capital, institution, and civic pathways.',
            declaredLaneIds: ['product'],
          },
        }}
        onEdit={noop}
      />
    );

    expect(screen.getByText((_, node) => node?.textContent === 'Lane: Global State Systems')).toBeInTheDocument();
    expect(screen.getByText((_, node) => node?.textContent === 'Entity: Global State Systems')).toBeInTheDocument();
    expect(screen.queryByText((_, node) => node?.textContent === 'Lane: Missing')).not.toBeInTheDocument();
  });

  it('renders hard-anchor protection work with concrete explanation, validation work type, and completed artifact language', () => {
    render(
      <BlockDetailsPanel
        blockId="blk-1"
        blocks={[
          sampleBlock({
            laneId: 'brand',
            laneLabel: 'Operation Endgame studio operations system',
            title: 'Validate Operation Endgame hard-anchor protection rules',
            label: 'Validate Operation Endgame hard-anchor protection rules',
          }),
        ]}
        hierarchyContext={{ operatingCycle: 'June 2026 Operating Cycle' }}
        enterpriseContext={{
          intakeSignals: {
            goalText: 'Coordinate Operation Endgame across product, media, operations, revenue, capital, institution, and civic pathways.',
            declaredLaneIds: ['brand'],
          },
        }}
        onEdit={noop}
      />
    );

    expect(screen.getByText(/keep fixed Operation Endgame anchors from moving/i)).toBeInTheDocument();
    expect(screen.getByText((_, node) => node?.textContent === 'Lane: Operation Endgame studio operations system')).toBeInTheDocument();
    expect(screen.getByText((_, node) => node?.textContent === 'Entity: Global State Solutions')).toBeInTheDocument();
    expect(screen.getAllByText((_, node) => node?.textContent === 'Work type: Validation').length).toBeGreaterThan(0);
    expect(screen.getByText((_, node) => node?.textContent === 'Produces: Validated hard-anchor rule set')).toBeInTheDocument();
  });

  it('renders launch asset inventory work with non-repetitive detail language', () => {
    render(
      <BlockDetailsPanel
        blockId="blk-1"
        blocks={[
          sampleBlock({
            laneLabel: 'Operation Endgame media narrative pipeline',
            title: 'Document album, app, and podcast launch asset inventory',
            label: 'Document album, app, and podcast launch asset inventory',
          }),
        ]}
        hierarchyContext={{ operatingCycle: 'June 2026 Operating Cycle' }}
        onEdit={noop}
      />
    );

    expect(screen.getByText(/which .* launch assets already exist/i)).toBeInTheDocument();
    expect(screen.getByText(/List every album, app, and podcast launch asset/i)).toBeInTheDocument();
    expect(screen.getByText((_, node) => node?.textContent === 'Produces: Documented launch asset inventory with status and ownership map')).toBeInTheDocument();
    expect(screen.getAllByText((_, node) => node?.textContent === 'Work type: Planning').length).toBeGreaterThan(0);
  });

  it('shows explicit P1 justification for future-phase prerequisite governance work', () => {
    render(
      <BlockDetailsPanel
        blockId="blk-1"
        blocks={[
          sampleBlock({
            title: 'Define timing-slip non-negotiables',
            label: 'Define timing-slip non-negotiables',
          }),
        ]}
        hierarchyContext={{ operatingCycle: 'June 2026 Operating Cycle' }}
        onEdit={noop}
      />
    );

    expect(screen.getByText((_, node) => node?.textContent === 'Lane: Operation Endgame studio operations system')).toBeInTheDocument();
    expect(screen.getByText((_, node) => node?.textContent === 'Entity: Global State Solutions')).toBeInTheDocument();
    expect(screen.getByText((_, node) => node?.textContent === 'Project/Program: Operating System')).toBeInTheDocument();
    expect(screen.getAllByText((_, node) => node?.textContent === 'P1 justification: Hard-anchor protection').length).toBeGreaterThan(0);
  });
});
