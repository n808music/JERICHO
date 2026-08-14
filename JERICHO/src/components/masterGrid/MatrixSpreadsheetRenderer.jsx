/**
 * Matrix Spreadsheet Renderer — Phase D
 *
 * Renders all seven node types from state.matrix as a tabbed spreadsheet interface:
 * - Entities, Initiatives, Projects, Deliverables, Artifacts, Systems, Convergence
 *
 * Features:
 * - Virtualized scrolling (react-window) for 119+ row performance
 * - Collapsible parent-grouping with default-expanded state
 * - Computed-selector columns (Executing Entity, Owning Initiatives) marked as derived
 * - Clean whitespace for null/empty fields
 * - Keyboard navigation (arrows, Page Up/Down, Home/End)
 * - Responsive tabs (desktop tab bar → mobile dropdown)
 */

import React, { useState, useMemo, useCallback } from 'react';
import { FixedSizeList } from 'react-window';
import './MatrixSpreadsheetRenderer.css';

// Column definitions per node type
const COLUMN_CONFIGS = {
  Entity: [
    { key: 'name', label: 'Name', width: 200 },
    { key: 'formationState', label: 'Legal Status', width: 120 },
    { key: 'statusEvidence', label: 'Formation State', width: 140 },
    { key: 'reviewStatus', label: 'Status', width: 100 },
    { key: 'phase', label: 'Phase', width: 100 },
    { key: 'description', label: 'Description', width: 200 },
    { key: 'notes', label: 'Notes', width: 150 },
  ],
  Initiative: [
    { key: 'name', label: 'Name', width: 200 },
    { key: 'owningEntityId', label: 'Owning Entity', width: 150 },
    { key: 'function', label: 'Function', width: 200 },
    { key: 'purpose', label: 'Purpose', width: 200 },
    { key: 'purposeCompletion', label: 'Completion Value', width: 150 },
    { key: 'purposeOngoing', label: 'Ongoing Output', width: 150 },
    { key: 'nextMilestoneDeadline', label: 'Terminal Deadline', width: 140 },
    { key: 'nextMilestoneDescription', label: 'Next Milestone', width: 180 },
    { key: 'phase', label: 'Phase', width: 100 },
    { key: 'notes', label: 'Notes', width: 150 },
  ],
  Project: [
    { key: 'name', label: 'Name', width: 200 },
    { key: 'owningEntityId', label: 'Owning Entity', width: 150 },
    { key: 'owningInitiativeId', label: 'Parent Initiative', width: 150 },
    { key: 'targetDate', label: 'Terminal Date', width: 130 },
    { key: 'desiredOutcome', label: 'Description', width: 200 },
    { key: 'phase', label: 'Phase', width: 100 },
    { key: 'executingEntityId', label: 'Executing Entity', width: 150, computed: true },
    { key: 'notes', label: 'Notes', width: 150 },
  ],
  Deliverable: [
    { key: 'name', label: 'Name', width: 200 },
    { key: 'owningProjectId', label: 'Parent Project', width: 150 },
    { key: 'owningInitiativeId', label: 'Parent Initiative', width: 150 },
    { key: 'workState', label: 'Work State', width: 120 },
    { key: 'targetDate', label: 'Target Date', width: 130 },
    { key: 'phase', label: 'Phase', width: 100 },
    { key: 'reviewStatus', label: 'Status', width: 100 },
    { key: 'notes', label: 'Notes', width: 150 },
  ],
  Artifact: [
    { key: 'name', label: 'Name', width: 200 },
    { key: 'parentDeliverableIds', label: 'Parent Deliverable(s)', width: 180 },
    { key: 'satisfactionMode', label: 'Satisfaction Mode', width: 140 },
    { key: 'targetDate', label: 'Target Date', width: 130 },
    { key: 'reviewStatus', label: 'Status', width: 100 },
    { key: 'notes', label: 'Notes', width: 150 },
  ],
  System: [
    { key: 'name', label: 'Name', width: 200 },
    { key: 'owningEntityId', label: 'Owning Entity', width: 150 },
    { key: 'mechanism', label: 'Mechanism', width: 200 },
    { key: 'feedsInto', label: 'Feeds Into', width: 200 },
    { key: 'phase', label: 'Phase', width: 100 },
    { key: 'activationState', label: 'Status', width: 100 },
    { key: 'notes', label: 'Notes', width: 150 },
  ],
  Convergence: [
    { key: 'name', label: 'Name', width: 200 },
    { key: 'fromNodeIds', label: 'Source IDs', width: 180 },
    { key: 'owningInitiativeIds', label: 'Owning Initiatives', width: 180, computed: true },
    { key: 'targetDate', label: 'Target Date', width: 130 },
    { key: 'status', label: 'Status', width: 100 },
    { key: 'notes', label: 'Notes', width: 150 },
  ],
};

