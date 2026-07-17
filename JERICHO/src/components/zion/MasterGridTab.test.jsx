import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MasterGridTab } from './MasterGridTab.jsx';

vi.mock('../../state/identityStore.js', () => ({ useIdentityStore: () => globalThis.__STORE__ }));
function setStore(matrix) {
  globalThis.__STORE__ = { matrix, matrixDispatch: vi.fn() };
  return globalThis.__STORE__;
}

const emptyMatrix = () => ({
  projectsById: {}, artifactsById: {}, initiativesById: {}, entitiesById: {}, systemsById: {},
  matrixLinksById: {}, milestonesById: {},
});
const withProjects = () => ({
  ...emptyMatrix(),
  projectsById: {
    p1: { id: 'p1', name: 'Alpha Project', phase: '1', targetDate: '2026-03-01', reviewStatus: 'CONFIRMED' },
    p2: { id: 'p2', name: 'Beta Project', phase: '2', targetDate: '2027', reviewStatus: 'DRAFT' },
  },
});

describe('MasterGridTab (phase-grouped, D1/D2)', () => {
  it('renders three phase groups with rows generated from the store', () => {
    setStore(withProjects());
    render(<MasterGridTab onOpenNode={() => {}} />);
    expect(screen.getAllByTestId('mastergrid-phase-group')).toHaveLength(3);
    expect(screen.getAllByTestId('mastergrid-row')).toHaveLength(2);
    expect(screen.getByText('Alpha Project')).toBeTruthy();
  });

  it('empty store renders three empty phase groups, not an error', () => {
    setStore(emptyMatrix());
    render(<MasterGridTab onOpenNode={() => {}} />);
    expect(screen.getAllByTestId('mastergrid-phase-group')).toHaveLength(3);
    expect(screen.queryAllByTestId('mastergrid-row')).toHaveLength(0);
    expect(screen.getByTestId('mastergrid-counts').textContent).toContain('0 execution nodes');
  });

  it('D2: never calls matrixDispatch (render or row click)', () => {
    const store = setStore(withProjects());
    render(<MasterGridTab onOpenNode={vi.fn()} />);
    fireEvent.click(screen.getAllByTestId('mastergrid-row')[0]);
    expect(store.matrixDispatch).not.toHaveBeenCalled();
  });

  it('D2: row click deep-links via onOpenNode with the node title, never writes', () => {
    setStore(withProjects());
    const onOpenNode = vi.fn();
    render(<MasterGridTab onOpenNode={onOpenNode} />);
    fireEvent.click(screen.getByText('Alpha Project').closest('tr'));
    expect(onOpenNode).toHaveBeenCalledWith({ title: 'Alpha Project' });
  });

  it('D1: a project added to the store appears on re-render (no second copy)', () => {
    setStore(withProjects());
    const { rerender } = render(<MasterGridTab onOpenNode={() => {}} />);
    expect(screen.getAllByTestId('mastergrid-row')).toHaveLength(2);
    globalThis.__STORE__.matrix.projectsById.p3 = { id: 'p3', name: 'Gamma Project', phase: '3', targetDate: '2028', reviewStatus: 'DRAFT' };
    rerender(<MasterGridTab onOpenNode={() => {}} />);
    expect(screen.getAllByTestId('mastergrid-row')).toHaveLength(3);
  });

  it('tripwire: 100% of nodes residual surfaces a distinct ingest-mismatch warning, not ordinary intake work', () => {
    // Real-store-shaped but with no resolvable phase anywhere → every node buckets residual.
    // This must NOT look like a normal to-do list; it must warn that no phase attestations read.
    const matrix = {
      ...emptyMatrix(),
      projectsById: {
        a: { id: 'a', name: 'Alpha', phase: null, reviewStatus: 'CONFIRMED', targetDate: '2026-03' },
        b: { id: 'b', name: 'Beta', phase: null, reviewStatus: 'CONFIRMED', targetDate: '2026-06' },
      },
      dependenciesById: {},
    };
    setStore(matrix);
    render(<MasterGridTab onOpenNode={() => {}} />);
    expect(screen.getByTestId('mastergrid-ingest-warning')).toBeTruthy();
    // and zero placed nodes
    expect(screen.getByTestId('mastergrid-counts').textContent).toContain('0 execution nodes');
  });

  it('no tripwire when at least one node places (ordinary residuals are not an ingest failure)', () => {
    setStore(withProjects());
    render(<MasterGridTab onOpenNode={() => {}} />);
    expect(screen.queryByTestId('mastergrid-ingest-warning')).toBeNull();
  });

  it('★ milestone star renders on lane rows (project that collapses a lane + promoted lane deliverable)', () => {
    const matrix = {
      ...emptyMatrix(),
      projectsById: { pj: { id: 'pj', name: 'Jericho', phase: '1', targetDate: '2026-10-17', reviewStatus: 'CONFIRMED' } },
      artifactsById: {
        app: { id: 'app', name: 'Jericho APP', phase: '1', targetDate: '2026-10-17', producingProjectId: 'pj', reviewStatus: 'CONFIRMED' },
        pat: { id: 'pat', name: 'Patent', phase: '1', targetDate: '2026-09-11', producingProjectId: 'pj', reviewStatus: 'CONFIRMED' },
      },
      milestonesById: { ms1: { id: 'ms1', name: 'Oct 17', date: '2026-10-17', laneIds: ['app', 'pat'] } },
    };
    setStore(matrix);
    render(<MasterGridTab onOpenNode={() => {}} />);
    // Jericho (collapses the app lane) + Patent (promoted, parent already claimed) both starred.
    expect(screen.getAllByTestId('mastergrid-milestone-star').length).toBe(2);
  });
});
