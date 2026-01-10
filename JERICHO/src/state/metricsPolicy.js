export const PRACTICE_KEYS = ['Body', 'Resources', 'Creation', 'Focus'];
export const UNKNOWN_KEY = 'Unknown';

export const UnknownPolicy = {
  includeInOverall: true,
  includeInPracticeLoad: false,
  includeInDrift: false,
  label: 'Unclassified'
};

export const PlanSource = {
  SCHEDULED: 'scheduled',
  TARGETS: 'targets'
};

// Drift contract:
// - Drift compares actual scheduled minutes (excluding Unknown) vs target distribution from Pattern.
// - Unknown minutes are excluded from drift mix.
// - When actual total is 0, driftScore falls back to 0 (weak) to avoid undefined/NaN.
