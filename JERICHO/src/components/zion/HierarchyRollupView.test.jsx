/**
 * HierarchyRollupView.test.jsx — Tests for Step 4 wiring (display consumer)
 *
 * Tests the component that wires aggregatePhaseRollup() and aggregateUrgencyRollup()
 * into the MasterGridTab hierarchy rollup view.
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// Mock the dependencies
vi.mock('../../state/identityStore.js', () => ({
  useIdentityStore: vi.fn(),
}));
vi.mock('../../core/engine/resolveBacklogBlocks.ts', () => ({
  resolveBacklogBlocks: vi.fn(),
}));
vi.mock('../../domain/masterGrid/matrixAggregation.js', () => ({
  aggregatePhaseRollup: vi.fn(),
  aggregateUrgencyRollup: vi.fn(),
}));
vi.mock('../../domain/masterGrid/constraintsByNodeDerivation.js', () => ({
  buildConstraintsByNode: vi.fn(),
}));

import { useIdentityStore } from '../../state/identityStore.js';
import { resolveBacklogBlocks } from '../../core/engine/resolveBacklogBlocks.ts';
import { aggregatePhaseRollup, aggregateUrgencyRollup } from '../../domain/masterGrid/matrixAggregation.js';
import { buildConstraintsByNode } from '../../domain/masterGrid/constraintsByNodeDerivation.js';

// Component under test (inline for now to avoid circular deps)
function HierarchyRollupView({ matrix, onOpenNode }) {
  const store = useIdentityStore();
  const backlogBlocks = resolveBacklogBlocks(store);
  const constraintsByNode = buildConstraintsByNode(matrix, backlogBlocks);

  const entityRollups = Object.values(matrix.entitiesById || {}).map(entity => ({
    entity,
    phaseRollup: aggregatePhaseRollup(entity, matrix),
    urgencyRollup: aggregateUrgencyRollup(entity, matrix, constraintsByNode),
  }));

  return (
    <div className="space-y-4" data-testid="mastergrid-hierarchy">
      {entityRollups.map(({ entity, phaseRollup, urgencyRollup }) => (
        <EntityRollupRow
          key={entity.id}
          entity={entity}
          phaseRollup={phaseRollup}
          urgencyRollup={urgencyRollup}
          matrix={matrix}
          onOpenNode={onOpenNode}
        />
      ))}
    </div>
  );
}

function EntityRollupRow({ entity, phaseRollup, urgencyRollup, matrix, onOpenNode }) {
  const getNodeClass = (nodeId) => {
    if (matrix.projectsById?.[nodeId]) return 'Project';
    if (matrix.deliverablesById?.[nodeId]) return 'Deliverable';
    if (matrix.artifactsById?.[nodeId]) return 'Artifact';
    return null;
  };

  const handleNodeClick = (leafId) => {
    const nodeClass = getNodeClass(leafId);
    if (nodeClass) {
      onOpenNode?.({ class: nodeClass, id: leafId });
    }
  };

  const [expanded, setExpanded] = React.useState(false);

  return (
    <div className="space-y-2 rounded-lg border border-line/60 p-3">
      <div
        onClick={() => setExpanded(!expanded)}
        style={{ cursor: 'pointer' }}
        className="flex justify-between items-center"
        data-testid="entity-rollup-header"
      >
        <div>
          <div className="font-medium">{entity.name}</div>
          <div className="text-xs text-muted">{phaseRollup.displaySummary}</div>
        </div>
        <div className="text-xs space-x-2">
          <span className="badge" data-testid="urgency-badge">{urgencyRollup.effectiveUrgency}</span>
          {phaseRollup.orphanedProjects.length > 0 && (
            <span className="text-amber-600" data-testid="orphaned-count">
              {phaseRollup.orphanedProjects.length} orphaned
            </span>
          )}
        </div>
      </div>

      {expanded && (
        <div className="mt-3 space-y-2 text-xs" data-testid="entity-drill-down">
          {['P1', 'P2', 'P3', 'null'].map(phase => (
            phaseRollup.leafCounts[phase] > 0 && (
              <div key={phase} data-testid={`phase-section-${phase}`}>
                <div className="font-semibold">{phase}: {phaseRollup.leafCounts[phase]}</div>
                <div className="ml-4 space-y-1">
                  {phaseRollup.leafRefs[phase].map(leafId => {
                    const parentProjId = phaseRollup.leafRefSources[leafId];
                    const label = parentProjId && leafId !== parentProjId
                      ? `${leafId} (via ${parentProjId})`
                      : leafId;
                    return (
                      <div
                        key={leafId}
                        className="text-muted cursor-pointer hover:text-jericho-accent"
                        onClick={() => handleNodeClick(leafId)}
                        data-testid={`leaf-ref-${leafId}`}
                      >
                        • {label}
                      </div>
                    );
                  })}
                </div>
              </div>
            )
          ))}
          {phaseRollup.orphanedProjects.length > 0 && (
            <div className="mt-3 p-2 bg-amber-50 rounded" data-testid="orphaned-section">
              <div className="font-semibold text-amber-900">Orphaned projects:</div>
              <div className="ml-4 space-y-1">
                {phaseRollup.orphanedProjects.map(projId => (
                  <div
                    key={projId}
                    className="text-amber-700 cursor-pointer hover:text-amber-900"
                    onClick={() => onOpenNode?.({ class: 'Project', id: projId })}
                    data-testid={`orphaned-proj-${projId}`}
                  >
                    • {projId}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

describe('HierarchyRollupView wiring', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders without crashing with zero Entities', () => {
    useIdentityStore.mockReturnValue({
      executionEvents: [],
      today: { blocks: [] },
    });
    resolveBacklogBlocks.mockReturnValue([]);
    buildConstraintsByNode.mockReturnValue({});

    const matrix = { entitiesById: {} };
    const { container } = render(<HierarchyRollupView matrix={matrix} onOpenNode={vi.fn()} />);

    expect(container.querySelector('[data-testid="mastergrid-hierarchy"]')).toBeTruthy();
  });

  it('displays Entity name and displaySummary', () => {
    useIdentityStore.mockReturnValue({
      executionEvents: [],
      today: { blocks: [] },
    });
    resolveBacklogBlocks.mockReturnValue([]);
    buildConstraintsByNode.mockReturnValue({});

    const matrix = {
      entitiesById: {
        'ent-1': { id: 'ent-1', name: 'Test Entity', purpose: 'Testing' },
      },
      initiativesById: {},
      projectsById: {},
    };

    aggregatePhaseRollup.mockReturnValue({
      leafCounts: { P1: 2, P2: 0, P3: 0, null: 0 },
      leafRefs: { P1: [], P2: [], P3: [], null: [] },
      leafRefSources: {},
      displaySummary: '2 P1',
      orphanedProjects: [],
    });
    aggregateUrgencyRollup.mockReturnValue({
      effectiveUrgency: 'urgent',
      constraintSources: [],
    });

    render(<HierarchyRollupView matrix={matrix} onOpenNode={vi.fn()} />);

    expect(screen.getByText('Test Entity')).toBeTruthy();
    expect(screen.getByText('2 P1')).toBeTruthy();
  });

  it('displays urgency badge', () => {
    useIdentityStore.mockReturnValue({
      executionEvents: [],
      today: { blocks: [] },
    });
    resolveBacklogBlocks.mockReturnValue([]);
    buildConstraintsByNode.mockReturnValue({});

    const matrix = {
      entitiesById: {
        'ent-1': { id: 'ent-1', name: 'Test Entity', purpose: 'Testing' },
      },
      initiativesById: {},
      projectsById: {},
    };

    aggregatePhaseRollup.mockReturnValue({
      leafCounts: { P1: 1, P2: 0, P3: 0, null: 0 },
      leafRefs: { P1: [], P2: [], P3: [], null: [] },
      leafRefSources: {},
      displaySummary: '1 P1',
      orphanedProjects: [],
    });
    aggregateUrgencyRollup.mockReturnValue({
      effectiveUrgency: 'watch',
      constraintSources: [],
    });

    render(<HierarchyRollupView matrix={matrix} onOpenNode={vi.fn()} />);

    expect(screen.getByTestId('urgency-badge')).toHaveTextContent('watch');
  });

  it('displays orphaned Projects count badge', () => {
    useIdentityStore.mockReturnValue({
      executionEvents: [],
      today: { blocks: [] },
    });
    resolveBacklogBlocks.mockReturnValue([]);
    buildConstraintsByNode.mockReturnValue({});

    const matrix = {
      entitiesById: {
        'ent-1': { id: 'ent-1', name: 'Test Entity', purpose: 'Testing' },
      },
      initiativesById: {},
      projectsById: {},
    };

    aggregatePhaseRollup.mockReturnValue({
      leafCounts: { P1: 1, P2: 0, P3: 0, null: 0 },
      leafRefs: { P1: [], P2: [], P3: [], null: [] },
      leafRefSources: {},
      displaySummary: '1 P1',
      orphanedProjects: ['proj-999', 'proj-888'],
    });
    aggregateUrgencyRollup.mockReturnValue({
      effectiveUrgency: 'none',
      constraintSources: [],
    });

    render(<HierarchyRollupView matrix={matrix} onOpenNode={vi.fn()} />);

    expect(screen.getByTestId('orphaned-count')).toHaveTextContent('2 orphaned');
  });

  it('expands/collapses drill-down on header click', async () => {
    const user = userEvent.setup();
    useIdentityStore.mockReturnValue({
      executionEvents: [],
      today: { blocks: [] },
    });
    resolveBacklogBlocks.mockReturnValue([]);
    buildConstraintsByNode.mockReturnValue({});

    const matrix = {
      entitiesById: {
        'ent-1': { id: 'ent-1', name: 'Test Entity', purpose: 'Testing' },
      },
      initiativesById: {},
      projectsById: {
        'proj-1': { id: 'proj-1', name: 'P1 Project', owningInitiativeId: 'init-1', targetDate: '2028-02-01' },
      },
    };

    aggregatePhaseRollup.mockReturnValue({
      leafCounts: { P1: 1, P2: 0, P3: 0, null: 0 },
      leafRefs: { P1: ['proj-1'], P2: [], P3: [], null: [] },
      leafRefSources: { 'proj-1': null },
      displaySummary: '1 P1',
      orphanedProjects: [],
    });
    aggregateUrgencyRollup.mockReturnValue({
      effectiveUrgency: 'none',
      constraintSources: [],
    });

    render(<HierarchyRollupView matrix={matrix} onOpenNode={vi.fn()} />);

    // Initially collapsed
    expect(screen.queryByTestId('entity-drill-down')).not.toBeInTheDocument();

    // Click to expand
    const header = screen.getByTestId('entity-rollup-header');
    await user.click(header);
    expect(screen.getByTestId('entity-drill-down')).toBeTruthy();

    // Click to collapse
    await user.click(header);
    expect(screen.queryByTestId('entity-drill-down')).not.toBeInTheDocument();
  });

  it('calls onOpenNode with correct {class, id} when leaf is clicked', async () => {
    const user = userEvent.setup();
    useIdentityStore.mockReturnValue({
      executionEvents: [],
      today: { blocks: [] },
    });
    resolveBacklogBlocks.mockReturnValue([]);
    buildConstraintsByNode.mockReturnValue({});

    const onOpenNode = vi.fn();
    const matrix = {
      entitiesById: {
        'ent-1': { id: 'ent-1', name: 'Test Entity', purpose: 'Testing' },
      },
      initiativesById: {},
      projectsById: {
        'proj-1': { id: 'proj-1', name: 'P1 Project', owningInitiativeId: 'init-1', targetDate: '2028-02-01' },
      },
    };

    aggregatePhaseRollup.mockReturnValue({
      leafCounts: { P1: 1, P2: 0, P3: 0, null: 0 },
      leafRefs: { P1: ['proj-1'], P2: [], P3: [], null: [] },
      leafRefSources: { 'proj-1': null },
      displaySummary: '1 P1',
      orphanedProjects: [],
    });
    aggregateUrgencyRollup.mockReturnValue({
      effectiveUrgency: 'none',
      constraintSources: [],
    });

    render(<HierarchyRollupView matrix={matrix} onOpenNode={onOpenNode} />);

    // Expand to show drill-down
    await user.click(screen.getByTestId('entity-rollup-header'));

    // Click on leaf ref
    const leafRef = screen.getByTestId('leaf-ref-proj-1');
    await user.click(leafRef);

    expect(onOpenNode).toHaveBeenCalledWith({ class: 'Project', id: 'proj-1' });
  });

  it('displays "(via parent)" label only when parent differs from leaf ID', async () => {
    const user = userEvent.setup();
    useIdentityStore.mockReturnValue({
      executionEvents: [],
      today: { blocks: [] },
    });
    resolveBacklogBlocks.mockReturnValue([]);
    buildConstraintsByNode.mockReturnValue({});

    const matrix = {
      entitiesById: {
        'ent-1': { id: 'ent-1', name: 'Test Entity', purpose: 'Testing' },
      },
      initiativesById: {},
      projectsById: {
        'proj-1': { id: 'proj-1', name: 'P1 Project', owningInitiativeId: 'init-1', targetDate: '2028-02-01' },
      },
      deliverablesById: {
        'deliv-1': { id: 'deliv-1', name: 'Deliverable', owningProjectId: 'proj-1', successCriteria: 'Done' },
      },
    };

    aggregatePhaseRollup.mockReturnValue({
      leafCounts: { P1: 2, P2: 0, P3: 0, null: 0 },
      leafRefs: { P1: ['proj-1', 'deliv-1'], P2: [], P3: [], null: [] },
      leafRefSources: { 'proj-1': null, 'deliv-1': 'proj-1' }, // proj-1 is its own parent (null), deliv-1's parent is proj-1
      displaySummary: '2 P1',
      orphanedProjects: [],
    });
    aggregateUrgencyRollup.mockReturnValue({
      effectiveUrgency: 'none',
      constraintSources: [],
    });

    render(<HierarchyRollupView matrix={matrix} onOpenNode={vi.fn()} />);

    // Expand to show drill-down
    await user.click(screen.getByTestId('entity-rollup-header'));

    // Project should show as plain ID (no "via" annotation)
    const projRef = screen.getByTestId('leaf-ref-proj-1');
    expect(projRef).toHaveTextContent('proj-1');
    expect(projRef).not.toHaveTextContent('via');

    // Deliverable should show with "via" annotation
    const delivRef = screen.getByTestId('leaf-ref-deliv-1');
    expect(delivRef).toHaveTextContent('deliv-1 (via proj-1)');
  });

  it('calls onOpenNode for orphaned Projects', async () => {
    const user = userEvent.setup();
    useIdentityStore.mockReturnValue({
      executionEvents: [],
      today: { blocks: [] },
    });
    resolveBacklogBlocks.mockReturnValue([]);
    buildConstraintsByNode.mockReturnValue({});

    const onOpenNode = vi.fn();
    const matrix = {
      entitiesById: {
        'ent-1': { id: 'ent-1', name: 'Test Entity', purpose: 'Testing' },
      },
      initiativesById: {},
      projectsById: {},
    };

    aggregatePhaseRollup.mockReturnValue({
      leafCounts: { P1: 0, P2: 0, P3: 0, null: 0 },
      leafRefs: { P1: [], P2: [], P3: [], null: [] },
      leafRefSources: {},
      displaySummary: 'No items',
      orphanedProjects: ['proj-orphaned'],
    });
    aggregateUrgencyRollup.mockReturnValue({
      effectiveUrgency: 'none',
      constraintSources: [],
    });

    render(<HierarchyRollupView matrix={matrix} onOpenNode={onOpenNode} />);

    // Expand to show drill-down
    await user.click(screen.getByTestId('entity-rollup-header'));

    // Click on orphaned project
    const orphanedProj = screen.getByTestId('orphaned-proj-proj-orphaned');
    await user.click(orphanedProj);

    expect(onOpenNode).toHaveBeenCalledWith({ class: 'Project', id: 'proj-orphaned' });
  });
});
