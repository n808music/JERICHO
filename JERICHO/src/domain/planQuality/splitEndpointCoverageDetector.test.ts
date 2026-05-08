/**
 * splitEndpointCoverageDetector.test.ts
 *
 * Tests for hasSecondaryEndpointCoverage.
 *
 * Structure:
 *  1. Per-endpoint-type true positives — coverage detected
 *  2. Per-endpoint-type true negatives — opposite-dimension deliverables must not fire
 *  3. Edge cases — unknown endpoint, empty plan, single deliverable
 *  4. Full-plan tests — LT-02 split scenarios (canonical Phase D proof cases)
 */
import { describe, test, expect } from 'vitest';
import { hasSecondaryEndpointCoverage } from './splitEndpointCoverageDetector';

// ---------------------------------------------------------------------------
// 1. Per-endpoint-type true positives
// ---------------------------------------------------------------------------
describe('offer_received / hired dimension: true positives', () => {
  test('submit application → job search coverage', () => {
    expect(hasSecondaryEndpointCoverage('offer_received', [
      'Submit first tailored application batch',
    ])).toBe(true);
  });

  test('target company list → job search coverage', () => {
    expect(hasSecondaryEndpointCoverage('offer_received', [
      'Build target company list and prioritization model',
    ])).toBe(true);
  });

  test('interview prep → job search coverage', () => {
    expect(hasSecondaryEndpointCoverage('offer_received', [
      'Prepare interview story bank and answer framework',
    ])).toBe(true);
  });

  test('offer letter → job search coverage', () => {
    expect(hasSecondaryEndpointCoverage('hired', [
      'Receive and evaluate job offers from target employers',
    ])).toBe(true);
  });

  test('outreach to employer → job search coverage', () => {
    expect(hasSecondaryEndpointCoverage('offer_received', [
      'Send outreach emails to 30 target employers',
    ])).toBe(true);
  });

  test('log responses and manage active interview stages → job search coverage', () => {
    expect(hasSecondaryEndpointCoverage('offer_received', [
      'Log responses and manage active interview stages',
    ])).toBe(true);
  });
});

describe('capital_secured / signed_commitment dimension: true positives', () => {
  test('investor outreach → fundraising coverage', () => {
    expect(hasSecondaryEndpointCoverage('capital_secured', [
      'Run first wave of investor outreach and meetings',
    ])).toBe(true);
  });

  test('pitch deck → fundraising coverage', () => {
    expect(hasSecondaryEndpointCoverage('capital_secured', [
      'Build fundraising narrative and deck storyline',
    ])).toBe(true);
  });

  test('investor list → fundraising coverage', () => {
    expect(hasSecondaryEndpointCoverage('signed_commitment', [
      'Build target investor list and fit scoring model',
    ])).toBe(true);
  });

  test('diligence checklist → fundraising coverage', () => {
    expect(hasSecondaryEndpointCoverage('capital_secured', [
      'Create diligence checklist and data room structure',
    ])).toBe(true);
  });

  test('term discussions → fundraising coverage', () => {
    expect(hasSecondaryEndpointCoverage('capital_secured', [
      'Coordinate term discussions and commitment tracking',
    ])).toBe(true);
  });
});

describe('published_live dimension: true positives', () => {
  test('publish episodes → published_live coverage', () => {
    expect(hasSecondaryEndpointCoverage('published_live', [
      'Publish episodes to podcast directories',
    ])).toBe(true);
  });

  test('record and edit episode → published_live coverage', () => {
    expect(hasSecondaryEndpointCoverage('published_live', [
      'Record and edit episode batch for release',
    ])).toBe(true);
  });

  test('release article → published_live coverage', () => {
    expect(hasSecondaryEndpointCoverage('published_live', [
      'Release first article to newsletter audience',
    ])).toBe(true);
  });
});

describe('artifact_complete dimension: true positives', () => {
  test('portfolio project → artifact coverage', () => {
    expect(hasSecondaryEndpointCoverage('artifact_complete', [
      'Complete first full-stack portfolio project and walkthrough',
    ])).toBe(true);
  });

  test('build landing page → artifact coverage', () => {
    expect(hasSecondaryEndpointCoverage('artifact_complete', [
      'Build and deploy landing page for product',
    ])).toBe(true);
  });

  test('deploy app → artifact coverage', () => {
    expect(hasSecondaryEndpointCoverage('artifact_complete', [
      'Deploy web app to production environment',
    ])).toBe(true);
  });

  test('develop features → artifact coverage', () => {
    expect(hasSecondaryEndpointCoverage('artifact_complete', [
      'Develop core features for MVP release',
    ])).toBe(true);
  });
});

