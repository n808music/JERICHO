import { describe, it, expect } from 'vitest';
import { hasAuthoredSubstance } from './hasAuthoredSubstance';
import { isExternallyVerifiable } from './isExternallyVerifiable';

// Corpus seeded from the real Operation Endgame Canonical Matrix, Section 2.
// The masterplan is the spec: every authored field must pass; in-domain shells
// and Attestation breaches must fail.

const REAL_PURPOSES = [
  'Parent co, head of the snake for Operation Endgame and all future ops',
  'Media production house — owns all visual content for the enterprise',
  'Jericho, the technological expression of a manifestation system',
  'Independent music label consolidating released catalog and 30k audience',
  'Real estate company housing the 79th Street renovation and corridor acquisition',
  'Luxury private-school franchise serving gifted children ages 6 to 12',
  'Energy and focus supplement company, a healthier alternative to energy drinks',
];

const REAL_STATUS = [
  'Only legally-formed entity, a registered LLC',
  'Podcast studio exists, 1 draft episode, 10 topic ideas',
  'Jericho vibecoded on MacBook; provisional patent lapses Nov 16 2026',
  '7 albums, 30k monthly listeners, recording gear, 1 album mixed not mastered',
  'Named only, no real estate owned or controlled',
];

const REAL_DONEWHEN = [
  'Gum manufactured, on shelves, generating recurring revenue',
  'Corridor acquired and first property restored',
  'First Academy open in Chicago',
  'Registered LLC with the secretary of state',
];

const SHELLS = [
  'Manages the business operations',
  'Drives growth and value',
  'Delivers solutions and capabilities',
  '',
];

const BREACHES = ['Marked complete', 'Jericho shows it finished', 'When it feels ready'];

const DECLARED = ['Spotify for Artists', 'DistroKid', 'Stripe'];

describe('hasAuthoredSubstance — Operation Endgame corpus', () => {
  it.each(REAL_PURPOSES)('passes real purpose: %s', (s) => {
    expect(hasAuthoredSubstance(s)).toBe(true);
  });
  it.each(REAL_STATUS)('passes real status evidence: %s', (s) => {
    expect(hasAuthoredSubstance(s)).toBe(true);
  });
  it.each(SHELLS)('rejects shell: %s', (s) => {
    expect(hasAuthoredSubstance(s)).toBe(false);
  });
});

describe('isExternallyVerifiable — Operation Endgame corpus', () => {
  it.each(REAL_DONEWHEN)('passes real done-when: %s', (s) => {
    expect(isExternallyVerifiable(s, DECLARED)).toBe(true);
  });
  it.each(BREACHES)('rejects attestation breach: %s', (s) => {
    expect(isExternallyVerifiable(s, DECLARED)).toBe(false);
  });
});
