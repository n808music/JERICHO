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

// A matrix spanning all five classes — the phase-execution scope shows only Project/
// promoted-Deliverable nodes, while the full-class rollup shows Entity/Initiative/System too.
const fullMatrix = () => ({
  ...emptyMatrix(),
  entitiesById: { e1: { id: 'e1', name: 'Global State Corp', reviewStatus: 'CONFIRMED' } },
  initiativesById: { i1: { id: 'i1', name: 'Jericho System', reviewStatus: 'CONFIRMED' } },
  projectsById: { p1: { id: 'p1', name: 'Alpha Project', phase: '1', targetDate: '2026-03-01', reviewStatus: 'CONFIRMED' } },
  systemsById: { s1: { id: 's1', name: 'Music System', reviewStatus: 'DRAFT' } },
});

describe('MasterGridTab — scope selector (Gate 7: both scopes, default phase-execution)', () => {
  it('defaults to the phase-execution scope (System/Entity not shown; three phase groups)', () => {
    setStore(fullMatrix());
    render(<MasterGridTab onOpenNode={() => {}} />);
    expect(screen.getByTestId('mastergrid-scope-selector')).toBeTruthy();
    expect(screen.getAllByTestId('mastergrid-phase-group')).toHaveLength(3);
    expect(screen.queryByText('Music System')).toBeNull();
    expect(screen.queryByText('Global State Corp')).toBeNull();
  });

  it('switching to the class scope reveals all five classes (reconnects selectMasterGridRows)', () => {
    setStore(fullMatrix());
    render(<MasterGridTab onOpenNode={() => {}} />);
    fireEvent.click(screen.getByTestId('mastergrid-scope-class'));
    expect(screen.getByText('Music System')).toBeTruthy();       // System — invisible in phase scope
    expect(screen.getByText('Global State Corp')).toBeTruthy();  // Entity — invisible in phase scope
    expect(screen.getByText('Jericho System')).toBeTruthy();     // Initiative
    expect(screen.queryAllByTestId('mastergrid-phase-group')).toHaveLength(0);
  });

  it('switches back to the phase-execution scope', () => {
    setStore(fullMatrix());
    render(<MasterGridTab onOpenNode={() => {}} />);
    fireEvent.click(screen.getByTestId('mastergrid-scope-class'));
    fireEvent.click(screen.getByTestId('mastergrid-scope-phase'));
    expect(screen.getAllByTestId('mastergrid-phase-group')).toHaveLength(3);
    expect(screen.queryByText('Music System')).toBeNull();
  });

  it('read-only in both scopes: switching scope and clicking a class row never calls matrixDispatch', () => {
    const store = setStore(fullMatrix());
    render(<MasterGridTab onOpenNode={vi.fn()} />);
    fireEvent.click(screen.getByTestId('mastergrid-scope-class'));
    fireEvent.click(screen.getAllByTestId('mastergrid-class-row')[0]);
    expect(store.matrixDispatch).not.toHaveBeenCalled();
  });
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

  it('tripwire: 100% residual surfaces a distinct warning naming BOTH causes (read mismatch AND incomplete intake)', () => {
    // Every node residual has two causes needing different responses: a read mismatch (bug) OR
    // genuinely unattested phase (incomplete intake — legitimate questions). The banner must name
    // both and dismiss neither — a live store with null phase everywhere is the incomplete-intake case.
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
    const warn = screen.getByTestId('mastergrid-ingest-warning');
    expect(warn).toBeTruthy();
    // Calibrated: names the read-mismatch cause AND the incomplete-intake cause; dismisses neither.
    expect(warn.textContent.toLowerCase()).toContain('read');
    expect(warn.textContent.toLowerCase()).toContain('intake');
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

  it('Gate 3: surfaces phase disagreement recommendations when present (advisory never blocks)', () => {
    // Projects with a dependency that declares one phase but dependency graph orders differently.
    const matrix = {
      ...emptyMatrix(),
      projectsById: {
        p1: { id: 'p1', name: 'Valid', phase: '1', reviewStatus: 'CONFIRMED' },
        p2: { id: 'p2', name: 'Mislabeled', phase: '1', reviewStatus: 'CONFIRMED' }, // declares phase 1, but depends on p1 (makes it phase 3)
      },
      dependenciesById: {
        d1: { id: 'd1', upstreamId: 'p1', downstreamId: 'p2', type: 'hard_gate' },
      },
    };
    setStore(matrix);
    render(<MasterGridTab onOpenNode={() => {}} />);
    // Recommendations panel appears with the DECLARED_PHASE_CONTRADICTS_DEPENDENCIES recommendation.
    const recsPanel = screen.getByTestId('mastergrid-phase-recommendations');
    expect(recsPanel).toBeTruthy();
    expect(recsPanel.textContent).toContain('DECLARED_PHASE_CONTRADICTS_DEPENDENCIES');
    expect(recsPanel.textContent).toContain('Mislabeled');
  });

  it('Gate 3: does not render recommendations panel when matrix has no phase disagreements', () => {
    // E16 (2026-08-23): this fixture used to rely on shared initiative membership to keep
    // NO_DECLARED_SEQUENCE quiet. That escape is gone — an Initiative has no Phase, so belonging
    // to one no longer sequences anything. The projects must now carry a real dependency edge,
    // and no declared phase to contradict it, for the matrix to be genuinely quiet.
    const matrix = {
      ...emptyMatrix(),
      initiativesById: { i1: { id: 'i1', name: 'Initiative 1', reviewStatus: 'CONFIRMED' } },
      projectsById: {
        p1: { id: 'p1', name: 'Project 1', owningInitiativeId: 'i1', reviewStatus: 'CONFIRMED' },
        p2: { id: 'p2', name: 'Project 2', owningInitiativeId: 'i1', reviewStatus: 'CONFIRMED' },
      },
      dependenciesById: {
        d1: { id: 'd1', upstreamId: 'p1', downstreamId: 'p2', type: 'hard_gate' },
      },
    };
    setStore(matrix);
    render(<MasterGridTab onOpenNode={() => {}} />);
    // No recommendations: both projects participate in a declared sequence, none declares a
    // contradicting phase, nothing is corrupted.
    expect(screen.queryByTestId('mastergrid-phase-recommendations')).toBeNull();
  });

  it('Gate 3: handles corrupted phase data gracefully (PHASE_DATA_CORRUPTED never crashes advisory panel)', () => {
    // A project with a corrupted phase value and a dependency that makes it participate.
    const matrix = {
      ...emptyMatrix(),
      projectsById: {
        p1: { id: 'p1', name: 'Valid', phase: '1', reviewStatus: 'CONFIRMED' },
        p2: { id: 'p2', name: 'Corrupted', phase: '7', reviewStatus: 'CONFIRMED' }, // invalid phase
      },
      dependenciesById: {
        d1: { id: 'd1', upstreamId: 'p1', downstreamId: 'p2', type: 'hard_gate' },
      },
    };
    setStore(matrix);
    render(<MasterGridTab onOpenNode={() => {}} />);
    // Advisory panel renders with the corruption flag; component does not crash.
    const recsPanel = screen.getByTestId('mastergrid-phase-recommendations');
    expect(recsPanel).toBeTruthy();
    expect(recsPanel.textContent).toContain('PHASE_DATA_CORRUPTED');
    expect(recsPanel.textContent).toContain('Corrupted');
  });
});
