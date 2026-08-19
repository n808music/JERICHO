import React from 'react';
import '@testing-library/jest-dom';
import { describe, it, expect, afterEach } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import BlockDetailsPanel from '../../src/components/zion/BlockDetailsPanel.jsx';

afterEach(() => {
  cleanup();
});

describe('BlockDetailsPanel enterprise header', () => {
  const baseBlock = {
    id: 'b1',
    start: '2026-06-10T09:00:00.000Z',
    end: '2026-06-10T10:00:00.000Z',
    label: 'Operations review',
    laneId: 'civic',
    domain: 'civic',
    practice: 'FOCUS',
    status: 'pending',
  };

  it('shows Global State Holdings for a civic block', () => {
    render(
      <BlockDetailsPanel
        blockId="b1"
        blocks={[baseBlock]}
        hierarchyContext={{
          masterPlan: { laneIds: ['civic'] },
          lane: 'Civic',
        }}
        enterpriseContext={{
          intakeSignals: { goalText: 'civic', declaredLaneIds: ['civic'] },
        }}
      />,
    );
    expect(screen.getByText('Global State Holdings')).toBeInTheDocument();
  });

  it('shows F8 Energy Co. (never E8) for an energy_gym block', () => {
    render(
      <BlockDetailsPanel
        blockId="b1"
        blocks={[{ ...baseBlock, laneId: 'energy_gym', domain: 'energy_gym' }]}
        hierarchyContext={{ lane: 'Energy Gym' }}
        enterpriseContext={{
          intakeSignals: { goalText: 'energy gym', declaredLaneIds: ['energy_gym'] },
        }}
      />,
    );
    expect(screen.getByText('F8 Energy Co.')).toBeInTheDocument();
    expect(screen.queryByText(/E8 Energy Co\./)).toBeNull();
  });
});
