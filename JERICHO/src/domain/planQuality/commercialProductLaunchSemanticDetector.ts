import type { PlanQualityFailureCode } from './planQualityTypes.ts';

type SemanticArtifact = {
  title?: string;
};

type FamilyKey =
  | 'productReadiness'
  | 'commercialReadiness'
  | 'purchasePath'
  | 'launchCommunications'
  | 'firstSalesExecution'
  | 'terminalReview';

type CommercialSemanticCoverage = {
  requiredFamilies: FamilyKey[];
  coveredFamilies: FamilyKey[];
  missingFamilies: FamilyKey[];
  invalidSubstituteFamilies: string[];
  evaluatedArtifacts: number;
};

type CommercialSemanticFinding = {
  failureCodes: PlanQualityFailureCode[];
  coverage: CommercialSemanticCoverage;
};

const REQUIRED_FAMILIES: FamilyKey[] = [
  'productReadiness',
  'commercialReadiness',
  'purchasePath',
  'launchCommunications',
  'firstSalesExecution',
  'terminalReview',
];

const FAMILY_PATTERNS: Record<FamilyKey, RegExp[]> = {
  productReadiness: [
    /\b(product|gum|offer|unit|sku|item)\s+(spec|sample|formula|prototype|readiness|ready|approved|approval)\b/i,
    /\b(spec|sample|formula|prototype|packaging|package|unit|sku|inventory|manufacturing|sellable item)\b/i,
    /\bpackaging\s+(ready|readiness|approved|approval|final|finalized)\b/i,
    /\bsellable\s+(product|item|unit|offer)\b/i,
  ],
  commercialReadiness: [
    /\b(offer|pricing|price|commercial channel|sales channel|product page|sales page|checkout|ordering|fulfillment|payment|store|shop)\b/i,
    /\b(ordering|fulfillment|checkout|payment)\s+(ready|readiness|path|flow|setup|configured)\b/i,
  ],
  purchasePath: [
    /\b(purchase path|checkout|ordering path|order path|payment flow|buy flow|product page|sales page|store|shop)\b/i,
    /\b(buy|purchase|order)\s+(button|page|path|flow|link|route|ready|attempt)\b/i,
  ],
  launchCommunications: [
    /\b(positioning|messaging|launch narrative|visual identity|assets|announcement|cta|call to action|channel profile|campaign copy)\b/i,
    /\b(launch|sales)\s+(message|copy|asset|cta|announcement|campaign)\b/i,
  ],
  firstSalesExecution: [
    /\b(first real sales?|first sales|first sale|first order|initial buyers|initial buyer|first purchase|sales corridor|sales activation)\b/i,
    /\b(sales campaign|buyer outreach|customer outreach|conversion attempt|order attempt|launch to buyers)\b/i,
    /\b(activate|run|execute)\s+.*\b(sales|buyer|buyers|order|purchase|conversion)\b/i,
  ],
  terminalReview: [
    /\b(first-sales evidence|first sales evidence|sales evidence|order evidence|purchase evidence)\b/i,
    /\b(conversion results|sales review|order review|evidence review|decision review|next-step decision|next step decision)\b/i,
    /\b(review|capture|compile)\s+.*\b(sales|orders|purchases|conversion|evidence)\b/i,
  ],
};

const PRODUCT_COMMERCIAL_GOAL_PATTERNS = [
  /\b(caffeinated\s+)?gum\b/i,
  /\b(product|sellable item|consumer product|packaged good|sku)\b/i,
  /\b(first real sales?|first sales|first sale|first order|sales campaign|sell|selling|buyers|purchase|checkout|order|pricing|fulfillment)\b/i,
];

const LAUNCH_GOAL_PATTERNS = [
  /\blaunch\b/i,
  /\bgo[-\s]?to[-\s]?market\b/i,
  /\bcommercial\b/i,
  /\bfirst real sales?\b/i,
  /\bfirst sales\b/i,
];

const INVALID_SUBSTITUTE_PATTERNS = [
  /\bbrand positioning\b/i,
  /\bpositioning\b/i,
  /\bmessaging\b/i,
  /\bvisual identity\b/i,
  /\bbio(s)?\b/i,
  /\bprofile(s)?\b/i,
  /\bchannel profile(s)?\b/i,
  /\blaunch announcement\b/i,
  /\baudience cta\b/i,
  /\bcall to action\b/i,
  /\bassets\b/i,
  /\bnarrative\b/i,
];

function normalizeText(value: unknown) {
  return String(value || '').trim();
}

function matchesAny(patterns: RegExp[], value: string) {
  return patterns.some((pattern) => pattern.test(value));
}

function uniqueStrings(values: string[]) {
  return Array.from(new Set(values));
}

