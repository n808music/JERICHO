export const DOMAINS = ['BODY', 'CREATION', 'RESOURCES', 'FOCUS'] as const;
export type Domain = (typeof DOMAINS)[number];

/**
 * BODY:
 *   Primary purpose: maintain/restore/increase physical capacity of the operator.
 *
 * CREATION:
 *   Primary purpose: produce a tangible reusable artifact that did not exist before the block.
 *
 * RESOURCES:
 *   Primary purpose: acquire/organize/unlock capability/leverage for future work (enablement).
 *
 * FOCUS:
 *   Primary purpose: decision-making / sense-making / directional clarity.
 */
export function isDomain(value: unknown): value is Domain {
  return typeof value === 'string' && (DOMAINS as readonly string[]).includes(value);
}

/**
 * Deterministic normalization:
 * - Missing/invalid domains default to 'FOCUS' (safest fallback).
 * - No throwing in production paths; callers may attach dev warnings.
 */
export function normalizeDomain(value: unknown): Domain {
  return isDomain(value) ? value : 'FOCUS';
}
