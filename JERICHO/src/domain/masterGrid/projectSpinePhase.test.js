/**
 * projectSpinePhase.test.js
 *
 * E15 Section 6 requires unit tests on the Sites 1/4 normalization step, and states explicitly
 * that they "must include the absent/TBD -> null case" — the defect caught in Section 4's
 * corrected transformation, where deadlineKey()'s '9999-12-31' sentinel would have windowed every
 * dateless Project to a confident P3.
 *
 * Boundaries under test (computeSpineWindowPhase.ts:16-17):
 *   P1 through 2028-02-17 | P2 2028-02-18..2029-08-17 | P3 from 2029-08-18
 */
import { describe, it, expect } from 'vitest';
import { normalizeTargetDateForPhase, computeProjectSpinePhase } from './projectSpinePhase.js';

describe('normalizeTargetDateForPhase', () => {
  it('passes a strict ISO date through unchanged', () => {
    expect(normalizeTargetDateForPhase('2026-10-17')).toBe('2026-10-17');
  });

  it('resolves a bare year to end-of-period', () => {
    expect(normalizeTargetDateForPhase('2027')).toBe('2027-12-31');
  });

  it('resolves a YYYY-YYYY span to the end of the LAST year', () => {
    expect(normalizeTargetDateForPhase('2028-2030')).toBe('2030-12-31');
  });

  it('resolves a messy real fixture value (span plus parenthetical)', () => {
    expect(normalizeTargetDateForPhase('2026-2027 (pt. 1 by 2026-10-17)')).toBe('2027-12-31');
  });

  it('trims surrounding whitespace', () => {
    expect(normalizeTargetDateForPhase('  2026-10-17  ')).toBe('2026-10-17');
  });

  // The sentinel guard. deadlineKey() returns '9999-12-31' for each of these.
  it.each([
    ['null', null],
    ['undefined', undefined],
    ['empty string', ''],
    ['whitespace only', '   '],
    ['TBD', 'TBD'],
    ['lowercase tbd', 'tbd'],
    ['TBD with a note', 'TBD (post-2028 acquisition)'],
  ])('returns null for %s — never the 9999-12-31 sort sentinel', (_label, input) => {
    expect(normalizeTargetDateForPhase(input)).toBeNull();
  });
});

describe('computeProjectSpinePhase', () => {
  it.each([
    ['well inside P1', '2026-10-17', 1],
    ['on the P1 boundary (inclusive)', '2028-02-17', 1],
    ['first day of P2', '2028-02-18', 2],
    ['on the P2 boundary (inclusive)', '2029-08-17', 2],
    ['first day of P3', '2029-08-18', 3],
    ['well inside P3', '2031-06-01', 3],
  ])('windows %s', (_label, targetDate, expected) => {
    expect(computeProjectSpinePhase({ targetDate })).toBe(expected);
  });

  it('returns a NUMBER, not the P-form string — consumers bucket on 1|2|3', () => {
    const phase = computeProjectSpinePhase({ targetDate: '2026-10-17' });
    expect(phase).toBe(1);
    expect(typeof phase).toBe('number');
    expect(phase).not.toBe('P1');
  });

  // The regression this whole helper exists to prevent: a dateless node must surface as a
  // residual, never as a plausible-looking P3.
  it.each([
    ['no targetDate key at all', {}],
    ['null targetDate', { targetDate: null }],
    ['empty targetDate', { targetDate: '' }],
    ['TBD targetDate', { targetDate: 'TBD' }],
    ['TBD with a note', { targetDate: 'TBD (post-2028 acquisition)' }],
  ])('returns null (residual) for %s — never P3', (_label, node) => {
    expect(computeProjectSpinePhase(node)).toBeNull();
  });

  it('returns null for a null or undefined node rather than throwing', () => {
    expect(computeProjectSpinePhase(null)).toBeNull();
    expect(computeProjectSpinePhase(undefined)).toBeNull();
  });

  it('returns null for a calendar-impossible date (765dee5 hardening reaches through)', () => {
    expect(computeProjectSpinePhase({ targetDate: '2027-02-29' })).toBeNull();
    expect(computeProjectSpinePhase({ targetDate: '2027-04-31' })).toBeNull();
  });

  it('returns null for an unparseable target rather than guessing', () => {
    expect(computeProjectSpinePhase({ targetDate: 'sometime after the tour' })).toBeNull();
  });

  // Period-form windowing, stated as a behaviour rather than left implicit: end-of-period means a
  // span can land later than an operator reading the start year might expect. Confirmed as the
  // intended semantic 2026-08-23 (phaseSort.js:3-5 doctrine, adopted unforked).
  it('windows a period form by its END, so 2028-2030 is P3 and not P1', () => {
    expect(computeProjectSpinePhase({ targetDate: '2028-2030' })).toBe(3);
  });

  it('windows a bare 2028 to P2 (2028-12-31), not P1', () => {
    expect(computeProjectSpinePhase({ targetDate: '2028' })).toBe(2);
  });
});
