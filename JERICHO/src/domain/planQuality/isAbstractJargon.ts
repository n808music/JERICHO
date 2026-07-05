// Leading management verbs that signal shell phrases (not concrete action verbs).
// Only flagged at the start of the string — that's the reliable indicator.
const LEAD_MGMT_VERB_RE =
  /^(manages?|drives?|delivers?|enables?|facilitates?|leverages?|executes?|supports?|coordinates?)\b/i;

// Dead nouns that signal empty management-speak.
// Bounded to Operation Endgame corpus — grows when a real in-domain shell slips through.
// Singular and plural forms listed separately; singulars added when only the plural was present.
const JARGON_WORDS_RE =
  /\b(solution|solutions|capability|capabilities|synergy|synergies|alignment|excellence|transformation|bandwidth|traction|value|paradigm|competency|efficiency|synergize|ideate|optimize|optimization)\b/i;

export function isAbstractJargon(text: string): boolean {
  const s = String(text ?? '').trim();
  if (!s) return false;
  if (LEAD_MGMT_VERB_RE.test(s)) return true;
  if (JARGON_WORDS_RE.test(s)) return true;
  return false;
}
