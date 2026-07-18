import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CalendarScopeToggle } from './CalendarScopeToggle.jsx';

const options = {
  Entity: [{ id: 'e1', label: 'Global State Corp', count: 3 }],
  Initiative: [{ id: 'i1', label: 'Jericho System', count: 2 }],
  Project: [{ id: 'p1', label: 'Alpha', count: 1 }],
  Deliverable: [],
  System: [
    { id: 's1', label: 'music system', count: 3, unowned: false },
    { id: 's3', label: 'Marketing flywheel', count: 0, unowned: true },
  ],
};

describe('CalendarScopeToggle (Gate 8)', () => {
  it('renders Full + a class chip only for classes that have options', () => {
    render(<CalendarScopeToggle options={options} scope="full" onScope={() => {}} />);
    expect(screen.getByTestId('calendar-scope-full')).toBeTruthy();
    expect(screen.getByTestId('calendar-scope-class-Entity')).toBeTruthy();
    expect(screen.getByTestId('calendar-scope-class-System')).toBeTruthy();
    expect(screen.queryByTestId('calendar-scope-class-Deliverable')).toBeNull(); // no options → no chip
  });

  it('expanding a class reveals node options; clicking one sets a node-level scope', () => {
    const onScope = vi.fn();
    render(<CalendarScopeToggle options={options} scope="full" onScope={onScope} />);
    fireEvent.click(screen.getByTestId('calendar-scope-class-Entity'));
    const nodes = screen.getAllByTestId('calendar-scope-node');
    expect(nodes).toHaveLength(1);
    fireEvent.click(nodes[0]);
    expect(onScope).toHaveBeenCalledWith({ kind: 'Entity', id: 'e1' });
  });

  it('surfaces an unowned System as its own explicit (unowned) option', () => {
    render(<CalendarScopeToggle options={options} scope="full" onScope={() => {}} />);
    fireEvent.click(screen.getByTestId('calendar-scope-class-System'));
    expect(screen.getByText(/Marketing flywheel \(unowned\)/)).toBeTruthy();
    expect(screen.getByText(/music system · 3/)).toBeTruthy();
  });

  it('Full resets the scope', () => {
    const onScope = vi.fn();
    render(<CalendarScopeToggle options={options} scope={{ kind: 'Entity', id: 'e1' }} onScope={onScope} />);
    fireEvent.click(screen.getByTestId('calendar-scope-full'));
    expect(onScope).toHaveBeenCalledWith('full');
  });

  it('renders nothing when no class has options (no blocks to isolate)', () => {
    const { container } = render(<CalendarScopeToggle options={{}} scope="full" onScope={() => {}} />);
    expect(container.firstChild).toBeNull();
  });
});
