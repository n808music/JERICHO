import type { StructuredPlanningIntake, FormulaPathway } from './StructuredPlanningIntake';
import { REGULATED_PHYSICAL_CONSUMABLE_REALISM } from './regulatedPhysicalConsumableRealism';

// ---------------------------------------------------------------------------
// Rich intake-personalization feasibility — intake-aware presale math, pathway
// recommendation, and capital phase breakdown. Separate from evaluatePrePlanFeasibility
// (which checks timeline/capital constraint status against domain minimums).
// ---------------------------------------------------------------------------

export type FeasibilityAcquisitionStatus =
  | 'VIABLE'
  | 'VIABLE_WITH_CAPITAL_ACQUISITION_REQUIRED'
  | 'NOT_VIABLE_CAPITAL_GAP'
  | 'DEFERRED_PENDING_ADDITIONAL_CONTEXT';

export type FeasibilityCapitalPhase = {
  min: number;
  max: number;
  timing: string;
  description: string;
};

export type FeasibilityPresaleMath = {
  target: number;
  suggestedUnitPrice: number;
  unitsRequired: number;
  audienceConversionRequired: number;
  interpretation: string;
};

export type FeasibilityAcquisitionPath = {
  primaryStrategy: string;
  reasoning: string;
  presaleMath?: FeasibilityPresaleMath;
  secondaryStrategy?: string;
  secondaryReasoning?: string;
};

export type IntakeFeasibilityReport = {
  status: FeasibilityAcquisitionStatus;
  standardPathCompletionMonths: number;
  capitalRequired: Record<string, FeasibilityCapitalPhase>;
  totalCapitalRequired: {
    min: number;
    max: number;
    criticalGate: string;
    criticalGateAmount: number;
    criticalGateTiming: string;
  };
  capitalAcquisitionPath?: FeasibilityAcquisitionPath;
  recommendedPathway: FormulaPathway;
  pathwayReasoning: string;
  velocityAsset?: string;
};

function parseFeasibilityTimelineMonths(timeline: string | null | undefined): number {
  if (!timeline) return 12;
  const m = /^(\d+)_months?$/.exec(String(timeline).toLowerCase().trim());
  if (m?.[1]) return parseInt(m[1], 10);
  const n = /^(\d+)$/.exec(String(timeline).trim());
  if (n?.[1]) return parseInt(n[1], 10);
  return 12;
}

function selectFeasibilityPathway(intake: StructuredPlanningIntake): { pathway: FormulaPathway; reasoning: string } {
  const capitalAvailable = Number(intake.capitalAvailable ?? 0);
  const capitalAcquisitionRequired = intake.capitalAcquisitionRequired === true;

  if (capitalAvailable === 0 || capitalAcquisitionRequired) {
    return {
      pathway: 'white_label',
      reasoning:
        'Given zero starting capital and a 15-month window, white-label is the correct first move. ' +
        'Custom development adds $15,000–$30,000 and 6–12 months before you have a product. ' +
        'White-label gets you a real validated product with your branding. ' +
        'Version two can be proprietary once you have revenue and proof of market.',
    };
  }
  if (capitalAvailable < 10000) {
    return {
      pathway: 'white_label',
      reasoning:
        'Available capital is below the minimum threshold for custom development or base modification. ' +
        'White-label is the viable path at this capital level.',
    };
  }
  const explicit = intake.formulaPathway;
  if (explicit === 'custom_development' || explicit === 'base_modification') {
    return { pathway: explicit, reasoning: 'Selected pathway is viable given available capital and timeline.' };
  }
  return {
    pathway: 'white_label',
    reasoning: 'White-label selected as the default first-version path for speed and capital efficiency.',
  };
}

