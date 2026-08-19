import React from 'react';
import '@testing-library/jest-dom';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import BlockColumn from '../../src/components/zion/BlockColumn.jsx';

describe('BlockColumn selection feedback', () => {
  it('marks the selected day block as pressed after click-driven selection', () => {
    const handleSelect = vi.fn();
    const block = {
      id: 'blk-1',
      title: 'Deep work block',
      start: '2026-03-10T09:00:00.000Z',
      end: '2026-03-10T10:00:00.000Z',
      status: 'planned',
    };

    const { rerender } = render(
      <BlockColumn dateLabel="2026-03-10" blocks={[block]} onBlockClick={handleSelect} selectedBlockId={null} />
    );

    const button = screen.getByTestId('block-blk-1');
    expect(button).toHaveAttribute('aria-pressed', 'false');

    fireEvent.click(button);
    expect(handleSelect).toHaveBeenCalledWith('blk-1');

    rerender(<BlockColumn dateLabel="2026-03-10" blocks={[block]} onBlockClick={handleSelect} selectedBlockId="blk-1" />);
    expect(screen.getByTestId('block-blk-1')).toHaveAttribute('aria-pressed', 'true');
  });
});
