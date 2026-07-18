import { isHoldableNoun } from './isHoldableNoun';
import { isAbstractJargon } from './isAbstractJargon';

// Rescue: past-participle openers that describe status rather than label a deliverable.
// "Named only, no real estate owned or controlled" starts with "Named" (PARTICIPLE_RE fires)
// but has comma-separated evidence — it's a concrete status description, not a blank label.
function hasConcreteRescue(s: string): boolean {
  return /,\s*\S+\s+\S+/.test(s);
}

// Honest incompleteness: user says they don't know yet or it's not applicable.
// Rule 6: "haven't figured that out yet" MUST pass gates. Vague shells must reprobe.
// Incompleteness is a factual capture; jargon is evasion. They are not the same.
// 2026-07-10: "needs strategy" family added — naming the missing prerequisite
// ("needs strategy", "needs a plan", "not defined yet") is a factual capture
// of incompleteness, same doctrine as "haven't figured that out". A shell like
// "drives growth" pretends to answer; "needs strategy" admits it can't yet.
const HONEST_INCOMPLETENESS_RE =
  /^(not\s+started|haven'?t\s+started|not\s+sure|unsure|haven'?t\s+decided|haven'?t\s+figured\s+(that\s+)?out(\s+yet)?|to\s+be\s+determined|tbd|unknown|n\/a|not\s+applicable|none\s+yet|no\s+deadline|no\s+fixed\s+dates?|pending|later|skip|pass|not\s+yet|needs\s+(a\s+)?(strategy|plan|planning|definition|research|scoping)|no\s+(strategy|plan)\s+yet|not\s+defined(\s+yet)?|undecided|still\s+deciding)$/i;

// Exported so EVERY authored-field validator honors the same Rule 6 doctrine.
// 2026-07-10: "needs strategy" passed purpose (hasAuthoredSubstance) but was
// rejected on doneWhen (isExternallyVerifiable) — the operator experienced
// the escape hatch "not working consistently". One rule, shared everywhere.
export function isHonestIncompleteness(text: string): boolean {
  return HONEST_INCOMPLETENESS_RE.test(String(text ?? '').trim());
}

export function hasAuthoredSubstance(text: string): boolean {
  const s = String(text ?? '').trim();
  if (!s) return false;
  if (HONEST_INCOMPLETENESS_RE.test(s)) return true;
  if (isAbstractJargon(s)) return false;
  if (isHoldableNoun(s)) return true;
  if (hasConcreteRescue(s)) return true;
  return false;
}
