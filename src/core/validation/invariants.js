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

  return { valid: violations.length === 0, violations };
}
