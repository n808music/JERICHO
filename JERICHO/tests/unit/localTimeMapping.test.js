import { describe, expect, it } from 'vitest';
import { buildLocalStartISO, localMinutesFromISO } from '../../src/state/time/time.ts';

const localDayKey = (date) => {
  if (!date) {
    return '';
  }
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

const minutesSinceMidnight = (date) => {
  if (!date) {
    return 0;
  }
  return date.getHours() * 60 + date.getMinutes();
};

describe('local time construction (no UTC shift)', () => {
  it('keeps the intended day, hour, minute when building from a local datetime string', () => {
    const day = '2025-12-10';
    const iso = `${day}T09:00:00`; // local 09:00
    const d = new Date(iso);

    expect(localDayKey(d)).toBe(day);
    expect(d.getHours()).toBe(9);
    expect(d.getMinutes()).toBe(0);
    expect(minutesSinceMidnight(d)).toBe(9 * 60);
  });

  it('builds America/Chicago local work-window times without drifting to UTC-midnight artifacts', () => {
    const result = buildLocalStartISO('2026-06-15', '09:00', 'America/Chicago');
    expect(result.ok).toBe(true);
    expect(result.canonicalTime).toBe('09:00');
    expect(result.startISO).toBe('2026-06-15T14:00:00.000Z');
  });

  it('preserves the intended local hour across daylight saving boundaries', () => {
    const beforeDst = buildLocalStartISO('2026-03-06', '09:00', 'America/Chicago');
    const afterDst = buildLocalStartISO('2026-03-10', '09:00', 'America/Chicago');
    const afterFallBack = buildLocalStartISO('2026-11-10', '09:00', 'America/Chicago');

    expect(beforeDst.ok).toBe(true);
    expect(afterDst.ok).toBe(true);
    expect(afterFallBack.ok).toBe(true);

    expect(beforeDst.startISO).toBe('2026-03-06T15:00:00.000Z');
    expect(afterDst.startISO).toBe('2026-03-10T14:00:00.000Z');
    expect(afterFallBack.startISO).toBe('2026-11-10T15:00:00.000Z');
  });

  it('maps stored ISO timestamps back into the app-local 9:00 AM to 3:00 PM work window', () => {
    const inside = buildLocalStartISO('2026-06-15', '09:00', 'America/Chicago');
    const outside = buildLocalStartISO('2026-06-15', '16:00', 'America/Chicago');

    expect(inside.ok).toBe(true);
    expect(outside.ok).toBe(true);

    const insideStartMin = localMinutesFromISO(inside.startISO, 'America/Chicago');
    const outsideStartMin = localMinutesFromISO(outside.startISO, 'America/Chicago');

    expect(insideStartMin).toBe(9 * 60);
    expect(outsideStartMin).toBe(16 * 60);
    expect(insideStartMin >= 9 * 60 && insideStartMin < 15 * 60).toBe(true);
    expect(outsideStartMin >= 9 * 60 && outsideStartMin < 15 * 60).toBe(false);
  });
});
