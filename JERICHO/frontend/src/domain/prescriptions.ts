export type PrescriptionCode =
  | 'INCREASE_WEEKLY_CAPACITY'
  | 'EXTEND_MILESTONE_WINDOW'
  | 'INCREASE_EXECUTION_HORIZON'
  | 'REDUCE_SCOPE_CATEGORY';

export type PrimaryConstraint = 'NONE' | 'CAPACITY' | 'MILESTONE_WINDOW_INFEASIBLE' | 'EXECUTION_HORIZON';

export type Prescription = {
  code: PrescriptionCode;
  priority: number;
  rationale: string;
  parameters: Record<string, unknown>;
};

export type PrescriptionInput = {
  unplacedEstimateMinTotal?: number;
  unplacedEstimateMinByCategory?: Record<string, number>;
  outsideExecutionHorizonEstimateMinTotal?: number;
  outsideExecutionHorizonCount?: number;
  executionHorizonDays?: number | null;
  placementWindowDays?: number | null;
  maxScheduledMinutesPerWeek?: number | null;
  milestoneWindowMissCountPlacement?: number | null;
  milestoneWindowSlack?: {
    infeasibleMilestonesCount?: number;
    byMilestone?: Record<
      string,
      {
        slackMinutes?: number;
        slackRatio?: number;
      }
    >;
  } | null;
};

export type PrescriptionsBundle = {
  primaryConstraint: PrimaryConstraint;
  prescriptionsCount: number;
  mustIncludeCodes: PrescriptionCode[];
  prescriptions: Prescription[];
};

