import React from 'react';
import '@testing-library/jest-dom';
import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import PlanningPanel from '../../src/components/zion/PlanningPanel.jsx';
import AddBlockBar from '../../src/components/zion/AddBlockBar.jsx';
import BlockDetailsPanel from '../../src/components/zion/BlockDetailsPanel.jsx';

const noop = vi.fn();

function sampleBlock(overrides = {}) {
  return {
    id: 'blk-1',
    start: '2026-03-10T09:00:00.000Z',
    end: '2026-03-10T10:00:00.000Z',
    status: 'planned',
    title: 'Define season scope',
    label: 'FOCUS - Define season scope',
    practice: 'Focus',
    domain: 'FOCUS',
    ...overrides,
  };
}

describe('execution surface action-first rendering', () => {
  it('renders day-detail rows with task title, not category-prefixed descriptor', () => {
    render(
      <PlanningPanel
        surface="today"
        selectedDayKey="2026-03-10"
        blocks={[sampleBlock()]}
        selectedBlockId={null}
        onSelectBlock={noop}
        onAddBlock={noop}
      />
    );

    expect(screen.getByText('Define season scope')).toBeInTheDocument();
    expect(screen.queryByText(/Focus\s*·/i)).not.toBeInTheDocument();
  });

  it('does not expose domain/category selector in Add Block bar', () => {
    render(<AddBlockBar surface="today" dateKey="2026-03-10" defaultDayKey="2026-03-10" onAdd={noop} />);

    expect(screen.queryByRole('option', { name: /Body/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('option', { name: /Resources/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('option', { name: /Creation/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('option', { name: /Focus/i })).not.toBeInTheDocument();
  });

  it('renders block details using the stored block label and status line', () => {
    render(<BlockDetailsPanel blockId="blk-1" blocks={[sampleBlock()]} onEdit={noop} />);

    const card = screen.getByText(/Block details/i).closest('div');
    expect(card).toBeTruthy();
    expect(within(card).getByText('FOCUS - Define season scope')).toBeInTheDocument();
    expect(within(card).getByText(/Focus\s*·\s*planned/i)).toBeInTheDocument();
  });

  it('renders deliverable linkage alongside criterion linkage when present', () => {
    render(
      <BlockDetailsPanel
        blockId="blk-1"
        blocks={[sampleBlock({ deliverableId: 'deliv-1', criterionId: 'crit-1' })]}
        deliverableLabelById={{ 'deliv-1': 'Draft deliverable' }}
        criterionLabelById={{ 'crit-1': 'Close the loop' }}
        onEdit={noop}
      />
    );

    const card = screen.getByText(/Block details/i).closest('div');
    expect(card).toBeTruthy();
    expect(within(card).getByText(/Serves:\s*Draft deliverable/i)).toBeInTheDocument();
    expect(within(card).getByText(/Why:\s*Close the loop/i)).toBeInTheDocument();
  });

  it('keeps the Complete action available on non-today surfaces for valid active blocks', () => {
    render(<BlockDetailsPanel blockId="blk-1" blocks={[sampleBlock()]} surface="month" onEdit={noop} />);

    expect(screen.getByRole('button', { name: /Complete/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Reschedule/i })).toBeInTheDocument();
  });

  it('surfaces an earlier open predecessor when a later block is selected first', () => {
    render(
      <BlockDetailsPanel
        blockId="blk-2"
        blocks={[
          sampleBlock({ id: 'blk-1', title: 'Earlier block', label: 'Earlier block', status: 'planned' }),
          sampleBlock({ id: 'blk-2', title: 'Later block', label: 'Later block', status: 'completed' }),
        ]}
        onEdit={noop}
      />
    );

    const card = screen.getByText(/Block details/i).closest('div');
    expect(card).toBeTruthy();
    expect(within(card).getByText(/Earlier open:\s*Earlier block/i)).toBeInTheDocument();
  });
});
