export type DurationRangeBusinessDays = {
  min: number;
  typical: number;
  max: number;
};

export type CapitalGateCheckpoint = {
  gateId:
    | 'regulatory_consultant'
    | 'sample_cycle_costs'
    | 'packaging_design_and_production'
    | 'moq_production_deposit'
    | 'merchant_account_reserve';
  label: string;
  minCost: number;
  typicalCost: number;
  maxCost: number;
  estimatedTimingMonthOffset: number;
};

export type RegulatedWorkFamilyConfig = {
  familyId:
    | 'REGULATORY_AND_LABEL_REVIEW'
    | 'MERCHANT_ACCOUNT_UNDERWRITING'
    | 'CAPITAL_GATE_CHECKPOINTS'
    | 'HERO_IMAGERY_PRODUCTION'
    | 'PARALLEL_PACKAGING_TRACK';
  required: true;
  tasks: string[];
  dependencyType: 'hard_gate' | 'directional' | 'informational';
  earliestStart?: string;
  minimumLeadTimeBusinessDays?: number;
  note?: string;
};

export type PathwayModifier = {
  additionalWeeks: { min: number; max: number };
  additionalCapital: { min: number; max: number };
  requiresFormulationConsultant: boolean;
};

export const REGULATED_PHYSICAL_CONSUMABLE_REALISM = {
  durations: {
    manufacturerInitialResponse: { min: 15, typical: 20, max: 30 },
    sampleCyclePerIteration: { min: 20, typical: 25, max: 35 },
    regulatoryReviewEngagement: { min: 10, typical: 20, max: 45 },
    packagingProductionLeadTime: { min: 40, typical: 60, max: 70 },
    merchantAccountUnderwriting: { min: 30, typical: 40, max: 60 },
    productionRunLeadTime: { min: 40, typical: 55, max: 70 },
  } as const,
  workFamilies: [
    {
      familyId: 'REGULATORY_AND_LABEL_REVIEW',
      required: true,
      tasks: [
        'Engage regulatory/label review consultant',
        'Submit formula and intended claims for compliance review',
        'Receive and review consultant compliance report',
        'Revise claims and label copy against consultant recommendations',
        'Lock compliance-safe claims with consultant sign-off',
      ],
      dependencyType: 'hard_gate',
      earliestStart: 'concurrent_with_early_dosage_assumption_work',
    },
    {
      familyId: 'MERCHANT_ACCOUNT_UNDERWRITING',
      required: true,
      tasks: [
        'Research high-risk merchant processing options for food and supplement categories',
        'Prepare merchant account application materials and product documentation',
        'Submit merchant account application',
        'Respond to underwriter requests for additional information',
        'Confirm merchant account approval',
      ],
      dependencyType: 'hard_gate',
      minimumLeadTimeBusinessDays: 60,
      note: 'Requires a built but hidden website for review.',
    },
    {
      familyId: 'CAPITAL_GATE_CHECKPOINTS',
      required: true,
      tasks: [
        'Capital checkpoint 1 - Regulatory consultant engagement',
        'Capital checkpoint 2 - Sample cycle costs',
        'Capital checkpoint 3 - Packaging production',
        'Capital checkpoint 4 - MOQ production deposit',
      ],
      dependencyType: 'hard_gate',
      note: 'These surface as feasibility checkpoints, not work sessions.',
    },
    {
      familyId: 'HERO_IMAGERY_PRODUCTION',
      required: true,
      tasks: [
        'Define visual direction and reference examples for product imagery',
        'Commission product photography or 3D rendering',
        'Review and approve final hero imagery',
        'Integrate approved imagery into product page and outreach assets',
      ],
      dependencyType: 'hard_gate',
      note: 'Physical food products require visual proof before conversion.',
    },
    {
      familyId: 'PARALLEL_PACKAGING_TRACK',
      required: true,
      tasks: [
        'Research packaging suppliers and format options',
        'Request packaging quote and dieline requirements from supplier A',
        'Request packaging quote and dieline requirements from supplier B',
        'Compare packaging costs, lead times, minimums, and print constraints',
      ],
      dependencyType: 'directional',
      note: 'Packaging work is directional on formula direction, not hard-gated on formula lock.',
    },
  ] as const satisfies readonly RegulatedWorkFamilyConfig[],
  pathwayModifiers: {
    custom_development: {
      additionalWeeks: { min: 12, max: 24 },
      additionalCapital: { min: 5000, max: 20000 },
      requiresFormulationConsultant: true,
    },
    base_modification: {
      additionalWeeks: { min: 4, max: 8 },
      additionalCapital: { min: 1000, max: 5000 },
      requiresFormulationConsultant: false,
    },
    white_label: {
      additionalWeeks: { min: 0, max: 2 },
      additionalCapital: { min: 0, max: 1000 },
      requiresFormulationConsultant: false,
    },
  } as const satisfies Record<string, PathwayModifier>,
  capitalGates: [
    {
      gateId: 'regulatory_consultant',
      label: 'Regulatory consultant',
      minCost: 2000,
      typicalCost: 5000,
      maxCost: 8000,
      estimatedTimingMonthOffset: 1,
    },
    {
      gateId: 'sample_cycle_costs',
      label: 'Sample cycle costs',
      minCost: 1000,
      typicalCost: 2500,
      maxCost: 6000,
      estimatedTimingMonthOffset: 2,
    },
    {
      gateId: 'packaging_design_and_production',
      label: 'Packaging design and production',
      minCost: 3000,
      typicalCost: 5500,
      maxCost: 8000,
      estimatedTimingMonthOffset: 4,
    },
    {
      gateId: 'moq_production_deposit',
      label: 'MOQ production deposit',
      minCost: 8000,
      typicalCost: 15000,
      maxCost: 25000,
      estimatedTimingMonthOffset: 5,
    },
    {
      gateId: 'merchant_account_reserve',
      label: 'Merchant account reserve',
      minCost: 1000,
      typicalCost: 2000,
      maxCost: 5000,
      estimatedTimingMonthOffset: 5,
    },
  ] as const satisfies readonly CapitalGateCheckpoint[],
  totalEstimatedCapitalRange: { min: 20000, max: 60000 },
} as const;
