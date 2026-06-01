import { getQualityPolicy, type QualityPolicy } from './policy.ts';

export type ScheduleAssignment = {
  actionId: string;
  chunkIndex: number;
  chunkCount: number;
  dayKey: string;
  startMin: number;
  durationMin: number;
  category?: string;
  isMilestone?: boolean;
  isCheckpoint?: boolean;
};

export type ScoreInputs = {
  assignments: ScheduleAssignment[];
  assignmentsAreSorted?: boolean;
  actionGraph?: {
    dependenciesByActionId?: Record<string, string[]>;
  };
  constraints?: {
    maxScheduledMinutesPerDay?: number;
    maxScheduledMinutesPerWeek?: number;
    executionHorizonDays?: number;
  };
  horizons?: {
    executionWindowStartDayKey?: string;
    executionWindowEndDayKey?: string;
    feasibilityWindowEndDayKey?: string;
  };
  milestones?: Array<{
    milestoneId: string;
    windowStartDayKey: string;
    windowEndDayKey: string;
    checkpointActionIds?: string[];
  }>;
  metricsContext?: {
    outsideExecutionHorizonMinutes?: number;
    unplacedMinutes?: number;
    depMarginsByActionId?: Record<string, number>;
    milestoneWindowSlack?: Record<string, { slackRatio?: number }>;
    goalDeadlineDayKey?: string;
  };
  policyId?: string;
  policy?: QualityPolicy;
};

export type ScoreBreakdown = {
  total: number;
  components: {
    deadlineRisk: number;
    milestoneRisk: number;
    dependencyRisk: number;
    contextSwitching: number;
    loadSmoothness: number;
    deferralPenalty: number;
  };
  evidence: {
    deadlineOverrunDays?: number;
    milestoneAtRiskCount?: number;
    depTightCount?: number;
    contextSwitchCount?: number;
    dailyLoadStdDev?: number;
    outsideExecutionHorizonMinutes?: number;
  };
};

function sortAssignments(assignments: ScheduleAssignment[] = []) {
  return [...assignments].sort((a, b) => {
    if (a.dayKey !== b.dayKey) return a.dayKey.localeCompare(b.dayKey);
    if (a.startMin !== b.startMin) return a.startMin - b.startMin;
    if (a.actionId !== b.actionId) return a.actionId.localeCompare(b.actionId);
    return a.chunkIndex - b.chunkIndex;
  });
}

function roundInt(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.round(value);
}

function computeDayLoads(assignments: ScheduleAssignment[]) {
  const loads = new Map<string, number>();
  assignments.forEach((a) => {
    loads.set(a.dayKey, (loads.get(a.dayKey) || 0) + Math.max(0, roundInt(a.durationMin)));
  });
  return loads;
}

function computeContextSwitchCount(assignments: ScheduleAssignment[]) {
  let count = 0;
  let currentDayKey = '';
  let previousCategory = '';
  assignments.forEach((assignment) => {
    const dayKey = assignment.dayKey || '';
    const category = (assignment.category || '').toLowerCase();
    if (dayKey !== currentDayKey) {
      currentDayKey = dayKey;
      previousCategory = category;
      return;
    }
    if (category !== previousCategory) {
      count += 1;
    }
    previousCategory = category;
  });
  return count;
}

