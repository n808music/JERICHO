import { describe, expect, it } from 'vitest';

import { evaluatePrePlanFeasibility, inspectAcquisitionEnabledBridgePath, deriveWarmAudienceProof } from './prePlanFeasibility';
import type { StructuredPlanningIntake } from './StructuredPlanningIntake';
import { gumBrandFounderIntake } from '../../../tests/fixtures/gumBrandFounderIntake';

function buildRegulatedIntake(overrides: Partial<StructuredPlanningIntake> = {}): StructuredPlanningIntake {
  return {
    goalClassification: 'regulated_physical_consumable',
    executionContext: 'part_time',
    weeklyHoursAvailable: 15,
    capitalAvailable: 30000,
    hardDeadline: null,
    existingDomainRelationships: [],
    formulaPathway: 'base_modification',
    targetCategory: 'food_product',
    distributionChannel: 'direct_to_consumer',
    ...overrides,
  };
}

describe('pre-plan feasibility', () => {
  it('returns VIABLE when intake constraints are consistent', () => {
    const result = evaluatePrePlanFeasibility(
      buildRegulatedIntake({
        capitalAvailable: 45000,
        hardDeadline: '2027-03-01',
      }),
      { startDayKey: '2026-06-01' }
    );

    expect(result.status).toBe('VIABLE');
  });

  it('returns VIABLE_WITH_ADJUSTED_TIMELINE when the deadline is shorter than domain minimums', () => {
    const result = evaluatePrePlanFeasibility(
      buildRegulatedIntake({
        capitalAvailable: 45000,
        hardDeadline: '2026-08-01',
      }),
      { startDayKey: '2026-06-01' }
    );

    expect(result.status).toBe('VIABLE_WITH_ADJUSTED_TIMELINE');
    if (result.status !== 'VIABLE_WITH_ADJUSTED_TIMELINE') return;
    expect(result.statedDeadline).toBe('2026-08-01');
    expect(result.realisticMinimumDate > result.statedDeadline).toBe(true);
    expect(result.primaryConstraint).toBe('sample_cycle_duration');
  });

  it('returns CAPITAL_CONSTRAINED with the correct gate and gap when capital is below the first gate', () => {
    const result = evaluatePrePlanFeasibility(
      buildRegulatedIntake({
        capitalAvailable: 1000,
        hardDeadline: '2027-03-01',
      }),
      { startDayKey: '2026-06-01' }
    );

    expect(result.status).toBe('CAPITAL_CONSTRAINED');
    if (result.status !== 'CAPITAL_CONSTRAINED') return;
    expect(result.constrainedGate).toBe('regulatory_consultant');
    expect(result.estimatedRequirement).toBeGreaterThan(result.userCapital);
    expect(result.gap).toBeGreaterThan(0);
  });

  it('returns VIABLE_WITH_CAPITAL_ACQUISITION_REQUIRED for the canonical gum founder bridge case', () => {
    const result = evaluatePrePlanFeasibility(
      {
        ...gumBrandFounderIntake,
        formulaPathway: 'white_label',
      } as unknown as StructuredPlanningIntake,
      { startDayKey: '2026-04-25' }
    );

    expect(result.status).toBe('VIABLE_WITH_CAPITAL_ACQUISITION_REQUIRED');
    if (result.status !== 'VIABLE_WITH_CAPITAL_ACQUISITION_REQUIRED') return;
    expect(result.recommendedPathway).toBe('white_label');
    expect(result.criticalGate).toBe('moq_production_deposit');
    expect(result.criticalGateAmount).toBe(8000);
  });

  it('keeps a zero-capital white-label consumable without audience or revenue as CAPITAL_CONSTRAINED', () => {
    const result = evaluatePrePlanFeasibility(
      buildRegulatedIntake({
        capitalAvailable: 0,
        capitalAcquisitionRequired: true,
        formulaPathway: 'white_label',
        targetCategory: 'functional_food',
        distributionChannel: 'direct_to_consumer',
        capitalCommitmentConfidence: 'uncertain',
        capitalAcquisitionAssets: {
          existingAudience: {
            spotifyListeners: 0,
            instagramFollowers: 0,
            audienceRelationship: null,
            influencerNetwork: false,
            entrepreneurNetwork: false,
          },
          existingRevenue: {
            projectManagementCompany: false,
            allocationToPossible: false,
          },
        } as any,
      }),
      { startDayKey: '2026-06-01' }
    );

    expect(result.status).toBe('CAPITAL_CONSTRAINED');
  });

  it('returns VIABLE_WITH_CAPITAL_ACQUISITION_REQUIRED for the canonical gum founder profile with undecided pathway (raw answeredContext path)', () => {
    const result = evaluatePrePlanFeasibility(
      gumBrandFounderIntake as unknown as StructuredPlanningIntake,
      { startDayKey: '2026-04-25' }
    );

    expect(result.status).toBe('VIABLE_WITH_CAPITAL_ACQUISITION_REQUIRED');
    if (result.status !== 'VIABLE_WITH_CAPITAL_ACQUISITION_REQUIRED') return;
    expect(result.recommendedPathway).toBe('white_label');
    expect(result.criticalGate).toBe('moq_production_deposit');
    expect(result.criticalGateAmount).toBe(8000);
  });

  it('returns VIABLE_WITH_CAPITAL_ACQUISITION_REQUIRED for the canonical gum founder profile with null pathway (assembled intake path)', () => {
    const result = evaluatePrePlanFeasibility(
      { ...gumBrandFounderIntake, formulaPathway: null } as unknown as StructuredPlanningIntake,
      { startDayKey: '2026-04-25' }
    );

    expect(result.status).toBe('VIABLE_WITH_CAPITAL_ACQUISITION_REQUIRED');
    if (result.status !== 'VIABLE_WITH_CAPITAL_ACQUISITION_REQUIRED') return;
    expect(result.recommendedPathway).toBe('white_label');
    expect(result.criticalGate).toBe('moq_production_deposit');
    expect(result.criticalGateAmount).toBe(8000);
  });

  it('shows marketplace fails the narrow bridge-path branch while the broader fallback branch still upgrades the case', () => {
    const intake = {
      ...gumBrandFounderIntake,
      formulaPathway: null,
      distributionChannel: 'marketplace',
    } as unknown as StructuredPlanningIntake;

    const inspection = inspectAcquisitionEnabledBridgePath(intake);
    const result = evaluatePrePlanFeasibility(intake, { startDayKey: '2026-04-25' });

    expect(inspection.qualifies).toBe(false);
    expect(inspection.criteria.regulatedConsumable).toBe(true);
    expect(inspection.criteria.lowerCapitalBand).toBe(true);
    expect(inspection.criteria.capitalAcquisitionRequired).toBe(true);
    expect(inspection.criteria.whiteLabelPathway).toBe(true);
    expect(inspection.criteria.directToConsumerChannel).toBe(false);
    expect(inspection.criteria.supportedCategory).toBe(true);
    expect(inspection.criteria.hasWarmAccess).toBe(true);
    expect(inspection.failedCriteria).toEqual(['directToConsumerChannel']);

    expect(result.status).toBe('VIABLE_WITH_CAPITAL_ACQUISITION_REQUIRED');
  });

  it('keeps a null-pathway zero-capital profile without warm audience as CAPITAL_CONSTRAINED', () => {
    const result = evaluatePrePlanFeasibility(
      buildRegulatedIntake({
        capitalAvailable: 0,
        capitalAcquisitionRequired: true,
        formulaPathway: null,
        targetCategory: 'functional_food',
        distributionChannel: 'direct_to_consumer',
        capitalAcquisitionAssets: {
          existingAudience: {
            spotifyListeners: 0,
            instagramFollowers: 0,
            audienceRelationship: null,
            influencerNetwork: false,
            entrepreneurNetwork: false,
          },
          existingRevenue: {
            projectManagementCompany: false,
            allocationToPossible: false,
          },
        } as any,
      }),
      { startDayKey: '2026-06-01' }
    );

    expect(result.status).toBe('CAPITAL_CONSTRAINED');
  });

  it('deriveWarmAudienceProof picks instagramFollowers as the proof source when spotifyListeners is zero', () => {
    const intake = buildRegulatedIntake({
      capitalAvailable: 0,
      capitalAcquisitionRequired: true,
      capitalAcquisitionAssets: {
        existingAudience: {
          spotifyListeners: 0,
          instagramFollowers: 1000,
          audienceRelationship: null,
          influencerNetwork: false,
          entrepreneurNetwork: false,
        },
        existingRevenue: null,
      } as any,
    });
    const proof = deriveWarmAudienceProof(intake);
    expect(proof.hasWarmAudienceProof).toBe(true);
    expect(proof.warmAudienceProofSource).toBe('instagramFollowers');
    expect(proof.warmAudienceProofCount).toBe(1000);
  });

  it('white_label + low capital + instagramFollowers 1000 avoids CAPITAL_CONSTRAINED (ENT-01 regression)', () => {
    const result = evaluatePrePlanFeasibility(
      buildRegulatedIntake({
        capitalAvailable: 0,
        capitalAcquisitionRequired: true,
        formulaPathway: 'white_label',
        targetCategory: 'functional_food',
        distributionChannel: 'marketplace',
        capitalAcquisitionAssets: {
          existingAudience: {
            spotifyListeners: 0,
            instagramFollowers: 1000,
            audienceRelationship: null,
            influencerNetwork: false,
            entrepreneurNetwork: false,
          },
          existingRevenue: null,
        } as any,
      }),
      { startDayKey: '2026-04-26' }
    );
    expect(result.status).toBe('VIABLE_WITH_CAPITAL_ACQUISITION_REQUIRED');
  });

  it('inspectAcquisitionEnabledBridgePath exposes warm audience proof fields for ENT-01 profile', () => {
    const inspection = inspectAcquisitionEnabledBridgePath(
      buildRegulatedIntake({
        capitalAvailable: 0,
        capitalAcquisitionRequired: true,
        formulaPathway: 'white_label',
        targetCategory: 'functional_food',
        distributionChannel: 'marketplace',
        capitalAcquisitionAssets: {
          existingAudience: {
            spotifyListeners: 0,
            instagramFollowers: 1000,
            audienceRelationship: null,
            influencerNetwork: false,
            entrepreneurNetwork: false,
          },
          existingRevenue: null,
        } as any,
      })
    );
    expect(inspection.normalized.spotifyListeners).toBe(0);
    expect(inspection.normalized.instagramFollowers).toBe(1000);
    expect(inspection.normalized.warmAudienceProofCount).toBe(1000);
    expect(inspection.normalized.warmAudienceProofSource).toBe('instagramFollowers');
    expect(inspection.normalized.hasWarmAudienceProof).toBe(true);
    expect(inspection.normalized.fallbackProofPassed).toBe(true);
    // narrow DTC branch fails (marketplace), but fallback proof is still visible
    expect(inspection.criteria.directToConsumerChannel).toBe(false);
    expect(inspection.failedCriteria).toContain('directToConsumerChannel');
  });

  it('white_label + low capital + audience counts all below 1000 stays CAPITAL_CONSTRAINED via fallback (narrow DTC branch excluded by marketplace)', () => {
    const result = evaluatePrePlanFeasibility(
      buildRegulatedIntake({
        capitalAvailable: 0,
        capitalAcquisitionRequired: true,
        formulaPathway: 'white_label',
        targetCategory: 'functional_food',
        distributionChannel: 'marketplace',
        capitalAcquisitionAssets: {
          existingAudience: {
            spotifyListeners: 200,
            instagramFollowers: 300,
            audienceRelationship: null,
            influencerNetwork: false,
            entrepreneurNetwork: false,
          },
          existingRevenue: null,
        } as any,
      }),
      { startDayKey: '2026-04-26' }
    );
    expect(result.status).toBe('CAPITAL_CONSTRAINED');
  });

  it('spotifyListeners >= 1000 fallback still passes (existing behavior unchanged)', () => {
    const result = evaluatePrePlanFeasibility(
      buildRegulatedIntake({
        capitalAvailable: 0,
        capitalAcquisitionRequired: true,
        formulaPathway: 'white_label',
        targetCategory: 'functional_food',
        distributionChannel: 'marketplace',
        capitalAcquisitionAssets: {
          existingAudience: {
            spotifyListeners: 23000,
            instagramFollowers: 0,
            audienceRelationship: null,
            influencerNetwork: false,
            entrepreneurNetwork: false,
          },
          existingRevenue: null,
        } as any,
      }),
      { startDayKey: '2026-04-26' }
    );
    expect(result.status).toBe('VIABLE_WITH_CAPITAL_ACQUISITION_REQUIRED');
  });

  it('allocationToPossible revenue fallback still passes (existing behavior unchanged)', () => {
    const result = evaluatePrePlanFeasibility(
      buildRegulatedIntake({
        capitalAvailable: 0,
        capitalAcquisitionRequired: true,
        formulaPathway: 'white_label',
        targetCategory: 'functional_food',
        distributionChannel: 'marketplace',
        capitalAcquisitionAssets: {
          existingAudience: {
            spotifyListeners: 0,
            instagramFollowers: 0,
            audienceRelationship: null,
            influencerNetwork: false,
            entrepreneurNetwork: false,
          },
          existingRevenue: { projectManagementCompany: false, allocationToPossible: true },
        } as any,
      }),
      { startDayKey: '2026-04-26' }
    );
    expect(result.status).toBe('VIABLE_WITH_CAPITAL_ACQUISITION_REQUIRED');
  });

  it('returns PATHWAY_MISMATCH when custom development is incompatible with the deadline', () => {
    const result = evaluatePrePlanFeasibility(
      buildRegulatedIntake({
        formulaPathway: 'custom_development',
        capitalAvailable: 60000,
        hardDeadline: '2026-10-01',
      }),
      { startDayKey: '2026-07-01' }
    );

    expect(result.status).toBe('PATHWAY_MISMATCH');
    if (result.status !== 'PATHWAY_MISMATCH') return;
    expect(result.selectedPathway).toBe('custom_development');
    expect(result.suggestedPathway).toBe('base_modification');
    expect(result.issue).toBe('timeline_incompatible');
  });
});
