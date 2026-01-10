import { addDays, dayKeyFromISO } from '../time/time.ts';
import { computeFeasibility } from './feasibility.ts';
import { derivePlanProof } from './planProof.ts';
import { deriveProbabilityStatus } from '../contracts/probabilityEligibility.ts';
import { getProbabilityWindowSpec } from './probabilityWindow.ts';

type Constraints = {
  timezone: string;
  maxBlocksPerDay?: number;
  maxBlocksPerWeek?: number;
  workableDayPolicy?: { weekdays?: Array<number | string> };
  blackoutDates?: string[];
  dailyCapacityOverrides?: Record<string, number>;
  calendarCommittedBlocksByDate?: Record<string, number>;
  scoringWindowDays?: number;
};

type ProbabilityResult = {
  value: number | null;
  status: 'INFEASIBLE' | 'UNSCHEDULABLE' | 'ELIGIBLE' | 'INELIGIBLE' | 'NO_EVIDENCE';
  capApplied: boolean;
  reasons: string[];
  requiredEvents: number | null;
  proof: {
    inputs: any;
    derived: any;
    policyVersion: string;
  };
  evidenceSummary?: {
    totalEvents: number;
    completedCount: number;
    daysCovered: number;
  };
  scoringSummary?: {
    mu: number;
    sigma: number;
    K: number;
    D: number;
    remainingBlocksTotal: number;
    requiredBlocksPerDay: number | null;
    expectedTotal: number;
  };
};

const WEEKDAY_MAP: Record<string, number> = {
  sun: 0,
  mon: 1,
  tue: 2,
  wed: 3,
  thu: 4,
  fri: 5,
  sat: 6
};

