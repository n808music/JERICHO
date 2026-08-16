/**
 * terminalDeadlineBackfill.js
 *
 * Task A: Backfill Terminal Deadline values from verified Google Sheet dataset (2026-08-15).
 * These values were manually verified against the live sheet and are canonical ground truth.
 *
 * Per directive: "do not re-derive it from the fixture or re-run your own audit logic to
 * produce these numbers; they are already verified against the live Google Sheet."
 */

/**
 * Verified Terminal Deadline dataset (all 30 Initiatives, 2026-08-15)
 * Source: Google Sheet reference matrix (hand-audited against spine windows)
 */
export const TERMINAL_DEADLINE_DATASET = {
  'global-state-solutions-foundation': { terminalDeadline: '2026-08-31' },
  'help-your-self-broadcast-foundation-new': { terminalDeadline: '2026-08-24' },
  'help-your-self-broadcast': { terminalDeadline: null, nextMilestoneDeadline: '2026-08-17' },
  'global-state-corp-foundation': { terminalDeadline: '2026-09-02' },
  'state-of-control-foundation': { terminalDeadline: '2026-08-25' },
  'the-jericho-system': { terminalDeadline: null, nextMilestoneDeadline: '2026-08-31' },
  'global-state-productions-foundation': { terminalDeadline: '2026-09-11' },
  'global-state-systems-foundation': { terminalDeadline: '2026-09-14' },
  'global-state-holdings-foundation': { terminalDeadline: '2026-09-17' },
  'marketing-flywheel-foundation-new': { terminalDeadline: '2026-09-18' },
  'global-state-academy-foundation': { terminalDeadline: '2026-09-20' },
  'f8-energy-foundation': { terminalDeadline: '2026-09-23' },
  '79th-street-renovation-foundation-new': { terminalDeadline: '2026-10-01' },
  'first-academy-building-foundation-new': { terminalDeadline: '2026-10-05' },
  'hys-batch-1-milestone': { terminalDeadline: '2026-10-17' },
  'our-fearless-leader-7-seals-foundation-new': { terminalDeadline: '2026-10-09' },
  'the-imaginary-ceo-foundation-new': { terminalDeadline: '2026-10-13' },
  'seeds-of-destruction-foundation-new': { terminalDeadline: '2026-10-20' },
  'marketing-flywheel-audience-capture': { terminalDeadline: null, nextMilestoneDeadline: '2026-10-15' },
  'our-fearless-leader-7-seals': { terminalDeadline: '2028-02-17' },
  'i-am-the-state-foundation-new': { terminalDeadline: '2026-10-27' },
  'f8-energy-gum-foundation-new': { terminalDeadline: '2026-11-06' },
  'state-of-control': { terminalDeadline: '2028-02-17' },
  'the-imaginary-ceo': { terminalDeadline: '2032-03-15' },
  '79th-street-renovation': { terminalDeadline: '2028-06-30' },
  'f8-energy-production-operations': { terminalDeadline: null, nextMilestoneDeadline: '2029-08-17' },
  'seeds-of-destruction': { terminalDeadline: '2029-08-17' },
  'f8-energy-gum-production': { terminalDeadline: null, nextMilestoneDeadline: '2029-08-17' },
  'first-academy-building': { terminalDeadline: '2028-09-01' },
  'i-am-the-state': { terminalDeadline: '2031-12-31' },
};

/**
 * Corrected spine (Path B, operator-declared, configurable)
 * Terminal Deadlines define phase window boundaries
 */
export const CORRECTED_SPINE = [
  'state-of-control',        // Terminal: 2028-02-17 → P1 boundary
  'seeds-of-destruction',    // Terminal: 2029-08-17 → P2 boundary
  'i-am-the-state',          // Terminal: 2031-12-31 → P3 boundary
];

