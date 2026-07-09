import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MasterGridTab } from './MasterGridTab.jsx';

vi.mock('../../state/identityStore.js', () => ({
  useIdentityStore: () => globalThis.__STORE__,
}));

function setStore(matrix) {
  globalThis.__STORE__ = { matrix, matrixDispatch: vi.fn() };
  return globalThis.__STORE__;
}

const baseMatrix = () => ({
  entitiesById: { e1: { id: 'e1', name: 'Global State Corp.', roleTags: [], reviewStatus: 'CONFIRMED', phase: null } },
  initiativesById: {}, projectsById: {}, artifactsById: {}, systemsById: {},
});

describe('MasterGridTab', () => {
  it('renders one row per node with live counts', () => {
    setStore(baseMatrix());
    render(<MasterGridTab onOpenNode={() => {}} />);
    expect(screen.getAllByTestId('mastergrid-row')).toHaveLength(1);
    expect(screen.getByTestId('mastergrid-counts').textContent).toContain('1 nodes');
    expect(screen.getByTestId('mastergrid-counts').textContent).toContain('1 Entities');
  });

  it('empty store renders zero rows and zero counts, not an error', () => {
    setStore({ entitiesById: {}, initiativesById: {}, projectsById: {}, artifactsById: {}, systemsById: {} });
    render(<MasterGridTab onOpenNode={() => {}} />);
    expect(screen.queryAllByTestId('mastergrid-row')).toHaveLength(0);
    expect(screen.getByTestId('mastergrid-counts').textContent).toContain('0 nodes');
  });

  it('row click calls onOpenNode with the node target (AC5)', () => {
    setStore(baseMatrix());
    const onOpenNode = vi.fn();
    render(<MasterGridTab onOpenNode={onOpenNode} />);
    fireEvent.click(screen.getByTestId('mastergrid-row'));
    expect(onOpenNode).toHaveBeenCalledWith({ class: 'Entity', id: 'e1' });
  });

  it('never calls matrixDispatch — no write path (AC4)', () => {
    const store = setStore(baseMatrix());
    const onOpenNode = vi.fn();
    render(<MasterGridTab onOpenNode={onOpenNode} />);
    fireEvent.click(screen.getByTestId('mastergrid-row'));
    expect(store.matrixDispatch).not.toHaveBeenCalled();
  });

  it('reflects a node added to the store on re-render without manual refresh (AC3)', () => {
    setStore(baseMatrix());
    const { rerender } = render(<MasterGridTab onOpenNode={() => {}} />);
    expect(screen.getAllByTestId('mastergrid-row')).toHaveLength(1);
    const m = globalThis.__STORE__.matrix;
    m.initiativesById.i1 = { id: 'i1', name: 'Jericho System', roleTags: [], reviewStatus: 'DRAFT', phase: null };
    rerender(<MasterGridTab onOpenNode={() => {}} />);
    expect(screen.getAllByTestId('mastergrid-row')).toHaveLength(2);
  });
});
