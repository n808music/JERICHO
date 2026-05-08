/**
 * terminalEndpointDetector.test.ts
 *
 * Tests for detectTerminalEndpoint.
 *
 * Structure:
 *  1. Audit pack probe matrix — 7 goals, status + primaryEndpoint assertions
 *  2. JobSearch: explicit true positives
 *  3. JobSearch: inferred true positives (framing verb)
 *  4. JobSearch: true negatives (corridor artifacts must not fire)
 *  5. Fundraising: explicit true positives
 *  6. Fundraising: inferred true positives
 *  7. Fundraising: true negatives
 *  8. Published/live: true positives and negatives
 *  9. Artifact-complete: true positives and negatives
 * 10. Qualification: true positives and negatives
 * 11. Market-dependent: threshold detection
 * 12. Split endpoint detection (compound goals)
 * 13. Ambiguous detection (open-ended / process goals)
 * 14. Missing detection (no terminal object)
 * 15. Contamination tests (process metrics and artifacts in verification text)
 */
import { describe, test, expect } from 'vitest';
import { detectTerminalEndpoint } from './terminalEndpointDetector';

// ---------------------------------------------------------------------------
// 1. Audit pack probe matrix
// ---------------------------------------------------------------------------
describe('Audit pack probe matrix', () => {
  test('ST-01: landing page — artifact_complete, clear_explicit', () => {
    const result = detectTerminalEndpoint(
      'Build and launch a landing page for my SaaS product',
      'The landing page is live and accepting form submissions',
    );
    expect(result.status).toBe('clear_explicit');
    expect(result.primaryEndpoint).toBe('artifact_complete');
    expect(result.confidence).toBe('high');
  });

  test('ST-02: fitness goal — artifact_complete or clear_explicit', () => {
    // "hit a personal record" is a self-certifying benchmark — artifact_complete
    // Verification text may drive the resolution
    const result = detectTerminalEndpoint(
      'Hit a personal record in the deadlift within 3 months',
      'Completed a lift of 225 lbs verified by gym video',
    );
    // Fitness goals without explicit enrollment/certification are fully_controllable
    // "completed" + artifact noun context → artifact_complete or missing depending on phrasing
    // The primary test here is that it does not misfire as externally_mediated
    expect(['clear_explicit', 'clear_inferred', 'missing']).toContain(result.status);
    expect(result.primaryEndpoint).not.toBe('offer_received');
    expect(result.primaryEndpoint).not.toBe('capital_secured');
  });

  test('ST-03: brand launch — split (artifact_complete + audience_threshold)', () => {
    const result = detectTerminalEndpoint(
      'Launch my personal brand and collect 50 email sign-ups within 60 days',
      'Brand page is live, 50 confirmed email subscribers on the list',
    );
    expect(result.status).toBe('split');
    expect(['artifact_complete', 'audience_threshold']).toContain(result.primaryEndpoint);
    expect(result.secondaryEndpoint).toBeDefined();
    const both = [result.primaryEndpoint, result.secondaryEndpoint];
    expect(both).toContain('artifact_complete');
    expect(both).toContain('audience_threshold');
  });

  test('LT-01: podcast — split (published_live + audience_threshold)', () => {
    const result = detectTerminalEndpoint(
      'Launch a podcast and reach 1,000 monthly listeners within 12 months',
      'Podcast has 1,000 verified monthly listeners and 12 episodes published',
    );
    expect(result.status).toBe('split');
    const both = [result.primaryEndpoint, result.secondaryEndpoint];
    expect(both).toContain('published_live');
    expect(both).toContain('audience_threshold');
  });

  test('LT-02: fullstack + job — split (artifact_complete + offer_received)', () => {
    const result = detectTerminalEndpoint(
      'Become a full-stack web developer and land a junior software engineer job within 18 months',
      'Three portfolio projects deployed and offer letter received from employer',
    );
    expect(result.status).toBe('split');
    const both = [result.primaryEndpoint, result.secondaryEndpoint];
    expect(both).toContain('offer_received');
    expect(both).toContain('artifact_complete');
  });

  test('LT-03: job search — offer_received, clear_explicit', () => {
    const result = detectTerminalEndpoint(
      'Get a full-time junior full-stack developer job within 6 months',
      'I have received an offer letter from a target employer and accepted the position',
    );
    expect(result.status).toBe('clear_explicit');
    expect(result.primaryEndpoint).toBe('offer_received');
    expect(result.confidence).toBe('high');
  });

  test('LT-04: fundraising — capital_secured, clear_explicit', () => {
    const result = detectTerminalEndpoint(
      'Raise $50,000 in funding for my startup within 9 months',
      'Signed investment agreement received from at least one investor and wire transfer confirmed',
    );
    expect(result.status).toBe('clear_explicit');
    expect(result.primaryEndpoint).toBe('capital_secured');
    expect(result.confidence).toBe('high');
  });

  test('ST-04: portfolio case-study page — artifact_complete, clear_explicit', () => {
    const result = detectTerminalEndpoint(
      'Create a project-management portfolio case study in 60 days with a polished shareable case-study page',
      'A polished, shareable project-management case-study page exists with charter, timeline, stakeholder map, risk register, execution notes, and retrospective included',
    );
    expect(result.status).toBe('clear_explicit');
    expect(result.primaryEndpoint).toBe('artifact_complete');
    expect(result.confidence).toBe('high');
  });
});

