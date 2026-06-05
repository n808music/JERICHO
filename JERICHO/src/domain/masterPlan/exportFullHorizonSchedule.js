import { expandFullHorizonSchedule, applyCrossLaneArtifactDependencies } from './fullHorizonScheduleExpansion.js';
import { applyArtifactDependencyIntegrity } from './artifactDependencyIntegrity.js';
import { deriveMasterPlanPhaseModel } from './masterPlanPhaseModel.js';
import { deriveForecastBlocks, resolveHorizonEndForMode } from './forecastBlockDerivation.js';
import { buildFullHorizonAgendaVersion } from './fullHorizonScheduledAgenda.js';

const DEFAULT_WORK_DAYS = ['mon', 'tue', 'wed', 'thu', 'fri'];

function workDaysFromWindows(workWindows) {
  if (!workWindows || typeof workWindows !== 'object') {return DEFAULT_WORK_DAYS;}
  const days = Object.entries(workWindows)
    .filter(([, windows]) => Array.isArray(windows) && windows.length > 0)
    .map(([day]) => String(day || '').trim().toLowerCase());
  return days.length ? days : DEFAULT_WORK_DAYS;
}

function resolvePlan(state, planId) {
  const plans = state?.masterPlansById || {};
  if (planId && plans[planId]) {return plans[planId];}
  const ids = Object.keys(plans);
  if (ids.length === 0) {return null;}
  if (ids.length === 1) {return plans[ids[0]];}
  const active = String(state?.activeGoalId || '').trim();
  const matchedByActive = ids.find((id) => active.includes(id));
  return plans[matchedByActive || ids[0]];
}

function resolveLanes(state, planId) {
  const all = Object.values(state?.masterPlanLanesById || {});
  return all.filter((lane) => String(lane?.masterPlanId || '') === planId);
}

function resolveMilestones(state, laneIds) {
  const laneSet = new Set(laneIds);
  return Object.values(state?.masterPlanMilestonesById || {}).filter((m) => laneSet.has(m?.laneId));
}

function resolveWorkWindows(state) {
  return (
    state?.goalExecutionContract?.workWindows ||
    state?.goalExecutionContract?.suggestedWorkWindows ||
    null
  );
}

function resolveCycleEndDayKey(state, horizonVisibility) {
  const activeCycleId = String(state?.activeCycleId || '').trim();
  const activeCycle = activeCycleId ? state?.cyclesById?.[activeCycleId] || null : null;
  return (
    activeCycle?.deadlineDayKey ||
    activeCycle?.contract?.deadlineISO?.slice(0, 10) ||
    activeCycle?.goalContract?.deadlineISO?.slice(0, 10) ||
    horizonVisibility?.currentCycleEnd ||
    null
  );
}

/**
 * Pure function: given a persisted identity-state snapshot, recompute the
 * full-horizon schedule (1000s of blocks with payloads). Mirrors the contract
 * identityCompute.js uses at the expandFullHorizonSchedule call site, so the
 * resulting block set is byte-equivalent to what the engine produces during
 * a normal render cycle — but with the payloads preserved instead of stripped
 * by the agenda-version persistence layer.
 *
 * Returns { blocks, summary, range, agendaVersionId, plan, lanes, milestones }.
 * Returns null if the state has no master plan or the plan lacks a horizon.
 */
export function buildFullHorizonScheduleExport(identityState, options = {}) {
  if (!identityState || typeof identityState !== 'object') {return null;}

  const plan = resolvePlan(identityState, options.planId);
  if (!plan || !plan.id) {return null;}

  const lanes = resolveLanes(identityState, plan.id);
  const laneIds = lanes.map((lane) => lane.id);
  const milestones = resolveMilestones(identityState, laneIds);
  const anchors = Array.isArray(plan.anchors) ? plan.anchors : [];

  const phaseModel = deriveMasterPlanPhaseModel({
    plan,
    lanes,
    milestones,
    anchors,
    planCycle: null,
    committedBlocks: [],
    criticQuestionsByLane: {},
  });
  if (!phaseModel?.phases?.length) {return null;}

  const cycleEndDayKey = resolveCycleEndDayKey(identityState, phaseModel.horizonVisibility);
  const mode = options.mode || 'full_horizon';

  const horizonEndForMode =
    resolveHorizonEndForMode(phaseModel.horizonVisibility, mode, cycleEndDayKey) ||
    plan.fullHorizonEndDayKey ||
    plan.horizonEnd;

  const fullHorizonStartDayKey =
    phaseModel.horizonVisibility?.horizonStart ||
    plan.horizonStart ||
    plan.officialStartDate ||
    null;
  const fullHorizonEndDayKey = horizonEndForMode || plan.fullHorizonEndDayKey || plan.horizonEnd;

  const existingForecastBlocks = [];
  for (const phase of phaseModel.phases) {
    if (horizonEndForMode && phase.startBoundary > horizonEndForMode) {continue;}
    const forecastBlocks = deriveForecastBlocks({
      plan,
      phase,
      horizonEndDayKey: horizonEndForMode,
      cycleEndDayKey,
    });
    existingForecastBlocks.push(...forecastBlocks);
  }

  const workWindows = resolveWorkWindows(identityState);
  const workDays = workDaysFromWindows(workWindows);

  const blocks = expandFullHorizonSchedule({
    plan,
    phaseModel,
    horizonStartDayKey: fullHorizonStartDayKey,
    horizonEndDayKey: fullHorizonEndDayKey,
    lanes,
    existingForecastBlocks,
    committedBlocks: [],
    workDays,
    workWindows,
    timeZone: identityState?.appTime?.timeZone || 'UTC',
  });
  const integrity = applyArtifactDependencyIntegrity(blocks);
  // Re-apply cross-lane wiring after the integrity pass: applyArtifactDependencyIntegrity
  // overwrites consumedArtifactIds, which erases the cross-lane refs that
  // expandFullHorizonSchedule already attached. Re-running the cross-lane pass
  // here restores those refs while keeping the integrity report fields intact.
  const crossLaneBlocks = applyCrossLaneArtifactDependencies(integrity.blocks, lanes);

  const range = { startDayKey: fullHorizonStartDayKey, endDayKey: fullHorizonEndDayKey };

  const { agendaVersion } = buildFullHorizonAgendaVersion({
    profileId: plan.profileId,
    masterPlanId: plan.id,
    createdAtISO: identityState?.appTime?.nowISO || new Date().toISOString(),
    range,
    blocks: crossLaneBlocks,
    sourceConstraintVersionId: plan.currentScheduleConstraintVersionId || null,
    strategicCoverageState: null,
    planQualityState: null,
    blockQualityState: null,
    existingAgendaVersionsById: identityState.masterPlanAgendaVersionsById || {},
    existingCurrentAgendaVersionId: plan.currentAgendaVersionId || null,
  });

  return {
    plan,
    lanes,
    milestones,
    blocks: crossLaneBlocks,
    range,
    summary: agendaVersion.summary,
    agendaVersionId: agendaVersion.id,
    artifactRegistry: integrity.artifactRegistry,
    integrityReport: integrity.integrityReport,
    phaseExitCriteriaByPhase: integrity.phaseExitCriteriaByPhase,
  };
}

export default buildFullHorizonScheduleExport;
