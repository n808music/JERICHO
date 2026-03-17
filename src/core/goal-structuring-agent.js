/**
 * Goal Structuring Agent
 *
 * Agent 1 in the integration order.
 * Receives raw user goal input, translates to normalized canonical goal payload,
 * confirms family and subtype assignment.
 */

import { randomUUID } from 'crypto';

/**
 * Process raw user goal input into normalized goal payload
 * @param {Object} rawInputs - raw user inputs
 * @returns {Object} normalized goal payload and confirmation data
 */
export function structureGoal(rawInputs) {
  const {
    goalDescription,
    desiredOutcome,
    timeframeSense,
    priorityLevel,
    currentStatus
  } = rawInputs;

  // Generate goal ID
  const goalId = randomUUID();

  // Combine into raw goal statement
  const rawGoalStatement = `${goalDescription}. ${desiredOutcome || ''}`.trim();

  // Resolve goal family
  const familyResolution = resolveGoalFamily(rawGoalStatement);
  let goalFamily = familyResolution.family;
  let clarifications = [];

  // If ambiguous, ask clarification (simplified - assume resolved)
  if (familyResolution.ambiguous) {
    // In real implementation, would collect clarification
    clarifications.push({
      question: familyResolution.clarificationQuestion,
      userResponse: 'assumed',
      resolutionApplied: 'forced resolution'
    });
  }

  // Resolve subtype
  const subtypeResolution = resolveGoalSubtype(rawGoalStatement, goalFamily);
  let goalSubtype = subtypeResolution.subtype;

  if (subtypeResolution.unresolvable) {
    // Fallback: present all subtypes (simplified)
    goalSubtype = getDefaultSubtypeForFamily(goalFamily);
  }

  // Resolve timeframe
  const deadlineResolution = resolveTimeframe(timeframeSense);

  // Build normalized statement
  const normalizedGoalStatement = buildNormalizedStatement(goalDescription, desiredOutcome, goalFamily, goalSubtype);

  // Build payload
  const normalizedPayload = {
    goalId,
    rawGoalStatement,
    normalizedGoalStatement,
    goalFamily,
    goalSubtype,
    priorityLevel: normalizePriority(priorityLevel),
    currentStatus: normalizeStatus(currentStatus),
    timeframeSense,
    targetDeadline: deadlineResolution.deadline,
    deadlineConfidence: deadlineResolution.confidence,
    intakeTimestamp: new Date().toISOString(),
    confirmationStatus: 'PENDING',
    clarificationsRequired: clarifications.length > 0,
    clarificationLog: clarifications,
    errorCode: null
  };

  return {
    normalizedPayload,
    confirmationData: {
      normalizedStatement: normalizedGoalStatement,
      familyExplanation: getFamilyExplanation(goalFamily, rawGoalStatement),
      subtypeExplanation: getSubtypeExplanation(goalSubtype, rawGoalStatement),
      resolvedDeadline: deadlineResolution.deadline,
      deadlineConfidence: deadlineResolution.confidence,
      clarificationLog: clarifications
    }
  };
}

/**
 * Resolve goal family from raw input
 */
function resolveGoalFamily(rawInput) {
  const input = rawInput.toLowerCase();

  // Apply rules in order
  if (input.match(/launch.*product|launch.*app|launch.*service|launch.*business|start.*company/i)) {
    return { family: 'VentureLaunch', ambiguous: false };
  }
  if (input.match(/learn.*skill|get better at|master|improve.*skill/i)) {
    return { family: 'SkillAcquisition', ambiguous: false };
  }
  if (input.match(/certification|license|exam|qualification|credential/i)) {
    return { family: 'ProfessionalQualification', ambiguous: false };
  }
  if (input.match(/fitness|training|weight|performance|rehab/i)) {
    return { family: 'PhysicalTraining', ambiguous: false };
  }
  if (input.match(/job|work|career|employment|hire/i)) {
    return { family: 'JobSearchPipeline', ambiguous: false };
  }
  if (input.match(/content|writing|recording|producing|publishing/i)) {
    return { family: 'CreativeProduction', ambiguous: false };
  }
  if (input.match(/brand|audience|identity|following/i)) {
    return { family: 'BrandLaunch', ambiguous: false };
  }
  if (input.match(/sell|sales|deals|pipeline|revenue/i)) {
    return { family: 'SalesPipeline', ambiguous: false };
  }
  if (input.match(/raise.*money|investors|grants|funding|sponsors/i)) {
    return { family: 'Fundraising', ambiguous: false };
  }

  // Ambiguous - would ask clarification
  return {
    family: 'VentureLaunch', // default
    ambiguous: true,
    clarificationQuestion: 'Is this about launching something new or improving an existing thing?'
  };
}

/**
 * Resolve goal subtype within family
 */
