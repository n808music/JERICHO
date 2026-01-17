import { addDays, buildLocalStartISO, dayKeyFromISO, nowDayKey } from '../time/time.ts';

type Constraints = {
  timezone: string;
  maxBlocksPerDay?: number;
  maxBlocksPerWeek?: number;
  minSessionMinutes?: number;
  workingHoursWindows?: TimeWindow[];
  forbiddenTimeWindows?: TimeWindow[];
  forbiddenDayKeys?: string[];
  workableDayPolicy?: { weekdays?: Array<number | string> };
  blackoutDates?: string[];
  calendarCommittedBlocksByDate?: Record<string, number>;
};

type PlanProof = {
  workableDaysRemaining: number;
  totalRequiredUnits: number;
  requiredPacePerDay: number;
  maxPerDay: number;
  maxPerWeek: number;
  slackUnits: number;
  slackRatio: number;
  intensityRatio: number;
};

type AutoAsanaPlan = {
  graph: { tasks: any[]; dependencies: any[]; milestones: any[] };
  horizon: { startDayKey: string; endDayKey: string; daysCount: number };
  horizonBlocks: Array<{
    id: string;
    dayKey: string;
    startISO: string;
    durationMinutes: number;
    kind: string;
    title: string;
  }>;
  conflicts: { kind: string; detail: string; candidateResolutions?: string[] }[];
  recoveryOptions: { kind: string; detail: string }[];
  audit: { generatedAtISO: string; goalId: string; cycleId: string; policyVersion: string };
};

type TimeWindow = { startMin: number; endMin: number };

const WEEKDAY_MAP: Record<string, number> = {
  sun: 0,
  mon: 1,
  tue: 2,
  wed: 3,
  thu: 4,
  fri: 5,
  sat: 6
};

export function compileAutoAsanaPlan({
  goalId,
  cycleId,
  planProof,
  constraints,
  nowISO,
  horizonDays = 14,
  acceptedBlocks = []
}: {
  goalId: string;
  cycleId: string;
  planProof: PlanProof;
  constraints: Constraints;
  nowISO: string;
  horizonDays?: number;
  acceptedBlocks?: Array<{ id: string; startISO: string; durationMinutes: number }>;
}): AutoAsanaPlan {
  const timeZone = constraints?.timezone || 'UTC';
  const startDayKey = dayKeyFromISO(nowISO, timeZone) || nowDayKey(timeZone);
  const endDayKey = addDays(startDayKey, Math.max(0, horizonDays - 1), timeZone);
  const dayKeys = collectHorizonDays(startDayKey, endDayKey, constraints, timeZone);

  const maxPerDay = Math.max(0, Number.isFinite(planProof?.maxPerDay) ? Number(planProof.maxPerDay) : 0);
  const requiredPerDay = Math.max(0, Math.ceil(planProof?.requiredPacePerDay || 0));
  const plannedPerDay = Math.min(maxPerDay || requiredPerDay, requiredPerDay || maxPerDay || 0);

  const schedule = scheduleHorizonBlocks({
    dayKeys,
    plannedPerDay,
    timeZone,
    cycleId,
    constraints,
    acceptedBlocks
  });

  const conflicts: AutoAsanaPlan['conflicts'] = schedule.conflicts;
  const recoveryOptions: AutoAsanaPlan['recoveryOptions'] = schedule.recoveryOptions;
  if (maxPerDay && requiredPerDay > maxPerDay) {
    conflicts.push({
      kind: 'UNSCHEDULABLE',
      code: 'EXCEEDS_MAX_PER_DAY',
      detail: `Required ${requiredPerDay} blocks/day exceeds max ${maxPerDay}.`,
      candidateResolutions: ['INCREASE_MAX_PER_DAY', 'EXTEND_DEADLINE', 'REDUCE_SCOPE']
    });
  }

  if (planProof?.maxPerWeek && requiredPerDay * 7 > planProof.maxPerWeek) {
    conflicts.push({
      kind: 'UNSCHEDULABLE',
      code: 'EXCEEDS_MAX_PER_WEEK',
      detail: `Required ${requiredPerDay * 7} blocks/week exceeds max ${planProof.maxPerWeek}.`,
      candidateResolutions: ['INCREASE_MAX_PER_WEEK', 'EXTEND_DEADLINE', 'REDUCE_SCOPE']
    });
  }

  if (!dayKeys.length) {
    conflicts.push({
      kind: 'UNSCHEDULABLE',
      code: 'NO_WORKABLE_DAYS',
      detail: 'No workable days in horizon under current constraints.',
      candidateResolutions: ['REMOVE_BLACKOUTS', 'ADJUST_WORKABLE_DAYS']
    });
  }

  if (conflicts.length) {
    recoveryOptions.push({ kind: 'ADJUST_CONSTRAINTS', detail: 'Increase capacity or widen workable days.' });
  }

  const graph = buildProjectGraph(goalId, planProof);

  return {
    graph,
    horizon: {
      startDayKey,
      endDayKey,
      daysCount: dayKeys.length
    },
    horizonBlocks: schedule.placed,
    conflicts,
    recoveryOptions,
    audit: {
      generatedAtISO: nowISO,
      goalId,
      cycleId,
      policyVersion: 'auto_asana_v1.1'
    }
  };
}

