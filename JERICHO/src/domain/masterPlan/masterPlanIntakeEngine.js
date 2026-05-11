import { LANE_DOMAIN, LANE_ROLE, LANE_ACTIVATION_STATE, LANE_ASSESSED_CONFIDENCE } from './masterPlanSchema.js';

// ─── Lane extraction ──────────────────────────────────────────────────────────

const DOMAIN_SIGNALS = {
  [LANE_DOMAIN.CREATIVE]: [
    'album', 'music', 'song', 'track', 'recording', 'studio', 'beat', 'produce', 'producer',
    'art', 'design', 'film', 'video', 'book', 'novel', 'game', 'creative', 'write', 'author',
  ],
  [LANE_DOMAIN.PRODUCT]: [
    'app', 'software', 'saas', 'platform', 'tool', 'product', 'build', 'launch', 'mvp',
    'api', 'startup', 'company', 'service', 'feature', 'ship',
  ],
  [LANE_DOMAIN.BRAND]: [
    'brand', 'identity', 'website', 'presence', 'community', 'audience', 'following',
    'reputation', 'personal brand', 'positioning',
  ],
  [LANE_DOMAIN.INCOME]: [
    'revenue', 'income', 'client', 'freelance', 'consulting', 'sales', 'contract',
    'money', 'pricing', 'offer', 'agency', 'coaching', 'retainer', 'management',
  ],
  [LANE_DOMAIN.MEDIA]: [
    'podcast', 'newsletter', 'blog', 'youtube', 'content', 'post', 'publish',
    'channel', 'social', 'creator', 'subscribers', 'followers', 'stream', 'twitch',
  ],
  [LANE_DOMAIN.CAPITAL]: [
    'real estate', 'property', 'district', 'revitalization', 'development deal', 'building acquisition',
    'capital', 'investor', 'investors', 'fundraising', 'funding', 'asset base', 'acquisition',
  ],
  [LANE_DOMAIN.INSTITUTION]: [
    'school', 'private school', 'franchise', 'curriculum', 'students', 'education', 'academy', 'institution',
  ],
  [LANE_DOMAIN.CIVIC]: [
    'district revitalization', 'revitalization', '79th street', 'corridor', 'neighborhood', 'community development',
    'civic', 'district', 'ward', 'city block',
  ],
  [LANE_DOMAIN.COMPANY]: [
    'company', 'companies', 'holding company', 'operations', 'operational discipline', 'project-management company',
    'execution engine', 'business lines', 'organization', 'team', 'scaling',
  ],
};

const DEFAULT_ROLE_BY_DOMAIN = {
  [LANE_DOMAIN.CREATIVE]: LANE_ROLE.PROOF_ARTIFACT,
  [LANE_DOMAIN.PRODUCT]: LANE_ROLE.REVENUE_ENGINE,
  [LANE_DOMAIN.BRAND]: LANE_ROLE.ATTENTION_ENGINE,
  [LANE_DOMAIN.INCOME]: LANE_ROLE.REVENUE_ENGINE,
  [LANE_DOMAIN.MEDIA]: LANE_ROLE.ATTENTION_ENGINE,
  [LANE_DOMAIN.CAPITAL]: LANE_ROLE.INFRASTRUCTURE,
  [LANE_DOMAIN.INSTITUTION]: LANE_ROLE.INSTITUTION,
  [LANE_DOMAIN.CIVIC]: LANE_ROLE.INFRASTRUCTURE,
  [LANE_DOMAIN.COMPANY]: LANE_ROLE.INFRASTRUCTURE,
};

const DOMAIN_TITLE_LABELS = {
  [LANE_DOMAIN.CREATIVE]: 'Creative project',
  [LANE_DOMAIN.PRODUCT]: 'Product / software',
  [LANE_DOMAIN.BRAND]: 'Brand / presence',
  [LANE_DOMAIN.INCOME]: 'Income stream',
  [LANE_DOMAIN.MEDIA]: 'Media / content',
  [LANE_DOMAIN.CAPITAL]: 'Capital / real estate',
  [LANE_DOMAIN.INSTITUTION]: 'Institution / education',
  [LANE_DOMAIN.CIVIC]: 'Civic / district development',
  [LANE_DOMAIN.COMPANY]: 'Company / operations',
};

const GENERIC_DOMAIN_ROLE_BY_DOMAIN = {
  [LANE_DOMAIN.CREATIVE]: 'creative_release',
  [LANE_DOMAIN.PRODUCT]: 'software_product',
  [LANE_DOMAIN.BRAND]: 'service_business',
  [LANE_DOMAIN.INCOME]: 'income_security',
  [LANE_DOMAIN.MEDIA]: 'media_channel',
  [LANE_DOMAIN.CAPITAL]: 'real_estate_campaign',
  [LANE_DOMAIN.INSTITUTION]: 'education_franchise',
  [LANE_DOMAIN.CIVIC]: 'civic_development',
  [LANE_DOMAIN.COMPANY]: 'company_scaling',
};

const GENERIC_STRATEGIC_ROLE_BY_LANE_ROLE = {
  [LANE_ROLE.PROOF_ARTIFACT]: 'launch_asset',
  [LANE_ROLE.ATTENTION_ENGINE]: 'audience_engine',
  [LANE_ROLE.REVENUE_ENGINE]: 'revenue_engine',
  [LANE_ROLE.LEGITIMACY_WRAPPER]: 'brand_amplifier',
  [LANE_ROLE.INFRASTRUCTURE]: 'execution_engine',
  [LANE_ROLE.INSTITUTION]: 'asset_base',
};

const GENERIC_SUBJECT_BY_DOMAIN_ROLE = {
  software_product: 'the app or software product',
  creative_release: 'the release or creative project',
  media_channel: 'the media lane',
  service_business: 'the brand or service business',
  physical_product: 'the physical product',
  real_estate_campaign: 'the real-estate campaign',
  education_franchise: 'the education offering',
  civic_development: 'the civic or district-development lane',
  company_scaling: 'the company-scaling lane',
  income_security: 'the income or runway lane',
  master_plan_program: 'the master-plan program',
};

const NON_ANSWER_PATTERNS = [
  /\bnot sure\b/,
  /\bdon'?t know\b/,
  /\bdo not know\b/,
  /\bno idea\b/,
  /\bunknown\b/,
  /\bunsure\b/,
  /\btbd\b/,
  /\bn\/a\b/,
  /\bfigure it out later\b/,
];

function isNonAnswerValue(value) {
  if (value == null) {
    return true;
  }
  const text =
    typeof value === 'string'
      ? value
      : typeof value === 'object'
        ? value?.text || value?.answer || value?.notes || ''
        : String(value || '');
  const normalized = String(text || '').trim().toLowerCase();
  if (!normalized) {
    return true;
  }
  return NON_ANSWER_PATTERNS.some((pattern) => pattern.test(normalized));
}

