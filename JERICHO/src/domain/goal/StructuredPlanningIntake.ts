export type GoalClassification =
  | 'regulated_physical_consumable'
  | 'physical_product'
  | 'digital_product'
  | 'service'
  | 'other';

export type ExecutionContext = 'full_time' | 'part_time';

export type FormulaPathway = 'custom_development' | 'base_modification' | 'white_label';

export type TargetCategory = 'food_product' | 'dietary_supplement' | 'functional_food';

export type DistributionChannel = 'direct_to_consumer' | 'marketplace' | 'retail' | 'wholesale';
export type CapitalCommitmentConfidence = 'confirmed' | 'probable' | 'uncertain';
export type BlackoutPeriod = { start: string; end: string };
export type WeeklyWorkWindows = Record<string, Array<{ start: string; end: string }>>;

export type LegalFoundation = {
  existingEntity: boolean;
  existingEntityType: string | null;
  existingEntityState: string | null;
  existingEntityPurpose: string | null;
  gumEntityExists: boolean;
};

export type ExistingAudience = {
  spotifyListeners: number | null;
  instagramFollowers: number | null;
  audienceRelationship: string | null;
  influencerNetwork: boolean;
  entrepreneurNetwork: boolean;
};

export type CapitalAcquisitionAssets = {
  existingAudience: ExistingAudience | null;
  existingRevenue: Record<string, boolean> | null;
};

export type StructuredPlanningIntake = {
  goalClassification: GoalClassification | null;
  startDayKey: string | null;
  executionContext: ExecutionContext | null;
  weeklyHoursAvailable: number | null;
  workWindows: WeeklyWorkWindows | null;
  capitalAvailable: number | null;
  capitalCommitmentConfidence: CapitalCommitmentConfidence | null;
  hardDeadline: string | null;
  existingDomainRelationships: string[];
  blackoutPeriods: BlackoutPeriod[];
  stopCondition: number | null;
  formulaPathway: FormulaPathway | null;
  targetCategory: TargetCategory | null;
  distributionChannel: DistributionChannel | null;
  // Extended fields for intake personalization
  goalDescription?: string | null;
  legalFoundation?: LegalFoundation | null;
  capitalAcquisitionRequired?: boolean;
  capitalAcquisitionAssets?: CapitalAcquisitionAssets | null;
  employmentStatus?: string | null;
  employmentChangeRisk?: boolean;
  recommendedTimeline?: string | null;
  formulaDirection?: Record<string, unknown> | null;
  timelineSensitivity?: string | null;
  industryExperience?: string | null;
  location?: Record<string, unknown> | null;
  personalProfile?: Record<string, unknown> | null;
};

export type StructuredPlanningIntakeBuildResult = {
  intake: StructuredPlanningIntake;
  missingRequiredFields: string[];
  inferredFields: string[];
};

type BuildStructuredPlanningIntakeInput = {
  rawGoalText?: string | null;
  executionType?: string | null;
  contract?: Record<string, any> | null;
  goalDraftV2?: Record<string, any> | null;
  answeredContext?: Record<string, unknown> | null;
};

const GOAL_CLASSIFICATIONS: GoalClassification[] = [
  'regulated_physical_consumable',
  'physical_product',
  'digital_product',
  'service',
  'other',
];

const EXECUTION_CONTEXTS: ExecutionContext[] = ['full_time', 'part_time'];
const FORMULA_PATHWAYS: FormulaPathway[] = ['custom_development', 'base_modification', 'white_label'];
const TARGET_CATEGORIES: TargetCategory[] = ['food_product', 'dietary_supplement', 'functional_food'];
const DISTRIBUTION_CHANNELS: DistributionChannel[] = ['direct_to_consumer', 'marketplace', 'retail', 'wholesale'];
const CAPITAL_COMMITMENT_CONFIDENCES: CapitalCommitmentConfidence[] = ['confirmed', 'probable', 'uncertain'];

function normalizeText(value: unknown) {
  return String(value || '').trim();
}

function normalizeEnum<T extends string>(value: unknown, allowed: T[]): T | null {
  const normalized = normalizeText(value).toLowerCase();
  if (!normalized) {
    return null;
  }
  return allowed.find((item) => item === normalized) || null;
}

function normalizeNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  const normalized = Number(String(value || '').replace(/[^0-9.-]/g, ''));
  return Number.isFinite(normalized) ? normalized : null;
}

function normalizeDate(value: unknown): string | null {
  const text = normalizeText(value);
  if (!text) {
    return null;
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    return text;
  }
  return text.slice(0, 10) || null;
}

function normalizeRelationships(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((item) => normalizeText(item)).filter(Boolean);
  }
  const text = normalizeText(value);
  if (!text) {
    return [];
  }
  return text
    .split(',')
    .map((item) => normalizeText(item))
    .filter(Boolean);
}

