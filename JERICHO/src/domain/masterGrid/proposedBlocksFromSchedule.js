/**
 * proposedBlocksFromSchedule.js
 *
 * Closes the gap identified 2026-07-13 (unified schedule generation design, §6.2 follow-up):
 * routeGenerateSchedule's fallback to the matrix-driven generateColdPlanForCycle produces a
 * real, correct canonical `cycle.schedule.blocks` (ScheduledBlock[], Stage 1) — but nothing
 * ever wrote those into `state.proposedBlocks`, which is the ONLY thing the dashboard's
 * Review/Apply screen and `applyDraftSchedule`/`activateSchedule` actually read. Since
 * `generatePlan`'s action-graph path never fires in real usage (nothing in the live app
 * populates an action graph — see design doc), the matrix engine's output had no visible or
 * appliable surface at all. This module adapts `ScheduledBlock[]` into the 'suggested'
 * proposal shape `setCycleProposedBlocks`/`buildScheduleReviewBlock` already understand.
 *
 * `buildScheduleReviewBlock` (identityCompute.js) only hard-requires `startISO` on the input
 * item — everything else is defensively defaulted (`??`/`||`). Stage 1 already gives every
 * ScheduledBlock a real startISO/endISO, so this adapter just needs to carry the fields
 * through under the names the review/apply pipeline expects (`title` instead of
 * `deliverableTitle`, `status: 'suggested'`, etc.) — no new computation.
 */

/**
 * @param {Array<object>} scheduledBlocks - ScheduledBlock[] (scheduledBlocksFromDeterministicResult.js)
 * @param {object} [opts]
 * @param {string} [opts.domain] - defaults to 'FOCUS'; matrix-derived blocks have no domain concept of their own
 * @param {string} [opts.createdAtISO]
 * @returns {Array<object>} proposal objects with status:'suggested', ready for setCycleProposedBlocks
 */
export function buildProposedBlocksFromSchedule(scheduledBlocks = [], { domain = 'FOCUS', createdAtISO = '' } = {}) {
  if (!Array.isArray(scheduledBlocks) || scheduledBlocks.length === 0) return [];

  return scheduledBlocks.map((block) => ({
    id: block.id,
    identityKey: block.id,
    goalId: block.goalId ?? null,
    cycleId: block.cycleId ?? null,
    status: 'suggested',
    title: block.deliverableTitle || 'Scheduled action',
    domain,
    durationMinutes: block.durationMinutes,
    createdAtISO,
    startISO: block.startISO,
    endISO: block.endISO,
    dayKey: block.dayKey,
    laneId: block.laneId ?? null,
    laneLabel: block.laneLabel ?? null,
    entityId: block.entityId ?? null,
    entityLabel: block.entityLabel ?? null,
    // Gate 2: carry Initiative + Project identity so the calendar scope toggle can isolate by
    // Initiative and Project on matrix-derived blocks (previously dropped here). laneId already
    // mirrors initiativeId, but the explicit fields are what filterCalendarBlocksByScope reads.
    initiativeId: block.initiativeId ?? null,
    sourceProjectId: block.sourceProjectId ?? null,
    deliverableId: block.deliverableId ?? null,
    actionId: null,
    blockType: 'execution',
    placementBasis: 'confirmed',
    source: 'matrix_schedule_generation',
  }));
}

export default buildProposedBlocksFromSchedule;
