import { describe, it, expect } from 'vitest';
import { isQuantifiableMetric } from './isQuantifiableMetric';

describe('isQuantifiableMetric', () => {
  it('passes metrics with a numeral', () => {
    expect(isQuantifiableMetric('10,000 first-week streams')).toBe(true);
    expect(isQuantifiableMetric('500 tickets sold')).toBe(true);
    expect(isQuantifiableMetric('100 paying users, $5k MRR')).toBe(true);
    expect(isQuantifiableMetric('3 full-manuscript requests')).toBe(true);
    expect(isQuantifiableMetric('50 signups')).toBe(true);
  });

  it('passes discrete binary milestones without a numeral', () => {
    // These are valid success criteria even though they have no number.
    expect(isQuantifiableMetric('accepted by an agent')).toBe(true);
    expect(isQuantifiableMetric('manuscript published')).toBe(true);
    expect(isQuantifiableMetric('signed by a label')).toBe(true);
    expect(isQuantifiableMetric('shipped to production')).toBe(true);
    expect(isQuantifiableMetric('launched in the App Store')).toBe(true);
    expect(isQuantifiableMetric('approved by the board')).toBe(true);
    expect(isQuantifiableMetric('distributed to stores')).toBe(true);
    expect(isQuantifiableMetric('submitted to three festivals')).toBe(true);
  });

  it('passes a numeral that rescues an otherwise quality-word metric', () => {
    // The numeral is the signal — don't penalize the quality word alongside it.
    expect(isQuantifiableMetric('grow revenue by 20%')).toBe(true);
    expect(isQuantifiableMetric('improve conversion 50%')).toBe(true);
  });

  it('fails bare unbounded-quality words with no numeral and no milestone', () => {
    expect(isQuantifiableMetric('do well in the market')).toBe(false);
    expect(isQuantifiableMetric('grow the audience')).toBe(false);
    expect(isQuantifiableMetric('improve conversion')).toBe(false);
    expect(isQuantifiableMetric('increase revenue')).toBe(false);
    expect(isQuantifiableMetric('more listeners')).toBe(false);
    expect(isQuantifiableMetric('better engagement')).toBe(false);
    expect(isQuantifiableMetric('succeed in the market')).toBe(false);
    expect(isQuantifiableMetric('progress on the goal')).toBe(false);
    expect(isQuantifiableMetric('achieve success')).toBe(false);
  });

  it('passes vague-but-non-lexicon values (floor stays coarse)', () => {
    // These are bad metrics, but catching subtle vagueness is the read-back's job.
    expect(isQuantifiableMetric('make my manager happy')).toBe(true);
    expect(isQuantifiableMetric('meaningful results')).toBe(true);
    expect(isQuantifiableMetric('good enough to pitch')).toBe(true);
  });

  it('returns false for empty or blank strings', () => {
    expect(isQuantifiableMetric('')).toBe(false);
    expect(isQuantifiableMetric('   ')).toBe(false);
    expect(isQuantifiableMetric(null as unknown as string)).toBe(false);
  });
});
