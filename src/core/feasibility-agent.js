/**
 * Feasibility Baseline Agent
 *
 * Agent 3 in the integration order.
 * Collects user capacity inputs, translates to capacity vector,
 * triggers baseline feasibility score before scheduling begins.
 */

import { computeEffortEstimate } from './effort-estimation.js';
import { computeBaselineFeasibility } from './baseline-feasibility.js';

/**
 * Process user capacity inputs into feasibility assessment
 * @param {Object} rawInputs - raw user inputs
 * @param {string} goalFamily - the goal family
 * @param {string} goalSubtype - the goal subtype
 * @returns {Object} feasibility assessment
 */
export function assessFeasibility(rawInputs, goalFamily, goalSubtype) {
  // Translate raw inputs to capacity vector
  const capacityVector = buildCapacityVector(rawInputs, goalFamily, goalSubtype);

  // Validate capacity vector
  const validation = validateCapacityVector(capacityVector);
  if (!validation.valid) {
    return {
      success: false,
      error: validation.error,
      capacityVector: null,
      effortEstimate: null,
      feasibility: null
    };
  }

  // Compute effort estimate
  const effortEstimate = computeEffortEstimate(capacityVector);

  // Compute feasibility score
  const feasibility = computeBaselineFeasibility(effortEstimate, capacityVector);

  return {
    success: true,
    capacityVector,
    effortEstimate,
    feasibility,
    confirmationRequired: true
  };
}

/**
 * Build capacity vector from raw user inputs
 */
function buildCapacityVector(rawInputs, goalFamily, goalSubtype) {
  const {
    availableHoursPerWeek,
    availableDays,
    sessionLengthPreference,
    hardBlackoutPeriods = [],
    goalStartDate,
    goalDeadline,
    currentLoadLevel,
    energyPattern,
    priorExperience,
    externalDependencyCount,
    familySpecificInputs = {}
  } = rawInputs;

  // Apply modifier rules
  const currentLoadModifier = getLoadModifier(currentLoadLevel);
  const experienceModifier = getExperienceModifier(priorExperience);
  const externalDependencyRisk = getDependencyRisk(externalDependencyCount);

  // Calculate total available hours
  const weeksAvailable = calculateWeeksAvailable(goalStartDate, goalDeadline, availableDays, hardBlackoutPeriods);
  const totalAvailableHours = availableHoursPerWeek * weeksAvailable;

  // Convert session length preference to minutes
  const preferredSessionLengthMinutes = getSessionLengthMinutes(sessionLengthPreference);

  return {
    availableHoursPerWeek: Number(availableHoursPerWeek) || 0,
    availableDays: Array.isArray(availableDays) ? availableDays : [],
    preferredSessionLengthMinutes,
    blackoutPeriods: hardBlackoutPeriods,
    startDate: goalStartDate,
    deadline: goalDeadline,
    totalAvailableHours,
    currentLoadModifier,
    experienceModifier,
    externalDependencyRisk,
    goalFamily,
    goalSubtype,
    familySpecificInputs
  };
}

/**
 * Validate capacity vector has required fields
 */
function validateCapacityVector(vector) {
  const required = [
    'availableHoursPerWeek',
    'availableDays',
    'startDate',
    'deadline',
    'currentLoadModifier',
    'experienceModifier',
    'externalDependencyRisk',
    'goalFamily'
  ];

  for (const field of required) {
    if (!vector[field]) {
      return { valid: false, error: `Missing required field: ${field}` };
    }
  }

  if (vector.availableHoursPerWeek <= 0) {
    return { valid: false, error: 'Available hours per week must be positive' };
  }

  return { valid: true };
}

/**
 * Get load modifier from user input
 */
function getLoadModifier(loadLevel) {
  switch (loadLevel) {
    case 'light': return 1.0;
    case 'moderate': return 0.85;
    case 'heavy': return 0.70;
    case 'overloaded': return 0.60;
    default: return 0.85; // default to moderate
  }
}

/**
 * Get experience modifier from user input
 */
function getExperienceModifier(experience) {
  switch (experience) {
    case 'done_this_before': return 1.0;
    case 'some_experience': return 0.90;
    case 'novice': return 0.75;
    default: return 0.90; // default to some experience
  }
}

/**
 * Get dependency risk from count
 */
function getDependencyRisk(count) {
  const num = Number(count) || 0;
  if (num >= 4) return 'HIGH';
  if (num >= 2) return 'MED';
  return 'LOW';
}

/**
 * Convert session length preference to minutes
 */
function getSessionLengthMinutes(preference) {
  switch (preference) {
    case '30_min': return 30;
    case '1_hour': return 60;
    case '2_hours': return 120;
    default: return 60; // default to 1 hour
  }
}

/**
 * Calculate available weeks between start and deadline
 */
function calculateWeeksAvailable(startDate, deadline, availableDays, blackoutPeriods) {
  if (!startDate || !deadline) return 12; // default 3 months

  const start = new Date(startDate);
  const end = new Date(deadline);
  const totalDays = Math.max(1, (end - start) / (1000 * 60 * 60 * 24));

  // Assume availableDays.length days per week
  const daysPerWeek = availableDays ? availableDays.length : 5;
  const availableWeeks = (totalDays / 7) * (daysPerWeek / 7);

  // Subtract blackout periods
  const blackoutDays = blackoutPeriods.reduce((sum, period) => {
    if (period.start && period.end) {
      const blackoutStart = new Date(period.start);
      const blackoutEnd = new Date(period.end);
      // Only count blackouts within the goal period
      const effectiveStart = blackoutStart > start ? blackoutStart : start;
      const effectiveEnd = blackoutEnd < end ? blackoutEnd : end;
      if (effectiveEnd > effectiveStart) {
        return sum + (effectiveEnd - effectiveStart) / (1000 * 60 * 60 * 24);
      }
    }
    return sum;
  }, 0);

  return Math.max(1, availableWeeks - (blackoutDays / 7));
}

/**
 * Get plain-language interpretation of feasibility score
 */
export function getFeasibilityInterpretation(feasibility) {
  const { baselineFeasibilityScore, feasibilityBand, limitingFactors } = feasibility;

  let interpretation = '';
  switch (feasibilityBand) {
    case 'GREEN':
      interpretation = `This goal appears feasible with your current capacity. The score of ${baselineFeasibilityScore} indicates good alignment between required effort and available time.`;
      break;
    case 'YELLOW':
      interpretation = `This goal may be challenging but achievable. The score of ${baselineFeasibilityScore} suggests some adjustments may be needed to ensure success.`;
      break;
    case 'RED':
      interpretation = `This goal appears not feasible with current inputs. The score of ${baselineFeasibilityScore} indicates significant gaps that need addressing before proceeding.`;
      break;
  }

  if (limitingFactors && limitingFactors.length > 0) {
    interpretation += ` Key factors: ${limitingFactors.join(', ')}.`;
  }

  return interpretation;
}