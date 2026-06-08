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

    expect(screen.getByText(/Hierarchy/i)).toBeInTheDocument();
    expect(
      screen.getByText(
        /Operation Endgame → P1 Launch \/ Proof → June 2026 Operating Cycle → Jun 8–Jun 19 Sprint → Product \/ Software → Jericho System/i
      )
    ).toBeInTheDocument();
    expect(
      screen.getByText((_, node) => node?.textContent === 'Block: Clarify launch-blocker requirements')
    ).toBeInTheDocument();
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
});