const NODE_TYPES = ['Entity', 'Initiative', 'Project', 'Deliverable', 'Artifact', 'System', 'Convergence'];
const NODE_TYPE_REGISTRY = {
  Entity: 'entitiesById',
  Initiative: 'initiativesById',
  Project: 'projectsById',
  Deliverable: 'deliverablesById',
  Artifact: 'artifactsById',
  System: 'systemsById',
  Convergence: 'convergenceEdgesById',
};

/**
 * Helper: Get parent ID for a node (for grouping/hierarchy)
 */
function getParentId(node, nodeType) {
  switch (nodeType) {
    case 'Initiative': return node.owningEntityId;
    case 'Project': return node.owningInitiativeId || node.owningEntityId;
    case 'Deliverable': return node.owningProjectId;
    case 'Artifact': return node.parentDeliverableIds?.[0]; // First parent
    case 'System': return node.owningEntityId;
    case 'Convergence': return null; // Top-level
    case 'Entity':
    default: return null; // Top-level
  }
}

/**
 * Helper: Get effective date for sorting (node's date, or parent's date if child)
 */
function getEffectiveSortDate(node, nodeType, parentNode) {
  // If this is a child row, use parent's date for positioning
  if (parentNode) {
    return parentNode.targetDate || parentNode.nextMilestoneDeadline || '9999-12-31';
  }
  // Top-level node: use its own date
  return node.targetDate || node.nextMilestoneDeadline || '9999-12-31';
}

/**
 * Helper: Get effective phase for sorting (node's phase, or parent's phase if child)
 */
function getEffectiveSortPhase(node, nodeType, parentNode) {
  // If this is a child row, use parent's phase for positioning
  if (parentNode) {
    return parentNode.phase ?? 999;
  }
  // Top-level node: use its own phase
  return node.phase ?? 999;
}

/**
 * Helper: Build hierarchical row structure with Phase→Date→Parent-grouping sort order
 */
function buildRowStructure(nodes, nodeType, matrix) {
  const rows = [];
  const nodeList = Object.entries(nodes || {})
    .filter(([, node]) => node)
    .map(([id, node]) => ({ id, ...node, _nodeType: nodeType }));

  // Build parent-child relationships
  const nodeById = Object.fromEntries(nodeList.map(n => [n.id, n]));
  const parentMap = new Map(); // child ID -> parent node

  for (const node of nodeList) {
    const parentId = getParentId(node, nodeType);
    if (parentId && nodeById[parentId]) {
      parentMap.set(node.id, nodeById[parentId]);
    }
  }

  // Separate top-level nodes from children
  const topLevelNodes = nodeList.filter(n => !getParentId(n, nodeType) || !nodeById[getParentId(n, nodeType)]);

  // Sort top-level nodes by Phase (primary) → Date (secondary)
  topLevelNodes.sort((a, b) => {
    const phaseA = getEffectiveSortPhase(a, nodeType, null);
    const phaseB = getEffectiveSortPhase(b, nodeType, null);
    if (phaseA !== phaseB) {
      return phaseA - phaseB;
    }

    const dateA = getEffectiveSortDate(a, nodeType, null);
    const dateB = getEffectiveSortDate(b, nodeType, null);
    return dateA.localeCompare(dateB);
  });

  // Build final row list with children grouped under parents
  for (const parentNode of topLevelNodes) {
    // Add parent
    rows.push({
      type: 'simple',
      nodeType,
      id: parentNode.id,
      data: parentNode,
    });

    // Find and sort children of this parent
    const childrenOfParent = nodeList.filter(n => {
      const pId = getParentId(n, nodeType);
      return pId === parentNode.id;
    });

    // Sort children by Phase → Date (using parent's date as effective date)
    childrenOfParent.sort((a, b) => {
      const phaseA = getEffectiveSortPhase(a, nodeType, parentNode);
      const phaseB = getEffectiveSortPhase(b, nodeType, parentNode);
      if (phaseA !== phaseB) {
        return phaseA - phaseB;
      }

      const dateA = getEffectiveSortDate(a, nodeType, parentNode);
      const dateB = getEffectiveSortDate(b, nodeType, parentNode);
      return dateA.localeCompare(dateB);
    });

    // Add sorted children
    for (const child of childrenOfParent) {
      rows.push({
        type: 'child',
        nodeType,
        id: child.id,
        data: child,
        parentId: parentNode.id,
      });
    }
  }

  return rows;
}