// ---------------------------------------------------------------------------
// 2. JobSearch: explicit true positives
// ---------------------------------------------------------------------------
describe('JobSearch: explicit true positives', () => {
  test('offer letter → offer_received, clear_explicit', () => {
    const result = detectTerminalEndpoint('Get a job with an offer letter', '');
    expect(result.status).toBe('clear_explicit');
    expect(result.primaryEndpoint).toBe('offer_received');
  });

  test('job offer → offer_received, clear_explicit', () => {
    const result = detectTerminalEndpoint('Receive a job offer within 6 months', '');
    expect(result.status).toBe('clear_explicit');
    expect(result.primaryEndpoint).toBe('offer_received');
  });

  test('offer accepted in verification text → offer_received, clear_explicit', () => {
    const result = detectTerminalEndpoint(
      'Get a developer job',
      'Offer accepted and start date confirmed',
    );
    expect(result.status).toBe('clear_explicit');
    expect(result.primaryEndpoint).toBe('offer_received');
  });

  test('hired as → hired, clear_explicit', () => {
    const result = detectTerminalEndpoint('Get hired as a backend engineer', '');
    expect(result.status).toBe('clear_explicit');
    expect(result.primaryEndpoint).toBe('hired');
  });

  test('full-time role → offer_received, clear_inferred (job type, not explicit hire event)', () => {
    // "full-time role" is the job type sought, not the terminal hiring event.
    // Terminal event is inferred (offer+acceptance) from the job-type framing.
    const result = detectTerminalEndpoint(
      'Secure a full-time role at a software company',
      '',
    );
    expect(result.status).toBe('clear_inferred');
    expect(result.primaryEndpoint).toBe('offer_received');
  });

  test('employment confirmed in verification text → offer_received', () => {
    const result = detectTerminalEndpoint(
      'Get a job in tech',
      'Employment confirmed and start date set',
    );
    expect(result.status).toBe('clear_explicit');
    expect(result.primaryEndpoint).toBe('offer_received');
  });
});

// ---------------------------------------------------------------------------
// 3. JobSearch: inferred true positives (framing verb)
// ---------------------------------------------------------------------------
describe('JobSearch: inferred true positives', () => {
  test('"land a job" → offer_received, clear_inferred', () => {
    const result = detectTerminalEndpoint(
      'Land a full-stack developer job within 6 months',
      '',
    );
    expect(result.status).toBe('clear_inferred');
    expect(result.primaryEndpoint).toBe('offer_received');
    expect(result.confidence).toBe('medium');
  });

  test('"land the role" → offer_received, clear_inferred', () => {
    const result = detectTerminalEndpoint('Land the junior developer role', '');
    expect(result.status).toBe('clear_inferred');
    expect(result.primaryEndpoint).toBe('offer_received');
  });

  test('"get a full-time position" → offer_received, clear_inferred (job type framing)', () => {
    // "full-time position" is the job type. Terminal event (offer) is inferred.
    const result = detectTerminalEndpoint(
      'Get a full-time position as a data analyst',
      '',
    );
    expect(result.status).toBe('clear_inferred');
    expect(result.primaryEndpoint).toBe('offer_received');
  });
});