export function scoreGoalSuccessProbability(goalId: string, state: any, constraints: Constraints, nowISO: string): ProbabilityResult {
  const contracts = collectContracts(state);
  const eligibility = deriveProbabilityStatus({
    goalId,
    nowISO,
    executionEventCount: (state?.executionEvents || []).length,
    executionEvents: state?.executionEvents || [],
    contracts
  });

  const policyVersion = 'probability_v2';
  const goalDeadlineISO = resolveGoalDeadline(goalId, state);
  const feasibility = computeFeasibility(
    { goalId, deadlineISO: goalDeadlineISO || nowISO },
    state,
    constraints,
    nowISO
  );

  if (feasibility.status === 'INFEASIBLE' || feasibility.workableDaysRemaining <= 0) {
    return {
      value: 0,
      status: 'INFEASIBLE',
      capApplied: false,
      reasons: feasibility.status === 'INFEASIBLE' ? ['INFEASIBLE'] : ['NO_WORKABLE_DAYS'],
      requiredEvents: eligibility.requiredEvents,
      evidenceSummary: eligibility.evidenceSummary,
      proof: {
        inputs: { goalId, deadlineISO: goalDeadlineISO || nowISO },
        derived: { feasibility },
        policyVersion
      }
    };
  }

  const timezone = constraints?.timezone || 'UTC';
  const activeContract = resolveActiveGoalExecutionContract(goalId, state);
  const planProof = resolvePlanProof(goalId, state, constraints, nowISO);
  const initial = deriveInitialProbability(goalId, planProof, constraints, policyVersion);

  if (eligibility.status !== 'computed') {
    return {
      ...initial,
      status: initial.status === 'NO_EVIDENCE' ? 'NO_EVIDENCE' : initial.status,
      reasons: [...new Set([...initial.reasons, ...(eligibility.reasons || [])])],
      requiredEvents: eligibility.requiredEvents,
      evidenceSummary: eligibility.evidenceSummary
    };
  }

  const windowSpec = getProbabilityWindowSpec({
    activeContract,
    nowISO,
    timeZone: timezone,
    scoringWindowDays: constraints?.scoringWindowDays
  });
  const dayKeys =
    windowSpec.mode === 'cycle_to_date'
      ? collectWorkableDaysInRange(windowSpec.startDayKey, windowSpec.endDayKey, timezone, constraints)
      : collectRecentWorkableDays(nowISO, timezone, constraints, windowSpec.windowDays || 14);
  const throughput = computeCompletedThroughput({
    events: state?.executionEvents || [],
    goalId,
    dayKeys
  });
  const evidenceDays = Object.keys(throughput.completedBlocksByDay || {}).length;
  const hasEvidence = throughput.completedBlocksTotal > 0;
  const series = dayKeys.map((dayKey) => throughput.completedBlocksByDay[dayKey] || 0);

  const mu = mean(series);
  const sigma = stddev(series);
  const D = feasibility.workableDaysRemaining;
  const remainingBlocksTotal = feasibility.remainingBlocksTotal;
  const requiredBlocksPerDay = feasibility.requiredBlocksPerDay;

  let value: number;
  if (sigma === 0) {
    value = D * mu >= remainingBlocksTotal ? 1 : 0;
  } else {
    const meanTotal = D * mu;
    const stdTotal = Math.sqrt(D) * sigma;
    const z = (remainingBlocksTotal - meanTotal) / stdTotal;
    value = 1 - normalCdf(z);
    value = clamp01(value);
  }

  const minEvidenceDays = 7;
  const allowAboveCap = evidenceDays >= minEvidenceDays;
  const combined = allowAboveCap ? clamp01((value + (initial.value ?? 0)) / 2) : Math.min(value, 0.65);
  const evidenceStatus = !hasEvidence ? 'NO_EVIDENCE' : evidenceDays < minEvidenceDays ? 'INELIGIBLE' : 'ELIGIBLE';
  const baseReport: ProbabilityResult = {
    value: combined,
    status: evidenceStatus,
    capApplied: !allowAboveCap && combined <= 0.65,
    reasons: allowAboveCap ? [] : ['CAP_APPLIED_NO_EVIDENCE'],
    requiredEvents: eligibility.requiredEvents,
    evidenceSummary: eligibility.evidenceSummary,
    proof: {
      inputs: { goalId, windowSpec, planProof },
      derived: { feasibility, evidenceDays, evidenceValue: value, initial },
      policyVersion
    },
    scoringSummary: {
      mu,
      sigma,
      K: series.length,
      D,
      remainingBlocksTotal,
      requiredBlocksPerDay,
      expectedTotal: D * mu
    }
  };

  const autoAsanaPlan = resolveAutoAsanaPlan(goalId, state);
  if (autoAsanaPlan?.conflicts?.length) {
    return {
      ...baseReport,
      status: 'UNSCHEDULABLE',
      value: baseReport.value !== null ? clamp01(baseReport.value * 0.8) : null,
      reasons: [
        ...baseReport.reasons,
        ...autoAsanaPlan.conflicts.map((c: any) => `UNSCHEDULABLE_${c.kind || 'CONFLICT'}`)
      ]
    };
  }

  return baseReport;
}

function collectContracts(state: any) {
  if (state?.activeCycleId && state?.cyclesById?.[state.activeCycleId]?.goalGovernanceContract) {
    return [state.cyclesById[state.activeCycleId].goalGovernanceContract];
  }
  return Object.values(state?.cyclesById || {})
    .map((cycle: any) => cycle?.goalGovernanceContract)
    .filter(Boolean);
}

function resolveActiveGoalExecutionContract(goalId: string, state: any) {
  const contract = state?.goalExecutionContract;
  if (contract?.goalId && contract.goalId === goalId) return contract;
  return null;
}

function resolveGoalDeadline(goalId: string, state: any) {
  const cycles = Object.values(state?.cyclesById || {});
  const match = cycles.find((cycle: any) => cycle?.goalGovernanceContract?.goalId === goalId);
  return match?.definiteGoal?.deadlineDayKey || null;
}

function resolvePlanProof(goalId: string, state: any, constraints: Constraints, nowISO: string) {
  const cycle = state?.activeCycleId ? state?.cyclesById?.[state.activeCycleId] : null;
  if (cycle?.goalPlan?.planProof) return cycle.goalPlan.planProof;
  if (cycle?.goalEquation) {
    return derivePlanProof(cycle.goalEquation, {
      nowDayKey: state?.appTime?.activeDayKey,
      timeZone: constraints?.timezone
    });
  }
  const fallbackMax = Number.isFinite(constraints?.maxBlocksPerDay) ? Number(constraints?.maxBlocksPerDay) : 0;
  const maxPerDay = Math.max(0, fallbackMax);
  const maxPerWeek = Number.isFinite(constraints?.maxBlocksPerWeek) ? Number(constraints?.maxBlocksPerWeek) : maxPerDay * 7;
  return {
    workableDaysRemaining: feasibilityDaysFromState(goalId, state, constraints, nowISO),
    totalRequiredUnits: 0,
    requiredPacePerDay: 0,
    maxPerDay,
    maxPerWeek,
    slackUnits: 0,
    slackRatio: 0,
    intensityRatio: 0,
    feasibilityStatus: 'FEASIBLE',
    feasibilityReasons: []
  };
}

