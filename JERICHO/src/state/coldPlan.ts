import { addDays, dayKeyFromISO } from './time/time.ts';
import { buildAssumptionsHash, normalizeDeliverables, normalizeRouteOption, StrategyV1, StrategyDeliverable, RouteOption } from './strategy.ts';

type ColdPlanForecast = {
  totalBlocks: number;
  byDeliverable?: Record<string, number>;
};

export type ColdPlanV1 = {
  version: number;
  generatorVersion: 'coldPlan_v1';
  strategyId: string;
  assumptionsHash: string;
  createdAtISO: string;
  forecastByDayKey: Record<string, ColdPlanForecast>;
  infeasible?: {
    reason: string;
    requiredCapacityPerWeek: number;
    availableCapacityPerWeek: number;
  };
};

export type ColdPlanDailyProjection = {
  asOfDayKey: string;
  remainingRequiredBlocks: number;
  generatorVersion: 'coldPlan_v1';
  derivedFrom: {
    strategyId: string;
    assumptionsHash: string;
    coldPlanVersion: number;
  };
  forecastByDayKey: Record<string, ColdPlanForecast>;
  infeasible?: ColdPlanV1['infeasible'];
};

type GenerateColdPlanInput = {
  cycleStartISO: string;
  nowISO: string;
  strategy: StrategyV1;
  completedCountToDate: number;
  rebaseMode: 'NONE' | 'REMAINING_FROM_TODAY';
};

type RouteAllocation = {
  forecastByDayKey: Record<string, number>;
  infeasible?: ColdPlanV1['infeasible'];
};

const DEFAULT_GENERATOR_VERSION = 'coldPlan_v1';

const weekdayFormatter = (timeZone: string) =>
  new Intl.DateTimeFormat('en-US', { timeZone, weekday: 'short' });

const WEEKDAY_INDEX = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 } as const;

function weekdayIndex(dayKey: string, timeZone: string) {
  const d = new Date(`${dayKey}T12:00:00.000Z`);
  const parts = weekdayFormatter(timeZone).formatToParts(d);
  const label = parts.find((p) => p.type === 'weekday')?.value || 'Mon';
  return WEEKDAY_INDEX[label as keyof typeof WEEKDAY_INDEX] ?? 1;
}

function daysBetween(startDayKey: string, endDayKey: string, timeZone: string) {
  if (!startDayKey || !endDayKey) return [];
  const days: string[] = [];
  let cursor = startDayKey;
  while (cursor && cursor <= endDayKey) {
    days.push(cursor);
    if (cursor === endDayKey) break;
    cursor = addDays(cursor, 1, timeZone);
  }
  return days;
}

function filterWorkableDays(dayKeys: string[], constraints: StrategyV1['constraints']) {
  const preferred = constraints?.preferredDaysOfWeek;
  const blackout = new Set(constraints?.blackoutDayKeys || []);
  return (dayKeys || []).filter((dayKey) => {
    if (blackout.has(dayKey)) return false;
    if (!preferred || !preferred.length) return true;
    const dow = weekdayIndex(dayKey, constraints.tz);
    return preferred.includes(dow);
  });
}

function weekKeyFromDayKey(dayKey: string, timeZone: string) {
  const dow = weekdayIndex(dayKey, timeZone);
  const offset = (dow + 6) % 7; // Monday start
  return addDays(dayKey, -offset, timeZone);
}

function largestRemainderAllocate(total: number, weights: number[]) {
  const sum = weights.reduce((acc, v) => acc + v, 0);
  if (!sum || total <= 0) return weights.map(() => 0);
  const raw = weights.map((w) => (w / sum) * total);
  const floors = raw.map((v) => Math.floor(v));
  let remainder = total - floors.reduce((acc, v) => acc + v, 0);
  const order = raw
    .map((v, idx) => ({ idx, frac: v - floors[idx] }))
    .sort((a, b) => b.frac - a.frac || a.idx - b.idx);
  const result = [...floors];
  let i = 0;
  while (remainder > 0 && i < order.length) {
    result[order[i].idx] += 1;
    remainder -= 1;
    i += 1;
  }
  return result;
}

function allocateFlat(dayKeys: string[], totalBlocks: number): Record<string, number> {
  const base = Math.floor(totalBlocks / dayKeys.length);
  let remainder = totalBlocks - base * dayKeys.length;
  const forecast: Record<string, number> = {};
  dayKeys.forEach((dayKey) => {
    forecast[dayKey] = base + (remainder > 0 ? 1 : 0);
    if (remainder > 0) remainder -= 1;
  });
  return forecast;
}

function allocateRamp(dayKeys: string[], totalBlocks: number) {
  const weights = dayKeys.map((_, idx) => 0.5 + (idx / Math.max(1, dayKeys.length - 1)));
  const allocation = largestRemainderAllocate(totalBlocks, weights);
  const forecast: Record<string, number> = {};
  dayKeys.forEach((dayKey, idx) => {
    forecast[dayKey] = allocation[idx] || 0;
  });
  return forecast;
}

