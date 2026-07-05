import { describe, it, expect } from 'vitest';
import { hasAuthoredSubstance } from '../../../src/domain/planQuality/hasAuthoredSubstance';

const SHOULD_NOW_PASS = [
  'mastered and live on DSPs',
  'filed with the USPTO and confirmed in the public record',
  'produced and delivered to the label',
  'confirmed in the DistroKid dashboard by checking the streams tab',
  'verified against the bank statement by opening the account',
];

const SHOULD_STILL_FAIL = [
  'Completed analysis',
  'Finished report',
  'Delivered package',
];

describe('PARTICIPLE_RE word-count fix', () => {
  it.each(SHOULD_NOW_PASS)('participle-led prose now passes: %s', (s) => {
    expect(hasAuthoredSubstance(s)).toBe(true);
  });
  it.each(SHOULD_STILL_FAIL)('short shell still fails: %s', (s) => {
    expect(hasAuthoredSubstance(s)).toBe(false);
  });
});
