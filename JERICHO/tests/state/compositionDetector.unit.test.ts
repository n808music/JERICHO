import { describe, expect, it } from 'vitest';
import {
  detectSecondaryArchetype,
  BRIDGE_DELIVERABLES_BY_PAIR,
  MAX_BRIDGE_DELIVERABLES,
  type SupportedCompositionPair,
  type CompositionPairId,
} from '../../src/state/engine/compositionDetector';

// ─── Family class fixture ─────────────────────────────────────────────────────
//
// Externally-mediated archetypes per QUALIFYING_EXTERNAL_STAGES in probabilityScore.ts.
// P.O.S. primary-only rule: composition does NOT change the familyClass derived from
// the primary archetype. This set is authoritative for the Tier 5 assertions.
const EXTERNALLY_MEDIATED = new Set(['JobSearchPipeline', 'SalesPipeline', 'Fundraising']);

// ─── Tier 1: Detection — 4 tests (CC-001 through CC-004) ─────────────────────
//
// Each test: canonical multi-archetype goal text → detectSecondaryArchetype() returns
// the correct supported composition pair.

describe('Tier 1 — composition detection (CC series)', () => {
  // CC-001: VentureLaunch (primary) + BrandLaunch (secondary)
  // brand + identity in goal text → CP-001
  it('CC-001: detects CP-001 (VentureLaunch + BrandLaunch) from canonical composition text', () => {
    const result = detectSecondaryArchetype(
      'build my startup MVP and launch with a strong brand identity',
      'VentureLaunch'
    );
    expect(result).not.toBeNull();
    expect(result!.primary).toBe('VentureLaunch');
    expect(result!.secondary).toBe('BrandLaunch');
    expect(result!.pairId).toBe('CP-001');
    expect(result!.injectionPoint).toBe('define:001:deck');
  });

  // CC-002: VentureLaunch (primary) + Fundraising (secondary)
  // raise + angel in goal text → CP-002
  it('CC-002: detects CP-002 (VentureLaunch + Fundraising) from canonical composition text', () => {
    const result = detectSecondaryArchetype('launch my product and raise an angel seed round', 'VentureLaunch');
    expect(result).not.toBeNull();
    expect(result!.primary).toBe('VentureLaunch');
    expect(result!.secondary).toBe('Fundraising');
    expect(result!.pairId).toBe('CP-002');
    expect(result!.injectionPoint).toBe('define:001:deck');
  });

  // CC-003: BrandLaunch (primary) + CreativeProduction (secondary)
  // podcast in goal text → CP-003 (threshold = 1 for creative signals)
  it('CC-003: detects CP-003 (BrandLaunch + CreativeProduction) from canonical composition text', () => {
    const result = detectSecondaryArchetype(
      'define my brand identity system and launch a weekly podcast',
      'BrandLaunch'
    );
    expect(result).not.toBeNull();
    expect(result!.primary).toBe('BrandLaunch');
    expect(result!.secondary).toBe('CreativeProduction');
    expect(result!.pairId).toBe('CP-003');
    expect(result!.injectionPoint).toBe('asset:002:brand-kit');
  });

  // CC-004: JobSearchPipeline (primary) + ProfessionalQualification (secondary)
  // aws + cert + exam → 3 tokens ≥ threshold of 2 → CP-004
  it('CC-004: detects CP-004 (JobSearchPipeline + ProfessionalQualification) from canonical composition text', () => {
    const result = detectSecondaryArchetype(
      'job search for PM roles while studying for AWS cert exam',
      'JobSearchPipeline'
    );
    expect(result).not.toBeNull();
    expect(result!.primary).toBe('JobSearchPipeline');
    expect(result!.secondary).toBe('ProfessionalQualification');
    expect(result!.pairId).toBe('CP-004');
    expect(result!.injectionPoint).toBe('PARALLEL');
  });
});

// ─── Tier 2: Non-detection — 4 tests (CN-001 through CN-004) ─────────────────
//
// Each test: single-archetype input (no secondary signals or below threshold) →
// detectSecondaryArchetype() returns null.

