/**
 * Entity formation-state ladder — the operational maturity scale a node occupies.
 * Five-rung ladder (not-formed → named-only → conceptual → in-development → functioning).
 * Legal status (LLC registration, formal incorporation) is tracked separately via the
 * legallyFormed boolean field, which is independent of this maturity ladder.
 *
 * Confirmed complete against the seven canonical reference entities (ENTERPRISE_IDENTITY_MAP).
 * Orthogonal to WHICH entity it is: every entity HAS one of these states.
 *   not-formed     — does not yet exist in any form
 *   named-only     — a name exists, nothing built (a name is a form of a form)
 *   conceptual     — designed/specified, nothing material
 *   in-development — actively being built (includes partial/half-built and full development)
 *   functioning    — operating and producing
 * Capital takes NO formation state — it is not an entity.
 */
export const FORMATION_STATES = [
  'not-formed',
  'named-only',
  'conceptual',
  'in-development',
  'functioning',
] as const;

export type FormationState = (typeof FORMATION_STATES)[number];

export function isValidFormationState(state: string): boolean {
  return (FORMATION_STATES as readonly string[]).includes(String(state || '').trim().toLowerCase());
}
