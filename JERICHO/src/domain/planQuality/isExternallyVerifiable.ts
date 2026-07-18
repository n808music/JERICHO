import { isHonestIncompleteness } from './hasAuthoredSubstance';

// Internal-attestation patterns — a third party cannot observe these.
const ATTESTATION_BREACH_RES = [
  /\bmarked\s+(complete|done|finished|ready)\b/i,
  /\bshows?\s+(it|the|that)\b/i,
  /\bfeels?\s+(ready|complete|done|finished)\b/i,
  /^when\b/i,
];

// World-state verbs: events observable by a third party without asking the operator.
const WORLD_STATE_VERBS_RE =
  /\b(manufactured|produced|acquired|restored|registered|incorporated|formed|published|released|launched|shipped|deployed|open(ed)?|listed|built|filed|executed|signed|closed|approved|granted|awarded)\b/i;

// Concrete anchors that don't rely on a state verb alone.
const CONCRETE_SIGNALS_RE =
  /\bon shelves?\b|\bsecretary of state\b|\bLLC\b|\brecurring revenue\b|\bgenerating revenue\b|\blive on\b|\bin the bank\b/i;

// Quantified public metrics: a number bound to a countable unit a third party
// can check ("10k first-week streams", "100 paying users", "$25k in revenue").
// The digit is required — bare "more streams" stays vague and reprobes. Up to
// a few words may sit between the number and its unit ("10k first-week
// streams"), but the pair must live in the same clause (no crossing . ; ,).
const METRIC_EVIDENCE_RE =
  /\b\d[\d,.]*\s?k?\b[^.;,]{0,40}?\b(streams?|listeners?|users?|subscribers?|followers?|downloads?|sales|units?|customers?|members?|students?|shows?|episodes?|properties|clients?)\b/i;
const MONEY_EVIDENCE_RE = /\$\s?\d[\d,.]*\s?[km]?\b/i;

export function isExternallyVerifiable(
  text: string,
  declaredSources: string[] = [],
): boolean {
  const s = String(text ?? '').trim();
  if (!s) return false;
  if (ATTESTATION_BREACH_RES.some((re) => re.test(s))) return false;
  // Rule 6 (shared with hasAuthoredSubstance): honest incompleteness is a
  // factual capture and must pass every authored-field gate. The reprobe
  // banner itself tells the operator "say 'not started' or 'unknown' —
  // that's fine"; before 2026-07-10 this field rejected that very advice.
  // Breaches stay checked FIRST — "when it feels ready" never sneaks in.
  if (isHonestIncompleteness(s)) return true;
  if (declaredSources.some((src) => s.toLowerCase().includes(src.toLowerCase()))) return true;
  if (WORLD_STATE_VERBS_RE.test(s)) return true;
  if (CONCRETE_SIGNALS_RE.test(s)) return true;
  if (METRIC_EVIDENCE_RE.test(s)) return true;
  if (MONEY_EVIDENCE_RE.test(s)) return true;
  return false;
}
