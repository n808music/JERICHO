/**
 * terminalEndpointDetector.ts
 *
 * Canonical detector for terminal endpoint recognition. Answers the question:
 * "What exact event counts as this goal being finished?"
 *
 * This is the upstream truth surface that Outcome Validity and corridor-stage
 * enforcement reason about. It is independent of those layers — endpoint
 * recognition identifies the target, authority classification identifies who
 * controls it, Outcome Validity checks whether the plan reaches it.
 *
 * Relationship to completionBoundary:
 *   completionBoundary is podcast-domain only and is not modified here.
 *   terminalEndpoint is the cross-domain generalization. The two coexist
 *   independently on GoalIntakeContract and are not merged.
 *
 * Binding invariant (same discipline as terminalStageDetector):
 *   Endpoint recognition is anchored on terminal objects and events, not on
 *   generic completion verbs. A pattern must have a named load-bearing terminal
 *   object. If the pattern fires when that object is removed, it is over-broad.
 *
 * Contamination rule:
 *   Verification text contains endpoint evidence AND supporting artifacts AND
 *   process metrics. The terminal endpoint is the state change that:
 *     (a) cannot be reversed
 *     (b) is not a deliverable the user executes alone
 *   Process metrics ("15 applications per week") and artifact descriptions
 *   ("portfolio contains 3 projects") are excluded even when present in
 *   verification text.
 *
 * Phase B scope: detection only. Zero gate enforcement. Zero trust state changes.
 * Additions require explicit justification and a negative-case test.
 */

export type TerminalEndpointStatus =
  | 'clear_explicit'  // endpoint directly stated, terminal object found
  | 'clear_inferred'  // endpoint canonically inferred from lane + framing verb
  | 'ambiguous'       // multiple plausible endpoints, cannot resolve primary
  | 'missing'         // no reliable endpoint detectable
  | 'split';          // multiple distinct terminal outcomes named (LT-02 pattern)

export type TerminalEndpointObject =
  | 'offer_received'        // JobSearch: employer extends offer
  | 'hired'                 // JobSearch: hired implies offer + acceptance
  | 'capital_secured'       // Fundraising: funds received / wire confirmed
  | 'signed_commitment'     // Fundraising: investor signs (pre-wire)
  | 'published_live'        // Release/Podcast: content is live/distributed
  | 'certification_earned'  // Qualification: externally administered credential
  | 'first_sale_completed'  // Commercial launch: first real sale / first order achieved
  | 'revenue_threshold'     // Market-dependent: $MRR / revenue target
  | 'audience_threshold'    // Market-dependent: listener/subscriber count
  | 'artifact_complete'     // Fully controllable: artifact in final verifiable form
  | 'unknown';              // Fallback when no object can be named

export type TerminalEndpointRecognitionReason =
  | 'TERMINAL_OBJECT_FOUND'        // explicit terminal object matched in text
  | 'FRAMING_VERB_INFERRED'        // framing verb + lane context → canonical inference
  | 'AUTHORITY_CLASS_CONFIRMED'    // authority class supports the inference
  | 'MULTIPLE_CANDIDATES_FOUND'    // led to split or ambiguous status
  | 'NO_TERMINAL_OBJECT'           // no terminal object found in combined text
  | 'VERIFICATION_CLAUSE_PRIMARY'  // endpoint resolved primarily from verification text
  | 'GOAL_TEXT_CLAUSE_PRIMARY';    // endpoint resolved primarily from goal text

export type TerminalEndpointResult = {
  status: TerminalEndpointStatus;
  primaryEndpoint: TerminalEndpointObject;
  secondaryEndpoint?: TerminalEndpointObject; // present when status is 'split'
  reasons: TerminalEndpointRecognitionReason[];
  confidence: 'high' | 'medium' | 'low';
};

// ---------------------------------------------------------------------------
// JobSearch terminal object patterns
//
// Explicit patterns require a named terminal object: offer, offer letter,
// hired/hired-as, or full-time employment (not role/position — those are job
// types, not terminal events, and are handled by the inferred path).
//
// Load-bearing terminal objects: offer, offer letter, hired, employment
// ---------------------------------------------------------------------------

