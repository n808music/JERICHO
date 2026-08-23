/**
 * computeSpineWindowPhase.ts
 *
 * Phase Assignment Rule: Compute a node's Phase from its Terminal Deadline
 * (or Next Milestone if ongoing). Never hand-typed, never dependency-derived,
 * never inherited. Computed independently per node, single source of truth.
 *
 * Spine windows (locked doctrine):
 *   P1 (State of Control): through 2028-02-17
 *   P2 (Seeds of Destruction): 2028-02-18 through 2029-08-17
 *   P3 (I Am The State): from 2029-08-18 onward
 */

type Phase = 'P1' | 'P2' | 'P3' | null;

const PHASE_1_BOUNDARY = '2028-02-17'; // inclusive upper bound for P1
const PHASE_2_BOUNDARY = '2029-08-17'; // inclusive upper bound for P2

/**
 * Parse an ISO date string (YYYY-MM-DD) to a Date object at noon UTC.
 * Returns null if the input is null, undefined, or invalid.
 */
function parseISODate(dateStr: string | null | undefined): Date | null {
  if (!dateStr) return null;
  const normalized = String(dateStr).trim().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) return null;
  const date = new Date(`${normalized}T12:00:00.000Z`);
  if (isNaN(date.getTime())) return null;
  return date;
}

/**
 * Compare two ISO date strings. Returns:
 *   -1 if a < b
 *    0 if a === b
 *    1 if a > b
 *   null if either is invalid
 */
function compareDateStrings(a: string | null, b: string | null): number | null {
  const dateA = parseISODate(a);
  const dateB = parseISODate(b);
  if (!dateA || !dateB) return null;
  if (dateA.getTime() < dateB.getTime()) return -1;
  if (dateA.getTime() > dateB.getTime()) return 1;
  return 0;
}

/**
 * Determine Phase based on a date falling into one of three spine windows.
 *
 * @param terminalDeadline - ISO date string (YYYY-MM-DD) of the node's terminal date.
 *                          Primary input; used unless isOngoing is true.
 * @param nextMilestone - ISO date string (YYYY-MM-DD) of the node's next milestone.
 *                       Used only when isOngoing is true.
 * @param isOngoing - true if the node is genuinely ongoing (no fixed terminal).
 *                   Uses nextMilestone for windowing instead.
 *
 * @returns 'P1' | 'P2' | 'P3' if the date falls into a valid window.
 *         null if the input date is null/missing/invalid, or if neither
 *         terminalDeadline nor nextMilestone is available.
 *
 * @throws Error if inputs are malformed (non-string types, unexpected shapes).
 */
export function computeSpineWindowPhase(
  terminalDeadline: string | null | undefined,
  nextMilestone: string | null | undefined,
  isOngoing: boolean = false
): Phase {
  // Choose which date to window against
  const dateToWindow = isOngoing ? nextMilestone : terminalDeadline;

  // Null/missing input → no phase (visible gap, never default)
  if (!dateToWindow) return null;

  // Parse the date
  const date = parseISODate(dateToWindow);
  if (!date) return null;

  // Compare against spine boundaries
  // P1: date <= 2028-02-17
  if (compareDateStrings(dateToWindow, PHASE_1_BOUNDARY) <= 0) {
    return 'P1';
  }

  // P2: 2028-02-18 <= date <= 2029-08-17
  if (compareDateStrings(dateToWindow, PHASE_2_BOUNDARY) <= 0) {
    return 'P2';
  }

  // P3: date >= 2029-08-18
  return 'P3';
}

/**
 * Exported for testing only. Breaks encapsulation.
 */
export const __testing = {
  PHASE_1_BOUNDARY,
  PHASE_2_BOUNDARY,
  parseISODate,
  compareDateStrings,
};
