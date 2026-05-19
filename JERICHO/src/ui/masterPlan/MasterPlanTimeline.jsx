import React, { useMemo, useState } from 'react';
import { useIdentityStore } from '../../state/identityStore.js';
import {
  selectActiveMasterPlan,
  selectMasterPlanLanes,
  selectMasterTimeline,
  selectMasterPlanAnchors,
} from '../../domain/masterPlan/masterPlanSelectors.js';
import {
  auditFullHorizonCoverage,
  getFullHorizonCoverageLabel,
  getFullHorizonCoverageTone,
} from '../../domain/masterPlan/fullHorizonCoverageAudit.js';
import {
  getFullHorizonPlanQualityLabel,
  getFullHorizonPlanQualityTone,
} from '../../domain/masterPlan/fullHorizonPlanQuality.js';
import { deriveMasterPlanPhaseModel } from '../../domain/masterPlan/masterPlanPhaseModel.js';
import { clampDayKeyToRange, normalizeStrategicDayKey, resolveStrategicAgendaHorizon } from '../../domain/masterPlan/strategicHorizon.js';
import TimelineGrid from './TimelineGrid.jsx';
import MasterPlanLaneCard from './MasterPlanLaneCard.jsx';

function titleCaseWords(value) {
  return String(value || '')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function getGoalDisplayLabel(store, goalId) {
  const goal = store?.goalsById?.[goalId] || null;
  const cycle = goal?.activeCycleId ? store?.cyclesById?.[goal.activeCycleId] || null : null;
  return (
    goal?.title ||
    cycle?.goalContract?.goalLabel ||
    cycle?.goalContract?.goalText ||
    cycle?.goalGovernanceContract?.goalText ||
    goalId
  );
}

function normalizeDayKey(value) {
  if (!value) {
    return null;
  }
  const text = String(value).trim();
  if (!text) {
    return null;
  }
  return text.slice(0, 10);
}

function parseDayKey(value) {
  const dayKey = normalizeDayKey(value);
  return dayKey ? new Date(`${dayKey}T12:00:00.000Z`) : null;
}

function addDaysToDayKey(value, days) {
  const date = parseDayKey(value);
  if (!date) {
    return null;
  }
  date.setUTCDate(date.getUTCDate() + Number(days || 0));
  return date.toISOString().slice(0, 10);
}

function dayDistanceInclusive(startValue, endValue) {
  const start = parseDayKey(startValue);
  const end = parseDayKey(endValue);
  if (!start || !end) {
    return 0;
  }
  return Math.max(1, Math.round((end.getTime() - start.getTime()) / 86400000) + 1);
}

function formatDateLabel(value) {
  const date = parseDayKey(value);
  if (!date) {
    return '—';
  }
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

function formatRangeLabel(startValue, endValue) {
  const start = formatDateLabel(startValue);
  const end = formatDateLabel(endValue);
  if (start === '—' && end === '—') {
    return '—';
  }
  if (start === end) {
    return start;
  }
  return `${start} → ${end}`;
}

function minDayKey(left, right) {
  return clampDayKeyToRange(left, right);
}

function getTemporalDayKey(item) {
  return normalizeDayKey(item?.dayKey || item?.targetDate || item?.date || item?.startISO || item?.start);
}

function sortByTemporalValue(items) {
  return [...(Array.isArray(items) ? items : [])].sort((left, right) =>
    String(getTemporalDayKey(left) || '').localeCompare(String(getTemporalDayKey(right) || ''))
  );
}

function getFirstFixedAnchor(anchors) {
  return (
    [...(Array.isArray(anchors) ? anchors : [])]
      .filter((anchor) => normalizeDayKey(anchor?.date))
      .sort((left, right) => String(left?.date || '').localeCompare(String(right?.date || '')))
      .find((anchor) => anchor?.isFixed) ||
    [...(Array.isArray(anchors) ? anchors : [])]
      .filter((anchor) => normalizeDayKey(anchor?.date))
      .sort((left, right) => String(left?.date || '').localeCompare(String(right?.date || '')))[0] ||
    null
  );
}

function splitRangeIntoSegments(startValue, endValue, segmentCount) {
  const start = parseDayKey(startValue);
  const end = parseDayKey(endValue);
  if (!start || !end || start > end || segmentCount <= 0) {
    return [];
  }
  const totalDays = dayDistanceInclusive(startValue, endValue);
  let cursor = normalizeDayKey(startValue);
  let remainingDays = totalDays;
  let remainingSegments = segmentCount;
  const segments = [];
  while (remainingSegments > 0 && cursor) {
    const size = Math.max(1, Math.ceil(remainingDays / remainingSegments));
    const segmentEnd = remainingSegments === 1 ? normalizeDayKey(endValue) : addDaysToDayKey(cursor, size - 1);
    segments.push({ start: cursor, end: segmentEnd });
    const usedDays = dayDistanceInclusive(cursor, segmentEnd);
    remainingDays = Math.max(0, remainingDays - usedDays);
    remainingSegments -= 1;
    cursor = remainingSegments > 0 ? addDaysToDayKey(segmentEnd, 1) : null;
  }
  return segments;
}

function getPhaseBlueprints() {
  return [
    {
      key: 'foundation',
      title: 'Phase 1 · Foundation / Convergence Build',
      summary: 'Build the converging launch foundation before the first hard anchor.',
    },
    {
      key: 'proof',
      title: 'Phase 2 · Launch Conversion / Proof Capture',
      summary: 'Convert the anchor event into proof, traction, and measurable continuation signal.',
    },
    {
      key: 'operating_system',
      title: 'Phase 3 · Operating System / Revenue Architecture',
      summary: 'Stabilize the product-media-feedback loop and build repeatable operating cadence.',
    },
    {
      key: 'scaling',
      title: 'Phase 4 · Scaling / Capital Path',
      summary: 'Expand proven lanes, partnerships, and capital options only where evidence supports scaling.',
    },
    {
      key: 'continuation',
      title: 'Phase 5 · Empire Continuation / Terminal Readiness',
      summary: 'Evaluate mission continuity against the success standard and define the next horizon if needed.',
    },
  ];
}

function deriveLanePhaseStatus(lane, phaseIndex, totalPhases) {
  const activation = String(lane?.activationState || '').trim().toLowerCase();
  const domain = String(lane?.domain || '').trim().toLowerCase();
  if (activation === 'parked') {
    return 'deferred';
  }
  if (phaseIndex === 0) {
    return activation || 'active';
  }
  if (['capital', 'real_estate', 'institution', 'education', 'civic', 'district'].includes(domain) && phaseIndex < totalPhases - 1) {
    return 'gated';
  }
  if (activation === 'incubating') {
    return phaseIndex >= Math.max(1, totalPhases - 2) ? 'dependent' : 'gated';
  }
  return 'active';
}

function buildStrategicPhases(plan, lanes, anchors, strategicHorizonEndDayKey = null) {
  const horizonStart = normalizeDayKey(plan?.horizonStart);
  const horizonEnd =
    normalizeStrategicDayKey(strategicHorizonEndDayKey) || normalizeDayKey(plan?.fullHorizonEndDayKey || plan?.horizonEnd);
  if (!horizonStart || !horizonEnd) {
    return [];
  }
  const firstAnchor = getFirstFixedAnchor(anchors);
  const firstAnchorDayKey = normalizeDayKey(firstAnchor?.date);
  const blueprints = getPhaseBlueprints();
  const segments = [];
  if (firstAnchorDayKey && firstAnchorDayKey > horizonStart && firstAnchorDayKey < horizonEnd) {
    segments.push({ start: horizonStart, end: firstAnchorDayKey, anchorPhase: true });
    const postAnchorStart = addDaysToDayKey(firstAnchorDayKey, 1);
    const remainingDays = dayDistanceInclusive(postAnchorStart, horizonEnd);
    const trailingCount = remainingDays >= 540 ? 4 : remainingDays >= 240 ? 3 : remainingDays >= 90 ? 2 : 1;
    segments.push(...splitRangeIntoSegments(postAnchorStart, horizonEnd, trailingCount));
  } else {
    const totalDays = dayDistanceInclusive(horizonStart, horizonEnd);
    const count = totalDays >= 720 ? 5 : totalDays >= 365 ? 4 : totalDays >= 180 ? 3 : 2;
    segments.push(...splitRangeIntoSegments(horizonStart, horizonEnd, count));
  }
  return segments.map((segment, index) => {
    const blueprint = blueprints[Math.min(index, blueprints.length - 1)];
    return {
      id: `phase-${index + 1}`,
      title: blueprint.title,
      summary: blueprint.summary,
      start: segment.start,
      end: segment.end,
      anchorPhase: Boolean(segment.anchorPhase),
      laneStatuses: lanes.map((lane) => ({
        laneId: lane.id,
        laneTitle: lane.title,
        domain: lane.domain,
        status: deriveLanePhaseStatus(lane, index, segments.length),
      })),
    };
  });
}

function buildStrategicCoverage(plan, anchors, planCycle, firstCycleWindow, strategicHorizonEndDayKey = null) {
  const horizonStart = normalizeDayKey(plan?.horizonStart);
  const horizonEnd =
    normalizeStrategicDayKey(strategicHorizonEndDayKey) || normalizeDayKey(plan?.fullHorizonEndDayKey || plan?.horizonEnd);
  const firstAnchor = getFirstFixedAnchor(anchors);
  const firstAnchorDayKey = normalizeDayKey(firstAnchor?.date);
  const executionCycleWindowDays = Number(planCycle?.autoAsanaPlan?.summary?.executionCycleWindowDays || 28);
  const schedulePreviewWindowDays = Number(planCycle?.autoAsanaPlan?.summary?.schedulePreviewWindowDays || 28);
  const cycleStart = normalizeDayKey(planCycle?.startedAtDayKey || firstCycleWindow?.start || horizonStart);
  const cycleEnd = cycleStart ? addDaysToDayKey(cycleStart, executionCycleWindowDays - 1) : null;
  const scheduledWindow = firstCycleWindow
    ? {
        start: firstCycleWindow.start,
        end: firstCycleWindow.end,
        days: dayDistanceInclusive(firstCycleWindow.start, firstCycleWindow.end),
      }
    : null;
  const postAnchorDays =
    firstAnchorDayKey && horizonEnd && firstAnchorDayKey < horizonEnd
      ? dayDistanceInclusive(addDaysToDayKey(firstAnchorDayKey, 1), horizonEnd)
      : 0;
  let coverageStatus = 'insufficient_strategy_beyond_anchor';
  if (horizonStart && horizonEnd) {
    coverageStatus = firstAnchorDayKey
      ? postAnchorDays > 0
        ? 'full_horizon_covered'
        : 'anchor_only'
      : 'partial_horizon_covered';
  }
  return {
    horizonStart,
    horizonEnd,
    firstAnchor,
    firstAnchorDayKey,
    executionCycleWindow: cycleStart && cycleEnd ? { start: cycleStart, end: cycleEnd, days: executionCycleWindowDays } : null,
    scheduledWindow,
    schedulePreviewWindowDays,
    coverageStatus,
    postAnchorDays,
  };
}

function buildCommitmentLayers({ plan, lanes, milestones, anchors, planCycle, committedBlocks, strategicHorizonEndDayKey, criticQuestionsByLane }) {
  const horizonEnd =
    normalizeStrategicDayKey(strategicHorizonEndDayKey) || normalizeDayKey(plan?.fullHorizonEndDayKey || plan?.horizonEnd);
  const firstAnchor = getFirstFixedAnchor(anchors);
  const firstAnchorDayKey = normalizeDayKey(firstAnchor?.date);
  const committedWindowEnd = normalizeDayKey(committedBlocks?.[committedBlocks.length - 1]?.dayKey || committedBlocks?.[committedBlocks.length - 1]?.startISO);
  const liveCycleEnd = normalizeDayKey(planCycle?.goalContract?.endDayKey || null);
  const laneById = new Map((lanes || []).map((lane) => [lane.id, lane]));
  const roadmapItems = [];
  const forecastItems = [];
  const gatedItems = [];

  sortByTemporalValue(milestones).forEach((milestone) => {
    const lane = laneById.get(milestone?.laneId) || null;
    const dayKey = getTemporalDayKey(milestone);
    if (!lane || !dayKey) {
      return;
    }
    const laneStatus = String(lane?.activationState || '').trim().toLowerCase();
    const milestoneType = String(milestone?.milestoneType || '').trim().toLowerCase();
    const isGated =
      milestoneType === 'gate' ||
      laneStatus === 'incubating' ||
      laneStatus === 'parked' ||
      ['capital', 'real_estate', 'institution', 'education', 'civic', 'district'].includes(String(lane?.domain || '').trim().toLowerCase());
    const item = {
      id: `${isGated ? 'gated' : 'forecast'}-${milestone.id}`,
      sourceId: milestone.id,
      laneId: lane.id,
      laneTitle: lane.title,
      title: milestone.title,
      dayKey,
      commitmentState: isGated ? 'gated' : 'forecast',
      expectedOutput: milestone.title,
      dependencyStatus: isGated ? 'dependency_or_evidence_gate' : 'sequenced_projection',
      milestoneType,
      missConsequence: milestone?.missConsequence || null,
    };
    roadmapItems.push(item);
    if (committedWindowEnd && dayKey <= committedWindowEnd) {
      return;
    }
    if (isGated) {
      gatedItems.push(item);
      return;
    }
    forecastItems.push(item);
  });

  const roadmapCoverageEnd = roadmapItems[roadmapItems.length - 1]?.dayKey || committedWindowEnd || firstAnchorDayKey || null;
  const forecastCoverageEnd = forecastItems[forecastItems.length - 1]?.dayKey || null;
  const nextReassessmentGate = planCycle
    ? String(planCycle?.reassessmentStatus || '').trim().toLowerCase() === 'required'
      ? 'Required before committing additional work'
      : liveCycleEnd
        ? `End of current execution cycle · ${formatDateLabel(liveCycleEnd)}`
        : 'After the current execution cycle evidence review'
    : 'Start an execution cycle to create the first reassessment gate';
  const forecastShortOfAnchor = Boolean(
    firstAnchorDayKey &&
      committedWindowEnd &&
      committedWindowEnd < firstAnchorDayKey &&
      (!forecastCoverageEnd || forecastCoverageEnd < firstAnchorDayKey)
  );
  const unresolvedCriticDebt = Object.values(criticQuestionsByLane || {}).some((questions) => Array.isArray(questions) && questions.length > 0);
  const forecastShortReason = forecastShortOfAnchor
    ? unresolvedCriticDebt
      ? 'Forecast currently stops short of the next hard anchor because unresolved structure debt still limits confidence.'
      : 'Forecast currently stops short of the next hard anchor until reassessment confirms more evidence-supported work.'
    : null;

  return {
    roadmapItems,
    forecastItems,
    gatedItems,
    committedWindowEnd,
    roadmapCoverageEnd,
    forecastCoverageEnd,
    strategicAgendaEndDayKey: horizonEnd,
    nextReassessmentGate,
    forecastShortReason,
  };
}

function getPlanCycle(store, plan) {
  const isLiveCycle = (cycle) => {
    const status = String(cycle?.status || cycle?.state || '')
      .trim()
      .toLowerCase();
    return Boolean(cycle?.id) && !['ended', 'archived', 'deleted'].includes(status);
  };
  const activeCycle = store?.activeCycleId ? store?.cyclesById?.[store.activeCycleId] || null : null;
  if (activeCycle?.masterPlanId === plan?.id && isLiveCycle(activeCycle)) {
    return activeCycle;
  }
  const canonicalGoalId = plan?.id ? `masterplan:${plan.id}` : null;
  if (
    isLiveCycle(activeCycle) &&
    canonicalGoalId &&
    [activeCycle?.goalContract?.goalId, activeCycle?.contract?.goalId, activeCycle?.definiteGoal?.goalId].includes(canonicalGoalId)
  ) {
    return activeCycle;
  }
  if (isLiveCycle(activeCycle)) {
    return activeCycle;
  }
  return (
    Object.values(store?.cyclesById || {}).find((cycle) => {
      if (!isLiveCycle(cycle)) {
        return false;
      }
      if (cycle?.masterPlanId === plan?.id) {
        return true;
      }
      return Boolean(canonicalGoalId) &&
        [cycle?.goalContract?.goalId, cycle?.contract?.goalId, cycle?.definiteGoal?.goalId].includes(canonicalGoalId);
    }) || null
  );
}

function mapCriticQuestionsByLane(plan, lanes) {
  const unresolvedQuestions = Array.isArray(plan?.structureCritic?.unresolvedQuestions)
    ? plan.structureCritic.unresolvedQuestions
    : [];
  const laneById = new Map(lanes.map((lane) => [lane.id, lane]));
  const result = {};
  unresolvedQuestions.forEach((question) => {
    const directLaneId = String(question?.laneId || '').trim();
    if (directLaneId && laneById.has(directLaneId)) {
      if (!result[directLaneId]) {
        result[directLaneId] = [];
      }
      result[directLaneId].push(question);
      return;
    }
    const domain = String(question?.domain || '').trim().toLowerCase();
    if (!domain) {
      return;
    }
    const matchingLane = lanes.find((lane) => String(lane?.domain || '').trim().toLowerCase() === domain);
    if (matchingLane) {
      if (!result[matchingLane.id]) {
        result[matchingLane.id] = [];
      }
      result[matchingLane.id].push(question);
    }
  });
  return result;
}

// ─── Entry point ──────────────────────────────────────────────────────────────
// Routing logic:
//   active master plan → show master plan adapted to TimelineGrid
//   otherwise → read-only empty state instructing the user to complete Structure intake first

export default function MasterPlanTimeline() {
  const store = useIdentityStore();
  const plan = selectActiveMasterPlan(store);

  if (plan) {
    return <MasterPlanTimelineView plan={plan} store={store} />;
  }

  return <NoMasterPlanState store={store} />;
}

// ─── Empty state ──────────────────────────────────────────────────────────────

function NoMasterPlanState({ store }) {
  const hasPersistenceRecovery =
    String(store?.planRecovery?.required || '')
      .trim()
      .toUpperCase() === 'PERSISTED_PLAN_MISSING';
  const reasonCodes = Array.isArray(store?.planRecovery?.persistenceFailure?.reasonCodes)
    ? store.planRecovery.persistenceFailure.reasonCodes
    : [];

  return (
    <div className="flex flex-col items-center justify-center py-20 gap-4 text-center">
      {hasPersistenceRecovery ? (
        <>
          <p className="text-sm font-semibold text-amber-900">Profile found, but active plan is missing.</p>
          <p className="text-muted text-sm max-w-xl">
            Jericho quarantined invalid execution residue because the owning goal or master plan could not be
            restored safely. Return to Structure to recover or recreate the plan.
          </p>
          {reasonCodes.length > 0 ? (
            <p className="text-[11px] uppercase tracking-[0.14em] text-amber-700">
              {reasonCodes.join(' · ')}
            </p>
          ) : null}
        </>
      ) : (
        <p className="text-muted text-sm">No master plan established yet. Complete Structure intake first.</p>
      )}
    </div>
  );
}

// ─── Master plan adapter ──────────────────────────────────────────────────────
// Converts masterPlan + lanes + milestones into the normalized TimelineGrid props.

function MasterPlanTimelineView({ plan, store }) {
  const [selectedLaneId, setSelectedLaneId] = useState(null);
  const [commitmentView, setCommitmentView] = useState('committed_forecast');
  const [horizonView, setHorizonView] = useState('full');

  const lanes = selectMasterPlanLanes(store, plan.id);
  const allMilestones = selectMasterTimeline(store, plan.id);
  const anchors = selectMasterPlanAnchors(store, plan.id);
  const planCycle = getPlanCycle(store, plan);
  const cycleDraftBlocks =
    planCycle && Array.isArray(store?.proposedBlocksByCycleId?.[planCycle.id])
      ? store.proposedBlocksByCycleId[planCycle.id]
      : planCycle && Array.isArray(store?.proposedBlocks)
        ? store.proposedBlocks.filter(
            (block) => block?.cycleId === planCycle.id && block?.masterPlanId === plan.id
          )
        : [];
  const reviewBlocks = Array.isArray(planCycle?.scheduleReviewBlocks) ? planCycle.scheduleReviewBlocks : [];
  const firstCycleBlocks = (reviewBlocks.length > 0 ? reviewBlocks : cycleDraftBlocks)
    .filter((block) => block?.masterPlanId === plan.id)
    .sort((left, right) => String(left?.dayKey || left?.startISO || '').localeCompare(String(right?.dayKey || right?.startISO || '')));
  const canonicalPreviewBlocks = (firstCycleBlocks.length > 0
    ? firstCycleBlocks
    : Array.isArray(store?.proposedBlocks)
      ? store.proposedBlocks.filter((block) => block?.masterPlanId === plan.id)
      : [])
    .filter((block) => block?.masterPlanId === plan.id)
    .sort((left, right) => String(left?.dayKey || left?.startISO || '').localeCompare(String(right?.dayKey || right?.startISO || '')));
  const planPolicy = store?.masterPlanPolicyByPlanId?.[plan.id] || plan?.policyState?.goalPolicy || null;
  const criticQuestionsByLane = useMemo(() => mapCriticQuestionsByLane(plan, lanes), [plan, lanes]);
  const firstCycleWindow = useMemo(() => {
    const datedBlocks = canonicalPreviewBlocks
      .map((block) => normalizeDayKey(block?.dayKey || block?.startISO))
      .filter(Boolean)
      .sort();
    if (!datedBlocks.length) {
      return null;
    }
    return {
      start: datedBlocks[0],
      end: datedBlocks[datedBlocks.length - 1],
      count: canonicalPreviewBlocks.length,
      lifecycle: planCycle?.scheduleLifecycle || null,
    };
  }, [canonicalPreviewBlocks, planCycle]);
  const activeProfile = store?.activeProfileId ? store?.profilesById?.[store.activeProfileId] || null : null;
  const activeMissionContractId = plan?.coreMissionContractId || activeProfile?.activeCoreMissionContractId || null;
  const activeMissionContract = activeMissionContractId ? store?.coreMissionContractsById?.[activeMissionContractId] || null : null;
  const strategicAgenda = useMemo(
    () => resolveStrategicAgendaHorizon(plan, activeMissionContract),
    [plan, activeMissionContract]
  );
  const canonicalFullHorizonBlocks = useMemo(() => {
    const blocks = Array.isArray(store?.fullHorizonScheduleBlocks) ? store.fullHorizonScheduleBlocks : [];
    return blocks
      .filter((block) => String(block?.masterPlanId || block?.planId || plan.id).trim() === plan.id || !block?.masterPlanId)
      .sort((left, right) => String(left?.dayKey || left?.date || '').localeCompare(String(right?.dayKey || right?.date || '')));
  }, [store, plan.id]);
  const fullHorizonBlockCountsByPhase = useMemo(
    () =>
      (canonicalFullHorizonBlocks || []).reduce((acc, block) => {
        const label = String(block?.phaseLabel || '').trim();
        if (!label) {
          return acc;
        }
        acc[label] = (acc[label] || 0) + 1;
        return acc;
      }, {}),
    [canonicalFullHorizonBlocks]
  );
  const strategicCoverage = useMemo(
    () => {
      const resolvedHorizon = resolveStrategicAgendaHorizon(plan, activeMissionContract).resolvedStrategicHorizonEndDayKey;
      return buildStrategicCoverage(plan, anchors, planCycle, firstCycleWindow, resolvedHorizon);
    },
    [plan, anchors, planCycle, firstCycleWindow, activeMissionContract]
  );
  const strategicPhases = useMemo(
    () => {
      const resolvedHorizon = resolveStrategicAgendaHorizon(plan, activeMissionContract).resolvedStrategicHorizonEndDayKey;
      return buildStrategicPhases(plan, lanes, anchors, resolvedHorizon);
    },
    [plan, lanes, anchors, activeMissionContract]
  );
  const laneDiagnostics = useMemo(() => {
    const laneMap = {};
    lanes.forEach((lane) => {
      const laneMilestones = allMilestones.filter((milestone) => milestone?.laneId === lane.id);
      const laneBlocks = canonicalPreviewBlocks.filter((block) => block?.masterPlanLaneId === lane.id);
      const laneCriticQuestions = criticQuestionsByLane[lane.id] || [];
      const datedPoints = [
        ...laneMilestones.map((milestone) => normalizeDayKey(milestone?.targetDate)),
        ...laneBlocks.map((block) => normalizeDayKey(block?.dayKey || block?.startISO)),
      ]
        .filter(Boolean)
        .sort();
      const firstVisiblePoint = datedPoints[0] || null;
      const thinDensity =
        laneMilestones.length + laneBlocks.length <= 1 ||
        (firstVisiblePoint && plan?.horizonStart && firstVisiblePoint > String(plan.horizonStart).slice(0, 10) && datedPoints.length <= 2);
      laneMap[lane.id] = {
        criticQuestionCount: laneCriticQuestions.length,
        criticQuestions: laneCriticQuestions,
        firstCycleBlockCount: laneBlocks.length,
        firstCycleBlocks: laneBlocks,
        hasGate: laneMilestones.some((milestone) => String(milestone?.milestoneType || '').trim().toLowerCase() === 'gate'),
        hasAnchor: laneMilestones.some((milestone) => String(milestone?.milestoneType || '').trim().toLowerCase() === 'anchor'),
        thinDensity,
        firstVisiblePoint,
      };
    });
    return laneMap;
  }, [lanes, allMilestones, canonicalPreviewBlocks, criticQuestionsByLane, plan]);
  const commitmentLayers = useMemo(
    () =>
      buildCommitmentLayers({
        plan,
        lanes,
        milestones: allMilestones,
        anchors,
        planCycle,
        committedBlocks: canonicalPreviewBlocks,
        strategicHorizonEndDayKey: strategicAgenda.resolvedStrategicHorizonEndDayKey,
        criticQuestionsByLane,
      }),
    [plan, lanes, allMilestones, anchors, planCycle, canonicalPreviewBlocks, strategicAgenda, criticQuestionsByLane]
  );
  const strategicPhaseModel = useMemo(
    () =>
      deriveMasterPlanPhaseModel({
        plan,
        lanes,
        milestones: allMilestones,
        anchors,
        planCycle,
        committedBlocks: canonicalPreviewBlocks,
        criticQuestionsByLane,
        horizonEndDayKey: resolveStrategicAgendaHorizon(plan, activeMissionContract).resolvedStrategicHorizonEndDayKey,
      }),
    [plan, lanes, allMilestones, anchors, planCycle, canonicalPreviewBlocks, criticQuestionsByLane, activeMissionContract]
  );
  const strategicCoverageAudit = useMemo(() => {
    const resolvedHorizon = resolveStrategicAgendaHorizon(plan, activeMissionContract).resolvedStrategicHorizonEndDayKey;
    return (
      store?.fullHorizonCoverageAudit ||
      auditFullHorizonCoverage({
        fullHorizonScheduleBlocks: canonicalFullHorizonBlocks,
        phaseModel: strategicPhaseModel,
        fullHorizonStartDayKey: plan?.horizonStart,
        fullHorizonEndDayKey: resolvedHorizon || plan?.fullHorizonEndDayKey || plan?.horizonEnd,
        laneModel: lanes,
        selectedHorizonMode: store?.selectedHorizonMode || 'full_horizon',
      })
    );
  }, [store, canonicalFullHorizonBlocks, strategicPhaseModel, plan, activeMissionContract, lanes]);
  const scheduleLifecycleState = String(store?.scheduleLifecycleState || 'no_goal')
    .trim()
    .toLowerCase();
  const isInterCycle = scheduleLifecycleState === 'inter_cycle';
  const layerHorizonEnd = useMemo(() => {
    if (commitmentView === 'committed_only') {
      return commitmentLayers.committedWindowEnd || strategicCoverage.executionCycleWindow?.end || strategicCoverage.horizonStart;
    }
    if (commitmentView === 'committed_forecast') {
      return commitmentLayers.roadmapCoverageEnd || commitmentLayers.committedWindowEnd || strategicCoverage.horizonStart;
    }
    // For 'roadmap_milestones' (Full strategic agenda), always use the full strategic horizon
    // This ensures that even if the stored plan horizon is capped, the full agenda shows the declared strategic scope
    return resolveStrategicAgendaHorizon(plan, activeMissionContract).resolvedStrategicHorizonEndDayKey || strategicCoverage.horizonEnd;
  }, [commitmentLayers, commitmentView, strategicCoverage, plan, activeMissionContract]);
  const visibleHorizonEnd = useMemo(() => {
    const visibility = strategicPhaseModel?.horizonVisibility;
    if (!visibility) {
      return layerHorizonEnd || strategicAgenda.resolvedStrategicHorizonEndDayKey || normalizeDayKey(plan?.fullHorizonEndDayKey || plan?.horizonEnd);
    }
    let requestedEnd = visibility.fullEnd;
    if (horizonView === 'current_cycle') {
      requestedEnd = minDayKey(visibility.currentCycleEnd, visibility.fullEnd);
    }
    if (horizonView === 'one_year') {
      requestedEnd = minDayKey(visibility.oneYearEnd, visibility.fullEnd);
    }
    if (horizonView === 'two_year') {
      requestedEnd = minDayKey(visibility.twoYearEnd, visibility.fullEnd);
    }
    if (horizonView === 'three_year') {
      requestedEnd = minDayKey(visibility.threeYearEnd, visibility.fullEnd);
    }
    if (horizonView === 'four_year') {
      requestedEnd = minDayKey(visibility.fourYearEnd, visibility.fullEnd);
    }
    if (horizonView === 'five_year') {
      requestedEnd = minDayKey(visibility.fiveYearEnd, visibility.fullEnd);
    }
    return minDayKey(requestedEnd, layerHorizonEnd || visibility.fullEnd);
  }, [strategicPhaseModel, horizonView, plan, layerHorizonEnd, strategicAgenda]);
  const displayedPhaseModel = useMemo(
    () =>
      deriveMasterPlanPhaseModel({
        plan,
        lanes,
        milestones: allMilestones,
        anchors,
        planCycle,
        committedBlocks: canonicalPreviewBlocks,
        criticQuestionsByLane,
        horizonEndDayKey: resolveStrategicAgendaHorizon(plan, activeMissionContract).resolvedStrategicHorizonEndDayKey,
        visibleHorizonEndDayKey: visibleHorizonEnd,
      }),
    [plan, lanes, allMilestones, anchors, planCycle, canonicalPreviewBlocks, criticQuestionsByLane, visibleHorizonEnd, activeMissionContract]
  );
  const visibleMilestones = useMemo(
    () =>
      allMilestones.filter((milestone) => {
        const dayKey = getTemporalDayKey(milestone);
        return !visibleHorizonEnd || !dayKey || dayKey <= visibleHorizonEnd;
      }),
    [allMilestones, visibleHorizonEnd]
  );
  const visibleAnchors = useMemo(
    () =>
      anchors.filter((anchor) => {
        const dayKey = normalizeDayKey(anchor?.date);
        return !visibleHorizonEnd || !dayKey || dayKey <= visibleHorizonEnd;
      }),
    [anchors, visibleHorizonEnd]
  );
  const visibleCommittedBlocks = useMemo(
    () =>
      canonicalPreviewBlocks.filter((block) => {
        const dayKey = normalizeDayKey(block?.dayKey || block?.startISO);
        return !visibleHorizonEnd || !dayKey || dayKey <= visibleHorizonEnd;
      }),
    [canonicalPreviewBlocks, visibleHorizonEnd]
  );
  const visibleForecastBlocks = useMemo(
    () => {
      const sourceBlocks =
        commitmentView === 'roadmap_milestones' && canonicalFullHorizonBlocks.length > 0
          ? canonicalFullHorizonBlocks.filter((block) => String(block?.blockType || '').trim().toLowerCase() !== 'gate')
          : commitmentLayers.forecastItems;
      return sourceBlocks.filter((block) => {
        const dayKey = normalizeDayKey(block?.dayKey || block?.startISO);
        return !visibleHorizonEnd || !dayKey || dayKey <= visibleHorizonEnd;
      });
    },
    [commitmentLayers.forecastItems, visibleHorizonEnd, commitmentView, canonicalFullHorizonBlocks]
  );
  const visibleGatedBlocks = useMemo(
    () => {
      const sourceBlocks =
        commitmentView === 'roadmap_milestones' && canonicalFullHorizonBlocks.length > 0
          ? canonicalFullHorizonBlocks.filter(
              (block) =>
                String(block?.blockType || '').trim().toLowerCase() === 'gate' ||
                String(block?.commitmentState || '').trim().toLowerCase() === 'review-required'
            )
          : commitmentLayers.gatedItems;
      return sourceBlocks.filter((block) => {
        const dayKey = normalizeDayKey(block?.dayKey || block?.startISO);
        return !visibleHorizonEnd || !dayKey || dayKey <= visibleHorizonEnd;
      });
    },
    [commitmentLayers.gatedItems, visibleHorizonEnd, commitmentView, canonicalFullHorizonBlocks]
  );
  const activeMasterCalendar =
    activeProfile?.masterCalendarId ? store?.masterCalendarsById?.[activeProfile.masterCalendarId] || null : null;
  const strategicClusters = Array.isArray(activeProfile?.strategicClusterIds)
    ? activeProfile.strategicClusterIds.map((clusterId) => store?.strategicClustersById?.[clusterId] || null).filter(Boolean)
    : [];
  const clusteredGoalIds = new Set(strategicClusters.flatMap((cluster) => cluster.goalIds || []));
  const independentGoals = (Array.isArray(activeProfile?.goalIds) ? activeProfile.goalIds : [])
    .filter((goalId) => !clusteredGoalIds.has(goalId))
    .map((goalId) => getGoalDisplayLabel(store, goalId));
  const globalConstraints = (Array.isArray(store?.constraintRelations) ? store.constraintRelations : []).filter(
    (relation) => relation?.profileId === activeProfile?.id && relation?.scope === 'global'
  );

  const gridPlan = useMemo(
    () => ({
      id: plan.id,
      title: plan.title,
      coreMission: plan.coreMission,
      outcomeTarget: plan.outcomeTarget,
      successStandard: plan.successStandard,
      northStarOutcome: plan.northStarOutcome,
      horizonStart: plan.horizonStart,
      horizonEnd: visibleHorizonEnd,
      status: plan.status,
    }),
    [plan, visibleHorizonEnd]
  );

  const gridLanes = useMemo(
    () =>
      lanes.map((lane) => ({
        id: lane.id,
        title: lane.title,
        domain: lane.domain,
        activationState: lane.activationState,
        anchorIds: lane.anchorIds || [],
      })),
    [lanes]
  );

  return (
    <div className="space-y-4">
      {activeProfile && activeMasterCalendar ? (
        <div className="rounded-xl border border-line/60 bg-jericho-surface/90 p-4 space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.14em] text-muted">Master Calendar Context</p>
              <p className="text-sm text-muted">Plan visualizes integrated clusters and independent work on one calendar.</p>
            </div>
            <div className="text-right text-[11px] text-muted">
              <p>{activeProfile.id}</p>
              <p>{activeMasterCalendar.id}</p>
            </div>
          </div>
          {strategicClusters.length > 0 ? (
            <div className="rounded-md border border-line/50 bg-jericho-surface/70 px-3 py-2 text-[11px] text-muted space-y-1">
              <p className="uppercase tracking-[0.12em] text-[10px] text-muted">Integrated strategic clusters</p>
              {strategicClusters.map((cluster) => (
                <p key={cluster.id}>
                  <span className="font-semibold text-jericho-text">{titleCaseWords(cluster.label)}</span>
                  {cluster.sharedAnchorDayKey ? ` · anchor ${cluster.sharedAnchorDayKey}` : ''}
                  {' · '}
                  {cluster.goalIds.map((goalId) => getGoalDisplayLabel(store, goalId)).join(' · ')}
                </p>
              ))}
            </div>
          ) : null}
          {independentGoals.length > 0 ? (
            <div className="rounded-md border border-line/50 bg-jericho-surface/70 px-3 py-2 text-[11px] text-muted space-y-1">
              <p className="uppercase tracking-[0.12em] text-[10px] text-muted">Independent goals on the same calendar</p>
              <p>{independentGoals.join(' · ')}</p>
            </div>
          ) : null}
          {globalConstraints.length > 0 ? (
            <div className="rounded-md border border-line/50 bg-jericho-surface/70 px-3 py-2 text-[11px] text-muted space-y-1">
              <p className="uppercase tracking-[0.12em] text-[10px] text-muted">Global pressure</p>
              {globalConstraints.slice(0, 3).map((relation, index) => (
                <p key={`plan-global-constraint-${index}`}>
                  {getGoalDisplayLabel(store, relation.sourceGoalId)} · {titleCaseWords(relation.relationType)}
                </p>
              ))}
            </div>
          ) : null}
          <div className="grid gap-3 md:grid-cols-2">
            <div className="rounded-md border border-line/50 bg-jericho-surface/70 px-3 py-2 text-[11px] text-muted space-y-1">
              <p className="uppercase tracking-[0.12em] text-[10px] text-muted">First executable cycle</p>
              {firstCycleWindow ? (
                <p data-testid="masterplan-first-cycle-summary">
                  {firstCycleWindow.start} to {firstCycleWindow.end} · {firstCycleWindow.count} proposed blocks
                  {firstCycleWindow.lifecycle ? ` · ${titleCaseWords(firstCycleWindow.lifecycle)}` : ''}
                </p>
              ) : (
                <p>No first-cycle preview generated yet.</p>
              )}
            </div>
            <div className="rounded-md border border-line/50 bg-jericho-surface/70 px-3 py-2 text-[11px] text-muted space-y-1">
              <p className="uppercase tracking-[0.12em] text-[10px] text-muted">Structure critic debt</p>
              {Array.isArray(plan?.structureCritic?.unresolvedReasonCodes) &&
              plan.structureCritic.unresolvedReasonCodes.length > 0 ? (
                <>
                  <p data-testid="masterplan-critic-summary">
                    {plan.structureCritic.unresolvedReasonCodes.length} unresolved structure risks ·{' '}
                    {planPolicy?.intakeReadiness?.state || 'assumption_marked_draft'}
                  </p>
                  <p>{plan.structureCritic.unresolvedReasonCodes.slice(0, 3).join(' · ')}</p>
                </>
              ) : (
                <p>No unresolved structure critic debt.</p>
              )}
            </div>
          </div>
        </div>
      ) : null}
      <StrategicCoveragePanel
        plan={plan}
        strategicCoverage={strategicCoverage}
        strategicCoverageAudit={strategicCoverageAudit}
        strategicPlanQuality={store?.fullHorizonPlanQuality || null}
        strategicPhases={displayedPhaseModel.phases}
        phaseModel={displayedPhaseModel}
        fullHorizonBlockCountsByPhase={fullHorizonBlockCountsByPhase}
        strategicAgenda={strategicAgenda}
        commitmentLayers={commitmentLayers}
        commitmentView={commitmentView}
        onCommitmentViewChange={setCommitmentView}
        horizonView={horizonView}
        onHorizonViewChange={setHorizonView}
        visibleHorizonEnd={visibleHorizonEnd}
        scheduleLifecycleState={scheduleLifecycleState}
      />
      <TimelineGrid
        plan={gridPlan}
        lanes={gridLanes}
        milestones={visibleMilestones}
        anchors={visibleAnchors}
        proposedBlocks={visibleCommittedBlocks}
        forecastBlocks={visibleForecastBlocks}
        gatedBlocks={visibleGatedBlocks}
        laneDiagnostics={laneDiagnostics}
        cyclePreviewWindow={firstCycleWindow}
        displayMode={commitmentView}
        emptyMessage="No lanes — complete intake to generate lanes."
        onLaneClick={(laneId) =>
          setSelectedLaneId((prev) => (prev === laneId ? null : laneId))
        }
      />
      {selectedLaneId && (
        <MasterPlanLaneCard
          laneId={selectedLaneId}
          proposedBlocks={canonicalPreviewBlocks.filter((block) => block?.masterPlanLaneId === selectedLaneId)}
          criticQuestions={criticQuestionsByLane[selectedLaneId] || []}
          onClose={() => setSelectedLaneId(null)}
        />
      )}
    </div>
  );
}

function StrategicCoveragePanel({
  plan,
  strategicCoverage,
  strategicCoverageAudit,
  strategicPlanQuality,
  strategicPhases,
  phaseModel,
  fullHorizonBlockCountsByPhase = {},
  strategicAgenda,
  commitmentLayers,
  commitmentView,
  onCommitmentViewChange,
  horizonView,
  onHorizonViewChange,
  visibleHorizonEnd,
  scheduleLifecycleState = 'no_goal',
}) {
  const normalizedScheduleLifecycleState = String(scheduleLifecycleState || '').trim().toLowerCase();
  const isForecastOnlyLifecycle =
    normalizedScheduleLifecycleState === 'inter_cycle' || normalizedScheduleLifecycleState === 'goal_admitted';
  const coverageStatusLabel = getFullHorizonCoverageLabel(strategicCoverageAudit);
  const coverageTone = getFullHorizonCoverageTone(strategicCoverageAudit);
  const qualityStatusLabel = getFullHorizonPlanQualityLabel(strategicPlanQuality);
  const qualityTone = getFullHorizonPlanQualityTone(strategicPlanQuality);
  const hasInsufficientCoverage = coverageTone !== 'positive';
  const qualityFinding = strategicPlanQuality?.reasonCodes?.[0]
    ? titleCaseWords(String(strategicPlanQuality.reasonCodes[0]).replace(/^[A-Z0-9]+_/, ''))
    : null;
  const selectedLayerLabel =
    commitmentView === 'committed_only'
      ? 'Committed schedule'
      : commitmentView === 'committed_forecast'
        ? 'Forecast roadmap'
        : 'Full strategic agenda';

  return (
    <div className="rounded-xl border border-line/60 bg-jericho-surface/90 p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.14em] text-muted">Strategic coverage</p>
          <p className="text-sm text-muted">
            {strategicCoverageAudit?.fullHorizonCovered
              ? 'Jericho expresses meaningful work through the declared horizon. Only the current execution cycle is committed to Today.'
              : strategicCoverageAudit?.horizonExpanded
                ? 'Future work is expanding beyond the current cycle, but terminal coverage is not yet fully trusted.'
                : 'Jericho has resolved the horizon endpoint, but full terminal coverage is not yet proven.'}
          </p>
        </div>
        <span
          data-testid="masterplan-coverage-status"
          className={`rounded-full border px-2 py-0.5 text-[11px] ${
            coverageTone === 'positive'
              ? 'border-green-500/40 text-green-600'
              : coverageTone === 'warning'
                ? 'border-amber-400/40 text-amber-600'
                : 'border-line/50 text-muted'
          }`}
        >
          {coverageStatusLabel}
        </span>
      </div>

      <div className="flex items-start justify-between gap-3 rounded-lg border border-line/50 bg-jericho-surface/60 px-3 py-2">
        <div>
          <p className="text-[11px] font-medium text-body">Plan quality</p>
          <p className="text-[11px] text-muted">
            {strategicCoverageAudit?.fullHorizonCovered
              ? strategicPlanQuality?.state === 'trusted'
                ? 'Full horizon covered and the generated P2/P3 workload passes the current quality gate.'
                : strategicPlanQuality?.state === 'provisional'
                  ? 'Full horizon covered; plan quality provisional.'
                  : strategicPlanQuality?.state === 'degraded'
                    ? 'Full horizon covered, but the generated P2/P3 workload needs quality correction.'
                    : 'Coverage passed, but plan quality is not yet trusted.'
              : 'Coverage must pass before the plan-quality gate can trust the long-horizon workload.'}
          </p>
          {qualityFinding ? <p className="text-[11px] text-muted">{qualityFinding}.</p> : null}
        </div>
        <span
          data-testid="masterplan-quality-status"
          className={`rounded-full border px-2 py-0.5 text-[11px] ${
            qualityTone === 'positive'
              ? 'border-green-500/40 text-green-600'
              : qualityTone === 'warning'
                ? 'border-amber-400/40 text-amber-600'
                : qualityTone === 'critical'
                  ? 'border-rose-500/40 text-rose-600'
                  : 'border-line/50 text-muted'
          }`}
        >
          {qualityStatusLabel}
        </span>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3 text-[11px] text-muted">
        <CoverageItem label="Viewing horizon" value={formatRangeLabel(strategicCoverage.horizonStart, visibleHorizonEnd)} />
        <CoverageItem
          label="Master-plan horizon"
          value={formatRangeLabel(strategicCoverage.horizonStart, strategicCoverage.horizonEnd)}
        />
        <CoverageItem
          label="First hard anchor"
          value={
            strategicCoverage.firstAnchor
              ? `${strategicCoverage.firstAnchor.label} · ${formatDateLabel(strategicCoverage.firstAnchorDayKey)}`
              : 'No fixed anchor declared'
          }
        />
        <CoverageItem
          label="Current execution cycle"
          value={
            strategicCoverage.executionCycleWindow
              ? `${formatRangeLabel(
                  strategicCoverage.executionCycleWindow.start,
                  strategicCoverage.executionCycleWindow.end
                )} · ${strategicCoverage.executionCycleWindow.days} days`
              : 'No execution cycle started'
          }
        />
        <CoverageItem
          label="Scheduled window"
          value={
            strategicCoverage.scheduledWindow
              ? `${formatRangeLabel(strategicCoverage.scheduledWindow.start, strategicCoverage.scheduledWindow.end)} · ${
                  strategicCoverage.scheduledWindow.days
                } scheduled days`
              : `No scheduled blocks yet · preview window defaults to ${strategicCoverage.schedulePreviewWindowDays} days`
          }
        />
        <CoverageItem
          label="Unscheduled strategy remains recognized through"
          value={formatDateLabel(strategicAgenda.resolvedStrategicHorizonEndDayKey || strategicCoverage.horizonEnd)}
        />
        <CoverageItem
          label={isForecastOnlyLifecycle ? 'Last meaningful forecast work' : 'Last meaningful work'}
          value={formatDateLabel(strategicCoverageAudit?.lastMeaningfulWorkDate)}
        />
        <CoverageItem
          label={isForecastOnlyLifecycle ? 'Expected strategic terminal date' : 'Expected terminal date'}
          value={formatDateLabel(strategicCoverageAudit?.expectedTerminalDate || strategicCoverage.horizonEnd)}
        />
        <CoverageItem
          label="Roadmap coverage"
          value={
            commitmentLayers.roadmapCoverageEnd
              ? formatRangeLabel(strategicCoverage.horizonStart, commitmentLayers.roadmapCoverageEnd)
              : 'No forecast roadmap beyond the committed window yet'
          }
        />
        <CoverageItem
          label={isForecastOnlyLifecycle ? 'Strategic forecast work' : 'Forecast schedule'}
          value={
            commitmentLayers.forecastCoverageEnd
              ? formatRangeLabel(
                  strategicCoverage.scheduledWindow?.end || strategicCoverage.executionCycleWindow?.start || strategicCoverage.horizonStart,
                  commitmentLayers.forecastCoverageEnd
                )
              : 'No forecast beyond the committed window yet'
          }
        />
        <CoverageItem
          label={isForecastOnlyLifecycle ? 'Current scheduled work' : 'Committed schedule'}
          value={
            strategicCoverage.scheduledWindow
              ? formatRangeLabel(strategicCoverage.scheduledWindow.start, strategicCoverage.scheduledWindow.end)
              : isForecastOnlyLifecycle
                ? 'No execution cycle schedule yet'
                : 'No committed schedule yet'
          }
        />
        <CoverageItem label="Next reassessment gate" value={commitmentLayers.nextReassessmentGate} />
        <CoverageItem
          label="Strategic promise"
          value="Not yet scheduled does not mean not recognized."
        />
      </div>
      {Array.isArray(strategicCoverageAudit?.reasonCodes) && strategicCoverageAudit.reasonCodes.length > 0 ? (
        <div className="rounded-md border border-line/50 bg-jericho-surface/70 px-3 py-2 text-[11px] text-muted space-y-1">
          <p className="uppercase tracking-[0.12em] text-[10px] text-muted">Coverage audit</p>
          <p>{strategicCoverageAudit.reasonCodes.slice(0, 4).join(' · ')}</p>
        </div>
      ) : null}

      <div className="rounded-md border border-line/50 bg-jericho-surface/70 px-3 py-2 text-[11px] text-muted space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="uppercase tracking-[0.12em] text-[10px] text-muted">Horizon View</p>
          <div className="flex flex-wrap gap-2">
            {[
              ['current_cycle', 'Current cycle', 'Executable strategic surface for the active phase.'],
              ['one_year', '1 year', 'Tactical launch readiness and near-term anchors.'],
              ['two_year', '2 years', 'Operating-system buildout and early scale path.'],
              ['three_year', '3 years', 'Mid-horizon expansion and measurable strategic inflection.'],
              ['four_year', '4 years', 'Late-scale preparation and terminal-readiness buildup.'],
              ['five_year', '5 years', 'Full mission arc through terminal readiness.'],
              ['full', 'Full horizon', 'Complete strategic architecture through 2031.'],
            ].map(([value, label, tooltip]) => (
              <button
                key={value}
                type="button"
                onClick={() => onHorizonViewChange(value)}
                className={`rounded-full border px-2.5 py-1 text-[10px] ${
                  horizonView === value
                    ? 'border-jericho-accent text-jericho-accent bg-jericho-accent/10'
                    : 'border-line/50 text-muted hover:text-jericho-text'
                }`}
                title={tooltip}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        <p>{
          horizonView === 'current_cycle' ? 'Current cycle view: executable strategic surface for the active phase.' :
          horizonView === 'one_year' ? '1-year view: tactical launch readiness and near-term anchors.' :
          horizonView === 'two_year' ? '2-year view: operating-system buildout and early scale path.' :
          horizonView === 'three_year' ? '3-year view: mid-horizon expansion and measurable strategic inflection.' :
          horizonView === 'four_year' ? '4-year view: late-scale preparation and terminal-readiness buildup.' :
          horizonView === 'five_year' ? '5-year view: full mission arc through terminal readiness.' :
          'Full horizon view: complete strategic architecture through 2031.'
        }</p>
        <p>Only the first execution cycle is scheduled.</p>
        <p>Future work remains forecast or gated until reassessment confirms it.</p>
        <p>Future phases are strategic, not calendar-committed.</p>
        <p>Calendar commitment expands through reassessment and execution evidence.</p>
        {commitmentLayers.forecastShortReason ? <p>{commitmentLayers.forecastShortReason}</p> : null}
        {hasInsufficientCoverage ? (
          <p className="text-amber-600" data-testid="masterplan-coverage-warning">
            Master-plan strategy does not yet cover the declared horizon beyond the first anchor.
          </p>
        ) : null}
      </div>

      <div className="rounded-xl border border-line/50 bg-jericho-surface/70 p-3 space-y-3">
        <div className="space-y-1">
          <p className="text-xs uppercase tracking-[0.14em] text-muted">Full Phase Plan</p>
          <p className="text-[11px] text-muted">
            {selectedLayerLabel} view. Plan is complete; schedule is earned through phase evidence.
          </p>
        </div>
        <div className="grid gap-3 lg:grid-cols-3">
          {(phaseModel?.phases || []).map((phase) => {
            const isFuturePhase = phase.visibilityStatus === 'future_strategic';
            const isSparseCoverage = phase.visibilityStatus === 'visible_but_sparse';
            const visibleMilestoneCount = phase.visibleMilestones?.length || 0;
            const totalMilestoneCount = phase.milestones?.length || 0;
            const scheduledWorkCount = Number(fullHorizonBlockCountsByPhase[String(phase.label || '').trim()] || 0);
            const scheduledWorkLabel = isForecastOnlyLifecycle ? 'Forecast workload recognized:' : 'Scheduled work:';
            
            return (
            <div
              key={phase.id}
              data-testid={`phase-card-${String(phase.label || '').toLowerCase()}`}
              className={`rounded-xl border p-3 space-y-2 ${
                isFuturePhase
                  ? 'border-line/30 bg-jericho-surface/50 opacity-60'
                  : phase.activeState === 'active'
                  ? 'border-jericho-accent/50 bg-jericho-accent/5'
                  : phase.activeState === 'completed'
                    ? 'border-green-500/40 bg-green-500/5'
                    : 'border-line/50 bg-jericho-surface/70'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-jericho-text">
                    {phase.label} · {phase.name}
                    {isFuturePhase ? ' (Strategic Preview)' : ''}
                  </p>
                  <p className="text-[11px] text-muted">{formatRangeLabel(phase.startBoundary, phase.endBoundary)}</p>
                </div>
                <span className="rounded-full border border-line/50 px-2 py-0.5 text-[10px] text-muted">
                  {isFuturePhase ? 'Future' : titleCaseWords(phase.activeState)}
                </span>
              </div>
              <p className="text-[11px] text-muted">{phase.phaseObjective}</p>
              <div className="space-y-1 text-[11px] text-muted">
                <p>
                  <span className="font-semibold text-jericho-text">Milestones:</span> {visibleMilestoneCount}{totalMilestoneCount > visibleMilestoneCount ? ` / ${totalMilestoneCount} (${totalMilestoneCount - visibleMilestoneCount} future)` : ''}
                </p>
                <p>
                  <span className="font-semibold text-jericho-text">{scheduledWorkLabel}</span> {scheduledWorkCount}
                </p>
                {isForecastOnlyLifecycle ? (
                  <p>
                    <span className="font-semibold text-jericho-text">Current cycle:</span> Not scheduled for execution
                  </p>
                ) : null}
                <p>
                  <span className="font-semibold text-jericho-text">Unlock criteria:</span>{' '}
                  {phase.unlockCriteria.slice(0, 2).join(' · ')}
                </p>
                <p>
                  <span className="font-semibold text-jericho-text">Anchor role:</span>{' '}
                  {titleCaseWords(phase.anchorRole)}
                </p>
                <p>
                  <span className="font-semibold text-jericho-text">Lane participation:</span>{' '}
                  {phase.laneParticipation.map((lane) => lane.laneTitle).join(' · ') || '—'}
                </p>
                <p>
                  <span className="font-semibold text-jericho-text">Schedule status:</span>{' '}
                  {titleCaseWords(phase.executionScheduleStatus)}
                </p>
                {phase.anchorsInPhase?.length ? (
                  <p>
                    <span className="font-semibold text-jericho-text">Major anchors:</span>{' '}
                    {phase.anchorsInPhase.map((anchor) => `${anchor.label} (${titleCaseWords(anchor.role)})`).join(' · ')}
                  </p>
                ) : null}
              </div>
              {isSparseCoverage && phase.coverageDeficiency ? (
                <div className="rounded-md border border-amber-400/30 bg-amber-400/5 px-2 py-1 text-[10px] text-amber-600">
                  <p className="font-semibold">{phase.coverageDeficiency.code}</p>
                  <p>{phase.coverageDeficiency.reason}</p>
                </div>
              ) : null}
            </div>
            );
          })}
        </div>
      </div>

      {phaseModel?.activePhase ? (
        <div className="grid gap-3 lg:grid-cols-2">
          <div className="rounded-xl border border-line/50 bg-jericho-surface/70 p-3 space-y-2">
            <p className="text-xs uppercase tracking-[0.14em] text-muted">Active Phase</p>
            <p className="text-sm font-semibold text-jericho-text">
              {phaseModel.activePhase.label} · {phaseModel.activePhase.name}
            </p>
            <p className="text-[11px] text-muted">{phaseModel.activePhase.phaseObjective}</p>
            <p className="text-[11px] text-muted">
              <span className="font-semibold text-jericho-text">Execution schedule:</span>{' '}
              {titleCaseWords(phaseModel.activePhase.executionScheduleStatus)}
            </p>
          </div>
          <div className="rounded-xl border border-line/50 bg-jericho-surface/70 p-3 space-y-2">
            <p className="text-xs uppercase tracking-[0.14em] text-muted">Next Unlock</p>
            <p className="text-[11px] text-muted">{phaseModel.nextUnlockSummary}</p>
            {phaseModel.nextPhase ? (
              <p className="text-[11px] text-muted">
                <span className="font-semibold text-jericho-text">{phaseModel.nextPhase.label} target:</span>{' '}
                {phaseModel.nextPhase.unlockCriteria.slice(0, 2).join(' · ')}
              </p>
            ) : (
              <p className="text-[11px] text-muted">Next phase is terminal review.</p>
            )}
          </div>
        </div>
      ) : null}

      <div className="rounded-xl border border-line/50 bg-jericho-surface/70 p-3 space-y-3">
        <div className="space-y-1">
          <p className="text-xs uppercase tracking-[0.14em] text-muted">Strategy Critique</p>
          <p className="text-[11px] text-muted">
            Jericho corrected the schedule where the proposed strategy was premature or missing dependencies.
          </p>
        </div>
        {(phaseModel?.critiques || []).length > 0 ? (
          <div className="space-y-2">
            {phaseModel.critiques.map((issue) => (
              <div
                key={`${issue.issueCode}:${issue.affectedLane || 'global'}`}
                className="rounded-md border border-line/50 bg-jericho-surface/60 px-3 py-2 text-[11px] text-muted space-y-1"
              >
                <p className="font-semibold text-jericho-text">
                  {issue.issueCode} · {titleCaseWords(issue.severity)}
                </p>
                <p>
                  <span className="font-semibold text-jericho-text">Critique:</span> {issue.critique}
                </p>
                <p>
                  <span className="font-semibold text-jericho-text">Correction:</span> {issue.correction}
                </p>
                <p>
                  <span className="font-semibold text-jericho-text">Scheduling effect:</span> {issue.schedulingEffect}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-[11px] text-muted">No major sequencing critique surfaced yet.</p>
        )}
      </div>

      <div className="rounded-md border border-line/50 bg-jericho-surface/70 px-3 py-2 text-[11px] text-muted space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="uppercase tracking-[0.12em] text-[10px] text-muted">Commitment layers</p>
          <div className="flex flex-wrap gap-2">
            {[
              ['committed_only', 'Committed schedule'],
              ['committed_forecast', 'Forecast roadmap'],
              ['roadmap_milestones', 'Full strategic agenda'],
            ].map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => onCommitmentViewChange(value)}
                className={`rounded-full border px-2.5 py-1 text-[10px] ${
                  commitmentView === value
                    ? 'border-jericho-accent text-jericho-accent bg-jericho-accent/10'
                    : 'border-line/50 text-muted hover:text-jericho-text'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        <p>
          Forecast work is visible ahead of the committed cycle. Gated work remains known but non-committable until
          dependencies, evidence, or reassessment clear it.
        </p>
      </div>

      {strategicPhases.length > 0 ? (
        <div className="space-y-2">
          <p className="text-xs uppercase tracking-[0.14em] text-muted">Post-anchor strategy</p>
          <div className="grid gap-3 lg:grid-cols-2">
            {strategicPhases.map((phase) => (
              <div
                key={phase.id}
                className="rounded-xl border border-line/50 bg-jericho-surface/70 p-3 space-y-2"
                data-testid={`strategic-phase-${phase.id}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-jericho-text">
                      {phase.label} · {phase.name || phase.title}
                    </p>
                    <p className="text-[11px] text-muted">
                      {formatRangeLabel(phase.startBoundary || phase.start, phase.endBoundary || phase.end)}
                    </p>
                  </div>
                  {phase.anchorPhase || phase.anchorRole === 'convergence_event' ? (
                    <span className="rounded-full border border-amber-400/40 px-2 py-0.5 text-[10px] text-amber-600">
                      anchor convergence
                    </span>
                  ) : null}
                </div>
                <p className="text-[11px] text-muted">{phase.phaseObjective || phase.summary}</p>
                <div className="flex flex-wrap gap-1.5">
                  {(phase.laneStatuses || phase.laneParticipation || []).map((lane) => (
                    <span
                      key={`${phase.id}-${lane.laneId || lane.laneTitle}`}
                      className="rounded-full border border-line/50 px-2 py-0.5 text-[10px] text-muted"
                    >
                      {lane.laneTitle} · {titleCaseWords(lane.status)}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function CoverageItem({ label, value }) {
  return (
    <div className="rounded-md border border-line/50 bg-jericho-surface/70 px-3 py-2 space-y-1">
      <p className="uppercase tracking-[0.12em] text-[10px] text-muted">{label}</p>
      <p className="text-jericho-text">{value}</p>
    </div>
  );
}
