/**
 * terminalStageDetector.test.ts
 *
 * Tests for detectCorridorLane and hasTerminalStageDeliverable.
 *
 * Structure:
 *  1. Lane detection — JobSearch, Fundraising, unknown
 *  2. JobSearch terminal stage true positives
 *  3. JobSearch terminal stage true negatives (Stage 0/1/2 must not fire)
 *  4. Fundraising terminal stage true positives
 *  5. Fundraising terminal stage true negatives (Stage 0/1/2 must not fire)
 *  6. Object-over-verb invariant tests — generic verbs without terminal objects
 *  7. Full-plan tests — hasTerminalStageDeliverable against audit-pack plan shapes
 *
 * For every pattern in terminalStageDetector.ts, there must be at least one
 * negative test confirming a Stage 0/1/2 deliverable does not fire.
 */
import { describe, test, expect } from 'vitest';
import { detectCorridorLane } from './corridorLaneDetector';
import { hasTerminalStageDeliverable } from './terminalStageDetector';

// ---------------------------------------------------------------------------
// Lane detection
// ---------------------------------------------------------------------------
describe('Lane detection', () => {
  test('LT-03 goal → JobSearch', () => {
    expect(
      detectCorridorLane(
        'Get a full-time junior full-stack developer job within 6 months',
        'I have received an offer letter from a target employer',
      ),
    ).toBe('JobSearch');
  });

  test('LT-04 goal → Fundraising', () => {
    expect(
      detectCorridorLane(
        'Raise $50,000 in funding for my startup within 9 months',
        'Signed investment agreement received and wire transfer confirmed',
      ),
    ).toBe('Fundraising');
  });

  test('Podcast (market-dependent) → unknown', () => {
    expect(
      detectCorridorLane(
        'Launch a podcast and reach 1,000 monthly listeners within 12 months',
        'Podcast has 1,000 verified monthly listeners and 12 episodes published',
      ),
    ).toBe('unknown');
  });

  test('Landing page (fully_controllable) → unknown', () => {
    expect(
      detectCorridorLane(
        'Build and launch a landing page for my SaaS product',
        'Landing page is live and form submissions are working',
      ),
    ).toBe('unknown');
  });

  test('Brand launch (mixed) → unknown (no job/funding framing)', () => {
    expect(
      detectCorridorLane(
        'Launch my personal brand and collect 50 email sign-ups',
        'Brand page is live with 50 confirmed sign-ups',
      ),
    ).toBe('unknown');
  });

  test('Fullstack skill goal (LT-02 fc dimension) → unknown', () => {
    expect(
      detectCorridorLane(
        'Become a full-stack web developer within 18 months',
        'Three portfolio projects are deployed and publicly accessible',
      ),
    ).toBe('unknown');
  });

  test('LT-02 externally_mediated dimension → JobSearch', () => {
    // LT-02 is mixed: skill (fc) + job offer (externally_mediated)
    // "offer letter received" in verification text fires JobSearch lane
    expect(
      detectCorridorLane(
        'Become a full-stack web developer and land a junior software engineer job within 18 months',
        'Three portfolio projects deployed and offer letter received from employer',
      ),
    ).toBe('JobSearch');
  });

  test('Senior engineer hiring goal → JobSearch', () => {
    expect(
      detectCorridorLane(
        'Get hired as a senior software engineer at a tech company',
        'Offer letter signed and start date confirmed',
      ),
    ).toBe('JobSearch');
  });

  test('Seed round raise → Fundraising', () => {
    expect(
      detectCorridorLane(
        'Raise a seed round of $500,000 for my startup',
        'Signed investment agreements received and funds transferred',
      ),
    ).toBe('Fundraising');
  });

  test('Angel investor raise → Fundraising', () => {
    expect(
      detectCorridorLane(
        'Secure angel investor funding for my early-stage startup',
        'Investment committed and wire transfer confirmed',
      ),
    ).toBe('Fundraising');
  });
});

