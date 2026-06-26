/**
 * Generator Substrate Compliance tests.
 *
 * Verifies that every execution block produced by expandFullHorizonSchedule
 * carries the five mandatory substrate fields required by the Substance Gate,
 * and that a generated master plan does not trip MONITORING_WITHOUT_PRODUCTION
 * under the default descriptor mix.
 */
import { describe, it, expect } from 'vitest';
import { expandFullHorizonSchedule } from './fullHorizonScheduleExpansion.js';
import { evaluatePlanQualityGate } from '../planQuality/evaluatePlanQualityGate.ts';

// Substance gate codes — must not appear for a compliant generator output
const SUBSTRATE_CODES = [
  'MISSING_EXECUTION_OWNER',
  'MISSING_EXECUTION_DURATION',
  'MISSING_EXECUTION_ARTIFACT',
  'MISSING_EXECUTION_CONSUMER',
  'MISSING_EXECUTION_PASS_EVIDENCE',
];

const EXEMPT_BLOCK_TYPES = new Set([
  'review',
  'audit',
  'terminal-review',
  'terminal-readiness',
  'gate',
  'checkpoint',
]);

function isReviewClass(block) {
  if (block?.blockType) {
    return EXEMPT_BLOCK_TYPES.has(block.blockType) ||
           block.owner === 'reviewer' ||
           block.owner === 'system';
  }
  return false;
}

// ---------------------------------------------------------------------------
// Minimal plan fixtures
// ---------------------------------------------------------------------------

const PLAN = {
  id: 'compliance-test-plan',
  successStandard: 'SaaS product at $10k MRR with 50 paying customers retained for 3 months',
  outcomeTarget: '$10,000 Monthly Recurring Revenue',
};

const PHASE_MODEL_3Y = {
  phases: [
    { id: 'p1', label: 'P1', startBoundary: '2026-01-01', endBoundary: '2026-08-31' },
    { id: 'p2', label: 'P2', startBoundary: '2026-09-01', endBoundary: '2027-04-30' },
    { id: 'p3', label: 'P3', startBoundary: '2027-05-01', endBoundary: '2028-12-31' },
  ],
};

const PRODUCT_LANE = {
  id: 'lane-product',
  laneId: 'lane-product',
  title: 'SaaS product',
  domain: 'product',
  activationState: 'active',
};

const CREATIVE_LANE = {
  id: 'lane-creative',
  laneId: 'lane-creative',
  title: 'Album release',
  domain: 'creative',
  activationState: 'active',
};