export function prePlanFeasibility(intake: StructuredPlanningIntake): IntakeFeasibilityReport {
  const capitalAvailable = Number(intake.capitalAvailable ?? 0);
  const capitalAcquisitionRequired = intake.capitalAcquisitionRequired === true;
  const legalFoundation = intake.legalFoundation;
  const entityState = String(legalFoundation?.existingEntityState || '').toUpperCase();
  const isIllinois = entityState === 'IL';
  const hasExistingEntity = legalFoundation?.existingEntity === true;
  const gumEntityExists = legalFoundation?.gumEntityExists === true;
  const capitalAcquisitionAssets = intake.capitalAcquisitionAssets;
  const existingAudience = capitalAcquisitionAssets?.existingAudience;
  const spotifyListeners = Number(existingAudience?.spotifyListeners ?? 0);
  const instagramFollowers = Number(existingAudience?.instagramFollowers ?? 0);

  const { pathway: recommendedPathway, reasoning: pathwayReasoning } = selectFeasibilityPathway(intake);
  const standardPathCompletionMonths = parseFeasibilityTimelineMonths(intake.recommendedTimeline);

  let status: FeasibilityAcquisitionStatus;
  if (capitalAvailable === 0 && capitalAcquisitionRequired) {
    status = 'VIABLE_WITH_CAPITAL_ACQUISITION_REQUIRED';
  } else if (capitalAvailable >= 20000) {
    status = 'VIABLE';
  } else if (capitalAcquisitionRequired) {
    status = 'VIABLE_WITH_CAPITAL_ACQUISITION_REQUIRED';
  } else {
    status = 'NOT_VIABLE_CAPITAL_GAP';
  }

  const moqGate = REGULATED_PHYSICAL_CONSUMABLE_REALISM.capitalGates.find((g) => g.gateId === 'moq_production_deposit');
  // White-label MOQ deposit is roughly 50% of the full capital gate (deposit, not full run)
  const moqDepositMin = moqGate ? Math.round(moqGate.minCost * 0.625) : 5000;
  const moqDepositMax =
    recommendedPathway === 'white_label' ? 8000 : moqGate ? Math.round(moqGate.typicalCost * 0.533) : 8000;

  const entityDescription =
    hasExistingEntity && !gumEntityExists && isIllinois
      ? 'Illinois LLC filing or Series LLC investigation, EIN, business bank account'
      : hasExistingEntity && !gumEntityExists
      ? 'New entity filing for gum brand (must be separate from existing entity), EIN, business bank account'
      : 'Business entity formation, EIN, business bank account';

  const capitalRequired: Record<string, FeasibilityCapitalPhase> = {
    phase1_entity_and_insurance: { min: 150, max: 500, timing: 'month_1', description: entityDescription },
    phase2_samples: {
      min: 50,
      max: recommendedPathway === 'custom_development' ? 500 : 200,
      timing: 'months_2_to_3',
      description:
        recommendedPathway === 'white_label' ? 'Bench samples from white-label manufacturers' : 'Sample development cycles from manufacturer',
    },
    phase3_label_review: {
      min: 500,
      max: 1500,
      timing: 'month_4',
      description: isIllinois
        ? 'Third-party food label review. Illinois has strict food labeling requirements. Do not skip.'
        : 'Third-party food label review for FDA compliance.',
    },
    phase4_moq_deposit: {
      min: moqDepositMin,
      max: moqDepositMax,
      timing: 'month_7',
      description: '50% production deposit for white-label MOQ run. This gate cannot be passed without this capital in the business account.',
    },
    phase4_packaging: { min: 2000, max: 5000, timing: 'months_5_to_7', description: 'Custom packaging design and production' },
    phase4_merchant_setup: {
      min: 0,
      max: 500,
      timing: 'months_8_to_10',
      description:
        'High-risk merchant account setup. Caffeine functional food is supplement-adjacent. Stripe and Shopify Payments may flag this category.',
    },
  };

  const totalMin = Object.values(capitalRequired).reduce((sum, p) => sum + p.min, 0);
  const totalMax = Object.values(capitalRequired).reduce((sum, p) => sum + p.max, 0);

  let capitalAcquisitionPath: FeasibilityAcquisitionPath | undefined;
  if (capitalAcquisitionRequired) {
    const criticalGateAmount = moqDepositMax;
    const suggestedUnitPrice = 40;
    const unitsRequired = Math.ceil(criticalGateAmount / suggestedUnitPrice);
    const audienceConversionRequired =
      spotifyListeners > 0 ? Math.round((unitsRequired / spotifyListeners) * 10000) / 10000 : 0;

    const presaleMath: FeasibilityPresaleMath | undefined =
      spotifyListeners > 0
        ? {
            target: criticalGateAmount,
            suggestedUnitPrice,
            unitsRequired,
            audienceConversionRequired,
            interpretation:
              `${unitsRequired} buyers from ${spotifyListeners.toLocaleString()} listeners is less than 1% conversion. ` +
              'This is achievable from a warm audience with a compelling founder story.',
          }
        : undefined;

    const hasExistingRevenue = capitalAcquisitionAssets?.existingRevenue?.projectManagementCompany === true;

    capitalAcquisitionPath = {
      primaryStrategy: spotifyListeners > 0 ? 'presale_campaign' : 'revenue_allocation',
      reasoning:
        spotifyListeners > 0
          ? `Your existing audience of ${spotifyListeners.toLocaleString()} Spotify listeners and ` +
            `${instagramFollowers.toLocaleString()} Instagram followers is a capital generation asset. ` +
            'A presale campaign targeting your warm audience can close the MOQ capital gap without loans or investors.'
          : 'Revenue from existing business activity directed toward this goal covers early phases.',
      ...(presaleMath ? { presaleMath } : {}),
      ...(hasExistingRevenue
        ? {
            secondaryStrategy: 'project_management_revenue_allocation',
            secondaryReasoning:
              'Revenue from your existing project management company directed toward the gum goal covers early phases while the presale campaign builds.',
          }
        : {}),
    };
  }

  let velocityAsset: string | undefined;
  const employmentStatus = String(intake.employmentStatus || '').toLowerCase();
  const weeklyHours = Number(intake.weeklyHoursAvailable ?? 0);
  if (employmentStatus === 'voluntarily_unemployed' && weeklyHours >= 40) {
    velocityAsset =
      'You are currently unemployed and focused full-time on this. This is your highest-velocity window. ' +
      'The plan is structured to make maximum use of this period before employment status potentially changes.';
  } else if (weeklyHours >= 40 && intake.executionContext === 'full_time') {
    velocityAsset = `You have ${weeklyHours} hours per week available. The plan is structured to make maximum use of this high-intensity execution window.`;
  }

  return {
    status,
    standardPathCompletionMonths,
    capitalRequired,
    totalCapitalRequired: {
      min: totalMin,
      max: totalMax,
      criticalGate: 'moq_deposit',
      criticalGateAmount: moqDepositMax,
      criticalGateTiming: 'month_7',
    },
    ...(capitalAcquisitionPath ? { capitalAcquisitionPath } : {}),
    recommendedPathway,
    pathwayReasoning,
    ...(velocityAsset ? { velocityAsset } : {}),
  };
}

