/**
 * spinePhaseComputation.js
 *
 * Authoritative Phase computation from spine windows and Initiative Terminal Deadlines.
 * Per doctrine (Phase Assignment Rule, 2026-08-15):
 *
 * Phase(Initiative) = the spine-window containing that Initiative's own Terminal Deadline
 * (or Next Milestone deadline, if ongoing). Spine = operator-declared core production lanes
 * (State of Control → Max Clout → I Am The State); spine's own consecutive Terminal Deadlines
 * define window boundaries.
 *
 * Computed independently per Initiative-grain node — never hand-typed, never inherited from
 * parent Initiative, never derived from convergence/dependency-relatedness/capacity.
 *
 * Rules:
 * 1. Deliverables/Artifacts/Milestones inherit parent Initiative's Phase unconditionally.
 * 2. Foundation lanes get P1 from general rule (own Terminal falls in window 1).
 * 3. Parent-child Initiatives: child's computed Phase must be ≥ parent's.
 *    Child > parent is expected/correct; only child < parent is a violation.
 * 4. Cross-Phase Initiatives are derived: if sub-units span >1 Phase value, parent
 *    carries no single Phase — each sub-unit keeps its own individually computed Phase.
 */

/**
 * Computes phase window boundaries from spine Initiative terminal deadlines.
 *
 * @param {Array<{id, terminalDeadline}>} spineInitiatives - Ordered spine Initiatives
 * @returns {Array<{phaseNumber, startBoundary, endBoundary, spineInitiativeId}>}
 *   Ordered phase windows. Window 1 ends at spine[0].terminalDeadline, etc.
 *   Boundaries are ISO dates (e.g. '2032-03-15').
 */
export function computeSpineWindows(spineInitiatives) {
  if (!Array.isArray(spineInitiatives) || spineInitiatives.length === 0) {
    return [];
  }

  // Filter to valid spine members only (those with Terminal Deadlines)
  const validSpines = spineInitiatives.filter((init) => {
    const deadline = String(init?.terminalDeadline || '').trim();
    return deadline && isValidISO(deadline);
  });

  if (validSpines.length === 0) {
    return [];
  }

  const windows = [];
  let previousBoundary = '1900-01-01'; // Start from epoch

  // Create N-1 bounded windows from N spine members
  // Each window is bounded by the spine member's Terminal Deadline (exclusive of the boundary)
  for (let i = 0; i < validSpines.length - 1; i++) {
    const terminalDeadline = String(validSpines[i].terminalDeadline).trim();
    const phaseNumber = i + 1; // P1, P2, etc.

    // Calculate the day after the terminal deadline (for exclusive upper boundary)
    const nextDay = new Date(terminalDeadline);
    nextDay.setDate(nextDay.getDate() + 1);
    const exclusiveEndBoundary = nextDay.toISOString().slice(0, 10);

    windows.push({
      phaseNumber,
      startBoundary: previousBoundary,
      endBoundary: exclusiveEndBoundary,
      spineInitiativeId: validSpines[i].id || null,
    });

    previousBoundary = exclusiveEndBoundary;
  }

  // Final unbounded window: everything from the last spine member's terminal onward
  // This window has no upper bound (P3 contains all dates >= last spine terminal)
  const lastSpine = validSpines[validSpines.length - 1];
  const lastTerminalDeadline = String(lastSpine.terminalDeadline).trim();
  const finalPhaseNumber = validSpines.length; // If 3 spines, this is P3

  windows.push({
    phaseNumber: finalPhaseNumber,
    startBoundary: previousBoundary,
    endBoundary: '9999-12-31', // Open-ended (no upper bound)
    spineInitiativeId: lastSpine.id || null,
  });

  return windows;
}

/**
 * Computes Phase for an Initiative given spine windows and its Terminal Deadline.
 *
 * @param {object} initiative - Initiative record with terminalDeadline, nextMilestoneDeadline
 * @param {Array} spineWindows - From computeSpineWindows()
 * @returns {number|'CROSS_PHASE'|null}
 *   Phase number (1, 2, 3, ...) if initiative fits in a single window.
 *   'CROSS_PHASE' if sub-units span >1 phase (parent has no single phase).
 *   null if terminal deadline is missing/invalid.
 */
