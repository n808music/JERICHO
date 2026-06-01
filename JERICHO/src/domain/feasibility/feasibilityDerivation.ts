import type { IntakeFeasibilityReport } from '../goal/prePlanFeasibility';
import { REGULATED_PHYSICAL_CONSUMABLE_REALISM } from '../goal/regulatedPhysicalConsumableRealism';
import type { StructuredPlanningIntake } from '../goal/StructuredPlanningIntake';

export type RiskRating = 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL';
export type FeasibilityStatus =
  | 'VIABLE_AND_STRAIGHTFORWARD'
  | 'VIABLE_WITH_IDENTIFIED_RISKS'
  | 'VIABLE_WITH_CAPITAL_ACQUISITION_REQUIRED'
  | 'VIABLE_BUT_FRAGILE'
  | 'NOT_VIABLE_AS_STATED';

export type DimensionAssessment = {
  dimension: 'capital' | 'timeline' | 'execution' | 'domain' | 'market';
  rating: RiskRating;
  explanation: string;
  mitigations: string[];
  gateAtRisk?: string;
  gateTimeline?: string;
  earlyWarningSignal?: string;
  primaryRisk?: string;
  velocityWindow?: string;
  revisionTrigger?: string;
};

export type FeasibilityRisk = {
  rank: number;
  risk: string;
  probability: 'LOW' | 'LOW_TO_MODERATE' | 'MODERATE' | 'MODERATE_TO_HIGH' | 'HIGH';
  consequence: string;
  earlyWarningSignal: string;
  mitigation: string;
  sourceDimension: DimensionAssessment['dimension'];
};

export type DerivedFromTrace = {
  claim: string;
  sourceType: 'intake_field' | 'plan_element' | 'domain_realism_config' | 'derivation_logic';
  sourceId: string;
  value: unknown;
};

export type FeasibilityAssessment = {
  overallStatus: FeasibilityStatus;
  dimensions: Record<DimensionAssessment['dimension'], DimensionAssessment>;
  topRisks: FeasibilityRisk[];
  confidenceStatement: string;
  derivedFrom: DerivedFromTrace[];
};

export type FeasibilityPlanBlock = {
  id?: string | null;
  title?: string | null;
  actionId?: string | null;
  startISO?: string | null;
  endISO?: string | null;
  dayKey?: string | null;
  blockType?: string | null;
  minimumDurationBusinessDays?: number | null;
  capitalGateId?: string | null;
  requiredWorkFamily?: string | null;
  transitiveDependencyDetails?: Array<{ actionId: string; dependencyType: 'hard_gate' | 'directional' | 'informational' }>;
};

export type FeasibilityPlanAction = {
  id?: string | null;
  title?: string | null;
  pathwayTag?: string | null;
  capitalGateId?: string | null;
  requiredWorkFamily?: string | null;
};

export type FeasibilityPlan = {
  actions: FeasibilityPlanAction[];
  scheduledBlocks: FeasibilityPlanBlock[];
  summary?: {
    planStatus?: string | null;
    horizonDayCount?: number | null;
    scheduledBlockCount?: number | null;
  } | null;
  startDayKey?: string | null;
  deadlineDayKey?: string | null;
  prePlanFeasibility?: IntakeFeasibilityReport | null;
  capitalAcquisitionFeasibility?: IntakeFeasibilityReport | null;
};

const PRESALE_CONVERSION_LOW_THRESHOLD = 0.005;
const PRESALE_CONVERSION_MODERATE_THRESHOLD = 0.015;
const MARKET_ENGAGEMENT_REVISION_THRESHOLD = 0.3;
const BUFFER_LOW_RISK_DAYS = 42;
const BUFFER_MODERATE_RISK_DAYS = 21;
const COLD_OUTREACH_RESPONSE_RATE = 0.25;
const WARM_RELATIONSHIP_RESPONSE_RATE = 0.6;
const EMPLOYMENT_CHANGE_SCENARIO_SESSIONS_PER_WEEK = 8;

