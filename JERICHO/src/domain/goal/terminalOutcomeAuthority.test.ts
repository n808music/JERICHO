/**
 * terminalOutcomeAuthority.test.ts
 *
 * Phase 1 acceptance tests for deriveTerminalOutcomeAuthority.
 *
 * Structure:
 *  1. Audit pack verification matrix — all 7 audited goals must classify correctly
 *  2. Targeted signal tests — individual pattern coverage
 *  3. Confidence level tests
 *  4. Edge cases
 *
 * These tests run against the function directly, not through the intake contract.
 * Contract wiring is tested separately via existing probe test additions.
 */
import { describe, test, expect } from 'vitest';
import { deriveTerminalOutcomeAuthority } from './terminalOutcomeAuthority';

// ---------------------------------------------------------------------------
// Audit pack verification matrix
// ---------------------------------------------------------------------------
describe('Audit pack verification matrix', () => {
  test('ST-01 (landing page) → fully_controllable', () => {
    const result = deriveTerminalOutcomeAuthority(
      'Build and launch a landing page for my product in 60 days',
      'Landing page is live at a public URL. Email sign-up form works and collects submissions.'
    );
    expect(result.authority).toBe('fully_controllable');
    expect(result.reasons).toContain('SELF_CERTIFYING_ENDPOINT');
  });

  test('ST-02 (fitness goal) → fully_controllable', () => {
    const result = deriveTerminalOutcomeAuthority(
      'Train and complete a half marathon in under 2 hours within 70 days',
      'Half marathon completed. Finish time under 2:00:00 confirmed by race results.'
    );
    expect(result.authority).toBe('fully_controllable');
    expect(result.reasons).toContain('SELF_CERTIFYING_ENDPOINT');
  });

  test('ST-03 (brand launch) → mixed (page live + sign-up threshold)', () => {
    const result = deriveTerminalOutcomeAuthority(
      'Launch a brand identity and landing page for my consulting business within 60 days',
      'Brand logo, color palette, and tagline finalized. Landing page live. 50 email sign-ups collected.'
    );
    expect(result.authority).toBe('mixed');
    expect(result.reasons).toContain('SELF_CERTIFYING_ENDPOINT');
    expect(result.reasons).toContain('THRESHOLD_METRIC_DETECTED');
    expect(result.reasons).toContain('MULTIPLE_AUTHORITY_CLASSES');
  });

  test('LT-01 (podcast) → mixed (publish + listener growth)', () => {
    const result = deriveTerminalOutcomeAuthority(
      'Publish 24 episodes of my entrepreneurship podcast and grow to 1,000 monthly listeners',
      '24 episodes published to podcast directories. 1,000 monthly listeners reached by month 12.'
    );
    expect(result.authority).toBe('mixed');
    expect(result.reasons).toContain('SELF_CERTIFYING_ENDPOINT');
    expect(result.reasons).toContain('THRESHOLD_METRIC_DETECTED');
    expect(result.reasons).toContain('MULTIPLE_AUTHORITY_CLASSES');
  });

  test('LT-02 (fullstack + job) → mixed (portfolio = fc + offer letter = externally_mediated)', () => {
    const result = deriveTerminalOutcomeAuthority(
      'Learn full-stack web development, build a portfolio of 3 projects, and land a junior software engineer role within 18 months',
      '3 portfolio projects deployed and live on GitHub. Junior software engineer offer letter received.'
    );
    expect(result.authority).toBe('mixed');
    expect(result.reasons).toContain('RECEIVED_LANGUAGE');
    expect(result.reasons).toContain('SELF_CERTIFYING_ENDPOINT');
    expect(result.reasons).toContain('MULTIPLE_AUTHORITY_CLASSES');
  });

  test('LT-03 (job search) → externally_mediated', () => {
    const result = deriveTerminalOutcomeAuthority(
      'Get a full-time junior full-stack developer job within 6 months so I have a completed resume, polished portfolio, active application pipeline, interview-ready materials, and ongoing employer conversations.',
      'Active job offer letter from a full-time employer received. At least 15 applications submitted with at least 3 active interview processes documented.'
    );
    expect(result.authority).toBe('externally_mediated');
    expect(result.reasons).toContain('RECEIVED_LANGUAGE');
    expect(result.reasons).toContain('EXTERNAL_ACTOR_NAMED');
  });

  test('LT-04 (fundraising) → externally_mediated', () => {
    const result = deriveTerminalOutcomeAuthority(
      'Raise $50,000 in funding for my startup within 9 months so I have an investor deck, financial model, outreach pipeline, live investor conversations, and a signed investment commitment.',
      'Signed investment agreement received from at least one investor committing $50,000. Wire transfer confirmed.'
    );
    expect(result.authority).toBe('externally_mediated');
    expect(result.reasons).toContain('RECEIVED_LANGUAGE');
    expect(result.reasons).toContain('EXTERNAL_ACTOR_NAMED');
    // $50,000 is a commitment amount, not a market threshold — THRESHOLD_METRIC_DETECTED does not fire
  });
});

