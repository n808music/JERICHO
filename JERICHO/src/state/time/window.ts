import { addDays, dayKeyFromISO, dayKeyFromParts } from './time.ts';

type WindowMode = 'day' | 'week' | 'month' | 'quarter' | 'year';

export type WindowSpec = {
  mode: WindowMode;
  anchorDayKey: string;
  startDayKey: string;
  endDayKey: string;
  labelParts: {
    mode: WindowMode;
    anchorDayKey: string;
    startDayKey: string;
    endDayKey: string;
  };
};

const DAY_KEY_RE = /^\d{4}-\d{2}-\d{2}$/;

function normalizeDayKey(value: string, timeZone: string) {
  if (!value) return '';
  if (DAY_KEY_RE.test(value)) return value;
  return dayKeyFromISO(value, timeZone);
}

function parseDayKey(dayKey: string) {
  const [year, month, day] = (dayKey || '').split('-').map((v) => Number(v));
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) {
    return { year: 1970, monthIndex: 0, day: 1 };
  }
  return { year, monthIndex: month - 1, day };
}

function dayKeyToDateUTC(dayKey: string) {
  const { year, monthIndex, day } = parseDayKey(dayKey);
  return new Date(Date.UTC(year, monthIndex, day, 12, 0, 0));
}

function monthEndDay(year: number, monthIndex: number) {
  const end = new Date(Date.UTC(year, monthIndex + 1, 0, 12, 0, 0));
  return end.getUTCDate();
}

export function shiftAnchorDayKey(anchorISO: string, unit: WindowMode, delta: number, timeZone: string) {
  const anchorDayKey = normalizeDayKey(anchorISO, timeZone);
  if (!anchorDayKey) return '';
  if (unit === 'day') return addDays(anchorDayKey, delta, timeZone);
  if (unit === 'week') return addDays(anchorDayKey, delta * 7, timeZone);
  const { year, monthIndex } = parseDayKey(anchorDayKey);
  if (unit === 'month') return dayKeyFromParts(year, monthIndex + delta, 1, timeZone);
  if (unit === 'quarter') return dayKeyFromParts(year, monthIndex + delta * 3, 1, timeZone);
  if (unit === 'year') return dayKeyFromParts(year + delta, 0, 1, timeZone);
  return anchorDayKey;
}

export function getWeekDayKeys(anchorISO: string, timeZone: string) {
  const anchorDayKey = normalizeDayKey(anchorISO, timeZone);
  if (!anchorDayKey) return [];
  const anchorDate = dayKeyToDateUTC(anchorDayKey);
  const dow = anchorDate.getUTCDay();
  const offset = (dow + 6) % 7; // Monday start
  const weekStart = addDays(anchorDayKey, -offset, timeZone);
  return Array.from({ length: 7 }, (_, i) => addDays(weekStart, i, timeZone));
}

export function getMonthDayKeys(anchorISO: string, timeZone: string) {
  const anchorDayKey = normalizeDayKey(anchorISO, timeZone);
  if (!anchorDayKey) return [];
  const { year, monthIndex } = parseDayKey(anchorDayKey);
  const monthStart = dayKeyFromParts(year, monthIndex, 1, timeZone);
  const monthEnd = dayKeyFromParts(year, monthIndex, monthEndDay(year, monthIndex), timeZone);
  const startDow = dayKeyToDateUTC(monthStart).getUTCDay(); // Sunday start
  const endDow = dayKeyToDateUTC(monthEnd).getUTCDay();
  const gridStart = addDays(monthStart, -startDow, timeZone);
  const gridEnd = addDays(monthEnd, 6 - endDow, timeZone);
  const days = [];
  let cursor = gridStart;
  let guard = 0;
  while (cursor && cursor <= gridEnd && guard < 60) {
    days.push(cursor);
    cursor = addDays(cursor, 1, timeZone);
    guard += 1;
  }
  return days;
}

export function getQuarterMonths(anchorISO: string, timeZone: string) {
  const anchorDayKey = normalizeDayKey(anchorISO, timeZone);
  if (!anchorDayKey) return [];
  const { year, monthIndex } = parseDayKey(anchorDayKey);
  const startMonthIndex = Math.floor(monthIndex / 3) * 3;
  return [0, 1, 2].map((offset) => dayKeyFromParts(year, startMonthIndex + offset, 1, timeZone));
}

