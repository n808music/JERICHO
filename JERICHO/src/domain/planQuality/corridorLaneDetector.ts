/**
 * corridorLaneDetector.ts
 *
 * Determines which terminal corridor lane applies given goal text and
 * verification text. Used by terminalStageDetector to select the correct
 * terminal-stage pattern set.
 *
 * Bounded to audited lanes only. If neither known lane fires, returns 'unknown'
 * and Phase 3 terminal-stage check is skipped. Unknown-lane goals are never
 * evaluated against projected corridor assumptions.
 *
 * Ownership rule: all lane classification logic lives here. No parallel lane
 * detection in autoStrategy, autoDeliverables, or the gate itself.
 *
 * Current audited lanes: JobSearch, Fundraising.
 * Future lanes (SalesPipeline, Publishing) require their own audit probe before
 * lane patterns are added.
 */

export type CorridorLane = 'JobSearch' | 'Fundraising' | 'unknown';

/**
 * JobSearch lane: user's terminal event is an employer extending a job offer.
 * Strong signal: explicit job-offer framing, employment outcome language, or
 * job-title + seniority framing that implies a hiring pipeline.
 */
const JOB_SEARCH_LANE_PATTERNS: RegExp[] = [
  /\b(get\s+(a|the)\s+(full.?time|part.?time|junior|senior|mid.?level)|land\s+(a|the)\s+(job|role|position))\b/i,
  /\b(hired\s+(as|at|by|for)|get\s+hired)\b/i,
  /\b(job\s+offer|offer\s+letter|full.?time\s+(role|position|job|employment))\b/i,
  /\b(junior|senior|mid.?level).{0,30}(developer|engineer|designer|analyst|manager|architect)\b/i,
  /\b(full.?time\s+employment|full.?time\s+job)\b/i,
];

/**
 * Fundraising lane: user's terminal event is an investor signing a commitment
 * and transferring funds.
 * Strong signal: dollar-amount raise framing, investor/funding vocabulary, or
 * explicit investment agreement language.
 */
const FUNDRAISING_LANE_PATTERNS: RegExp[] = [
  /\b(raise\s+\$[\d,]+|raising\s+\$[\d,]+)\b/i,
  /\b(raise|raising)\s+(seed|series|funding|capital|money|investment)\b/i,
  /\b(funding\s+round|seed\s+round|series\s+[abcde]|pre.?seed|pre.?series)\b/i,
  /\bsigned\s+investment\s+agreement\b/i,
  /\b(venture\s+capital|angel\s+investor)\b/i,
  /\b(investor|investment)\b.{0,50}\b(signed|committed|confirmed|received)\b/i,
];

/**
 * Returns the corridor lane for the given goal and verification text.
 * JobSearch takes precedence when both lane patterns fire (unlikely in practice).
 * Returns 'unknown' if neither lane is detected — callers must skip Phase 3
 * check when lane is 'unknown'.
 */
export function detectCorridorLane(
  goalText: string,
  verificationText: string,
): CorridorLane {
  const combined = `${goalText} ${verificationText}`;
  if (JOB_SEARCH_LANE_PATTERNS.some((p) => p.test(combined))) {
    return 'JobSearch';
  }
  if (FUNDRAISING_LANE_PATTERNS.some((p) => p.test(combined))) {
    return 'Fundraising';
  }
  return 'unknown';
}