export type PrePlanFeasibilityStatus =
  | 'VIABLE'
  | 'VIABLE_WITH_CAPITAL_ACQUISITION_REQUIRED'
  | 'VIABLE_WITH_ADJUSTED_TIMELINE'
  | 'CAPITAL_CONSTRAINED'
  | 'PATHWAY_MISMATCH';

export type PrePlanFeasibilityResult =
  | {
      status: 'VIABLE';
      explanation: string;
    }
  | {
      status: 'VIABLE_WITH_CAPITAL_ACQUISITION_REQUIRED';
      explanation: string;
      recommendedPathway: FormulaPathway;
      criticalGate: string;
      criticalGateAmount: number;
      criticalGateTiming: string;
    }
  | {
      status: 'VIABLE_WITH_ADJUSTED_TIMELINE';
      statedDeadline: string;
      realisticMinimumDate: string;
      primaryConstraint: string;
      explanation: string;
    }
  | {
      status: 'CAPITAL_CONSTRAINED';
      constrainedGate: string;
      estimatedRequirement: number;
      estimatedTiming: string;
      userCapital: number;
      gap: number;
      explanation: string;
    }
  | {
      status: 'PATHWAY_MISMATCH';
      selectedPathway: string;
      issue: 'timeline_incompatible' | 'capital_incompatible';
      explanation: string;
      suggestedPathway: string;
      suggestedPathwayTimelineDelta?: string;
    };

