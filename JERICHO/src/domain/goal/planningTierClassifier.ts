export type GoalPlanningTier =
  | 'short_term_simple'
  | 'short_term_complex'
  | 'long_term_simple'
  | 'long_term_complex'
  | 'master_plan';

type PlanningTierContext = {
  goalType?: string | null;
  isConsumable?: boolean | null;
};

const MASTER_PLAN_KEYWORDS = [
  /\bmaster plan\b/,
  /\becosystem\b/,
  /\bconvergence\b/,
  /\bparallel lanes?\b/,
  /\bmultiple lanes?\b/,
  /\bwork backward\b/,
  /\btoday through\b/,
  /\bincome\/runway\b/,
  /\bproject-management brand\b/,
  /\bpm brand\b/,
  /\bfive[- ]year\b/,
  /\b5[- ]year\b/,
  /\bmulti[- ]year\b/,
  /\bcompany[- ]building\b/,
  /\bbuilding (?:a |my )?company\b/,
  /\bbuild (?:a |my )?company\b/,
  /\bempire\b/,
  /\bmulti[- ]venture\b/,
];

const MASTER_PLAN_DOMAIN_TERMS = [
  /\balbum\b/,
  /\blabel\b/,
  /\bapp\b/,
  /\bpodcast\b/,
  /\bbrand\b/,
  /\bincome\b/,
  /\brunway\b/,
  /\bcompany\b/,
  /\becosystem\b/,
];

const COMPLEXITY_TERMS = [
  /\blaunch\b/,
  /\brelease\b/,
  /\bdistribution setup\b/,
  /\brelease package\b/,
  /\bcover art\b/,
  /\bfinal recordings?\b/,
  /\brevenue\b/,
  /\baudience\b/,
  /\bdistribution\b/,
  /\bmanufactur(?:e|ing|er)\b/,
  /\bclient acquisition\b/,
  /\bdependencies?\b/,
  /\bstakeholder\b/,
  /\brisk register\b/,
  /\bportfolio\b/,
  /\bcase study\b/,
  /\bdeliverables?\b/,
  /\bmilestones?\b/,
  /\bphases?\b/,
];

function inferHorizonDays(goalText: string) {
  const lower = String(goalText || '').toLowerCase();
  const dayMatch = lower.match(/\bwithin\s+(\d+)\s+days?\b|\bin\s+(\d+)\s+days?\b/);
  if (dayMatch) {
    return Number(dayMatch[1] || dayMatch[2] || 0);
  }

  const weekMatch = lower.match(/\bwithin\s+(\d+)\s+weeks?\b|\bin\s+(\d+)\s+weeks?\b/);
  if (weekMatch) {
    return Number(weekMatch[1] || weekMatch[2] || 0) * 7;
  }

  const monthMatch = lower.match(/\bwithin\s+(\d+)\s+months?\b|\bin\s+(\d+)\s+months?\b|today through\b/);
  if (monthMatch) {
    const months = Number(monthMatch[1] || monthMatch[2] || 6);
    return months * 30;
  }

  const yearMatch = lower.match(/\bwithin\s+(\d+)\s+years?\b|\bin\s+(\d+)\s+years?\b|\bover\s+(\d+)\s+years?\b/);
  if (yearMatch) {
    return Number(yearMatch[1] || yearMatch[2] || yearMatch[3] || 0) * 365;
  }

  if (/\boct(?:ober)?\s+\d{1,2}\b/.test(lower)) {
    return 180;
  }

  return null;
}

function countMatches(goalText: string, patterns: RegExp[]) {
  return patterns.reduce((count, pattern) => (pattern.test(goalText) ? count + 1 : count), 0);
}

function inferMasterPlan(goalText: string) {
  const keywordHits = countMatches(goalText, MASTER_PLAN_KEYWORDS);
  const domainHits = countMatches(goalText, MASTER_PLAN_DOMAIN_TERMS);
  const compoundListHits = (goalText.match(/,/g) || []).length;
  const hasAnchorLanguage = /\banchor\b|\bhard convergence\b|\bwork backward\b/.test(goalText);
  return keywordHits >= 1 || domainHits >= 4 || (domainHits >= 3 && hasAnchorLanguage) || (domainHits >= 3 && compoundListHits >= 3);
}

export function requiresCoreMissionContract(tier: GoalPlanningTier, _goalText: string): boolean {
  return tier === 'master_plan';
}

export function classifyGoalPlanningTier(goalText: string, context: PlanningTierContext = {}): GoalPlanningTier {
  const normalized = String(goalText || '').trim().toLowerCase();
  const horizonDays = inferHorizonDays(normalized);
  const complexityScore =
    countMatches(normalized, COMPLEXITY_TERMS) +
    ((normalized.match(/\b(and|with|includes?|plus)\b/g) || []).length >= 2 ? 1 : 0) +
    (context.goalType === 'physical_product' || context.isConsumable ? 1 : 0);

  if (inferMasterPlan(normalized)) {
    return 'master_plan';
  }

  if (horizonDays !== null && horizonDays <= 90) {
    return complexityScore >= 3 ? 'short_term_complex' : 'short_term_simple';
  }

  if (horizonDays !== null && horizonDays > 90) {
    return complexityScore >= 2 ? 'long_term_complex' : 'long_term_simple';
  }

  return complexityScore >= 3 ? 'long_term_complex' : 'short_term_complex';
}
