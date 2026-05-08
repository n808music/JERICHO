/**
 * splitEndpointCoverageDetector.ts
 *
 * Detects whether a deliverable set has at least minimal representation of a
 * given terminal endpoint dimension. Used by Phase D of the outcome validity
 * gate to check secondary-endpoint coverage for split goals.
 *
 * This is a DIMENSION-PRESENCE check, not a corridor-completeness check.
 * A deliverable need only be semantically related to the endpoint type —
 * it does not need to satisfy Phase 2/3 contact-stage or terminal-stage
 * requirements. The goal is to detect zero coverage, not to re-enforce
 * corridor requirements on a second dimension.
 *
 * Ownership rule: all split endpoint coverage logic lives here.
 * No parallel detection in the gate, autoStrategy, or autoDeliverables.
 *
 * Coverage patterns here are intentionally broader than terminal-stage patterns.
 * Additions require a negative test confirming the opposite endpoint type does
 * not fire (e.g., adding a fundraising pattern must not fire on job-search
 * deliverables and vice versa).
 */

import type { TerminalEndpointObject } from '../goal/terminalEndpointDetector.ts';

// ---------------------------------------------------------------------------
// JobSearch dimension: hiring corridor vocabulary
// Any deliverable representing preparation for, execution of, or tracking
// within a job search pipeline.
// ---------------------------------------------------------------------------

const JOB_SEARCH_DIMENSION_PATTERNS: RegExp[] = [
  /\b(apply|applying|application|applications)\b/i,
  /\bsubmit\b.{0,25}\b(application|resume|candidacy)\b/i,
  /\b(resume|cv|portfolio)\b.{0,25}\b(for|roles?|positions?|target)\b/i,
  /\btarget\s+(role|company|employer|companies|roles|positions)\b/i,
  /\b(job|role|position)\s+(search|pipeline|tracker|list)\b/i,
  /\boutreach\b.{0,40}\b(employers?|recruiters?|hiring)\b/i,  // extended to cover "30 target employers"
  /\binterview\b.{0,30}\b(at|with|for|prep|practice|story|stages?)\b/i,
  /\bjob\s+offers?\b/i,
  /\boffer\s+letters?\b/i,
  /\b(offers?\s+(received|accepted|evaluated|signed|letter))\b/i,
  /\b(recruiters?|hiring\s+manager|employers?)\b/i,
];

// ---------------------------------------------------------------------------
// Fundraising dimension: investor/capital corridor vocabulary
// Any deliverable representing preparation for, execution of, or tracking
// within a fundraising pipeline.
// ---------------------------------------------------------------------------

const FUNDRAISING_DIMENSION_PATTERNS: RegExp[] = [
  /\b(investor|investors)\b/i,
  /\b(pitch\s+deck|fundraising\s+narrative|deck\s+storyline)\b/i,
  /\b(raise|raising|raise\s+objective|raise\s+target)\b/i,
  /\b(diligence|data\s+room|term\s+sheet|commitment)\b/i,
  /\boutreach\b.{0,30}\b(investor|investor\s+list)\b/i,
  /\b(investor\s+list|target\s+investor|angel|venture)\b/i,
  /\b(funding|capital)\b.{0,25}\b(round|raise|objective|secured)\b/i,
  /\bclose\s+(round|the\s+round|process)\b/i,
  /\b(wire\s+transfer|signed\s+(commitment|agreement))\b/i,
];

// ---------------------------------------------------------------------------
// Published/live dimension: release and content distribution vocabulary
// ---------------------------------------------------------------------------

const PUBLISHED_LIVE_DIMENSION_PATTERNS: RegExp[] = [
  /\b(publish|publishing|published)\b/i,
  /\b(episode|episodes)\b/i,
  /\b(podcast|audio|content)\b.{0,25}\b(record|edit|produce|release|live)\b/i,
  /\b(release|releasing|released)\b/i,
  /\b(distribute|distribution|go\s+live)\b/i,
  /\b(rss|spotify|apple\s+podcasts|directory|directories)\b/i,
];

// ---------------------------------------------------------------------------
// Artifact-complete dimension: build/deploy/launch vocabulary
// Broader than Phase 3's artifact_complete — catches any build-related work.
// ---------------------------------------------------------------------------