function feasibilityDaysFromState(goalId: string, state: any, constraints: Constraints, nowISO: string) {
  const deadlineISO = resolveGoalDeadline(goalId, state) || nowISO;
  const feasibility = computeFeasibility({ goalId, deadlineISO }, state, constraints, nowISO);
  return feasibility.workableDaysRemaining || 0;
}

function resolveAutoAsanaPlan(goalId: string, state: any) {
  const cycle = state?.activeCycleId ? state?.cyclesById?.[state.activeCycleId] : null;
  if (!cycle || cycle.goalContract?.goalId !== goalId) return null;
  return cycle.autoAsanaPlan || null;
}

function deriveInitialProbability(goalId: string, planProof: any, constraints: Constraints, policyVersion: string): ProbabilityResult {
  const reasons: string[] = [];
  if (planProof?.feasibilityStatus === 'INFEASIBLE') {
    return {
      value: 0,
      status: 'INFEASIBLE',
      capApplied: false,
      reasons: planProof?.feasibilityReasons?.length ? planProof.feasibilityReasons : ['INFEASIBLE'],
      requiredEvents: 0,
      evidenceSummary: { totalEvents: 0, completedCount: 0, daysCovered: 0 },
      proof: {
        inputs: { goalId, planProof, constraints },
        derived: {},
        policyVersion
      }
    };
  }

  const intensityRatio = clamp01(planProof?.intensityRatio ?? 0);
  const slackRatio = clamp01(planProof?.slackRatio ?? 0);
  const constraintDensity = clamp01(constraintDensityScore(constraints));
  const slackPenalty = clamp01(1 - slackRatio);
  const intensityPenalty = intensityRatio;
  const base = clamp01(1 - (0.45 * intensityPenalty + 0.35 * slackPenalty + 0.2 * constraintDensity));
  const capped = Math.min(base, 0.65);
  if (base > capped) reasons.push('CAP_APPLIED_NO_EVIDENCE');

  return {
    value: capped,
    status: 'NO_EVIDENCE',
    capApplied: base > capped,
    reasons,
    requiredEvents: 0,
    evidenceSummary: { totalEvents: 0, completedCount: 0, daysCovered: 0 },
    proof: {
      inputs: { goalId, planProof, constraints },
      derived: { base, intensityRatio, slackRatio, constraintDensity },
      policyVersion
    }
  };
}

function constraintDensityScore(constraints: Constraints) {
  if (!constraints) return 0;
  let count = 0;
  if (Number.isFinite(constraints.maxBlocksPerDay) && (constraints.maxBlocksPerDay || 0) > 0) count += 1;
  if (Number.isFinite(constraints.maxBlocksPerWeek) && (constraints.maxBlocksPerWeek || 0) > 0) count += 1;
  if (constraints.blackoutDates?.length) count += 1;
  if (constraints.workableDayPolicy?.weekdays?.length) count += 1;
  if (constraints.dailyCapacityOverrides && Object.keys(constraints.dailyCapacityOverrides).length) count += 1;
  return count / 5;
}

function collectRecentWorkableDays(nowISO: string, timezone: string, constraints: Constraints, count: number) {
  const days: string[] = [];
  let cursor = dayKeyFromISO(nowISO, timezone);
  while (days.length < count) {
    if (isWorkableDate(cursor, constraints, timezone)) days.push(cursor);
    cursor = addDays(cursor, -1, timezone);
    if (!cursor) break;
  }
  return days;
}

