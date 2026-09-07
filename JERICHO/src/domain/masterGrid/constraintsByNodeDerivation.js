/**
 * constraintsByNodeDerivation.js — Build the constraintsByNode map for aggregateUrgencyRollup()
 *
 * The aggregateUrgencyRollup() function takes a constraintsByNode parameter mapping
 * node IDs to their CONSTRAINT status. This module derives that map from current backlog state.
 *
 * CONSTRAINT status comes from Backlog blocks with constraintTag: 'CONSTRAINT'.
 * For each such block, we trace it back to its owning Project and mark that Project
 * as under active escalation.
 *
 * This is a read-time derivation, not a stored field.
 */

/**
 * buildConstraintsByNode(matrix, backlogBlocks): Object
 *
 * @param {Object} matrix — state.matrix (entitiesById, initiativesById, projectsById, etc.)
 * @param {Array} backlogBlocks — state.cycle?.backlog?.blocks || []
 * @returns {Object} { projectId: 'CONSTRAINT', ... } mapping Projects with active escalations
 *
 * Usage (in caller, e.g., Step 4 wiring):
 *   const constraintsByNode = buildConstraintsByNode(matrix, backlogBlocks);
 *   const rollup = aggregateUrgencyRollup(entity, matrix, constraintsByNode);
 */
export function buildConstraintsByNode(matrix = {}, backlogBlocks = []) {
  const constraintsByNode = {};

  // Handle null/undefined inputs
  if (!backlogBlocks || !Array.isArray(backlogBlocks)) {
    return constraintsByNode;
  }

  // Backlog blocks with constraintTag === 'CONSTRAINT' mark their owning Project
  // as under active escalation.
  for (const block of backlogBlocks) {
    if (!block || block.constraintTag !== 'CONSTRAINT') continue;

    // The block's owning Project (if present) gets marked as under CONSTRAINT
    if (block.projectId) {
      constraintsByNode[block.projectId] = 'CONSTRAINT';
    }
  }

  return constraintsByNode;
}