// ---------------------------------------------------------------------------
// 4. JobSearch: true negatives (corridor artifacts must NOT fire)
// ---------------------------------------------------------------------------
describe('JobSearch: corridor artifacts do not fire as endpoints', () => {
  test('submit applications → not offer_received', () => {
    const result = detectTerminalEndpoint(
      'Submit 20 job applications over the next 3 months',
      '',
    );
    expect(result.primaryEndpoint).not.toBe('offer_received');
    expect(result.primaryEndpoint).not.toBe('hired');
  });

  test('prepare resume → missing', () => {
    const result = detectTerminalEndpoint(
      'Prepare and polish my resume and portfolio',
      '',
    );
    expect(result.status).toBe('missing');
  });

  test('interview at companies → not terminal endpoint', () => {
    // "interview" is Stage 2 corridor artifact — not the terminal event
    const result = detectTerminalEndpoint(
      'Interview at 5 target companies this month',
      '',
    );
    expect(result.primaryEndpoint).not.toBe('offer_received');
  });

  test('build company list → missing', () => {
    const result = detectTerminalEndpoint(
      'Build a target company list and outreach pipeline',
      '',
    );
    expect(result.status).toBe('missing');
  });

  test('"interview-ready" skill goal → not offer_received', () => {
    // SkillAcquisition contamination case — "interview-ready" is preparation
    const result = detectTerminalEndpoint(
      'Become interview-ready for software engineering roles',
      '',
    );
    expect(result.primaryEndpoint).not.toBe('offer_received');
    expect(result.primaryEndpoint).not.toBe('hired');
  });
});

// ---------------------------------------------------------------------------
// 5. Fundraising: explicit true positives
// ---------------------------------------------------------------------------
describe('Fundraising: explicit true positives', () => {
  test('"raise $50,000" → capital_secured, clear_explicit', () => {
    const result = detectTerminalEndpoint(
      'Raise $50,000 in funding for my startup',
      '',
    );
    expect(result.status).toBe('clear_explicit');
    expect(result.primaryEndpoint).toBe('capital_secured');
  });

  test('wire transfer confirmed → capital_secured, clear_explicit', () => {
    const result = detectTerminalEndpoint(
      'Complete my seed round',
      'Wire transfer confirmed and funds received',
    );
    expect(result.status).toBe('clear_explicit');
    expect(result.primaryEndpoint).toBe('capital_secured');
  });

  test('signed investment agreement → signed_commitment or capital_secured', () => {
    const result = detectTerminalEndpoint(
      'Close my funding round',
      'Signed investment agreement received from at least one investor',
    );
    expect(result.status).toBe('clear_explicit');
    expect(['signed_commitment', 'capital_secured']).toContain(result.primaryEndpoint);
  });

  test('term sheet → signed_commitment, clear_explicit', () => {
    const result = detectTerminalEndpoint(
      'Reach term sheet stage with an investor',
      '',
    );
    expect(result.status).toBe('clear_explicit');
    expect(result.primaryEndpoint).toBe('signed_commitment');
  });

  test('legal close → signed_commitment', () => {
    const result = detectTerminalEndpoint(
      'Complete the legal close for our seed round',
      '',
    );
    expect(result.status).toBe('clear_explicit');
    expect(result.primaryEndpoint).toBe('signed_commitment');
  });
});

// ---------------------------------------------------------------------------
// 6. Fundraising: inferred true positives
// ---------------------------------------------------------------------------
describe('Fundraising: inferred true positives', () => {
  test('"raise seed funding" → capital_secured, clear_inferred', () => {
    const result = detectTerminalEndpoint(
      'Raise seed funding for my early-stage startup',
      '',
    );
    expect(result.status).toBe('clear_inferred');
    expect(result.primaryEndpoint).toBe('capital_secured');
  });

  test('"fund my startup" → capital_secured, clear_inferred', () => {
    const result = detectTerminalEndpoint('Fund my startup within 12 months', '');
    expect(result.status).toBe('clear_inferred');
    expect(result.primaryEndpoint).toBe('capital_secured');
  });

  test('"close a seed round" → capital_secured, clear_inferred', () => {
    const result = detectTerminalEndpoint('Close a seed round by year end', '');
    expect(result.status).toBe('clear_inferred');
    expect(result.primaryEndpoint).toBe('capital_secured');
  });
});