describe('audience_threshold / revenue_threshold dimension: true positives', () => {
  test('grow audience → market coverage', () => {
    expect(hasSecondaryEndpointCoverage('audience_threshold', [
      'Grow podcast audience through guest appearances and cross-promotion',
    ])).toBe(true);
  });

  test('distribution channel → market coverage', () => {
    expect(hasSecondaryEndpointCoverage('revenue_threshold', [
      'Set up distribution channels and launch marketing campaign',
    ])).toBe(true);
  });

  test('email list building → market coverage', () => {
    expect(hasSecondaryEndpointCoverage('audience_threshold', [
      'Build email list with lead magnets and sign-up forms',
    ])).toBe(true);
  });

  test('revenue tracking → market coverage', () => {
    expect(hasSecondaryEndpointCoverage('revenue_threshold', [
      'Track MRR growth and optimize pricing model',
    ])).toBe(true);
  });
});

describe('certification_earned dimension: true positives', () => {
  test('study curriculum → certification coverage', () => {
    expect(hasSecondaryEndpointCoverage('certification_earned', [
      'Complete AWS study curriculum and practice modules',
    ])).toBe(true);
  });

  test('practice exam → certification coverage', () => {
    expect(hasSecondaryEndpointCoverage('certification_earned', [
      'Complete practice exams and review weak areas',
    ])).toBe(true);
  });

  test('certification prep → certification coverage', () => {
    expect(hasSecondaryEndpointCoverage('certification_earned', [
      'Prepare for PMP certification exam',
    ])).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 2. True negatives — opposite-dimension deliverables must not fire
// ---------------------------------------------------------------------------
describe('Cross-dimension isolation: job search deliverables must not fire as fundraising', () => {
  const jobPlan = [
    'Define target role family and search criteria',
    'Tailor resume and portfolio for target roles',
    'Build target company list and prioritization model',
    'Submit first tailored application batch',
    'Prepare interview story bank and answer framework',
    'Run mock interviews and follow-up practice',
  ];

  test('job plan does not cover fundraising dimension', () => {
    expect(hasSecondaryEndpointCoverage('capital_secured', jobPlan)).toBe(false);
    expect(hasSecondaryEndpointCoverage('signed_commitment', jobPlan)).toBe(false);
  });
});

describe('Cross-dimension isolation: fundraising deliverables must not fire as job search', () => {
  const fundraisingPlan = [
    'Define raise objective, use-of-funds, and investor thesis',
    'Build fundraising narrative and deck storyline',
    'Create diligence checklist and data room structure',
    'Build target investor list and fit scoring model',
    'Prepare outreach sequences and intro request scripts',
    'Run first wave of investor outreach and meetings',
    'Deliver follow-up materials and manage diligence requests',
    'Coordinate term discussions and commitment tracking',
  ];

  test('fundraising plan does not cover job search dimension', () => {
    expect(hasSecondaryEndpointCoverage('offer_received', fundraisingPlan)).toBe(false);
    expect(hasSecondaryEndpointCoverage('hired', fundraisingPlan)).toBe(false);
  });
});

describe('Cross-dimension isolation: portfolio/skill deliverables for artifact dimension', () => {
  const skillPlan = [
    'Establish baseline in full-stack web development',
    'Complete first portfolio project and walkthrough',
    'Complete second portfolio project with higher complexity',
    'Produce proof artifact showing full-stack development',
    'Run final readiness review',
  ];

  test('skill plan covers artifact dimension', () => {
    // Portfolio projects are build/complete activities → artifact_complete covered
    expect(hasSecondaryEndpointCoverage('artifact_complete', skillPlan)).toBe(true);
  });

  test('skill plan does not cover job search dimension', () => {
    // Skill plan has no job-search pipeline vocabulary
    expect(hasSecondaryEndpointCoverage('offer_received', skillPlan)).toBe(false);
  });

  test('skill plan does not cover fundraising dimension', () => {
    expect(hasSecondaryEndpointCoverage('capital_secured', skillPlan)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 3. Edge cases
// ---------------------------------------------------------------------------
describe('Edge cases', () => {
  test('unknown endpoint → always returns true (no check)', () => {
    expect(hasSecondaryEndpointCoverage('unknown', ['any deliverable here'])).toBe(true);
    expect(hasSecondaryEndpointCoverage('unknown', [])).toBe(true);
  });

  test('empty deliverable list → returns true (no negative signal)', () => {
    expect(hasSecondaryEndpointCoverage('offer_received', [])).toBe(true);
    expect(hasSecondaryEndpointCoverage('capital_secured', [])).toBe(true);
  });

  test('single matching deliverable → sufficient for coverage', () => {
    expect(hasSecondaryEndpointCoverage('offer_received', [
      'Submit first tailored application batch',
    ])).toBe(true);
  });

  test('single non-matching deliverable → no coverage', () => {
    expect(hasSecondaryEndpointCoverage('offer_received', [
      'Establish baseline in full-stack web development',
    ])).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 4. Full-plan tests — LT-02 split scenarios (canonical Phase D proof cases)
// ---------------------------------------------------------------------------
describe('LT-02 split scenarios', () => {
  // LT-02 split: primaryEndpoint = artifact_complete, secondaryEndpoint = offer_received
  // A skill-only plan covers the artifact dimension but not the job-search dimension.

  test('LT-02 skill-only plan → offer_received dimension NOT covered', () => {
    const skillOnlyPlan = [
      'Establish baseline in full-stack web development',
      'Complete first full-stack web development portfolio project and walkthrough',
      'Complete second full-stack web development portfolio project with higher complexity',
      'Complete full-stack web development portfolio project 3 and evidence summary',
      'Produce proof artifact showing full-stack web development',
      'Run final readiness review for full-stack web development',
    ];
    // Secondary endpoint (offer_received) has zero job-search vocabulary
    expect(hasSecondaryEndpointCoverage('offer_received', skillOnlyPlan)).toBe(false);
  });

  test('LT-02 skill-only plan → artifact_complete dimension IS covered', () => {
    const skillOnlyPlan = [
      'Establish baseline in full-stack web development',
      'Complete first full-stack web development portfolio project and walkthrough',
      'Complete second full-stack web development portfolio project with higher complexity',
    ];
    // Primary endpoint (artifact_complete) has build/complete vocabulary
    expect(hasSecondaryEndpointCoverage('artifact_complete', skillOnlyPlan)).toBe(true);
  });

  test('LT-02 full pipeline → offer_received dimension IS covered', () => {
    const fullPipeline = [
      'Establish baseline in full-stack web development',
      'Complete first full-stack portfolio project and walkthrough',
      'Complete second full-stack portfolio project with higher complexity',
      'Complete portfolio project 3 and evidence summary',
      'Define target role family and search criteria',
      'Tailor resume and portfolio for target roles',
      'Submit first tailored application batch',
      'Prepare interview story bank and answer framework',
      'Log responses and manage active interview stages',
    ];
    // Secondary endpoint (offer_received) has job-search vocabulary
    expect(hasSecondaryEndpointCoverage('offer_received', fullPipeline)).toBe(true);
    // Primary endpoint (artifact_complete) also covered
    expect(hasSecondaryEndpointCoverage('artifact_complete', fullPipeline)).toBe(true);
  });

  test('LT-02 job-search-only plan → artifact_complete dimension NOT covered', () => {
    // Hypothetical: plan has job-search deliverables only, no portfolio work
    const jobOnlyPlan = [
      'Define target role family and search criteria',
      'Tailor resume and portfolio for target roles',
      'Build target company list and prioritization model',
      'Submit first tailored application batch',
      'Log responses and manage active interview stages',
    ];
    // Primary artifact_complete has no build/deploy vocabulary in this plan
    // (Note: "Tailor resume and portfolio" has "portfolio" but no build/deploy)
    expect(hasSecondaryEndpointCoverage('artifact_complete', jobOnlyPlan)).toBe(false);
  });

  test('SaaS + MRR split: product-only plan → revenue_threshold dimension NOT covered', () => {
    const productOnlyPlan = [
      'Define SaaS product requirements and core features',
      'Build and deploy core product functionality',
      'Complete MVP and deploy to production',
      'Run final product quality review',
    ];
    expect(hasSecondaryEndpointCoverage('revenue_threshold', productOnlyPlan)).toBe(false);
  });

  test('SaaS + MRR split: full plan → revenue_threshold dimension IS covered', () => {
    const fullSaaSPlan = [
      'Build and deploy core product functionality',
      'Complete MVP and deploy to production',
      'Set up distribution channels and launch marketing campaign',
      'Build email list and grow subscriber base',
      'Track MRR growth and optimize pricing',
    ];
    expect(hasSecondaryEndpointCoverage('revenue_threshold', fullSaaSPlan)).toBe(true);
    expect(hasSecondaryEndpointCoverage('artifact_complete', fullSaaSPlan)).toBe(true);
  });
});
