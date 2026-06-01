/**
 * terminalOutcomeAuthority.ts
 *
 * Single canonical source for Terminal Outcome Authority classification.
 *
 * Classifies whether a goal's terminal event is:
 *   - fully_controllable: user completing deliverables causes the outcome
 *   - externally_mediated: a specific third party must decide (employer, investor, publisher)
 *   - market_dependent: outcome accumulates from aggregate external behavior
 *   - mixed: goal contains dimensions from multiple authority classes
 *   - unknown: insufficient signal to classify
 *
 * Phase 1: detection and storage only. No gate enforcement. No trust-state effects.
 * Downstream enforcement is deferred to Phase 2+.
 *
 * Ownership rule: ALL authority classification logic lives here. No parallel
 * computation in autoStrategy, autoDeliverables, GoalPolicy, or GoalIntakeContract.
 * GoalIntakeContract calls deriveTerminalOutcomeAuthority once and stores the result.
 * All downstream reads go through the stored contract field.
 */

export type TerminalOutcomeAuthority =
  | 'fully_controllable'
  | 'externally_mediated'
  | 'market_dependent'
  | 'mixed'
  | 'unknown';

export type TerminalOutcomeAuthorityReason =
  | 'EXTERNAL_ACTOR_NAMED'       // named human decision-maker in text
  | 'RECEIVED_LANGUAGE'          // "received", "accepted", "signed", "approved"
  | 'THRESHOLD_METRIC_DETECTED'  // quantity/revenue threshold in verification text
  | 'SELF_CERTIFYING_ENDPOINT'   // binary artifact user creates or publishes
  | 'MULTIPLE_AUTHORITY_CLASSES' // mixed: >1 authority class detected in distinct clauses
  | 'INSUFFICIENT_SIGNAL';       // could not classify with confidence

export type TerminalOutcomeAuthorityResult = {
  authority: TerminalOutcomeAuthority;
  reasons: TerminalOutcomeAuthorityReason[];
  confidence: 'high' | 'medium' | 'low';
};

// ---------------------------------------------------------------------------
// Detection patterns
// ---------------------------------------------------------------------------

/** Received/accepted/approved language — strong externally_mediated signal */
const RECEIVED_PATTERN =
  /\b(received|accepted|signed|approved|offered|admitted|placed|selected|committed)\b/i;

/** Named external human decision-maker — strong externally_mediated signal */
const EXTERNAL_ACTOR_PATTERN =
  /\b(employer|investor|publisher|editor|client|customer|committee|board|recruiter|hiring\s+manager|venture\s+capital|angel\s+investor)\b/i;

/** Terminal commitment nouns — strong externally_mediated signal */
const OFFER_COMMITMENT_PATTERN =
  /\b(offer\s+letter|job\s+offer|term\s+sheet|investment\s+agreement|signed\s+agreement|letter\s+of\s+intent|acceptance\s+letter|contract\s+signed|purchase\s+order|signed\s+commitment)\b/i;

/** Verified financial transfer event — strong externally_mediated signal */
const WIRE_TRANSFER_PATTERN = /\b(wire\s+transfer|payment\s+received|funds\s+received|wire\s+confirmed)\b/i;

/** Goal-text framing patterns for externally mediated — medium signal */
const EXTERNALLY_MEDIATED_FRAMING_PATTERN =
  /\b(land\s+a\s+(?:job|role|position)|get\s+hired|raise\s+from|close\s+with|secure\s+funding|accepted\s+by|placed\s+with|funded\s+by)\b/i;

/** Quantity/audience threshold — strong market_dependent signal
 *  Allows optional intervening words between the number and the metric noun
 *  (e.g. "50 email sign-ups", "1,000 monthly listeners") */
const THRESHOLD_METRIC_PATTERN =
  /\b\d[\d,]*\s+(?:\w+\s+)?(monthly\s+)?(listeners?|followers?|subscribers?|customers?|users?|leads?|sign[\s-]?ups?|downloads?|views?|visitors?|page\s+views?)\b/i;

/** Revenue/MRR threshold — strong market_dependent signal */
const REVENUE_THRESHOLD_PATTERN =
  /\$[\d,]+\s*(mrr|arr|\/month|monthly|annual|recurring)/i;