function computeStdDev(values: number[]) {
  if (!values.length) return 0;
  const avg = values.reduce((s, v) => s + v, 0) / values.length;
  const variance = values.reduce((s, v) => s + (v - avg) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

function estimateDependencyRisk(
  assignments: ScheduleAssignment[],
  depMarginsByActionId: Record<string, number>,
  depTightMarginMin: number
) {
  if (!assignments.length) return { score: 0, tightCount: 0 };
  let tightCount = 0;
  const byAction = new Map<string, ScheduleAssignment>();
  assignments.forEach((a) => {
    if (!byAction.has(a.actionId)) byAction.set(a.actionId, a);
  });
  [...byAction.keys()].sort().forEach((actionId) => {
    const margin = Number(depMarginsByActionId[actionId]);
    if (!Number.isFinite(margin) || margin > depTightMarginMin) return;
    tightCount += 1;
  });
  const score = tightCount * 10;
  return { score, tightCount };
}

export function scoreSchedule(input: ScoreInputs): ScoreBreakdown {
  const policy = input.policy || getQualityPolicy(input.policyId);
  const assignments = input.assignmentsAreSorted
    ? [...(input.assignments || [])]
    : sortAssignments(input.assignments || []);
  const dayLoadsMap = computeDayLoads(assignments);
  const dayLoads = [...dayLoadsMap.keys()].sort().map((k) => dayLoadsMap.get(k) || 0);
  const contextSwitchCount = computeContextSwitchCount(assignments);

  const rawStdDev = computeStdDev(dayLoads);
  const dailyLoadStdDev = roundInt(rawStdDev);
  const loadSmoothness = roundInt((dailyLoadStdDev / Math.max(1, policy.thresholds.maxDailyLoadStdDev)) * 100);

  const outsideExecutionHorizonMinutes = roundInt(input.metricsContext?.outsideExecutionHorizonMinutes || 0);
  const unplacedMinutes = roundInt(input.metricsContext?.unplacedMinutes || 0);
  const outsideHours = (outsideExecutionHorizonMinutes + unplacedMinutes) / 60;
  const deferralPenalty = roundInt(outsideHours * policy.thresholds.deferralOutsideHorizonPenaltyPerHour);

  const depRisk = estimateDependencyRisk(
    assignments,
    input.metricsContext?.depMarginsByActionId || {},
    policy.thresholds.depTightMarginMin
  );

  const milestoneAtRiskCount = (input.milestones || []).reduce((count, milestone) => {
    const slack = input.metricsContext?.milestoneWindowSlack?.[milestone.milestoneId]?.slackRatio;
    if (Number.isFinite(slack) && Number(slack) < policy.thresholds.milestoneAtRiskSlackRatio) {
      return count + 1;
    }
    const placed = assignments.some((a) => a.isMilestone || (milestone.checkpointActionIds || []).includes(a.actionId));
    return placed ? count : count + 1;
  }, 0);
  const milestoneRisk = roundInt(milestoneAtRiskCount * 20);

  const latestDayKey = assignments.length
    ? assignments[assignments.length - 1].dayKey
    : input.horizons?.executionWindowStartDayKey || '';
  const goalDeadlineDayKey =
    input.metricsContext?.goalDeadlineDayKey || input.horizons?.executionWindowEndDayKey || latestDayKey;
  const deadlineOverrunDays = latestDayKey && goalDeadlineDayKey && latestDayKey > goalDeadlineDayKey ? 1 : 0;
  const deadlineRisk = roundInt(deadlineOverrunDays * 100 + deferralPenalty * 0.4);

  const contextSwitching = roundInt(
    (contextSwitchCount / Math.max(1, policy.thresholds.maxContextSwitchesPerDay * Math.max(1, dayLoads.length))) * 100
  );

  const components = {
    deadlineRisk,
    milestoneRisk,
    dependencyRisk: depRisk.score,
    contextSwitching,
    loadSmoothness,
    deferralPenalty,
  };

  const total = roundInt(
    components.deadlineRisk * policy.weights.deadlineRisk +
      components.milestoneRisk * policy.weights.milestoneRisk +
      components.dependencyRisk * policy.weights.dependencyRisk +
      components.contextSwitching * policy.weights.contextSwitching +
      components.loadSmoothness * policy.weights.loadSmoothness +
      components.deferralPenalty * policy.weights.deferralPenalty
  );

  return {
    total,
    components,
    evidence: {
      deadlineOverrunDays,
      milestoneAtRiskCount,
      depTightCount: depRisk.tightCount,
      contextSwitchCount,
      dailyLoadStdDev,
      outsideExecutionHorizonMinutes,
    },
  };
}
