/**
 * Cycle governance policy (explicit state machine with exit ramps):
 * - RESET_IDENTITY: acute failure (very low integrity or high failure); cap allowedTasks at resetAllowed.
 * - CAUTION: bridge state once integrity improves but risk remains; slightly higher load.
 * - NORMAL: integrity rebounds and recent failure is acceptable; allow higher load.
 * Inputs: avg integrity + completion/failure rates from failureAnalysis, plus compressedPlan keptCount baseline.
 * Exit: leave RESET_IDENTITY after integrity rises past thresholds and failure rate drops below cutoff for recent cycles.
 */

import { getConfig } from './config.js';

export function evaluateCycleGovernance({
  goal,
  nextCycleIndex = 0,
  systemHealth = {},
  failureAnalysis = {},
  forecast = {},
  strategicCalendar = {},
  compressedPlan = {},
  portfolioAnalysis = {}
}) {
  const GOVERNANCE_CONFIG = getConfig().governance;
  void strategicCalendar;
  const baseAllowed = compressedPlan?.summary?.keptCount ?? 0;
  let allowedTasks = baseAllowed;

  const failureProfile = failureAnalysis.failureProfile || {};
  const summary = failureAnalysis.summary || {};
  const integrityScore =
    systemHealth?.integritySummary?.score ??
    summary.avgIntegrity ??
    100;
  const breakdown = systemHealth?.integritySummary?.breakdown || {};
  const completionRateRaw =
    breakdown.completionRate ??
    summary.avgCompletionRate ??
    1;
  const completedCount = (breakdown.completedOnTime || 0) + (breakdown.completedLate || 0);
  const missedCount = breakdown.missed || 0;
  const denom = completedCount + missedCount;
  let completionRateEffective = denom > 0 ? completedCount / denom : completionRateRaw;
  if (denom === 0 && completionRateRaw === 0 && integrityScore >= GOVERNANCE_CONFIG.normal.integrityMin) {
    completionRateEffective = 1 - GOVERNANCE_CONFIG.normal.failureRateMax / 2;
  }
  const failureRate = Math.max(0, Math.min(1, 1 - completionRateEffective));
  const recentCycles = summary.recentCycles ?? 0;
  const effectiveLookback = Math.max(1, Math.min(GOVERNANCE_CONFIG.lookbackCycles, recentCycles || 1));

  let deadlineThreat = false;
  const gf = forecast?.goalForecast || {};
  if (gf.onTrack === false) {
    deadlineThreat = true;
  } else if (typeof goal?.deadlineDays === 'number' && goal.deadlineDays <= 30 && gf.projectedDate) {
    deadlineThreat = true;
  }

  const domains = portfolioAnalysis?.currentMix?.domains || [];
  const hasUnder = domains.some((d) => d.status === 'under');
  const hasOver = domains.some((d) => d.status === 'over');
  const portfolioImbalance = hasUnder || hasOver;

  let healthLevel = 1;
  const healthStatus = systemHealth?.health?.status;
  if (healthStatus === 'yellow') healthLevel = 2;
  if (healthStatus === 'red') healthLevel = 3;

  const requireIdentityReset = !!systemHealth?.governance?.enforceIdentityReset;
  const requireGoalReview = !!systemHealth?.governance?.enforceGoalReview;

  let severity = 'low';
  const highFailureRate =
    failureRate >= GOVERNANCE_CONFIG.reset.failureRateMin ||
    failureProfile.highLateRate ||
    failureProfile.highMissRate ||
    (failureAnalysis?.lateRate ?? 0) >= 0.5 ||
    (failureAnalysis?.chronicMissStreak ?? 0) >= 3;
  if (healthLevel === 3 || (highFailureRate && deadlineThreat)) {
    severity = 'high';
  } else if (healthLevel === 2 || highFailureRate || deadlineThreat) {
    severity = 'medium';
  }

  let mode = 'execute';
  // Precedence: identity reset > goal review > halt > reset > conserve > caution > normal/execute.
  const forceReset = requireIdentityReset;
  const inResetIdentity =
    forceReset ||
    (integrityScore < GOVERNANCE_CONFIG.reset.integrityMax &&
      failureRate > GOVERNANCE_CONFIG.reset.failureRateMin);
  const meetsNormal = integrityScore >= GOVERNANCE_CONFIG.normal.integrityMin;
  const meetsCaution =
    !meetsNormal &&
    integrityScore >= GOVERNANCE_CONFIG.caution.integrityMin &&
    integrityScore < GOVERNANCE_CONFIG.caution.integrityMax;

  if (healthLevel === 1 && !highFailureRate && !deadlineThreat && !portfolioImbalance && !forceReset && !requireGoalReview) {
    mode = 'execute';
    allowedTasks = baseAllowed;
  } else if (forceReset) {
    mode = 'reset_identity';
    allowedTasks = Math.min(allowedTasks || GOVERNANCE_CONFIG.reset.allowedTasks, GOVERNANCE_CONFIG.reset.allowedTasks);
  } else if (requireGoalReview) {
    mode = 'review_goal';
    allowedTasks = Math.min(allowedTasks || GOVERNANCE_CONFIG.reset.allowedTasks, GOVERNANCE_CONFIG.reset.allowedTasks);
  } else if (healthLevel === 3 && highFailureRate) {
    mode = 'halt';
    allowedTasks = 0;
  } else if (inResetIdentity) {
    mode = 'reset_identity';
    allowedTasks = Math.min(allowedTasks || GOVERNANCE_CONFIG.reset.allowedTasks, GOVERNANCE_CONFIG.reset.allowedTasks);
  } else if (severity === 'high' || severity === 'medium' || deadlineThreat) {
    mode = 'conserve';
    const scale = severity === 'high' ? 0.4 : 0.7;
    allowedTasks = Math.max(0, Math.floor((allowedTasks || baseAllowed) * scale));
  } else if (meetsCaution && !meetsNormal) {
    mode = 'caution';
    allowedTasks = Math.min(allowedTasks || GOVERNANCE_CONFIG.caution.allowedTasks, GOVERNANCE_CONFIG.caution.allowedTasks);
  } else if (meetsNormal) {
    mode = 'normal';
    allowedTasks = Math.min(
      Math.max(allowedTasks, GOVERNANCE_CONFIG.normal.allowedTasks),
      baseAllowed || GOVERNANCE_CONFIG.normal.allowedTasks
    );
  } else {
    mode = 'execute';
  }

  // Don't exceed baseline keptCount; fallback to caution load if undefined.
  if (allowedTasks > baseAllowed && baseAllowed > 0) {
    allowedTasks = baseAllowed;
  }
  if (!Number.isFinite(allowedTasks)) {
    allowedTasks = baseAllowed || GOVERNANCE_CONFIG.caution.allowedTasks;
  }

  const flags = {
    requireIdentityReset,
    requireGoalReview,
    highFailureRisk: highFailureRate,
    deadlineThreat,
    portfolioImbalance
  };

  const advisories = [];
  if (healthStatus) advisories.push(`health_${healthStatus}`);
  if (highFailureRate) advisories.push('high_failure_rate');
  if (deadlineThreat) advisories.push('deadline_threat');
  if (portfolioImbalance) advisories.push('portfolio_imbalanced');
  advisories.push(`mode_${mode}`);
  advisories.push(`integrity_avg_${Math.round(integrityScore)}`);
  if (allowedTasks < baseAllowed) {
    advisories.push(`allowed_tasks_reduced_from_${baseAllowed}_to_${allowedTasks}`);
  }

  return {
    cycleIndex: nextCycleIndex,
    mode,
    allowedTasks,
    severity,
    flags,
    advisories
  };
}