function normalizeBlackoutPeriods(value: unknown): BlackoutPeriod[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .map((item) => {
      const record = (item || {}) as Record<string, unknown>;
      const start = normalizeDate(record?.start);
      const end = normalizeDate(record?.end);
      if (!start || !end) {
        return null;
      }
      return { start, end };
    })
    .filter((period): period is BlackoutPeriod => Boolean(period));
}

function normalizeWorkWindows(value: unknown): WeeklyWorkWindows | null {
  if (!value || typeof value !== 'object') {
    return null;
  }
  const days = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
  return days.reduce(
    (acc, day) => {
      const rows = Array.isArray((value as Record<string, unknown>)?.[day]) ? (value as Record<string, unknown>)[day] : [];
      acc[day] = (rows as Array<Record<string, unknown>>)
        .map((row) => {
          const start = normalizeText(row?.start || row?.startHHMM);
          const end = normalizeText(row?.end || row?.endHHMM);
          if (!start || !end) {
            return null;
          }
          return { start, end };
        })
        .filter((row): row is { start: string; end: string } => Boolean(row));
      return acc;
    },
    {} as WeeklyWorkWindows
  );
}

function inferGoalClassification(rawText: string, executionType: string): GoalClassification {
  const combined = `${rawText} ${executionType}`.toLowerCase();
  if (
    /\b(caffeinated gum|gum|edible|ingestible|food product|functional food|dietary supplement|supplement|beverage|food label|claims|merchant underwriting)\b/.test(
      combined
    )
  ) {
    return 'regulated_physical_consumable';
  }
  if (/\b(service|consulting|agency|client|discovery call|close first client)\b/.test(combined)) {
    return 'service';
  }
  if (/\b(app|software|saas|website|api|platform|digital|course|ebook)\b/.test(combined)) {
    return 'digital_product';
  }
  if (/\b(product|packaging|inventory|manufacturer|retail|wholesale|physical)\b/.test(combined)) {
    return 'physical_product';
  }
  return 'other';
}

function inferTargetCategory(rawText: string): TargetCategory | null {
  const lower = rawText.toLowerCase();
  if (/\b(dietary supplement|supplement)\b/.test(lower)) {
    return 'dietary_supplement';
  }
  if (/\b(functional food|energy food)\b/.test(lower)) {
    return 'functional_food';
  }
  if (/\b(food|gum|beverage|snack|consumable)\b/.test(lower)) {
    return 'food_product';
  }
  return null;
}

function inferDistributionChannel(rawText: string): DistributionChannel | null {
  const lower = rawText.toLowerCase();
  if (/\bamazon|marketplace\b/.test(lower)) {
    return 'marketplace';
  }
  if (/\bretail|shelf\b/.test(lower)) {
    return 'retail';
  }
  if (/\bwholesale|distributor\b/.test(lower)) {
    return 'wholesale';
  }
  if (/\bdirect[-\s]?to[-\s]?consumer|dtc|website|checkout\b/.test(lower)) {
    return 'direct_to_consumer';
  }
  return null;
}

function inferFormulaPathway(rawText: string): FormulaPathway | null {
  const lower = rawText.toLowerCase();
  if (/\bwhite[-\s]?label\b/.test(lower)) {
    return 'white_label';
  }
  if (/\bcustom\b|\bnovel formulation\b|\bformulation consultant\b/.test(lower)) {
    return 'custom_development';
  }
  if (/\bbase formula\b|\bmodify\b|\bmanufacturer base\b/.test(lower)) {
    return 'base_modification';
  }
  return null;
}

function inferWeeklyHoursAvailable(contract: Record<string, any> | null, answeredContext: Record<string, unknown> | null) {
  const explicit = normalizeNumber(answeredContext?.weeklyHoursAvailable);
  if (explicit !== null) {
    return explicit;
  }
  const windows = contract?.workWindows || {};
  const totalHours = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'].reduce((sum, day) => {
    const rows = Array.isArray(windows?.[day]) ? windows[day] : [];
    const dayHours = rows.reduce((daySum: number, row: Record<string, unknown>) => {
      const start = normalizeText(row?.start || row?.startHHMM);
      const end = normalizeText(row?.end || row?.endHHMM);
      const startMatch = /^(\d{2}):(\d{2})$/.exec(start);
      const endMatch = /^(\d{2}):(\d{2})$/.exec(end);
      if (!startMatch || !endMatch) {
        return daySum;
      }
      const startMinutes = Number(startMatch[1]) * 60 + Number(startMatch[2]);
      const endMinutes = Number(endMatch[1]) * 60 + Number(endMatch[2]);
      if (!Number.isFinite(startMinutes) || !Number.isFinite(endMinutes) || endMinutes <= startMinutes) {
        return daySum;
      }
      return daySum + (endMinutes - startMinutes) / 60;
    }, 0);
    return sum + dayHours;
  }, 0);
  return totalHours > 0 ? Math.round(totalHours) : null;
}