function riskToNumber(rating: RiskRating) {
  if (rating === 'LOW') return 1;
  if (rating === 'MODERATE') return 2;
  if (rating === 'HIGH') return 3;
  return 4;
}

function numberToRisk(value: number): RiskRating {
  if (value <= 1) return 'LOW';
  if (value === 2) return 'MODERATE';
  if (value === 3) return 'HIGH';
  return 'CRITICAL';
}

function stepRisk(rating: RiskRating, delta: number) {
  return numberToRisk(Math.max(1, Math.min(4, riskToNumber(rating) + delta)));
}

function probabilityLabelForRating(rating: RiskRating): FeasibilityRisk['probability'] {
  if (rating === 'LOW') return 'LOW_TO_MODERATE';
  if (rating === 'MODERATE') return 'MODERATE';
  if (rating === 'HIGH') return 'MODERATE_TO_HIGH';
  return 'HIGH';
}

function consequenceSeverity(consequence: string) {
  const normalized = String(consequence || '').toLowerCase();
  if (normalized.includes('terminates')) return 4;
  if (normalized.includes('requires plan restructuring')) return 3;
  if (normalized.includes('delays timeline significantly')) return 2;
  return 1;
}

function toDate(value: unknown) {
  const date = new Date(String(value || ''));
  return Number.isNaN(date.getTime()) ? null : date;
}

function dayKey(value: unknown) {
  return String(value || '').trim().slice(0, 10);
}

function diffDays(start: string | null | undefined, end: string | null | undefined) {
  const startDate = toDate(start);
  const endDate = toDate(end);
  if (!startDate || !endDate) return 0;
  return Math.max(0, Math.round((endDate.getTime() - startDate.getTime()) / 86400000));
}

function formatMoney(value: number) {
  return `$${Math.round(value).toLocaleString()}`;
}

function formatPercent(value: number) {
  return `${(value * 100).toFixed(2)}%`;
}

function getAudienceSize(intake: StructuredPlanningIntake) {
  const audience = intake.capitalAcquisitionAssets?.existingAudience;
  return Number(audience?.spotifyListeners || 0) + Number(audience?.instagramFollowers || 0);
}

function getCurrentPace(intake: StructuredPlanningIntake) {
  const weeklyHours = Math.max(1, Number(intake.weeklyHoursAvailable || 0));
  const multiplier = intake.executionContext === 'part_time' ? 0.8 : 1;
  return Math.max(1, Math.floor(weeklyHours * multiplier));
}

function isExecutionBlock(block: FeasibilityPlanBlock) {
  return String(block?.blockType || 'execution') === 'execution';
}

function detectFirstActionTitle(plan: FeasibilityPlan, pattern: RegExp) {
  const action = plan.actions.find((entry) => pattern.test(String(entry?.title || '')));
  return String(action?.title || '').trim() || null;
}