const JOB_OFFER_EXPLICIT: RegExp[] = [
  /\boffer\s+letters?\b/i,
  /\bjob\s+offers?\b/i,
  /\b(receive|accept|sign|negotiate|evaluate)\b.{0,30}\boffers?\b/i,
  /\boffers?\b.{0,30}\b(received|accepted|signed|evaluated|letter)\b/i,
  /\b(employment\s+confirmed|onboarding\s+confirmed|start\s+date\s+confirmed)\b/i,
];

/** "Hired" explicit language — requires hired-as phrasing or full-time employment */
const JOB_HIRED_EXPLICIT: RegExp[] = [
  /\b(hired\s+(?:as|at|by|for)|get\s+hired|got\s+hired|become\s+hired)\b/i,
  /\bfull.?time\s+employment\b/i,   // "employment" is terminal-sounding; role/position are job-type labels
  /\bsecure\s+(a|the)\s+(job|role|position|offer)\b/i,
];

/**
 * Framing verb inference — "land", "get", "secure" + job-type noun.
 * Allows intervening adjectives (e.g. "land a full-stack developer job").
 * Uses [\w-]+ to allow hyphenated words like "full-stack".
 * Load-bearing terminal object: job / role / position implied by framing verb.
 */
const JOB_LAND_INFERRED: RegExp[] = [
  /\bland\s+(a|the)\s+(?:[\w-]+\s+){0,4}(job|role|position|offer)\b/i,
  /\bland\s+(a|the)\s+(?:full.?time|part.?time|junior|senior|mid.?level)\b/i,
  /\bget\s+(a|the)\s+(?:full.?time|part.?time)\s+(?:[\w-]+\s+){0,3}(job|role|position|offer)\b/i,
  /\bget\s+(a|the)\s+(?:[\w-]+\s+){0,3}(?:full.?time|part.?time|junior|senior|mid.?level)\s+(?:[\w-]+\s+){0,2}(job|role|position)\b/i,
  /\bfull.?time\s+(role|position|job)\b/i,   // "full-time role/position/job" — job type implies hiring endpoint
];

// ---------------------------------------------------------------------------
// Fundraising terminal object patterns
// Load-bearing terminal objects: signed commitment, capital secured, wire, close
// ---------------------------------------------------------------------------

const CAPITAL_SECURED_EXPLICIT: RegExp[] = [
  /\bwire\s+(transfer|confirmation|confirmed)\b/i,
  /\bfunds?\s+(received|confirmed|transferred|secured)\b/i,
  /\b(investment|capital)\s+(secured|received|confirmed|transferred)\b/i,
  /\b(raise|raised|raising)\s+\$[\d,]+\b/i,
];

const SIGNED_COMMITMENT_EXPLICIT: RegExp[] = [
  /\bsigned\s+(investment\s+agreement|commitment|term\s+sheet)\b/i,
  /\bcommitment\s+(received|signed|confirmed)\b/i,
  /\binvestment\s+agreement\b/i,
  /\bterm\s+(sheet|agreement)\b/i,
  /\bclose\s+(round|the\s+round|process)\b/i,
  /\blegal\s+close\b/i,
];

const FUNDRAISING_RAISE_INFERRED: RegExp[] = [
  /\braise\s+(seed|series|funding|capital)\b/i,
  /\bsecure\s+(funding|investment|capital|a\s+round)\b/i,
  /\bclose\s+(a|the|our)\s+(seed|series|funding|round)\b/i,
  /\bfund\s+(my|our|the)\s+(startup|company|project)\b/i,
];

// ---------------------------------------------------------------------------
// Published/live terminal object patterns
// Load-bearing terminal objects: published, live, released, distributed
// episodes? handles plural ("12 episodes published")
// ---------------------------------------------------------------------------

const PUBLISHED_LIVE_EXPLICIT: RegExp[] = [
  /\b(published|publish)\b.{0,25}\b(live|episodes?|content|podcast|article|post)\b/i,
  /\b(episodes?|content|podcast|article|post)\b.{0,25}\b(published|live|released|distributed)\b/i,
  /\bgo\s+live\b/i,
  /\breleased?\b.{0,25}\b(and\s+live|publicly|to\s+audience|to\s+distribution)\b/i,
  /\blaunched?\s+(and\s+live|publicly|the\s+(app|product|site|page))\b/i,
];

