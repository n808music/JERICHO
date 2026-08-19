import { LANE_ACTIVATION_STATE, MILESTONE_STATUS } from './masterPlanSchema.js';

// ─── Plan ─────────────────────────────────────────────────────────────────────

export function selectActiveMasterPlan(state) {
  const profileId = state.activeProfileId;
  const profile = state.profilesById?.[profileId];
  const planId = profile?.activeMasterPlanId;
  if (!planId) return null;
  return state.masterPlansById?.[planId] || null;
}

export function selectMasterPlanById(state, masterPlanId) {
  return state.masterPlansById?.[masterPlanId] || null;
}

export function selectMasterPlansForProfile(state, profileId) {
  const profile = state.profilesById?.[profileId];
  if (!profile) return [];
  return (profile.masterPlanIds || [])
    .map((id) => state.masterPlansById?.[id])
    .filter(Boolean);
}

// ─── Lanes ────────────────────────────────────────────────────────────────────

export function selectMasterPlanLanes(state, masterPlanId) {
  const plan = state.masterPlansById?.[masterPlanId];
  if (!plan) return [];
  return (plan.laneIds || [])
    .map((id) => state.masterPlanLanesById?.[id])
    .filter(Boolean);
}

// Only active lanes generate daily actions and milestone scheduling.
export function selectActiveLanes(state, masterPlanId) {
  return selectMasterPlanLanes(state, masterPlanId).filter(
    (lane) => lane.activationState === LANE_ACTIVATION_STATE.ACTIVE
  );
}

export function selectLaneById(state, laneId) {
  return state.masterPlanLanesById?.[laneId] || null;
}

// ─── Milestones ───────────────────────────────────────────────────────────────

export function selectMilestonesForLane(state, laneId) {
  const lane = state.masterPlanLanesById?.[laneId];
  if (!lane) return [];
  return (lane.milestoneIds || [])
    .map((id) => state.masterPlanMilestonesById?.[id])
    .filter(Boolean);
}

export function selectMilestoneById(state, milestoneId) {
  return state.masterPlanMilestonesById?.[milestoneId] || null;
}

// At-risk milestones across all lanes in a plan, sorted by targetDate ascending.
export function selectAtRiskMilestones(state, masterPlanId) {
  const lanes = selectMasterPlanLanes(state, masterPlanId);
  const atRisk = [];
  for (const lane of lanes) {
    for (const milestone of selectMilestonesForLane(state, lane.id)) {
      if (milestone.status === MILESTONE_STATUS.AT_RISK || milestone.status === MILESTONE_STATUS.MISSED) {
        atRisk.push(milestone);
      }
    }
  }
  return atRisk.sort((a, b) => (a.targetDate < b.targetDate ? -1 : 1));
}

// All milestones in a plan sorted by targetDate ascending — used for master timeline view.
export function selectMasterTimeline(state, masterPlanId) {
  const lanes = selectMasterPlanLanes(state, masterPlanId);
  const all = [];
  for (const lane of lanes) {
    for (const milestone of selectMilestonesForLane(state, lane.id)) {
      all.push({ ...milestone, laneTitle: lane.title, laneDomain: lane.domain });
    }
  }
  return all.sort((a, b) => (a.targetDate < b.targetDate ? -1 : 1));
}

// Anchors sorted by date — used to drive backward scheduling.
export function selectMasterPlanAnchors(state, masterPlanId) {
  const plan = state.masterPlansById?.[masterPlanId];
  if (!plan) return [];
  return [...(plan.anchors || [])].sort((a, b) => (a.date < b.date ? -1 : 1));
}