function buildCapitalDimension(
  plan: FeasibilityPlan,
  intake: StructuredPlanningIntake,
  traces: DerivedFromTrace[]
): DimensionAssessment {
  const capitalReport = plan.capitalAcquisitionFeasibility || plan.prePlanFeasibility || null;
  const totalRequired = Number(capitalReport?.totalCapitalRequired?.criticalGateAmount || 0);
  const capitalAvailable = Number(intake.capitalAvailable || 0);
  const spotifyListeners = Number(intake.capitalAcquisitionAssets?.existingAudience?.spotifyListeners || 0);
  const presaleMath = capitalReport?.capitalAcquisitionPath?.presaleMath;
  const conversionRate = Number(presaleMath?.audienceConversionRequired || 0);
  let rating: RiskRating = 'LOW';
  const existingRevenueSupport =
    intake.capitalAcquisitionAssets?.existingRevenue?.projectManagementCompany === true &&
    intake.capitalAcquisitionAssets?.existingRevenue?.allocationToPossible === true;
  const unprovenAudienceFit =
    String(intake.capitalAcquisitionAssets?.existingAudience?.audienceRelationship || '').toLowerCase() === 'music_career';
  const moqBlock = plan.scheduledBlocks.find((block) => String(block?.capitalGateId || '') === 'moq_production_deposit');

  if (capitalAvailable >= Number(capitalReport?.totalCapitalRequired?.max || 0)) {
    rating = 'LOW';
  } else if (intake.capitalAcquisitionRequired && presaleMath) {
    if (conversionRate < PRESALE_CONVERSION_LOW_THRESHOLD) {
      rating = 'LOW';
    } else if (conversionRate < PRESALE_CONVERSION_MODERATE_THRESHOLD) {
      rating = 'MODERATE';
    } else {
      rating = 'HIGH';
    }
    if (unprovenAudienceFit) {
      rating = stepRisk(rating, 1);
    }
    if (existingRevenueSupport) {
      rating = stepRisk(rating, -1);
    }
  } else if (capitalAvailable < totalRequired) {
    rating = 'HIGH';
  }

  if (intake.capitalCommitmentConfidence === 'uncertain' && riskToNumber(rating) < 2) {
    rating = 'MODERATE';
  }

  const explanation =
    presaleMath && spotifyListeners > 0
      ? `Your MOQ deposit target is ${formatMoney(presaleMath.target)}, which means ${presaleMath.unitsRequired} buyers from ${spotifyListeners.toLocaleString()} Spotify listeners, or ${formatPercent(
          conversionRate
        )} conversion. That is achievable from a warm audience, but this audience knows you through music rather than functional food, so the conversion assumption is real work rather than free demand.`
      : `Your stated capital of ${formatMoney(capitalAvailable)} is below the modeled capital gates, so one or more downstream commitments depend on outside capital or scope reduction.`;

  const mitigations = [
    'Front-load the Founder Journey content series before the presale ask so your audience sees repeated product-building proof, not a single announcement.',
    'Use project-management revenue to cover entity, sample, and label-review costs so the presale only has to close the MOQ deposit gap.',
  ];
  if (typeof intake.stopCondition === 'number' && Number.isFinite(intake.stopCondition)) {
    const breachedGate = REGULATED_PHYSICAL_CONSUMABLE_REALISM.capitalGates.find(
      (gate) => gate.typicalCost > intake.stopCondition
    );
    if (breachedGate) {
      mitigations.push(
        `Your stop condition of ${formatMoney(intake.stopCondition)} is below the ${breachedGate.label} estimate of ${formatMoney(
          breachedGate.typicalCost
        )}; decide now whether that gate is a stop, raise, or pathway-change moment.`
      );
    }
  }

  traces.push({
    claim: `capital conversion rate for MOQ gate is ${conversionRate}`,
    sourceType: 'derivation_logic',
    sourceId: 'capital.conversionRate',
    value: conversionRate,
  });
  traces.push({
    claim: `capital gate at risk is ${capitalReport?.totalCapitalRequired?.criticalGate || 'moq_deposit'}`,
    sourceType: 'plan_element',
    sourceId: 'capital.gateTimeline',
    value: moqBlock?.startISO || capitalReport?.totalCapitalRequired?.criticalGateTiming || null,
  });

  return {
    dimension: 'capital',
    rating,
    explanation,
    mitigations,
    gateAtRisk: capitalReport?.totalCapitalRequired?.criticalGate || 'moq_deposit',
    gateTimeline: dayKey(moqBlock?.startISO || capitalReport?.totalCapitalRequired?.criticalGateTiming || ''),
    earlyWarningSignal:
      'If Founder Journey posts and product-build updates do not hold at least 30% of your normal music-post engagement before the presale ask, revise the offer before treating the $8,000 target as real.',
  };
}