function detectCoveredFamilies(labels: string[]) {
  const coveredFamilies: FamilyKey[] = [];
  REQUIRED_FAMILIES.forEach((family) => {
    if (labels.some((label) => matchesAny(FAMILY_PATTERNS[family], label))) {
      coveredFamilies.push(family);
    }
  });
  return coveredFamilies;
}

function detectInvalidSubstituteFamilies(labels: string[]) {
  return uniqueStrings(
    labels
      .filter((label) => matchesAny(INVALID_SUBSTITUTE_PATTERNS, label))
      .map((label) => {
        if (/\bvisual identity\b/i.test(label)) return 'visualIdentity';
        if (/\blaunch announcement\b/i.test(label)) return 'launchAnnouncement';
        if (/\b(audience cta|call to action)\b/i.test(label)) return 'audienceCta';
        if (/\b(bio|bios|profile|profiles|channel profile|channel profiles)\b/i.test(label)) return 'profiles';
        if (/\b(positioning|messaging|narrative|assets)\b/i.test(label)) return 'brandCommunications';
        return 'brandSupport';
      })
  );
}

export function isCommercialProductLaunchGoal(goalText: string, verificationText: string) {
  const text = `${goalText} ${verificationText}`;
  const hasProductCommercialSignal =
    PRODUCT_COMMERCIAL_GOAL_PATTERNS.filter((pattern) => pattern.test(text)).length >= 2;
  const hasLaunchSignal = matchesAny(LAUNCH_GOAL_PATTERNS, text);
  const hasCommercialCompletionSignal =
    /\b(first real sales?|first sales|first sale|first order|sales campaign|purchase|checkout|order|pricing|sell|selling|buyers)\b/i.test(
      text
    );
  return hasLaunchSignal && hasProductCommercialSignal && hasCommercialCompletionSignal;
}

export function evaluateCommercialProductLaunchSemanticCoverage(input: {
  goalText: string;
  verificationText: string;
  deliverables?: SemanticArtifact[];
  actions?: SemanticArtifact[];
  executionArtifacts?: SemanticArtifact[];
}): CommercialSemanticFinding | null {
  if (!isCommercialProductLaunchGoal(input.goalText, input.verificationText)) {
    return null;
  }

  const labels = [
    ...(input.deliverables || []).map((artifact) => normalizeText(artifact?.title)),
    ...(input.actions || []).map((artifact) => normalizeText(artifact?.title)),
    ...(input.executionArtifacts || []).map((artifact) => normalizeText(artifact?.title)),
  ].filter(Boolean);

  const coveredFamilies = detectCoveredFamilies(labels);
  const missingFamilies = REQUIRED_FAMILIES.filter((family) => !coveredFamilies.includes(family));
  const invalidSubstituteFamilies = detectInvalidSubstituteFamilies(labels);
  const hasBrandSupportDominance =
    invalidSubstituteFamilies.length > 0 &&
    coveredFamilies.includes('launchCommunications') &&
    (!coveredFamilies.includes('productReadiness') ||
      !coveredFamilies.includes('commercialReadiness') ||
      !coveredFamilies.includes('purchasePath') ||
      !coveredFamilies.includes('firstSalesExecution') ||
      !coveredFamilies.includes('terminalReview'));

  const failureCodes = new Set<PlanQualityFailureCode>();
  if (!coveredFamilies.includes('productReadiness')) {
    failureCodes.add('TERMINAL_OBJECT_DRIFT');
  }
  if (!coveredFamilies.includes('commercialReadiness')) {
    failureCodes.add('COMMERCIAL_READINESS_MISSING');
  }
  if (!coveredFamilies.includes('purchasePath')) {
    failureCodes.add('PURCHASE_PATH_MISSING');
  }
  if (!coveredFamilies.includes('firstSalesExecution')) {
    failureCodes.add('FIRST_SALES_CORRIDOR_MISSING');
  }
  if (hasBrandSupportDominance) {
    failureCodes.add('BRAND_LAUNCH_SUBSTITUTED_FOR_PRODUCT_LAUNCH');
  }
  if (!coveredFamilies.includes('terminalReview')) {
    failureCodes.add('TERMINAL_EVENT_EVIDENCE_MISSING');
  }

  if (failureCodes.size === 0) {
    return {
      failureCodes: [],
      coverage: {
        requiredFamilies: REQUIRED_FAMILIES,
        coveredFamilies,
        missingFamilies: [],
        invalidSubstituteFamilies,
        evaluatedArtifacts: labels.length,
      },
    };
  }

  return {
    failureCodes: Array.from(failureCodes),
    coverage: {
      requiredFamilies: REQUIRED_FAMILIES,
      coveredFamilies,
      missingFamilies,
      invalidSubstituteFamilies,
      evaluatedArtifacts: labels.length,
    },
  };
}