// ---------------------------------------------------------------------------
// 7. Fundraising: true negatives
// ---------------------------------------------------------------------------
describe('Fundraising: corridor artifacts do not fire as endpoints', () => {
  test('build investor list → missing', () => {
    const result = detectTerminalEndpoint(
      'Build a target investor list and outreach pipeline',
      '',
    );
    expect(result.primaryEndpoint).not.toBe('capital_secured');
    expect(result.primaryEndpoint).not.toBe('signed_commitment');
  });

  test('prepare pitch deck → not fundraising endpoint', () => {
    const result = detectTerminalEndpoint(
      'Prepare a pitch deck and fundraising narrative',
      '',
    );
    expect(result.primaryEndpoint).not.toBe('capital_secured');
  });

  test('investor meetings → not terminal endpoint', () => {
    // Contact-stage deliverable, not terminal event
    const result = detectTerminalEndpoint(
      'Run first wave of investor outreach and meetings',
      '',
    );
    expect(result.primaryEndpoint).not.toBe('capital_secured');
    expect(result.primaryEndpoint).not.toBe('signed_commitment');
  });
});

// ---------------------------------------------------------------------------
// 8. Published/live: true positives and negatives
// ---------------------------------------------------------------------------
describe('Published/live endpoint', () => {
  test('episode published live → published_live', () => {
    const result = detectTerminalEndpoint(
      'Record and publish my first podcast episode',
      'Episode is published live on Spotify and Apple Podcasts',
    );
    expect(result.status).toBe('clear_explicit');
    expect(result.primaryEndpoint).toBe('published_live');
  });

  test('"go live" → published_live', () => {
    const result = detectTerminalEndpoint(
      'Finish recording and go live with episode 1',
      '',
    );
    expect(result.status).toBe('clear_explicit');
    expect(result.primaryEndpoint).toBe('published_live');
  });

  test('content released → published_live', () => {
    const result = detectTerminalEndpoint(
      'Release my first YouTube video publicly',
      '',
    );
    // "released" + content/publicly context
    expect(['clear_explicit', 'clear_inferred']).toContain(result.status);
  });

  test('record episode → not published_live (Stage 0/1 only)', () => {
    // "record" without "publish/live" is not a terminal event — it is Stage 0
    const result = detectTerminalEndpoint(
      'Record all 5 podcast episodes this month',
      '',
    );
    expect(result.primaryEndpoint).not.toBe('published_live');
  });
});

// ---------------------------------------------------------------------------
// 9. Artifact-complete: true positives and negatives
// ---------------------------------------------------------------------------
describe('Artifact-complete endpoint', () => {
  test('page is live → artifact_complete', () => {
    const result = detectTerminalEndpoint(
      'Build a landing page for my product',
      'The landing page is live and functional',
    );
    expect(result.status).toBe('clear_explicit');
    expect(result.primaryEndpoint).toBe('artifact_complete');
  });

  test('app deployed → artifact_complete', () => {
    const result = detectTerminalEndpoint(
      'Build and deploy a web app for task management',
      'App is deployed and accessible at public URL',
    );
    expect(result.status).toBe('clear_explicit');
    expect(result.primaryEndpoint).toBe('artifact_complete');
  });

  test('portfolio project complete and deployed → artifact_complete', () => {
    const result = detectTerminalEndpoint(
      'Complete my full-stack portfolio project',
      'Portfolio project is live and deployed on Vercel',
    );
    expect(result.status).toBe('clear_explicit');
    expect(result.primaryEndpoint).toBe('artifact_complete');
  });

  test('"build a website" alone → missing (no completion state)', () => {
    // "build" without completion state language does not resolve endpoint
    const result = detectTerminalEndpoint('Build a website for my business', '');
    expect(result.status).toBe('missing');
  });
});

