import { describe, it, expect } from 'vitest';
import {
  extractLanesFromDescription,
  parseAnchorFromInput,
  assessLaneFromAnswers,
  getClarifyingQuestionsForDomain,
  suggestHorizonFromAnchors,
} from './masterPlanIntakeEngine.js';
import { validateMasterPlanInputs } from './masterPlanSchema.js';
import { buildMasterPlan } from './masterPlanFactory.js';

// ─── extractLanesFromDescription ─────────────────────────────────────────────

describe('extractLanesFromDescription', () => {
  it('extracts 4 lanes from a realistic multi-venture description', () => {
    const text =
      "I'm building an app, dropping an album, launching a podcast, and relaunching my project management company.";
    const lanes = extractLanesFromDescription(text);
    expect(lanes.length).toBe(4);
  });

  it('assigns product domain to app language', () => {
    const lanes = extractLanesFromDescription("I'm building a SaaS platform and launching an MVP.");
    const domains = lanes.map((l) => l.domain);
    expect(domains).toContain('product');
  });

  it('assigns creative domain to album language', () => {
    const lanes = extractLanesFromDescription("I'm dropping an album and releasing music.");
    expect(lanes[0].domain).toBe('creative');
  });

  it('assigns media domain to podcast language', () => {
    const lanes = extractLanesFromDescription('Launching a podcast and growing my newsletter.');
    const domains = lanes.map((l) => l.domain);
    expect(domains).toContain('media');
  });

  it('assigns income domain to consulting language', () => {
    const lanes = extractLanesFromDescription('Relaunching my consulting company and closing clients.');
    const domains = lanes.map((l) => l.domain);
    expect(domains).toContain('income');
  });

  it('returns empty array for empty input', () => {
    expect(extractLanesFromDescription('')).toEqual([]);
    expect(extractLanesFromDescription(null)).toEqual([]);
  });

  it('does not return duplicate domains for the same venture type', () => {
    const lanes = extractLanesFromDescription('app platform saas software tool build launch');
    const domains = lanes.map((l) => l.domain);
    const unique = [...new Set(domains)];
    expect(domains.length).toBe(unique.length);
  });

  it('assigns roles that match domain defaults', () => {
    const lanes = extractLanesFromDescription("building an app and growing an audience through my blog and newsletter");
    const product = lanes.find((l) => l.domain === 'product');
    const media = lanes.find((l) => l.domain === 'media');
    expect(product?.role).toBe('revenue-engine');
    expect(media?.role).toBe('attention-engine');
  });
});

// ─── parseAnchorFromInput ─────────────────────────────────────────────────────

describe('parseAnchorFromInput', () => {
  const REF = '2026-05-03T12:00:00.000Z';

  it('parses "October 17" as 2026-10-17', () => {
    const result = parseAnchorFromInput('October 17', REF);
    expect(result).not.toBeNull();
    expect(result.date).toBe('2026-10-17');
  });

  it('parses "Oct 17" as the same date', () => {
    const result = parseAnchorFromInput('Oct 17', REF);
    expect(result).not.toBeNull();
    expect(result.date).toBe('2026-10-17');
  });

  it('parses "October 17th" — ordinal suffix is stripped', () => {
    const result = parseAnchorFromInput('October 17th', REF);
    expect(result).not.toBeNull();
    expect(result.date).toBe('2026-10-17');
  });

  it('all three October 17 variants produce isFixed: true', () => {
    const inputs = ['October 17', 'Oct 17', 'album drop October 17'];
    for (const input of inputs) {
      const result = parseAnchorFromInput(input, REF);
      if (result) {
        expect(result.isFixed).toBe(true);
      }
    }
  });

  it('parses "Q4" as December 31 of current year', () => {
    const result = parseAnchorFromInput('Q4', REF);
    expect(result).not.toBeNull();
    expect(result.date).toBe('2026-12-31');
  });

  it('parses "end of year" as December 31', () => {
    const result = parseAnchorFromInput('end of year', REF);
    expect(result).not.toBeNull();
    expect(result.date.endsWith('-12-31')).toBe(true);
  });

  it('treats "want to launch by October" as not fixed', () => {
    const result = parseAnchorFromInput('want to launch by October', REF);
    expect(result).not.toBeNull();
    expect(result.isFixed).toBe(false);
  });

  it('returns null for unrecognizable input', () => {
    expect(parseAnchorFromInput('sometime eventually', REF)).toBeNull();
    expect(parseAnchorFromInput('when I feel ready', REF)).toBeNull();
  });

  it('advances year when the month has already passed', () => {
    // Reference is May 2026; January has passed — should resolve to Jan 2027
    const result = parseAnchorFromInput('January', REF);
    expect(result).not.toBeNull();
    expect(result.date.startsWith('2027-01')).toBe(true);
  });
});

// ─── buildMasterPlan + validateMasterPlanInputs ───────────────────────────────

