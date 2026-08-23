import { describe, it, expect } from 'vitest';
import { computeSpineWindowPhase } from './computeSpineWindowPhase';

describe('computeSpineWindowPhase', () => {
  describe('Phase 1 (State of Control): through 2028-02-17', () => {
    it('returns P1 for date on the upper boundary (2028-02-17)', () => {
      expect(computeSpineWindowPhase('2028-02-17', null)).toBe('P1');
    });

    it('returns P1 for date before the boundary (2028-02-16)', () => {
      expect(computeSpineWindowPhase('2028-02-16', null)).toBe('P1');
    });

    it('returns P1 for a date well before the boundary (2026-01-01)', () => {
      expect(computeSpineWindowPhase('2026-01-01', null)).toBe('P1');
    });

    it('returns P1 for the earliest possible date (1970-01-01)', () => {
      expect(computeSpineWindowPhase('1970-01-01', null)).toBe('P1');
    });
  });

  describe('Phase 2 (Seeds of Destruction): 2028-02-18 through 2029-08-17', () => {
    it('returns P2 for the first day of P2 window (2028-02-18)', () => {
      expect(computeSpineWindowPhase('2028-02-18', null)).toBe('P2');
    });

    it('returns P2 for a date in the middle of P2 (2028-12-25)', () => {
      expect(computeSpineWindowPhase('2028-12-25', null)).toBe('P2');
    });

    it('returns P2 for the upper boundary (2029-08-17)', () => {
      expect(computeSpineWindowPhase('2029-08-17', null)).toBe('P2');
    });

    it('returns P2 for a date just before the upper boundary (2029-08-16)', () => {
      expect(computeSpineWindowPhase('2029-08-16', null)).toBe('P2');
    });
  });

  describe('Phase 3 (I Am The State): from 2029-08-18 onward', () => {
    it('returns P3 for the first day of P3 window (2029-08-18)', () => {
      expect(computeSpineWindowPhase('2029-08-18', null)).toBe('P3');
    });

    it('returns P3 for a date well into P3 (2031-12-31)', () => {
      expect(computeSpineWindowPhase('2031-12-31', null)).toBe('P3');
    });

    it('returns P3 for a far-future date (2050-01-01)', () => {
      expect(computeSpineWindowPhase('2050-01-01', null)).toBe('P3');
    });
  });

  describe('Null / missing inputs', () => {
    it('returns null when terminalDeadline is null and isOngoing is false', () => {
      expect(computeSpineWindowPhase(null, null, false)).toBe(null);
    });

    it('returns null when terminalDeadline is undefined and isOngoing is false', () => {
      expect(computeSpineWindowPhase(undefined, null, false)).toBe(null);
    });

    it('returns null when both terminalDeadline and nextMilestone are null', () => {
      expect(computeSpineWindowPhase(null, null, false)).toBe(null);
      expect(computeSpineWindowPhase(null, null, true)).toBe(null);
    });

    it('returns null when terminalDeadline is an empty string', () => {
      expect(computeSpineWindowPhase('', null, false)).toBe(null);
    });

    it('returns null when terminalDeadline is whitespace-only', () => {
      expect(computeSpineWindowPhase('   ', null, false)).toBe(null);
    });
  });

  describe('isOngoing: uses nextMilestone instead of terminalDeadline', () => {
    it('ignores terminalDeadline when isOngoing is true and uses nextMilestone', () => {
      // terminalDeadline would be P3, but nextMilestone is P1
      expect(computeSpineWindowPhase('2029-09-01', '2027-01-01', true)).toBe('P1');
    });

    it('uses nextMilestone for phase computation when isOngoing is true', () => {
      expect(computeSpineWindowPhase('2030-01-01', '2028-06-01', true)).toBe('P2');
    });

    it('returns null for isOngoing=true if nextMilestone is null', () => {
      expect(computeSpineWindowPhase('2028-01-01', null, true)).toBe(null);
    });

    it('uses terminalDeadline when isOngoing is false, even if nextMilestone exists', () => {
      // terminalDeadline is P3, nextMilestone is P1; should use terminalDeadline
      expect(computeSpineWindowPhase('2029-09-01', '2027-01-01', false)).toBe('P3');
    });
  });

  describe('Invalid date strings', () => {
    it('returns null for a malformed date (not YYYY-MM-DD format)', () => {
      expect(computeSpineWindowPhase('2028/02/17', null)).toBe(null);
      expect(computeSpineWindowPhase('02-17-2028', null)).toBe(null);
      expect(computeSpineWindowPhase('not-a-date', null)).toBe(null);
    });

    it('returns null for an invalid calendar date (month 13)', () => {
      expect(computeSpineWindowPhase('2028-13-01', null)).toBe(null);
    });

    it('returns null for an invalid calendar date (day 32 of a 31-day month)', () => {
      expect(computeSpineWindowPhase('2028-01-32', null)).toBe(null);
    });

    it('returns null for an obviously fake date (day 00)', () => {
      expect(computeSpineWindowPhase('2028-02-00', null)).toBe(null);
    });

    it('accepts leap year correctly (2028 is a leap year)', () => {
      // 2028-02-29 is valid and is AFTER P1 boundary (2028-02-17), so P2
      expect(computeSpineWindowPhase('2028-02-29', null)).toBe('P2');
    });

    it('rejects Feb 29 in a non-leap year (2029)', () => {
      // 2029-02-29 does not exist — parseISODate rejects it
      expect(computeSpineWindowPhase('2029-02-29', null)).toBe(null);
    });

    it('rejects April 31 (April has only 30 days)', () => {
      // 2028-04-31 does not exist
      expect(computeSpineWindowPhase('2028-04-31', null)).toBe(null);
    });

    it('rejects June 31 (June has only 30 days)', () => {
      // 2029-06-31 does not exist
      expect(computeSpineWindowPhase('2029-06-31', null)).toBe(null);
    });
  });

  describe('Boundary edge cases', () => {
    it('distinguishes P1/P2 boundary correctly', () => {
      expect(computeSpineWindowPhase('2028-02-17', null)).toBe('P1');
      expect(computeSpineWindowPhase('2028-02-18', null)).toBe('P2');
    });

    it('distinguishes P2/P3 boundary correctly', () => {
      expect(computeSpineWindowPhase('2029-08-17', null)).toBe('P2');
      expect(computeSpineWindowPhase('2029-08-18', null)).toBe('P3');
    });

    it('is deterministic across multiple calls', () => {
      const result1 = computeSpineWindowPhase('2028-12-25', null);
      const result2 = computeSpineWindowPhase('2028-12-25', null);
      expect(result1).toBe(result2);
    });
  });

  describe('Date string normalization', () => {
    it('handles leading whitespace in date string', () => {
      expect(computeSpineWindowPhase('  2028-02-17', null)).toBe('P1');
    });

    it('handles trailing whitespace in date string', () => {
      expect(computeSpineWindowPhase('2028-02-17  ', null)).toBe('P1');
    });

    it('handles both leading and trailing whitespace', () => {
      expect(computeSpineWindowPhase('  2028-02-17  ', null)).toBe('P1');
    });

    it('truncates to first 10 chars if date string is longer', () => {
      // Longer string starting with valid date should work
      expect(computeSpineWindowPhase('2028-02-17T12:00:00.000Z', null)).toBe('P1');
    });
  });

  describe('Type coercion safety', () => {
    it('converts string inputs safely', () => {
      expect(computeSpineWindowPhase('2028-06-01', '2027-01-01', false)).toBe('P2');
    });

    it('does not throw on null inputs', () => {
      expect(() => computeSpineWindowPhase(null, null, false)).not.toThrow();
    });

    it('does not throw on undefined inputs', () => {
      expect(() => computeSpineWindowPhase(undefined, undefined, false)).not.toThrow();
    });
  });

  describe('Representative production scenarios', () => {
    it('classifies an Initiative with near-term terminal (P1)', () => {
      expect(computeSpineWindowPhase('2027-06-30', null, false)).toBe('P1');
    });

    it('classifies a Project with medium-term target (P2)', () => {
      expect(computeSpineWindowPhase('2029-03-15', null, false)).toBe('P2');
    });

    it('classifies an ongoing Initiative using its next milestone (P1)', () => {
      expect(computeSpineWindowPhase(null, '2028-01-01', true)).toBe('P1');
    });

    it('classifies an ongoing Initiative using its next milestone (P3)', () => {
      expect(computeSpineWindowPhase(null, '2030-12-31', true)).toBe('P3');
    });

    it('surfaces a gap: Initiative with no terminal and no milestone', () => {
      expect(computeSpineWindowPhase(null, null, true)).toBe(null);
    });

    it('surfaces a gap: Project with no target date', () => {
      expect(computeSpineWindowPhase(null, null, false)).toBe(null);
    });
  });
});