function resolveGoalSubtype(rawInput, family) {
  const input = rawInput.toLowerCase();

  const subtypeRules = {
    VentureLaunch: [
      { pattern: /app|software|saas|subscription|digital/i, subtype: 'SaaS Product Launch' },
      { pattern: /physical|product|consumer|retail|ecommerce/i, subtype: 'Consumer Product Launch' },
      { pattern: /consulting|agency|freelance|service/i, subtype: 'Service Business Launch' },
      { pattern: /platform|marketplace|two.sided/i, subtype: 'Marketplace Launch' },
      { pattern: /local|brick|mortar|location/i, subtype: 'Local Business Launch' }
    ],
    SkillAcquisition: [
      { pattern: /coding|programming|engineering|data|technical/i, subtype: 'Software Skill Acquisition' },
      { pattern: /design|ui|ux|visual|graphic/i, subtype: 'Design Skill Acquisition' },
      { pattern: /speaking|writing|presenting|negotiating/i, subtype: 'Communication Skill Acquisition' },
      { pattern: /welding|plumbing|electrical|mechanical|trade/i, subtype: 'Technical Trade Skill Acquisition' },
      { pattern: /music|drawing|painting|photography|filmmaking/i, subtype: 'Creative Skill Acquisition' }
    ],
    ProfessionalQualification: [
      { pattern: /exam|pass.fail|study|test/i, subtype: 'Certification Exam' },
      { pattern: /license|government|regulatory|legal/i, subtype: 'Licensure Exam' },
      { pattern: /training|mandatory|compliance/i, subtype: 'Compliance Training Completion' },
      { pattern: /portfolio|samples|submission|panel/i, subtype: 'Portfolio-Based Qualification' },
      { pattern: /interview|oral|panel|review/i, subtype: 'Interview-Based Qualification' }
    ],
    PhysicalTraining: [
      { pattern: /strength|lifting|muscle|powerlifting/i, subtype: 'Strength Program' },
      { pattern: /running|cycling|swimming|triathlon|race/i, subtype: 'Endurance Performance' },
      { pattern: /weight.loss|fat.loss|body.composition/i, subtype: 'Weight Loss / Body Composition' },
      { pattern: /recovery|injury|returning|therapy/i, subtype: 'Rehab Return to Training' },
      { pattern: /general|fitness|health|active|conditioning/i, subtype: 'General Conditioning' }
    ],
    JobSearchPipeline: [
      { pattern: /corporate|office|enterprise|traditional/i, subtype: 'Corporate Role Search' },
      { pattern: /remote|distributed|anywhere|knowledge/i, subtype: 'Remote Knowledge Work Search' },
      { pattern: /creative|design|writing|art|agency/i, subtype: 'Creative Role Search' },
      { pattern: /trade|apprenticeship|skilled|labor|union/i, subtype: 'Skilled Trade Role Search' },
      { pattern: /transition|change|switch|pivoting/i, subtype: 'Career Transition Search' }
    ],
    CreativeProduction: [
      { pattern: /tv|series|screenplay|writers/i, subtype: 'TV / Series Writing' },
      { pattern: /podcast|audio|episode|interview/i, subtype: 'Podcast Production' },
      { pattern: /album|ep|single|recording|music/i, subtype: 'Music Project Production' },
      { pattern: /youtube|video|documentary|film/i, subtype: 'Video Production' },
      { pattern: /book|novel|memoir|manuscript/i, subtype: 'Book / Longform Writing' }
    ],
    BrandLaunch: [
      { pattern: /personal|thought.leadership|individual/i, subtype: 'Personal Brand Launch' },
      { pattern: /company|business|corporate/i, subtype: 'Business Brand Launch' },
      { pattern: /product|line/i, subtype: 'Product Brand Launch' },
      { pattern: /artist|creator|musician|performer/i, subtype: 'Artist / Creator Brand Launch' },
      { pattern: /campaign|seasonal|push/i, subtype: 'Campaign Brand Launch' }
    ],
    SalesPipeline: [
      { pattern: /b2b|business.*business|enterprise/i, subtype: 'B2B Service Sales' },
      { pattern: /b2c|consumer|retail|direct/i, subtype: 'B2C Product Sales' },
      { pattern: /high.value|consultative|long.cycle/i, subtype: 'High-Ticket Consultative Sales' },
      { pattern: /local|in.person|location/i, subtype: 'Retail / Local Offer Sales' },
      { pattern: /recurring|subscription|membership|retainer/i, subtype: 'Subscription / Recurring Revenue Sales' }
    ],
    Fundraising: [
      { pattern: /family|friends|personal|initial/i, subtype: 'Friends and Family Raise' },
      { pattern: /angel|individual|accredited/i, subtype: 'Angel Raise' },
      { pattern: /seed|institutional|early.stage/i, subtype: 'Seed Round Raise' },
      { pattern: /grant|foundation|non.dilutive|government/i, subtype: 'Grant / Non-Dilutive Funding' },
      { pattern: /sponsor|partnership|brand.deal|co.marketing/i, subtype: 'Sponsorship / Partnership Raise' }
    ]
  };

  const rules = subtypeRules[family] || [];
  for (const rule of rules) {
    if (input.match(new RegExp(rule.pattern, 'i'))) {
      return { subtype: rule.subtype, unresolvable: false };
    }
  }

  return { subtype: getDefaultSubtypeForFamily(family), unresolvable: true };
}