export type AcquisitionEnabledBridgePathInspection = {
  qualifies: boolean;
  normalized: {
    goalClassification: string;
    capitalAvailable: number;
    capitalAcquisitionRequired: boolean;
    rawPathwayKey: string;
    pathwayKey: string;
    distributionChannel: string;
    targetCategory: string;
    spotifyListeners: number;
    instagramFollowers: number;
    hasRevenueAllocation: boolean;
    warmAudienceProofCount: number;
    warmAudienceProofSource: string;
    hasWarmAudienceProof: boolean;
    fallbackProofPassed: boolean;
  };
  criteria: {
    regulatedConsumable: boolean;
    lowerCapitalBand: boolean;
    capitalAcquisitionRequired: boolean;
    whiteLabelPathway: boolean;
    directToConsumerChannel: boolean;
    supportedCategory: boolean;
    hasWarmAccess: boolean;
  };
  failedCriteria: string[];
};

function addBusinessDays(startDayKey: string, businessDays: number) {
  let cursor = String(startDayKey || '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(cursor)) {
    return null;
  }
  let remaining = Math.max(0, Math.floor(businessDays));
  while (remaining > 0) {
    const date = new Date(`${cursor}T12:00:00.000Z`);
    date.setUTCDate(date.getUTCDate() + 1);
    cursor = date.toISOString().slice(0, 10);
    const day = date.getUTCDay();
    if (day !== 0 && day !== 6) {
      remaining -= 1;
    }
  }
  return cursor;
}

function weeksToBusinessDays(weeks: number) {
  return Math.max(0, Math.round(weeks * 5));
}

function computeRegulatedPhysicalConsumableMinimumBusinessDays(intake: StructuredPlanningIntake) {
  const durations = REGULATED_PHYSICAL_CONSUMABLE_REALISM.durations;
  const pathwayModifiers = REGULATED_PHYSICAL_CONSUMABLE_REALISM.pathwayModifiers;
  const pathwayKey = String(intake.formulaPathway || 'base_modification') as keyof typeof pathwayModifiers;
  const pathwayModifier = pathwayModifiers[pathwayKey] || pathwayModifiers.base_modification;
  const sampleCycleCount = pathwayKey === 'custom_development' ? 3 : 2;

  const formulaApprovalBusinessDays =
    weeksToBusinessDays(pathwayModifier.additionalWeeks.min) +
    durations.manufacturerInitialResponse.min +
    durations.sampleCyclePerIteration.min * sampleCycleCount;
  const regulatoryTrackBusinessDays = durations.regulatoryReviewEngagement.min;
  const packagingTrackBusinessDays = durations.packagingProductionLeadTime.min;
  const merchantTrackBusinessDays = Math.max(
    60,
    durations.merchantAccountUnderwriting.min + 30
  );
  const productionBusinessDays = durations.productionRunLeadTime.min;

  return Math.max(
    formulaApprovalBusinessDays + productionBusinessDays,
    regulatoryTrackBusinessDays + productionBusinessDays,
    packagingTrackBusinessDays + productionBusinessDays,
    merchantTrackBusinessDays
  );
}

function computeCapitalTiming(startDayKey: string, monthOffset: number) {
  return addBusinessDays(startDayKey, Math.max(0, monthOffset - 1) * 20) || startDayKey;
}