describe('Tier 2 — non-detection / single-archetype inputs (CN series)', () => {
  // CN-001: VentureLaunch goal with no brand/identity/positioning secondary signals
  it('CN-001: returns null for single-archetype VentureLaunch goal with no composition signals', () => {
    expect(detectSecondaryArchetype('build and launch an MVP for a startup', 'VentureLaunch')).toBeNull();
  });

  // CN-002: BrandLaunch goal with brand/identity/positioning signals but no creative tokens
  it('CN-002: returns null for single-archetype BrandLaunch goal with no creative secondary signals', () => {
    expect(detectSecondaryArchetype('define brand identity and visual positioning', 'BrandLaunch')).toBeNull();
  });

  // CN-003: JobSearchPipeline goal with no cert/exam/aws secondary signals
  it('CN-003: returns null for single-archetype JobSearchPipeline goal with no PQ signals', () => {
    expect(detectSecondaryArchetype('submit job applications and prep for interviews', 'JobSearchPipeline')).toBeNull();
  });

  // CN-004: Fundraising as primary — no supported pair has Fundraising as primary in Tier A
  it('CN-004: returns null when primary is Fundraising (no supported secondary pair)', () => {
    expect(
      detectSecondaryArchetype('raise an angel round with investor deck and diligence data room', 'Fundraising')
    ).toBeNull();
  });
});

// ─── Tier 3: Unsupported pairing fallback — 2 tests (CX-001 through CX-002) ──
//
// Multi-archetype text with an unsupported pairing → returns null.
// These pairings are explicitly deferred in the Phase C plan.

describe('Tier 3 — unsupported pairing fallback (CX series)', () => {
  // CX-001: SalesPipeline + Fundraising — both externally mediated, conflicting P.O.S. gates
  // No supported pair has SalesPipeline as primary with Fundraising as secondary
  it('CX-001: returns null for unsupported SalesPipeline+Fundraising combination', () => {
    expect(
      detectSecondaryArchetype('build sales pipeline and close deals while raising angel funding', 'SalesPipeline')
    ).toBeNull();
  });

  // CX-002: VentureLaunch + PhysicalTraining — PhysicalTraining as secondary is explicitly deferred
  // VentureLaunch primary: only BrandLaunch and Fundraising are supported secondaries
  it('CX-002: returns null for unsupported VentureLaunch+PhysicalTraining combination', () => {
    // VentureLaunch primary only detects BrandLaunch or Fundraising secondary.
    // "training" is a physical token; it is not in brand or fundraising secondary detectors.
    expect(
      detectSecondaryArchetype('launch startup brand and run a physical training program', 'VentureLaunch')
    ).toBeNull();
  });
});

// ─── Tier 4: goalContract field correctness — 4 tests (CF-001 through CF-004) ─
//
// Each test: after composition detection, the returned object has the correct field shape.
// Uses CP-002 (VentureLaunch + Fundraising) as the reference composition.

describe('Tier 4 — composition result field shape (CF series)', () => {
  let pair: SupportedCompositionPair;

  // Use CP-002 as the reference — it tests the most structurally interesting pair
  // (internally controlled primary + externally mediated secondary)
  const referenceText = 'launch my product and raise an angel seed round';

  it('CF-001: compositeGrammar.secondary is a valid MigratedArchetype string', () => {
    pair = detectSecondaryArchetype(referenceText, 'VentureLaunch')!;
    expect(pair).not.toBeNull();
    expect(typeof pair.secondary).toBe('string');
    expect(pair.secondary.length).toBeGreaterThan(0);
    expect(pair.secondary).toBe('Fundraising');
  });

  it('CF-002: compositeGrammar.pairId is a valid pair ID (CP-XXX format)', () => {
    pair = detectSecondaryArchetype(referenceText, 'VentureLaunch')!;
    expect(pair).not.toBeNull();
    expect(pair.pairId).toMatch(/^CP-00[1-4]$/);
    expect(pair.pairId).toBe('CP-002');
  });

  it('CF-003: compositeGrammar.detectionSignals is a non-empty array of strings', () => {
    pair = detectSecondaryArchetype(referenceText, 'VentureLaunch')!;
    expect(pair).not.toBeNull();
    expect(Array.isArray(pair.detectionSignals)).toBe(true);
    expect(pair.detectionSignals.length).toBeGreaterThan(0);
    pair.detectionSignals.forEach((signal) => {
      expect(typeof signal).toBe('string');
      expect(signal.length).toBeGreaterThan(0);
    });
  });

  it('CF-004: compositeGrammar.injectionPoint is a non-empty string', () => {
    pair = detectSecondaryArchetype(referenceText, 'VentureLaunch')!;
    expect(pair).not.toBeNull();
    expect(typeof pair.injectionPoint).toBe('string');
    expect(pair.injectionPoint.length).toBeGreaterThan(0);
  });
});