function buildTimelineDimension(
  plan: FeasibilityPlan,
  intake: StructuredPlanningIntake,
  traces: DerivedFromTrace[]
): DimensionAssessment {
  const executionBlocks = plan.scheduledBlocks.filter(isExecutionBlock);
  const durationBlocks = plan.scheduledBlocks.filter((block) => Number(block?.minimumDurationBusinessDays || 0) > 0);
  const durationMinDays = durationBlocks.reduce(
    (sum, block) => sum + Math.max(0, Number(block?.minimumDurationBusinessDays || 0)),
    0
  );
  const sessionCount = executionBlocks.length;
  const currentPace = getCurrentPace(intake);
  const sessionWorkDays = Math.ceil(sessionCount / Math.max(1, currentPace)) * 7;
  const criticalPathDays = durationMinDays + sessionWorkDays;
  const horizonDayCount =
    Number(plan.summary?.horizonDayCount || 0) ||
    diffDays(
      plan.startDayKey ? `${plan.startDayKey}T12:00:00.000Z` : executionBlocks[0]?.startISO || null,
      plan.deadlineDayKey ? `${plan.deadlineDayKey}T12:00:00.000Z` : executionBlocks.at(-1)?.endISO || null
    );
  const buffer = horizonDayCount - criticalPathDays;
  let rating: RiskRating = 'LOW';
  if (buffer < 0) {
    rating = 'CRITICAL';
  } else if (buffer < BUFFER_MODERATE_RISK_DAYS) {
    rating = 'HIGH';
  } else if (buffer < BUFFER_LOW_RISK_DAYS) {
    rating = 'MODERATE';
  }

  const productionVariance = REGULATED_PHYSICAL_CONSUMABLE_REALISM.durations.productionRunLeadTime;
  const latestExecutionBlock = executionBlocks.at(-1);
  if (intake.hardDeadline) {
    const hardDeadlineISO = `${intake.hardDeadline}T23:59:59.000Z`;
    if (latestExecutionBlock?.endISO && Date.parse(String(latestExecutionBlock.endISO)) > Date.parse(hardDeadlineISO)) {
      rating = 'CRITICAL';
    }
  }

  traces.push({
    claim: `timeline buffer is ${buffer} days`,
    sourceType: 'derivation_logic',
    sourceId: 'timeline.bufferDays',
    value: buffer,
  });
  traces.push({
    claim: 'timeline production queue variance comes from production run lead time',
    sourceType: 'domain_realism_config',
    sourceId: 'timeline.productionRunLeadTime',
    value: productionVariance,
  });

  return {
    dimension: 'timeline',
    rating,
    explanation: `The modeled horizon leaves ${Math.max(0, buffer)} buffer days after accounting for ${durationMinDays} minimum wait-time days and ${sessionCount} execution sessions at your current pace. The highest-variance element is the manufacturing queue, where the modeled production run ranges from ${productionVariance.min} to ${productionVariance.max} business days.`,
    mitigations: [
      'Ask every manufacturer candidate for current queue depth, rush options, and recent deposit-to-delivery timing before selecting a supplier.',
      'Treat any queue slippage in the production block as a reason to protect launch messaging and preserve packaging/merchant slack rather than compressing downstream quality gates.',
    ],
    primaryRisk: 'production.queue.depth during manufacturer selection',
    earlyWarningSignal: 'Ask the queue-depth question during manufacturer selection and treat vague answers as a schedule risk, not a neutral response.',
  };
}

