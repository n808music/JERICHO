/**
 * Terminal Convergence Types & Schemas
 *
 * Defines the structures for computing end-of-cycle convergence:
 * - P_end: planned terminal state (from cold plan + deliverables)
 * - E_end: executed terminal state (from linked execution events)
 * - Verdict: CONVERGED | INCOMPLETE | FAILED
 *
 * All computations are deterministic given frozen nowISO and timezone.
 */

/**
 * @typedef {{
 *   deliverableId: string;
 *   deliverableTitle: string;
 *   requiredBlocks: number;
 *   requiredMinutes?: number;
 *   criteria?: Array<{
 *     criterionId: string;
 *     title: string;
 *     isDone?: boolean;
 *   }>;
 * }} DeliverableRequirement
 */

/**
 * @typedef {{
 *   deliverableId: string;
 *   completedBlocks: number;
 *   completedMinutes?: number;
 *   completionRate: number;
 *   criteria?: Array<{
 *     criterionId: string;
 *     isDone: boolean;
 *   }>;
 * }} DeliverableExecution
 */

/**
 * Planned terminal state: snapshot of cold plan requirements.
 * @typedef {{
 *   requiredUnits: number;
 *   unitType: 'blocks' | 'minutes';
 *   deliverables: DeliverableRequirement[];
 *   deadline: string;
 *   deadlineType: 'HARD' | 'SOFT';
 *   computedAt: string;
 * }} ColdPlanTerminalState
 */

/**
 * Executed terminal state: snapshot of linked execution outcomes.
 * Excludes unlinked activity entirely.
 *
 * @typedef {{
 *   completedUnits: number;
 *   unitType: 'blocks' | 'minutes';
 *   deliverables: DeliverableExecution[];
 *   completionsByDeadline: number;
 *   completionsAfterDeadline: number;
 *   unlinkedActivityBlocks?: number;
 *   unlinkedActivityMinutes?: number;
 *   computedAt: string;
 * }} ExecutionTerminalState
 */

/**
 * Convergence verdict: summary of success/failure.
 * @typedef {'CONVERGED' | 'INCOMPLETE' | 'FAILED'} ConvergenceVerdict
 */

/**
 * Full convergence report: grounds for learning update decision.
 * @typedef {{
 *   verdict: ConvergenceVerdict;
 *   reasons: string[];
 *   P_end: ColdPlanTerminalState;
 *   E_end: ExecutionTerminalState;
 *   tolerance: number;
 *   computedAtISO: string;
 * }} ConvergenceReport
 */

/**
 * Build P_end from cycle + plan proof + deliverables.
 * @param {any} cycle
 * @param {any} planProof
 * @param {Array<any>} deliverables
 * @returns {ColdPlanTerminalState}
 */
export function derivePlanTerminalState(cycle = {}, planProof = null, deliverables = []) {
  const deadline = cycle?.definiteGoal?.deadlineDayKey || '';
  const deadlineType = cycle?.goalEquation?.deadlineType || 'HARD';
  
  // P_end captures the cold plan targets
  const requiredBlocks = deliverables.reduce((sum, d) => sum + (d.requiredBlocks || 0), 0);
  
  return {
    requiredUnits: requiredBlocks,
    unitType: 'blocks',
    deliverables: deliverables.map((d) => ({
      deliverableId: d.id,
      deliverableTitle: d.title,
      requiredBlocks: d.requiredBlocks || 0,
      requiredMinutes: (d.requiredBlocks || 0) * 30, // assume 30m per block
      criteria: d.criteria || []
    })),
    deadline,
    deadlineType,
    computedAt: new Date().toISOString()
  };
}

/**
 * Build E_end from execution events linked to deliverables.
 * Unlinked activity is excluded entirely from E_end (hard rule for MVP 3.0).
 *
 * @param {Array<any>} executionEvents
 * @param {string} deadlineDayKey
 * @param {Array<any>} deliverables
 * @returns {ExecutionTerminalState}
 */
export function deriveExecutionTerminalState(executionEvents = [], deadlineDayKey = '', deliverables = []) {
  const deliverableIds = new Set(deliverables.map((d) => d.id));
  
  // Filter to linked, completed events only.
  // An event is "linked" if linkageStatus === 'LINKED' OR it has deliverableId/criterionId.
  const linkedCompleted = executionEvents.filter((e) => {
    // Must be completed
    if (!e?.completed || e.kind !== 'complete') return false;
    // Must be linked to a deliverable OR have criteria linkage
    const isLinked = (e.linkageStatus === 'LINKED') || e.deliverableId || e.criterionId;
    if (!isLinked) return false;
    return true;
  });

  // Count blocks by deadline
  const completionsByDeadline = linkedCompleted.filter((e) => {
    const eventDay = e.dateISO || (e.startISO ? e.startISO.slice(0, 10) : '');
    return eventDay <= deadlineDayKey;
  }).length;

  const completionsAfterDeadline = linkedCompleted.filter((e) => {
    const eventDay = e.dateISO || (e.startISO ? e.startISO.slice(0, 10) : '');
    return eventDay > deadlineDayKey;
  }).length;

  // Unlinked activity (for reporting, not included in E_end units)
  const unlinkedActivity = executionEvents.filter(
    (e) => e?.completed && e.kind === 'complete' && (e.linkageStatus === 'UNLINKED_ACTIVITY' || (!e.deliverableId && !e.criterionId))
  );

  // Aggregate by deliverable
  const deliverableExecution = deliverables.map((d) => {
    const eventsForDeliv = linkedCompleted.filter((e) => e.deliverableId === d.id);
    return {
      deliverableId: d.id,
      completedBlocks: eventsForDeliv.length,
      completedMinutes: eventsForDeliv.reduce((sum, e) => sum + (e.minutes || 30), 0),
      completionRate: d.requiredBlocks ? eventsForDeliv.length / d.requiredBlocks : 0,
      criteria: d.criteria ? d.criteria.map((c) => ({ criterionId: c.id, isDone: c.isDone || false })) : []
    };
  });

  return {
    completedUnits: completionsByDeadline,
    unitType: 'blocks',
    deliverables: deliverableExecution,
    completionsByDeadline,
    completionsAfterDeadline,
    unlinkedActivityBlocks: unlinkedActivity.length,
    unlinkedActivityMinutes: unlinkedActivity.reduce((sum, e) => sum + (e.minutes || 30), 0),
    computedAt: new Date().toISOString()
  };
}