/** Growth framing in goal text — medium market_dependent signal */
const GROWTH_FRAMING_PATTERN = /\b(grow\s+to\s+\d|reach\s+\d|acquire\s+\d+|generate\s+\d+|get\s+to\s+\d)\b/i;

/** Self-certifying completion — strong fully_controllable signal.
 *  "completed" excluded: too often used as an adjective on preparation artifacts
 *  ("completed resume", "completed draft") — use only when followed by terminal-scope nouns.
 *  "live" and "submitted" handled by separate, more precise patterns below. */
const SELF_CERTIFYING_PATTERN =
  /\b(deployed|published|built|launched|released|delivered|passed|finished|done)\b/i;

/** "completed" as terminal event — only when followed by a goal-scope terminal noun,
 *  not a preparation artifact. E.g. "challenge completed", "certification completed",
 *  "course completed", "project completed" → fc. "completed resume" → not fc. */
const COMPLETED_TERMINAL_PATTERN =
  /\bcompleted\s+(?:and\s+)?(successfully\s+)?(challenge|certification|course|module|program|project|race|marathon|training|audit|review)\b|\b(?:challenge|certification|course|module|program|project|race|marathon|training)\s+completed\b/i;

/** "submitted" as standalone completion — not when preceded by submission-target nouns
 *  (e.g. "applications submitted", "forms submitted" are progress metrics, not terminal artifacts).
 *  Uses fixed-width lookbehind to avoid V8 variable-length lookbehind limitation. */
const SUBMITTED_ARTIFACT_PATTERN = /\b(?<!applications?\s)(?<!documents?\s)(?<!forms?\s)(?<!files?\s)submitted\b/i;

/** "live" as deployed artifact ("page is live", "site live", "app live", "episodes are live") — not "live conversations".
 *  Allows optional "is"/"are" between the artifact noun and "live". */
const LIVE_ARTIFACT_PATTERN =
  /\b(page|site|app|product|service|store|listing|profile|episodes?|content|posts?)\s+(?:is\s+|are\s+)?live\b/i;

/** Outcome requires an external decision-maker granting an interview — strong externally_mediated signal.
 *  "Land 3 final-round interviews", "secure 2 interviews", etc. */
const INTERVIEW_LANDING_PATTERN =
  /\b(land|secure|book|get)\s+(?:\d+\s+)?(?:[\w-]+\s+){0,4}interviews?\b/i;

// ---------------------------------------------------------------------------
// Internal scoring
// ---------------------------------------------------------------------------

type Signals = {
  externallyMediatedStrong: number;
  externallyMediatedMedium: number;
  marketDependentStrong: number;
  marketDependentMedium: number;
  fullyControllableStrong: number;
};

function scoreText(text: string): Signals {
  return {
    externallyMediatedStrong:
      (RECEIVED_PATTERN.test(text) ? 1 : 0) +
      (EXTERNAL_ACTOR_PATTERN.test(text) ? 1 : 0) +
      (OFFER_COMMITMENT_PATTERN.test(text) ? 1 : 0) +
      (WIRE_TRANSFER_PATTERN.test(text) ? 1 : 0) +
      (INTERVIEW_LANDING_PATTERN.test(text) ? 1 : 0),
    externallyMediatedMedium: EXTERNALLY_MEDIATED_FRAMING_PATTERN.test(text) ? 1 : 0,
    marketDependentStrong:
      (THRESHOLD_METRIC_PATTERN.test(text) ? 1 : 0) + (REVENUE_THRESHOLD_PATTERN.test(text) ? 1 : 0),
    marketDependentMedium: GROWTH_FRAMING_PATTERN.test(text) ? 1 : 0,
    fullyControllableStrong:
      (SELF_CERTIFYING_PATTERN.test(text) ? 1 : 0) +
      (COMPLETED_TERMINAL_PATTERN.test(text) ? 1 : 0) +
      (SUBMITTED_ARTIFACT_PATTERN.test(text) ? 1 : 0) +
      (LIVE_ARTIFACT_PATTERN.test(text) ? 1 : 0),
  };
}

function isExternallyMediated(s: Signals): boolean {
  return s.externallyMediatedStrong >= 1 || s.externallyMediatedMedium >= 2;
}