const INCOME_LANE = {
  id: 'lane-income',
  laneId: 'lane-income',
  title: 'Consulting revenue',
  domain: 'income',
  activationState: 'active',
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function generateBlocks(lanes, phaseModel = PHASE_MODEL_3Y) {
  return expandFullHorizonSchedule({
    plan: PLAN,
    phaseModel,
    horizonStartDayKey: phaseModel.phases[0].startBoundary,
    horizonEndDayKey: phaseModel.phases[phaseModel.phases.length - 1].endBoundary,
    lanes,
    workDays: [],
  });
}

function getExecutionBlocks(blocks) {
  return blocks.filter((b) => b?.blockType && !isReviewClass(b));
}

function getReviewClassBlocks(blocks) {
  return blocks.filter((b) => b?.blockType && isReviewClass(b));
}

// ---------------------------------------------------------------------------
// Substrate field compliance: individual checks per execution block
// ---------------------------------------------------------------------------

describe('Generator substrate compliance: execution blocks must carry all 5 fields', () => {
  it('every execution block for a product lane has owner populated', () => {
    const blocks = generateBlocks([PRODUCT_LANE]);
    const execBlocks = getExecutionBlocks(blocks);
    expect(execBlocks.length).toBeGreaterThan(0);
    const missing = execBlocks.filter((b) => !b.owner || String(b.owner).trim() === '');
    expect(missing.map((b) => ({ id: b.id, title: b.title, blockType: b.blockType }))).toEqual([]);
  });

  it('every execution block for a product lane has durationMinutes > 0', () => {
    const blocks = generateBlocks([PRODUCT_LANE]);
    const execBlocks = getExecutionBlocks(blocks);
    const missing = execBlocks.filter((b) => !b.durationMinutes || b.durationMinutes <= 0);
    expect(missing.map((b) => ({ id: b.id, blockType: b.blockType, durationMinutes: b.durationMinutes }))).toEqual([]);
  });

  it('every execution block for a product lane has producesArtifact populated', () => {
    const blocks = generateBlocks([PRODUCT_LANE]);
    const execBlocks = getExecutionBlocks(blocks);
    const missing = execBlocks.filter((b) => !b.producesArtifact || String(b.producesArtifact).trim() === '');
    expect(missing.map((b) => ({ id: b.id, title: b.title, blockType: b.blockType }))).toEqual([]);
  });

  it('every execution block for a product lane has consumedBy with at least one entry', () => {
    const blocks = generateBlocks([PRODUCT_LANE]);
    const execBlocks = getExecutionBlocks(blocks);
    const missing = execBlocks.filter((b) => !Array.isArray(b.consumedBy) || b.consumedBy.length === 0);
    expect(missing.map((b) => ({ id: b.id, title: b.title, blockType: b.blockType }))).toEqual([]);
  });

  it('every execution block for a product lane has passEvidence populated', () => {
    const blocks = generateBlocks([PRODUCT_LANE]);
    const execBlocks = getExecutionBlocks(blocks);
    const missing = execBlocks.filter((b) => !b.passEvidence || String(b.passEvidence).trim() === '');
    expect(missing.map((b) => ({ id: b.id, title: b.title, blockType: b.blockType }))).toEqual([]);
  });

  it('every execution block for a multi-lane plan (product + creative + income) passes all 5 substrate checks', () => {
    const blocks = generateBlocks([PRODUCT_LANE, CREATIVE_LANE, INCOME_LANE]);
    const execBlocks = getExecutionBlocks(blocks);
    expect(execBlocks.length).toBeGreaterThan(0);

    const failing = execBlocks.filter((b) =>
      !b.owner || String(b.owner).trim() === '' ||
      !b.durationMinutes || b.durationMinutes <= 0 ||
      !b.producesArtifact || String(b.producesArtifact).trim() === '' ||
      !Array.isArray(b.consumedBy) || b.consumedBy.length === 0 ||
      !b.passEvidence || String(b.passEvidence).trim() === ''
    );

    expect(failing.map((b) => ({
      id: b.id, blockType: b.blockType, title: b.title.slice(0, 60),
      missingFields: [
        !b.owner && 'owner',
        (!b.durationMinutes || b.durationMinutes <= 0) && 'durationMinutes',
        (!b.producesArtifact || String(b.producesArtifact).trim() === '') && 'producesArtifact',
        (!Array.isArray(b.consumedBy) || b.consumedBy.length === 0) && 'consumedBy',
        (!b.passEvidence || String(b.passEvidence).trim() === '') && 'passEvidence',
      ].filter(Boolean),
    }))).toEqual([]);
  });

  it('every execution block for a multi-lane plan has consumedByRef with a non-empty non-vague id', () => {
    const VAGUE = new Set(['plan', 'downstream', 'later', 'tbd', 'future', 'unknown', '']);
    const blocks = generateBlocks([PRODUCT_LANE, CREATIVE_LANE, INCOME_LANE]);
    const execBlocks = getExecutionBlocks(blocks);
    const failing = execBlocks.filter((b) => {
      const ref = b.consumedByRef;
      if (!ref || !ref.id || !ref.type) return true;
      return VAGUE.has(String(ref.id).toLowerCase().trim());
    });
    expect(failing.map((b) => ({ id: b.id, blockType: b.blockType, consumedByRef: b.consumedByRef }))).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Substance Gate integration: generated blocks must not produce substrate codes
// ---------------------------------------------------------------------------

describe('Generator substrate compliance: Substance Gate produces no MISSING_EXECUTION_* codes', () => {
  it('product lane blocks passed to evaluatePlanQualityGate produce no substrate failure codes', () => {
    const blocks = generateBlocks([PRODUCT_LANE]);
    const result = evaluatePlanQualityGate({
      goalText: 'Build and launch SaaS product to $10k MRR in 3 years',
      verificationText: 'Monthly recurring revenue reaches $10,000 confirmed by Stripe dashboard',
      proposedBlocks: blocks,
      committedBlocks: [],
      temporalContext: { contractStartDayKey: '2026-01-01', contractEndDayKey: '2028-12-31' },
    });
    const substrateFailures = result.failureCodes.filter((c) => SUBSTRATE_CODES.includes(c));
    expect(substrateFailures).toEqual([]);
  });

  it('multi-lane blocks passed to evaluatePlanQualityGate produce no substrate failure codes', () => {
    const blocks = generateBlocks([PRODUCT_LANE, CREATIVE_LANE, INCOME_LANE]);
    const result = evaluatePlanQualityGate({
      goalText: 'Build SaaS product, release album, and grow consulting income over 3 years',
      verificationText: 'All three ventures active with measurable revenue and audience',
      proposedBlocks: blocks,
      committedBlocks: [],
      temporalContext: { contractStartDayKey: '2026-01-01', contractEndDayKey: '2028-12-31' },
    });
    const substrateFailures = result.failureCodes.filter((c) => SUBSTRATE_CODES.includes(c));
    expect(substrateFailures).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Review-class blocks: gate does not false-positive on exempt block types
// ---------------------------------------------------------------------------

describe('Generator substrate compliance: review-class blocks do not trip substrate gate', () => {
  it('review and audit blocks from the generator are correctly classified as exempt', () => {
    const blocks = generateBlocks([PRODUCT_LANE]);
    const reviewBlocks = getReviewClassBlocks(blocks);
    expect(reviewBlocks.length).toBeGreaterThan(0);
    // If we ran the gate on only review-class blocks, no substrate codes should appear
    const result = evaluatePlanQualityGate({
      goalText: 'Build and launch SaaS product',
      verificationText: 'SaaS product live and generating revenue',
      proposedBlocks: reviewBlocks,
      committedBlocks: [],
    });
    const substrateFailures = result.failureCodes.filter((c) => SUBSTRATE_CODES.includes(c));
    expect(substrateFailures).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Phase workload distribution: generated plan passes temporal checks
// ---------------------------------------------------------------------------

describe('Generator temporal workload compliance', () => {
  const TEMPORAL_CODES = [
    'PHASE_WITHOUT_EXECUTION_WORK',
    'FRONT_LOADED_EXECUTION',
    'SPARSE_HORIZON_COVERAGE',
  ];
  const TEMPORAL_3Y = { contractStartDayKey: '2026-01-01', contractEndDayKey: '2028-12-31' };

  it('multi-lane generated plan does not trip any phase workload codes', () => {
    const blocks = generateBlocks([PRODUCT_LANE, CREATIVE_LANE, INCOME_LANE]);
    const result = evaluatePlanQualityGate({
      goalText: 'Build SaaS product, release album, and grow consulting income over 3 years',
      verificationText: 'All three ventures active with measurable revenue and audience',
      proposedBlocks: blocks,
      committedBlocks: [],
      temporalContext: TEMPORAL_3Y,
    });
    const found = result.failureCodes.filter((c) => TEMPORAL_CODES.includes(c));
    expect(found).toEqual([]);
  });

  it('all three phases have execution work in the generated multi-lane plan', () => {
    const EXEMPT = new Set(['review', 'audit', 'terminal-review', 'terminal-readiness', 'gate', 'checkpoint']);
    const blocks = generateBlocks([PRODUCT_LANE, CREATIVE_LANE, INCOME_LANE]);
    const blocksByPhase = { P1: [], P2: [], P3: [] };
    blocks.forEach((b) => {
      const phase = b?.phaseLabel?.toUpperCase();
      if (phase && blocksByPhase[phase]) {
        const isExempt = EXEMPT.has(b.blockType) || b.owner === 'reviewer' || b.owner === 'system';
        if (!isExempt) blocksByPhase[phase].push(b);
      }
    });
    expect(blocksByPhase['P1'].length).toBeGreaterThan(0);
    expect(blocksByPhase['P2'].length).toBeGreaterThan(0);
    expect(blocksByPhase['P3'].length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// MONITORING_WITHOUT_PRODUCTION: default descriptor mix check
// ---------------------------------------------------------------------------

describe('Generator MONITORING_WITHOUT_PRODUCTION compliance', () => {
  it('multi-lane plan does not trip MONITORING_WITHOUT_PRODUCTION', () => {
    const blocks = generateBlocks([PRODUCT_LANE, CREATIVE_LANE, INCOME_LANE]);
    const result = evaluatePlanQualityGate({
      goalText: 'Build SaaS product, release album, and grow consulting income over 3 years',
      verificationText: 'All three ventures active with measurable revenue and audience',
      proposedBlocks: blocks,
      committedBlocks: [],
    });
    expect(result.failureCodes).not.toContain('MONITORING_WITHOUT_PRODUCTION');
  });

  it('execution blocks outnumber review-class blocks in a multi-lane plan', () => {
    const blocks = generateBlocks([PRODUCT_LANE, CREATIVE_LANE, INCOME_LANE]);
    const classifiedBlocks = blocks.filter((b) => b?.blockType);
    const reviewCount = classifiedBlocks.filter((b) => isReviewClass(b)).length;
    const execCount = classifiedBlocks.filter((b) => !isReviewClass(b)).length;
    expect(execCount).toBeGreaterThan(0);
    expect(reviewCount / (reviewCount + execCount)).toBeLessThanOrEqual(0.5);
  });
});