export type WarmAudienceProof = {
  warmAudienceProofCount: number;
  warmAudienceProofSource: string;
  hasWarmAudienceProof: boolean;
};

export function deriveWarmAudienceProof(intake: StructuredPlanningIntake): WarmAudienceProof {
  const audience = intake.capitalAcquisitionAssets?.existingAudience;
  const candidates: Array<{ field: string; count: number }> = [
    { field: 'spotifyListeners', count: Number(audience?.spotifyListeners || 0) },
    { field: 'instagramFollowers', count: Number(audience?.instagramFollowers || 0) },
    { field: 'tiktokFollowers', count: Number((audience as any)?.tiktokFollowers || 0) },
    { field: 'youtubeSubscribers', count: Number((audience as any)?.youtubeSubscribers || 0) },
    { field: 'emailListSize', count: Number((audience as any)?.emailListSize || 0) },
    { field: 'waitlistCount', count: Number((audience as any)?.waitlistCount || 0) },
    { field: 'communityMembers', count: Number((audience as any)?.communityMembers || 0) },
  ].filter((c) => c.count > 0);

  const best = candidates.sort((a, b) => b.count - a.count)[0];
  const warmAudienceProofCount = best?.count ?? 0;
  const warmAudienceProofSource = best?.field ?? '';
  return {
    warmAudienceProofCount,
    warmAudienceProofSource,
    hasWarmAudienceProof: warmAudienceProofCount >= 1000,
  };
}

export function inspectAcquisitionEnabledBridgePath(
  intake: StructuredPlanningIntake
): AcquisitionEnabledBridgePathInspection {
  const capitalAvailable = Number(intake.capitalAvailable || 0);
  const capitalAcquisitionRequired = intake.capitalAcquisitionRequired === true;
  const rawPathwayKey = String(intake.formulaPathway || '').trim().toLowerCase();
  const isUndecidedPathway = rawPathwayKey === '' || rawPathwayKey === 'undecided';
  const pathwayKey =
    isUndecidedPathway && capitalAvailable === 0 && capitalAcquisitionRequired ? 'white_label' : rawPathwayKey;
  const distributionChannel = String(intake.distributionChannel || '').trim().toLowerCase();
  const targetCategory = String(intake.targetCategory || '').trim().toLowerCase();
  const spotifyListeners = Number(intake.capitalAcquisitionAssets?.existingAudience?.spotifyListeners || 0);
  const instagramFollowers = Number(intake.capitalAcquisitionAssets?.existingAudience?.instagramFollowers || 0);
  const hasRevenueAllocation = intake.capitalAcquisitionAssets?.existingRevenue?.allocationToPossible === true;
  const hasWarmAccess = spotifyListeners > 0 || instagramFollowers > 0 || hasRevenueAllocation;
  const { warmAudienceProofCount, warmAudienceProofSource, hasWarmAudienceProof } = deriveWarmAudienceProof(intake);
  const hasRevenueAllocationCheck = intake.capitalAcquisitionAssets?.existingRevenue?.allocationToPossible === true;
  const fallbackProofPassed = hasWarmAudienceProof || hasRevenueAllocationCheck;
  const criteria = {
    regulatedConsumable: intake.goalClassification === 'regulated_physical_consumable',
    lowerCapitalBand: capitalAvailable <= 1000,
    capitalAcquisitionRequired,
    whiteLabelPathway: pathwayKey === 'white_label',
    directToConsumerChannel: distributionChannel === 'direct_to_consumer',
    supportedCategory:
      targetCategory === 'food_product' ||
      targetCategory === 'dietary_supplement' ||
      targetCategory === 'functional_food',
    hasWarmAccess,
  };
  const failedCriteria = Object.entries(criteria)
    .filter(([, passed]) => !passed)
    .map(([criterion]) => criterion);

  return {
    qualifies: failedCriteria.length === 0,
    normalized: {
      goalClassification: String(intake.goalClassification || '').trim().toLowerCase(),
      capitalAvailable,
      capitalAcquisitionRequired,
      rawPathwayKey,
      pathwayKey,
      distributionChannel,
      targetCategory,
      spotifyListeners,
      instagramFollowers,
      hasRevenueAllocation,
      warmAudienceProofCount,
      warmAudienceProofSource,
      hasWarmAudienceProof,
      fallbackProofPassed,
    },
    criteria,
    failedCriteria,
  };
}

