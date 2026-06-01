/**
 * Effort Estimation Module
 *
 * Computes deterministic effort estimates for goals based on capacity vector and goal family.
 * This is Module 5 in the agent integration order.
 */

const BASELINE_EFFORT_RANGES = {
  VentureLaunch: { min: 400, max: 800 },
  SkillAcquisition: { min: 80, max: 300 },
  ProfessionalQualification: { min: 60, max: 200 },
  PhysicalTraining: { min: 120, max: 400 },
  JobSearchPipeline: { min: 80, max: 200 },
  CreativeProduction: { min: 100, max: 500 },
  BrandLaunch: { min: 150, max: 400 },
  SalesPipeline: { min: 100, max: 300 },
  Fundraising: { min: 150, max: 500 }
};

const SUBTYPE_MODIFIERS = {
  // VentureLaunch subtypes
  'SaaS Product Launch': 1.0,
  'Consumer Product Launch': 0.9,
  'Service Business Launch': 0.8,
  'Marketplace Launch': 1.1,
  'Local Business Launch': 0.7,

  // SkillAcquisition subtypes
  'Software Skill Acquisition': 1.0,
  'Design Skill Acquisition': 0.9,
  'Communication Skill Acquisition': 0.8,
  'Technical Trade Skill Acquisition': 1.1,
  'Creative Skill Acquisition': 0.9,

  // ProfessionalQualification subtypes
  'Certification Exam': 0.8,
  'Licensure Exam': 1.0,
  'Compliance Training Completion': 0.6,
  'Portfolio-Based Qualification': 1.2,
  'Interview-Based Qualification': 0.9,

  // PhysicalTraining subtypes
  'Strength Program': 1.0,
  'Endurance Performance': 1.1,
  'Weight Loss / Body Composition': 0.9,
  'Rehab Return to Training': 0.7,
  'General Conditioning': 0.8,

  // JobSearchPipeline subtypes
  'Corporate Role Search': 1.0,
  'Remote Knowledge Work Search': 0.9,
  'Creative Role Search': 0.8,
  'Skilled Trade Role Search': 1.1,
  'Career Transition Search': 1.2,

  // CreativeProduction subtypes
  'TV / Series Writing': 1.2,
  'Podcast Production': 0.8,
  'Music Project Production': 1.0,
  'Video Production': 1.1,
  'Book / Longform Writing': 1.3,

  // BrandLaunch subtypes
  'Personal Brand Launch': 0.8,
  'Business Brand Launch': 1.0,
  'Product Brand Launch': 1.1,
  'Artist / Creator Brand Launch': 0.9,
  'Campaign Brand Launch': 0.7,

  // SalesPipeline subtypes
  'B2B Service Sales': 1.0,
  'B2C Product Sales': 0.9,
  'High-Ticket Consultative Sales': 1.2,
  'Retail / Local Offer Sales': 0.7,
  'Subscription / Recurring Revenue Sales': 1.1,

  // Fundraising subtypes
  'Friends and Family Raise': 0.6,
  'Angel Raise': 1.0,
  'Seed Round Raise': 1.3,
  'Grant / Non-Dilutive Funding': 0.8,
  'Sponsorship / Partnership Raise': 0.9
};

/**
 * Compute effort estimate from capacity vector
 * @param {Object} capacityVector - structured capacity inputs
 * @returns {Object} effort estimate
 */