/**
 * Artifact-complete: self-certifying fully controllable endpoints.
 * Load-bearing terminal objects: deployed, live (+ artifact noun), launched.
 * Distinct from published_live: applies to product/page/app, not content.
 */
const ARTIFACT_COMPLETE_EXPLICIT: RegExp[] = [
  /\b(page|site|app|product|feature|tool|website)\b.{0,25}\b(live|deployed|launched|released|built\s+and\s+(?:live|deployed))\b/i,
  /\b(deployed|launched|released)\b.{0,25}\b(page|site|app|product|feature|tool)\b/i,
  /\b(portfolio|project).{0,25}\b(complete|completed|deployed|live|published|done)\b/i,
  /\b(case\s*study|case-study|portfolio)\s+(page|writeup)\b.{0,30}\b(shareable|published|live|complete|completed|ready|final|exists)\b/i,
  /\b(shareable|published|live|complete|completed|ready|final)\b.{0,30}\b(case\s*study|case-study|portfolio)\s+(page|writeup)\b/i,
  /\b(built|completed|finished)\b.{0,25}\b(and\s+(deployed|live|launched|released|working))\b/i,
];

// ---------------------------------------------------------------------------
// Qualification terminal object patterns
// Load-bearing terminal objects: certification, credential, exam passed, degree
// ---------------------------------------------------------------------------

const CERTIFICATION_EARNED_EXPLICIT: RegExp[] = [
  /\b(earn|earned|achieve|achieved|receive|received|obtain|obtained)\b.{0,25}\b(certification|certificate|credential|license|licence)\b/i,
  /\b(certification|certificate|credential|license|licence)\b.{0,25}\b(earned|received|obtained|achieved|passed|completed)\b/i,
  /\b(exam|test|assessment)\b.{0,25}\b(passed|cleared|completed\s+successfully)\b/i,
  /\b(degree|diploma)\b.{0,25}\b(completed|earned|received|conferred)\b/i,
  /\bpassed\b.{0,25}\b(exam|test|assessment|certification)\b/i,
];

// ---------------------------------------------------------------------------
// Market-dependent threshold patterns
// Load-bearing terminal objects: listener/subscriber/user counts, revenue figures
// sign.?ups? covers "sign-ups", "sign ups", "signups"
// ---------------------------------------------------------------------------

const FIRST_SALE_COMPLETED_EXPLICIT: RegExp[] = [
  /\b(to|get|reach|achieve|make|generate|drive|secure)\b.{0,25}\bfirst\s+(real\s+)?sales?\b/i,
  /\bfirst\s+orders?\b.{0,20}\b(completed|secured|confirmed|received|captured|placed)\b/i,
  /\b(completed|secured|confirmed|received|captured|placed)\b.{0,20}\bfirst\s+orders?\b/i,
  /\bfirst\s+paying\s+customers?\b/i,
];

const AUDIENCE_THRESHOLD_EXPLICIT: RegExp[] = [
  /\b\d[\d,]*\s*(monthly\s+)?(listeners?|subscribers?|followers?|users?|viewers?|sign.?ups?)\b/i,
  /\breach\s+\d[\d,]*.{0,20}(listeners?|subscribers?|followers?|sign.?ups?)\b/i,
  /\bgrow\s+to\s+\d[\d,]*.{0,20}(listeners?|subscribers?|followers?|users?)\b/i,
  /\b\d[\d,]*\s+(?:confirmed\s+)?(email\s+)?(subscribers?|sign.?ups?)\b/i,
];

