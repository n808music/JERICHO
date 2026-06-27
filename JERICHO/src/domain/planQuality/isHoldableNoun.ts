// Returns true when a string names a concrete deliverable — something the
// operator can point to, hand over, or link. Returns false for:
//   - Imperative verb phrases  ("Complete the report", "Build the API")
//   - Gerund-led action phrases ("Building the app")    [article required to fire]
//   - Past-participle phrases   ("Completed analysis", "Written spec")
//
// Gerund–noun compounds that function as nouns pass ("Marketing plan",
// "Reporting dashboard") because they lack a following article/determiner.

// Both patterns require a determiner/article after the leading word. This
// distinguishes imperative phrases ("Build the API", "Release the notes") from
// noun compounds ("Build notes", "Release notes", "Design system") where the
// same word functions as a noun modifier. The article is the reliable signal.
const DETERMINER = '(a|an|the|this|that|your|our|my|its|their|it)';

const IMPERATIVE_VERB_RE = new RegExp(
  `^(add|address|align|analyze|approve|archive|assess|audit|build|capture|check|clean|close|collect|complete|configure|confirm|connect|convert|coordinate|copy|create|define|delete|deliver|deploy|develop|discuss|document|draft|edit|ensure|establish|evaluate|execute|export|finalize|fix|gather|generate|get|handle|identify|implement|import|integrate|launch|make|merge|migrate|move|open|perform|prepare|present|process|produce|publish|pull|push|refine|reject|release|remove|rename|resolve|restore|schedule|send|share|ship|submit|sync|tag|test|transform|update|upload|validate|verify|write)\\s+${DETERMINER}\\b`,
  'i',
);

// "[verb]ing the/a/an/…" signals an action, not a noun. No article = passes.
const GERUND_ARTICLE_RE = new RegExp(
  `^[a-z]+ing\\s+${DETERMINER}\\b`,
  'i',
);

// "[verb]ed/[verb]en word" = past-participle phrase. Requires ≥2 base chars so
// short adjectives ("red", "led") don't fire.
const PARTICIPLE_RE = /^[a-z]{2,}(ed|en)\s+\S/i;

export function isHoldableNoun(str: string): boolean {
  const s = String(str ?? '').trim();
  if (!s) return false;
  if (IMPERATIVE_VERB_RE.test(s)) return false;
  if (GERUND_ARTICLE_RE.test(s)) return false;
  if (PARTICIPLE_RE.test(s)) return false;
  return true;
}
