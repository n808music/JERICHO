import { describe, expect, it } from 'vitest';
import { buildLocalStartISO, dayKeyFromISO, parseTimeString } from '../time/time.ts';

describe('time parsing and day boundary', () => {
  it('parses 24h and 12h time strings', () => {
    expect(parseTimeString('22:30')).toEqual({ ok: true, hours: 22, minutes: 30 });
    expect(parseTimeString('22:30:00')).toEqual({ ok: true, hours: 22, minutes: 30 });
    expect(parseTimeString('10:30 PM')).toEqual({ ok: true, hours: 22, minutes: 30 });
    expect(parseTimeString('10:30:15 pm')).toEqual({ ok: true, hours: 22, minutes: 30 });
    expect(parseTimeString('24:00').ok).toBe(false);
    expect(parseTimeString('')).toEqual({ ok: false, reason: 'empty' });
  });

  it('anchors late-night and early-morning times to the selected dayKey', () => {
    const dayKey = '2026-01-08';
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const late = buildLocalStartISO(dayKey, '23:30', tz);
    expect(late.ok).toBe(true);
    expect(dayKeyFromISO(late.startISO, tz)).toBe(dayKey);

    const early = buildLocalStartISO(dayKey, '00:30', tz);
    expect(early.ok).toBe(true);
    expect(dayKeyFromISO(early.startISO, tz)).toBe(dayKey);

    const pm = buildLocalStartISO(dayKey, '10:30 PM', tz);
    expect(pm.ok).toBe(true);
    expect(pm.canonicalTime).toBe('22:30');
  });
});