function collectHorizonDays(startDayKey: string, endDayKey: string, constraints: Constraints, timeZone: string) {
  const days: string[] = [];
  let cursor = startDayKey;
  let guard = 0;
  while (cursor <= endDayKey && guard < 5000) {
    if (isWorkableDate(cursor, constraints, timeZone)) days.push(cursor);
    const next = addDays(cursor, 1, timeZone);
    if (!next || next === cursor) break;
    cursor = next;
    guard += 1;
  }
  return days;
}

function buildProjectGraph(goalId: string, planProof: PlanProof) {
  const tasks = [
    {
      id: `task-${goalId}-execution`,
      title: 'Execution',
      requiredUnits: planProof?.totalRequiredUnits || 0
    }
  ];
  const milestones = [
    {
      id: `milestone-${goalId}-deadline`,
      title: 'Deadline',
      targetUnits: planProof?.totalRequiredUnits || 0
    }
  ];
  return {
    tasks,
    dependencies: [],
    milestones
  };
}

function isWorkableDate(dateKey: string, constraints: Constraints, timeZone: string) {
  if (!dateKey) return false;
  const blackout = new Set([...(constraints?.blackoutDates || []), ...(constraints?.forbiddenDayKeys || [])]);
  if (blackout.has(dateKey)) return false;
  const weekdays = normalizeWeekdays(constraints?.workableDayPolicy?.weekdays);
  if (!weekdays) return true;
  const weekday = weekdayIndex(dateKey, timeZone);
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

function pad2(value: number) {
  return `${value}`.padStart(2, '0');
}

function scheduleHorizonBlocks({
  dayKeys,
  plannedPerDay,
  timeZone,
  cycleId,
  constraints,
  acceptedBlocks
}: {
  dayKeys: string[];
  plannedPerDay: number;
  timeZone: string;
  cycleId: string;
  constraints: Constraints;
  acceptedBlocks: Array<{ id: string; startISO: string; durationMinutes: number }>;
}) {
  const placed: Array<{ id: string; dayKey: string; startISO: string; durationMinutes: number; kind: string; title: string }> = [];
  const conflicts: AutoAsanaPlan['conflicts'] = [];
  const recoveryOptions: AutoAsanaPlan['recoveryOptions'] = [];
  if (!plannedPerDay || !dayKeys.length) {
    return { placed, conflicts, recoveryOptions };
  }

  const durationMinutes = Math.max(15, constraints?.minSessionMinutes || 60);
  const allowedBase = normalizeWindows(constraints?.workingHoursWindows || [{ startMin: 0, endMin: 1440 }]);
  const forbidden = normalizeWindows(constraints?.forbiddenTimeWindows || []);
  const existingBusy = busyFromAcceptedBlocks(acceptedBlocks, timeZone);

  const dailyCounts: Record<string, number> = {};
  const weeklyCounts: Record<string, number> = {};
  acceptedBlocks.forEach((block) => {
    const dayKey = dayKeyFromISO(block.startISO, timeZone);
    dailyCounts[dayKey] = (dailyCounts[dayKey] || 0) + 1;
    const weekKey = weekKeyForDay(dayKey);
    weeklyCounts[weekKey] = (weeklyCounts[weekKey] || 0) + 1;
  });

  const requiredDrafts = buildRequiredDrafts(dayKeys, plannedPerDay, cycleId, durationMinutes);

  requiredDrafts.forEach((draft) => {
    const slot = findSlotForDraft({
      draft,
      dayKeys,
      timeZone,
      allowedBase,
      forbidden,
      existingBusy,
      placed,
      dailyCounts,
      weeklyCounts,
      constraints
    });
    if (!slot) {
      conflicts.push({
        kind: 'UNSCHEDULABLE',
        code: draft.failCode || 'UNSCHEDULABLE',
        detail: { blockId: draft.id, dayKey: draft.failDayKey, attemptedDays: dayKeys.length },
        candidateResolutions: draft.recoveryOptions || []
      });
      (draft.recoveryOptions || []).forEach((opt) => {
        if (!recoveryOptions.find((r) => r.kind === opt.kind && r.detail === opt.detail)) {
          recoveryOptions.push(opt);
        }
      });
      return;
    }
    placed.push({
      id: draft.id,
      dayKey: slot.dayKey,
      startISO: slot.startISO,
      durationMinutes: draft.durationMinutes,
      kind: 'EXECUTION',
      title: 'Auto Asana Execution'
    });
    dailyCounts[slot.dayKey] = (dailyCounts[slot.dayKey] || 0) + 1;
    const weekKey = weekKeyForDay(slot.dayKey);
    weeklyCounts[weekKey] = (weeklyCounts[weekKey] || 0) + 1;
  });

  return { placed, conflicts, recoveryOptions };
}

function buildRequiredDrafts(dayKeys: string[], plannedPerDay: number, cycleId: string, durationMinutes: number) {
  const drafts: Array<{ id: string; durationMinutes: number; targetDayKey: string; failCode?: string; failDayKey?: string; recoveryOptions?: any[] }> = [];
  dayKeys.forEach((dayKey) => {
    for (let idx = 0; idx < plannedPerDay; idx += 1) {
      drafts.push({
        id: `blk-auto-${cycleId}-${dayKey}-${idx}`,
        durationMinutes,
        targetDayKey: dayKey
      });
    }
  });
  return drafts;
}

function findSlotForDraft({
  draft,
  dayKeys,
  timeZone,
  allowedBase,
  forbidden,
  existingBusy,
  placed,
  dailyCounts,
  weeklyCounts,
  constraints
}: {
  draft: any;
  dayKeys: string[];
  timeZone: string;
  allowedBase: TimeWindow[];
  forbidden: TimeWindow[];
  existingBusy: Record<string, TimeWindow[]>;
  placed: Array<{ dayKey: string; startISO: string; durationMinutes: number }>;
  dailyCounts: Record<string, number>;
  weeklyCounts: Record<string, number>;
  constraints: Constraints;
}) {
  const maxPerDay = Number.isFinite(constraints?.maxBlocksPerDay) ? Number(constraints.maxBlocksPerDay) : Infinity;
  const maxPerWeek = Number.isFinite(constraints?.maxBlocksPerWeek) ? Number(constraints.maxBlocksPerWeek) : Infinity;
  const step = 15;
  let foundAnyWindows = false;
  let overlapOnly = true;

  for (const dayKey of dayKeys) {
    const allowed = subtractWindows(allowedBase, forbidden);
    if (!allowed.length) continue;
    foundAnyWindows = true;
    const dayBusy = [
      ...(existingBusy[dayKey] || []),
      ...busyFromPlaced(placed, dayKey, timeZone)
    ];
    const weekKey = weekKeyForDay(dayKey);
    if ((dailyCounts[dayKey] || 0) + 1 > maxPerDay) {
      draft.failCode = 'EXCEEDS_MAX_PER_DAY';
      draft.failDayKey = dayKey;
      draft.recoveryOptions = [{ kind: 'INCREASE_MAX_PER_DAY', detail: `Increase max per day above ${maxPerDay}.` }];
      continue;
    }
    if ((weeklyCounts[weekKey] || 0) + 1 > maxPerWeek) {
      draft.failCode = 'EXCEEDS_MAX_PER_WEEK';
      draft.failDayKey = dayKey;
      draft.recoveryOptions = [{ kind: 'INCREASE_MAX_PER_WEEK', detail: `Increase max per week above ${maxPerWeek}.` }];
      continue;
    }
    for (const window of allowed) {
      for (let startMin = window.startMin; startMin + draft.durationMinutes <= window.endMin; startMin += step) {
        const candidate = { startMin, endMin: startMin + draft.durationMinutes };
        if (!overlapsAny(candidate, dayBusy)) {
          overlapOnly = false;
          const startISO = buildLocalStartISO(dayKey, minutesToTime(startMin), timeZone).startISO;
          if (!startISO) continue;
          return { dayKey, startISO };
        }
      }
    }
  }

  if (!foundAnyWindows) {
    draft.failCode = 'NO_ALLOWED_WINDOWS';
    draft.recoveryOptions = [{ kind: 'RELAX_WORKING_HOURS', detail: 'Add working-hour windows.' }];
  } else if (overlapOnly) {
    draft.failCode = 'OVERLAP_ALL_SLOTS';
    draft.recoveryOptions = [{ kind: 'EXTEND_HORIZON', detail: 'Extend horizon to find free slots.' }];
  } else if (!draft.failCode) {
    draft.failCode = 'UNSCHEDULABLE';
    draft.recoveryOptions = [{ kind: 'EXTEND_HORIZON', detail: 'Extend horizon or reduce sessions.' }];
  }
  return null;
}

function normalizeWindows(windows: TimeWindow[]) {
  if (!windows || !windows.length) return [];
  const cleaned = windows
    .map((w) => ({
      startMin: Math.max(0, Math.min(1440, Math.floor(w.startMin))),
      endMin: Math.max(0, Math.min(1440, Math.floor(w.endMin)))
    }))
    .filter((w) => w.endMin > w.startMin)
    .sort((a, b) => a.startMin - b.startMin);
  const merged: TimeWindow[] = [];
  cleaned.forEach((w) => {
    const last = merged[merged.length - 1];
    if (!last || w.startMin > last.endMin) {
      merged.push({ ...w });
    } else {
      last.endMin = Math.max(last.endMin, w.endMin);
    }
  });
  return merged;
}

function subtractWindows(allowed: TimeWindow[], forbidden: TimeWindow[]) {
  if (!forbidden.length) return [...allowed];
  const result: TimeWindow[] = [];
  allowed.forEach((base) => {
    let segments = [{ ...base }];
    forbidden.forEach((block) => {
      segments = segments.flatMap((seg) => {
        if (block.endMin <= seg.startMin || block.startMin >= seg.endMin) return [seg];
        const parts: TimeWindow[] = [];
        if (block.startMin > seg.startMin) parts.push({ startMin: seg.startMin, endMin: block.startMin });
        if (block.endMin < seg.endMin) parts.push({ startMin: block.endMin, endMin: seg.endMin });
        return parts;
      });
    });
    segments.forEach((seg) => result.push(seg));
  });
  return normalizeWindows(result);
}

function overlapsAny(candidate: TimeWindow, busy: TimeWindow[]) {
  return busy.some((b) => candidate.startMin < b.endMin && candidate.endMin > b.startMin);
}

function busyFromAcceptedBlocks(blocks: Array<{ startISO: string; durationMinutes: number }>, timeZone: string) {
  const byDay: Record<string, TimeWindow[]> = {};
  (blocks || []).forEach((block) => {
    const dayKey = dayKeyFromISO(block.startISO, timeZone);
    const startMin = minutesFromISO(block.startISO, timeZone);
    const endMin = startMin + (block.durationMinutes || 0);
    if (!byDay[dayKey]) byDay[dayKey] = [];
    byDay[dayKey].push({ startMin, endMin });
  });
  Object.keys(byDay).forEach((dayKey) => {
    byDay[dayKey] = normalizeWindows(byDay[dayKey]);
  });
  return byDay;
}

function busyFromPlaced(placed: Array<{ dayKey: string; startISO: string; durationMinutes: number }>, dayKey: string, timeZone: string) {
  return (placed || [])
    .filter((b) => b.dayKey === dayKey)
    .map((b) => {
      const startMin = minutesFromISO(b.startISO, timeZone);
      return { startMin, endMin: startMin + (b.durationMinutes || 0) };
    });
}

function minutesFromISO(iso: string, timeZone: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return 0;
  const parts = new Intl.DateTimeFormat('en-US', { timeZone, hour: '2-digit', minute: '2-digit', hour12: false }).formatToParts(date);
  const map: Record<string, string> = {};
  parts.forEach((p) => {
    if (p.type !== 'literal') map[p.type] = p.value;
  });
  const hours = Number(map.hour || 0);
  const minutes = Number(map.minute || 0);
  return hours * 60 + minutes;
}

function minutesToTime(minutes: number) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${pad2(h)}:${pad2(m)}`;
}

function weekKeyForDay(dayKey: string) {
  const [year, month, day] = dayKey.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  const oneJan = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((date.getTime() - oneJan.getTime()) / 86400000 + oneJan.getUTCDay() + 1) / 7);
  return `${date.getUTCFullYear()}-W${week}`;
}