export function buildStructuredPlanningIntake(
  input: BuildStructuredPlanningIntakeInput = {}
): StructuredPlanningIntakeBuildResult {
  const contract = (input.contract || {}) as Record<string, any>;
  const goalDraftV2 = (input.goalDraftV2 || {}) as Record<string, any>;
  const answeredContext = (input.answeredContext || {}) as Record<string, unknown>;
  const contractIntake = (contract?.planningIntake || contract?.goalIntakeContract?.planningIntake || {}) as Record<
    string,
    unknown
  >;
  const rawGoalText =
    normalizeText(input.rawGoalText) ||
    normalizeText(goalDraftV2?.goalText) ||
    normalizeText(goalDraftV2?.goalLabel) ||
    normalizeText(contract?.goalText) ||
    normalizeText(contract?.goalLabel) ||
    normalizeText(contract?.terminalOutcome?.text);
  const executionType =
    normalizeText(input.executionType) || normalizeText(contract?.executionType) || normalizeText(goalDraftV2?.executionType);

  const inferredFields: string[] = [];

  const goalClassification =
    normalizeEnum(answeredContext.goalClassification, GOAL_CLASSIFICATIONS) ||
    normalizeEnum(contractIntake.goalClassification, GOAL_CLASSIFICATIONS) ||
    (() => {
      const inferred = inferGoalClassification(rawGoalText, executionType);
      inferredFields.push('goalClassification');
      return inferred;
    })();

  const weeklyHoursAvailable =
    normalizeNumber(answeredContext.weeklyHoursAvailable) ??
    normalizeNumber(contractIntake.weeklyHoursAvailable) ??
    (() => {
      const inferred = inferWeeklyHoursAvailable(contract, answeredContext);
      if (inferred !== null) {
        inferredFields.push('weeklyHoursAvailable');
      }
      return inferred;
    })() ??
    15;

  if (!normalizeNumber(answeredContext.weeklyHoursAvailable) && !normalizeNumber(contractIntake.weeklyHoursAvailable)) {
    inferredFields.push('weeklyHoursAvailable');
  }

  const executionContext =
    normalizeEnum(answeredContext.executionContext, EXECUTION_CONTEXTS) ||
    normalizeEnum(contractIntake.executionContext, EXECUTION_CONTEXTS) ||
    (() => {
      inferredFields.push('executionContext');
      return weeklyHoursAvailable >= 30 ? 'full_time' : 'part_time';
    })();

  const capitalAvailable =
    normalizeNumber(answeredContext.capitalAvailable) ??
    normalizeNumber(contractIntake.capitalAvailable) ??
    (() => {
      if (goalClassification === 'regulated_physical_consumable') {
        inferredFields.push('capitalAvailable');
        return 30000;
      }
      return 0;
    })();
  const capitalCommitmentConfidence =
    normalizeEnum(answeredContext.capitalCommitmentConfidence, CAPITAL_COMMITMENT_CONFIDENCES) ||
    normalizeEnum(contractIntake.capitalCommitmentConfidence, CAPITAL_COMMITMENT_CONFIDENCES) ||
    null;

  const hardDeadline =
    normalizeDate(answeredContext.hardDeadline) ||
    normalizeDate(contractIntake.hardDeadline) ||
    normalizeDate(contract?.deadline?.dayKey) ||
    normalizeDate(contract?.endDayKey) ||
    normalizeDate(contract?.deadlineISO) ||
    null;
  const startDayKey =
    normalizeDate(answeredContext.startDayKey) ||
    normalizeDate(contractIntake.startDayKey) ||
    normalizeDate(contract?.startDayKey) ||
    normalizeDate(contract?.startDateISO) ||
    null;

  const relationships = normalizeRelationships(
    answeredContext.existingDomainRelationships ?? contractIntake.existingDomainRelationships
  );
  const blackoutPeriods = normalizeBlackoutPeriods(
    answeredContext.blackoutPeriods ?? contractIntake.blackoutPeriods
  );
  const workWindows = normalizeWorkWindows(answeredContext.workWindows ?? contractIntake.workWindows ?? contract?.workWindows);
  const stopCondition =
    normalizeNumber(answeredContext.stopCondition) ?? normalizeNumber(contractIntake.stopCondition) ?? null;

  const capitalAcquisitionRequired =
    answeredContext.capitalAcquisitionRequired === true || contractIntake.capitalAcquisitionRequired === true;

  const formulaPathway =
    normalizeEnum(answeredContext.formulaPathway, FORMULA_PATHWAYS) ||
    normalizeEnum(contractIntake.formulaPathway, FORMULA_PATHWAYS) ||
    (goalClassification === 'regulated_physical_consumable'
      ? (() => {
          inferredFields.push('formulaPathway');
          // Zero capital or acquisition required → white_label is the only feasible first path
          if (capitalAvailable === 0 || capitalAcquisitionRequired) {
            return 'white_label' as const;
          }
          return inferFormulaPathway(rawGoalText) || 'base_modification';
        })()
      : null);

  const targetCategory =
    normalizeEnum(answeredContext.targetCategory, TARGET_CATEGORIES) ||
    normalizeEnum(contractIntake.targetCategory, TARGET_CATEGORIES) ||
    (goalClassification === 'regulated_physical_consumable'
      ? (() => {
          const inferred = inferTargetCategory(rawGoalText);
          if (inferred) {
            inferredFields.push('targetCategory');
          }
          return inferred;
        })()
      : null);

  const distributionChannel =
    normalizeEnum(answeredContext.distributionChannel, DISTRIBUTION_CHANNELS) ||
    normalizeEnum(contractIntake.distributionChannel, DISTRIBUTION_CHANNELS) ||
    (goalClassification === 'regulated_physical_consumable'
      ? (() => {
          inferredFields.push('distributionChannel');
          return inferDistributionChannel(rawGoalText) || 'direct_to_consumer';
        })()
      : null);

  // Pass through extended personalization fields without normalization — they are rich objects
  // that the feasibility and mock-generator layers read directly.
  const legalFoundation = (answeredContext.legalFoundation ?? contractIntake.legalFoundation ?? null) as LegalFoundation | null;
  const capitalAcquisitionAssets = (answeredContext.capitalAcquisitionAssets ?? contractIntake.capitalAcquisitionAssets ?? null) as CapitalAcquisitionAssets | null;
  const employmentStatus = normalizeText(answeredContext.employmentStatus ?? contractIntake.employmentStatus) || null;
  const employmentChangeRisk = answeredContext.employmentChangeRisk === true || contractIntake.employmentChangeRisk === true;
  const recommendedTimeline = normalizeText(answeredContext.recommendedTimeline ?? contractIntake.recommendedTimeline) || null;
  const goalDescription = normalizeText(answeredContext.goalDescription ?? contractIntake.goalDescription) || null;
  const formulaDirection = (answeredContext.formulaDirection ?? contractIntake.formulaDirection ?? null) as
    | Record<string, unknown>
    | null;
  const timelineSensitivity = normalizeText(
    answeredContext.timelineSensitivity ?? contractIntake.timelineSensitivity
  ) || null;
  const industryExperience = normalizeText(answeredContext.industryExperience ?? contractIntake.industryExperience) || null;
  const location = (answeredContext.location ?? contractIntake.location ?? null) as Record<string, unknown> | null;
  const personalProfile = (answeredContext.personalProfile ?? contractIntake.personalProfile ?? null) as
    | Record<string, unknown>
    | null;

  const intake: StructuredPlanningIntake = {
    goalClassification,
    startDayKey,
    executionContext,
    weeklyHoursAvailable,
    workWindows,
    capitalAvailable,
    capitalCommitmentConfidence,
    hardDeadline,
    existingDomainRelationships: relationships,
    blackoutPeriods,
    stopCondition,
    formulaPathway,
    targetCategory,
    distributionChannel,
    goalDescription,
    legalFoundation,
    capitalAcquisitionRequired,
    capitalAcquisitionAssets,
    employmentStatus,
    employmentChangeRisk,
    recommendedTimeline,
    formulaDirection,
    timelineSensitivity,
    industryExperience,
    location,
    personalProfile,
  };

  const missingRequiredFields = [
    intake.goalClassification ? null : 'goalClassification',
    intake.startDayKey ? null : 'startDayKey',
    intake.executionContext ? null : 'executionContext',
    intake.weeklyHoursAvailable !== null ? null : 'weeklyHoursAvailable',
    intake.capitalAvailable !== null ? null : 'capitalAvailable',
    Array.isArray(intake.existingDomainRelationships) ? null : 'existingDomainRelationships',
    goalClassification === 'regulated_physical_consumable' && !intake.formulaPathway ? 'formulaPathway' : null,
    goalClassification === 'regulated_physical_consumable' && !intake.targetCategory ? 'targetCategory' : null,
    goalClassification === 'regulated_physical_consumable' && !intake.distributionChannel ? 'distributionChannel' : null,
  ].filter(Boolean) as string[];

  return {
    intake,
    missingRequiredFields,
    inferredFields: Array.from(new Set(inferredFields)),
  };
}