function isMarketDependent(s: Signals): boolean {
  return s.marketDependentStrong >= 1;
}

function isFullyControllable(s: Signals): boolean {
  return s.fullyControllableStrong >= 1;
}

// ---------------------------------------------------------------------------
// Exported classifier
// ---------------------------------------------------------------------------

/**
 * Derives the terminal outcome authority class from goal and verification text.
 *
 * Deterministic. Pure. No side effects. No I/O.
 * Runs on combined text — Phase 1 does not attempt to separate evidence language
 * from outcome language (that is a known limitation; see RC-22 in audit records).
 */
export function deriveTerminalOutcomeAuthority(
  goalText: string,
  verificationText: string
): TerminalOutcomeAuthorityResult {
  const combined = `${goalText || ''} ${verificationText || ''}`.trim();

  if (!combined) {
    return {
      authority: 'unknown',
      reasons: ['INSUFFICIENT_SIGNAL'],
      confidence: 'low',
    };
  }

  const wholeScores = scoreText(combined);

  // Split into clauses to detect mixed authority across distinct outcome dimensions.
  // Sentence boundary only — full clause parsing is deferred (Phase 1 non-goal).
  const sentences = combined.split(/[.!?]+/).map((s) => s.trim()).filter(Boolean);
  const sentenceScores = sentences.map(scoreText);

  const anyExternallyMediated = isExternallyMediated(wholeScores);
  const anyMarketDependent = isMarketDependent(wholeScores);
  const anyFullyControllable = isFullyControllable(wholeScores);

  // Determine if multiple authority classes are present in distinct sentences
  const sentenceHasExternallyMediated = sentenceScores.some(isExternallyMediated);
  const sentenceHasMarketDependent = sentenceScores.some(isMarketDependent);
  const sentenceHasFullyControllable = sentenceScores.some(isFullyControllable);
  const distinctClassCount = [sentenceHasExternallyMediated, sentenceHasMarketDependent, sentenceHasFullyControllable].filter(Boolean).length;
  const isMixed = distinctClassCount >= 2;

  const reasons: TerminalOutcomeAuthorityReason[] = [];
  let strongSignals = 0;

  if (anyExternallyMediated) {
    if (wholeScores.externallyMediatedStrong >= 1) {
      if (RECEIVED_PATTERN.test(combined)) reasons.push('RECEIVED_LANGUAGE');
      if (EXTERNAL_ACTOR_PATTERN.test(combined) || OFFER_COMMITMENT_PATTERN.test(combined) || WIRE_TRANSFER_PATTERN.test(combined) || INTERVIEW_LANDING_PATTERN.test(combined)) {
        reasons.push('EXTERNAL_ACTOR_NAMED');
      }
      strongSignals += wholeScores.externallyMediatedStrong;
    }
  }

  if (anyMarketDependent) {
    reasons.push('THRESHOLD_METRIC_DETECTED');
    strongSignals += wholeScores.marketDependentStrong;
  }

  if (anyFullyControllable) {
    reasons.push('SELF_CERTIFYING_ENDPOINT');
    strongSignals += wholeScores.fullyControllableStrong;
  }

  if (isMixed) {
    reasons.push('MULTIPLE_AUTHORITY_CLASSES');
  }

  // Deduplicate reasons
  const uniqueReasons = [...new Set(reasons)] as TerminalOutcomeAuthorityReason[];

  if (uniqueReasons.length === 0) {
    return {
      authority: 'unknown',
      reasons: ['INSUFFICIENT_SIGNAL'],
      confidence: 'low',
    };
  }

  // Authority resolution — priority order per spec
  let authority: TerminalOutcomeAuthority;
  if (isMixed) {
    authority = 'mixed';
  } else if (anyExternallyMediated) {
    authority = 'externally_mediated';
  } else if (anyMarketDependent) {
    authority = 'market_dependent';
  } else if (anyFullyControllable) {
    authority = 'fully_controllable';
  } else {
    authority = 'unknown';
  }

  // Confidence: high = ≥2 strong signals, medium = 1 strong, low = medium signals only
  const confidence: 'high' | 'medium' | 'low' =
    strongSignals >= 2 ? 'high' : strongSignals === 1 ? 'medium' : 'low';

  return { authority, reasons: uniqueReasons, confidence };
}
