const DEFAULT_TIME_ZONE = 'America/Chicago';

const dayKeyFormatter = (timeZone: string) =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });

export const APP_TIME_ZONE = DEFAULT_TIME_ZONE;

export function parseTimeString(timeStr = '') {
  const raw = String(timeStr || '').trim();
  if (!raw) return { ok: false, reason: 'empty' };
  const match = raw.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?\s*([APap][Mm])?$/);
  if (!match) return { ok: false, reason: 'format' };
  const hourRaw = Number(match[1]);
  const minutes = Number(match[2]);
  if (!Number.isFinite(hourRaw) || !Number.isFinite(minutes)) return { ok: false, reason: 'nan' };
  if (minutes < 0 || minutes > 59) return { ok: false, reason: 'minutes_range' };
  const meridiem = match[4] ? match[4].toLowerCase() : '';
  if (!meridiem && (hourRaw < 0 || hourRaw > 23)) return { ok: false, reason: 'hours_range' };
  let hours = hourRaw % 24;
  if (meridiem === 'pm' && hours < 12) hours += 12;
  if (meridiem === 'am' && hours === 12) hours = 0;
  return { ok: true, hours, minutes };
}

export function formatCanonicalTime({ hours, minutes }: { hours: number; minutes: number }) {
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return '00:00';
  const h = String(Math.max(0, Math.min(23, hours))).padStart(2, '0');
  const m = String(Math.max(0, Math.min(59, minutes))).padStart(2, '0');
  return `${h}:${m}`;
}

export function isValidISO(iso = '') {
  return !!iso && Number.isFinite(Date.parse(iso));
}

export function assertValidISO(label = 'ISO', iso = '', meta: Record<string, unknown> = {}) {
  if (process.env.NODE_ENV === 'production') return;
  if (isValidISO(iso)) return;
  // eslint-disable-next-line no-console
  console.warn(`${label} is invalid`, { iso, ...meta });
}

export function buildLocalStartISO(dayKey: string, timeStr = '09:00', timeZone: string = APP_TIME_ZONE) {
  if (!dayKey) return { ok: false, reason: 'missing_day_key' };
  const parsed = parseTimeString(timeStr);
  if (!parsed.ok) return { ok: false, reason: parsed.reason };
  const canonicalTime = formatCanonicalTime(parsed);
  const localStr = `${dayKey}T${canonicalTime}:00`;
  const date = new Date(localStr);
  if (!Number.isFinite(date.getTime())) return { ok: false, reason: 'invalid_date' };
  const startISO = date.toISOString();
  const resolvedDayKey = dayKeyFromISO(startISO, timeZone);
  if (resolvedDayKey !== dayKey) {
    return { ok: false, reason: 'daykey_mismatch', startISO, resolvedDayKey };
  }
  return { ok: true, startISO, canonicalTime };
}

export function dayKeyFromDate(date: Date, timeZone: string = APP_TIME_ZONE) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return '';
  const parts = dayKeyFormatter(timeZone).formatToParts(date);
  const map: Record<string, string> = {};
  parts.forEach((p) => {
    if (p.type !== 'literal') map[p.type] = p.value;
  });
  const year = map.year || '0000';
  const month = map.month || '01';
  const day = map.day || '01';
  return `${year}-${month}-${day}`;
}

export function dayKeyFromParts(year: number, monthIndex: number, day: number, timeZone: string = APP_TIME_ZONE) {
  if (!Number.isFinite(year) || !Number.isFinite(monthIndex) || !Number.isFinite(day)) return '';
  const safeDate = new Date(Date.UTC(year, monthIndex, day, 12, 0, 0));
  return dayKeyFromDate(safeDate, timeZone);
}

export function dayKeyFromISO(iso = '', timeZone: string = APP_TIME_ZONE) {
  if (!iso) return '';
  return dayKeyFromDate(new Date(iso), timeZone);
}

export function nowDayKey(timeZone: string = APP_TIME_ZONE) {
  return dayKeyFromDate(new Date(), timeZone);
}

export function addDays(dayKey: string, offset: number, timeZone: string = APP_TIME_ZONE) {
  if (!dayKey || !Number.isFinite(offset)) return dayKey || '';
  const base = new Date(`${dayKey}T12:00:00`);
  if (Number.isNaN(base.getTime())) return dayKey;
  base.setDate(base.getDate() + offset);
  return dayKeyFromDate(base, timeZone);
}