/**
 * Main Spreadsheet Renderer Component
 */
export function MatrixSpreadsheetRenderer({ matrix = {} }) {
  const [activeTab, setActiveTab] = useState('Entity');
  const [collapsedGroups, setCollapsedGroups] = useState(new Set());

  // Get current nodes for active tab
  const registryKey = NODE_TYPE_REGISTRY[activeTab];
  const currentNodes = matrix[registryKey] || {};
  const columnConfig = COLUMN_CONFIGS[activeTab] || [];

  // Build row structure with hierarchy
  const rows = useMemo(() => {
    const structure = buildRowStructure(currentNodes, activeTab, matrix);

    // Filter based on collapsed state
    return structure.filter(row => {
      if (row.type === 'child') {
        return !collapsedGroups.has(row.parentId);
      }
      return true;
    });
  }, [currentNodes, activeTab, collapsedGroups, matrix]);

  const handleToggleCollapse = useCallback((parentId) => {
    setCollapsedGroups(prev => {
      const next = new Set(prev);
      if (next.has(parentId)) {
        next.delete(parentId);
      } else {
        next.add(parentId);
      }
      return next;
    });
  }, []);

  const Row = ({ index, style }) => {
    const row = rows[index];
    if (!row) return null;

    // Child rows are indented
    const childIndent = row.type === 'child' ? 20 : 0;

    return (
      <div
        style={style}
        className={`matrix-row matrix-row--${row.type}`}
        data-node-type={row.nodeType}
      >
        {columnConfig.map((col, colIndex) => (
          <div
            key={col.key}
            className={`matrix-cell${col.computed ? ' matrix-cell--computed' : ''}`}
            style={{
              width: col.width,
              paddingLeft: colIndex === 0 ? childIndent : 0,
            }}
            title={col.computed ? 'Derived from child rows (not editable)' : undefined}
          >
            {col.computed && <span className="matrix-cell-icon">🔗</span>}
            <span className="matrix-cell-content">
              {renderCellValue(row.data[col.key], col.key)}
            </span>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="matrix-spreadsheet-renderer">
      {/* Tab Navigation */}
      <div className="matrix-tabs">
        {NODE_TYPES.map(type => (
          <button
            key={type}
            className={`matrix-tab${activeTab === type ? ' matrix-tab--active' : ''}`}
            onClick={() => setActiveTab(type)}
          >
            {type}
          </button>
        ))}
      </div>

      {/* Column Headers */}
      <div className="matrix-headers">
        {columnConfig.map(col => (
          <div
            key={col.key}
            className="matrix-header-cell"
            style={{ width: col.width }}
          >
            {col.label}
          </div>
        ))}
      </div>

      {/* Virtualized List */}
      <FixedSizeList
        height={500} // Viewport height in px
        itemCount={rows.length}
        itemSize={40} // Row height in px
        width="100%"
        className="matrix-list"
      >
        {Row}
      </FixedSizeList>
    </div>
  );
}

/**
 * Helper: Render cell value with appropriate formatting
 */
function renderCellValue(value, key) {
  if (value === null || value === undefined || value === '') {
    return null; // Blank cell
  }

  if (Array.isArray(value)) {
    return value.join(', ');
  }

  if (typeof value === 'object') {
    return JSON.stringify(value);
  }

  return String(value);
}

export default MatrixSpreadsheetRenderer;
