// Coarse floor check for successMetric fields. Returns true when the string
// carries at least one quantifiable signal. Returns false ONLY when all three
// conditions are true simultaneously:
//   1. no numeral present
//   2. no discrete-completion keyword present
//   3. the value is in the unbounded-quality lexicon
//
// This is a floor, not a judge. Subtle vagueness that contains a numeral or a
// milestone word passes — that is intentional. The read-back step, not this
// gate, handles semantic quality. Do not expand this toward semantic judgment.

const HAS_NUMERAL = /\d/;

// Past-tense / past-participle milestone verbs that indicate a discrete binary
// outcome. A metric phrased as one of these is a valid completion criterion
// even without a numeral.
const DISCRETE_COMPLETION_RE =
  /\b(signed|shipped|published|accepted|launched|approved|released|listed|certified|distributed|submitted|sold|delivered|filed|funded|placed|broadcast|premiered)\b/i;

// Small, intentionally coarse lexicon of unbounded quality words.
// Keep this list small. If in doubt, leave it out — the floor defaults to pass.
const UNBOUNDED_QUALITY_RE =
  /\b(do well|grow|improve|increase|more|better|succeed|success|progress)\b/i;

export function isQuantifiableMetric(str: string): boolean {
  const s = String(str ?? '').trim();
  if (!s) return false;
  if (HAS_NUMERAL.test(s)) return true;
  if (DISCRETE_COMPLETION_RE.test(s)) return true;
  if (UNBOUNDED_QUALITY_RE.test(s)) return false;
  return true;
}