function allocateWave(dayKeys: string[], totalBlocks: number, timeZone: string) {
  const weekKeys = dayKeys.map((k) => weekKeyFromDayKey(k, timeZone));
  const uniqueWeeks = Array.from(new Set(weekKeys));
  const weights = uniqueWeeks.map((_, idx) => (idx % 4 === 3 ? 0.5 : 1));
  const weekAlloc = largestRemainderAllocate(totalBlocks, weights);
  const forecast: Record<string, number> = {};
  uniqueWeeks.forEach((weekKey, idx) => {
    const days = dayKeys.filter((k, i) => weekKeys[i] === weekKey);
    const perDay = allocateFlat(days, weekAlloc[idx] || 0);
    Object.assign(forecast, perDay);
  });
  return forecast;
}

function allocateQuarterMilestones(dayKeys: string[], totalBlocks: number, timeZone: string) {
  const quarterStarts = new Map<string, string>();
  dayKeys.forEach((dayKey) => {
    const month = Number(dayKey.slice(5, 7));
    const year = dayKey.slice(0, 4);
    const q = Math.floor((month - 1) / 3) + 1;
    quarterStarts.set(`${year}-Q${q}`, `${year}-${String((q - 1) * 3 + 1).padStart(2, '0')}-01`);
  });
  const quarterKeys = Array.from(quarterStarts.keys()).sort();
  const perQuarter = largestRemainderAllocate(totalBlocks, quarterKeys.map(() => 1));
  const forecast: Record<string, number> = {};
  quarterKeys.forEach((qKey, idx) => {
    const monthStart = quarterStarts.get(qKey) as string;
    const quarterMonths = [0, 1, 2].map((offset) => {
      const month = Number(monthStart.slice(5, 7)) + offset;
      const year = monthStart.slice(0, 4);
      const mm = String(month).padStart(2, '0');
      return `${year}-${mm}`;
    });
    const quarterDays = dayKeys.filter((k) => quarterMonths.includes(k.slice(0, 7)));
    Object.assign(forecast, allocateFlat(quarterDays, perQuarter[idx] || 0));
  });
  return forecast;
}

function applyCaps(dayKeys: string[], forecast: Record<string, number>, constraints: StrategyV1['constraints']) {
  const maxPerDay = constraints?.maxBlocksPerDay;
  const maxPerWeek = constraints?.maxBlocksPerWeek;
  if (!maxPerDay && !maxPerWeek) return { infeasible: null };
  let infeasible = null;
  if (maxPerWeek) {
    const weeklyCounts: Record<string, number> = {};
    dayKeys.forEach((d) => {
      const weekKey = weekKeyFromDayKey(d, constraints.tz);
      weeklyCounts[weekKey] = (weeklyCounts[weekKey] || 0) + (forecast[d] || 0);
    });
    const violations = Object.values(weeklyCounts).filter((c) => c > maxPerWeek);
    if (violations.length) {
      infeasible = {
        reason: 'maxBlocksPerWeek',
        requiredCapacityPerWeek: Math.max(...violations),
        availableCapacityPerWeek: maxPerWeek
      };
    }
  }
  if (!infeasible && maxPerDay) {
    const violations = dayKeys.filter((d) => (forecast[d] || 0) > maxPerDay);
    if (violations.length) {
      infeasible = {
        reason: 'maxBlocksPerDay',
        requiredCapacityPerWeek: Math.max(...violations.map((d) => forecast[d] || 0)),
        availableCapacityPerWeek: maxPerDay
      };
    }
  }
  return { infeasible };
}

export function allocateByRouteOption({
  routeOption,
  dayKeys,
  totalBlocks,
  constraints
}: {
  routeOption: RouteOption;
  dayKeys: string[];
  totalBlocks: number;
  constraints: StrategyV1['constraints'];
}): RouteAllocation {
  if (!dayKeys.length || totalBlocks <= 0) return { forecastByDayKey: {} };
  let forecast: Record<string, number> = {};
  if (routeOption === 'RAMP_UP') {
    forecast = allocateRamp(dayKeys, totalBlocks);
  } else if (routeOption === 'MILESTONE_QUARTERS') {
    forecast = allocateQuarterMilestones(dayKeys, totalBlocks, constraints.tz);
  } else if (routeOption === 'WAVE_3_1') {
    forecast = allocateWave(dayKeys, totalBlocks, constraints.tz);
  } else {
    forecast = allocateFlat(dayKeys, totalBlocks);
  }
  const capCheck = applyCaps(dayKeys, forecast, constraints);
  return { forecastByDayKey: forecast, infeasible: capCheck.infeasible || undefined };
}