export function computeEffortEstimate(capacityVector) {
  const {
    availableHoursPerWeek,
    availableDays,
    preferredSessionLengthMinutes,
    blackoutPeriods = [],
    startDate,
    deadline,
    totalAvailableHours,
    currentLoadModifier,
    experienceModifier,
    externalDependencyRisk,
    goalFamily,
    goalSubtype,
    familySpecificInputs
  } = capacityVector;

  // Validate required inputs
  if (!goalFamily || !BASELINE_EFFORT_RANGES[goalFamily]) {
    return {
      estimatedTotalEffortHours: 0,
      estimatedWeeksToComplete: 0,
      effortConfidenceBand: 'LOW',
      limitingFactors: ['Invalid or missing goal family'],
      errorCode: 'INVALID_GOAL_FAMILY'
    };
  }

  // Get baseline effort for family
  const baseline = BASELINE_EFFORT_RANGES[goalFamily];
  const baselineHours = (baseline.min + baseline.max) / 2;

  // Apply subtype modifier
  const subtypeModifier = SUBTYPE_MODIFIERS[goalSubtype] || 1.0;
  let adjustedBaseline = baselineHours * subtypeModifier;

  // Apply capacity modifiers
  adjustedBaseline *= (1 / currentLoadModifier); // Higher load = more time needed
  adjustedBaseline *= (1 / experienceModifier); // Less experience = more time needed

  // Apply external dependency risk
  const dependencyMultiplier = externalDependencyRisk === 'HIGH' ? 1.3 :
                              externalDependencyRisk === 'MED' ? 1.15 : 1.0;
  adjustedBaseline *= dependencyMultiplier;

  // Apply family-specific adjustments
  adjustedBaseline = applyFamilySpecificAdjustments(adjustedBaseline, goalFamily, familySpecificInputs);

  // Calculate timeline
  const weeksAvailable = calculateWeeksAvailable(startDate, deadline, availableDays, blackoutPeriods);
  const availableHoursTotal = totalAvailableHours || (availableHoursPerWeek * weeksAvailable);

  // Determine confidence band
  const utilizationRate = adjustedBaseline / availableHoursTotal;
  let effortConfidenceBand = 'MED';
  if (utilizationRate > 1.2) effortConfidenceBand = 'LOW';
  else if (utilizationRate < 0.8) effortConfidenceBand = 'HIGH';

  // Calculate estimated weeks
  const estimatedWeeksToComplete = Math.max(1, Math.ceil(adjustedBaseline / availableHoursPerWeek));

  // Identify limiting factors
  const limitingFactors = [];
  if (currentLoadModifier < 0.8) limitingFactors.push('High current load');
  if (experienceModifier < 0.8) limitingFactors.push('Limited prior experience');
  if (externalDependencyRisk === 'HIGH') limitingFactors.push('High external dependency risk');
  if (utilizationRate > 1.1) limitingFactors.push('Timeline compression required');

  return {
    estimatedTotalEffortHours: Math.round(adjustedBaseline),
    estimatedWeeksToComplete,
    effortConfidenceBand,
    limitingFactors,
    errorCode: null
  };
}

function applyFamilySpecificAdjustments(baseHours, goalFamily, familySpecificInputs) {
  if (!familySpecificInputs) return baseHours;

  let multiplier = 1.0;

  switch (goalFamily) {
    case 'VentureLaunch':
      if (familySpecificInputs.teamSize === 'solo') multiplier *= 1.5;
      if (familySpecificInputs.budgetAvailable < 10000) multiplier *= 1.2;
      break;
    case 'SkillAcquisition':
      if (familySpecificInputs.currentSkillLevel === 'novice') multiplier *= 1.3;
      break;
    case 'ProfessionalQualification':
      if (familySpecificInputs.priorAttemptHistory === 'multiple_failures') multiplier *= 1.2;
      break;
    case 'PhysicalTraining':
      if (familySpecificInputs.anyInjuryConstraints) multiplier *= 1.4;
      break;
    case 'JobSearchPipeline':
      if (familySpecificInputs.currentEmploymentStatus === 'unemployed') multiplier *= 0.8;
      break;
    case 'CreativeProduction':
      if (!familySpecificInputs.draftExists) multiplier *= 1.3;
      break;
    case 'BrandLaunch':
      if (familySpecificInputs.existingAudienceSize < 1000) multiplier *= 1.2;
      break;
    case 'SalesPipeline':
      if (familySpecificInputs.existingPipeline === 'zero') multiplier *= 1.3;
      break;
    case 'Fundraising':
      if (familySpecificInputs.priorRaiseHistory === 'none') multiplier *= 1.4;
      break;
  }

  return baseHours * multiplier;
}

function calculateWeeksAvailable(startDate, deadline, availableDays, blackoutPeriods) {
  if (!startDate || !deadline) return 12; // default 3 months

  const start = new Date(startDate);
  const end = new Date(deadline);
  const totalDays = Math.max(1, (end - start) / (1000 * 60 * 60 * 24));

  // Simple approximation: assume availableDays.length / 7 days per week
  const daysPerWeek = availableDays ? availableDays.length : 5;
  const weeks = totalDays / 7;
  const availableWeeks = weeks * (daysPerWeek / 7);

  // Subtract blackout periods (simplified)
  const blackoutDays = blackoutPeriods.reduce((sum, period) => {
    if (period.start && period.end) {
      return sum + Math.max(0, (new Date(period.end) - new Date(period.start)) / (1000 * 60 * 60 * 24));
    }
    return sum;
  }, 0);

  return Math.max(1, availableWeeks - (blackoutDays / 7));
}