function buildExecutionDimension(
  plan: FeasibilityPlan,
  intake: StructuredPlanningIntake,
  traces: DerivedFromTrace[]
): DimensionAssessment {
  const executionBlocks = plan.scheduledBlocks.filter(isExecutionBlock);
  const totalSessionCount = executionBlocks.length;
  const currentPace = getCurrentPace(intake);
  const horizonWeeks = Math.max(1, Math.ceil(Number(plan.summary?.horizonDayCount || 0) / 7));
  const weeksRequired = totalSessionCount / Math.max(1, currentPace);
  let rating: RiskRating = 'LOW';
  if (weeksRequired > horizonWeeks) {
    rating = 'HIGH';
  } else if (weeksRequired > horizonWeeks * 0.85) {
    rating = 'MODERATE';
  }

  let employmentImpactWeeks = 0;
  if (intake.employmentChangeRisk) {
    const reducedWeeks = totalSessionCount / EMPLOYMENT_CHANGE_SCENARIO_SESSIONS_PER_WEEK;
    employmentImpactWeeks = Math.max(0, Math.ceil(reducedWeeks - weeksRequired));
    if (employmentImpactWeeks > 8 && riskToNumber(rating) < 2) {
      rating = 'MODERATE';
    }
  }

  traces.push({
    claim: `execution current pace is ${currentPace} sessions per week`,
    sourceType: 'derivation_logic',
    sourceId: 'execution.currentPace',
    value: currentPace,
  });
  traces.push({
    claim: `execution employment change impact is ${employmentImpactWeeks} weeks`,
    sourceType: 'derivation_logic',
    sourceId: 'execution.employmentChangeImpactWeeks',
    value: employmentImpactWeeks,
  });

  return {
    dimension: 'execution',
    rating,
    explanation:
      `You currently have ${Number(intake.weeklyHoursAvailable || 0)} hours per week available in a full-time window, so the plan assumes roughly ${currentPace} sessions per week while you are unemployed and focused. ` +
      (intake.employmentChangeRisk
        ? `If you return to work and drop to an 8-session week, the same plan stretches by about ${employmentImpactWeeks} weeks, which turns your current velocity window into a real timing asset rather than a permanent assumption.`
        : 'There is no declared employment-change risk, so the current pace assumption is relatively stable.'),
    mitigations: [
      'Front-load manufacturer research, Founder Journey content, and presale groundwork in months 1-6 while the full-time window is still open.',
      'Predefine a reduced-pace version of the plan so a job transition changes sequencing, not momentum.',
    ],
    velocityWindow: 'Months 1-6 are the highest-velocity window for this plan because you are currently full-time before employment status potentially changes.',
  };
}

function buildDomainDimension(
  intake: StructuredPlanningIntake,
  traces: DerivedFromTrace[]
): DimensionAssessment {
  const hasManufacturerRelationship = intake.existingDomainRelationships.includes('manufacturer');
  const responseRate = hasManufacturerRelationship ? WARM_RELATIONSHIP_RESPONSE_RATE : COLD_OUTREACH_RESPONSE_RATE;
  const manufacturersToContact = Math.ceil(3 / responseRate);
  let rating: RiskRating = hasManufacturerRelationship ? 'LOW' : 'MODERATE';
  if (String(intake.industryExperience || '').toLowerCase() === 'none' && !hasManufacturerRelationship) {
    rating = 'MODERATE';
  }

  traces.push({
    claim: `domain cold outreach response rate is ${responseRate}`,
    sourceType: 'derivation_logic',
    sourceId: 'domain.responseRate',
    value: responseRate,
  });

  return {
    dimension: 'domain',
    rating,
    explanation: hasManufacturerRelationship
      ? 'You already have manufacturer access, so the manufacturer-response part of this plan is comparatively straightforward.'
      : `You are starting with no manufacturer relationships and no industry experience, so the realistic planning assumption is roughly a ${Math.round(
          responseRate * 100
        )}% useful response rate on cold outreach. In practice that means contacting about ${manufacturersToContact} manufacturers to get the 3 serious conversations this plan needs.`,
    mitigations: [
      `Contact at least ${manufacturersToContact} manufacturers instead of stopping at the first few replies.`,
      'Use white-label as the first product path so the manufacturer conversation is about fit, MOQ, and responsiveness rather than custom formulation complexity.',
    ],
    earlyWarningSignal: 'If fewer than three manufacturers respond constructively inside the first response window, widen the outreach list immediately instead of waiting for a better reply rate.',
  };
}

