import { PRACTICE_KEYS, UNKNOWN_KEY, UnknownPolicy, PlanSource } from './metricsPolicy.js';
import { addDays as addDaysInTimeZone, dayKeyFromISO as dayKeyFromISOInTimeZone } from './time/time.ts';

// Canonical metrics helpers to keep completion/integrity math consistent across views.
// All calculations are deterministic, bounded, and use Chicago day keys.

const DAY_MS = 24 * 60 * 60 * 1000;

const dayKeyFromISO = (iso = '') => dayKeyFromISOInTimeZone(iso);

const clamp = (value, min = 0, max = 1440) => {
  if (!Number.isFinite(value)) return 0;
  return Math.min(max, Math.max(min, value));
};

export function normalizeBlocks(blocks = []) {
  return (blocks || []).map((b) => {
    const startMs = Date.parse(b.start || '');
    const endMs = Date.parse(b.end || '');
    const raw = Number.isFinite(startMs) && Number.isFinite(endMs) ? (endMs - startMs) / 60000 : 0;
    const durationMin = clamp(raw);
    const plannedMinutes = durationMin;
    const completedMinutes = b.status === 'completed' ? plannedMinutes : 0;
    const practiceKey = PRACTICE_KEYS.includes(b.practice)
      ? b.practice
      : PRACTICE_KEYS.includes(b.category)
      ? b.category
      : UNKNOWN_KEY;
    return {
      ...b,
      id: `${b.id}`,
      start: b.start,
      durationMin,
      practiceKey,
      plannedMinutes,
      completedMinutes
    };
  });
}

export function windowFilter(window, block) {
  const blockDayKey = dayKeyFromISO(block.start);
  const { startDayKey, endDayKeyExclusive, includeDayKeys } = window;
  const inRange = (!startDayKey || blockDayKey >= startDayKey) && (!endDayKeyExclusive || blockDayKey < endDayKeyExclusive);
  const inList = !includeDayKeys || includeDayKeys.has(blockDayKey);
  if (inRange && inList) return { included: true, reason: 'IN_WINDOW' };
  if (includeDayKeys && !inList) return { included: false, reason: 'PADDED_DAY_EXCLUDED' };
  return { included: false, reason: 'OUT_OF_WINDOW' };
}

export function computeWindowMetrics({ blocks = [], window, mode = 'calendar', planSource = PlanSource.SCHEDULED, patternTargets }) {
  const included = [];
  const excluded = [];
  let plannedMinutes = 0;
  let completedMinutes = 0;
  let unknownPlannedMinutes = 0;
  let unknownCompletedMinutes = 0;

  (blocks || []).forEach((b) => {
    const res = windowFilter(window, b);
    if (res.included) {
      included.push(b);
      plannedMinutes += b.plannedMinutes || 0;
      completedMinutes += b.completedMinutes || 0;
      if (b.practiceKey === UNKNOWN_KEY) {
        unknownPlannedMinutes += b.plannedMinutes || 0;
        unknownCompletedMinutes += b.completedMinutes || 0;
      }
    } else {
      excluded.push({ id: b.id, reason: res.reason });
    }
  });

  const scheduledPlannedMinutes = plannedMinutes;

  if (planSource === PlanSource.TARGETS && scheduledPlannedMinutes === 0 && patternTargets && window?.startDayKey && window?.endDayKeyExclusive) {
    const targetMinutesPerDay = PRACTICE_KEYS.reduce((acc, p) => acc + (patternTargets[p] || 0), 0);
    const dayCount = dayDiff(window.startDayKey, window.endDayKeyExclusive);
    const targetPlannedMinutes = clamp(targetMinutesPerDay * dayCount, 0, 24 * 60 * 31);
    plannedMinutes = targetPlannedMinutes;
    // completed stays zero; provenance will indicate planSource
  }

  plannedMinutes = clamp(plannedMinutes, 0, 24 * 60 * 31); // bound to sane window size
  completedMinutes = clamp(completedMinutes, 0, plannedMinutes);
  const cr = plannedMinutes > 0 ? completedMinutes / plannedMinutes : 0;

  return {
    plannedMinutes,
    completedMinutes,
    cr: Number.isFinite(cr) ? Math.max(0, Math.min(1, cr)) : 0,
    dayKeys: included.map((b) => dayKeyFromISO(b.start)),
    provenance: {
      window,
      includedBlockIds: included.map((b) => b.id),
      excluded,
      mode,
      planSource,
      scheduledPlannedMinutes,
      summary: {
        unknownBlocks: included.filter((b) => b.practiceKey === UNKNOWN_KEY).length,
        unknownPlannedMinutes,
        unknownCompletedMinutes
      }
    }
  };
}

export function computeDayMetricsMap({ blocks = [], dayKeys = [], mode = 'calendar' }) {
  const map = {};
  const set = new Set(dayKeys);
  set.forEach((dayKey) => {
    const window = { kind: 'day', startDayKey: dayKey, endDayKeyExclusive: addDays(dayKey, 1), includeDayKeys: new Set([dayKey]) };
    map[dayKey] = computeWindowMetrics({ blocks, window, mode });
  });
  return map;
}

export function addDays(dayKey, offset) {
  return addDaysInTimeZone(dayKey, offset);
}

// Today instrumentation: per-domain Target/Scheduled/Completed/Gap
export function computeTodayDomainInstrumentation({ dayKey, normalizedBlocks = [], patternTargets = {} }) {
  const result = {};
  PRACTICE_KEYS.forEach((p) => {
    const target = Number.isFinite(patternTargets[p]) && patternTargets[p] >= 0 ? patternTargets[p] : 0;
    result[p] = { target, scheduled: 0, completed: 0, gap: target };
  });

  (normalizedBlocks || []).forEach((b) => {
    const blockDayKey = dayKeyFromISO(b.start);
    if (blockDayKey !== dayKey) return;
    const key = PRACTICE_KEYS.includes(b.practiceKey) ? b.practiceKey : null;
    if (!key) return;
    result[key].scheduled += b.plannedMinutes || 0;
    result[key].completed += b.completedMinutes || 0;
  });

  PRACTICE_KEYS.forEach((p) => {
    const r = result[p];
    r.gap = Math.max(0, r.target - r.completed);
  });

  return result;
}

export function groupPracticeLoad(blocks = []) {
  return (blocks || []).reduce(
    (acc, b) => {
      if (UnknownPolicy.includeInPracticeLoad === false && b.practiceKey === UNKNOWN_KEY) {
        acc.unknownPlannedMinutes += b.plannedMinutes || 0;
        acc.unknownCompletedMinutes += b.completedMinutes || 0;
        return acc;
      }
      const key = PRACTICE_KEYS.includes(b.practiceKey) ? b.practiceKey : UNKNOWN_KEY;
      acc[key] = (acc[key] || 0) + (b.plannedMinutes || 0);
      return acc;
    },
    { unknownPlannedMinutes: 0, unknownCompletedMinutes: 0 }
  );
}

function dayDiff(startDayKey, endDayKeyExclusive) {
  const s = new Date(`${startDayKey}T00:00:00.000Z`).getTime();
  const e = new Date(`${endDayKeyExclusive}T00:00:00.000Z`).getTime();
  if (!Number.isFinite(s) || !Number.isFinite(e)) return 0;
  return Math.max(0, Math.round((e - s) / DAY_MS));
}
