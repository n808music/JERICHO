import { addDays, dayKeyFromISO } from '../time/time.ts';

type ProbabilityWindowMode = 'cycle_to_date' | 'rolling';

type ProbabilityWindowSpec = {
  mode: ProbabilityWindowMode;
  startDayKey: string;
  endDayKey: string;
  windowDays?: number;
  labelParts: {
    mode: ProbabilityWindowMode;
    startDayKey: string;
    endDayKey: string;
    windowDays?: number;
  };
};

type WindowSpecInput = {
  activeContract?: { startDayKey?: string; endDayKey?: string; windowMode?: ProbabilityWindowMode } | null;
  nowISO: string;
  timeZone?: string;
  scoringWindowDays?: number;
};

const DAY_KEY_RE = /^\d{4}-\d{2}-\d{2}$/;

function normalizeDayKey(value: string, timeZone: string) {
  if (!value) return '';
  if (DAY_KEY_RE.test(value)) return value;
  return dayKeyFromISO(value, timeZone);
}

export function getProbabilityWindowSpec({
  activeContract,
  nowISO,
  timeZone = 'UTC',
  scoringWindowDays
}: WindowSpecInput): ProbabilityWindowSpec {
  const endDayKey = normalizeDayKey(nowISO, timeZone);
  const windowMode = activeContract?.windowMode;
  if (activeContract?.startDayKey && windowMode !== 'rolling') {
    const startDayKey = normalizeDayKey(activeContract.startDayKey, timeZone);
    return {
      mode: 'cycle_to_date',
      startDayKey,
      endDayKey,
      labelParts: { mode: 'cycle_to_date', startDayKey, endDayKey }
    };
  }

  const windowDays = Number.isFinite(scoringWindowDays) && scoringWindowDays ? scoringWindowDays : 14;
  const startDayKey = addDays(endDayKey, -(windowDays - 1), timeZone);
  return {
    mode: 'rolling',
    startDayKey,
    endDayKey,
    windowDays,
    labelParts: { mode: 'rolling', startDayKey, endDayKey, windowDays }
  };
}

export function formatProbabilityWindowLabel(spec: ProbabilityWindowSpec) {
  if (spec.mode === 'cycle_to_date') {
    return `Active cycle to date (${spec.startDayKey || '—'} → ${spec.endDayKey || '—'})`;
  }
  const days = Number.isFinite(spec.windowDays) ? spec.windowDays : 14;
  return `Last ${days} workable days`;
}
