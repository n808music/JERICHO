// Phase Assignment Rule at the Project grain (E15 Sites 1/4, 2026-08-23).
//
//   Phase(Project) = the spine window containing that Project's Terminal Deadline.
//   Computed independently per node. Never hand-typed, never inherited, never dependency-derived.
//
// Shared by both read sites (phaseFromDependencies.deriveEffectiveProjectPhases and
// phaseGridFromStore.resolveNodePhase) so there is exactly one normalization path, not two that
// can drift apart. That single-source property is the entire point of E15 — a second copy here
// would recreate the problem the item exists to remove.
//
// Three contract boundaries this function exists to absorb, each of which produced a real defect
// or near-defect when it was not handled:
//
//   1. PERIOD FORMS. computeSpineWindowPhase() takes a strict YYYY-MM-DD (after trim and
//      truncation to 10 chars) and returns null for anything else. Real targetDate values are
//      messier — '2026', '2028-2030', '2026-2027 (pt. 1 by 2026-10-17)'. phaseSort.deadlineKey()
//      already resolves these, and its "due by the END of that period" semantic (phaseSort.js:3-5)
//      is adopted here unchanged rather than forked. Confirmed 2026-08-23 against the v1.4
//      workbook: end-of-period reproduces 11 of 14 dated Projects. The 3 that disagree are stale
//      fixture imprecision, not a defect here — a period form is an underspecified stand-in for a
//      Terminal Date, which doctrine says is a single point in time. See E16 §7 / E15 §4.
//
//   2. THE SENTINEL. deadlineKey() maps null/empty/TBD to '9999-12-31' — a SORT key, not a date.
//      Forwarding it would window to P3 and hand every dateless Project a confident, wrong Phase:
//      the same failure class as the calendar-rollover bug 765dee5 fixed, one layer out. Guarded
//      before normalizing AND re-checked after, so the sentinel cannot escape by any path.
//
//   3. THE RETURN TYPE. computeSpineWindowPhase() returns 'P1'|'P2'|'P3'. Every consumer at both
//      sites buckets on numeric 1|2|3: toCanonicalPhase('P1') is NaN -> null (silent residual) and
//      classifyPhase('P1') throws. Converting here, once, keeps that mismatch from becoming a
//      silent always-null at the interface boundary.
import { deadlineKey } from './phaseSort.js';
import { computeSpineWindowPhase } from './computeSpineWindowPhase.ts';

const SPINE_TO_CANONICAL = { P1: 1, P2: 2, P3: 3 };

/**
 * Resolve a raw targetDate to a strict ISO date suitable for computeSpineWindowPhase().
 * Absent, blank, or TBD -> null (a legitimate unknown, never a default).
 *
 * @param {string|null|undefined} rawTargetDate
 * @returns {string|null} strict YYYY-MM-DD, or null
 */
export function normalizeTargetDateForPhase(rawTargetDate) {
  if (!rawTargetDate) return null;
  const s = String(rawTargetDate).trim();
  if (!s || /TBD/i.test(s)) return null;
  const key = deadlineKey(s);
  // Belt-and-braces: deadlineKey's sentinel must never reach the window comparison.
  return key === '9999-12-31' ? null : key;
}

/**
 * Phase for a Project-grain node, computed from its own terminal date.
 *
 * @param {{targetDate?: string|null}|null|undefined} node
 * @returns {1|2|3|null} canonical phase, or null when no usable terminal date exists
 */
export function computeProjectSpinePhase(node) {
  const normalized = normalizeTargetDateForPhase(node?.targetDate);
  if (normalized == null) return null;
  // nextMilestone/isOngoing are passed as (null, false) deliberately: NEITHER FIELD EXISTS on any
  // node in identityCompute.js (verified 2026-08-23, zero occurrences). The doctrine's "or Next
  // Milestone if genuinely ongoing" clause has no source field at this grain and is therefore
  // unimplementable today — recorded rather than faked. If those fields are ever added, this is
  // the single place that needs to start reading them.
  const window = computeSpineWindowPhase(normalized, null, false);
  return window == null ? null : (SPINE_TO_CANONICAL[window] ?? null);
}
