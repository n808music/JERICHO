// Single source of truth for phase validation. Extracted from phaseGridFromStore (render
// adapter) so both the render layer AND the elicitation/ingest layer call the SAME validator —
// no second validation path. Consumers: phaseGridFromStore.js (render), projectSlot.js (§5
// intake phase gate). The canonical phase set is {1, 2, 3}.

// A node claims a phase outside the canonical set {1,2,3}. Corruption, not a missing
// assignment — rejected loudly at the boundary rather than laundered into the residual bucket.
export class NonCanonicalPhaseError extends Error {
  constructor(nodeName, rawPhase) {
    super(
      `Matrix node "${nodeName}" declares a non-canonical phase ${JSON.stringify(rawPhase)} ` +
        `(allowed: 1, 2, 3). This is data corruption, not a missing assignment — rejected at ` +
        `ingest rather than laundered into the residual bucket.`,
    );
    this.name = 'NonCanonicalPhaseError';
    this.code = 'NON_CANONICAL_PHASE';
    this.nodeName = nodeName;
    this.rawPhase = rawPhase;
  }
}

// Classify a RAW phase value BEFORE any numeric coercion — the coercion (Number()) is
// exactly what destroys the absent-vs-corrupt distinction, collapsing both to 0/NaN.
//   absent (null/undefined/blank)  → null sentinel  (legitimate unknown → residual bucket)
//   present & canonical (1|2|3)     → the number     (placed in its phase group)
//   present & non-canonical         → throw          (corruption, rejected at the boundary)
export function classifyPhase(raw, nodeName) {
  if (raw == null || String(raw).trim() === '') {return null;}
  const n = Number(String(raw).trim());
  if (n === 1 || n === 2 || n === 3) {return n;}
  throw new NonCanonicalPhaseError(nodeName, raw);
}

// Lenient canonical read (does NOT throw) — for INHERITED phases (owning initiative, producing
// project) where a non-canonical value is someone else's field, not this node's own attestation.
export function toCanonicalPhase(raw) {
  if (raw == null || String(raw).trim() === '') {return null;}
  const n = Number(String(raw).trim());
  return n === 1 || n === 2 || n === 3 ? n : null;
}