function inferEntityType(domain, title = '') {
  const lower = String(title || '').toLowerCase();
  if (domain === LANE_DOMAIN.PRODUCT || /\bapp|software|platform|tool|saas\b/.test(lower)) return 'app';
  if (domain === LANE_DOMAIN.CREATIVE || /\balbum|ep|song|record|release\b/.test(lower)) return 'album';
  if (domain === LANE_DOMAIN.MEDIA || /\bpodcast|channel|show|newsletter|blog\b/.test(lower)) return 'podcast';
  if (domain === LANE_DOMAIN.BRAND || /\bbrand|company|agency|studio|service\b/.test(lower)) return 'brand';
  if (domain === LANE_DOMAIN.INCOME || /\bincome|runway|revenue|job|cash\b/.test(lower)) return 'business_line';
  if (domain === LANE_DOMAIN.CAPITAL || /\breal estate|property|building|district\b/.test(lower)) return 'business_line';
  if (domain === LANE_DOMAIN.INSTITUTION || /\bschool|academy|curriculum|education\b/.test(lower)) return 'business_line';
  if (domain === LANE_DOMAIN.CIVIC || /\bdistrict|revitalization|community development|corridor\b/.test(lower)) return 'campaign';
  if (domain === LANE_DOMAIN.COMPANY || /\bcompany|operations|holding company|business lines\b/.test(lower)) return 'company';
  return 'campaign';
}

function looksLikeGenericLaneTitle(domain, title = '') {
  const normalized = String(title || '').trim().toLowerCase();
  if (!normalized) {
    return true;
  }
  const defaultLabel = String(DOMAIN_TITLE_LABELS[domain] || '')
    .trim()
    .toLowerCase();
  if (normalized === defaultLabel) {
    return true;
  }
  const genericPatterns = {
    [LANE_DOMAIN.CREATIVE]: /^(creative project|album rollout|release lane|music lane)$/,
    [LANE_DOMAIN.PRODUCT]: /^(product \/ software|app launch|product lane|software lane)$/,
    [LANE_DOMAIN.BRAND]: /^(brand \/ presence|brand lane|service lane|pm brand)$/,
    [LANE_DOMAIN.INCOME]: /^(income stream|income lane|runway lane)$/,
    [LANE_DOMAIN.MEDIA]: /^(media \/ content|podcast rollout|media lane|content lane)$/,
    [LANE_DOMAIN.CAPITAL]: /^(capital \/ real estate|real-estate lane|capital lane)$/,
    [LANE_DOMAIN.INSTITUTION]: /^(institution \/ education|education lane|school lane)$/,
    [LANE_DOMAIN.CIVIC]: /^(civic \/ district development|district lane|civic lane)$/,
    [LANE_DOMAIN.COMPANY]: /^(company \/ operations|company lane|operations lane)$/,
  };
  return genericPatterns[domain]?.test(normalized) ?? false;
}

function normalizeExtractedEntityContext(lane = {}) {
  const domain = String(lane?.domain || '').trim().toLowerCase();
  const rawName =
    typeof lane?.rawName === 'string' && lane.rawName.trim()
      ? lane.rawName.trim()
      : typeof lane?.title === 'string' && lane.title.trim() && !looksLikeGenericLaneTitle(domain, lane.title)
        ? lane.title.trim()
        : '';
  const domainRole = lane?.domainRole || GENERIC_DOMAIN_ROLE_BY_DOMAIN[domain] || domain || 'unknown';
  const strategicRole =
    lane?.strategicRole ||
    GENERIC_STRATEGIC_ROLE_BY_LANE_ROLE[lane?.role] ||
    lane?.role ||
    'support_constraint';
  const entityType = lane?.entityType || inferEntityType(domain, rawName || lane?.title || '');
  return {
    entityId: lane?.entityId || lane?.id || null,
    rawName,
    entityType,
    domainRole,
    strategicRole,
    genericSubject: GENERIC_SUBJECT_BY_DOMAIN_ROLE[domainRole] || 'this lane',
  };
}

function formatEntitySubject(entity, options = {}) {
  const fallback = options?.fallback || entity?.genericSubject || 'this lane';
  if (entity?.rawName) {
    return entity.rawName;
  }
  return fallback;
}

/**
 * Rule-based lane extraction from free-text description.
 * Returns an ordered list of lane candidates — highest signal score first.
 * The AI-powered version replaces this function without changing its contract.
 */
export function extractLanesFromDescription(text) {
  if (!text || typeof text !== 'string') return [];

  const lower = text.toLowerCase();
  const scores = {};

  for (const [domain, signals] of Object.entries(DOMAIN_SIGNALS)) {
    let score = 0;
    const matched = [];
    for (const signal of signals) {
      if (lower.includes(signal)) {
        score += 1;
        matched.push(signal);
      }
    }
    if (score > 0) {
      scores[domain] = { score, matched };
    }
  }

  return Object.entries(scores)
    .sort((a, b) => b[1].score - a[1].score)
    .map(([domain, { score, matched }]) => ({
      domain,
      title: DOMAIN_TITLE_LABELS[domain],
      role: DEFAULT_ROLE_BY_DOMAIN[domain],
      confidence: score >= 3 ? LANE_ASSESSED_CONFIDENCE.HIGH : score >= 2 ? LANE_ASSESSED_CONFIDENCE.MEDIUM : LANE_ASSESSED_CONFIDENCE.LOW,
      sourceTerms: matched,
      assessedStage: '',
    }));
}

// ─── Anchor parsing ───────────────────────────────────────────────────────────

const MONTH_MAP = {
  jan: 0, january: 0,
  feb: 1, february: 1,
  mar: 2, march: 2,
  apr: 3, april: 3,
  may: 4,
  jun: 5, june: 5,
  jul: 6, july: 6,
  aug: 7, august: 7,
  sep: 8, september: 8,
  oct: 9, october: 9,
  nov: 10, november: 10,
  dec: 11, december: 11,
};

const FIXED_SIGNALS = [
  'conference', 'festival', 'deadline', 'due date', 'drops', 'drop', 'airs',
  'premiere', 'cutoff', 'release date', 'submission', 'ceremony', 'event',
];

const INTERNAL_SIGNALS = [
  'want to', 'plan to', 'aim to', 'hope to', 'goal is', 'should be',
  'intend to', 'trying to', 'would like',
];

