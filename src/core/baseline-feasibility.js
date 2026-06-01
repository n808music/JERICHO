/**
 * Baseline Feasibility Scoring Module
 *
 * Computes a deterministic baseline feasibility score (0-100) for a goal
 * based on effort estimate and capacity vector.
 * This is Module 6 in the agent integration order.
 */

/**
 * Compute baseline feasibility score from effort estimate and capacity vector
 * @param {Object} effortEstimate - output from computeEffortEstimate
 * @param {Object} capacityVector - the capacity vector used for estimation
 * @returns {Object} feasibility score with breakdown
 */
export function computeBaselineFeasibility(effortEstimate, capacityVector) {
  const {
    estimatedTotalEffortHours,
    estimatedWeeksToComplete,
    effortConfidenceBand,
    limitingFactors,
    errorCode
  } = effortEstimate;

  const {
    availableHoursPerWeek,
    totalAvailableHours,
    currentLoadModifier,
    experienceModifier,
    externalDependencyRisk,
    startDate,
    deadline
  } = capacityVector;

  if (errorCode) {
    return {
      baselineFeasibilityScore: 0,
      feasibilityBand: 'RED',
      factorBreakdown: [],
      limitingFactors: [errorCode],
      recommendedAdjustments: ['Fix input errors before proceeding'],
      errorCode
    };
  }

  // Calculate factor contributions
  const factorBreakdown = [];

  // Available hours factor
  const hoursNeededPerWeek = estimatedTotalEffortHours / estimatedWeeksToComplete;
  const hoursUtilization = hoursNeededPerWeek / availableHoursPerWeek;
  const availableHoursContribution = Math.max(0, Math.min(25, 25 * (1 - hoursUtilization)));
  factorBreakdown.push({
    factor: 'available hours',
    contribution: Math.round(availableHoursContribution)
  });

  // Load modifier factor
  const loadContribution = 20 * currentLoadModifier;
  factorBreakdown.push({
    factor: 'load modifier',
    contribution: Math.round(loadContribution)
  });

  // Experience modifier factor
  const experienceContribution = 15 * experienceModifier;
  factorBreakdown.push({
    factor: 'experience modifier',
    contribution: Math.round(experienceContribution)
  });

  // External dependency risk factor
  const dependencyMultiplier = externalDependencyRisk === 'HIGH' ? 0.5 :
                              externalDependencyRisk === 'MED' ? 0.75 : 1.0;
  const dependencyContribution = 15 * dependencyMultiplier;
  factorBreakdown.push({
    factor: 'external dependency risk',
    contribution: Math.round(dependencyContribution)
  });

  // Timeline compression factor
  const timelineWeeks = calculateTimelineWeeks(startDate, deadline);
  const compressionRatio = estimatedWeeksToComplete / timelineWeeks;
  const timelineContribution = Math.max(0, Math.min(25, 25 * (1 - compressionRatio)));
  factorBreakdown.push({
    factor: 'timeline compression',
    contribution: Math.round(timelineContribution)
  });

  // Calculate total score
  const totalScore = factorBreakdown.reduce((sum, factor) => sum + factor.contribution, 0);
  const baselineFeasibilityScore = Math.max(0, Math.min(100, totalScore));

  // Determine band
  let feasibilityBand = 'GREEN';
  if (baselineFeasibilityScore < 40) feasibilityBand = 'RED';
  else if (baselineFeasibilityScore < 70) feasibilityBand = 'YELLOW';

  // Generate recommended adjustments
  const recommendedAdjustments = generateAdjustments(
    baselineFeasibilityScore,
    factorBreakdown,
    capacityVector,
    effortEstimate
  );

  return {
    baselineFeasibilityScore,
    feasibilityBand,
    factorBreakdown,
    limitingFactors,
    recommendedAdjustments,
    errorCode: null
  };
}

function calculateTimelineWeeks(startDate, deadline) {
  if (!startDate || !deadline) return 12; // default 3 months
  const start = new Date(startDate);
  const end = new Date(deadline);
  const days = Math.max(1, (end - start) / (1000 * 60 * 60 * 24));
  return days / 7;
}

function generateAdjustments(score, breakdown, capacityVector, effortEstimate) {
  const adjustments = [];

  // Low available hours
  const hoursFactor = breakdown.find(f => f.factor === 'available hours');
  if (hoursFactor && hoursFactor.contribution < 15) {
    const neededIncrease = Math.ceil((effortEstimate.estimatedTotalEffortHours / effortEstimate.estimatedWeeksToComplete) - capacityVector.availableHoursPerWeek);
    adjustments.push(`Add ${neededIncrease} hours per week to improve feasibility`);
  }

  // High load
  if (capacityVector.currentLoadModifier < 0.8) {
    adjustments.push('Reduce current workload or extend timeline');
  }

  // Low experience
  if (capacityVector.experienceModifier < 0.8) {
    adjustments.push('Consider starting with a smaller scope or getting mentorship');
  }

  // High dependency risk
  if (capacityVector.externalDependencyRisk === 'HIGH') {
    adjustments.push('Reduce external dependencies or build contingency time');
  }

  // Timeline compression
  const timelineFactor = breakdown.find(f => f.factor === 'timeline compression');
  if (timelineFactor && timelineFactor.contribution < 15) {
    const neededWeeks = effortEstimate.estimatedWeeksToComplete;
    adjustments.push(`Extend deadline by ${Math.ceil(neededWeeks - calculateTimelineWeeks(capacityVector.startDate, capacityVector.deadline))} weeks`);
  }

  if (adjustments.length === 0) {
    adjustments.push('Current inputs are well-aligned for success');
  }

  return adjustments;
}
