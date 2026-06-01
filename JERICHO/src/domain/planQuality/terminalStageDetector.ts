/**
 * terminalStageDetector.ts
 *
 * Detects whether a set of deliverable titles contains at least one deliverable
 * that represents the terminal corridor stage for the given lane.
 *
 * The terminal corridor stage is the point at which the external party's decision
 * is the blocking event. It is distinct from:
 *
 *   - Stage 0 — Preparation: controllable artifacts enabling external engagement
 *   - Stage 1 — Contact: direct external engagement begins (Phase 2 enforces)
 *   - Stage 2 — Evaluation: external party conducts assessment or due diligence
 *   - Stage 3 — Terminal: external party's decision is the blocking event (here)
 *
 * Detection invariant (binding for all patterns):
 *   Terminal-stage detection is anchored on lane-specific terminal objects and
 *   events, NOT on generic completion verbs. Every pattern must have a
 *   load-bearing terminal object — if that object is removed from a title, the
 *   pattern must not fire.
 *
 *   Generic late-stage verbs (finalize, coordinate, manage, complete) do not
 *   independently confer terminal-stage coverage. They are tolerated alongside
 *   terminal objects but cannot substitute for them.
 *
 *   Before adding any pattern, confirm: what is the load-bearing terminal object?
 *   If you cannot name it, the pattern is over-broad.
 *
 * Bounded vocabulary — additions require:
 *   1. Explicit identification of the load-bearing terminal object
 *   2. A negative-case test confirming Stage 0/1/2 deliverables do not fire
 *
 * Phase 3 scope: JobSearch and Fundraising lanes only.
 * Future lanes (SalesPipeline, Publishing) require their own audit probe.
 * Unknown lane → returns true (no check applied — caller responsibility).
 *
 * Ownership rule: all terminal-stage pattern detection lives here.
 * No parallel detection in autoStrategy, autoDeliverables, or contactStageDetector.
 */

import type { CorridorLane } from './corridorLaneDetector.ts';

/**
 * JobSearch terminal-stage patterns.
 *
 * Load-bearing terminal object: `offer` or `offer letter`.
 *
 * The external decision (employer extends an offer) is the blocking event.
 * All patterns require `offer` or `offer letter` as the anchor.
 *
 * Explicit Stage 2 exclusions:
 *   - "Interview at/with target companies" → Stage 2 (evaluation), no offer object
 *   - "Complete interviews" → Stage 2, no offer object
 *   - "Log responses and manage active interview stages" → tracking, no offer object
 *   - "Prepare interview story bank" → Stage 0, no offer object
 *   - "Run mock interviews" → Stage 0 (internal drill), no offer object
 */
const JOB_SEARCH_TERMINAL_PATTERNS: RegExp[] = [
  // Offer letter as artifact — terminal object: "offer letter"
  /\boffer\s+letters?\b/i,

  // Job offer as event — terminal object: "job offer(s)"
  /\bjob\s+offers?\b/i,

  // Receive/evaluate/accept/negotiate/sign + offer(s) — terminal object: "offer"
  /\b(receive|evaluate|accept|negotiate|sign|respond\s+to)\b.{0,30}\boffers?\b/i,

  // Offer(s) received/accepted/evaluated/negotiated/signed — terminal object: "offer"
  /\boffers?\b.{0,30}\b(received|accepted|evaluated|negotiated|signed|letter)\b/i,

  // Confirm start date / onboarding — terminal object: "start date" / "onboard"
  // Only fires when employment is confirmed — confirms offer acceptance occurred
  /\b(employment\s+confirmed|confirm\s+start\s+date|onboarding\s+confirmed)\b/i,

  // Accept position/role — terminal object: "position" or "role" with accept verb
  // Requires "accept" to avoid firing on "evaluate role requirements" (Stage 0)
  /\baccept(ed|ing)?\s+(the\s+)?(position|role)\b/i,
];

/**
 * Fundraising terminal-stage patterns.
 *
 * Load-bearing terminal objects: `term sheet`, `commitment`, `signed agreement`,
 * `wire transfer`, `close` (round/process), `legal close`, `funds received`.
 *
 * The external decision (investor signs and transfers) is the blocking event.
 * Generic verbs (finalize, coordinate, manage) are allowed when paired with
 * a recognized terminal object.
 *
 * Explicit Stage 0/1/2 exclusions:
 *   - "Deliver follow-up materials and manage diligence requests" → Stage 2, no terminal object
 *   - "Prepare outreach sequences and intro request scripts" → Stage 0, no terminal object
 *   - "Run fundraising readiness review" → Stage 0, no terminal object
 *   - "Create diligence checklist and data room structure" → Stage 0, no terminal object
 *   - "Coordinate" alone without term/commitment context → process management, not terminal
 */
const FUNDRAISING_TERMINAL_PATTERNS: RegExp[] = [
  // Term sheet — terminal object: "term sheet"
  /\bterm\s+sheet\b/i,

  // Term discussions/negotiations — terminal object: "term" (in term discussions)
  // "term" in fundraising context with discussions/negotiations implies post-conditional-commitment
  /\bterm\s+(discussions?|negotiations?|review|agreement)\b/i,

  // Commitment — terminal object: "commitment"
  // "commitment tracking" and "signed commitment" are terminal; "pipeline management" is not
  /\b(commitment\s+tracking|signed\s+commitment|investor\s+commitments?)\b/i,

  // Close round/process — terminal object: "close" (round/process)
  /\bclose\s+(round|the\s+round|process|documentation)\b/i,
  /\bclose\s+round\b/i,

  // Legal close — terminal object: "legal close"
  /\blegal\s+close\b/i,

  // Signed agreement/investment — terminal object: "signed" + agreement/investment
  /\b(signed|received)\s+(investment|agreement|term)\b/i,
  /\b(investment|agreement)\b.{0,25}\b(signed|confirmed|closed|received)\b/i,

  // Wire transfer — terminal object: "wire transfer" or "wire confirmation"
  /\bwire\s+(transfer|confirmation|confirmed)\b/i,

  // Funds received/confirmed — terminal object: "funds"
  /\bfunds?\s+(received|confirmed|transferred)\b/i,

  // Final close/sign — terminal object: "close" or "sign" in final-stage context
  // Requires "final" qualifier to prevent generic "sign off" from firing
  /\bfinal\s+(close|documentation\s+and\s+sign|sign)\b/i,
];

/**
 * Returns true if the deliverable set contains at least one terminal-stage
 * deliverable for the given corridor lane.
 *
 * Returns true immediately for 'unknown' lane — the Phase 3 check is the
 * caller's responsibility to skip when lane is unknown. The detector itself
 * does not withhold for unknown lanes.
 */
export function hasTerminalStageDeliverable(
  lane: CorridorLane,
  deliverableTitles: string[],
): boolean {
  if (lane === 'unknown') return true;

  const patterns =
    lane === 'JobSearch' ? JOB_SEARCH_TERMINAL_PATTERNS : FUNDRAISING_TERMINAL_PATTERNS;

  return deliverableTitles.some((title) =>
    title ? patterns.some((p) => p.test(title)) : false,
  );
}
