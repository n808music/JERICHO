// Internal-only explainability artifact for audits and debugging.
// Not exposed via public APIs or advisory outputs.

export function buildExplainabilityReport({
  identityFactors = {},
  governanceApplied = [],
  integrityBefore = 0,
  integrityAfter = 0,
  selectedTier = null,
  tasksConsidered = [],
  tasksChosen = [],
  temporalUpdates = {}
}) {
  return {
    identityFactors,
    governanceApplied,
    integrityBefore,
    integrityAfter,
    selectedTier,
    tasksConsidered,
    tasksChosen,
    temporalUpdates
  };
}