export function allocateDeliverables(
  forecastByDayKey: Record<string, number>,
  deliverables: StrategyDeliverable[]
): Record<string, ColdPlanForecast> {
  const safeDeliverables = normalizeDeliverables(deliverables);
  const totalRequired = safeDeliverables.reduce((sum, d) => sum + d.requiredBlocks, 0);
  if (!totalRequired) {
    return Object.fromEntries(Object.entries(forecastByDayKey).map(([k, v]) => [k, { totalBlocks: v }]));
  }
  const result: Record<string, ColdPlanForecast> = {};
  Object.entries(forecastByDayKey).forEach(([dayKey, totalBlocks]) => {
    const byDeliverable: Record<string, number> = {};
    if (totalBlocks <= 0) {
      result[dayKey] = { totalBlocks: 0, byDeliverable };
      return;
    }
    const weights = safeDeliverables.map((d) => d.requiredBlocks);
    const allocation = largestRemainderAllocate(totalBlocks, weights);
    safeDeliverables.forEach((d, idx) => {
      byDeliverable[d.id] = allocation[idx] || 0;
    });
    result[dayKey] = { totalBlocks, byDeliverable };
  });
  return result;
}

export function generateColdPlan({
  cycleStartISO,
  nowISO,
  strategy,
  completedCountToDate,
  rebaseMode
}: GenerateColdPlanInput): ColdPlanV1 {
  const normalizedRoute = normalizeRouteOption(strategy.routeOption);
  const deliverables = normalizeDeliverables(strategy.deliverables);
  const totalRequired = deliverables.reduce((sum, d) => sum + d.requiredBlocks, 0);
  const startKey = rebaseMode === 'REMAINING_FROM_TODAY'
    ? dayKeyFromISO(nowISO, strategy.constraints.tz)
    : dayKeyFromISO(cycleStartISO, strategy.constraints.tz);
  const endKey = dayKeyFromISO(strategy.deadlineISO, strategy.constraints.tz);
  const dayKeys = filterWorkableDays(daysBetween(startKey, endKey, strategy.constraints.tz), strategy.constraints);
  const remaining = rebaseMode === 'REMAINING_FROM_TODAY'
    ? Math.max(0, totalRequired - Math.max(0, completedCountToDate || 0))
    : totalRequired;
  const { forecastByDayKey, infeasible } = allocateByRouteOption({
    routeOption: normalizedRoute,
    dayKeys,
    totalBlocks: remaining,
    constraints: strategy.constraints
  });
  const forecastByDayKeyWithDeliverables = allocateDeliverables(forecastByDayKey, deliverables);
  return {
    version: 1,
    generatorVersion: DEFAULT_GENERATOR_VERSION,
    strategyId: strategy.strategyId,
    assumptionsHash: strategy.assumptionsHash,
    createdAtISO: nowISO,
    forecastByDayKey: forecastByDayKeyWithDeliverables,
    infeasible: infeasible || undefined
  };
}

export function generateDailyProjection({
  nowISO,
  strategy,
  completedCountToDate,
  coldPlanVersion
}: {
  nowISO: string;
  strategy: StrategyV1;
  completedCountToDate: number;
  coldPlanVersion: number;
}): ColdPlanDailyProjection {
  const plan = generateColdPlan({
    cycleStartISO: nowISO,
    nowISO,
    strategy,
    completedCountToDate,
    rebaseMode: 'REMAINING_FROM_TODAY'
  });
  const asOfDayKey = dayKeyFromISO(nowISO, strategy.constraints.tz);
  const totalRequired = strategy.deliverables.reduce((sum, d) => sum + (d.requiredBlocks || 0), 0);
  const remainingRequiredBlocks = Math.max(0, totalRequired - Math.max(0, completedCountToDate || 0));
  return {
    asOfDayKey,
    remainingRequiredBlocks,
    generatorVersion: DEFAULT_GENERATOR_VERSION,
    derivedFrom: {
      strategyId: strategy.strategyId,
      assumptionsHash: strategy.assumptionsHash,
      coldPlanVersion
    },
    forecastByDayKey: plan.forecastByDayKey,
    infeasible: plan.infeasible
  };
}

export function buildDefaultStrategy({
  goalId,
  deadlineISO,
  timeZone,
  deliverables
}: {
  goalId: string;
  deadlineISO: string;
  timeZone: string;
  deliverables: StrategyDeliverable[];
}): StrategyV1 {
  const strategyId = `strategy-${goalId}`;
  const strategy: StrategyV1 = {
    strategyId,
    generatorVersion: DEFAULT_GENERATOR_VERSION,
    routeOption: 'FLAT',
    deliverables: normalizeDeliverables(deliverables),
    deadlineISO,
    constraints: {
      tz: timeZone
    },
    assumptionsHash: ''
  };
  strategy.assumptionsHash = buildAssumptionsHash(strategy);
  return strategy;
}
