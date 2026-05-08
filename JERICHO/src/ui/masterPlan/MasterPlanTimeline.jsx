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
        </div>
      ) : null}
      <TimelineGrid
        plan={gridPlan}
        lanes={gridLanes}
        milestones={allMilestones}
        anchors={anchors}
        emptyMessage="No lanes — complete intake to generate lanes."
        onLaneClick={(laneId) =>
          setSelectedLaneId((prev) => (prev === laneId ? null : laneId))
        }
      />
      {selectedLaneId && (
        <MasterPlanLaneCard
          laneId={selectedLaneId}
          onClose={() => setSelectedLaneId(null)}
        />
      )}
    </div>
  );
}