/**
 * Get default subtype for family
 */
function getDefaultSubtypeForFamily(family) {
  const defaults = {
    VentureLaunch: 'SaaS Product Launch',
    SkillAcquisition: 'Software Skill Acquisition',
    ProfessionalQualification: 'Certification Exam',
    PhysicalTraining: 'Strength Program',
    JobSearchPipeline: 'Corporate Role Search',
    CreativeProduction: 'TV / Series Writing',
    BrandLaunch: 'Personal Brand Launch',
    SalesPipeline: 'B2B Service Sales',
    Fundraising: 'Friends and Family Raise'
  };
  return defaults[family] || 'Unknown';
}

/**
 * Resolve timeframe to deadline
 */
function resolveTimeframe(timeframe) {
  if (!timeframe) {
    return { deadline: null, confidence: 'LOW' };
  }

  const input = timeframe.toLowerCase();

  // Specific date
  const dateMatch = input.match(/by (\w+ \d+|\d+\/\d+\/\d{4}|\d{4}-\d{2}-\d{2})/i);
  if (dateMatch) {
    // Simplified: assume valid date
    return { deadline: '2026-12-31', confidence: 'HIGH' }; // placeholder
  }

  // Named month
  const monthMatch = input.match(/by (\w+)/i);
  if (monthMatch) {
    const _month = monthMatch[1];
    // Simplified
    return { deadline: '2026-12-31', confidence: 'HIGH' };
  }

  // Relative
  if (input.match(/in (\d+) months?/i)) {
    const months = parseInt(input.match(/in (\d+) months?/i)[1]);
    const date = new Date();
    date.setMonth(date.getMonth() + months);
    return { deadline: date.toISOString().split('T')[0], confidence: 'HIGH' };
  }

  if (input.match(/this year/i)) {
    return { deadline: '2026-12-31', confidence: 'MED' };
  }

  if (input.match(/by summer/i)) {
    return { deadline: '2026-06-21', confidence: 'MED' };
  }

  // Very vague
  if (input.match(/eventually|soon/i)) {
    return { deadline: null, confidence: 'LOW' };
  }

  return { deadline: null, confidence: 'LOW' };
}

/**
 * Build normalized goal statement
 */
function buildNormalizedStatement(description, outcome, family, subtype) {
  return `Achieve ${outcome || 'the desired outcome'} through ${subtype} in the ${family} domain.`;
}

/**
 * Normalize priority
 */
function normalizePriority(priority) {
  if (!priority) return 'MEDIUM';
  const p = priority.toLowerCase();
  if (p.includes('high')) return 'HIGH';
  if (p.includes('low')) return 'LOW';
  return 'MEDIUM';
}

/**
 * Normalize status
 */
function normalizeStatus(status) {
  if (!status) return 'NOT_STARTED';
  const s = status.toLowerCase();
  if (s.includes('started') || s.includes('progress')) return 'IN_PROGRESS';
  return 'NOT_STARTED';
}

/**
 * Get family explanation
 */
function getFamilyExplanation(family, _rawInput) {
  const explanations = {
    VentureLaunch: 'This appears to be about launching a new product, service, or business venture.',
    SkillAcquisition: 'This appears to be about learning or improving a specific skill.',
    ProfessionalQualification: 'This appears to be about obtaining a certification, license, or professional qualification.',
    PhysicalTraining: 'This appears to be about physical fitness, training, or performance goals.',
    JobSearchPipeline: 'This appears to be about finding employment or advancing in a career.',
    CreativeProduction: 'This appears to be about creating and producing content or creative work.',
    BrandLaunch: 'This appears to be about building a brand, audience, or personal identity.',
    SalesPipeline: 'This appears to be about selling products or services and building revenue.',
    Fundraising: 'This appears to be about raising money from investors, grants, or sponsors.'
  };
  return explanations[family] || 'Family classification applied.';
}

/**
 * Get subtype explanation
 */
function getSubtypeExplanation(subtype, _rawInput) {
  return `This matches the ${subtype} subtype based on the specific details provided.`;
}

/**
 * Confirm goal structure
 * @param {Object} normalizedPayload - the payload to confirm
 * @param {string} userChoice - user's confirmation choice
 * @returns {Object} updated payload
 */
export function confirmGoalStructure(normalizedPayload, userChoice) {
  if (userChoice === 'correct') {
    return {
      ...normalizedPayload,
      confirmationStatus: 'CONFIRMED'
    };
  } else if (userChoice === 'start_over') {
    return {
      ...normalizedPayload,
      confirmationStatus: 'REJECTED',
      errorCode: 'CONFIRMATION_REJECTED'
    };
  } else {
    // Correction needed - would re-run specific parts
    return {
      ...normalizedPayload,
      confirmationStatus: 'PENDING'
    };
  }
}