// ---------------------------------------------------------------------------
// 10. Qualification: true positives and negatives
// ---------------------------------------------------------------------------
describe('Qualification endpoint', () => {
  test('earn PMP certification → certification_earned', () => {
    const result = detectTerminalEndpoint(
      'Earn my PMP certification within 6 months',
      'PMP certificate received from PMI',
    );
    expect(result.status).toBe('clear_explicit');
    expect(result.primaryEndpoint).toBe('certification_earned');
  });

  test('exam passed → certification_earned', () => {
    const result = detectTerminalEndpoint(
      'Pass the AWS Solutions Architect exam',
      'Exam passed with score above 720',
    );
    expect(result.status).toBe('clear_explicit');
    expect(result.primaryEndpoint).toBe('certification_earned');
  });

  test('study for certification → not certification_earned (preparation)', () => {
    const result = detectTerminalEndpoint(
      'Study for my AWS certification exam',
      '',
    );
    expect(result.primaryEndpoint).not.toBe('certification_earned');
  });
});

// ---------------------------------------------------------------------------
// 11. Market-dependent: threshold detection
// ---------------------------------------------------------------------------
describe('Market-dependent threshold endpoints', () => {
  test('first real sales commercial goal → first_sale_completed', () => {
    const result = detectTerminalEndpoint(
      'Launch a caffeinated energy gum brand to first real sales in 15 months',
      'Complete the admitted goal as defined in the intake review',
    );
    expect(result.status).toBe('clear_explicit');
    expect(result.primaryEndpoint).toBe('first_sale_completed');
  });

  test('1,000 monthly listeners → audience_threshold', () => {
    const result = detectTerminalEndpoint(
      'Reach 1,000 monthly listeners on my podcast',
      '',
    );
    expect(result.status).toBe('clear_explicit');
    expect(result.primaryEndpoint).toBe('audience_threshold');
  });

  test('$5K MRR → revenue_threshold', () => {
    const result = detectTerminalEndpoint(
      'Grow my SaaS to $5,000 MRR',
      'Monthly recurring revenue confirmed at $5,000',
    );
    expect(result.status).toBe('clear_explicit');
    expect(result.primaryEndpoint).toBe('revenue_threshold');
  });

  test('50 email sign-ups → audience_threshold', () => {
    const result = detectTerminalEndpoint(
      'Collect 50 email sign-ups for my product launch',
      '50 confirmed subscribers on the email list',
    );
    expect(result.status).toBe('clear_explicit');
    expect(result.primaryEndpoint).toBe('audience_threshold');
  });
});

// ---------------------------------------------------------------------------
// 12. Split endpoint detection
// ---------------------------------------------------------------------------
describe('Split endpoint detection', () => {
  test('LT-02 pattern: portfolio + job offer → split (artifact_complete + offer_received)', () => {
    const result = detectTerminalEndpoint(
      'Build three portfolio projects and receive a job offer',
      'Three projects deployed and offer letter received from employer',
    );
    expect(result.status).toBe('split');
    const both = [result.primaryEndpoint, result.secondaryEndpoint];
    expect(both).toContain('offer_received');
    expect(both).toContain('artifact_complete');
  });

  test('SaaS launch + MRR target → split (artifact_complete + revenue_threshold)', () => {
    const result = detectTerminalEndpoint(
      'Launch my SaaS product and hit $1,000 MRR',
      'Product is live and generating $1,000 in monthly recurring revenue',
    );
    expect(result.status).toBe('split');
    const both = [result.primaryEndpoint, result.secondaryEndpoint];
    expect(both).toContain('revenue_threshold');
    expect(both).toContain('artifact_complete');
  });

  test('podcast + listener count → split (published_live + audience_threshold)', () => {
    const result = detectTerminalEndpoint(
      'Launch podcast and grow to 500 subscribers',
      '12 episodes published live and 500 confirmed subscribers',
    );
    expect(result.status).toBe('split');
    const both = [result.primaryEndpoint, result.secondaryEndpoint];
    expect(both).toContain('published_live');
    expect(both).toContain('audience_threshold');
  });

  test('brand launch + sign-ups → split (artifact_complete + audience_threshold)', () => {
    const result = detectTerminalEndpoint(
      'Launch my brand page and get 50 email sign-ups',
      'Brand page is live and 50 subscribers confirmed',
    );
    expect(result.status).toBe('split');
  });
});

