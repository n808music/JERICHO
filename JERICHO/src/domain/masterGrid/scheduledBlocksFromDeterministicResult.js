/**
 * scheduledBlocksFromDeterministicResult.js
 *
 * Adapts a DeterministicPlanResult (deterministicPlanGenerator.ts's proposedBlocks —
 * dayKey/deliverableId/kind/durationMinutes/order, with an optional sourceProjectId once
 * §6/§3's projectId pass-through landed) into the canonical `ScheduledBlock` shape from the
 * 2026-07-13 unified schedule generation design (§3).
 *
 * Why this exists: Generator A's real output (`cycle.coldPlan.forecastByDayKey`, a
 * day-bucketed *count*) is strictly weaker than what the app already renders/reviews
 * (Generator B's real ISO-timed blocks, and `createBlock`'s persisted shape). This module is
 * the first concrete step in unifying on the richer shape — it wraps the SAME allocation
 * result deterministicPlanGenerator already produces, adding real startISO/endISO and
 * entity/lane identity, so a `ScheduledBlock[]` can exist without first rewriting the
 * allocation algorithm itself (that stays the deterministic generator's job; this module
 * only adapts its output).
 *
 * Entity/lane resolution: a ProposedBlock only carries a `sourceProjectId` when its
 * deliverable traces back to a matrix Project (i.e., it came from
 * `buildCausalChainStepsFromMatrix`, not a manually-authored causal chain or the generic
 * 3-tier fallback). When present, entityId/initiativeId/laneId are resolved from the
 * matrix; otherwise they are null — no guessing.
 *
 * Time-of-day: ProposedBlock only carries a dayKey, not a time. Blocks are stacked
 * back-to-back within a day, in the order they appear for that day in `proposedBlocks`,
 * starting at `dayStartTime` (default 09:00 local). This is a placeholder scheduling
 * convention, not a claim about the operator's actual daily rhythm — a future stage of the
 * unified engine can make this configurable per Capacity workWindows.
 */

import { buildLocalStartISO } from '../../state/time/time.ts';

function addMinutesToTimeStr(timeStr, minutes) {
  const [h, m] = timeStr.split(':').map(Number);
  const totalMinutes = h * 60 + m + minutes;
  const hh = Math.floor(totalMinutes / 60) % 24;
  const mm = totalMinutes % 60;
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}

/**
 * @param {object} params
 * @param {import('../../core/deterministicPlanGenerator').DeterministicPlanResult} params.result
 * @param {object} [params.matrix] - state.matrix, for entityId/laneId resolution
 * @param {string} params.cycleId
 * @param {string|null} [params.goalId]
 * @param {string} [params.generatorVersion]
 * @param {string} [params.strategyId]
 * @param {string} [params.createdAtISO]
 * @param {string} [params.timeZone]
 * @param {string} [params.dayStartTime] - "HH:MM", local start-of-day anchor for stacking blocks
 * @returns {Array<object>} ScheduledBlock[] — [] when the result is INFEASIBLE or empty
 */
export function buildScheduledBlocksFromDeterministicResult({
  result,
  matrix = {},
  cycleId,
  goalId = null,
  generatorVersion = 'deterministicPlan_v1',
  strategyId = null,
  createdAtISO = '',
  timeZone = 'UTC',
  dayStartTime = '09:00',
} = {}) {
  if (!result || result.status === 'INFEASIBLE') {return [];}
  const proposedBlocks = Array.isArray(result.proposedBlocks) ? result.proposedBlocks : [];
  if (proposedBlocks.length === 0) {return [];}

  const projectsById = matrix.projectsById || {};
  const entitiesById = matrix.entitiesById || {};
  const initiativesById = matrix.initiativesById || {};

  // Position-within-day, computed in array-appearance order per dayKey — used only to
  // stack start times; not itself part of the canonical shape (§3's `order` field means
  // something different: position within the deliverable's own block sequence).
  const seenInDay = {};

  return proposedBlocks.map((block, idx) => {
    const positionInDay = seenInDay[block.dayKey] || 0;
    seenInDay[block.dayKey] = positionInDay + 1;

    const startTimeStr = addMinutesToTimeStr(dayStartTime, positionInDay * (block.durationMinutes || 60));
    const endTimeStr = addMinutesToTimeStr(startTimeStr, block.durationMinutes || 60);
    const startResult = buildLocalStartISO(block.dayKey, startTimeStr, timeZone);
    const endResult = buildLocalStartISO(block.dayKey, endTimeStr, timeZone);

    const project = block.sourceProjectId ? projectsById[block.sourceProjectId] : null;
    const entityId = project?.owningEntityId || null;
    const initiativeId = project?.owningInitiativeId || null;

    return {
      id: `sched-${cycleId}-${idx + 1}`,
      cycleId,
      goalId,
      dayKey: block.dayKey,
      startISO: startResult.ok ? startResult.startISO : null,
      endISO: endResult.ok ? endResult.startISO : null,
      durationMinutes: block.durationMinutes || 60,
      origin: 'schedule_generation',
      status: 'proposed',
      deliverableId: block.deliverableId,
      deliverableTitle: block.deliverableTitle,
      // Carry the project id through (not just the entity/initiative it resolves) so the
      // calendar scope toggle can isolate by Project — Gate 8. Without this the Project
      // category is structurally unfilterable on real scheduled blocks.
      sourceProjectId: block.sourceProjectId || null,
      entityId,
      entityLabel: entityId ? entitiesById[entityId]?.name || null : null,
      initiativeId,
      laneId: initiativeId,
      laneLabel: initiativeId ? initiativesById[initiativeId]?.name || null : null,
      kind: block.kind,
      order: block.order,
      generatorVersion,
      strategyId,
      createdAtISO,
    };
  });
}

export default buildScheduledBlocksFromDeterministicResult;