// ─── Tier 5: P.O.S. primary-only rule — 2 tests (CP-POS series) ──────────────
//
// These tests verify the Phase C completion boundary rule:
// "P.O.S. follows primary archetype exclusively."
//
// The family class of the goalContract is derived from the PRIMARY archetype, not the secondary.
// Externally-mediated archetypes: JobSearchPipeline, SalesPipeline, Fundraising
// (authoritative source: QUALIFYING_EXTERNAL_STAGES in probabilityScore.ts)
//
// If these assertions fail, a composition result has incorrectly placed an externally-mediated
// archetype in the primary slot — which would corrupt P.O.S. gating for the goal.

describe('Tier 5 — P.O.S. primary-only rule (CP-POS series)', () => {
  // CP-POS-001: VentureLaunch (primary, internally_controlled) + Fundraising (secondary, externally_mediated)
  // Primary wins: goalContract.familyClass = 'internally_controlled'
  // Investor commitment evidence does NOT gate P.O.S. to trusted for this composition.
  it('CP-POS-001: CP-002 primary is VentureLaunch (internally_controlled), not Fundraising', () => {
    const result = detectSecondaryArchetype('launch my product and raise an angel seed round', 'VentureLaunch');
    expect(result).not.toBeNull();
    expect(result!.pairId).toBe('CP-002');

    // Primary is internally controlled — NOT in the externally-mediated set
    expect(EXTERNALLY_MEDIATED.has(result!.primary)).toBe(false);
    expect(result!.primary).toBe('VentureLaunch');

    // Secondary is externally mediated — but the secondary does NOT determine familyClass
    expect(EXTERNALLY_MEDIATED.has(result!.secondary)).toBe(true);
    expect(result!.secondary).toBe('Fundraising');

    // Invariant: primary-only governs. If executionType = 'VentureLaunch' and
    // compositeGrammar.secondary = 'Fundraising', the goalContract.familyClass = 'internally_controlled'.
    // This is verified structurally: primary is not externally mediated.
  });

  // CP-POS-002: JobSearchPipeline (primary, externally_mediated) + ProfessionalQualification (secondary, internally_controlled)
  // Primary wins: goalContract.familyClass = 'externally_mediated'
  // PQ's internal completion gate does NOT add an external evidence requirement.
  it('CP-POS-002: CP-004 primary is JobSearchPipeline (externally_mediated), PQ gate does not apply', () => {
    const result = detectSecondaryArchetype(
      'job search for PM roles while studying for AWS cert exam',
      'JobSearchPipeline'
    );
    expect(result).not.toBeNull();
    expect(result!.pairId).toBe('CP-004');

    // Primary is externally mediated — IS in the externally-mediated set
    expect(EXTERNALLY_MEDIATED.has(result!.primary)).toBe(true);
    expect(result!.primary).toBe('JobSearchPipeline');

    // Secondary is internally controlled — does NOT shift familyClass to internally_controlled
    expect(EXTERNALLY_MEDIATED.has(result!.secondary)).toBe(false);
    expect(result!.secondary).toBe('ProfessionalQualification');

    // Invariant: primary-only governs. The goal's familyClass = 'externally_mediated' because
    // JobSearchPipeline is the primary. PQ's internal gates do not apply.
  });
});

