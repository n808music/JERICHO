/**
 * resolveConvergenceBuffers.js
 *
 * Computes synchronized target dates for projects linked via Convergence edges
 * with buffer constraints. (2026-08-13 Gap 3)
 *
 * Design: buffers adjust each source project's schedulingDate relative to the
 * Convergence edge's existing targetDate (shared deadline):
 * - Sequential: preceding project's date = edge.targetDate - bufferDays;
 *              following project's date = edge.targetDate
 * - Parallel: all projects' dates cluster around edge.targetDate within toleranceDays
 *
 * @param {Object} matrix - state.matrix (convergenceEdgesById, projectsById, etc.)
 * @returns {Map<string, string|null>} projectId → synchronizedDate (YYYY-MM-DD or null)
 */
export function resolveConvergenceBuffers(matrix = {}) {
  const synchronizedDates = new Map();

  if (!matrix.convergenceEdgesById) {
    return synchronizedDates;
  }

  for (const edge of Object.values(matrix.convergenceEdgesById)) {
    if (!edge || !edge.targetDate || !edge.bufferType) {
      continue;
    }

    const edgeTargetDate = String(edge.targetDate).trim();
    const fromNodeIds = Array.isArray(edge.fromNodeIds) ? edge.fromNodeIds : [];

    if (fromNodeIds.length === 0) {
      continue;
    }

    if (edge.bufferType === 'sequential' && edge.bufferDays != null) {
      // Sequential buffer: preceding project gets offset, following gets targetDate
      const bufferDays = Number(edge.bufferDays);
      const precedingId = edge.precedingProjectId;
      const followingId = edge.followingProjectId;

      if (precedingId && followingId) {
        // Compute preceding date = targetDate - bufferDays
        const precedingDate = offsetDateByDays(edgeTargetDate, -bufferDays);
        synchronizedDates.set(precedingId, precedingDate);
        synchronizedDates.set(followingId, edgeTargetDate);
      }
    } else if (edge.bufferType === 'parallel' && edge.toleranceDays != null) {
      // Parallel buffer: all sources converge at targetDate (within toleranceDays tolerance)
      // For scheduling purposes, all sync to the same targetDate
      for (const projectId of fromNodeIds) {
        synchronizedDates.set(projectId, edgeTargetDate);
      }
    }
  }

  return synchronizedDates;
}

/**
 * Offset a date by a number of days
 * @param {string} dateStr - YYYY-MM-DD format
 * @param {number} days - positive or negative day offset
 * @returns {string} new date in YYYY-MM-DD format
 */
function offsetDateByDays(dateStr, days) {
  try {
    const date = new Date(`${dateStr}T12:00:00.000Z`);
    date.setUTCDate(date.getUTCDate() + days);
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    const day = String(date.getUTCDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  } catch (e) {
    return dateStr; // Fallback: return original date on error
  }
}
