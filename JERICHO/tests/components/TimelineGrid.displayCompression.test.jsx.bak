import React from 'react';
import '@testing-library/jest-dom';
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';

import TimelineGrid from '../../src/ui/masterPlan/TimelineGrid.jsx';

const plan = {
  id: 'plan-1',
  title: 'Operation Endgame',
  coreMission: 'Operation Endgame',
  horizonStart: '2027-04-01',
  horizonEnd: '2027-04-30',
  status: 'active',
};

const lanes = [
  {
    id: 'lane-product',
    title: 'Product/software',
    domain: 'product',
    activationState: 'active',
  },
];

describe('TimelineGrid display compression', () => {
  it('renders compressed labels while preserving canonical detail titles for forecast blocks', () => {
    render(
      <TimelineGrid
        plan={plan}
        lanes={lanes}
        forecastBlocks={[
          {
            id: 'forecast-1',
            laneId: 'lane-product',
            dayKey: '2027-04-16',
            title:
              'Assess product/software onboarding evidence against P2 conversion-readiness criteria for Operation Endgame app platform using first-cohort completion data for the Apr 2027 review window',
            canonicalTitle:
              'Assess product/software onboarding evidence against P2 conversion-readiness criteria for Operation Endgame app platform using first-cohort completion data for the Apr 2027 review window',
            detailTitle:
              'Assess product/software onboarding evidence against P2 conversion-readiness criteria for Operation Endgame app platform using first-cohort completion data for the Apr 2027 review window',
            displayTitle: 'Assess product/software onboarding evidence against P2 conversion criteria',
            commitmentState: 'locked',
          },
        ]}
      />
    );

    const block = screen.getByTestId('forecast-block-forecast-1');
    expect(block).toHaveTextContent('Assess product/software onboarding evidence against P2 conversion criteria');
    expect(block).toHaveAttribute(
      'title',
      expect.stringContaining(
        'Assess product/software onboarding evidence against P2 conversion-readiness criteria for Operation Endgame app platform'
      )
    );
  });

  it('renders compressed labels while preserving canonical detail titles for gated blocks', () => {
    render(
      <TimelineGrid
        plan={plan}
        lanes={lanes}
        gatedBlocks={[
          {
            id: 'gated-1',
            laneId: 'lane-product',
            dayKey: '2027-04-23',
            title:
              'Assess terminal-readiness evidence for the cross-lane Operation Endgame review against the success standard and outcome target in Q2 2031',
            canonicalTitle:
              'Assess terminal-readiness evidence for the cross-lane Operation Endgame review against the success standard and outcome target in Q2 2031',
            detailTitle:
              'Assess terminal-readiness evidence for the cross-lane Operation Endgame review against the success standard and outcome target in Q2 2031',
            displayTitle: 'Assess terminal-readiness evidence against success standard in Q2 2031',
            commitmentState: 'review-required',
          },
        ]}
      />
    );

    const block = screen.getByTestId('gated-block-gated-1');
    expect(block).toHaveTextContent('Assess terminal-readiness evidence against success standard in Q2 2031');
    expect(block).toHaveAttribute(
      'title',
      expect.stringContaining('Assess terminal-readiness evidence for the cross-lane Operation Endgame review')
    );
  });
});
