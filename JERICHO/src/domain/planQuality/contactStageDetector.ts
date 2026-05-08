/**
 * contactStageDetector.ts
 *
 * Detects whether a set of deliverable titles contains at least one deliverable
 * that represents a direct-contact stage with an external party.
 *
 * A contact-stage deliverable is one where the user initiates live engagement
 * with the external decision-maker: applying, submitting, pitching, meeting,
 * outreaching, sending to, or presenting at. This is distinct from:
 *
 *   - Preparation deliverables: define, build, prepare, create, establish, draft
 *   - Internal review deliverables: review, audit, check, run readiness
 *   - Tracking deliverables: log, document, manage pipeline
 *
 * Phase 2 scope: used only for `externally_mediated` authority class goals.
 * Fully_controllable and market_dependent goals are not checked here.
 *
 * Ownership rule: all contact-stage verb detection lives here. The gate imports
 * this function and calls it once. No parallel detection in autoStrategy or
 * autoDeliverables.
 *
 * Bounded vocabulary — additions require explicit justification and must include
 * negative-case tests (see contactStageDetector.test.ts).
 */

/**
 * Contact-stage verbs: user initiates live engagement with the external party.
 * Each entry is bounded to avoid substring collisions.
 *
 * Explicit exclusions and why:
 *   - "build" → preparation, not contact (build a list ≠ contact the list)
 *   - "prepare" → preparation artifact (prepare outreach scripts ≠ send them)
 *   - "create" → preparation (create a tracker ≠ use it)
 *   - "define" → scoping, not contact
 *   - "establish" → internal baseline
 *   - "run" → ambiguous: "run mock interviews" is internal drill, not employer contact
 *     BUT "run first wave of investor outreach and meetings" contains "outreach" and
 *     "meetings" which fire separately — "run" itself is excluded
 *   - "log" → tracking, not contact
 *   - "manage" → pipeline management, not initial contact
 *   - "track" → same
 *   - "coordinate" → post-decision process management (e.g. "Coordinate term discussions")
 *   - "finalize" → close-process management, not external decision initiation
 */
const CONTACT_STAGE_VERB_PATTERNS: RegExp[] = [
  // Application submission
  /\bsubmit\b/i,
  /\bappl(?:y|ied|ying|ication batch)\b/i,

  // Direct outreach to named external parties.
  // "outreach to" fires (outreach directed at someone).
  // "outreach and meetings" fires (paired with live contact noun).
  // "outreach sequences" does NOT fire — that is preparation of scripts, not execution.
  /\boutreach\s+(?:to|and\s+meetings?|and\s+(?:investor|employer|client))\b/i,
  /\bsend\s+(?:application|proposal|pitch|message|email|intro|outreach)\b/i,
  /\bsent\s+(?:application|proposal|pitch|message|email|intro|outreach)\b/i,

  // Pitch / present
  // "deck" excluded: "pitch deck" is a preparation artifact (build the deck),
  // not the act of pitching. "Send pitch deck to investors" fires via the send pattern.
  /\bpitch(?:ing|ed)?\s+(?:to|investor|client|employer)\b/i,
  /\bpresent(?:ing|ed|ation)?\s+(?:to|at|pitch)\b/i,

  // Live meetings with external parties — requires indication of external party
  /\bmeeting[s]?\s+(?:with|investor|employer|client|recruiter)\b/i,
  /\binvestor\s+(?:meeting|outreach|conversation|call)\b/i,
  /\bemployer\s+(?:meeting|conversation|interview|call)\b/i,
  /\bclient\s+(?:meeting|call|conversation|pitch|intro)\b/i,

  // Interview (user participates as candidate — external party conducts)
  /\binterview\s+(?:with|at|for|stage|process)\b/i,
  /\binterview(?:ing|ed)\s+(?:at|with|for)\b/i,
  // "active interview processes" is tracking — exclude bare "interview" without context
  // "mock interview" is internal drill — excluded (requires "with" or "at" qualifier above)

  // Wave / batch execution
  /\bfirst\s+(?:wave|batch|round)\s+of\s+(?:investor|employer|client|application|outreach)\b/i,
  /\bapplication\s+batch\b/i,
];

/**
 * Returns true if the given deliverable title represents a direct-contact stage.
 * A title is a contact stage if it matches any CONTACT_STAGE_VERB_PATTERN
 * AND does not match any PREP_ONLY_PATTERN alone (prep patterns are overridden
 * by contact patterns).
 */
export function isContactStageDeliverable(title: string): boolean {
  if (!title || !title.trim()) return false;
  return CONTACT_STAGE_VERB_PATTERNS.some((pattern) => pattern.test(title));
}

/**
 * Returns true if the deliverable set contains at least one contact-stage
 * deliverable for an externally mediated goal.
 *
 * A deliverable set with zero contact-stage deliverables is a prep-only plan —
 * it covers preparation toward the external decision but never reaches the
 * stage where the external party is engaged.
 */
export function hasContactStageDeliverable(deliverableTitles: string[]): boolean {
  return deliverableTitles.some(isContactStageDeliverable);
}
