// Controlled vocabulary for the plan-quality / substance gates. Both lists are FROZEN
// (Gate 6 lock, 2026-07-17) — see vocabularyLock.test.ts. Adding or removing a term is a
// deliberate edit here plus a matching edit to the lock test; it must never drift silently.

// Leading management verbs that signal shell phrases (not concrete action verbs). Only
// flagged at the START of the string — the reliable indicator. Base forms; the trailing-'s'
// variant (manage/manages) is applied when the regex is built.
export const LEAD_MGMT_VERBS: readonly string[] = [
  'manage', 'drive', 'deliver', 'enable', 'facilitate', 'leverage', 'execute', 'support', 'coordinate',
];

// Dead nouns that signal empty management-speak. Countable nouns carry BOTH forms
// (singular + plural). 'values' is blocklisted per the 2026-07-17 ruling: the list is
// clarity enforcement at the boundary, not word-policing — "values" used as a goal/status
// word is management-speak; concrete principles get named concretely, not as bare "values".
export const JARGON_WORDS: readonly string[] = [
  'solution', 'solutions',
  'capability', 'capabilities',
  'synergy', 'synergies',
  'alignment', 'alignments',
  'transformation', 'transformations',
  'paradigm', 'paradigms',
  'competency', 'competencies',
  'efficiency', 'efficiencies',
  'excellence', 'bandwidth', 'traction', 'value', 'values',
  'synergize', 'ideate', 'optimize', 'optimization',
];

const LEAD_MGMT_VERB_RE = new RegExp(`^(${LEAD_MGMT_VERBS.map((v) => `${v}s?`).join('|')})\\b`, 'i');
const JARGON_WORDS_RE = new RegExp(`\\b(${JARGON_WORDS.join('|')})\\b`, 'i');

export function isAbstractJargon(text: string): boolean {
  const s = String(text ?? '').trim();
  if (!s) return false;
  if (LEAD_MGMT_VERB_RE.test(s)) return true;
  if (JARGON_WORDS_RE.test(s)) return true;
  return false;
}
