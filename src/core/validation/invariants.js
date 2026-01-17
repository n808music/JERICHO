/**
 * Check all state invariants.
 * @param {object} state - The full application state
 * @returns {{ valid: boolean, violations: Array<{ invariant: string, message: string, context: object }> }}
 */
export function checkInvariants(state) {
  const violations = [];

  // INV-001: Task-History Consistency
  const completedTasks = (state.tasks || []).filter(t => t.status === 'completed' || t.status === 'missed');
  for (const task of completedTasks) {
    const hasHistoryEntry = (state.history || []).some(h => h.taskId === task.id || h.id === task.id);
    if (!hasHistoryEntry) {
      violations.push({
        invariant: 'INV-001',
        message: `Completed/missed task "${task.id}" has no history entry`,
        context: { taskId: task.id, status: task.status }
      });
    }
  }

  // INV-002: Integrity Count Coherence
  const tasks = state.tasks || [];
  const actualCompleted = tasks.filter(t => t.status === 'completed').length;
  const actualPending = tasks.filter(t => t.status === 'pending').length;
  const integrity = state.integrity || {};

  if (integrity.completedCount !== undefined && integrity.completedCount !== actualCompleted) {
    violations.push({
      invariant: 'INV-002',
      message: `completedCount (${integrity.completedCount}) does not match actual completed tasks (${actualCompleted})`,
      context: { expected: actualCompleted, actual: integrity.completedCount }
    });
  }

  if (integrity.pendingCount !== undefined && integrity.pendingCount !== actualPending) {
    violations.push({
      invariant: 'INV-002',
      message: `pendingCount (${integrity.pendingCount}) does not match actual pending tasks (${actualPending})`,
      context: { expected: actualPending, actual: integrity.pendingCount }
    });
  }

  // INV-003: No Orphaned References
  const goals = state.goals || [];
  const goalStrings = goals.map(g => typeof g === 'string' ? g : g?.raw || g?.text || '');

  for (const task of tasks) {
    if (task.goalLink && !goalStrings.includes(task.goalLink)) {
      violations.push({
        invariant: 'INV-003',
        message: `Task "${task.id}" references non-existent goal "${task.goalLink}"`,
        context: { taskId: task.id, goalLink: task.goalLink, availableGoals: goalStrings }
      });
    }
  }

  // INV-004: Identity Level Bounds
  const identity = state.identity || {};
  for (const [domain, capabilities] of Object.entries(identity)) {
    if (typeof capabilities !== 'object' || capabilities === null) continue;
    for (const [capability, data] of Object.entries(capabilities)) {
      const level = data?.level;
      if (level !== undefined && (typeof level !== 'number' || level < 1 || level > 5 || !Number.isInteger(level))) {
        violations.push({
          invariant: 'INV-004',
          message: `Identity level for ${domain}.${capability} is out of bounds: ${level}`,
          context: { domain, capability, level }
        });
      }
    }
  }

  // INV-006: No Duplicate IDs
  const taskIds = tasks.map(t => t.id).filter(Boolean);
  const seenTaskIds = new Set();
  for (const id of taskIds) {
    if (seenTaskIds.has(id)) {
      violations.push({
        invariant: 'INV-006',
        message: `Duplicate task ID: "${id}"`,
        context: { id }
      });
    }
    seenTaskIds.add(id);
  }

  return { valid: violations.length === 0, violations };
}