function qualifiesForAcquisitionEnabledBridgePath(intake: StructuredPlanningIntake) {
  return inspectAcquisitionEnabledBridgePath(intake).qualifies;
}

export function evaluatePrePlanFeasibility(
  intake: StructuredPlanningIntake,
  options: { startDayKey?: string | null } = {}
): PrePlanFeasibilityResult {
  if (intake.goalClassification !== 'regulated_physical_consumable') {
    return {
      status: 'VIABLE',
      explanation: 'No regulated physical consumable constraints apply to this goal classification.',
    };
  }

  const startDayKey = String(options.startDayKey || '').trim() || new Date().toISOString().slice(0, 10);
  const capitalAvailable = Number(intake.capitalAvailable || 0);
  const capitalAcquisitionRequired = intake.capitalAcquisitionRequired === true;
  const rawPathwayStr = String(intake.formulaPathway || '').trim().toLowerCase();
  const isUndecidedPathway = rawPathwayStr === '' || rawPathwayStr === 'undecided';
  const pathwayKey =
    isUndecidedPathway && capitalAvailable === 0 && capitalAcquisitionRequired
      ? 'white_label'
      : rawPathwayStr || 'base_modification';
  const pathwayModifier =
    REGULATED_PHYSICAL_CONSUMABLE_REALISM.pathwayModifiers[
      pathwayKey as keyof typeof REGULATED_PHYSICAL_CONSUMABLE_REALISM.pathwayModifiers
    ] || REGULATED_PHYSICAL_CONSUMABLE_REALISM.pathwayModifiers.base_modification;
  const realisticMinimumBusinessDays = computeRegulatedPhysicalConsumableMinimumBusinessDays(intake);
  const realisticMinimumDate = addBusinessDays(startDayKey, realisticMinimumBusinessDays) || startDayKey;
  const hardDeadline = intake.hardDeadline || null;
  const hasRevenueAllocation = intake.capitalAcquisitionAssets?.existingRevenue?.allocationToPossible === true;

  const gates = REGULATED_PHYSICAL_CONSUMABLE_REALISM.capitalGates;
  if (capitalAvailable < gates[0].minCost && qualifiesForAcquisitionEnabledBridgePath(intake)) {
    return {
      status: 'VIABLE_WITH_CAPITAL_ACQUISITION_REQUIRED',
      explanation:
        'This founder profile qualifies for a bridge-first launch path. The plan can proceed through validation, presale, and capital-closing work on a white-label direct-to-consumer path, but production remains blocked until the MOQ deposit gate is actually funded.',
      recommendedPathway: 'white_label',
      criticalGate: 'moq_production_deposit',
      criticalGateAmount: 8000,
      criticalGateTiming: computeCapitalTiming(startDayKey, 7),
    };
  }

  if (capitalAvailable < gates[0].minCost && capitalAcquisitionRequired && pathwayKey === 'white_label') {
    const { hasWarmAudienceProof } = deriveWarmAudienceProof(intake);
    const hasAcquisitionPath = hasWarmAudienceProof || hasRevenueAllocation;
    if (hasAcquisitionPath) {
      return {
        status: 'VIABLE_WITH_CAPITAL_ACQUISITION_REQUIRED',
        explanation:
          'The selected launch is viable on a white-label pathway, but production remains blocked until external capital is acquired and committed before the MOQ deposit gate.',
        recommendedPathway: 'white_label',
        criticalGate: 'moq_production_deposit',
        criticalGateAmount: 8000,
        criticalGateTiming: computeCapitalTiming(startDayKey, 7),
      };
    }
  }

  if (capitalAvailable < gates[0].minCost) {
    return {
      status: 'CAPITAL_CONSTRAINED',
      constrainedGate: gates[0].gateId,
      estimatedRequirement: gates[0].typicalCost,
      estimatedTiming: computeCapitalTiming(startDayKey, gates[0].estimatedTimingMonthOffset),
      userCapital: capitalAvailable,
      gap: Math.max(0, gates[0].typicalCost - capitalAvailable),
      explanation:
        'Launching a regulated physical consumable requires regulatory review engagement in month 1, and the current capital does not cover that first gate.',
    };
  }

  const earlyGateRequirement =
    gates[0].typicalCost + gates[1].typicalCost + gates[2].typicalCost + pathwayModifier.additionalCapital.min;
  if (capitalAvailable < earlyGateRequirement) {
    return {
      status: 'CAPITAL_CONSTRAINED',
      constrainedGate: 'sample_cycle_costs',
      estimatedRequirement: earlyGateRequirement,
      estimatedTiming: computeCapitalTiming(startDayKey, gates[2].estimatedTimingMonthOffset),
      userCapital: capitalAvailable,
      gap: Math.max(0, earlyGateRequirement - capitalAvailable),
      explanation:
        'Early regulatory, sample-cycle, and packaging gates exceed the stated capital. White-label or lower-MOQ pathways are the realistic alternatives.',
    };
  }

  if (hardDeadline && pathwayKey === 'custom_development') {
    const whiteLabelTimeline = addBusinessDays(
      startDayKey,
      Math.max(
        0,
        computeRegulatedPhysicalConsumableMinimumBusinessDays({
          ...intake,
          formulaPathway: 'white_label',
        })
      )
    );
    if (whiteLabelTimeline && hardDeadline < realisticMinimumDate) {
      return {
        status: 'PATHWAY_MISMATCH',
        selectedPathway: pathwayKey,
        issue: 'timeline_incompatible',
        explanation:
          'Custom formula development adds 12–24 weeks before sample cycles and production. The stated deadline is not compatible with that pathway.',
        suggestedPathway: 'base_modification',
        suggestedPathwayTimelineDelta: '-16 weeks',
      };
    }
  }

  const totalTypicalRequirement =
    gates.reduce((sum, gate) => sum + gate.typicalCost, 0) + pathwayModifier.additionalCapital.min;
  if (capitalAvailable < totalTypicalRequirement) {
    const moqGate = gates.find((gate) => gate.gateId === 'moq_production_deposit') || gates[3];
    return {
      status: 'CAPITAL_CONSTRAINED',
      constrainedGate: moqGate.gateId,
      estimatedRequirement: moqGate.typicalCost,
      estimatedTiming: computeCapitalTiming(startDayKey, moqGate.estimatedTimingMonthOffset),
      userCapital: capitalAvailable,
      gap: Math.max(0, totalTypicalRequirement - capitalAvailable),
      explanation:
        'The typical MOQ production deposit and downstream merchant reserve exceed the stated capital. A lower-MOQ pathway or additional capital is needed before first sale.',
    };
  }

  if (hardDeadline && hardDeadline < realisticMinimumDate) {
    return {
      status: 'VIABLE_WITH_ADJUSTED_TIMELINE',
      statedDeadline: hardDeadline,
      realisticMinimumDate,
      primaryConstraint: pathwayKey === 'custom_development' ? 'custom_formula_pathway' : 'sample_cycle_duration',
      explanation:
        'Manufacturer response, sample cycles, regulatory review, and production lead time create a longer minimum calendar than the stated deadline allows.',
    };
  }

  return {
    status: 'VIABLE',
    explanation: 'The stated pathway, capital, and timeline are consistent with a regulated physical consumable launch.',
  };
}
