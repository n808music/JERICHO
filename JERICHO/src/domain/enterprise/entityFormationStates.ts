/**
 * Entity formation-state ladder — the maturity scale a node occupies.
 * Confirmed complete against Operation Endgame's eight nodes. Orthogonal to
 * WHICH entity it is: every entity HAS one of these states.
 *   not-formed     — does not yet exist in any form
 *   named-only     — a name exists, nothing built (a name is a form of a form)
 *   conceptual     — designed/specified, nothing material
 *   half-built     — partial material existence
 *   in-development — actively being built
 *   functioning    — operating and producing
 *   legally-formed — registered legal entity
 * Capital takes NO formation state — it is not an entity.
 */
export const FORMATION_STATES = [
  'not-formed',
  'named-only',
  'conceptual',
  'half-built',
  'in-development',
  'functioning',
  'legally-formed',
] as const;

export type FormationState = (typeof FORMATION_STATES)[number];

export function isValidFormationState(state: string): boolean {
  return (FORMATION_STATES as readonly string[]).includes(String(state || '').trim().toLowerCase());
}
