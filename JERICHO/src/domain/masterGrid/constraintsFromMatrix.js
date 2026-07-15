/**
 * constraintsFromMatrix.js
 *
 * Translates a CONFIRMED matrix.capacityById row into the constraints shape
 * deterministicPlanGenerator.ts expects: { maxBlocksPerDay, maxBlocksPerWeek,
 * preferredDaysOfWeek, blackoutDayKeys }.
 *
 * Capacity is a shared pool per entity, not a per-lane budget (2026-07-13 design, §5):
 * this function resolves ONE acting entity's CONFIRMED row and reduces its workWindows to
 * the generator's simpler day/week block-count model. This is an interim translation —
 * the eventual unified `generateSchedule` engine (design §6) will place blocks against
 * real time-of-day windows directly; today's deterministic generator only understands
 * block counts per day/week, so the richer workWindows shape is intentionally reduced.
 *
 * Returns null when no CONFIRMED capacity is resolvable for the acting entity — callers
 * fall back to whatever constraints source they used before this existed (unchanged
 * behavior when capacity hasn't been confirmed yet).
 */

import { DAY_KEYS, resolveActingEntityId } from './capacityFromLegacy.js';

function parseHHMMToMinutes(hhmm) {
  const [h, m] = String(hhmm || '')
    .split(':')
    .map(Number);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return 0;
  return h * 60 + m;
}

function minutesForDay(workWindows, day) {
  const windows = Array.isArray(workWindows?.[day]) ? workWindows[day] : [];
  return windows.reduce((total, w) => {
    const start = parseHHMMToMinutes(w?.start);
    const end = parseHHMMToMinutes(w?.end);
    return total + Math.max(0, end - start);
  }, 0);
}

function resolveConfirmedCapacityRow(matrix) {
  const capacityById = matrix.capacityById || {};
  const entityId = resolveActingEntityId(matrix);

  if (entityId) {
    const forEntity = Object.values(capacityById).find(
      (row) => row && row.owningEntityId === entityId && row.reviewStatus === 'CONFIRMED'
    );
    if (forEntity) return forEntity;
  }

  // No confirmed causal chain yet to anchor an entity, or that entity has no confirmed
  // capacity — if there's exactly one CONFIRMED capacity row in the whole matrix, it's
  // unambiguous enough to use (the common solo-operator case).
  const confirmedRows = Object.values(capacityById).filter((row) => row && row.reviewStatus === 'CONFIRMED');
  if (confirmedRows.length === 1) return confirmedRows[0];

  return null;
}

/**
 * @param {object} matrix - state.matrix
 * @returns {{maxBlocksPerDay:number, maxBlocksPerWeek:number, preferredDaysOfWeek:number[], blackoutDayKeys:string[]}|null}
 */
export function buildConstraintsFromMatrix(matrix = {}) {
  const row = resolveConfirmedCapacityRow(matrix);
  if (!row) return null;

  const workDays = DAY_KEYS.filter((day) => minutesForDay(row.workWindows, day) > 0);
  if (workDays.length === 0) return null;

  const minutesPerWorkDay = workDays.map((day) => minutesForDay(row.workWindows, day));
  const minMinutesInADay = Math.min(...minutesPerWorkDay);
  const totalWeeklyMinutes = minutesPerWorkDay.reduce((sum, m) => sum + m, 0);

  const declaredMaxPerDay = Number(row.maxBlocksPerDay) || 4;
  const declaredMaxPerWeek = Number(row.maxBlocksPerWeek) || 16;

  // Never let the declared cap exceed what the actual windows can physically hold —
  // the row's maxBlocksPerDay/Week are upper bounds, the windows are ground truth.
  const maxBlocksPerDay = Math.max(1, Math.min(declaredMaxPerDay, Math.floor(minMinutesInADay / 60)));
  const maxBlocksPerWeek = Math.max(
    maxBlocksPerDay,
    Math.min(declaredMaxPerWeek, Math.floor(totalWeeklyMinutes / 60))
  );

  const preferredDaysOfWeek = workDays.map((day) => DAY_KEYS.indexOf(day));

  return {
    maxBlocksPerDay,
    maxBlocksPerWeek,
    preferredDaysOfWeek,
    blackoutDayKeys: Array.isArray(row.blackoutDayKeys) ? row.blackoutDayKeys : [],
  };
}
