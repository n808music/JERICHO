import { inferHorizonYearsFromText } from './masterPlanIntakeEngine.js';

function normalizeDayKey(value) {
  if (!value) {
    return null;
  }
  const text = String(value).trim();
  return text ? text.slice(0, 10) : null;
}

function parseDayKey(value) {
  const dayKey = normalizeDayKey(value);
  return dayKey ? new Date(`${dayKey}T12:00:00.000Z`) : null;
}

function addMonthsToDayKey(value, months) {
  const start = parseDayKey(value);
  const normalizedMonths = Math.round(Number(months || 0));
  if (!start || !Number.isFinite(normalizedMonths) || normalizedMonths <= 0) {
    return null;
  }
  start.setUTCMonth(start.getUTCMonth() + normalizedMonths);
  return start.toISOString().slice(0, 10);
}

function maxDayKey(values = []) {
  return values
    .map((value) => normalizeDayKey(value))
    .filter(Boolean)
    .sort()
    .pop() || null;
}

function extractExecutionHorizonMonths(plan) {
  const executionHorizon = String(plan?.executionHorizon || '').trim();
  if (!executionHorizon) {
    return 0;
  }
  const inferred = inferHorizonYearsFromText(executionHorizon);
  if (inferred?.months) {
    return inferred.months;
  }
  const startDayKey = normalizeDayKey(plan?.horizonStart);
  const yearMatch = executionHorizon.match(/\b(20[2-9]\d)\b/);
  if (!startDayKey || !yearMatch) {
    return 0;
  }
  const targetYear = parseInt(yearMatch[1], 10);
  const startYear = parseInt(startDayKey.slice(0, 4), 10);
  const approxMonths = (targetYear - startYear) * 12;
  return approxMonths >= 24 && approxMonths <= 240 ? approxMonths : 0;
}

export function resolveStrategicAgendaHorizon(plan, missionContract = null) {
  const horizonStart = normalizeDayKey(plan?.horizonStart);
  const explicitPlanEnd = normalizeDayKey(plan?.fullHorizonEndDayKey || plan?.horizonEnd);
  const declaredHorizonMonths = Number.isFinite(Number(plan?.declaredHorizonMonths))
    ? Math.round(Number(plan.declaredHorizonMonths))
    : 0;
  const missionHorizonMonths = Number.isFinite(Number(missionContract?.horizonYears))
    ? Math.round(Number(missionContract.horizonYears) * 12)
    : 0;
  const inferredText = [
    plan?.title,
    plan?.northStarOutcome,
    plan?.coreMission,
    missionContract?.durableObjective,
    missionContract?.strategicThesis,
  ]
    .filter(Boolean)
    .join(' ');
  const inferredTextMonths = inferHorizonYearsFromText(inferredText)?.months || 0;
  const executionHorizonMonths = extractExecutionHorizonMonths(plan);
  const resolvedStrategicMonths = Math.max(
    declaredHorizonMonths,
    missionHorizonMonths,
    inferredTextMonths,
    executionHorizonMonths
  );
  const inferredEndFromMonths = horizonStart ? addMonthsToDayKey(horizonStart, resolvedStrategicMonths) : null;
  const resolvedStrategicHorizonEndDayKey = maxDayKey([explicitPlanEnd, inferredEndFromMonths]);

  return {
    horizonStart,
    explicitPlanEnd,
    declaredHorizonMonths,
    missionHorizonMonths,
    inferredTextMonths,
    executionHorizonMonths,
    resolvedStrategicMonths,
    strategicAgendaEndDayKey: resolvedStrategicHorizonEndDayKey,
    resolvedStrategicHorizonEndDayKey,
  };
}

export function clampDayKeyToRange(value, maxValue) {
  const dayKey = normalizeDayKey(value);
  const maxDay = normalizeDayKey(maxValue);
  if (!dayKey) {
    return maxDay;
  }
  if (!maxDay) {
    return dayKey;
  }
  return dayKey < maxDay ? dayKey : maxDay;
}

export function normalizeStrategicDayKey(value) {
  return normalizeDayKey(value);
}
