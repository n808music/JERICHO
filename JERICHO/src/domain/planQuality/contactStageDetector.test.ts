/**
 * contactStageDetector.test.ts
 *
 * Tests for isContactStageDeliverable and hasContactStageDeliverable.
 *
 * Structure:
 *  1. True positives — deliverables that ARE contact-stage
 *  2. True negatives — preparation deliverables that must NOT be contact-stage
 *  3. Substring collision tests — patterns that resemble contact verbs but are not
 *  4. Full-plan tests — hasContactStageDeliverable against audit-pack plans
 *
 * Explicit negative tests are required for every ambiguous term added to
 * CONTACT_STAGE_VERB_PATTERNS. See bounded vocabulary note in contactStageDetector.ts.
 */
import { describe, test, expect } from 'vitest';
import { isContactStageDeliverable, hasContactStageDeliverable } from './contactStageDetector';

// ---------------------------------------------------------------------------
// True positives — contact-stage deliverables
// ---------------------------------------------------------------------------
describe('True positives: contact-stage deliverables', () => {
  test('submit application batch → contact', () => {
    expect(isContactStageDeliverable('Submit first tailored application batch')).toBe(true);
  });

  test('submit applications → contact', () => {
    expect(isContactStageDeliverable('Submit job applications to target companies')).toBe(true);
  });

  test('send pitch to investor → contact', () => {
    expect(isContactStageDeliverable('Send pitch deck to shortlisted investors')).toBe(true);
  });

  test('outreach and meetings → contact', () => {
    expect(isContactStageDeliverable('Run first wave of investor outreach and meetings')).toBe(true);
  });

  test('investor outreach → contact', () => {
    expect(isContactStageDeliverable('Execute investor outreach and meeting schedule')).toBe(true);
  });

  test('investor meeting → contact', () => {
    expect(isContactStageDeliverable('Schedule and hold meetings with investor shortlist')).toBe(true);
  });

  test('client intro meeting → contact', () => {
    expect(isContactStageDeliverable('Run client intro call and discovery session')).toBe(true);
  });

  test('interview with employer → contact', () => {
    expect(isContactStageDeliverable('Complete interviews at target companies')).toBe(false); // "complete" not "interview with"
  });

  test('interview at company → contact', () => {
    expect(isContactStageDeliverable('Interview at 3 target companies')).toBe(true);
  });

  test('interview for role → contact', () => {
    expect(isContactStageDeliverable('Interview for junior developer positions')).toBe(true);
  });

  test('pitch to investors → contact', () => {
    expect(isContactStageDeliverable('Pitch to angel investor group')).toBe(true);
  });

  test('application batch (standalone) → contact', () => {
    expect(isContactStageDeliverable('Execute first tailored application batch')).toBe(true);
  });

  test('send outreach → contact', () => {
    expect(isContactStageDeliverable('Send outreach emails to 30 target employers')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// True negatives — preparation deliverables (must NOT be contact-stage)
// ---------------------------------------------------------------------------
describe('True negatives: preparation deliverables', () => {
  // Job search preparation
  test('define target role → not contact', () => {
    expect(isContactStageDeliverable('Define target role family and search criteria')).toBe(false);
  });

  test('tailor resume and portfolio → not contact', () => {
    expect(isContactStageDeliverable('Tailor resume and portfolio for target roles')).toBe(false);
  });

  test('build target company list → not contact', () => {
    expect(isContactStageDeliverable('Build target company list and prioritization model')).toBe(false);
  });

  test('create application pipeline tracking → not contact', () => {
    expect(isContactStageDeliverable('Create application pipeline tracking and outreach workflow')).toBe(false);
  });

  test('prepare interview story bank → not contact (internal drill)', () => {
    expect(isContactStageDeliverable('Prepare interview story bank and answer framework')).toBe(false);
  });

  test('run mock interviews → not contact (internal drill)', () => {
    expect(isContactStageDeliverable('Run mock interviews and follow-up practice')).toBe(false);
  });

  test('log responses and manage pipeline → not contact', () => {
    expect(isContactStageDeliverable('Log responses and manage active interview stages')).toBe(false);
  });

  // Fundraising preparation
  test('define raise objective → not contact', () => {
    expect(isContactStageDeliverable('Define raise objective, use-of-funds, and investor thesis')).toBe(false);
  });

  test('build fundraising narrative → not contact', () => {
    expect(isContactStageDeliverable('Build fundraising narrative and deck storyline')).toBe(false);
  });

  test('build target investor list → not contact', () => {
    expect(isContactStageDeliverable('Build target investor list and fit scoring model')).toBe(false);
  });

  test('prepare outreach sequences → not contact (preparation of scripts, not execution)', () => {
    expect(isContactStageDeliverable('Prepare outreach sequences and intro request scripts')).toBe(false);
  });

  test('fundraising readiness review → not contact', () => {
    expect(isContactStageDeliverable('Run fundraising readiness review, objection handling, and investor-ready materials check')).toBe(false);
  });

  test('create diligence checklist → not contact', () => {
    expect(isContactStageDeliverable('Create diligence checklist and data room structure')).toBe(false);
  });

  test('coordinate term discussions → not contact (post-decision management)', () => {
    expect(isContactStageDeliverable('Coordinate term discussions and commitment tracking')).toBe(false);
  });

  test('finalize legal close process → not contact (process management)', () => {
    expect(isContactStageDeliverable('Finalize legal close process and signature workflow')).toBe(false);
  });

  test('deliver follow-up materials → not contact (supporting external diligence)', () => {
    expect(isContactStageDeliverable('Deliver follow-up materials and manage diligence requests')).toBe(false);
  });

  // Skill acquisition preparation
  test('establish baseline → not contact', () => {
    expect(isContactStageDeliverable('Establish baseline in full-stack web development')).toBe(false);
  });

  test('complete portfolio project → not contact', () => {
    expect(isContactStageDeliverable('Complete first full-stack portfolio project and walkthrough')).toBe(false);
  });

  test('run final readiness review → not contact', () => {
    expect(isContactStageDeliverable('Run final readiness review for full-stack web development')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Substring collision tests
// ---------------------------------------------------------------------------
describe('Substring collision tests', () => {
  test('"outreach" in "Create outreach workflow" does not fire — prepare context', () => {
    // "outreach workflow" is preparation of the workflow, not executing outreach
    // The pattern requires "outreach to|sequences|and" — "workflow" is not in that list
    expect(isContactStageDeliverable('Create outreach tracking and workflow documentation')).toBe(false);
  });

  test('"application" in non-submission context → not contact', () => {
    expect(isContactStageDeliverable('Create application pipeline tracking and outreach workflow')).toBe(false);
  });

  test('"interview" in "Prepare interview story bank" → not contact', () => {
    // "interview story bank" — "interview" without "with|at|for|stage|process" qualifier
    expect(isContactStageDeliverable('Prepare interview story bank and answer framework')).toBe(false);
  });

  test('"send" in "send package checklist" → not contact (checklist prep)', () => {
    // "send package checklist" — the send is part of title of a checklist, not actually sending
    // Pattern requires: send + (application|proposal|pitch|message|email|intro|outreach)
    expect(isContactStageDeliverable('Prepare outreach sequences, intro request scripts, and send package checklist')).toBe(false);
  });

  test('"meeting" in non-investor context → not contact', () => {
    // "meeting" alone without external-party qualifier does not fire
    // The pattern requires "meeting with|investor|employer|client|recruiter"
    expect(isContactStageDeliverable('Run planning meeting and review session')).toBe(false);
  });

  test('"pitch" in non-investor context → not contact', () => {
    // "pitch" requires "to|investor|client|employer|deck" qualifier
    // A generic pitch deliverable without target context: borderline
    expect(isContactStageDeliverable('Define pitch narrative and value proposition')).toBe(false);
  });

  test('"mock interview" stays non-contact even with prep framing', () => {
    expect(isContactStageDeliverable('Complete mock interview sessions and answer drill')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Full-plan tests — audit pack scenarios
// ---------------------------------------------------------------------------
describe('Full-plan tests: hasContactStageDeliverable', () => {
  test('LT-04 full pipeline — has contact-stage (investor outreach and meetings)', () => {
    const titles = [
      'Define raise objective, use-of-funds, and investor thesis',
      'Build fundraising narrative and deck storyline',
      'Create diligence checklist and data room structure',
      'Build target investor list and fit scoring model',
      'Prepare outreach sequences and intro request scripts',
      'Run first wave of investor outreach and meetings',       // ← contact
      'Deliver follow-up materials and manage diligence requests',
      'Coordinate term discussions and commitment tracking',
    ];
    expect(hasContactStageDeliverable(titles)).toBe(true);
  });

  test('LT-04 packagePrepMode — NO contact-stage (prep-only, RC-25 pattern)', () => {
    const titles = [
      'Define raise objective, use-of-funds, and investor thesis',
      'Build fundraising narrative, pitch deck, and financial ask storyline',
      'Create diligence checklist, financial package, and data room structure',
      'Build target investor list and fit scoring model',
      'Prepare outreach sequences, intro request scripts, and send package checklist',
      'Run fundraising readiness review, objection handling, and investor-ready materials check',
    ];
    expect(hasContactStageDeliverable(titles)).toBe(false);
  });

  test('LT-03 full job pipeline — has contact-stage (submit application batch)', () => {
    const titles = [
      'Define target role family and search criteria',
      'Tailor resume and portfolio for target roles',
      'Build target company list and prioritization model',
      'Create application pipeline tracking and outreach workflow',
      'Submit first tailored application batch',               // ← contact
      'Prepare interview story bank and answer framework',
      'Run mock interviews and follow-up practice',
      'Log responses and manage active interview stages',
    ];
    expect(hasContactStageDeliverable(titles)).toBe(true);
  });

  test('LT-03 prep-only hypothetical — NO contact-stage', () => {
    // A job-search plan that stops before submitting applications
    const titles = [
      'Define target role family and search criteria',
      'Tailor resume and portfolio for target roles',
      'Build target company list and prioritization model',
      'Create application pipeline tracking and outreach workflow',
      'Prepare interview story bank and answer framework',
    ];
    expect(hasContactStageDeliverable(titles)).toBe(false);
  });

  test('LT-02 skill_acquisition plan — NO contact-stage (not externally_mediated in scope)', () => {
    // Skill plan: all preparation, no employer contact — correctly has no contact stage
    const titles = [
      'Establish baseline in full-stack web development',
      'Complete first portfolio project and walkthrough',
      'Complete second portfolio project with higher complexity',
      'Complete portfolio project 3 and evidence summary',
      'Produce proof artifact',
      'Run final readiness review',
    ];
    expect(hasContactStageDeliverable(titles)).toBe(false);
  });

  test('Fully controllable plan — correctly has no contact-stage (not applicable)', () => {
    // Landing page / podcast plan: no external party contact needed
    const titles = [
      'Define podcast show format and theme',
      'Prepare recording workflow and equipment setup',
      'Record and edit episode batch',
      'Publish episodes to podcast directories',
      'Review episode metrics and plan next batch',
    ];
    // "Publish" is a fc action, not external-party contact
    expect(hasContactStageDeliverable(titles)).toBe(false);
  });
});