export function getYearMonths(anchorISO: string, timeZone: string) {
  const anchorDayKey = normalizeDayKey(anchorISO, timeZone);
  if (!anchorDayKey) return [];
  const { year } = parseDayKey(anchorDayKey);
  return Array.from({ length: 12 }, (_, monthIndex) => dayKeyFromParts(year, monthIndex, 1, timeZone));
}

export function buildWindowSpec(mode: WindowMode, anchorISO: string, timeZone: string): WindowSpec {
  const anchorDayKey = normalizeDayKey(anchorISO, timeZone);
  if (!anchorDayKey) {
    return {
      mode,
      anchorDayKey: '',
      startDayKey: '',
      endDayKey: '',
      labelParts: { mode, anchorDayKey: '', startDayKey: '', endDayKey: '' }
    };
  }
  if (mode === 'day') {
    return {
      mode,
      anchorDayKey,
      startDayKey: anchorDayKey,
      endDayKey: anchorDayKey,
      labelParts: { mode, anchorDayKey, startDayKey: anchorDayKey, endDayKey: anchorDayKey }
    };
  }
  if (mode === 'week') {
    const days = getWeekDayKeys(anchorDayKey, timeZone);
    const startDayKey = days[0] || anchorDayKey;
    const endDayKey = days[6] || anchorDayKey;
    return {
      mode,
      anchorDayKey,
      startDayKey,
      endDayKey,
      labelParts: { mode, anchorDayKey, startDayKey, endDayKey }
    };
  }
  const { year, monthIndex } = parseDayKey(anchorDayKey);
  if (mode === 'month') {
    const startDayKey = dayKeyFromParts(year, monthIndex, 1, timeZone);
    const endDayKey = dayKeyFromParts(year, monthIndex, monthEndDay(year, monthIndex), timeZone);
    return {
      mode,
      anchorDayKey,
      startDayKey,
      endDayKey,
      labelParts: { mode, anchorDayKey, startDayKey, endDayKey }
    };
  }
  if (mode === 'quarter') {
    const months = getQuarterMonths(anchorDayKey, timeZone);
    const start = months[0] || anchorDayKey;
    const endMonth = months[2] || anchorDayKey;
    const { year: endYear, monthIndex: endMonthIndex } = parseDayKey(endMonth);
    const end = dayKeyFromParts(endYear, endMonthIndex, monthEndDay(endYear, endMonthIndex), timeZone);
    return {
      mode,
      anchorDayKey,
      startDayKey: start,
      endDayKey: end,
      labelParts: { mode, anchorDayKey, startDayKey: start, endDayKey: end }
    };
  }
  const startDayKey = dayKeyFromParts(year, 0, 1, timeZone);
  const endDayKey = dayKeyFromParts(year, 11, 31, timeZone);
  return {
    mode,
    anchorDayKey,
    startDayKey,
    endDayKey,
    labelParts: { mode, anchorDayKey, startDayKey, endDayKey }
  };
}

function formatDayKeyLong(dayKey: string, timeZone: string) {
  if (!dayKey) return '—';
  const { year, monthIndex, day } = parseDayKey(dayKey);
  const date = new Date(Date.UTC(year, monthIndex, day, 12, 0, 0));
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
  return formatter.format(date);
}

function formatMonthLabel(dayKey: string, timeZone: string) {
  const { year, monthIndex, day } = parseDayKey(dayKey);
  const date = new Date(Date.UTC(year, monthIndex, day, 12, 0, 0));
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    month: 'long',
    year: 'numeric'
  });
  return formatter.format(date);
}

function quarterNumber(dayKey: string) {
  const { monthIndex } = parseDayKey(dayKey);
  return Math.floor(monthIndex / 3) + 1;
}

export function formatWindowLabel(spec: WindowSpec, timeZone: string) {
  if (!spec?.startDayKey) return '—';
  const range = `${formatDayKeyLong(spec.startDayKey, timeZone)} → ${formatDayKeyLong(spec.endDayKey, timeZone)}`;
  if (spec.mode === 'week') {
    return `Week of ${formatDayKeyLong(spec.startDayKey, timeZone)} (${range})`;
  }
  if (spec.mode === 'month') {
    return `${formatMonthLabel(spec.startDayKey, timeZone)} (${range})`;
  }
  if (spec.mode === 'quarter') {
    const { year } = parseDayKey(spec.startDayKey);
    return `Q${quarterNumber(spec.startDayKey)} ${year} (${range})`;
  }
  if (spec.mode === 'year') {
    const { year } = parseDayKey(spec.startDayKey);
    return `${year} (${range})`;
  }
  return formatDayKeyLong(spec.startDayKey, timeZone);
}
