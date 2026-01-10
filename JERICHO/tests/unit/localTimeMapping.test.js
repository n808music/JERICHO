import { describe, expect, it } from 'vitest';

const localDayKey = (date) => {
  if (!date) return '';
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

const minutesSinceMidnight = (date) => {
  if (!date) return 0;
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
});
