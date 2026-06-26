import { describe, it, expect } from 'vitest';
import { isHoldableNoun } from './isHoldableNoun';

describe('isHoldableNoun', () => {
  it('accepts concrete deliverable names', () => {
    expect(isHoldableNoun('Landing page')).toBe(true);
    expect(isHoldableNoun('API documentation')).toBe(true);
    expect(isHoldableNoun('Q2 report')).toBe(true);
    expect(isHoldableNoun('Marketing plan')).toBe(true);
    expect(isHoldableNoun('Romance Riot album')).toBe(true);
    expect(isHoldableNoun('Jericho System')).toBe(true);
    expect(isHoldableNoun('Product roadmap')).toBe(true);
    expect(isHoldableNoun('Dashboard v2')).toBe(true);
    expect(isHoldableNoun('Release notes')).toBe(true);
  });

  it('rejects imperative verb phrases (verb + article is the signal)', () => {
    expect(isHoldableNoun('Complete the landing page')).toBe(false);
    expect(isHoldableNoun('Build the API')).toBe(false);
    expect(isHoldableNoun('Create a marketing plan')).toBe(false);
    expect(isHoldableNoun('Fix the bug')).toBe(false);
    expect(isHoldableNoun('Launch the product')).toBe(false);
    expect(isHoldableNoun('Deploy the service')).toBe(false);
    expect(isHoldableNoun('Update the roadmap')).toBe(false);
    expect(isHoldableNoun('Ship the release')).toBe(false);
    expect(isHoldableNoun('Release the notes')).toBe(false);
  });

  it('accepts verb-noun compounds without an article (noun modifier, not command)', () => {
    // Same leading word as imperative verbs, but no article → reads as noun phrase.
    expect(isHoldableNoun('Release notes')).toBe(true);
    expect(isHoldableNoun('Build log')).toBe(true);
    expect(isHoldableNoun('Design system')).toBe(true);
    expect(isHoldableNoun('Test report')).toBe(true);
  });

  it('rejects gerund-led action phrases (gerund + article)', () => {
    expect(isHoldableNoun('Building the app')).toBe(false);
    expect(isHoldableNoun('Running the tests')).toBe(false);
    expect(isHoldableNoun('Completing a sprint')).toBe(false);
    expect(isHoldableNoun('Finishing the draft')).toBe(false);
  });

  it('accepts gerund-noun compounds that function as nouns', () => {
    // No article after the gerund — these are noun adjuncts, not action phrases.
    expect(isHoldableNoun('Marketing strategy')).toBe(true);
    expect(isHoldableNoun('Reporting dashboard')).toBe(true);
    expect(isHoldableNoun('Engineering brief')).toBe(true);
    expect(isHoldableNoun('Planning document')).toBe(true);
  });

  it('rejects past-participle-led phrases', () => {
    expect(isHoldableNoun('Completed analysis')).toBe(false);
    expect(isHoldableNoun('Finalized draft')).toBe(false);
    expect(isHoldableNoun('Written spec')).toBe(false);
    expect(isHoldableNoun('Reviewed design')).toBe(false);
  });

  it('does not misfire on short adjectives ending in common letter sequences', () => {
    // "Red" = r+ed but base is only 1 char, below the ≥2 threshold.
    expect(isHoldableNoun('Red flag metrics')).toBe(true);
  });

  it('returns false for empty or blank strings', () => {
    expect(isHoldableNoun('')).toBe(false);
    expect(isHoldableNoun('   ')).toBe(false);
    expect(isHoldableNoun(null as unknown as string)).toBe(false);
    expect(isHoldableNoun(undefined as unknown as string)).toBe(false);
  });
});