// ---------------------------------------------------------------------------
// Targeted signal tests
// ---------------------------------------------------------------------------
describe('Signal: externally_mediated', () => {
  test('offer letter received → externally_mediated (high confidence)', () => {
    const result = deriveTerminalOutcomeAuthority(
      'Land a job at a tech company',
      'Offer letter received from employer.'
    );
    expect(result.authority).toBe('externally_mediated');
    expect(result.confidence).toBe('high');
    expect(result.reasons).toContain('RECEIVED_LANGUAGE');
    expect(result.reasons).toContain('EXTERNAL_ACTOR_NAMED');
  });

  test('signed agreement + investor → externally_mediated (high confidence)', () => {
    const result = deriveTerminalOutcomeAuthority(
      'Close a funding round',
      'Signed investment agreement received from investor.'
    );
    expect(result.authority).toBe('externally_mediated');
    expect(result.confidence).toBe('high');
  });

  test('accepted by publisher → externally_mediated', () => {
    const result = deriveTerminalOutcomeAuthority(
      'Submit my manuscript to literary agents',
      'Manuscript accepted by publisher. Letter of intent signed.'
    );
    expect(result.authority).toBe('externally_mediated');
    expect(result.reasons).toContain('RECEIVED_LANGUAGE');
    expect(result.reasons).toContain('EXTERNAL_ACTOR_NAMED');
  });

  test('client signed contract → externally_mediated', () => {
    const result = deriveTerminalOutcomeAuthority(
      'Close my first consulting client',
      'Client signed contract received. First invoice paid.'
    );
    expect(result.authority).toBe('externally_mediated');
  });

  test('wire transfer confirmed → externally_mediated', () => {
    const result = deriveTerminalOutcomeAuthority(
      'Complete the fundraise',
      'Wire transfer confirmed from investor.'
    );
    expect(result.authority).toBe('externally_mediated');
    expect(result.reasons).toContain('EXTERNAL_ACTOR_NAMED');
  });

  test('land a job framing → externally_mediated', () => {
    const result = deriveTerminalOutcomeAuthority(
      'Land a full-time role as a data scientist within 6 months',
      'Offer accepted. Start date confirmed.'
    );
    expect(result.authority).toBe('externally_mediated');
  });
});

describe('Signal: market_dependent', () => {
  test('listener threshold → market_dependent', () => {
    const result = deriveTerminalOutcomeAuthority(
      'Grow my podcast audience',
      '1,000 monthly listeners reached.'
    );
    expect(result.authority).toBe('market_dependent');
    expect(result.reasons).toContain('THRESHOLD_METRIC_DETECTED');
  });

  test('follower count → market_dependent', () => {
    const result = deriveTerminalOutcomeAuthority(
      'Build a social media presence for my brand',
      '500 followers on Instagram. 200 email subscribers.'
    );
    expect(result.authority).toBe('market_dependent');
    expect(result.reasons).toContain('THRESHOLD_METRIC_DETECTED');
  });

  test('MRR threshold → market_dependent', () => {
    const result = deriveTerminalOutcomeAuthority(
      'Grow my SaaS to profitability',
      '$5,000 MRR achieved.'
    );
    expect(result.authority).toBe('market_dependent');
    expect(result.reasons).toContain('THRESHOLD_METRIC_DETECTED');
  });

  test('sign-up threshold → market_dependent', () => {
    const result = deriveTerminalOutcomeAuthority(
      'Launch my landing page and collect early interest',
      '50 sign-ups collected from the waitlist page.'
    );
    expect(result.authority).toBe('market_dependent');
    expect(result.reasons).toContain('THRESHOLD_METRIC_DETECTED');
  });
});

