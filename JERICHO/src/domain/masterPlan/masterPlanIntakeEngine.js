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
};

const DEFAULT_ROLE_BY_DOMAIN = {
  [LANE_DOMAIN.CREATIVE]: LANE_ROLE.PROOF_ARTIFACT,
  [LANE_DOMAIN.PRODUCT]: LANE_ROLE.REVENUE_ENGINE,
  [LANE_DOMAIN.BRAND]: LANE_ROLE.ATTENTION_ENGINE,
  [LANE_DOMAIN.INCOME]: LANE_ROLE.REVENUE_ENGINE,
  [LANE_DOMAIN.MEDIA]: LANE_ROLE.ATTENTION_ENGINE,
};

const DOMAIN_TITLE_LABELS = {
  [LANE_DOMAIN.CREATIVE]: 'Creative project',
  [LANE_DOMAIN.PRODUCT]: 'Product / software',
  [LANE_DOMAIN.BRAND]: 'Brand / presence',
  [LANE_DOMAIN.INCOME]: 'Income stream',
  [LANE_DOMAIN.MEDIA]: 'Media / content',
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

const DOMAIN_QUESTION_TEMPLATES = {
  [LANE_DOMAIN.CREATIVE]: {
    question: 'What album or release assets already exist?',
    reason:
      'Masters, artwork, distribution setup, and promo assets determine whether this lane is launch-ready or still in production.',
    resolvesField: 'creative.releaseAssets',
    criticality: 'high',
    answerType: 'textarea',
    reasonCode: 'STRUCTURE_CREATIVE_ASSET_STATE_UNRESOLVED',
  },
  [LANE_DOMAIN.PRODUCT]: {
    question: 'What is the current launch-readiness state of the product/app?',
    reason:
      'Product readiness determines whether the anchor can support a real launch or only a beta, proof, or readiness gate.',
    resolvesField: 'product.launchReadiness',
    criticality: 'high',
    answerType: 'textarea',
    reasonCode: 'STRUCTURE_PRODUCT_LAUNCH_READINESS_UNRESOLVED',
  },
  [LANE_DOMAIN.BRAND]: {
    question: 'What proof asset or offer already exists for this brand/service lane?',
    reason:
      'Positioning, offer clarity, and proof determine whether this lane should be scheduled for client-facing progress or still treated as setup.',
    resolvesField: 'brand.offerProofState',
    criticality: 'medium',
    answerType: 'textarea',
    reasonCode: 'STRUCTURE_BRAND_OFFER_PROOF_UNRESOLVED',
  },
  [LANE_DOMAIN.INCOME]: {
    question: 'What runway or first revenue path is realistic in the next 8 weeks?',
    reason:
      'Runway pressure changes sequencing, capacity, and whether income work must override lower-consequence campaigns.',
    resolvesField: 'income.runwayPressure',
    criticality: 'high',
    answerType: 'textarea',
    reasonCode: 'STRUCTURE_RUNWAY_PRESSURE_UNRESOLVED',
  },
  [LANE_DOMAIN.MEDIA]: {
    question: 'Is this media lane supporting the album, the product, both, or standing alone?',
    reason:
      'This determines whether media work belongs in the integrated launch cluster or should be scheduled as an independent lane.',
    resolvesField: 'media.supportRole',
    criticality: 'high',
    answerType: 'text',
    reasonCode: 'STRUCTURE_MEDIA_ROLE_UNRESOLVED',
  },
};

function buildLaneQuestion(domain, lane, laneIdx) {
  const template = DOMAIN_QUESTION_TEMPLATES[domain];
  if (!template) {
    return {
      id: `lane-${laneIdx}-generic-context`,
      question: `What is the key missing context for ${lane?.title || 'this lane'}?`,
      reason: 'The system needs one concrete context signal to avoid sequencing this lane by assumption.',
      domain: domain || 'unknown',
      laneId: lane?.id || null,
      laneTitle: lane?.title || '',
      resolvesField: `${domain || 'unknown'}.context`,
      criticality: 'medium',
      answerType: 'textarea',
      reasonCode: 'STRUCTURE_LANE_CONTEXT_UNRESOLVED',
    };
  }
  return {
    id: `lane-${laneIdx}-${domain}-primary`,
    question: template.question,
    reason: template.reason,
    domain,
    laneId: lane?.id || null,
    laneTitle: lane?.title || '',
    resolvesField: template.resolvesField,
    criticality: template.criticality,
    answerType: template.answerType,
    reasonCode: template.reasonCode,
  };
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
  const questions = [
    {
      id: 'global-weekly-capacity',
      question: 'How many hours per week can you realistically allocate across all active goals?',
      reason: 'The master calendar cannot generate a credible first cycle without user-level capacity.',
      domain: 'master_calendar_capacity',
      laneId: null,
      resolvesField: 'masterCalendar.weeklyCapacityHours',
      criticality: 'high',
      answerType: 'text',
      reasonCode: 'STRUCTURE_WEEKLY_CAPACITY_UNRESOLVED',
      priority: 100,
    },
    {
      id: 'global-runway-pressure',
      question: 'What budget or runway pressure must this plan respect in the next 8 weeks?',
      reason: 'Runway pressure changes sequencing, readiness, and how aggressively income work must protect the calendar.',
      domain: 'income_runway',
      laneId: null,
      resolvesField: 'profile.runwayPressure',
      criticality: 'high',
      answerType: 'textarea',
      reasonCode: 'STRUCTURE_RUNWAY_CONSTRAINT_UNRESOLVED',
      priority: domains.has('income') ? 95 : 65,
    },
    {
      id: 'global-job-search-relation',
      question: 'Is job search part of the strategy or only personal income security?',
      reason: 'This determines whether job search is strategically integrated or only time-competing on the master calendar.',
      domain: 'job_search_calendar_burden',
      laneId: null,
      resolvesField: 'profile.jobSearchRelation',
      criticality: 'high',
      answerType: 'text',
      reasonCode: 'STRUCTURE_JOB_SEARCH_RELATION_UNRESOLVED',
      priority: extractJobSearchSignal(goalTextValue) ? 96 : 10,
    },
    {
      id: 'global-non-negotiables',
      question: 'What cannot be sacrificed if timing slips?',
      reason: 'Non-negotiables determine correction behavior under entropy and keep tactical pivots from erasing the mission.',
      domain: 'core_mission',
      laneId: null,
      resolvesField: 'mission.nonNegotiables',
      criticality: 'medium',
      answerType: 'textarea',
      reasonCode: 'STRUCTURE_NON_NEGOTIABLES_UNRESOLVED',
      priority: 90,
    },
  ];
  if (Array.isArray(anchors) && anchors.length > 0) {
    questions.push({
      id: 'global-anchor-confirmation',
      question: 'What must stay true for the hard anchor dates to remain real?',
      reason: 'Hard anchors only help if the system knows what cannot slip before them.',
      domain: 'anchors',
      laneId: null,
      resolvesField: 'anchors.nonNegotiablePrerequisites',
      criticality: 'medium',
      answerType: 'textarea',
      reasonCode: 'STRUCTURE_ANCHOR_PREREQUISITES_UNRESOLVED',
      priority: 88,
    });
  }
  return questions.sort((left, right) => Number(right.priority || 0) - Number(left.priority || 0));
}

export function buildStructureQuestionPlan({ goalText = '', extractedLanes = [], anchors = [] } = {}) {
  const globalQuestions = buildGlobalQuestionPool({ goalText, extractedLanes, anchors }).slice(0, 2);
  const laneQuestionsByLaneIndex = {};
  (Array.isArray(extractedLanes) ? extractedLanes : []).forEach((lane, laneIdx) => {
    laneQuestionsByLaneIndex[laneIdx] = [buildLaneQuestion(String(lane?.domain || '').trim().toLowerCase(), lane, laneIdx)];
  });
  return {
    globalQuestions,
    laneQuestionsByLaneIndex,
    selectedQuestionCount:
      globalQuestions.length +
      Object.values(laneQuestionsByLaneIndex).reduce(
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

export function evaluateStructureCritic(questionPlan, answers = {}, extractedLanes = []) {
  const unresolvedQuestions = [];
  const globalQuestions = getPlannedGlobalQuestions(questionPlan);
  globalQuestions.forEach((question, index) => {
    if (isNonAnswerValue(answers[`step_${5 + index}`])) {
      unresolvedQuestions.push(question);
    }
  });
  (Array.isArray(extractedLanes) ? extractedLanes : []).forEach((lane, laneIdx) => {
    const laneQuestions = getPlannedLaneQuestions(questionPlan, laneIdx, lane?.domain, lane);
    laneQuestions.forEach((question, questionIdx) => {
      if (isNonAnswerValue(answers[`lane_${laneIdx}_clarifying_${questionIdx}`])) {
        unresolvedQuestions.push(question);
      }
    });
  });
  const unresolvedReasonCodes = unresolvedQuestions.map((question) => question.reasonCode).filter(Boolean);
  const criticalUnresolved = unresolvedQuestions.filter((question) => question.criticality === 'high');
  const blockerUnresolved = unresolvedQuestions.filter((question) => question.criticality === 'blocker');
  return {
    state: blockerUnresolved.length > 0 ? 'blocked' : unresolvedQuestions.length > 0 ? 'assumption_marked' : 'resolved',
    selectedQuestionCount:
      Number(questionPlan?.selectedQuestionCount || 0) ||
      globalQuestions.length +
        (Array.isArray(extractedLanes) ? extractedLanes.length : 0),
    unresolvedQuestions,
    unresolvedReasonCodes,
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
        resolvesField: globalQuestion?.resolvesField || null,
        criticality: globalQuestion?.criticality || 'high',
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
        resolvesField: globalQuestion?.resolvesField || null,
        criticality: globalQuestion?.criticality || 'medium',
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
        resolvesField: activeQuestion?.resolvesField || null,
        criticality: activeQuestion?.criticality || 'medium',
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
        prompt: 'Scheduling your first two weeks of daily actions for active lanes.',
        subtext: 'Only active lanes generate blocks. Incubating and parked lanes are planned but not scheduled.',
        inputType: 'schedule_confirm',
      };
    }
  }

  return { prompt: '', inputType: 'text' };
}
