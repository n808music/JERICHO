/**
 * Legal Formation Advisory Builder
 *
 * Pure function that detects when an Entity is conducting external-facing work
 * (has completed execution blocks) while still in non-functioning formation state.
 *
 * Doctrine: Formalize legal entity status before revenue, contracts, vendor,
 * or public-facing activity. This advisory surfaces the gap for operator attention.
 *
 * Input: Full identity state containing matrix (entities, execution blocks)
 * Output: Advisory object (or null if no gaps detected)
 *
 * No side effects, no mutations. Safe to call repeatedly.
 */

/**
 * Detect entities with completed work but non-functioning status.
 *
 * @param {object} state - Full identity state
 * @returns {object|null} Advisory object or null if no gaps
 *
 * @example
 * const advisory = buildLegalFormationAdvisory(state);
 * if (advisory) {
 *   // Render UI with advisory.title, advisory.description, advisory.entities
 * }
 */
export function buildLegalFormationAdvisory(state) {
  const matrix = state?.matrix;
  if (!matrix?.entitiesById) {
    return null;
  }

  // Find entities that are NOT functioning but have completed work
  const gaps = [];

  for (const [entityId, entity] of Object.entries(matrix.entitiesById)) {
    // Skip if already functioning
    if (entity.formationState === 'functioning') {
      continue;
    }

    // Check if this entity has any work (owns initiative → project → deliverable chain)
    let hasWork = false;

    if (matrix.initiativesById) {
      for (const initiative of Object.values(matrix.initiativesById)) {
        if (initiative.owningEntityId === entityId) {
          // This entity owns at least one initiative = has declared work
          hasWork = true;
          break;
        }
      }
    }

    if (hasWork) {
      gaps.push({
        entityId: entity.id,
        entityName: entity.name,
        formationState: entity.formationState,
        legallyFormed: entity.legallyFormed,
      });
    }
  }

  // If no gaps, return null (no advisory needed)
  if (gaps.length === 0) {
    return null;
  }

  // Transform gaps into advisory format
  const advisory = {
    title: 'Legal Formation Gap',
    description:
      'The following entities are conducting external-facing work while still in formation. Doctrine recommends formalizing legal status before external activity.',
    entities: gaps.map((gap) => ({
      id: gap.entityId,
      name: gap.entityName,
      formationState: gap.formationState,
      legallyFormed: gap.legallyFormed,
      label: `${gap.entityName} (${gap.formationState})`,
      recommendation: `Update ${gap.entityName} to 'functioning' formation state when legal entity is formalized.`,
    })),
  };

  return advisory;
}
