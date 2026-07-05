export const RESOURCE_DIMENSIONS = ['money', 'time', 'skills', 'tech'] as const;
export type ResourceDimension = (typeof RESOURCE_DIMENSIONS)[number];

// Sentinel value for a gap field meaning "assessed — no gap in this dimension."
// Distinct from an empty string (not answered). Stored as null in the profile.
export const NO_GAP_SENTINEL = 'none';
