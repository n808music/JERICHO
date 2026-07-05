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
const HONEST_INCOMPLETENESS_RE =
  /^(not\s+started|haven'?t\s+started|not\s+sure|unsure|haven'?t\s+decided|haven'?t\s+figured\s+(that\s+)?out(\s+yet)?|to\s+be\s+determined|tbd|unknown|n\/a|not\s+applicable|none\s+yet|no\s+deadline|no\s+fixed\s+dates?|pending|later|skip|pass|not\s+yet)$/i;

export function hasAuthoredSubstance(text: string): boolean {
  const s = String(text ?? '').trim();
  if (!s) return false;
  if (HONEST_INCOMPLETENESS_RE.test(s)) return true;
  if (isAbstractJargon(s)) return false;
  if (isHoldableNoun(s)) return true;
  if (hasConcreteRescue(s)) return true;
  return false;
}