function buildMarketDimension(
  intake: StructuredPlanningIntake,
  traces: DerivedFromTrace[]
): DimensionAssessment {
  const audienceRelationship = String(intake.capitalAcquisitionAssets?.existingAudience?.audienceRelationship || '').toLowerCase();
  const audienceSize = getAudienceSize(intake);
  const isMusicAudience = audienceRelationship.includes('music');
  const rating: RiskRating = isMusicAudience ? 'MODERATE' : 'LOW';

  traces.push({
    claim: `market audience-product fit is ${isMusicAudience ? 'UNPROVEN' : 'PROVEN'}`,
    sourceType: 'intake_field',
    sourceId: 'market.audienceRelationship',
    value: audienceRelationship,
  });
  traces.push({
    claim: `market engagement revision threshold is ${MARKET_ENGAGEMENT_REVISION_THRESHOLD}`,
    sourceType: 'derivation_logic',
    sourceId: 'market.engagementThreshold',
    value: MARKET_ENGAGEMENT_REVISION_THRESHOLD,
  });

  return {
    dimension: 'market',
    rating,
    explanation: isMusicAudience
      ? `Your audience of ${audienceSize.toLocaleString()} people is warm and trust-based, but it was built around music rather than functional food. That makes product conversion unproven, not impossible: they know you, but they do not yet know you as a product founder or gum buyer.`
      : `Your existing audience is already close to the product category, which lowers the risk that the first offer has to create demand from zero.`,
    mitigations: [
      'Treat early Founder Journey engagement as market validation, not vanity. If product content underperforms, revise the offer before asking for money.',
      'Use reaction content, sample feedback, and founder-story framing to bridge the gap from music trust to product belief.',
    ],
    earlyWarningSignal:
      'If product-building posts and Founder Journey content earn less than 30% of the engagement of your average music post, revise the offer before launching the presale.',
    revisionTrigger: 'product_engagement_below_30_percent_of_music_average',
  };
}

function buildTopRisks(dimensions: FeasibilityAssessment['dimensions']): FeasibilityRisk[] {
  const candidates: Array<Omit<FeasibilityRisk, 'rank'> & { score: number; timelineRank: number }> = [];

  candidates.push({
    risk: 'Failing to convert enough warm-audience attention into the $8,000 MOQ deposit before the production commitment gate.',
    probability: probabilityLabelForRating(dimensions.capital.rating),
    consequence: 'requires plan restructuring',
    earlyWarningSignal: dimensions.capital.earlyWarningSignal || '',
    mitigation: dimensions.capital.mitigations[0] || '',
    sourceDimension: 'capital',
    score: riskToNumber(dimensions.capital.rating) * consequenceSeverity('requires plan restructuring'),
    timelineRank: 1,
  });

  candidates.push({
    risk: 'Manufacturer production queue delay stretching the path from deposit to inventory arrival.',
    probability: probabilityLabelForRating(dimensions.timeline.rating === 'LOW' ? 'MODERATE' : dimensions.timeline.rating),
    consequence: 'delays timeline significantly',
    earlyWarningSignal: dimensions.timeline.earlyWarningSignal || '',
    mitigation: dimensions.timeline.mitigations[0] || '',
    sourceDimension: 'timeline',
    score:
      riskToNumber(dimensions.timeline.rating === 'LOW' ? 'MODERATE' : dimensions.timeline.rating) *
      consequenceSeverity('delays timeline significantly'),
    timelineRank: 2,
  });

  candidates.push({
    risk: 'Losing the current full-time execution window before the capital-acquisition and manufacturer work is front-loaded.',
    probability: probabilityLabelForRating(dimensions.execution.rating === 'LOW' ? 'MODERATE' : dimensions.execution.rating),
    consequence: 'delays timeline significantly',
    earlyWarningSignal:
      'If job-search or income pressure starts pulling hours out of the week before the presale groundwork is built, the plan will slow materially.',
    mitigation: dimensions.execution.mitigations[0] || '',
    sourceDimension: 'execution',
    score:
      riskToNumber(dimensions.execution.rating === 'LOW' ? 'MODERATE' : dimensions.execution.rating) *
      consequenceSeverity('delays timeline significantly'),
    timelineRank: 3,
  });

  candidates.push({
    risk: 'Cold manufacturer outreach yielding fewer viable conversations than the plan assumes.',
    probability: probabilityLabelForRating(dimensions.domain.rating),
    consequence: 'delays timeline',
    earlyWarningSignal: dimensions.domain.earlyWarningSignal || '',
    mitigation: dimensions.domain.mitigations[0] || '',
    sourceDimension: 'domain',
    score: riskToNumber(dimensions.domain.rating) * consequenceSeverity('delays timeline'),
    timelineRank: 1,
  });

  candidates.push({
    risk: 'Music-audience trust failing to transfer into product-buyer intent at the presale stage.',
    probability: probabilityLabelForRating(dimensions.market.rating),
    consequence: 'delays timeline',
    earlyWarningSignal: dimensions.market.earlyWarningSignal || '',
    mitigation: dimensions.market.mitigations[0] || '',
    sourceDimension: 'market',
    score: riskToNumber(dimensions.market.rating) * consequenceSeverity('delays timeline'),
    timelineRank: 1,
  });

  return candidates
    .sort((left, right) => {
      if (right.score !== left.score) return right.score - left.score;
      return left.timelineRank - right.timelineRank;
    })
    .slice(0, 3)
    .map((risk, index) => ({
      rank: index + 1,
      risk: risk.risk,
      probability: risk.probability,
      consequence: risk.consequence,
      earlyWarningSignal: risk.earlyWarningSignal,
      mitigation: risk.mitigation,
      sourceDimension: risk.sourceDimension,
    }));
}