export function computeInitiativePhase(initiative, spineWindows = []) {
  if (!initiative) return null;

  // Use terminalDeadline if present; fall back to nextMilestoneDeadline if ongoing
  const deadline = String(initiative.terminalDeadline || initiative.nextMilestoneDeadline || '').trim();

  if (!deadline || !isValidISO(deadline)) {
    return null;
  }

  if (spineWindows.length === 0) {
    return null; // No spine defined yet
  }

  // Find which window(s) contain this deadline
  for (const window of spineWindows) {
    const deadlineDate = new Date(deadline).toISOString().slice(0, 10);
    const startDate = new Date(window.startBoundary).toISOString().slice(0, 10);
    const endDate = new Date(window.endBoundary).toISOString().slice(0, 10);

    // ISO string comparison works for dates (YYYY-MM-DD format)
    // Use < for endDate so boundary dates belong to the window that STARTS at that date, not the previous window
    if (deadlineDate >= startDate && deadlineDate < endDate) {
      return window.phaseNumber;
    }
  }

  // Deadline is outside all windows (before first or after last with no open-ended final window)
  return null;
}

/**
 * Validates parent-child Initiative Phase hierarchy.
 * Per rule 3: child's computed Phase must be ≥ parent's.
 *
 * @param {number} childPhase - Computed phase of child Initiative
 * @param {number} parentPhase - Computed phase of parent Initiative
 * @returns {{valid: boolean, message: string|null}}
 *   valid: true if child >= parent, false otherwise
 *   message: violation message if invalid, null if valid
 */
export function validateInitiativePhaseHierarchy(childPhase, parentPhase) {
  // Skip validation if either phase is missing
  if (childPhase === null || childPhase === undefined || parentPhase === null || parentPhase === undefined) {
    return { valid: true, message: null };
  }

  // CROSS_PHASE initiates are exempt from hierarchy check (no single phase)
  if (childPhase === 'CROSS_PHASE' || parentPhase === 'CROSS_PHASE') {
    return { valid: true, message: null };
  }

  if (childPhase >= parentPhase) {
    return { valid: true, message: null };
  }

  return {
    valid: false,
    message: `Child Initiative phase (${childPhase}) is less than parent Initiative phase (${parentPhase}). Child Phase must be >= parent Phase. Correct the child's Terminal Deadline or parent's Phase.`,
  };
}

/**
 * Detects Cross-Phase status: whether an Initiative's sub-units span >1 distinct Phase.
 * Per rule 4: if detected, parent carries no single Phase — each sub-unit keeps its own.
 *
 * @param {object} initiative - Parent Initiative
 * @param {Array<{phase}>} subUnits - Child units (Projects, child Initiatives, etc.) with computed phases
 * @returns {{isCrossPhase: boolean, phases: Set<number>, message: string|null}}
 */
export function detectCrossPhaseStatus(initiative, subUnits = []) {
  const phases = new Set();

  for (const unit of subUnits) {
    if (unit?.phase !== null && unit?.phase !== undefined && unit.phase !== 'CROSS_PHASE') {
      phases.add(Number(unit.phase));
    }
  }

  const isCrossPhase = phases.size > 1;

  return {
    isCrossPhase,
    phases,
    message: isCrossPhase
      ? `Initiative "${initiative?.name || initiative?.id}" is Cross-Phase: sub-units span phases ${Array.from(phases).sort((a, b) => a - b).join(', ')}. Parent carries no single Phase; each sub-unit keeps its own.`
      : null,
  };
}

/**
 * Helper: ISO date validation (YYYY-MM-DD format)
 */
function isValidISO(dateStr) {
  if (!dateStr || typeof dateStr !== 'string') return false;
  const match = /^\d{4}-\d{2}-\d{2}$/.test(dateStr);
  if (!match) return false;
  const d = new Date(dateStr);
  return !isNaN(d.getTime()) && d.toISOString().slice(0, 10) === dateStr;
}
