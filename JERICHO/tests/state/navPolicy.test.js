import { describe, it, expect } from 'vitest';
import { getInitialViewKey } from '../../src/state/navPolicy.js';

describe('navPolicy.getInitialViewKey', () => {
  it('returns lenses when goal outcome or deadline missing', () => {
    expect(getInitialViewKey({}, 'today')).toBe('lenses');
    expect(
      getInitialViewKey({ definiteGoal: { outcome: '  ', deadlineDayKey: '2025-12-01' } }, 'today')
    ).toBe('lenses');
    expect(getInitialViewKey({ definiteGoal: { outcome: 'Goal', deadlineDayKey: '' } }, 'today')).toBe('lenses');
  });

  it('returns fallback when goal outcome and deadline are present', () => {
    const activeCycle = { definiteGoal: { outcome: 'Ship', deadlineDayKey: '2025-12-01' } };
    expect(getInitialViewKey(activeCycle, 'today')).toBe('today');
  });
});