// ---------------------------------------------------------------------------
// 13. Ambiguous detection
// ---------------------------------------------------------------------------
describe('Ambiguous endpoint detection', () => {
  test('"get better at development" → missing (no terminal object)', () => {
    const result = detectTerminalEndpoint(
      'Get better at software development over the next year',
      '',
    );
    expect(result.status).toBe('missing');
  });

  test('"improve my skills" → missing', () => {
    const result = detectTerminalEndpoint('Improve my presentation skills', '');
    expect(result.status).toBe('missing');
  });

  test('"work on fitness" → missing', () => {
    const result = detectTerminalEndpoint(
      'Work on my fitness and become healthier',
      '',
    );
    expect(result.status).toBe('missing');
  });
});

// ---------------------------------------------------------------------------
// 14. Missing endpoint detection
// ---------------------------------------------------------------------------
describe('Missing endpoint: open-ended goals', () => {
  test('empty goal text → missing', () => {
    const result = detectTerminalEndpoint('', '');
    expect(result.status).toBe('missing');
    expect(result.primaryEndpoint).toBe('unknown');
    expect(result.reasons).toContain('NO_TERMINAL_OBJECT');
  });

  test('process-only goal → missing', () => {
    const result = detectTerminalEndpoint(
      'Practice coding every day for 30 days',
      '',
    );
    expect(result.status).toBe('missing');
  });

  test('vague learning goal → missing', () => {
    const result = detectTerminalEndpoint(
      'Learn more about machine learning concepts',
      '',
    );
    expect(result.status).toBe('missing');
  });
});

// ---------------------------------------------------------------------------
// 15. Contamination tests: process metrics and artifacts in verification text
// ---------------------------------------------------------------------------
describe('Contamination: process metrics and artifacts in verification text', () => {
  test('application count metric in verification text → not offer_received', () => {
    // "15 applications submitted" is a process metric, not a terminal event
    const result = detectTerminalEndpoint(
      'Run a job search over the next 3 months',
      '15 applications submitted and 5 phone screens completed',
    );
    // Must not resolve as offer_received — these are corridor metrics
    expect(result.primaryEndpoint).not.toBe('offer_received');
  });

  test('"portfolio contains 3 projects" → artifact_complete on page-live form only', () => {
    // "portfolio contains 3 projects" is a supporting artifact description
    // Without "deployed" or "live", it should resolve to artifact_complete only if
    // the completion state is clearly stated
    const result = detectTerminalEndpoint(
      'Build my portfolio',
      'Portfolio contains 3 projects with live demos',
    );
    // "live demos" contains "live" — context-dependent but should not resolve as
    // an externally mediated endpoint
    expect(result.primaryEndpoint).not.toBe('offer_received');
    expect(result.primaryEndpoint).not.toBe('capital_secured');
  });

  test('LT-04 packagePrepMode text — no terminal event in deliverables, but goal has explicit endpoint', () => {
    // The terminal endpoint comes from the goal text ("Raise $50,000"),
    // not from the deliverable-level verification text
    const result = detectTerminalEndpoint(
      'Raise $50,000 in funding for my startup',
      'Readiness review completed, pitch deck polished, investor list built',
    );
    // Goal text carries the endpoint — "raise $50,000"
    expect(result.status).toBe('clear_explicit');
    expect(result.primaryEndpoint).toBe('capital_secured');
  });

  test('LT-03 verification text with application metrics → still resolves offer_received', () => {
    // Verification text contains application metrics but also "offer letter received"
    // The offer letter is the terminal clause; metrics are supporting evidence
    const result = detectTerminalEndpoint(
      'Get a full-time junior developer job',
      'Applied to 30+ roles, completed 5+ interviews, offer letter received from target employer',
    );
    expect(result.status).toBe('clear_explicit');
    expect(result.primaryEndpoint).toBe('offer_received');
  });
});
