/**
 * Canonical action-verb vocabulary for block-title actionability checks.
 *
 * Two evaluators inspect whether a block title starts with an imperative
 * action verb: evaluatePlanQualityGate (cross-cutting plan quality) and
 * fullHorizonBlockQuality (per-block forecast quality). They previously
 * maintained independent vocabularies; titles approved by one validator
 * could fail the other, cascading into trust-state degradation that did
 * not reflect actual block-title quality.
 *
 * This module is the single source of truth. New verbs added here become
 * accepted by both validators; both validators reject anything not here.
 *
 * The union covers two intents:
 *   - broad business execution verbs (ship, draft, finalize, run, …)
 *   - strategic plan-block verbs (institutionalize, formalize, widen, …)
 *
 * Do not branch this set per validator; add the verb here.
 */
export const ACTION_VERB_SET: ReadonlySet<string> = new Set([
  // Cross-cutting plan-quality verbs
  'activate', 'analyze', 'archive', 'assemble', 'assess', 'audit',
  'backup', 'brief', 'build',
  'close', 'collect', 'communicate', 'compile', 'complete', 'configure', 'confirm', 'connect',
  'consolidate', 'coordinate', 'create',
  'debug', 'define', 'deliver', 'demo', 'deploy', 'design', 'develop', 'document', 'draft',
  'establish', 'evaluate', 'execute',
  'finalize', 'fix', 'gather', 'generate', 'harden', 'hire',
  'identify', 'implement', 'improve', 'integrate',
  'launch', 'map', 'measure', 'migrate', 'model', 'monitor',
  'onboard', 'optimize', 'outline', 'package', 'plan', 'prepare', 'present', 'produce',
  'prototype', 'publish',
  'reconcile', 'record', 'release', 'resolve', 'review', 'revise', 'run',
  'secure', 'select', 'sequence', 'set', 'share', 'ship', 'stress-test', 'submit', 'sync',
  'test', 'track', 'train', 'update', 'validate', 'verify', 'write',
  // Strategic plan-block verbs (previously only in fullHorizonBlockQuality)
  'compare', 'convert', 'delegate', 'expand', 'formalize',
  'gate', 'institutionalize', 'prove', 'reassess', 'stabilize', 'widen',
  // Schedule-generator verbs surfaced by Operation Endgame fixture drift
  // (2026-06-11). Each is a genuinely imperative business action that the
  // OE generator emits. ('re-clarify' removed 2026-07-17 — the generator titles
  // it served were redesigned to 'Revise …'; see fullHorizonScheduleExpansion.js.)
  'author', 'capture', 'clarify', 'enrich', 'groom',
  'log', 'qualify', 'source', 'summarize', 'triage',
  // Milestone-generator surfaced verbs (2026-06-13): "advance" is the
  // imperative business verb used by EP/release milestone templates
  // ("Advance EP release distribution setup, …"). Keeping it in the
  // canonical set lets the generator detect titles that are already
  // actionable and avoid double-verb prefixes like "Complete Advance …".
  'advance',
]);

export function isActionableTitleVerb(firstWord: string | null | undefined): boolean {
  if (!firstWord) return false;
  return ACTION_VERB_SET.has(String(firstWord).trim().toLowerCase());
}