/**
 * Compute convergence verdict by comparing P_end vs E_end.
 * Default tolerance is strict (0 deficit).
 *
 * @param {ColdPlanTerminalState} P_end
 * @param {ExecutionTerminalState} E_end
 * @param {number} tolerance
 * @returns {{verdict: ConvergenceVerdict, reasons: string[]}}
 */
export function computeConvergenceVerdict(P_end = {}, E_end = {}, tolerance = 0) {
  const reasons = [];
  const allDeliverablesMet =
    (P_end.deliverables || []).every((pReq) => {
      const eExec = (E_end.deliverables || []).find((e) => e.deliverableId === pReq.deliverableId);
      const deficit = Math.max(0, pReq.requiredBlocks - (eExec?.completedBlocks || 0));
      if (deficit > tolerance) {
        reasons.push(
          `${pReq.deliverableTitle}: required ${pReq.requiredBlocks}, completed ${eExec?.completedBlocks || 0} (deficit: ${deficit})`
        );
        return false;
      }
      return true;
    });

  // Check deadline: completion must be by deadline (unless SOFT)
  const allByDeadline = E_end.completionsAfterDeadline === 0 || P_end.deadlineType === 'SOFT';
  if (!allByDeadline) {
    reasons.push(
      `${E_end.completionsAfterDeadline} blocks completed after deadline (hard deadline required)`
    );
  }

  let verdict = 'CONVERGED';
  if (!allDeliverablesMet) {
    verdict = 'INCOMPLETE';
  }
  if (!allByDeadline) {
    verdict = 'FAILED';
  }

  return { verdict, reasons };
}

/**
 * Full convergence report builder.
 * @param {{cycle, planProof, events, nowISO, timezone, deliverables}} input
 * @returns {ConvergenceReport}
 */
export function buildConvergenceReport({ cycle = {}, planProof = null, events = [], nowISO = '', timezone = 'UTC', deliverables = [] }) {
  const P_end = derivePlanTerminalState(cycle, planProof, deliverables);
  const E_end = deriveExecutionTerminalState(events, cycle?.definiteGoal?.deadlineDayKey || '', deliverables);
  const { verdict, reasons } = computeConvergenceVerdict(P_end, E_end, 0);

  return {
    verdict,
    reasons,
    P_end,
    E_end,
    tolerance: 0,
    computedAtISO: nowISO || new Date().toISOString()
  };
}

/**
 * Main entry point for computing terminal convergence at cycle end.
 * Pure function: deterministic given same inputs + frozen nowISO.
 *
 * @param {{
 *   cycle: any;
 *   planProof?: any;
 *   events?: Array<any>;
 *   nowISO?: string;
 *   timezone?: string;
 * }} input
 * @returns {ConvergenceReport}
 */
export function computeTerminalConvergence({
  cycle = {},
  planProof = null,
  events = [],
  nowISO = '',
  timezone = 'UTC',
  deliverables: deliverablesInput = null
} = {}) {
  // Gather deliverables from explicit input or cycle state
  const source = deliverablesInput || cycle?.deliverables || cycle?.strategy?.deliverables || [];
  const deliverables = (source || []).map((d) => ({
    id: d.id || `deliv-${Date.now()}`,
    title: d.title || 'Deliverable',
    requiredBlocks: d.requiredBlocks || 0,
    criteria: d.criteria || []
  }));

  // If no deliverables, cannot converge (goal was not formally structured)
  if (!deliverables.length) {
    return {
      verdict: 'INCOMPLETE',
      reasons: ['No deliverables defined; goal structure incomplete'],
      P_end: derivePlanTerminalState(cycle, planProof, []),
      E_end: deriveExecutionTerminalState(events, cycle?.definiteGoal?.deadlineDayKey || '', []),
      tolerance: 0,
      computedAtISO: nowISO || new Date().toISOString()
    };
  }

  // Build full report
  return buildConvergenceReport({
    cycle,
    planProof,
    events,
    nowISO,
    timezone,
    deliverables
  });
}