describe('Signal: fully_controllable', () => {
  test('deployed artifact → fully_controllable', () => {
    const result = deriveTerminalOutcomeAuthority(
      'Build and ship a portfolio website',
      'Website deployed and live at public URL.'
    );
    expect(result.authority).toBe('fully_controllable');
    expect(result.reasons).toContain('SELF_CERTIFYING_ENDPOINT');
  });

  test('published content → fully_controllable', () => {
    const result = deriveTerminalOutcomeAuthority(
      'Write and publish a technical blog post series',
      'Five posts published on personal blog.'
    );
    expect(result.authority).toBe('fully_controllable');
    expect(result.reasons).toContain('SELF_CERTIFYING_ENDPOINT');
  });

  test('course completed → fully_controllable', () => {
    const result = deriveTerminalOutcomeAuthority(
      'Complete the AWS Solutions Architect certification course',
      'All modules completed. Practice exam passed.'
    );
    expect(result.authority).toBe('fully_controllable');
    expect(result.reasons).toContain('SELF_CERTIFYING_ENDPOINT');
  });
});

describe('Mixed authority', () => {
  test('build portfolio AND get hired → mixed', () => {
    const result = deriveTerminalOutcomeAuthority(
      'Build a design portfolio and land a UX designer job',
      'Portfolio published with 5 case studies. Offer letter from employer received.'
    );
    expect(result.authority).toBe('mixed');
    expect(result.reasons).toContain('MULTIPLE_AUTHORITY_CLASSES');
    expect(result.reasons).toContain('SELF_CERTIFYING_ENDPOINT');
    expect(result.reasons).toContain('RECEIVED_LANGUAGE');
  });

  test('launch product AND grow users → mixed', () => {
    const result = deriveTerminalOutcomeAuthority(
      'Launch my app and grow to 100 users in 60 days',
      'App live in App Store. 100 active users.'
    );
    expect(result.authority).toBe('mixed');
    expect(result.reasons).toContain('MULTIPLE_AUTHORITY_CLASSES');
  });
});

// ---------------------------------------------------------------------------
// Confidence levels
// ---------------------------------------------------------------------------
describe('Confidence levels', () => {
  test('multiple strong externally_mediated signals → high confidence', () => {
    const result = deriveTerminalOutcomeAuthority(
      'Raise $100K from angel investors',
      'Signed investment agreement received from investor. Wire transfer confirmed.'
    );
    expect(result.confidence).toBe('high');
  });

  test('single strong signal → medium confidence', () => {
    const result = deriveTerminalOutcomeAuthority(
      'Build a website',
      'Website deployed.'
    );
    expect(result.confidence).toBe('medium');
    expect(result.authority).toBe('fully_controllable');
  });

  test('no signals → unknown, low confidence', () => {
    const result = deriveTerminalOutcomeAuthority(
      'Do something great',
      'It goes well.'
    );
    expect(result.authority).toBe('unknown');
    expect(result.confidence).toBe('low');
    expect(result.reasons).toContain('INSUFFICIENT_SIGNAL');
  });
});

// ---------------------------------------------------------------------------
// Edge cases
// ---------------------------------------------------------------------------
describe('Edge cases', () => {
  test('empty strings → unknown', () => {
    const result = deriveTerminalOutcomeAuthority('', '');
    expect(result.authority).toBe('unknown');
    expect(result.reasons).toContain('INSUFFICIENT_SIGNAL');
    expect(result.confidence).toBe('low');
  });

  test('goal text only, no verification text → classifies from goal text', () => {
    const result = deriveTerminalOutcomeAuthority(
      'Get a job offer from a tech employer within 6 months',
      ''
    );
    expect(result.authority).toBe('externally_mediated');
  });

  test('verification text only → classifies from verification text', () => {
    const result = deriveTerminalOutcomeAuthority(
      '',
      'Offer letter received from employer.'
    );
    expect(result.authority).toBe('externally_mediated');
  });

  test('LT-05 preview — sales close → externally_mediated', () => {
    // Preview for the next planned audit goal
    const result = deriveTerminalOutcomeAuthority(
      'Close $10,000 in sales for my service business in 90 days so I have an offer, outreach pipeline, active sales conversations, signed client agreements, and collected payment.',
      'At least $10,000 in signed client agreements received. Payment collected from at least 2 clients.'
    );
    expect(result.authority).toBe('externally_mediated');
    expect(result.reasons).toContain('RECEIVED_LANGUAGE');
  });
});