describe('buildMasterPlan', () => {
  const BASE = {
    profileId: 'profile-local-default',
    title: 'My Plan',
    northStarOutcome: 'Ship the album and reach $10k MRR',
    horizonEnd: '2027-01-01',
    anchors: [{ date: '2026-10-17', label: 'album drop', isFixed: true, affectedLaneIds: [], priority: 0 }],
  };

  it('builds a valid master plan when anchors and horizonEnd are present', () => {
    const plan = buildMasterPlan(BASE);
    expect(plan.id).toBeTruthy();
    expect(plan.profileId).toBe('profile-local-default');
    expect(plan.northStarOutcome).toBe('Ship the album and reach $10k MRR');
    expect(plan.anchors.length).toBe(1);
    expect(plan.anchors[0].date).toBe('2026-10-17');
    expect(plan.laneIds).toEqual([]);
    expect(plan.status).toBe('draft');
  });

  it('builds a valid plan when only horizonEnd is provided (no anchors)', () => {
    const plan = buildMasterPlan({ ...BASE, anchors: [] });
    expect(plan).toBeTruthy();
  });

  it('builds a valid plan when only anchors are provided (no horizonEnd)', () => {
    const plan = buildMasterPlan({ ...BASE, horizonEnd: null });
    expect(plan).toBeTruthy();
  });

  it('throws when both anchors and horizonEnd are absent', () => {
    expect(() =>
      buildMasterPlan({ ...BASE, anchors: [], horizonEnd: null })
    ).toThrow('MASTER_PLAN_INVALID');
  });

  it('throws when profileId is missing', () => {
    expect(() =>
      buildMasterPlan({ ...BASE, profileId: undefined })
    ).toThrow('MASTER_PLAN_INVALID');
  });

  it('sets financialConstraint defaults when not provided', () => {
    const plan = buildMasterPlan(BASE);
    expect(plan.financialConstraint.exists).toBe(false);
    expect(plan.financialConstraint.urgency).toBeNull();
  });

  it('stores provided financialConstraint', () => {
    const plan = buildMasterPlan({
      ...BASE,
      financialConstraint: { exists: true, urgency: 'immediate', notes: 'need income fast' },
    });
    expect(plan.financialConstraint.exists).toBe(true);
    expect(plan.financialConstraint.urgency).toBe('immediate');
  });
});

describe('validateMasterPlanInputs', () => {
  it('does not throw when anchors are present', () => {
    expect(() =>
      validateMasterPlanInputs({
        anchors: [{ date: '2026-10-17' }],
        horizonEnd: null,
      })
    ).not.toThrow();
  });

  it('does not throw when horizonEnd is present', () => {
    expect(() =>
      validateMasterPlanInputs({ anchors: [], horizonEnd: '2027-01-01' })
    ).not.toThrow();
  });

  it('throws when both are absent', () => {
    expect(() =>
      validateMasterPlanInputs({ anchors: [], horizonEnd: null })
    ).toThrow('MASTER_PLAN_INVALID');
  });
});

// ─── assessLaneFromAnswers ────────────────────────────────────────────────────

describe('assessLaneFromAnswers', () => {
  it('identifies pre-concept from "I have an idea but haven\'t started"', () => {
    const result = assessLaneFromAnswers('product', "I have an idea but haven't started", []);
    expect(result.assessedStage).toBe('pre-concept');
  });

  it('identifies in-development from "I\'m working on it now"', () => {
    const result = assessLaneFromAnswers('creative', "I'm working on it now, building tracks", []);
    expect(result.assessedStage).toBe('in-development');
  });

  it('identifies in-development from natural development language', () => {
    const result = assessLaneFromAnswers(
      'product',
      '7 months into development, core architecture working',
      []
    );
    expect(result.assessedStage).toBe('in-development');
  });

  it('identifies active from "it\'s live and running"', () => {
    const result = assessLaneFromAnswers('income', "it's live and running, I'm selling", []);
    expect(result.assessedStage).toBe('active');
  });

  it('returns assessedConfidence field', () => {
    const result = assessLaneFromAnswers('product', 'building an app', []);
    expect(['high', 'medium', 'low']).toContain(result.assessedConfidence);
  });
});

// ─── getClarifyingQuestionsForDomain ──────────────────────────────────────────

describe('getClarifyingQuestionsForDomain', () => {
  it('returns 2-4 questions for every known domain', () => {
    const domains = ['creative', 'product', 'brand', 'income', 'media'];
    for (const domain of domains) {
      const qs = getClarifyingQuestionsForDomain(domain);
      expect(qs.length).toBeGreaterThanOrEqual(2);
      expect(qs.length).toBeLessThanOrEqual(4);
    }
  });

  it('returns fallback questions for an unknown domain', () => {
    const qs = getClarifyingQuestionsForDomain('unknown_domain_xyz');
    expect(qs.length).toBeGreaterThan(0);
  });
});