// ---------------------------------------------------------------------------
// JobSearch: terminal stage true positives
// ---------------------------------------------------------------------------
describe('JobSearch: terminal stage true positives', () => {
  test('offer letter → terminal', () => {
    expect(hasTerminalStageDeliverable('JobSearch', ['Receive and evaluate offer letter from target employer'])).toBe(true);
  });

  test('job offer → terminal', () => {
    expect(hasTerminalStageDeliverable('JobSearch', ['Evaluate and respond to job offers'])).toBe(true);
  });

  test('receive offer → terminal', () => {
    expect(hasTerminalStageDeliverable('JobSearch', ['Receive offer from target employer and evaluate terms'])).toBe(true);
  });

  test('accept offer → terminal', () => {
    expect(hasTerminalStageDeliverable('JobSearch', ['Accept job offer and confirm start date'])).toBe(true);
  });

  test('negotiate offer → terminal', () => {
    expect(hasTerminalStageDeliverable('JobSearch', ['Negotiate offer terms and sign employment agreement'])).toBe(true);
  });

  test('sign offer → terminal', () => {
    expect(hasTerminalStageDeliverable('JobSearch', ['Sign offer letter and confirm onboarding details'])).toBe(true);
  });

  test('offer received → terminal (passive)', () => {
    expect(hasTerminalStageDeliverable('JobSearch', ['Job offer received and evaluated'])).toBe(true);
  });

  test('offer accepted → terminal (passive)', () => {
    expect(hasTerminalStageDeliverable('JobSearch', ['Position offer accepted and start date set'])).toBe(true);
  });

  test('accept the position → terminal', () => {
    expect(hasTerminalStageDeliverable('JobSearch', ['Accept the position and complete onboarding paperwork'])).toBe(true);
  });

  test('confirm start date → terminal (employment confirmed)', () => {
    expect(hasTerminalStageDeliverable('JobSearch', ['Employment confirmed and start date set with target employer'])).toBe(true);
  });

  test('offer letter received and accepted → terminal', () => {
    expect(hasTerminalStageDeliverable('JobSearch', ['Offer letter received and accepted'])).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// JobSearch: terminal stage true negatives (Stage 0/1/2 must not fire)
// ---------------------------------------------------------------------------
describe('JobSearch: terminal stage true negatives', () => {
  // Stage 0 — preparation
  test('define target role → not terminal (Stage 0)', () => {
    expect(hasTerminalStageDeliverable('JobSearch', ['Define target role family and search criteria'])).toBe(false);
  });

  test('tailor resume → not terminal (Stage 0)', () => {
    expect(hasTerminalStageDeliverable('JobSearch', ['Tailor resume and portfolio for target roles'])).toBe(false);
  });

  test('prepare interview story bank → not terminal (Stage 0)', () => {
    expect(hasTerminalStageDeliverable('JobSearch', ['Prepare interview story bank and answer framework'])).toBe(false);
  });

  test('run mock interviews → not terminal (Stage 0 internal drill)', () => {
    expect(hasTerminalStageDeliverable('JobSearch', ['Run mock interviews and follow-up practice'])).toBe(false);
  });

  test('build company list → not terminal (Stage 0)', () => {
    expect(hasTerminalStageDeliverable('JobSearch', ['Build target company list and prioritization model'])).toBe(false);
  });

  // Stage 1 — contact
  test('submit application batch → not terminal (Stage 1 contact)', () => {
    expect(hasTerminalStageDeliverable('JobSearch', ['Submit first tailored application batch'])).toBe(false);
  });

  test('send outreach → not terminal (Stage 1)', () => {
    expect(hasTerminalStageDeliverable('JobSearch', ['Send outreach emails to 30 target employers'])).toBe(false);
  });

  // Stage 2 — evaluation
  test('interview at companies → not terminal (Stage 2)', () => {
    expect(hasTerminalStageDeliverable('JobSearch', ['Interview at 3 target companies'])).toBe(false);
  });

  test('complete interviews → not terminal (Stage 2, no offer object)', () => {
    // "complete" without "offer" context does not reach Stage 3
    expect(hasTerminalStageDeliverable('JobSearch', ['Complete interviews at target companies'])).toBe(false);
  });

  test('log responses → not terminal (tracking)', () => {
    expect(hasTerminalStageDeliverable('JobSearch', ['Log responses and manage active interview stages'])).toBe(false);
  });

  // Object-over-verb invariant: "accept" without terminal object must not fire
  test('accept feedback → not terminal (accept + non-offer object)', () => {
    expect(hasTerminalStageDeliverable('JobSearch', ['Accept feedback from mock interview sessions'])).toBe(false);
  });

  test('evaluate role requirements → not terminal (evaluate + non-offer object)', () => {
    expect(hasTerminalStageDeliverable('JobSearch', ['Evaluate role requirements and define target criteria'])).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Fundraising: terminal stage true positives
// ---------------------------------------------------------------------------
describe('Fundraising: terminal stage true positives', () => {
  test('coordinate term discussions → terminal (term discussions)', () => {
    expect(hasTerminalStageDeliverable('Fundraising', ['Coordinate term discussions and commitment tracking'])).toBe(true);
  });

  test('term sheet → terminal', () => {
    expect(hasTerminalStageDeliverable('Fundraising', ['Finalize term sheet and manage signature workflow'])).toBe(true);
  });

  test('term negotiations → terminal', () => {
    expect(hasTerminalStageDeliverable('Fundraising', ['Lead term negotiations and investor commitment review'])).toBe(true);
  });

  test('commitment tracking → terminal', () => {
    expect(hasTerminalStageDeliverable('Fundraising', ['Manage investor commitment tracking and close timeline'])).toBe(true);
  });

  test('signed commitment → terminal', () => {
    expect(hasTerminalStageDeliverable('Fundraising', ['Receive signed commitment letters and confirm wire dates'])).toBe(true);
  });

  test('close round → terminal', () => {
    expect(hasTerminalStageDeliverable('Fundraising', ['Close round and distribute final investor documentation'])).toBe(true);
  });

  test('close the round → terminal', () => {
    expect(hasTerminalStageDeliverable('Fundraising', ['Execute close the round process and legal documentation'])).toBe(true);
  });

  test('legal close → terminal', () => {
    expect(hasTerminalStageDeliverable('Fundraising', ['Finalize legal close process and signature workflow'])).toBe(true);
  });

  test('signed investment → terminal', () => {
    expect(hasTerminalStageDeliverable('Fundraising', ['Receive signed investment agreement from lead investor'])).toBe(true);
  });

  test('investment confirmed → terminal', () => {
    expect(hasTerminalStageDeliverable('Fundraising', ['Confirm investment commitment and initiate close process'])).toBe(true);
  });

  test('wire transfer → terminal', () => {
    expect(hasTerminalStageDeliverable('Fundraising', ['Confirm wire transfer and close funding round'])).toBe(true);
  });

  test('wire confirmation → terminal', () => {
    expect(hasTerminalStageDeliverable('Fundraising', ['Receive wire confirmation and update cap table'])).toBe(true);
  });

  test('funds received → terminal', () => {
    expect(hasTerminalStageDeliverable('Fundraising', ['Confirm funds received and distribute final close documents'])).toBe(true);
  });

  test('final close → terminal', () => {
    expect(hasTerminalStageDeliverable('Fundraising', ['Execute final close and investor onboarding'])).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Fundraising: terminal stage true negatives (Stage 0/1/2 must not fire)
// ---------------------------------------------------------------------------
describe('Fundraising: terminal stage true negatives', () => {
  // Stage 0 — preparation
  test('define raise objective → not terminal (Stage 0)', () => {
    expect(hasTerminalStageDeliverable('Fundraising', ['Define raise objective, use-of-funds, and investor thesis'])).toBe(false);
  });

  test('build fundraising narrative → not terminal (Stage 0)', () => {
    expect(hasTerminalStageDeliverable('Fundraising', ['Build fundraising narrative and deck storyline'])).toBe(false);
  });

  test('build investor list → not terminal (Stage 0)', () => {
    expect(hasTerminalStageDeliverable('Fundraising', ['Build target investor list and fit scoring model'])).toBe(false);
  });

  test('prepare outreach sequences → not terminal (Stage 0)', () => {
    expect(hasTerminalStageDeliverable('Fundraising', ['Prepare outreach sequences and intro request scripts'])).toBe(false);
  });

  test('fundraising readiness review → not terminal (Stage 0)', () => {
    expect(hasTerminalStageDeliverable('Fundraising', ['Run fundraising readiness review, objection handling, and investor-ready materials check'])).toBe(false);
  });

  test('create diligence checklist → not terminal (Stage 0)', () => {
    expect(hasTerminalStageDeliverable('Fundraising', ['Create diligence checklist and data room structure'])).toBe(false);
  });

  // Stage 1 — contact
  test('investor outreach and meetings → not terminal (Stage 1)', () => {
    expect(hasTerminalStageDeliverable('Fundraising', ['Run first wave of investor outreach and meetings'])).toBe(false);
  });

  // Stage 2 — evaluation
  test('deliver follow-up materials → not terminal (Stage 2)', () => {
    expect(hasTerminalStageDeliverable('Fundraising', ['Deliver follow-up materials and manage diligence requests'])).toBe(false);
  });

  // Object-over-verb invariant: generic verbs without terminal objects must not fire
  test('coordinate investor feedback → not terminal (coordinate without term/commitment object)', () => {
    expect(hasTerminalStageDeliverable('Fundraising', ['Coordinate investor feedback loop and Q&A responses'])).toBe(false);
  });

  test('finalize pitch deck → not terminal (finalize without terminal object)', () => {
    expect(hasTerminalStageDeliverable('Fundraising', ['Finalize pitch deck for investor review'])).toBe(false);
  });

  test('manage diligence process → not terminal (manage without terminal object)', () => {
    expect(hasTerminalStageDeliverable('Fundraising', ['Manage investor diligence process and document requests'])).toBe(false);
  });

  test('close out preparation tasks → not terminal (close without round/process object)', () => {
    // "close out" ≠ "close round" — no terminal object
    expect(hasTerminalStageDeliverable('Fundraising', ['Close out all preparation tasks before investor meetings'])).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Unknown lane: check always passes
// ---------------------------------------------------------------------------
describe('Unknown lane: no check applied', () => {
  test('unknown lane → always returns true (check skipped)', () => {
    expect(hasTerminalStageDeliverable('unknown', ['Define podcast show format and theme'])).toBe(true);
    expect(hasTerminalStageDeliverable('unknown', [])).toBe(true);
    expect(hasTerminalStageDeliverable('unknown', ['Publish episodes to podcast directories'])).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Full-plan tests: hasTerminalStageDeliverable
// ---------------------------------------------------------------------------
describe('Full-plan tests', () => {
  test('LT-04 full pipeline — has terminal stage (term discussions)', () => {
    const titles = [
      'Define raise objective, use-of-funds, and investor thesis',
      'Build fundraising narrative and deck storyline',
      'Create diligence checklist and data room structure',
      'Build target investor list and fit scoring model',
      'Prepare outreach sequences and intro request scripts',
      'Run first wave of investor outreach and meetings',
      'Deliver follow-up materials and manage diligence requests',
      'Coordinate term discussions and commitment tracking', // ← terminal
    ];
    expect(hasTerminalStageDeliverable('Fundraising', titles)).toBe(true);
  });

  test('LT-04 packagePrepMode — NO terminal stage', () => {
    const titles = [
      'Define raise objective, use-of-funds, and investor thesis',
      'Build fundraising narrative, pitch deck, and financial ask storyline',
      'Create diligence checklist, financial package, and data room structure',
      'Build target investor list and fit scoring model',
      'Prepare outreach sequences, intro request scripts, and send package checklist',
      'Run fundraising readiness review, objection handling, and investor-ready materials check',
    ];
    expect(hasTerminalStageDeliverable('Fundraising', titles)).toBe(false);
  });

  test('Fundraising contact-only hypothetical — NO terminal stage (has contact, no terminal)', () => {
    const titles = [
      'Run first wave of investor outreach and meetings',     // Stage 1 contact
      'Deliver follow-up materials and manage diligence',     // Stage 2 evaluation
    ];
    expect(hasTerminalStageDeliverable('Fundraising', titles)).toBe(false);
  });

  test('LT-03 current probe pipeline — NO terminal stage (confirmed gap)', () => {
    const titles = [
      'Define target role family and search criteria',
      'Tailor resume and portfolio for target roles',
      'Build target company list and prioritization model',
      'Create application pipeline tracking and outreach workflow',
      'Submit first tailored application batch',              // Stage 1 contact
      'Prepare interview story bank and answer framework',
      'Run mock interviews and follow-up practice',
      'Log responses and manage active interview stages',
    ];
    expect(hasTerminalStageDeliverable('JobSearch', titles)).toBe(false);
  });

  test('LT-03 complete hypothetical — has terminal stage (offer evaluation)', () => {
    const titles = [
      'Define target role family and search criteria',
      'Tailor resume and portfolio for target roles',
      'Build target company list and prioritization model',
      'Create application pipeline tracking and outreach workflow',
      'Submit first tailored application batch',
      'Prepare interview story bank and answer framework',
      'Run mock interviews and follow-up practice',
      'Log responses and manage active interview stages',
      'Receive and evaluate job offers from target employers',  // ← terminal
    ];
    expect(hasTerminalStageDeliverable('JobSearch', titles)).toBe(true);
  });

  test('LT-03 prep-only hypothetical — NO terminal stage', () => {
    // Job search plan that stops before submitting applications
    const titles = [
      'Define target role family and search criteria',
      'Tailor resume and portfolio for target roles',
      'Build target company list and prioritization model',
      'Create application pipeline tracking and outreach workflow',
      'Prepare interview story bank and answer framework',
    ];
    expect(hasTerminalStageDeliverable('JobSearch', titles)).toBe(false);
  });
});
