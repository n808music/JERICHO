import { describe, it, expect } from 'vitest';
import { isExternallyVerifiable } from './isExternallyVerifiable';

// Gap found in live intake (2026-07-10): quantified public metrics — the
// strongest form of external proof — were rejected because the validator only
// recognized world-state verbs, hardcoded phrases, and declared sources.
// "10k first-week streams" is checkable by anyone; it must pass. Also fixed:
// "released" was missing from the verb list (fatal for a record label), and
// the intake UI's own example ("funds in the bank") failed the gate.

const METRIC_PASSES = [
  '10k Spotify and Apple Music  streams at the end of the first week of release.', // the live rejection, verbatim
  '100 paying users',
  '30k monthly listeners on the artist profile',
  '500 units sold through the distributor',
  '3 shows booked and performed',
  '$25k in the bank',
  'funds in the bank', // the UI's own example for this question
];

const VERB_PASSES = [
  'Single released on Spotify and Apple Music.',
  'The album is live on Spotify.',
];

const STILL_FAIL = [
  'Marked complete',
  'Jericho shows it finished',
  'When it feels ready',
  'more streams than before', // no digit — vague stays vague
  'a lot of new listeners',
  'done',
];

// Rule 6 parity (2026-07-10): the reprobe banner says "say 'not started' or
// 'unknown' — that's fine", and hasAuthoredSubstance accepts these — so
// doneWhen must too. The operator hit "needs strategy" passing purpose but
// failing doneWhen: the escape hatch has to work on EVERY authored field.
const HONEST_INCOMPLETENESS = [
  'not started',
  'unknown',
  'needs strategy',
  'needs a plan',
  'not defined yet',
  'still deciding',
];

describe('isExternallyVerifiable — quantified metric evidence', () => {
  it.each(METRIC_PASSES)('passes metric evidence: %s', (s) => {
    expect(isExternallyVerifiable(s)).toBe(true);
  });
  it.each(VERB_PASSES)('passes released/live-on phrasing: %s', (s) => {
    expect(isExternallyVerifiable(s)).toBe(true);
  });
  it.each(STILL_FAIL)('still rejects attestation/vagueness: %s', (s) => {
    expect(isExternallyVerifiable(s)).toBe(false);
  });
  it.each(HONEST_INCOMPLETENESS)('passes honest incompleteness (Rule 6 parity): %s', (s) => {
    expect(isExternallyVerifiable(s)).toBe(true);
  });
});
