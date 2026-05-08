import React, { useMemo, useState } from 'react';
import { useIdentityStore } from '../../state/identityStore.js';
import {
  selectActiveMasterPlan,
  selectMasterPlanLanes,
  selectMasterTimeline,
  selectMasterPlanAnchors,
} from '../../domain/masterPlan/masterPlanSelectors.js';
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

function getPlanCycle(store, plan) {
  const activeCycle = store?.activeCycleId ? store?.cyclesById?.[store.activeCycleId] || null : null;
  if (activeCycle?.masterPlanId === plan?.id) {
    return activeCycle;
  }
  return Object.values(store?.cyclesById || {}).find((cycle) => cycle?.masterPlanId === plan?.id) || null;
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

  return <NoMasterPlanState />;
}

// ─── Empty state ──────────────────────────────────────────────────────────────

function NoMasterPlanState() {
  return (
    <div className="flex flex-col items-center justify-center py-20 gap-4 text-center">
      <p className="text-muted text-sm">No master plan established yet. Complete Structure intake first.</p>
    </div>
  );
}

// ─── Master plan adapter ──────────────────────────────────────────────────────
// Converts masterPlan + lanes + milestones into the normalized TimelineGrid props.

function MasterPlanTimelineView({ plan, store }) {
  const [selectedLaneId, setSelectedLaneId] = useState(null);

  const lanes = selectMasterPlanLanes(store, plan.id);
  const allMilestones = selectMasterTimeline(store, plan.id);
  const anchors = selectMasterPlanAnchors(store, plan.id);
  const planCycle = getPlanCycle(store, plan);
  const cycleDraftBlocks = Array.isArray(store?.proposedBlocksByCycleId?.[planCycle?.id || ''])
    ? store.proposedBlocksByCycleId[planCycle.id]
    : [];
  const reviewBlocks = Array.isArray(planCycle?.scheduleReviewBlocks) ? planCycle.scheduleReviewBlocks : [];
  const firstCycleBlocks = (reviewBlocks.length > 0 ? reviewBlocks : cycleDraftBlocks)
    .filter((block) => block?.masterPlanId === plan.id)
    .sort((left, right) => String(left?.dayKey || left?.startISO || '').localeCompare(String(right?.dayKey || right?.startISO || '')));
  const planPolicy = store?.masterPlanPolicyByPlanId?.[plan.id] || plan?.policyState?.goalPolicy || null;
  const criticQuestionsByLane = useMemo(() => mapCriticQuestionsByLane(plan, lanes), [plan, lanes]);
  const firstCycleWindow = useMemo(() => {
    const datedBlocks = firstCycleBlocks
      .map((block) => normalizeDayKey(block?.dayKey || block?.startISO))
      .filter(Boolean)
      .sort();
    if (!datedBlocks.length) {
      return null;
    }
    return {
      start: datedBlocks[0],
      end: datedBlocks[datedBlocks.length - 1],
      count: firstCycleBlocks.length,
      lifecycle: planCycle?.scheduleLifecycle || null,
    };
  }, [firstCycleBlocks, planCycle]);
  const laneDiagnostics = useMemo(() => {
    const laneMap = {};
    lanes.forEach((lane) => {
      const laneMilestones = allMilestones.filter((milestone) => milestone?.laneId === lane.id);
      const laneBlocks = firstCycleBlocks.filter((block) => block?.masterPlanLaneId === lane.id);
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
  }, [lanes, allMilestones, firstCycleBlocks, criticQuestionsByLane, plan]);
  const activeProfile = store?.activeProfileId ? store?.profilesById?.[store.activeProfileId] || null : null;
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
      northStarOutcome: plan.northStarOutcome,
      horizonStart: plan.horizonStart,
      horizonEnd: plan.horizonEnd,
      status: plan.status,
    }),
    [plan]
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
      <TimelineGrid
        plan={gridPlan}
        lanes={gridLanes}
        milestones={allMilestones}
        anchors={anchors}
        proposedBlocks={firstCycleBlocks}
        laneDiagnostics={laneDiagnostics}
        cyclePreviewWindow={firstCycleWindow}
        emptyMessage="No lanes — complete intake to generate lanes."
        onLaneClick={(laneId) =>
          setSelectedLaneId((prev) => (prev === laneId ? null : laneId))
        }
      />
      {selectedLaneId && (
        <MasterPlanLaneCard
          laneId={selectedLaneId}
          proposedBlocks={firstCycleBlocks.filter((block) => block?.masterPlanLaneId === selectedLaneId)}
          criticQuestions={criticQuestionsByLane[selectedLaneId] || []}
          onClose={() => setSelectedLaneId(null)}
        />
      )}
    </div>
  );
}
