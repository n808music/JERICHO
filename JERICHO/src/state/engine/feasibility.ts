import { addDays, dayKeyFromISO } from '../time/time.ts';

type WorkItem = {
  workItemId: string;
  title?: string;
  blocksTotal?: number;
  blocksRemaining: number;
  mustFinishByISO?: string;
  category?: string;
  focusMode?: string;
  energyCost?: string;
  dependencies?: string[];
};

type Constraints = {
  timezone: string;
  workableDayPolicy?: {
    weekdays?: Array<number | string>;
  };
  blackoutDates?: string[];
  maxBlocksPerDay?: number;
  maxHighEnergyBlocksPerDay?: number;
  maxDeepBlocksPerDay?: number;
  dailyCapacityOverrides?: Record<string, number>;
  calendarCommittedBlocksByDate?: Record<string, number>;
};

type FeasibilityResult = {
  goalId: string;
  nowISO: string;
  deadlineISO: string;
  status: 'FEASIBLE' | 'REQUIRED' | 'INFEASIBLE';
  reasons: string[];
  remainingBlocksTotal: number;
  workableDaysRemaining: number;
  requiredBlocksPerDay: number | null;
  requiredBlocksToday: number | null;
  completedBlocksToday: number;
  delta: {
    blocksShort?: number;
    extraBlocksPerDayNeeded?: number;
  };
  subDeadlines?: Array<{
    mustFinishByISO: string;
    remainingBlocks: number;
    workableDaysRemaining: number;
    requiredBlocksPerDay: number;
  }>;
  debug?: {
    todayLocalDate: string;
    deadlineLocalDate: string;
    dailyCapacitySchedule: Record<string, number>;
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

export function computeFeasibility(goal: { goalId: string; deadlineISO: string }, state: any, constraints: Constraints, nowISO: string): FeasibilityResult {
  const timezone = constraints?.timezone || 'UTC';
  const todayLocalDate = dayKeyFromISO(nowISO, timezone);
  const deadlineLocalDate = dayKeyFromISO(goal.deadlineISO, timezone);
  const workItems: WorkItem[] = (state?.goalWorkById && state.goalWorkById[goal.goalId]) || [];
  const remainingBlocksTotal = workItems.reduce((sum, item) => sum + Math.max(0, Number(item?.blocksRemaining) || 0), 0);

  if (goal.deadlineISO <= nowISO) {
    if (remainingBlocksTotal > 0) {
      return {
        goalId: goal.goalId,
        nowISO,
        deadlineISO: goal.deadlineISO,
        status: 'INFEASIBLE',
        reasons: ['DEADLINE_PASSED'],
        remainingBlocksTotal,
        workableDaysRemaining: 0,
        requiredBlocksPerDay: null,
        requiredBlocksToday: null,
        completedBlocksToday: 0,
        delta: {}
      };
    }
    return {
      goalId: goal.goalId,
      nowISO,
      deadlineISO: goal.deadlineISO,
      status: 'FEASIBLE',
      reasons: ['GOAL_HAS_NO_REMAINING_WORK'],
      remainingBlocksTotal,
      workableDaysRemaining: 0,
      requiredBlocksPerDay: 0,
      requiredBlocksToday: 0,
      completedBlocksToday: 0,
      delta: {}
    };
  }

  if (!remainingBlocksTotal) {
    return {
      goalId: goal.goalId,
      nowISO,
      deadlineISO: goal.deadlineISO,
      status: 'FEASIBLE',
      reasons: ['GOAL_HAS_NO_REMAINING_WORK'],
      remainingBlocksTotal: 0,
      workableDaysRemaining: 0,
      requiredBlocksPerDay: 0,
      requiredBlocksToday: 0,
      completedBlocksToday: 0,
      delta: {}
    };
  }

  const dailyCapacitySchedule = buildDailyCapacitySchedule(todayLocalDate, deadlineLocalDate, constraints, timezone);
  const dates = Object.keys(dailyCapacitySchedule).sort();
  const totalRemainingCapacity = dates.reduce((sum, d) => sum + (dailyCapacitySchedule[d] || 0), 0);
  const workableDaysRemaining = dates.filter((d) => (dailyCapacitySchedule[d] || 0) > 0).length;
  const completedBlocksToday = countCompletedBlocksForDate(state, goal.goalId, todayLocalDate);

  const reasons: string[] = [];
  const delta: FeasibilityResult['delta'] = {};
  let status: FeasibilityResult['status'] = 'FEASIBLE';

  if (workableDaysRemaining === 0) {
    return {
      goalId: goal.goalId,
      nowISO,
      deadlineISO: goal.deadlineISO,
      status: 'INFEASIBLE',
      reasons: ['NO_WORKABLE_DAYS'],
      remainingBlocksTotal,
      workableDaysRemaining,
      requiredBlocksPerDay: null,
      requiredBlocksToday: null,
      completedBlocksToday,
      delta: {},
      debug: {
        todayLocalDate,
        deadlineLocalDate,
        dailyCapacitySchedule
      }
    };
  }

  const requiredBlocksPerDay = Math.ceil(remainingBlocksTotal / workableDaysRemaining);
  const todayCapacity = dailyCapacitySchedule[todayLocalDate] || 0;
  if (todayCapacity === 0) {
    reasons.push('TODAY_CAPACITY_ZERO');
    if (!isWorkableDate(todayLocalDate, constraints, timezone)) {
      reasons.push('TODAY_NOT_WORKABLE');
    }
  }

  if (totalRemainingCapacity < remainingBlocksTotal) {
    const deficit = remainingBlocksTotal - totalRemainingCapacity;
    delta.blocksShort = deficit;
    delta.extraBlocksPerDayNeeded = Math.ceil(deficit / workableDaysRemaining);
    reasons.push('INSUFFICIENT_CAPACITY');
    status = 'INFEASIBLE';
  }

  const requiredBlocksToday = Math.max(0, requiredBlocksPerDay - completedBlocksToday);
  if (status !== 'INFEASIBLE') {
    if (requiredBlocksToday > 0) {
      reasons.push('BEHIND_REQUIRED_PACE');
      status = 'REQUIRED';
    } else {
      reasons.push('OK');
      status = 'FEASIBLE';
    }
  }

  const subDeadlines = computeSubDeadlines(workItems, todayLocalDate, deadlineLocalDate, constraints, timezone, dailyCapacitySchedule);
  if (subDeadlines.some((d) => d.requiredBlocksPerDay > d.workableDaysRemaining || d.workableDaysRemaining === 0)) {
    if (!reasons.includes('SUBDEADLINE_INFEASIBLE')) reasons.push('SUBDEADLINE_INFEASIBLE');
    status = 'INFEASIBLE';
  }

  return {
    goalId: goal.goalId,
    nowISO,
    deadlineISO: goal.deadlineISO,
    status,
    reasons,
    remainingBlocksTotal,
    workableDaysRemaining,
    requiredBlocksPerDay,
    requiredBlocksToday,
    completedBlocksToday,
    delta,
    subDeadlines: subDeadlines.length ? subDeadlines : undefined,
    debug: {
      todayLocalDate,
      deadlineLocalDate,
      dailyCapacitySchedule
    }
  };
}

function buildDailyCapacitySchedule(startDate: string, endDate: string, constraints: Constraints, timezone: string) {
  const schedule: Record<string, number> = {};
  let cursor = startDate;
  while (cursor <= endDate) {
    const base = Number.isFinite(constraints?.dailyCapacityOverrides?.[cursor])
      ? Number(constraints.dailyCapacityOverrides?.[cursor])
      : Number(constraints?.maxBlocksPerDay || 0);
    const committed = Number(constraints?.calendarCommittedBlocksByDate?.[cursor] || 0);
    const workable = isWorkableDate(cursor, constraints, timezone);
    const net = workable ? Math.max(0, base - committed) : 0;
    schedule[cursor] = net;
    cursor = addDays(cursor, 1, timezone);
  }
  return schedule;
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

function countCompletedBlocksForDate(state: any, goalId: string, dateKey: string) {
  const events = state?.executionEvents || [];
  return events.filter((e: any) => e?.goalId === goalId && e?.completed && e?.dateISO === dateKey).length;
}

function computeSubDeadlines(
  items: WorkItem[],
  startDate: string,
  endDate: string,
  constraints: Constraints,
  timezone: string,
  dailyCapacitySchedule: Record<string, number>
) {
  const groups: Record<string, number> = {};
  items.forEach((item) => {
    if (!item?.mustFinishByISO) return;
    const subDate = dayKeyFromISO(item.mustFinishByISO, timezone);
    if (subDate > endDate) return;
    const remaining = Math.max(0, Number(item.blocksRemaining) || 0);
    if (remaining <= 0) return;
    groups[subDate] = (groups[subDate] || 0) + remaining;
  });
  return Object.entries(groups).map(([mustFinishByISO, remainingBlocks]) => {
    const schedule = buildDailyCapacitySchedule(startDate, mustFinishByISO, constraints, timezone);
    const workableDaysRemaining = Object.values(schedule).filter((v) => v > 0).length;
    const requiredBlocksPerDay = workableDaysRemaining > 0 ? Math.ceil(remainingBlocks / workableDaysRemaining) : remainingBlocks;
    return {
      mustFinishByISO,
      remainingBlocks,
      workableDaysRemaining,
      requiredBlocksPerDay
    };
  });
}