const REVENUE_THRESHOLD_EXPLICIT: RegExp[] = [
  /\$[\d,]+\s*(mrr|arr|\/month|per\s+month|monthly|annual|annually|recurring)/i,
  /\b(mrr|arr|monthly\s+recurring|annual\s+recurring)\b.{0,25}\$[\d,]+/i,
  /\bgenerate\s+\$[\d,]+.{0,30}(revenue|income|recurring|month)/i,
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function hasAnyPattern(patterns: RegExp[], text: string): boolean {
  return patterns.some((p) => p.test(text));
}

// ---------------------------------------------------------------------------
// Main detector
// ---------------------------------------------------------------------------

/**
 * Detects the terminal endpoint for the given goal and verification text.
 *
 * Resolution priority:
 *   1. Explicit terminal object in combined text — clear_explicit
 *   2. Framing verb inference with supporting lane context — clear_inferred
 *   3. Multiple distinct endpoint classes detected — split or ambiguous
 *   4. No terminal object found — missing
 */
export function detectTerminalEndpoint(
  goalText: string,
  verificationText: string,
): TerminalEndpointResult {
  const combined = `${goalText} ${verificationText}`;

  // --- Detect each endpoint class ---

  const hasOfferExplicit = hasAnyPattern(JOB_OFFER_EXPLICIT, combined);
  const hasHiredExplicit = hasAnyPattern(JOB_HIRED_EXPLICIT, combined);
  const hasJobInferred = hasAnyPattern(JOB_LAND_INFERRED, combined);

  const hasCapitalExplicit = hasAnyPattern(CAPITAL_SECURED_EXPLICIT, combined);
  const hasCommitmentExplicit = hasAnyPattern(SIGNED_COMMITMENT_EXPLICIT, combined);
  const hasFundraisingInferred = hasAnyPattern(FUNDRAISING_RAISE_INFERRED, combined);

  const hasPublishedLive = hasAnyPattern(PUBLISHED_LIVE_EXPLICIT, combined);
  const hasArtifactComplete = hasAnyPattern(ARTIFACT_COMPLETE_EXPLICIT, combined);
  const hasCertification = hasAnyPattern(CERTIFICATION_EARNED_EXPLICIT, combined);
  const hasFirstSaleCompleted = hasAnyPattern(FIRST_SALE_COMPLETED_EXPLICIT, combined);
  const hasAudienceThreshold = hasAnyPattern(AUDIENCE_THRESHOLD_EXPLICIT, combined);
  const hasRevenueThreshold = hasAnyPattern(REVENUE_THRESHOLD_EXPLICIT, combined);

  // Normalize into presence flags by category
  const jobEndpointPresent = hasOfferExplicit || hasHiredExplicit || hasJobInferred;
  const fundraisingEndpointPresent = hasCapitalExplicit || hasCommitmentExplicit || hasFundraisingInferred;
  const releaseOrArtifactPresent = hasPublishedLive || hasArtifactComplete;
  const qualificationEndpointPresent = hasCertification;
  const marketEndpointPresent = hasFirstSaleCompleted || hasAudienceThreshold || hasRevenueThreshold;

  // Resolve job endpoint object (most explicit wins)
  const jobEndpointObject: TerminalEndpointObject =
    hasOfferExplicit ? 'offer_received'
    : hasHiredExplicit ? 'hired'
    : 'offer_received'; // land/get inference maps to offer_received

  // Resolve fundraising endpoint object (most explicit wins)
  const fundraisingEndpointObject: TerminalEndpointObject =
    hasCapitalExplicit ? 'capital_secured'
    : hasCommitmentExplicit ? 'signed_commitment'
    : 'capital_secured'; // raise inference maps to capital_secured

  // Resolve market endpoint object
  const marketEndpointObject: TerminalEndpointObject =
    hasFirstSaleCompleted ? 'first_sale_completed'
    : hasRevenueThreshold ? 'revenue_threshold'
    : 'audience_threshold';

  // Resolve release/artifact endpoint object (content takes precedence over artifact)
  const releaseOrArtifactObject: TerminalEndpointObject =
    hasPublishedLive ? 'published_live' : 'artifact_complete';

  // Determine if job endpoint is explicit or inferred
  const jobEndpointIsExplicit = hasOfferExplicit || hasHiredExplicit;

  // --- Count how many distinct endpoint categories fired ---

  type Category = { present: boolean; object: TerminalEndpointObject; isExplicit: boolean };
  const endpointCategories: Category[] = [
    { present: jobEndpointPresent, object: jobEndpointObject, isExplicit: jobEndpointIsExplicit },
    { present: fundraisingEndpointPresent, object: fundraisingEndpointObject, isExplicit: hasCapitalExplicit || hasCommitmentExplicit },
    { present: releaseOrArtifactPresent, object: releaseOrArtifactObject, isExplicit: hasPublishedLive || hasArtifactComplete },
    { present: qualificationEndpointPresent, object: 'certification_earned', isExplicit: true },
    { present: marketEndpointPresent, object: marketEndpointObject, isExplicit: true },
  ];

  const firedCategories = endpointCategories.filter((c) => c.present);

  // --- Resolve result ---

  // No endpoint detected
  if (firedCategories.length === 0) {
    return {
      status: 'missing',
      primaryEndpoint: 'unknown',
      reasons: ['NO_TERMINAL_OBJECT'],
      confidence: 'high',
    };
  }

  // Single endpoint category
  if (firedCategories.length === 1) {
    // Safe: we just confirmed length === 1
    const category = firedCategories[0] as Category;
    const { object, isExplicit } = category;

    const primaryInVerification = verificationText ? hasAnyPattern(
      object === 'offer_received' ? [...JOB_OFFER_EXPLICIT, ...JOB_HIRED_EXPLICIT]
      : object === 'hired' ? JOB_HIRED_EXPLICIT
      : object === 'capital_secured' ? CAPITAL_SECURED_EXPLICIT
      : object === 'signed_commitment' ? SIGNED_COMMITMENT_EXPLICIT
      : object === 'published_live' ? PUBLISHED_LIVE_EXPLICIT
      : object === 'artifact_complete' ? ARTIFACT_COMPLETE_EXPLICIT
      : object === 'certification_earned' ? CERTIFICATION_EARNED_EXPLICIT
      : object === 'first_sale_completed' ? FIRST_SALE_COMPLETED_EXPLICIT
      : object === 'audience_threshold' ? AUDIENCE_THRESHOLD_EXPLICIT
      : object === 'revenue_threshold' ? REVENUE_THRESHOLD_EXPLICIT
      : [],
      verificationText,
    ) : false;

    const reasons: TerminalEndpointRecognitionReason[] = [
      isExplicit ? 'TERMINAL_OBJECT_FOUND' : 'FRAMING_VERB_INFERRED',
      primaryInVerification ? 'VERIFICATION_CLAUSE_PRIMARY' : 'GOAL_TEXT_CLAUSE_PRIMARY',
    ];

    return {
      status: isExplicit ? 'clear_explicit' : 'clear_inferred',
      primaryEndpoint: object,
      reasons,
      confidence: isExplicit ? 'high' : 'medium',
    };
  }

  // Multiple endpoint categories — determine split vs ambiguous
  if (firedCategories.length >= 2) {
    const first = firedCategories[0] as Category;
    const second = firedCategories[1] as Category;

    // split: two distinct endpoint classes from different authority types
    // Canonical split shapes: fc/release + externally_mediated, fc/release + market,
    // externally_mediated + market, qualification + job
    const isCompound =
      (jobEndpointPresent && (releaseOrArtifactPresent || marketEndpointPresent)) ||
      (fundraisingEndpointPresent && (releaseOrArtifactPresent || marketEndpointPresent)) ||
      (releaseOrArtifactPresent && marketEndpointPresent) ||
      (qualificationEndpointPresent && jobEndpointPresent);

    if (isCompound) {
      return {
        status: 'split',
        primaryEndpoint: first.object,
        secondaryEndpoint: second.object,
        reasons: ['TERMINAL_OBJECT_FOUND', 'MULTIPLE_CANDIDATES_FOUND'],
        confidence: 'high',
      };
    }

    // Same authority class — ambiguous
    return {
      status: 'ambiguous',
      primaryEndpoint: first.object,
      reasons: ['MULTIPLE_CANDIDATES_FOUND'],
      confidence: 'low',
    };
  }

  // Unreachable but satisfies TypeScript exhaustiveness
  return {
    status: 'ambiguous',
    primaryEndpoint: 'unknown',
    reasons: ['MULTIPLE_CANDIDATES_FOUND'],
    confidence: 'low',
  };
}
