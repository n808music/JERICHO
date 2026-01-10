import { addDays, nowDayKey } from '../time/time.ts';

type PlanProof = {
  workableDaysRemaining: number;
  totalRequiredUnits: number;
  requiredPacePerDay: number;
  maxPerDay: number;
  maxPerWeek: number;
  slackUnits: number;
  slackRatio: number;
  intensityRatio: number;
  feasibilityStatus: 'FEASIBLE' | 'INFEASIBLE';
  feasibilityReasons: string[];
};

type GoalEquationInput = {
  objective: 'LOSE_WEIGHT_LBS' | 'PRACTICE_HOURS_TOTAL' | 'PUBLISH_COUNT';
  objectiveValue: number;
  deadlineDayKey: string;
  workDaysPerWeek: number;
  maxDailyWorkMinutes: number;
  weekendAllowed?: boolean;
};

function clamp01(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

function blockMinutesForObjective(objective: GoalEquationInput['objective']) {
  if (objective === 'LOSE_WEIGHT_LBS') return 45;
  if (objective === 'PUBLISH_COUNT') return 60;
  return 60;
}

export function derivePlanProof(
  equation: GoalEquationInput,
  {
    nowDayKey: nowKey,
    timeZone
  }: { nowDayKey?: string; timeZone?: string } = {}
): PlanProof {
  const startKey = nowKey || nowDayKey(timeZone);
  const endKey = equation.deadlineDayKey;
  const workableDaysRemaining = Math.max(1, daySpan(startKey, endKey, timeZone));
  const totalRequiredUnits = Number(equation.objectiveValue) || 0;
  const requiredPacePerDay = workableDaysRemaining ? totalRequiredUnits / workableDaysRemaining : 0;
  const minutesPerBlock = blockMinutesForObjective(equation.objective);
  const maxPerDay = Math.max(0, Math.floor((equation.maxDailyWorkMinutes || 0) / minutesPerBlock));
  const maxPerWeek = Math.max(0, maxPerDay * (equation.workDaysPerWeek || 5));
  const totalCapacity = maxPerDay * workableDaysRemaining;
  const slackUnits = totalCapacity - totalRequiredUnits;
  const slackRatio = totalRequiredUnits ? clamp01(slackUnits / totalRequiredUnits) : 0;
  const intensityRatio = maxPerDay ? clamp01(requiredPacePerDay / maxPerDay) : 1;
  const feasibilityReasons: string[] = [];
  let feasibilityStatus: PlanProof['feasibilityStatus'] = 'FEASIBLE';
  if (maxPerDay <= 0) {
    feasibilityStatus = 'INFEASIBLE';
    feasibilityReasons.push('MAX_PER_DAY_ZERO');
  }
  if (requiredPacePerDay > maxPerDay && maxPerDay > 0) {
    feasibilityStatus = 'INFEASIBLE';
    feasibilityReasons.push('REQUIRED_PACE_EXCEEDS_MAX');
  }
  if (totalRequiredUnits <= 0) {
    feasibilityStatus = 'INFEASIBLE';
    feasibilityReasons.push('REQUIRED_UNITS_ZERO');
  }
  return {
    workableDaysRemaining,
    totalRequiredUnits,
    requiredPacePerDay,
    maxPerDay,
    maxPerWeek,
    slackUnits,
    slackRatio,
    intensityRatio,
    feasibilityStatus,
    feasibilityReasons
  };
}

function daySpan(startDayKey: string, endDayKey: string, timeZone?: string) {
  if (!startDayKey || !endDayKey) return 0;
  let cursor = startDayKey;
  let count = 0;
  while (cursor && cursor <= endDayKey && count < 10000) {
    count += 1;
    const next = addDays(cursor, 1, timeZone);
    if (!next || next === cursor) break;
    cursor = next;
  }
  return count;
}