const ARTIFACT_COMPLETE_DIMENSION_PATTERNS: RegExp[] = [
  /\b(build|building|built)\b.{0,30}\b(page|site|app|product|feature|tool|portfolio|project)\b/i,
  /\b(develop|developing|development)\b.{0,30}\b(page|site|app|product|feature|tool|core|mvp)\b/i,
  /\b(deploy|deploying|deployed|deployment)\b/i,
  /\b(launch|launching|launched)\b.{0,25}\b(page|site|app|product|feature|tool)\b/i,
  /\b(create|creating)\b.{0,25}\b(page|site|app|product|feature|tool)\b/i,
  /\b(portfolio\s+project|project\s+\d|project\s+one|first\s+project)\b/i,
  /\b(page|site|app|product|feature|tool)\b.{0,25}\b(live|working|complete|done)\b/i,
];

// ---------------------------------------------------------------------------
// Audience/revenue threshold dimension: distribution and growth vocabulary
// ---------------------------------------------------------------------------

const MARKET_THRESHOLD_DIMENSION_PATTERNS: RegExp[] = [
  /\b(growth|growing|grow)\b/i,
  /\b(audience|subscribers|listeners|followers|users)\b/i,
  /\b(distribution|distribute|channel|channels)\b/i,
  /\b(marketing|promote|promotion|advertise)\b/i,
  /\b(email\s+list|newsletter|sign.?ups?)\b/i,
  /\b(revenue|mrr|arr|recurring)\b/i,
  /\b(reach|traffic|views|impressions)\b/i,
];

// ---------------------------------------------------------------------------
// Qualification dimension: study/exam/credential vocabulary
// ---------------------------------------------------------------------------

const CERTIFICATION_DIMENSION_PATTERNS: RegExp[] = [
  /\b(study|studying|coursework|course|curriculum)\b/i,
  /\b(exam|test|assessment)\b/i,
  /\b(certification|certificate|credential|license)\b/i,
  /\b(practice\s+(exams?|tests?|problems?|questions?))\b/i,
  /\b(module|lesson|unit)\b/i,
];

// ---------------------------------------------------------------------------
// Main function
// ---------------------------------------------------------------------------

/**
 * Returns true if the deliverable set has at least one deliverable with
 * vocabulary related to the given secondary endpoint dimension.
 *
 * Returns true for 'unknown' endpoint — no check applies.
 * Returns true if deliverableTitles is empty (no negative signal without data).
 *
 * This is a dimension-presence check. A true result means at least one
 * deliverable is semantically in the right corridor. It does NOT mean
 * that corridor has contact-stage or terminal-stage coverage — those are
 * Phase 2/3 responsibilities.
 */
export function hasSecondaryEndpointCoverage(
  secondaryEndpoint: TerminalEndpointObject,
  deliverableTitles: string[],
): boolean {
  if (secondaryEndpoint === 'unknown') return true;
  if (deliverableTitles.length === 0) return true;

  const patterns = selectPatterns(secondaryEndpoint);
  if (patterns.length === 0) return true; // unhandled endpoint type — no check

  return deliverableTitles.some(
    (title) => title && patterns.some((p) => p.test(title)),
  );
}

function selectPatterns(endpoint: TerminalEndpointObject): RegExp[] {
  switch (endpoint) {
    case 'offer_received':
    case 'hired':
      return JOB_SEARCH_DIMENSION_PATTERNS;
    case 'capital_secured':
    case 'signed_commitment':
      return FUNDRAISING_DIMENSION_PATTERNS;
    case 'published_live':
      return PUBLISHED_LIVE_DIMENSION_PATTERNS;
    case 'artifact_complete':
      return ARTIFACT_COMPLETE_DIMENSION_PATTERNS;
    case 'first_sale_completed':
    case 'audience_threshold':
    case 'revenue_threshold':
      return MARKET_THRESHOLD_DIMENSION_PATTERNS;
    case 'certification_earned':
      return CERTIFICATION_DIMENSION_PATTERNS;
    case 'unknown':
      return [];
  }
}
