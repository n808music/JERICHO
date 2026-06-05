import { addDays, buildLocalStartISO } from '../../state/time/time.ts';

const DEFAULT_WORK_WINDOWS = {
  mon: [{ start: '09:00', end: '15:00' }],
  tue: [{ start: '09:00', end: '15:00' }],
  wed: [{ start: '09:00', end: '15:00' }],
  thu: [{ start: '09:00', end: '15:00' }],
  fri: [{ start: '09:00', end: '15:00' }],
  sat: [],
  sun: [],
};

function normalizeText(value) {
  return String(value || '').trim();
}

function normalizeDayKey(value) {
  const text = normalizeText(value);
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : null;
}

function parseHHMMToMinutes(value) {
  const match = /^(\d{2}):(\d{2})$/.exec(normalizeText(value));
  if (!match) {
    return null;
  }
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) {
    return null;
  }
  return hours * 60 + minutes;
}

function minutesToHHMM(totalMinutes = 0) {
  const safe = Math.max(0, Number(totalMinutes) || 0);
  const hours = Math.floor(safe / 60);
  const minutes = safe % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

function dayKeyToDow(dayKey) {
  const normalized = normalizeDayKey(dayKey);
  if (!normalized) {
    return 'mon';
  }
  const [year, month, day] = normalized.split('-').map(Number);
  const utcDay = new Date(Date.UTC(year, month - 1, day, 12, 0, 0)).getUTCDay();
  return ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'][utcDay] || 'mon';
}

function normalizeWorkWindows(workWindows = null) {
  const source = workWindows && typeof workWindows === 'object' ? workWindows : DEFAULT_WORK_WINDOWS;
  return Object.keys(DEFAULT_WORK_WINDOWS).reduce((acc, day) => {
    const rows = Array.isArray(source?.[day]) ? source[day] : [];
    acc[day] = rows
      .map((row) => {
        const start = normalizeText(row?.start);
        const end = normalizeText(row?.end);
        const startMin = parseHHMMToMinutes(start);
        const endMin = parseHHMMToMinutes(end);
        if (!Number.isFinite(startMin) || !Number.isFinite(endMin) || endMin <= startMin) {
          return null;
        }
        return { start, end, startMin, endMin };
      })
      .filter(Boolean);
    return acc;
  }, {});
}

function sortBlocksForPlacement(blocks = []) {
  return [...(Array.isArray(blocks) ? blocks : [])].sort((left, right) => {
    const leftDayKey = normalizeDayKey(left?.dayKey || left?.date) || '9999-12-31';
    const rightDayKey = normalizeDayKey(right?.dayKey || right?.date) || '9999-12-31';
    if (leftDayKey !== rightDayKey) {
      return leftDayKey.localeCompare(rightDayKey);
    }
    const leftPhase = normalizeText(left?.phaseLabel);
    const rightPhase = normalizeText(right?.phaseLabel);
    if (leftPhase !== rightPhase) {
      return leftPhase.localeCompare(rightPhase);
    }
    const leftLane = normalizeText(left?.laneId || left?.masterPlanLaneId || left?.laneLabel);
    const rightLane = normalizeText(right?.laneId || right?.masterPlanLaneId || right?.laneLabel);
    if (leftLane !== rightLane) {
      return leftLane.localeCompare(rightLane);
    }
    return normalizeText(left?.id).localeCompare(normalizeText(right?.id));
  });
}

function collectOccupiedSlots(blocks = []) {
  const occupiedByDayKey = new Map();
  (Array.isArray(blocks) ? blocks : []).forEach((block) => {
    const start = normalizeText(block?.startISO || block?.start);
    const end = normalizeText(block?.endISO || block?.end);
    const dayKey = normalizeDayKey(block?.dayKey || block?.date || start.slice(0, 10));
    const startMin = parseHHMMToMinutes(start.slice(11, 16));
    const endMin = parseHHMMToMinutes(end.slice(11, 16));
    if (!dayKey || !Number.isFinite(startMin) || !Number.isFinite(endMin) || endMin <= startMin) {
      return;
    }
    if (!occupiedByDayKey.has(dayKey)) {
      occupiedByDayKey.set(dayKey, []);
    }
    occupiedByDayKey.get(dayKey).push({ startMin, endMin });
  });
  return occupiedByDayKey;
}

function assignSlotForBlock({ block, occupiedByDayKey, workWindows, timeZone, horizonEndDayKey = null }) {
  const durationMinutes = Math.max(15, Number(block?.durationMinutes || block?.timeEstimateMinutes || 60));
  const firstDayKey = normalizeDayKey(block?.dayKey || block?.date);
  const finalDayKey = normalizeDayKey(horizonEndDayKey) || firstDayKey;
  let cursor = firstDayKey;
  let guard = 0;

  while (cursor && guard < 5000) {
    const windows = workWindows[dayKeyToDow(cursor)] || [];
    const occupied = occupiedByDayKey.get(cursor) || [];
    for (const window of windows) {
      for (let startMin = window.startMin; startMin + durationMinutes <= window.endMin; startMin += 15) {
        const overlaps = occupied.some((slot) => !(startMin + durationMinutes <= slot.startMin || startMin >= slot.endMin));
        if (overlaps) {
          continue;
        }
        const startLocal = buildLocalStartISO(cursor, minutesToHHMM(startMin), timeZone);
        if (!startLocal?.ok || !startLocal.startISO) {
          continue;
        }
        const endISO = new Date(Date.parse(startLocal.startISO) + durationMinutes * 60000).toISOString();
        occupied.push({ startMin, endMin: startMin + durationMinutes });
        occupiedByDayKey.set(cursor, occupied);
        return {
          ...block,
          dayKey: cursor,
          date: cursor,
          start: startLocal.startISO,
          end: endISO,
          startISO: startLocal.startISO,
          endISO,
          localScheduledTimeHHMM: minutesToHHMM(startMin),
          scheduledTimeSource: 'work_window_placement',
          durationMinutes,
        };
      }
    }
    if (finalDayKey && cursor > finalDayKey) {
      break;
    }
    const next = addDays(cursor, 1, timeZone);
    if (!next || next === cursor) {
      break;
    }
    cursor = next;
    guard += 1;
  }

  return block;
}

export function applyScheduleValidityProjection(
  blocks = [],
  {
    workWindows = null,
    timeZone = 'UTC',
    horizonEndDayKey = null,
  } = {}
) {
  const normalizedWindows = normalizeWorkWindows(workWindows);
  const preserved = [];
  const derived = [];

  sortBlocksForPlacement(blocks).forEach((block) => {
    if (normalizeText(block?.source).toLowerCase() === 'derived') {
      derived.push({ ...block });
    } else {
      preserved.push({ ...block });
    }
  });

  const occupiedByDayKey = collectOccupiedSlots(preserved);
  const scheduledDerived = derived.map((block) =>
    assignSlotForBlock({
      block,
      occupiedByDayKey,
      workWindows: normalizedWindows,
      timeZone,
      horizonEndDayKey,
    })
  );

  return sortBlocksForPlacement([...preserved, ...scheduledDerived]);
}

export default applyScheduleValidityProjection;