/**
 * Apply backfill to a state object, updating all Initiatives with Terminal Deadline values.
 * Returns a diff report showing what changed.
 *
 * @param {object} state - Full identity state (with state.matrix.initiativesById)
 * @returns {object} Diff report with updates applied
 */
export function applyTerminalDeadlineBackfill(state) {
  if (!state?.matrix?.initiativesById) {
    return {
      success: false,
      message: 'No matrix.initiativesById in state',
      diffs: [],
    };
  }

  const diffs = [];
  const initiatives = state.matrix.initiativesById;

  // Apply backfill to each Initiative in the dataset
  for (const [initiativeId, deadlineData] of Object.entries(TERMINAL_DEADLINE_DATASET)) {
    const initiative = initiatives[initiativeId];
    if (!initiative) {
      diffs.push({
        initiativeId,
        name: initiativeId,
        status: 'NOT_FOUND',
        oldTerminalDeadline: null,
        newTerminalDeadline: deadlineData.terminalDeadline,
        oldNextMilestoneDeadline: null,
        newNextMilestoneDeadline: deadlineData.nextMilestoneDeadline,
      });
      continue;
    }

    const oldTerminalDeadline = initiative.terminalDeadline || null;
    const oldNextMilestoneDeadline = initiative.nextMilestoneDeadline || null;

    // Determine if this is a change
    const terminalDeadlineChanged = oldTerminalDeadline !== deadlineData.terminalDeadline;
    const nextMilestoneDeadlineChanged = oldNextMilestoneDeadline !== deadlineData.nextMilestoneDeadline;

    // Apply the backfill
    if (deadlineData.terminalDeadline !== undefined) {
      initiative.terminalDeadline = deadlineData.terminalDeadline;
    }
    if (deadlineData.nextMilestoneDeadline !== undefined) {
      initiative.nextMilestoneDeadline = deadlineData.nextMilestoneDeadline;
    }

    // Record the diff
    if (terminalDeadlineChanged || nextMilestoneDeadlineChanged) {
      diffs.push({
        initiativeId,
        name: initiative.name || initiativeId,
        status: 'UPDATED',
        oldTerminalDeadline,
        newTerminalDeadline: deadlineData.terminalDeadline,
        oldNextMilestoneDeadline,
        newNextMilestoneDeadline: deadlineData.nextMilestoneDeadline,
      });
    }
  }

  return {
    success: true,
    message: `Backfill applied: ${diffs.filter(d => d.status === 'UPDATED').length} updates, ${diffs.filter(d => d.status === 'NOT_FOUND').length} not found`,
    diffs,
  };
}

/**
 * Declare the corrected spine (operator-declared list of Initiative IDs).
 * Per doctrine: spine defines phase window boundaries via each Initiative's Terminal Deadline.
 *
 * @param {object} state - Full identity state (with state.matrix)
 * @returns {object} Spine declaration result
 */
export function declareCorrectSpine(state) {
  if (!state?.matrix) {
    return {
      success: false,
      message: 'No matrix in state',
    };
  }

  const initiatives = state.matrix.initiativesById || {};

  // Validate all spine IDs exist
  const invalidIds = CORRECTED_SPINE.filter((id) => !initiatives[id]);
  if (invalidIds.length > 0) {
    return {
      success: false,
      message: `Spine declaration failed: unknown Initiative IDs: ${invalidIds.join(', ')}`,
      invalidIds,
    };
  }

  // Set the spine
  state.matrix.spineInitiativeIds = CORRECTED_SPINE;

  // Return report with window boundaries
  const spineInitiatives = CORRECTED_SPINE.map((id) => initiatives[id]);
  const report = {
    success: true,
    message: 'Spine declared successfully',
    spineInitiativeIds: CORRECTED_SPINE,
    windows: spineInitiatives.map((init, idx) => ({
      phase: idx + 1,
      spineInitiativeId: init.id,
      name: init.name,
      terminalDeadline: init.terminalDeadline,
    })),
  };

  return report;
}
