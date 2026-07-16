import { describe, it, expect } from 'vitest';
import { hasAuthoredSubstance } from './hasAuthoredSubstance';

// Rule 6 extension (2026-07-10, found live): naming the missing prerequisite
// is honest incompleteness, not evasion. "needs strategy" admits the answer
// doesn't exist yet — it must pass like "haven't figured that out yet" does.
// Shells that PRETEND to answer ("drives growth") must still reprobe.

const HONEST = [
  'needs strategy',
  'needs a strategy',
  'needs a plan',
  'needs planning',
  'needs definition',
  'needs research',
  'needs scoping',
  'no strategy yet',
  'no plan yet',
  'not defined yet',
  'not defined',
  'undecided',
  'still deciding',
];

const STILL_SHELLS = [
  'drives growth and value',
  'delivers strategic alignment',
  'manages the business operations',
  // "needs" inside a longer aspirational sentence is not the bare admission —
  // full-string match only, same as the rest of the incompleteness family.
  'needs strategy to unlock synergies across verticals',
];

describe('hasAuthoredSubstance — honest incompleteness (needs-strategy family)', () => {
  it.each(HONEST)('passes bare admission: %s', (s) => {
    expect(hasAuthoredSubstance(s)).toBe(true);
  });
  it.each(STILL_SHELLS)('still reprobes shell: %s', (s) => {
    expect(hasAuthoredSubstance(s)).toBe(false);
  });
});
