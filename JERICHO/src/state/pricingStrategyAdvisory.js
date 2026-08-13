/**
 * Pricing Strategy Advisory Builder
 *
 * Pure function that recommends pricing strategies based on an initiative's
 * risk classification (differentiation_risk vs validation_risk).
 *
 * Doctrine: Pricing strategy is determined by market-entry risk profile.
 * - Differentiation Risk: Market is proven, customers are engaged → premium/skimming strategy
 * - Validation Risk: Market is unproven, customers unengaged → penetration/freemium strategy
 *
 * Input: Full identity state containing matrix (initiatives)
 * Output: Advisory object (or null if no classification exists yet)
 *
 * No side effects, no mutations. Safe to call repeatedly.
 */

/**
 * Build pricing strategy recommendation based on initiative's risk classification.
 *
 * @param {object} state - Full identity state
 * @param {string} initiativeId - Initiative ID to build advisory for
 * @returns {object|null} Advisory object or null if no classification yet
 *
 * @example
 * const advisory = buildPricingStrategyAdvisory(state, initiativeId);
 * if (advisory) {
 *   // Render UI with advisory.title, advisory.description, advisory.recommendation
 * }
 */
export function buildPricingStrategyAdvisory(state, initiativeId) {
  const matrix = state?.matrix;
  if (!matrix?.initiativesById || !initiativeId) {
    return null;
  }

  const initiative = matrix.initiativesById[initiativeId];
  if (!initiative) {
    return null;
  }

  // If no classification yet, return null (no advisory)
  const riskClass = initiative.riskClassification;
  if (!riskClass) {
    return null;
  }

  // Build advisory based on classification
  if (riskClass === 'differentiation_risk') {
    return {
      title: 'Differentiation-Focused Pricing',
      description: 'Your market entry shows strong category precedent and customer engagement with similar offerings.',
      recommendation:
        'Premium/Skimming or Feature-Bundled strategy. Strong category precedent + engaged customers support premium positioning anchored on feature superiority.',
      riskClass: 'differentiation_risk',
      confidence: 'high',
      strategy: initiative.pricingStrategy || 'premium',
      reasoning: initiative.pricingReasoning || null,
    };
  }

  if (riskClass === 'validation_risk') {
    return {
      title: 'Validation-Focused Pricing',
      description: 'Your market entry shows weak category precedent and minimal customer engagement with similar offerings.',
      recommendation:
        'Penetration/Low-Cost or Usage-Based/Freemium strategy. Demand uncertainty is the primary constraint; price to maximize trial volume and minimize commitment friction.',
      riskClass: 'validation_risk',
      confidence: 'high',
      strategy: initiative.pricingStrategy || 'penetration',
      reasoning: initiative.pricingReasoning || null,
    };
  }

  if (riskClass === 'inconclusive') {
    return {
      title: 'Inconclusive Classification',
      description: 'Your market entry signals are mixed; no clear consensus on category or customer precedent.',
      recommendation: 'Choose explicitly: Premium (differentiation-focused), Penetration (validation-focused), or Hybrid/Custom.',
      riskClass: 'inconclusive',
      confidence: 'low',
      strategy: initiative.pricingStrategy || null,
      reasoning: initiative.pricingReasoning || null,
      requiresExplicitChoice: true,
    };
  }

  // Fallback: unknown classification
  return null;
}
