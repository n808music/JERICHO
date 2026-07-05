// Internal-attestation patterns — a third party cannot observe these.
const ATTESTATION_BREACH_RES = [
  /\bmarked\s+(complete|done|finished|ready)\b/i,
  /\bshows?\s+(it|the|that)\b/i,
  /\bfeels?\s+(ready|complete|done|finished)\b/i,
  /^when\b/i,
];

// World-state verbs: events observable by a third party without asking the operator.
const WORLD_STATE_VERBS_RE =
  /\b(manufactured|produced|acquired|restored|registered|incorporated|formed|published|launched|shipped|deployed|open(ed)?|listed|built|filed|executed|signed|closed|approved|granted|awarded)\b/i;

// Concrete anchors that don't rely on a state verb alone.
const CONCRETE_SIGNALS_RE =
  /\bon shelves?\b|\bsecretary of state\b|\bLLC\b|\brecurring revenue\b|\bgenerating revenue\b/i;

export function isExternallyVerifiable(
  text: string,
  declaredSources: string[] = [],
): boolean {
  const s = String(text ?? '').trim();
  if (!s) return false;
  if (ATTESTATION_BREACH_RES.some((re) => re.test(s))) return false;
  if (declaredSources.some((src) => s.toLowerCase().includes(src.toLowerCase()))) return true;
  if (WORLD_STATE_VERBS_RE.test(s)) return true;
  if (CONCRETE_SIGNALS_RE.test(s)) return true;
  return false;
}
