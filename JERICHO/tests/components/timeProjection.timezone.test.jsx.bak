import React from 'react';
import '@testing-library/jest-dom';
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import BlockColumn from '../../src/components/zion/BlockColumn.jsx';
import ZionWeekView from '../../src/components/zion/views/ZionWeekView.jsx';

const CHICAGO_TIME_ZONE = 'America/Chicago';
const NINE_AM_CHICAGO_ISO = '2026-06-15T14:00:00.000Z';

function buildBlock(overrides = {}) {
  return {
    id: 'blk-chicago-0900',
    title: 'Confirm Operation Endgame hard anchors',
    label: 'Confirm Operation Endgame hard anchors',
    start: NINE_AM_CHICAGO_ISO,
    end: '2026-06-15T15:00:00.000Z',
    status: 'planned',
    ...overrides,
  };
}

describe('timezone-aware time projection', () => {
  it('places a Chicago 09:00 block in the 09:00 day-column slot', () => {
    render(
      <BlockColumn
        dateLabel="2026-06-15"
        blocks={[buildBlock()]}
        timeZone={CHICAGO_TIME_ZONE}
      />
    );

    const block = screen.getByTestId('block-blk-chicago-0900');
    expect(block.style.top).toBe('270px');
    expect(block.style.height).toBe('30px');
  });

  it('renders the same stored ISO timestamp as 09:00 on the week surface', () => {
    render(
      <ZionWeekView
        timeZone={CHICAGO_TIME_ZONE}
        days={[
          {
            dayKey: '2026-06-15',
            label: 'Mon',
            completedCount: 0,
            plannedCount: 1,
            completionRate: 0,
            blocks: [buildBlock()],
          },
        ]}
      />
    );

    expect(screen.getByText(/09:00 · Confirm Operation Endgame hard anchors/i)).toBeInTheDocument();
  });
});