// ─── Threshold behavior ───────────────────────────────────────────────────────
//
// Verify that secondary signals below threshold correctly return null.
// This documents the minimum signal requirement per pair.

describe('Threshold boundary — single secondary signal is insufficient (except CP-003)', () => {
  // CP-001: brand token alone (1 hit) does not meet threshold of 2
  it('CP-001: single brand token does not trigger BrandLaunch secondary (threshold = 2)', () => {
    expect(detectSecondaryArchetype('build my startup MVP and establish a brand', 'VentureLaunch')).toBeNull();
  });

  // CP-002: single fundraising token alone does not meet threshold of 2
  it('CP-002: single fundraising token does not trigger Fundraising secondary (threshold = 2)', () => {
    expect(detectSecondaryArchetype('build my startup MVP and maybe raise some money', 'VentureLaunch')).toBeNull();
  });

  // CP-003: single creative token IS sufficient (threshold = 1) — this is the documented exception
  it('CP-003: single creative token IS sufficient to trigger CreativeProduction secondary (threshold = 1)', () => {
    const result = detectSecondaryArchetype('build my brand identity and launch a podcast', 'BrandLaunch');
    expect(result).not.toBeNull();
    expect(result!.pairId).toBe('CP-003');
  });

  // CP-004: single PQ token alone does not meet threshold of 2
  // Note: 'certification' contains 'cert' as a substring — both tokens would fire.
  // Use a single atomic PQ token ('exam') to isolate the single-hit case.
  it('CP-004: single PQ token (exam only) does not trigger PQ secondary (threshold = 2)', () => {
    expect(detectSecondaryArchetype('job search while preparing for an exam', 'JobSearchPipeline')).toBeNull();
  });
});

// ─── Bridge deliverable catalog integrity ────────────────────────────────────
//
// Verify that the BRIDGE_DELIVERABLES_BY_PAIR catalog has valid structure for all 4 pairs.
// These tests guard against catalog corruption without re-testing detection logic.

describe('Bridge deliverable catalog integrity', () => {
  const pairIds: CompositionPairId[] = ['CP-001', 'CP-002', 'CP-003', 'CP-004'];

  it('each pair has between 1 and MAX_BRIDGE_DELIVERABLES bridge deliverables', () => {
    pairIds.forEach((pairId) => {
      const specs = BRIDGE_DELIVERABLES_BY_PAIR[pairId];
      expect(Array.isArray(specs)).toBe(true);
      expect(specs.length).toBeGreaterThanOrEqual(1);
      expect(specs.length).toBeLessThanOrEqual(MAX_BRIDGE_DELIVERABLES);
    });
  });

  it('each bridge deliverable has required fields: id, title, definitionOfDone, acceptanceCriteria, estimatedMinutes', () => {
    pairIds.forEach((pairId) => {
      BRIDGE_DELIVERABLES_BY_PAIR[pairId].forEach((spec) => {
        expect(typeof spec.id).toBe('string');
        expect(spec.id.length).toBeGreaterThan(0);
        expect(typeof spec.title).toBe('string');
        expect(spec.title.length).toBeGreaterThan(0);
        expect(typeof spec.definitionOfDone).toBe('string');
        expect(spec.definitionOfDone.length).toBeGreaterThan(0);
        expect(Array.isArray(spec.acceptanceCriteria)).toBe(true);
        expect(spec.acceptanceCriteria.length).toBeGreaterThan(0);
        expect(typeof spec.estimatedMinutes).toBe('number');
        expect(spec.estimatedMinutes).toBeGreaterThan(0);
      });
    });
  });

  // CP-004 (PARALLEL injection point): bridge deliverables must not depend on injection point
  // because PARALLEL means no primary dependency
  it('CP-004 bridge deliverables have dependsOnInjectionPoint = false (PARALLEL injection)', () => {
    BRIDGE_DELIVERABLES_BY_PAIR['CP-004'].forEach((spec) => {
      expect(spec.dependsOnInjectionPoint).toBe(false);
    });
  });
});
