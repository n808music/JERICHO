import { describe, expect, it } from 'vitest';
import { parseTimeString, formatCanonicalTime } from '../../src/components/zion/timeUtils.js';

describe('time parsing', () => {
  it('accepts 24h HH:mm and HH:mm:ss', () => {
    const a = parseTimeString('22:30');
    const b = parseTimeString('22:30:00');
    expect(a.ok).toBe(true);
    expect(b.ok).toBe(true);
    expect(a.hours).toBe(22);
    expect(a.minutes).toBe(30);
    expect(b.hours).toBe(22);
    expect(b.minutes).toBe(30);
  });

  it('accepts 12h time with AM/PM and optional seconds', () => {
    const a = parseTimeString('10:30 PM');
    const b = parseTimeString('10:30:15 pm');
    expect(a.ok).toBe(true);
    expect(b.ok).toBe(true);
    expect(a.hours).toBe(22);
    expect(a.minutes).toBe(30);
    expect(b.hours).toBe(22);
    expect(b.minutes).toBe(30);
  });

  it('rejects malformed time strings', () => {
    const a = parseTimeString('bad');
    const b = parseTimeString('25:99');
    expect(a.ok).toBe(false);
    expect(b.ok).toBe(false);
  });

  it('formats canonical time', () => {
    expect(formatCanonicalTime({ hours: 5, minutes: 7 })).toBe('05:07');
  });
});
