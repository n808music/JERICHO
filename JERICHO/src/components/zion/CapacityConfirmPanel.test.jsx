import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CapacityConfirmPanel } from './CapacityConfirmPanel.jsx';

vi.mock('../../state/identityStore.js', () => ({
  useIdentityStore: () => globalThis.__STORE__,
}));

function setStore(capacityById) {
  globalThis.__STORE__ = { matrix: { capacityById }, matrixDispatch: vi.fn() };
  return globalThis.__STORE__;
}

describe('CapacityConfirmPanel', () => {
  it('renders nothing when there is no capacity data', () => {
    setStore({});
    render(<CapacityConfirmPanel />);
    expect(screen.queryByTestId('capacity-confirm-panel')).toBeNull();
  });

  it('renders a DRAFT row with a Confirm button and a carried-forward note', () => {
    setStore({
      c1: { id: 'c1', name: 'Global State Corp. Capacity', reviewStatus: 'DRAFT', source: 'carried_forward' },
    });
    render(<CapacityConfirmPanel />);
    expect(screen.getAllByTestId('capacity-confirm-row')).toHaveLength(1);
    expect(screen.getByText(/carried forward from existing settings/)).toBeTruthy();
    expect(screen.getByTestId('confirm-capacity-c1')).toBeTruthy();
  });

  it('clicking Confirm dispatches CONFIRM_CAPACITY with the row id — no survey involved', () => {
    const store = setStore({ c1: { id: 'c1', name: 'Global State Corp. Capacity', reviewStatus: 'DRAFT' } });
    render(<CapacityConfirmPanel />);
    fireEvent.click(screen.getByTestId('confirm-capacity-c1'));
    expect(store.matrixDispatch).toHaveBeenCalledWith({ type: 'CONFIRM_CAPACITY', payload: { id: 'c1' } });
  });

  it('does not render a Confirm button for an already-CONFIRMED row', () => {
    setStore({ c1: { id: 'c1', name: 'Global State Corp. Capacity', reviewStatus: 'CONFIRMED' } });
    render(<CapacityConfirmPanel />);
    expect(screen.queryByTestId('confirm-capacity-c1')).toBeNull();
  });

  it('renders one row per capacity entry, independently confirmable', () => {
    setStore({
      c1: { id: 'c1', name: 'Entity One Capacity', reviewStatus: 'DRAFT' },
      c2: { id: 'c2', name: 'Entity Two Capacity', reviewStatus: 'CONFIRMED' },
    });
    render(<CapacityConfirmPanel />);
    expect(screen.getAllByTestId('capacity-confirm-row')).toHaveLength(2);
    expect(screen.getByTestId('confirm-capacity-c1')).toBeTruthy();
    expect(screen.queryByTestId('confirm-capacity-c2')).toBeNull();
  });
});