function toISODate(year, month, day) {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function detectIsFixed(text) {
  const lower = text.toLowerCase();
  if (FIXED_SIGNALS.some((s) => lower.includes(s))) return true;
  if (INTERNAL_SIGNALS.some((s) => lower.includes(s))) return false;
  return true; // default: treat named dates as fixed
}

/**
 * Parses a natural-language anchor description into a structured anchor.
 * referenceISO is today's date (ISO string) for relative date resolution.
 * Returns null if no recognizable date pattern is found.
 */
export function parseAnchorFromInput(text, referenceISO) {
  if (!text || typeof text !== 'string') return null;

  const lower = text.toLowerCase().trim();
  const ref = referenceISO ? new Date(referenceISO) : new Date();
  const refYear = ref.getFullYear();
  const refMonth = ref.getMonth();

  const isFixed = detectIsFixed(text);

  // "Month Day" — e.g. "October 17", "Oct 17"
  const monthDayMatch = lower.match(
    /\b(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s+(\d{1,2})(?:st|nd|rd|th)?\b/
  );
  if (monthDayMatch) {
    const month = MONTH_MAP[monthDayMatch[1].slice(0, 3)];
    const day = parseInt(monthDayMatch[2], 10);
    // Use next occurrence of this month/day
    let year = refYear;
    if (month < refMonth || (month === refMonth && day < ref.getDate())) {
      year += 1;
    }
    return { date: toISODate(year, month, day), label: text.trim(), isFixed };
  }

  // "Month" only — e.g. "October", "Next November" — use last day of that month
  const monthOnlyMatch = lower.match(
    /\b(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\b/
  );
  if (monthOnlyMatch) {
    const month = MONTH_MAP[monthOnlyMatch[1].slice(0, 3)];
    let year = refYear;
    if (month <= refMonth) year += 1;
    const lastDay = new Date(year, month + 1, 0).getDate();
    return { date: toISODate(year, month, lastDay), label: text.trim(), isFixed };
  }

  // Quarter — Q1/Q2/Q3/Q4
  const quarterMatch = lower.match(/\bq([1-4])\b/);
  if (quarterMatch) {
    const q = parseInt(quarterMatch[1], 10);
    const quarterEndMonths = [2, 5, 8, 11]; // Mar, Jun, Sep, Dec (0-indexed)
    const month = quarterEndMonths[q - 1];
    let year = refYear;
    if (month < refMonth) year += 1;
    const lastDay = new Date(year, month + 1, 0).getDate();
    return { date: toISODate(year, month, lastDay), label: text.trim(), isFixed: false };
  }

  // "End of year" / "EOY"
  if (lower.includes('end of year') || lower.includes('eoy') || lower.includes('year end')) {
    return { date: toISODate(refYear + (refMonth >= 11 ? 1 : 0), 11, 31), label: text.trim(), isFixed: false };
  }

  // "Next year"
  if (lower.includes('next year')) {
    return { date: toISODate(refYear + 1, 0, 1), label: text.trim(), isFixed: false };
  }

  // "Summer"
  if (lower.includes('summer')) {
    const year = refMonth >= 8 ? refYear + 1 : refYear;
    return { date: toISODate(year, 5, 21), label: text.trim(), isFixed: false };
  }

  // "Fall" / "Autumn"
  if (lower.includes('fall') || lower.includes('autumn')) {
    const year = refMonth >= 11 ? refYear + 1 : refYear;
    return { date: toISODate(year, 8, 22), label: text.trim(), isFixed: false };
  }

  return null;
}

// ─── Horizon suggestion ───────────────────────────────────────────────────────

/**
 * Infers a multi-year planning horizon from goal text.
 * Returns { years, months } if a clear multi-year signal is found, null otherwise.
 * Does NOT fall back to anchors — that's handled by suggestHorizonFromAnchors.
 */
export function inferHorizonYearsFromText(goalText) {
  const lower = String(goalText || '').toLowerCase();

  // Numeric year patterns: "5-year", "5 year", "5yr"
  const numericMatch = lower.match(/\b(\d+)[- ]?(?:yr|year)s?\b/);
  if (numericMatch) {
    const years = parseInt(numericMatch[1], 10);
    if (years >= 2 && years <= 20) return { years, months: years * 12 };
  }

  // Word-form year patterns
  const wordYears = { two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10 };
  for (const [word, years] of Object.entries(wordYears)) {
    if (new RegExp(`\\b${word}[- ]year\\b`).test(lower)) {
      return { years, months: years * 12 };
    }
  }

  // Multi-year / long-horizon signals without explicit count → 3 years minimum
  if (/\bmulti[- ]year\b|\blong[- ]horizon\b|\blong[- ]term vision\b|\bdecade\b/.test(lower)) {
    return { years: 3, months: 36 };
  }

  return null;
}

/**
 * Suggests a plan horizon, preferring multi-year signals in goal text over
 * anchor-based suggestions. Use this for the step-3 default in intake.
 */
export function suggestPlanHorizon(goalText, anchors, nowISO) {
  const now = nowISO ? new Date(nowISO) : new Date();
  const inferred = inferHorizonYearsFromText(goalText);

  if (inferred) {
    const end = new Date(now);
    end.setMonth(end.getMonth() + inferred.months);
    // If there are anchors, include the first one as a reference label
    const sorted = anchors && anchors.length > 0
      ? [...anchors].sort((a, b) => (a.date > b.date ? 1 : -1))
      : [];
    const firstAnchor = sorted[0] || null;
    return {
      horizonEnd: end.toISOString().slice(0, 10),
      months: inferred.months,
      years: inferred.years,
      label: firstAnchor ? firstAnchor.label : `${inferred.years}-year horizon`,
      source: 'goal_text',
    };
  }

  return suggestHorizonFromAnchors(anchors, nowISO);
}

/**
 * Suggests a horizon end date based on the latest anchor plus a buffer.
 * Returns null if no anchors exist.
 */
export function suggestHorizonFromAnchors(anchors, nowISO) {
  if (!anchors || anchors.length === 0) return null;

  const sorted = [...anchors].sort((a, b) => (a.date > b.date ? 1 : -1));
  const latest = sorted[sorted.length - 1];

  const end = new Date(latest.date);
  end.setDate(end.getDate() + 14); // 2-week buffer past the last anchor

  const now = nowISO ? new Date(nowISO) : new Date();
  const diffMs = end.getTime() - now.getTime();
  const months = Math.round(diffMs / (1000 * 60 * 60 * 24 * 30));

  return {
    horizonEnd: end.toISOString().slice(0, 10),
    months,
    label: latest.label,
    source: 'anchor',
  };
}

// ─── Lane assessment ──────────────────────────────────────────────────────────

const STAGE_PATTERNS = {
  'pre-concept': [
    /\bidea(s)?\b/,
    /\bthinking about\b/,
    /\bwant to\b/,
    /\bplan(?:ning)? to\b/,
    /\bsomeday\b/,
    /\beventually\b/,
    /\bnot started\b/,
    /\bhaven'?t started\b/,
    /\bhave not started\b/,
    /\bno progress\b/,
    /\bconcept(?:ual)?\b/,
    /\bexplor(?:ing|ation)\b/,
    /\bconsider(?:ing|ation)\b/,
    /\bgoing to\b/,
  ],
  'in-development': [
    /\bworking on\b/,
    /\bin progress\b/,
    /\bbuild(?:ing|t)?\b/,
    /\bdevelop(?:ing|ment|ed)?\b/,
    /\bstarted\b/,
    /\bpartially\b/,
    /\bdraft\b/,
    /\bin development\b/,
    /\bunderway\b/,
    /\bmonths? into\b/,
    /\bin the works\b/,
    /\bstill build(?:ing)?\b/,
    /\bcoding\b/,
    /\bwriting\b/,
    /\brecord(?:ing|ed)\b/,
    /\bproduc(?:ing|ed)\b/,
    /\bincomplete\b/,
    /\barchitecture\b/,
    /\bworking\b/,
    /\bunder construction\b/,
    /\bin process\b/,
    /\bcore architecture\b/,
    /\bprototype\b/,
    /\bbeta\b/,
    /\bsubmitted\b/,
  ],
  'near-complete': [
    /\balmost\b/,
    /\bnearly\b/,
    /\bfinishing\b/,
    /\balmost done\b/,
    /\bwrapping up\b/,
    /\bclose to\b/,
    /\bnearly done\b/,
    /\bfinal touches\b/,
    /\balmost finished\b/,
    /\bclose to done\b/,
    /\bfinal stage\b/,
    /\bfinal step\b/,
    /\bmostly done\b/,
    /\bmostly complete\b/,
    /\bnearly complete\b/,
    /\bjust about\b/,
    /\bclose to launch(?:ing)?\b/,
    /\bpolishing\b/,
    /\blast steps?\b/,
  ],
  'ready-to-launch': [
    /\bdone\b/,
    /\bfinished\b/,
    /\bcomplete(?:d)?\b/,
    /\bready\b/,
    /\bwaiting to release\b/,
    /\bbuilt\b/,
    /\bready for\b/,
    /\bready to\b/,
    /\bprepared\b/,
    /\bmix(?:ed)?\b/,
    /\bmaster(?:ed)?\b/,
    /\bdistribution ready\b/,
    /\bproduction complete\b/,
    /\bwaiting on\b/,
    /\bready to ship\b/,
    /\bfully built\b/,
    /\bfully written\b/,
    /\bsubmitted for\b/,
    /\bawaiting\b/,
    /\bjust needs\b/,
    /\bonly needs\b/,
    /\brelease package\b/,
  ],
  'active': [
    /\blive\b/,
    /\blaunched\b/,
    /\brunning\b/,
    /\boperating\b/,
    /\bin market\b/,
    /\bselling\b/,
    /\bshipping\b/,
    /\bdeployed\b/,
    /\bpublished\b/,
    /\breleased\b/,
    /\bon air\b/,
    /\bstreaming\b/,
    /\bgenerating revenue\b/,
    /\bactive\b/,
    /\bin production\b/,
    /\bin rotation\b/,
    /\bcurrently running\b/,
    /\brelaunching\b/,
    /\balready launched\b/,
    /\balready live\b/,
    /\bexisting\b/,
    /\brevenue\b/,
    /\bclients?\b/,
  ],
};

function countPatternMatches(text, patterns = []) {
  return patterns.reduce((count, pattern) => count + (pattern.test(text) ? 1 : 0), 0);
}

/**
 * Derives a lane stage assessment from user description and clarifying answers.
 * Returns { assessedStage, assessedConfidence, assessmentNotes }.
 */
export function assessLaneFromAnswers(domain, description, clarifyingAnswers = []) {
  const allText = [description, ...clarifyingAnswers.map((a) => (typeof a === 'string' ? a : a?.text || ''))]
    .join(' ')
    .toLowerCase();

  let bestStage = 'pre-concept';
  let bestScore = 0;

  for (const [stage, patterns] of Object.entries(STAGE_PATTERNS)) {
    const score = countPatternMatches(allText, patterns);
    if (score > bestScore) {
      bestScore = score;
      bestStage = stage;
    }
  }

  const confidence =
    bestScore >= 3 ? LANE_ASSESSED_CONFIDENCE.HIGH :
    bestScore >= 1 ? LANE_ASSESSED_CONFIDENCE.MEDIUM :
    LANE_ASSESSED_CONFIDENCE.LOW;

  const stageLabels = {
    'pre-concept': 'not yet started',
    'in-development': 'actively in development',
    'near-complete': 'near completion',
    'ready-to-launch': 'built and ready to launch',
    'active': 'live and operating',
  };

  return {
    assessedStage: bestStage,
    assessedConfidence: confidence,
    assessmentNotes: `Language suggests this lane is ${stageLabels[bestStage] || bestStage}.`,
  };
}

// ─── Clarifying questions ─────────────────────────────────────────────────────

function buildDiagnosticPrompt(header, prompts = []) {
  const lines = [header, ...prompts.map((prompt) => `- ${prompt}`)].filter(Boolean);
  return lines.join('\n');
}

function buildDiagnosticQuestion({
  id,
  question,
  reason,
  whyNeeded = '',
  examples = [],
  fallbackBehavior = '',
  domain,
  laneId = null,
  laneTitle = '',
  resolvesField,
  affects = [],
  criticality,
  canDefer = false,
  answerType,
  reasonCode,
  derives = [],
  priority = 0,
}) {
  return {
    id,
    question,
    reason,
    whyNeeded: whyNeeded || reason,
    examples: Array.isArray(examples) ? examples : [],
    fallbackBehavior:
      fallbackBehavior ||
      'If you are not sure, Jericho will carry this as assumption debt and turn it into clarification work later.',
    domain,
    laneId,
    laneTitle,
    resolvesField,
    affects: Array.isArray(affects) ? affects : [],
    criticality,
    canDefer: Boolean(canDefer),
    answerType,
    reasonCode,
    diagnosticMode: true,
    derives,
    priority,
  };
}

const DOMAIN_QUESTION_TEMPLATES = {
  creative_release: {
    question: (entity) =>
      buildDiagnosticPrompt(`Which ${formatEntitySubject(entity, { fallback: 'album or release' })} assets already exist right now?`, [
      'Do you already have final masters, artwork, distribution setup, release copy, or promo assets?',
      'What is still missing before the release can count as real?',
      'What depends on someone else approving, delivering, or shipping something first?',
      ]),
    reason:
      'Masters, artwork, distribution setup, and promo assets determine whether this lane is launch-ready or still in production.',
    whyNeeded: 'This changes launch readiness, sequencing, and external dependency risk for the release lane.',
    resolvesField: 'creative.releaseAssets',
    affects: ['feasibility', 'sequence', 'schedule', 'risk'],
    criticality: 'high',
    canDefer: false,
    answerType: 'textarea',
    reasonCode: 'STRUCTURE_CREATIVE_ASSET_STATE_UNRESOLVED',
    derives: ['operational_readiness', 'launch_readiness', 'external_dependency', 'IP_risk'],
    examples: [
      'Final masters are done, artwork is not, distribution is not set up yet, and promo assets still need to be made.',
      'Only demo tracks exist right now. Nothing is release-ready yet.',
    ],
    fallbackBehavior:
      'If you are unsure, list only what definitely exists. Jericho will assume missing assets are unresolved until proven otherwise.',
  },
  software_product: {
    question: (entity) =>
      buildDiagnosticPrompt(
        `Answer with the observable launch facts that are true right now for ${formatEntitySubject(entity, { fallback: 'the app or software product' })}.`,
        [
      'Is there a working local version?',
      'Is there a deployed URL someone else can access?',
      'Can a new user complete the main flow without your help?',
      'Does the app persist user progress after refresh?',
      'Are there known broken screens or blocked flows?',
      'Has anyone besides you tested it?',
      'What must work for the app to count as launchable?',
        ]
      ),
    reason:
      'Product readiness determines whether the anchor can support a real launch or only a beta, proof, or readiness gate.',
    whyNeeded: 'This changes feasibility, sequence, schedule density, and launch-risk posture for the product lane.',
    resolvesField: 'product.launchReadiness',
    affects: ['feasibility', 'sequence', 'schedule', 'risk'],
    criticality: 'high',
    canDefer: false,
    answerType: 'textarea',
    reasonCode: 'STRUCTURE_PRODUCT_LAUNCH_READINESS_UNRESOLVED',
    derives: ['app_readiness', 'operational_readiness', 'launch_readiness', 'privacy_risk', 'revenue_model'],
    examples: [
      'Working local build exists, no deployed URL yet, main flow is incomplete, and nobody else has tested it.',
      'Deployed beta exists, a new user can sign up, but progress does not persist after refresh.',
    ],
    fallbackBehavior:
      'If you are unsure, answer with the launch facts you can observe directly. Jericho will treat the rest as unproven.',
  },
  service_business: {
    question: (entity) =>
      buildDiagnosticPrompt(`What proof of offer already exists for ${formatEntitySubject(entity, { fallback: 'this brand or service lane' })}?`, [
      'Do you already have a public page, case study, clear offer, sample work, or outreach list?',
      'Has anyone seen, tested, or paid for this offer yet?',
      'What must exist before outreach can count as real client-facing progress?',
      ]),
    reason:
      'Positioning, offer clarity, and proof determine whether this lane should be scheduled for client-facing progress or still treated as setup.',
    whyNeeded: 'This changes sequencing and near-term schedule readiness, but can defer into first-cycle clarification if needed.',
    resolvesField: 'brand.offerProofState',
    affects: ['sequence', 'schedule', 'risk'],
    criticality: 'medium',
    canDefer: true,
    answerType: 'textarea',
    reasonCode: 'STRUCTURE_BRAND_OFFER_PROOF_UNRESOLVED',
    derives: ['operational_readiness', 'launch_readiness', 'revenue_model'],
    examples: [
      'The offer exists as a draft, there is no public page yet, and no client has seen it.',
      'Case studies and a landing page exist, but outreach has not started.',
    ],
    fallbackBehavior:
      'If you are unsure, describe the clearest proof that already exists. Missing proof will stay as setup work.',
  },
  income_security: {
    question: () =>
      buildDiagnosticPrompt('What real income path exists in the next 8 weeks?', [
      'What offer, client path, sale, or cash source already exists?',
      'What is only an idea versus already reachable?',
      'What external approvals, buyers, replies, or conversions must happen first?',
      ]),
    reason:
      'Runway pressure changes sequencing, capacity, and whether income work must override lower-consequence campaigns.',
    whyNeeded: 'This changes feasibility, schedule pressure, and tradeoff rules across the master calendar.',
    resolvesField: 'income.runwayPressure',
    affects: ['feasibility', 'schedule', 'risk', 'tradeoff', 'mission_continuity'],
    criticality: 'high',
    canDefer: false,
    answerType: 'textarea',
    reasonCode: 'STRUCTURE_RUNWAY_PRESSURE_UNRESOLVED',
    derives: ['revenue_model', 'external_dependency', 'capacity_constraint'],
    examples: [
      'No cash engine exists yet, job search is urgent, and interviews may consume several mornings each week.',
      'One client path exists, but no signed work or incoming cash is confirmed yet.',
    ],
    fallbackBehavior:
      'If you are unsure, describe the nearest real cash path and any known burden on your time. Jericho will assume uncertainty is pressure.',
  },
  media_channel: {
    question: (entity) =>
      buildDiagnosticPrompt(`How does ${formatEntitySubject(entity, { fallback: 'this media lane' })} actually function in the plan?`, [
      'Is it supporting the album, the product, both, or standing alone?',
      'What content already exists?',
      'What must be published before this lane counts as active support instead of setup?',
      ]),
    reason:
      'This determines whether media work belongs in the integrated launch cluster or should be scheduled as an independent lane.',
    whyNeeded: 'This changes sequencing, strategic integration, and first-cycle schedule placement for the media lane.',
    resolvesField: 'media.supportRole',
    affects: ['sequence', 'schedule', 'risk'],
    criticality: 'high',
    canDefer: false,
    answerType: 'text',
    reasonCode: 'STRUCTURE_MEDIA_ROLE_UNRESOLVED',
    derives: ['operational_readiness', 'launch_readiness', 'external_dependency'],
    examples: [
      'The podcast is mainly supporting the album launch and app awareness.',
      'This media lane stands alone for audience growth and does not need to hit the main launch date.',
    ],
    fallbackBehavior:
      'If you are unsure, say which lane it supports most right now. Jericho can revise the integration later.',
  },
};

function buildLaneQuestion(domain, lane, laneIdx) {
  const entity = normalizeExtractedEntityContext(lane);
  const template = DOMAIN_QUESTION_TEMPLATES[entity.domainRole] || DOMAIN_QUESTION_TEMPLATES[domain];
  if (!template) {
    return {
      id: `lane-${laneIdx}-generic-context`,
      question: `What is the key missing context for ${formatEntitySubject(entity)}?`,
      reason: 'The system needs one concrete context signal to avoid sequencing this lane by assumption.',
      whyNeeded: 'This changes sequence and schedule trust for the lane.',
      domain: domain || 'unknown',
      laneId: lane?.id || null,
      laneTitle: lane?.title || '',
      resolvesField: `${domain || 'unknown'}.context`,
      affects: ['sequence', 'schedule'],
      criticality: 'medium',
      canDefer: true,
      answerType: 'textarea',
      reasonCode: 'STRUCTURE_LANE_CONTEXT_UNRESOLVED',
      diagnosticMode: true,
      derives: ['operational_readiness'],
      examples: ['Only the concept exists right now.', 'One draft asset exists, but external dependency is still unresolved.'],
      fallbackBehavior:
        'If you are unsure, describe the most concrete thing that already exists. Jericho will treat the rest as unknown.',
    };
  }
  return buildDiagnosticQuestion({
    id: `lane-${laneIdx}-${domain}-primary`,
    question: typeof template.question === 'function' ? template.question(entity) : template.question,
    reason: template.reason,
    whyNeeded: template.whyNeeded,
    domain,
    laneId: lane?.id || null,
    laneTitle: lane?.title || '',
    resolvesField: template.resolvesField,
    affects: template.affects || [],
    criticality: template.criticality,
    canDefer: Boolean(template.canDefer),
    answerType: template.answerType,
    reasonCode: template.reasonCode,
    derives: template.derives || [],
  });
}

function extractJobSearchSignal(goalText = '') {
  const normalized = String(goalText || '').toLowerCase();
  return /\b(job search|job-search|interview|apply(?:ing)? for jobs?|employment|full[- ]time job|part[- ]time job)\b/.test(
    normalized
  );
}

function buildGlobalQuestionPool({ goalText = '', extractedLanes = [], anchors = [] } = {}) {
  const domains = new Set(
    (Array.isArray(extractedLanes) ? extractedLanes : [])
      .map((lane) =>
        String(lane?.domain || '')
          .trim()
          .toLowerCase()
      )
      .filter(Boolean)
  );
  const goalTextValue = String(goalText || '').trim();
  const legalExposureLikely =
    domains.has('product') ||
    domains.has('creative') ||
    domains.has('income') ||
    /\b(payment|sell|subscription|customer|client|label|app|software|data|music|sample|trademark|copyright|contractor|partner|investor|revenue split|real estate|food|education|healthcare|finance|child|children)\b/i.test(
      goalTextValue
    );
  const questions = [
    buildDiagnosticQuestion({
      id: 'global-weekly-capacity',
      question: buildDiagnosticPrompt('What real calendar capacity exists across all active goals in the next 2–4 weeks?', [
        'How many hours per week can you realistically allocate?',
        'What recurring job search, interview, family, health, or admin burden already consumes that time?',
        'What would make the calendar unusable even if the strategy is sound?',
      ]),
      reason: 'The master calendar cannot generate a credible first cycle without user-level capacity.',
      whyNeeded: 'This changes feasibility, schedule density, and capacity-conflict handling.',
      domain: 'master_calendar_capacity',
      resolvesField: 'masterCalendar.weeklyCapacityHours',
      affects: ['feasibility', 'schedule', 'risk'],
      criticality: 'high',
      canDefer: false,
      answerType: 'textarea',
      reasonCode: 'STRUCTURE_WEEKLY_CAPACITY_UNRESOLVED',
      derives: ['capacity_constraint', 'external_dependency'],
      priority: 100,
      examples: [
        'I can commit about 20 real hours per week, but interviews can wipe out 6 to 8 of them.',
        'I have 12 focused hours per week and two nights are consistently unavailable.',
      ],
      fallbackBehavior:
        'If you are unsure, give your safest realistic lower-bound. Jericho will schedule conservatively and carry the rest as uncertainty.',
    }),
    buildDiagnosticQuestion({
      id: 'global-constraint-diagnostics',
      question: buildDiagnosticPrompt('What real constraints or protections apply before the system can trust the route?', [
        'What budget or runway pressure must the plan respect in the next 8 weeks?',
        'Is job search or income protection part of the strategy, or only calendar burden?',
        'What cannot be sacrificed if timing slips?',
      ]),
      reason:
        'Runway pressure, job-search burden, and non-negotiables determine what the calendar can absorb without breaking mission continuity.',
      whyNeeded: 'This changes schedule pressure, tradeoff rules, and mission continuity under entropy.',
      domain: 'profile_constraints',
      resolvesField: 'profile.constraintPosture',
      affects: ['schedule', 'risk', 'tradeoff', 'mission_continuity'],
      criticality: 'high',
      canDefer: false,
      answerType: 'textarea',
      reasonCode: 'STRUCTURE_CONSTRAINT_POSTURE_UNRESOLVED',
      derives: ['capacity_constraint', 'revenue_model', 'external_dependency'],
      priority: extractJobSearchSignal(goalTextValue) || domains.has('income') ? 96 : 89,
      examples: [
        'Job search is only income security, runway is tight, and creative control cannot be sacrificed.',
        'Income pressure is moderate, but the app launch date matters more than the podcast timing.',
      ],
      fallbackBehavior:
        'If you are unsure, name the pressure that is most likely to force a tradeoff. Jericho will treat the rest as open assumptions.',
    }),
    buildDiagnosticQuestion({
      id: 'global-legal-diagnostics',
      question: buildDiagnosticPrompt('Which of these concrete legal or compliance conditions apply?', [
        'Will you collect payments?',
        'Will you collect user data or sensitive personal information?',
        'Will you sell an ingestible, wearable, physical, regulated, or child-facing product?',
        'Will you use copyrighted music, samples, images, trademarks, likenesses, or third-party content?',
        'Will you use contractors, partners, investors, revenue splits, or employees?',
        'Will the product make health, financial, educational, employment, safety, or performance claims?',
        'Will real estate, schooling, food, finance, healthcare, or children be involved?',
      ]),
      reason:
        'Observable legal exposure signals let the system derive compliance, privacy, IP, and contract risk without asking you to self-diagnose them.',
      whyNeeded: 'This changes feasibility, sequence, and risk gating where legal or compliance work must happen first.',
      domain: 'legal_exposure',
      resolvesField: 'profile.legalExposure',
      affects: ['feasibility', 'sequence', 'risk'],
      criticality: 'high',
      canDefer: false,
      answerType: 'textarea',
      reasonCode: 'STRUCTURE_LEGAL_EXPOSURE_UNRESOLVED',
      derives: ['legal_exposure', 'product_compliance', 'privacy_risk', 'IP_risk', 'revenue_model'],
      priority: legalExposureLikely ? 94 : 20,
      examples: [
        'We will collect payments and user data, and the app stores progress.',
        'The plan involves copyrighted music, revenue splits, and education-related work later.',
      ],
      fallbackBehavior:
        'If you are unsure, answer only with conditions you know are true. Jericho will carry the rest as legal/compliance uncertainty.',
    }),
    {
      id: 'global-non-negotiables',
      question: 'What cannot be sacrificed if timing slips?',
      reason: 'Non-negotiables determine correction behavior under entropy and keep tactical pivots from erasing the mission.',
      whyNeeded: 'This changes tradeoff rules and mission continuity when pressure forces route adjustment.',
      domain: 'core_mission',
      laneId: null,
      resolvesField: 'mission.nonNegotiables',
      affects: ['tradeoff', 'mission_continuity'],
      criticality: 'medium',
      canDefer: true,
      answerType: 'textarea',
      reasonCode: 'STRUCTURE_NON_NEGOTIABLES_UNRESOLVED',
      priority: 90,
      examples: [
        'Ownership and creative control cannot be sacrificed.',
        'Income security can flex, but the company mission cannot be replaced by short-term survival work.',
      ],
      fallbackBehavior:
        'If you are unsure, state the one thing that must stay intact under pressure. Jericho will treat everything else as flexible until clarified.',
    },
  ];
  if (Array.isArray(anchors) && anchors.length > 0) {
    questions.push({
      id: 'global-anchor-confirmation',
      question: 'What must stay true for the hard anchor dates to remain real?',
      reason: 'Hard anchors only help if the system knows what cannot slip before them.',
      whyNeeded: 'This changes sequence and schedule pressure around hard anchors.',
      domain: 'anchors',
      laneId: null,
      resolvesField: 'anchors.nonNegotiablePrerequisites',
      affects: ['sequence', 'schedule', 'risk'],
      criticality: 'medium',
      canDefer: true,
      answerType: 'textarea',
      reasonCode: 'STRUCTURE_ANCHOR_PREREQUISITES_UNRESOLVED',
      priority: 88,
      examples: [
        'The album masters, app main flow, and podcast launch assets must all be real before the anchor can count as live.',
        'The anchor can slip for media support work, but not for the product launch.',
      ],
      fallbackBehavior:
        'If you are unsure, name the prerequisite you trust least. Jericho will treat the rest as provisional anchor risk.',
    });
  }
  return questions.sort((left, right) => Number(right.priority || 0) - Number(left.priority || 0));
}

function shouldAskDuringStructure(question) {
  const criticality = String(question?.criticality || '').trim().toLowerCase();
  return criticality === 'blocker' || criticality === 'high' || !question?.canDefer;
}

export function buildStructureQuestionPlan({ goalText = '', extractedLanes = [], anchors = [] } = {}) {
  const globalQuestionPool = buildGlobalQuestionPool({ goalText, extractedLanes, anchors });
  const globalQuestions = globalQuestionPool.filter(shouldAskDuringStructure).slice(0, 2);
  const deferredGlobalQuestions = globalQuestionPool.filter((question) => !shouldAskDuringStructure(question));
  const laneQuestionsByLaneIndex = {};
  const deferredLaneQuestionsByLaneIndex = {};
  (Array.isArray(extractedLanes) ? extractedLanes : []).forEach((lane, laneIdx) => {
    const laneQuestion = buildLaneQuestion(String(lane?.domain || '').trim().toLowerCase(), lane, laneIdx);
    laneQuestionsByLaneIndex[laneIdx] = shouldAskDuringStructure(laneQuestion) ? [laneQuestion] : [];
    deferredLaneQuestionsByLaneIndex[laneIdx] = shouldAskDuringStructure(laneQuestion) ? [] : [laneQuestion];
  });
  return {
    globalQuestions,
    deferredGlobalQuestions,
    laneQuestionsByLaneIndex,
    deferredLaneQuestionsByLaneIndex,
    selectedQuestionCount:
      globalQuestions.length +
      Object.values(laneQuestionsByLaneIndex).reduce(
        (count, questions) => count + (Array.isArray(questions) ? questions.length : 0),
        0
      ),
    deferredQuestionCount:
      deferredGlobalQuestions.length +
      Object.values(deferredLaneQuestionsByLaneIndex).reduce(
        (count, questions) => count + (Array.isArray(questions) ? questions.length : 0),
        0
      ),
  };
}

/**
 * Returns the clarifying questions for a given domain.
 * Always returns an array; unknown domains get generic questions.
 */
export function getClarifyingQuestionsForDomain(domain, options = {}) {
  const lane = options?.lane || null;
  const laneIdx = Number.isFinite(Number(options?.laneIdx)) ? Number(options.laneIdx) : 0;
  return [buildLaneQuestion(String(domain || '').trim().toLowerCase(), lane, laneIdx)];
}

export function getPlannedGlobalQuestions(questionPlan) {
  return Array.isArray(questionPlan?.globalQuestions) ? questionPlan.globalQuestions : [];
}

export function getPlannedLaneQuestions(questionPlan, laneIdx, domain, lane = null) {
  const index = Number.isFinite(Number(laneIdx)) ? Number(laneIdx) : 0;
  const planned = questionPlan?.laneQuestionsByLaneIndex?.[index];
  if (Array.isArray(planned) && planned.length > 0) {
    return planned;
  }
  return getClarifyingQuestionsForDomain(domain, { lane, laneIdx: index });
}

export function getDeferredGlobalQuestions(questionPlan) {
  return Array.isArray(questionPlan?.deferredGlobalQuestions) ? questionPlan.deferredGlobalQuestions : [];
}

export function getDeferredLaneQuestions(questionPlan, laneIdx, domain, lane = null) {
  const index = Number.isFinite(Number(laneIdx)) ? Number(laneIdx) : 0;
  const planned = questionPlan?.deferredLaneQuestionsByLaneIndex?.[index];
  if (Array.isArray(planned) && planned.length > 0) {
    return planned;
  }
  const fallback = getClarifyingQuestionsForDomain(domain, { lane, laneIdx: index });
  return fallback.filter((question) => question?.canDefer);
}

function deriveDiagnosticReasonCodes(question, answer) {
  const text = String(answer || '').trim();
  if (!text || isNonAnswerValue(text)) {
    return [];
  }
  const lower = text.toLowerCase();
  const derives = Array.isArray(question?.derives) ? question.derives : [];
  const codes = [];

  if (derives.includes('app_readiness') || derives.includes('launch_readiness')) {
    if (/\b(local[- ]only|no deployed url|not deployed|no public url|local version only)\b/.test(lower)) {
      codes.push('APP_DEPLOYMENT_MISSING');
    }
    if (/\b(can't|cannot|broken|blocked|not working|doesn['’]t work|needs help|manual help|required help|main flow not|not end[- ]to[- ]end)\b/.test(lower)) {
      codes.push('APP_MAIN_FLOW_UNPROVEN');
    }
    if (/\b(no persistence|doesn['’]t save|not saving|lost on refresh|resets on refresh|refresh loses|local only state)\b/.test(lower)) {
      codes.push('APP_PERSISTENCE_UNPROVEN');
    }
    if (/\b(no one else|no one besides me|only me|only i|just me|not tested by anyone else|nobody else tested|untested by others)\b/.test(lower)) {
      codes.push('USER_TESTING_MISSING');
    }
  }

  if (derives.includes('legal_exposure') || derives.includes('privacy_risk') || derives.includes('IP_risk') || derives.includes('product_compliance')) {
    if (/\b(payment|payments|checkout|stripe|sell|subscription|customer card|credit card)\b/.test(lower)) {
      codes.push('LEGAL_REVIEW_REQUIRED');
    }
    if (/\b(user data|personal data|email addresses|accounts|login|location data|health data|child data|children['’]s data|sensitive data|pii|profile data)\b/.test(lower)) {
      codes.push('PRIVACY_POLICY_REQUIRED');
    }
    if (/\b(ingestible|food|gum|beverage|supplement|wearable|child-facing|children|regulated product)\b/.test(lower)) {
      codes.push('FOOD_PRODUCT_COMPLIANCE_REQUIRED');
    }
    if (/\b(sample|samples|copyright|copyrighted|trademark|trademarks|likeness|third-party content|licensed music|images you do not own)\b/.test(lower)) {
      codes.push('IP_CLEARANCE_REQUIRED');
    }
    if (/\b(contractor|contractors|partner|partners|investor|investors|revenue split|employees|employee)\b/.test(lower)) {
      codes.push('CONTRACT_STRUCTURE_REQUIRED');
    }
    if (/\b(education|school|student|curriculum|teaching)\b/.test(lower)) {
      codes.push('EDUCATION_LICENSING_RISK');
    }
    if (/\b(real estate|property management|tenant|lease)\b/.test(lower)) {
      codes.push('REAL_ESTATE_REGULATORY_RISK');
    }
  }

  return [...new Set(codes)];
}

export function evaluateStructureCritic(questionPlan, answers = {}, extractedLanes = []) {
  const unresolvedQuestions = [];
  const derivedReasonCodes = [];
  const globalQuestions = getPlannedGlobalQuestions(questionPlan);
  globalQuestions.forEach((question, index) => {
    const answer = answers[`step_${5 + index}`];
    if (isNonAnswerValue(answer)) {
      unresolvedQuestions.push(question);
      return;
    }
    derivedReasonCodes.push(...deriveDiagnosticReasonCodes(question, answer));
  });
  (Array.isArray(extractedLanes) ? extractedLanes : []).forEach((lane, laneIdx) => {
    const laneQuestions = getPlannedLaneQuestions(questionPlan, laneIdx, lane?.domain, lane);
    laneQuestions.forEach((question, questionIdx) => {
      const answer = answers[`lane_${laneIdx}_clarifying_${questionIdx}`];
      if (isNonAnswerValue(answer)) {
        unresolvedQuestions.push(question);
        return;
      }
      derivedReasonCodes.push(...deriveDiagnosticReasonCodes(question, answer));
    });
  });
  const unresolvedReasonCodes = unresolvedQuestions.map((question) => question.reasonCode).filter(Boolean);
  const criticalUnresolved = unresolvedQuestions.filter((question) => question.criticality === 'high');
  const blockerUnresolved = unresolvedQuestions.filter((question) => question.criticality === 'blocker');
  const deferredQuestions = [
    ...getDeferredGlobalQuestions(questionPlan),
    ...(Array.isArray(extractedLanes)
      ? extractedLanes.flatMap((lane, laneIdx) =>
          getDeferredLaneQuestions(questionPlan, laneIdx, lane?.domain, lane)
        )
      : []),
  ];
  return {
    state: blockerUnresolved.length > 0 ? 'blocked' : unresolvedQuestions.length > 0 ? 'assumption_marked' : 'resolved',
    selectedQuestionCount:
      Number(questionPlan?.selectedQuestionCount || 0) ||
      globalQuestions.length +
        (Array.isArray(extractedLanes) ? extractedLanes.length : 0),
    unresolvedQuestions,
    unresolvedReasonCodes,
    deferredQuestions,
    derivedReasonCodes: [...new Set(derivedReasonCodes)],
    criticalUnresolvedCount: criticalUnresolved.length,
    blockerUnresolvedCount: blockerUnresolved.length,
  };
}

// ─── Intake question prompts ──────────────────────────────────────────────────

/**
 * Returns the prompt text and input type for a given phase/step.
 * context shape:
 *   { anchors, extractedLanes, currentLaneIdx, clarifyingQuestionIdx,
 *     suggestedHorizon, currentLaneAssessment }
 */
export function getIntakePrompt(phase, step, context = {}) {
  const {
    anchors = [],
    extractedLanes = [],
    currentLaneIdx = 0,
    clarifyingQuestionIdx = 0,
    questionPlan = null,
  } = context;

  if (phase === 1) {
    if (step === 1) {
      return {
        prompt: 'What are you trying to build or accomplish?',
        subtext: 'Describe everything — ventures, projects, creative work, income streams. The system will extract the key lanes.',
        inputType: 'textarea',
      };
    }
    if (step === 2) {
      return {
        prompt: 'What does success look like at the end?',
        subtext: 'In plain language — what is true when this plan works?',
        inputType: 'textarea',
      };
    }
    if (step === 3) {
      const suggested = context.suggestedHorizon;
      return {
        prompt: suggested
          ? `Based on what you described, a ${suggested.months}-month horizon makes sense — through ${suggested.label}. Does that fit?`
          : 'How far out are you planning?',
        subtext: suggested ? null : 'The system will suggest a horizon once anchors are set.',
        inputType: 'horizon_confirm',
        suggested,
      };
    }
  }

  if (phase === 2) {
    if (step === 4) {
      const hasAnchors = anchors.length > 0;
      return {
        prompt: hasAnchors ? 'Any other fixed dates?' : 'Are there any fixed external dates this plan must center on?',
        subtext: 'Conferences, festivals, release dates, contract deadlines — anything that cannot move.',
        inputType: 'anchor_input',
        hasAnchors,
      };
    }
    if (step === 5) {
      const globalQuestion = getPlannedGlobalQuestions(questionPlan)[0] || null;
      return {
        prompt: globalQuestion?.question || 'What budget or runway constraints affect this plan?',
        subtext: globalQuestion?.reason || 'Runway and capacity pressure change how the first cycle should be sequenced.',
        inputType: globalQuestion?.answerType || 'textarea',
        reason: globalQuestion?.reason || null,
        whyNeeded: globalQuestion?.whyNeeded || globalQuestion?.reason || null,
        resolvesField: globalQuestion?.resolvesField || null,
        affects: Array.isArray(globalQuestion?.affects) ? globalQuestion.affects : [],
        criticality: globalQuestion?.criticality || 'high',
        canDefer: Boolean(globalQuestion?.canDefer),
        diagnosticMode: Boolean(globalQuestion?.diagnosticMode),
        derives: Array.isArray(globalQuestion?.derives) ? globalQuestion.derives : [],
      };
    }
    if (step === 6) {
      const globalQuestion = getPlannedGlobalQuestions(questionPlan)[1] || null;
      return {
        prompt: globalQuestion?.question || 'What cannot be sacrificed if timing slips?',
        subtext:
          globalQuestion?.reason ||
          'This helps the system preserve mission continuity when entropy forces route changes.',
        inputType: globalQuestion?.answerType || 'textarea',
        reason: globalQuestion?.reason || null,
        whyNeeded: globalQuestion?.whyNeeded || globalQuestion?.reason || null,
        resolvesField: globalQuestion?.resolvesField || null,
        affects: Array.isArray(globalQuestion?.affects) ? globalQuestion.affects : [],
        criticality: globalQuestion?.criticality || 'medium',
        canDefer: Boolean(globalQuestion?.canDefer),
        diagnosticMode: Boolean(globalQuestion?.diagnosticMode),
        derives: Array.isArray(globalQuestion?.derives) ? globalQuestion.derives : [],
      };
    }
  }

  if (phase === 3) {
    const lane = extractedLanes[currentLaneIdx];
    const laneName = lane?.title || 'this lane';

    if (step === 7) {
      return {
        prompt: `What is the current state of ${laneName}?`,
        subtext: 'Where are you right now — what exists, what is in progress, what has not started?',
        inputType: 'textarea',
      };
    }
    if (step === 8) {
      const questions = getPlannedLaneQuestions(questionPlan, currentLaneIdx, lane?.domain, lane);
      const activeQuestion = questions[clarifyingQuestionIdx] || null;
      return {
        prompt: activeQuestion?.question || 'Tell me more.',
        subtext: activeQuestion?.reason || null,
        inputType: activeQuestion?.answerType || 'text',
        isSubQuestion: true,
        questionIdx: clarifyingQuestionIdx,
        totalQuestions: questions.length,
        reason: activeQuestion?.reason || null,
        whyNeeded: activeQuestion?.whyNeeded || activeQuestion?.reason || null,
        resolvesField: activeQuestion?.resolvesField || null,
        affects: Array.isArray(activeQuestion?.affects) ? activeQuestion.affects : [],
        criticality: activeQuestion?.criticality || 'medium',
        canDefer: Boolean(activeQuestion?.canDefer),
        diagnosticMode: Boolean(activeQuestion?.diagnosticMode),
        derives: Array.isArray(activeQuestion?.derives) ? activeQuestion.derives : [],
      };
    }
    if (step === 9) {
      const assessment = context.currentLaneAssessment;
      return {
        prompt: assessment
          ? `Based on what you described, I assess ${laneName} as: ${assessment.assessedStage} (confidence: ${assessment.assessedConfidence}). ${assessment.assessmentNotes}`
          : `Confirming assessment for ${laneName}.`,
        subtext: 'Does this match what you know? Correct it if not.',
        inputType: 'confirm_or_correct',
      };
    }
    if (step === 10) {
      return {
        prompt: `Activation state for ${laneName}?`,
        subtext: 'Active = schedule daily actions. Incubating = plan but do not schedule yet. Parked = watch only.',
        inputType: 'activation_select',
        options: Object.values(LANE_ACTIVATION_STATE),
      };
    }
  }

  if (phase === 4) {
    if (step === 11) {
      return {
        prompt: 'Generating milestones for each lane, worked backward from your anchors.',
        inputType: 'loading',
      };
    }
    if (step === 12) {
      return {
        prompt: 'Here is your master timeline. Flag anything that does not look right.',
        inputType: 'timeline_review',
      };
    }
    if (step === 13) {
      return {
        prompt: 'Scheduling the first execution cycle, not the entire master-plan horizon.',
        subtext:
          'Your master plan keeps the long horizon. Today only schedules the first execution cycle for active lanes so the work stays realistic and recalibratable.',
        inputType: 'schedule_confirm',
      };
    }
  }

  return { prompt: '', inputType: 'text' };
}
