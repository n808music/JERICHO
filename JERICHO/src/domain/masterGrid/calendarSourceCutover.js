// Gate 2 — matrix→schedule display cutover (dormant).
//
// The live calendar's committed side is sourced from a fallback chain that mostly lacks matrix
// node identity (fullHorizon forecast, committed blocks). cycle.schedule.blocks ARE matrix-
// derived and carry full entity/initiative/project identity. This module decides — behind an
// explicit gate — whether the calendar's committed source is overridden with cycle.schedule.blocks
// so the scope toggle can isolate by Entity/Initiative/Project on the live calendar.
//
// SAFETY: ships DORMANT (default false). The operator flips it (production) no earlier than the
// rerun; a dev flag may enable it for testing. When enabled but the matrix schedule is empty, it
// falls back rather than blanking the calendar.

export const MATRIX_CALENDAR_CUTOVER_DEFAULT = false;

// The active cycle's matrix-derived schedule blocks (already surface-shaped: id/startISO/endISO/
// dayKey + entityId/initiativeId/sourceProjectId/deliverableId/deliverableTitle).
export function matrixCalendarBlocksForCycle(cycle) {
  const blocks = cycle?.schedule?.blocks;
  return Array.isArray(blocks) ? blocks : [];
}

// Override the committed calendar source with matrix blocks ONLY when the cutover is enabled AND
// the matrix schedule actually has blocks. Otherwise return the existing fallback untouched —
// this is what keeps the flip reversible and never blanks Today.
export function resolveCommittedCalendarSource({ cutoverEnabled = false, cycle = null, fallbackItems = [] } = {}) {
  if (cutoverEnabled) {
    const matrixBlocks = matrixCalendarBlocksForCycle(cycle);
    if (matrixBlocks.length > 0) return matrixBlocks;
  }
  return Array.isArray(fallbackItems) ? fallbackItems : [];
}

// What is actually rendering — for the operator-visible source label on the cutover control.
export function describeCalendarSource({ cutoverEnabled = false, cycle = null } = {}) {
  const usingMatrix = cutoverEnabled && matrixCalendarBlocksForCycle(cycle).length > 0;
  return usingMatrix
    ? { source: 'matrix', label: 'Calendar source: Matrix schedule' }
    : { source: 'forecast', label: 'Calendar source: Forecast (full-horizon)' };
}
