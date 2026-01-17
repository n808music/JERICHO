import { buildLocalStartISO, formatCanonicalTime, parseTimeString } from '../../state/time/time.ts';

export const pad2 = (v) => String(v).padStart(2, '0');

/**
 * Construct a local start ISO from a day key and time string.
 * Returns { ok, startISO, canonicalTime } or { ok: false, reason }.
 */
export function localStartFromDayAndTime(dayKey, timeStr = '09:00', timeZone) {
  return buildLocalStartISO(dayKey, timeStr, timeZone);
}

export { parseTimeString, formatCanonicalTime };

export function dateKeyFromStart(start = '') {
  return typeof start === 'string' ? start.slice(0, 10) : '';
}

export function minutesSinceMidnight(date) {
  if (!date) return 0;
  return date.getHours() * 60 + date.getMinutes();
}