function collectWorkableDaysInRange(startDayKey: string, endDayKey: string, timezone: string, constraints: Constraints) {
  if (!startDayKey || !endDayKey) return [];
  const days: string[] = [];
  let cursor = endDayKey;
  let guard = 0;
  while (cursor >= startDayKey && guard < 10000) {
    if (isWorkableDate(cursor, constraints, timezone)) days.push(cursor);
    const next = addDays(cursor, -1, timezone);
    if (!next || next === cursor) break;
    cursor = next;
    guard += 1;
  }
  return days;
}

type ThroughputResult = {
  completedMinutesTotal: number;
  completedBlocksTotal: number;
  completedMinutesByDay: Record<string, number>;
  completedBlocksByDay: Record<string, number>;
};

// Probability evidence = completed execution only. Planning churn is ignored here by design.
export function computeCompletedThroughput({
  events,
  goalId,
  dayKeys
}: {
  events: Array<{ goalId?: string; dateISO?: string; completed?: boolean; kind?: string; minutes?: number }>;
  goalId: string;
  dayKeys: string[];
}): ThroughputResult {
  const completedMinutesByDay: Record<string, number> = {};
  const completedBlocksByDay: Record<string, number> = {};
  const allowedDays = new Set(dayKeys || []);

  (events || []).forEach((event) => {
    if (!event || event.goalId !== goalId) return;
    if (!event.completed) return;
    if (event.kind && event.kind !== 'complete') return;
    if (!event.dateISO || !allowedDays.has(event.dateISO)) return;
    const minutes = Number.isFinite(event.minutes) ? Math.max(0, Math.round(event.minutes || 0)) : 0;
    completedMinutesByDay[event.dateISO] = (completedMinutesByDay[event.dateISO] || 0) + minutes;
    completedBlocksByDay[event.dateISO] = (completedBlocksByDay[event.dateISO] || 0) + 1;
  });

  const completedMinutesTotal = Object.values(completedMinutesByDay).reduce((sum, v) => sum + (v || 0), 0);
  const completedBlocksTotal = Object.values(completedBlocksByDay).reduce((sum, v) => sum + (v || 0), 0);

  return {
    completedMinutesTotal,
    completedBlocksTotal,
    completedMinutesByDay,
    completedBlocksByDay
  };
}

function mean(values: number[]) {
  if (!values.length) return 0;
  const sum = values.reduce((acc, v) => acc + v, 0);
  return sum / values.length;
}

function stddev(values: number[]) {
  if (!values.length) return 0;
  const mu = mean(values);
  const variance = values.reduce((acc, v) => acc + Math.pow(v - mu, 2), 0) / values.length;
  return Math.sqrt(variance);
}

function normalCdf(z: number) {
  return 0.5 * (1 + erf(z / Math.SQRT2));
}

function erf(x: number) {
  const sign = x >= 0 ? 1 : -1;
  const abs = Math.abs(x);
  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const p = 0.3275911;
  const t = 1 / (1 + p * abs);
  const y =
    1 -
    (((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t) *
      Math.exp(-abs * abs);
  return sign * y;
}

function clamp01(value: number) {
  if (!Number.isFinite(value)) return 0;
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}

function isWorkableDate(dateKey: string, constraints: Constraints, timezone: string) {
  if (!dateKey) return false;
  const blackout = new Set(constraints?.blackoutDates || []);
  if (blackout.has(dateKey)) return false;
  const weekdays = normalizeWeekdays(constraints?.workableDayPolicy?.weekdays);
  if (!weekdays) return true;
  const weekday = weekdayIndex(dateKey, timezone);
  return weekdays.includes(weekday);
}

function normalizeWeekdays(weekdays?: Array<number | string>) {
  if (!weekdays || !weekdays.length) return null;
  const out: number[] = [];
  weekdays.forEach((d) => {
    if (typeof d === 'number' && d >= 0 && d <= 6) out.push(d);
    if (typeof d === 'string') {
      const key = d.slice(0, 3).toLowerCase();
      if (key in WEEKDAY_MAP) out.push(WEEKDAY_MAP[key]);
    }
  });
  return Array.from(new Set(out));
}

function weekdayIndex(dateKey: string, timezone: string) {
  const [y, m, d] = dateKey.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
  const day = new Intl.DateTimeFormat('en-US', { timeZone: timezone, weekday: 'short' }).format(dt);
  const key = day.slice(0, 3).toLowerCase();
  return WEEKDAY_MAP[key] ?? 0;
}
