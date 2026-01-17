import React from 'react';
import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import PlanningPanel from '../zion/PlanningPanel.jsx';

describe('review mode gating', () => {
  it('disables mutating controls when readOnly is true', () => {
    const markup = renderToStaticMarkup(
      <PlanningPanel
        surface="today"
        selectedDayKey="2026-01-08"
        blocks={[
          {
            id: 'blk-1',
            label: 'Test block',
            practice: 'Focus',
            domain: 'Focus',
            start: '2026-01-08T09:00:00.000Z',
            end: '2026-01-08T09:30:00.000Z',
            status: 'planned'
          }
        ]}
        selectedBlockId="blk-1"
        readOnly={true}
      />
    );

    expect(markup).toContain('disabled');
  });
});
