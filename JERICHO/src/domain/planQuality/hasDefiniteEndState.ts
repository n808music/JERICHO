/**
 * Goal-admission clarity bar: returns true when the goal text names a DEFINITE END-STATE —
 * a destination the user could recognize as achieved. Returns false for OBVIOUS direction-only
 * shells that name only a direction ("do better," "grow," "be more successful") with no
 * concrete target attached.
 *
 * Conservative: when uncertain, lean toward admitting. This catches obvious shells, not
 * borderline goals. The downstream ten-section elicitation exposes any remaining thinness.
 *
 * FIREWALL: used ONLY in the goal-admission gate (identityStore.js).
 * NEVER import this into cell-state gating, hasAuthoredSubstance.ts, or the elicitation engine.
 * Cell states use hasAuthoredSubstance.ts + HONEST_INCOMPLETENESS_RE — those are separate code
 * paths with separate semantics. Honest "not started" / "unknown" on a cell passes untouched.
 */

// A single concrete anchor is sufficient to admit — concrete goals can be phrased many ways.
// Catches: numbers ($3.5B, 10k), named artifacts (book, podcast, app), achievement nouns
// (subscribers, net worth), deliverable types (degree, patent, license).
const CONCRETE_ANCHOR_RE =
  /\d|\$[\d,]|\b(?:book|podcast|album|track|song|record|mix|ep)\b|\b(?:app|website|software|product|mvp|prototype|demo)\b|\b(?:startup|company|corp|llc|inc)\b|\b(?:course|certification|degree|license|award|patent|thesis|dissertation)\b|\b(?:fund|deal|contract|proposal|deck)\b|\b(?:film|documentary|show|series|channel|newsletter|magazine|publication|portfolio|manuscript)\b|\b(?:launch|release)\b|\b(?:operational|profitable|published|signed|closed|shipped|acquired|graduated|incorporated|funded|exited|merged)\b|\b(?:net\s+worth|revenue|mrr|arr|subscribers?|clients?|customers?|followers?|downloads?|members?|employees?|offices?|subsidiaries?|locations?|stores?|branches?)\b/i;

// Direction phrases that signal a shell anywhere in the text — fires only when no anchor is present.
// "Get my business more successful", "do better at life", "be more organized", etc.
const DIRECTION_PHRASE_RE =
  /\bdo\s+better\b|\bget\s+better\b|\bmore\s+(?:successful|productive|efficient|organized|disciplined|motivated|fulfilled|confident|focused|consistent|balanced|effective)\b|\bget\s+(?:my\s+)?(?:life|things?|stuff|act)\s+together\b|\bimprove\s+(?:my|the\s+)?\s*(?:life|self|mindset|attitude|character|wellbeing|overall)\b|\breach\s+(?:my|our|their)\s+(?:full\s+)?potential\b|\blive\s+my\s+best\s+life\b|\bfind\s+(?:my\s+)?purpose\b|\bbecome\s+(?:a\s+)?better\s+(?:person|human|version)\b|\blevel\s+up\s+(?:in\s+life|as\s+a\s+person)\b/i;

// Status phrases that are honest cell-state answers but are not goals at all.
// These would pass concrete-anchor and direction-shell checks but clearly name no destination.
const NOT_A_GOAL_RE =
  /^(?:not\s+started|haven'?t\s+started|unknown|tbd|to\s+be\s+determined|n\/a|not\s+applicable|none\s+yet|pending|not\s+sure|unsure|skip|pass|later|undecided|unclear)\.?$/i;

// Filler prefixes stripped before the full-text shell check below.
const FILLER_PREFIX_RE =
  /^(?:i\s+(?:really\s+)?(?:want|need|hope|plan|aim|wish)\s+to|i'd\s+like\s+to|i\s+(?:am|was)\s+(?:trying|going)\s+to|my\s+(?:main\s+)?goal\s+is\s+to|what\s+i\s+want\s+is\s+to|i\s+would\s+like\s+to|the\s+goal\s+is\s+to)\s+/i;

// Full-text direction-dominant: applied to the core (filler-stripped) text, anchored at start+end.
// Matches only when the ENTIRE goal is carried by a directional word with no destination.
const DIRECTION_DOMINANT_RE =
  /^(?:be(?:come)?\s+(?:a\s+)?(?:more\s+)?(?:successful|productive|happy|happier|healthy|healthier|wealthy|wealthier|fit|fitter|organized|disciplined|motivated|fulfilled|confident|focused|better|best|great|amazing|whole|balanced|mindful|present|efficient)|get\s+(?:more\s+)?(?:fit|healthy|in\s+shape|rich|ahead)|make\s+more\s+money|earn\s+more|succeed(?:\s+in\s+life)?|grow\s+as\s+(?:a\s+)?person|be\s+the\s+best\s+version|level\s+up)[\s,.!?]*$/i;

export function hasDefiniteEndState(text: string): boolean {
  const s = String(text ?? '').trim();
  if (!s) return false;

  // Status phrases that are honest gap reports (valid as cell answers) but not goals
  if (NOT_A_GOAL_RE.test(s)) return false;

  // Fast path: any concrete anchor → definite end-state
  if (CONCRETE_ANCHOR_RE.test(s)) return true;

  // Direction phrase anywhere in text (no anchor present) → direction-only shell
  if (DIRECTION_PHRASE_RE.test(s)) return false;

  // Full-text direction-dominant after stripping filler prefix → shell
  const core = s.replace(FILLER_PREFIX_RE, '').trim();
  if (DIRECTION_DOMINANT_RE.test(core)) return false;

  // Conservative: uncertain → admit
  return true;
}