function safeNumber(value: unknown, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function ceilDiv(numerator: number, denominator: number) {
  const num = Math.max(0, safeNumber(numerator));
  const den = Math.max(1, safeNumber(denominator, 1));
  return Math.ceil(num / den);
}

function normalizeWeeks(windowDays: number) {
  return Math.max(1, Math.ceil(Math.max(1, safeNumber(windowDays, 1)) / 7));
}

function sortPrescriptions(items: Prescription[]) {
  return [...items].sort((lhs, rhs) => {
    if (lhs.priority !== rhs.priority) return lhs.priority - rhs.priority;
    if (lhs.code !== rhs.code) return lhs.code.localeCompare(rhs.code);
    return JSON.stringify(lhs.parameters).localeCompare(JSON.stringify(rhs.parameters));
  });
}

export function computePrescriptions(input: PrescriptionInput = {}): PrescriptionsBundle {
  const unplacedEstimateMinTotal = Math.max(0, safeNumber(input.unplacedEstimateMinTotal));
  const outsideExecutionHorizonEstimateMinTotal = Math.max(
    0,
    safeNumber(input.outsideExecutionHorizonEstimateMinTotal)
  );
  const outsideExecutionHorizonCount = Math.max(0, safeNumber(input.outsideExecutionHorizonCount));
  const maxScheduledMinutesPerWeek = Math.max(1, safeNumber(input.maxScheduledMinutesPerWeek, 1));
  const windowDays = safeNumber(input.placementWindowDays ?? input.executionHorizonDays ?? 0, 0);
  const horizonWeeks = normalizeWeeks(windowDays);

  const milestoneSlack = input.milestoneWindowSlack;
  const infeasibleMilestonesBySlack = Object.entries(milestoneSlack?.byMilestone || {})
    .filter(([, value]) => safeNumber(value?.slackRatio, 1) < 1 || safeNumber(value?.slackMinutes, 0) < 0)
    .map(([milestoneId, value]) => ({
      milestoneId,
      slackMinutes: safeNumber(value?.slackMinutes, 0),
      slackRatio: safeNumber(value?.slackRatio, 0),
    }))
    .sort((lhs, rhs) => {
      if (lhs.slackRatio !== rhs.slackRatio) return lhs.slackRatio - rhs.slackRatio;
      if (lhs.slackMinutes !== rhs.slackMinutes) return lhs.slackMinutes - rhs.slackMinutes;
      return lhs.milestoneId.localeCompare(rhs.milestoneId);
    });
  const infeasibleMilestonesCount = Math.max(
    safeNumber(milestoneSlack?.infeasibleMilestonesCount, infeasibleMilestonesBySlack.length),
    infeasibleMilestonesBySlack.length,
    safeNumber(input.milestoneWindowMissCountPlacement, 0) > 0 ? 1 : 0
  );

  const prescriptions: Prescription[] = [];

  if (unplacedEstimateMinTotal > 0) {
    const requiredExtraMinutesPerWeek = ceilDiv(unplacedEstimateMinTotal, horizonWeeks);
    prescriptions.push({
      code: 'INCREASE_WEEKLY_CAPACITY',
      priority: 20,
      rationale: 'Unplaced estimated minutes exceed current weekly throughput.',
      parameters: {
        unplacedEstimateMinTotal,
        horizonWeeks,
        requiredExtraMinutesPerWeek,
      },
    });

    const topCategory = Object.entries(input.unplacedEstimateMinByCategory || {})
      .map(([category, minutes]) => ({ category, minutes: Math.max(0, safeNumber(minutes)) }))
      .sort((lhs, rhs) => {
        if (lhs.minutes !== rhs.minutes) return rhs.minutes - lhs.minutes;
        return lhs.category.localeCompare(rhs.category);
      })[0];
    if (topCategory && topCategory.minutes > 0) {
      prescriptions.push({
        code: 'REDUCE_SCOPE_CATEGORY',
        priority: 40,
        rationale: 'Largest unplaced category indicates a scope reduction candidate.',
        parameters: {
          category: topCategory.category,
          minutes: topCategory.minutes,
        },
      });
    }
  }

  if (outsideExecutionHorizonEstimateMinTotal > 0 || outsideExecutionHorizonCount > 0) {
    const requiredExtraWeeks = ceilDiv(outsideExecutionHorizonEstimateMinTotal, maxScheduledMinutesPerWeek);
    prescriptions.push({
      code: 'INCREASE_EXECUTION_HORIZON',
      priority: 30,
      rationale: 'Feasible work exists beyond the current execution horizon.',
      parameters: {
        outsideExecutionHorizonCount,
        outsideExecutionHorizonEstimateMinTotal,
        requiredExtraWeeks,
      },
    });
  }

  if (infeasibleMilestonesBySlack.length > 0) {
    infeasibleMilestonesBySlack.forEach((entry, index) => {
      const extensionWeeks = ceilDiv(Math.abs(Math.min(0, entry.slackMinutes)), maxScheduledMinutesPerWeek);
      prescriptions.push({
        code: 'EXTEND_MILESTONE_WINDOW',
        priority: 10 + index,
        rationale: 'Milestone window has negative slack under current capacity assumptions.',
        parameters: {
          milestoneId: entry.milestoneId,
          extensionWeeks: Math.max(1, extensionWeeks),
          slackMinutes: entry.slackMinutes,
          slackRatio: entry.slackRatio,
        },
      });
    });
  } else if (infeasibleMilestonesCount > 0) {
    prescriptions.push({
      code: 'EXTEND_MILESTONE_WINDOW',
      priority: 10,
      rationale: 'Placement misses indicate window infeasibility.',
      parameters: {
        milestoneId: 'UNKNOWN',
        extensionWeeks: 1,
        slackMinutes: null,
        slackRatio: null,
      },
    });
  }

  const ordered = sortPrescriptions(prescriptions);
  const primaryConstraint: PrimaryConstraint =
    infeasibleMilestonesCount > 0
      ? 'MILESTONE_WINDOW_INFEASIBLE'
      : unplacedEstimateMinTotal > 0
        ? 'CAPACITY'
        : outsideExecutionHorizonEstimateMinTotal > 0
          ? 'EXECUTION_HORIZON'
          : 'NONE';

  return {
    primaryConstraint,
    prescriptionsCount: ordered.length,
    mustIncludeCodes: ordered.map((entry) => entry.code),
    prescriptions: ordered,
  };
}
