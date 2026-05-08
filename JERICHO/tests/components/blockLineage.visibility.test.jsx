import React from 'react';
import '@testing-library/jest-dom';
import { describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import BlockColumn from '../../src/components/zion/BlockColumn.jsx';
import ZionWeekView from '../../src/components/zion/views/ZionWeekView.jsx';
import ZionMonthView from '../../src/components/zion/views/ZionMonthView.jsx';

function buildBlock(overrides = {}) {
  return {
    id: 'blk-1',
    start: '2026-03-10T09:00:00.000Z',
    end: '2026-03-10T10:00:00.000Z',
    status: 'planned',
    title: 'Draft deliverable',
    label: 'Draft deliverable',
    practice: 'Creation',
    domain: 'CREATION',
    deliverableId: 'deliv-1',
    criterionId: 'crit-1',
    ...overrides,
  };
}

describe('block lineage visibility', () => {
  it('renders deliverable and criterion lineage on the day block card', () => {
    render(
      <BlockColumn
        dateLabel="2026-03-10"
        blocks={[buildBlock()]}
        deliverableLabelById={{ 'deliv-1': 'Draft deliverable' }}
        criterionLabelById={{ 'crit-1': 'Close the loop' }}
      />
    );

    expect(screen.getByText(/Serves:\s*Draft deliverable/i)).toBeInTheDocument();
    expect(screen.getByText(/Why:\s*Close the loop/i)).toBeInTheDocument();
  });

  it('renders earlier-open predecessor state on the week surface', () => {
    render(
      <ZionWeekView
        days={[
          {
            dayKey: '2026-03-10',
            label: 'Tue',
            completedCount: 1,
            plannedCount: 2,
            completionRate: 0.5,
            blocks: [
              buildBlock({ id: 'blk-early', title: 'Earlier block', label: 'Earlier block', status: 'planned' }),
              buildBlock({ id: 'blk-late', title: 'Later block', label: 'Later block', status: 'completed' }),
            ],
          },
        ]}
        lineageBlocks={[
          buildBlock({ id: 'blk-early', title: 'Earlier block', label: 'Earlier block', status: 'planned' }),
          buildBlock({ id: 'blk-late', title: 'Later block', label: 'Later block', status: 'completed' }),
        ]}
        deliverableLabelById={{ 'deliv-1': 'Draft deliverable' }}
        criterionLabelById={{ 'crit-1': 'Close the loop' }}
      />
    );

    expect(screen.getByText(/Later block/i)).toBeInTheDocument();
    expect(screen.getByText(/Earlier open:\s*Earlier block/i)).toBeInTheDocument();
  });

  it('renders lineage in the month summary cell', () => {
    render(
      <ZionMonthView
        days={[
          {
            date: '2026-03-10',
            dayNumber: 10,
            inMonth: true,
            plannedCount: 2,
            completedCount: 1,
            completionRate: 0.5,
            blocks: [
              buildBlock({ id: 'blk-early', title: 'Earlier block', label: 'Earlier block', status: 'planned' }),
              buildBlock({ id: 'blk-late', title: 'Later block', label: 'Later block', status: 'completed' }),
            ],
            moreCount: 0,
          },
        ]}
        lineageBlocks={[
          buildBlock({ id: 'blk-early', title: 'Earlier block', label: 'Earlier block', status: 'planned' }),
          buildBlock({ id: 'blk-late', title: 'Later block', label: 'Later block', status: 'completed' }),
        ]}
        deliverableLabelById={{ 'deliv-1': 'Draft deliverable' }}
        criterionLabelById={{ 'crit-1': 'Close the loop' }}
      />
    );

    const dayCell = document.querySelector('[data-day="2026-03-10"]');
    expect(dayCell).toBeInTheDocument();
    expect(within(dayCell).getByText(/Later block/i)).toBeInTheDocument();
    expect(within(dayCell).getByText(/Earlier open:\s*Earlier block/i)).toBeInTheDocument();
  });

  it('preserves more month-card title meaning with two-line clamped rendering', () => {
    render(
      <ZionMonthView
        days={[
          {
            date: '2026-03-11',
            dayNumber: 11,
            inMonth: true,
            plannedCount: 1,
            completedCount: 0,
            completionRate: 0,
            blocks: [
              buildBlock({
                id: 'blk-sql',
                title: 'Write SELECT, WHERE, ORDER BY, and aggregate practice queries',
                label: 'Write SELECT, WHERE, ORDER BY, and aggregate practice queries',
                status: 'planned',
              }),
            ],
            moreCount: 0,
          },
        ]}
        lineageBlocks={[
          buildBlock({
            id: 'blk-sql',
            title: 'Write SELECT, WHERE, ORDER BY, and aggregate practice queries',
            label: 'Write SELECT, WHERE, ORDER BY, and aggregate practice queries',
            status: 'planned',
          }),
        ]}
        deliverableLabelById={{ 'deliv-1': 'SQL fundamentals query practice baseline' }}
        criterionLabelById={{ 'crit-1': 'Demonstrate SQL fluency' }}
      />
    );

    const titleNode = screen.getByText('Write SELECT, WHERE, ORDER BY, and aggregate practice queries');
    expect(titleNode).toBeInTheDocument();
    expect(titleNode).not.toHaveClass('truncate');
    expect(titleNode).toHaveStyle({
      display: '-webkit-box',
      overflow: 'hidden',
    });
    expect(titleNode.style.WebkitLineClamp).toBe('2');
  });

  it('renders a deterministic gap reason label when a month day has no scheduled blocks', () => {
    render(
      <ZionMonthView
        days={[
          {
            date: '2026-03-12',
            dayNumber: 12,
            inMonth: true,
            plannedCount: 0,
            completedCount: 0,
            completionRate: 0,
            blocks: [],
            moreCount: 0,
            gapReasonLabel: 'Gap: no remaining blocks',
          },
        ]}
        lineageBlocks={[]}
        deliverableLabelById={{}}
        criterionLabelById={{}}
      />
    );

    const dayCell = document.querySelector('[data-day="2026-03-12"]');
    expect(dayCell).toBeInTheDocument();
    expect(within(dayCell).getByText(/Gap: no remaining blocks/i)).toBeInTheDocument();
  });
});
