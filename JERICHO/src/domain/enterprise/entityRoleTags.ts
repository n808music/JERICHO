/**
 * Canonical entity role-tags (matrix Section 2 legend).
 * A node may carry several — they declare which child kinds it can own.
 *   [business]   — a business node
 *   [initiative] — launches/runs missions
 *   [project]    — can own finite projects
 *   [system]     — runs recurring engines
 */
export const ENTITY_ROLE_TAGS = [
  'business',
  'initiative',
  'project',
  'system',
] as const;

export type EntityRoleTag = (typeof ENTITY_ROLE_TAGS)[number];

// Display labels decouple chip text from internal enum values and from
// section-header names (§3 Initiative, §4 System, §5 Project would collide).
// Duplicate in src/ui/masterPlan/MatrixInstrument.jsx (RoleTagChips) pending Wave 3 import consolidation.
// Parity tested by: tests/components/MatrixInstrument.labelParity.test.js
export const ROLE_TAG_DISPLAY_LABELS: Record<string, string> = {
  business:   'Business',
  initiative: 'Campaign leader',
  project:    'Project operator',
  system:     'System custodian',
};

export function isValidRoleTag(tag: string): boolean {
  return (ENTITY_ROLE_TAGS as readonly string[]).includes(String(tag || '').trim().toLowerCase());
}
