import React from 'react';
import '@testing-library/jest-dom';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, afterEach, vi } from 'vitest';
import CalendarSourceCutoverControl from '../../src/components/zion/CalendarSourceCutoverControl.jsx';

afterEach(() => cleanup());

describe('CalendarSourceCutoverControl', () => {
  it('labels which source is live (operator-visible, no silent drift)', () => {
    render(<CalendarSourceCutoverControl label="Calendar source: Forecast (full-horizon)" enabled={false} onToggle={() => {}} />);
    expect(screen.getByText(/Calendar source: Forecast/i)).toBeInTheDocument();
  });

  it('flipping the control invokes onToggle with the next state', async () => {
    const onToggle = vi.fn();
    const user = userEvent.setup();
    render(<CalendarSourceCutoverControl label="Calendar source: Forecast (full-horizon)" enabled={false} onToggle={onToggle} />);
    await user.click(screen.getByRole('button', { name: /matrix|switch|source/i }));
    expect(onToggle).toHaveBeenCalledWith(true);
  });

  it('reflects the enabled (matrix) state', () => {
    render(<CalendarSourceCutoverControl label="Calendar source: Matrix schedule" enabled onToggle={() => {}} />);
    expect(screen.getByText(/Matrix schedule/i)).toBeInTheDocument();
    // When on matrix, the control offers switching back to forecast.
    expect(screen.getByRole('button', { name: /forecast|switch|source/i })).toBeInTheDocument();
  });
});