function deriveOverallStatus(
  dimensions: FeasibilityAssessment['dimensions'],
  intake: StructuredPlanningIntake
): FeasibilityStatus {
  const ratings = Object.values(dimensions).map((dimension) => dimension.rating);
  if (ratings.includes('CRITICAL')) {
    return 'NOT_VIABLE_AS_STATED';
  }
  const highCount = ratings.filter((rating) => rating === 'HIGH').length;
  const moderateCount = ratings.filter((rating) => rating === 'MODERATE').length;
  if (highCount >= 1) {
    return 'VIABLE_BUT_FRAGILE';
  }
  if (moderateCount >= 1) {
    return 'VIABLE_WITH_IDENTIFIED_RISKS';
  }
  if (intake.capitalAcquisitionRequired) {
    return 'VIABLE_WITH_CAPITAL_ACQUISITION_REQUIRED';
  }
  return 'VIABLE_AND_STRAIGHTFORWARD';
}

function buildConfidenceStatement(
  plan: FeasibilityPlan,
  intake: StructuredPlanningIntake,
  dimensions: FeasibilityAssessment['dimensions']
) {
  const audienceSize = Number(intake.capitalAcquisitionAssets?.existingAudience?.spotifyListeners || 0);
  const founderJourneyTitle =
    detectFirstActionTitle(plan, /founder.?journey|content series/i) || 'starting the Founder Journey content series';
  const velocityPhrase =
    intake.executionContext === 'full_time'
      ? 'full-time availability in your highest-velocity window'
      : 'part-time availability with a constrained execution window';
  return (
    `This plan is viable with identified risks for a founder with ${audienceSize.toLocaleString()} Spotify listeners, an existing Illinois LLC context, and ${velocityPhrase}. ` +
    `${dimensions.capital.explanation.split('. ')[0]}. ` +
    `The single most important thing you can do in the first 30 days is ${founderJourneyTitle} because that content is what turns a music audience into product believers before the presale ask. ` +
    `What changes the odds most is validating product-content engagement early enough to adjust the offer before the month-7 MOQ deposit gate.`
  );
}

export function deriveFeasibility(plan: FeasibilityPlan, intake: StructuredPlanningIntake): FeasibilityAssessment {
  const traces: DerivedFromTrace[] = [];
  const capital = buildCapitalDimension(plan, intake, traces);
  const timeline = buildTimelineDimension(plan, intake, traces);
  const execution = buildExecutionDimension(plan, intake, traces);
  const domain = buildDomainDimension(intake, traces);
  const market = buildMarketDimension(intake, traces);

  const dimensions = { capital, timeline, execution, domain, market };
  const overallStatus = deriveOverallStatus(dimensions, intake);
  const topRisks = buildTopRisks(dimensions);
  const confidenceStatement = buildConfidenceStatement(plan, intake, dimensions);

  return {
    overallStatus,
    dimensions,
    topRisks,
    confidenceStatement,
    derivedFrom: traces,
  };
}
