/**
 * Pricing Strategy Slot Definition
 *
 * Defines the three-question probe for pricing strategy classification:
 * 1. Category precedent — Has this category seen proven, non-commoditized winners?
 * 2. Audience precedent — Do your target customers have prior successful relationships with similar offerings?
 * 3. Competitive density — Is the category highly competitive or underserved?
 *
 * Classification logic (locked from Sequencing Risk v1):
 * - If 2+ answers point the same direction → classify that way
 * - Otherwise → mark as "inconclusive" (do NOT default)
 *
 * Output mapping (evidence-grounded):
 * - Differentiation Risk (strong category + strong audience): Premium/Skimming or Feature-Bundled
 * - Validation Risk (weak category + weak audience): Penetration/Low-Cost or Usage-Based/Freemium
 * - Inconclusive: Require explicit operator choice (no silent defaults)
 *
 * Note: This classification is shared with sequencing strategy planning (Phase 2).
 * TODO: Phase 2 — Sequencing Risk will also read riskClassification for scheduling recommendations
 */

export const PRICING_STRATEGY_SLOT = {
  name: 'PRICING_STRATEGY',
  probes: [
    {
      name: 'category_precedent',
      question: 'Has this category seen proven, non-commoditized winners?',
      type: 'binary_or_unknown', // Yes/No/Unknown
      answers: ['yes', 'no', 'unknown'],
    },
    {
      name: 'audience_precedent',
      question: 'Do your target customers have prior successful relationships with similar offerings?',
      type: 'binary_or_unknown', // Yes/No/Unknown
      answers: ['yes', 'no', 'unknown'],
    },
    {
      name: 'competitive_density',
      question: 'Is the category highly competitive or underserved?',
      type: 'select', // Competitive / Underserved / Unknown
      answers: ['competitive', 'underserved', 'unknown'],
    },
  ],
};

/**
 * Classify initiative based on three-question answers.
 *
 * Logic: Count same-direction answers.
 * - 2+ answers pointing differentiation → differentiation_risk
 * - 2+ answers pointing validation → validation_risk
 * - Split answers → inconclusive (do NOT default)
 *
 * @param {object} answers - Map of probe names to answers
 * @returns {object} { riskClass, confidence }
 */
export function classifyFromAnswers(answers = {}) {
  // Normalize answers
  const q1 = String(answers?.category_precedent || '').trim().toLowerCase();
  const q2 = String(answers?.audience_precedent || '').trim().toLowerCase();
  const q3 = String(answers?.competitive_density || '').trim().toLowerCase();

  // Map answers to risk signals
  // Differentiation risk signal: strong category precedent (yes) + strong audience (yes)
  // Validation risk signal: weak category precedent (no) + weak audience (no)
  // Competitive density: competitive = differentiation-friendly, underserved = validation-friendly

  const differentiationSignals = [];
  const validationSignals = [];

  // Q1: Category precedent
  if (q1 === 'yes') differentiationSignals.push('q1');
  if (q1 === 'no') validationSignals.push('q1');

  // Q2: Audience precedent
  if (q2 === 'yes') differentiationSignals.push('q2');
  if (q2 === 'no') validationSignals.push('q2');

  // Q3: Competitive density
  if (q3 === 'competitive') differentiationSignals.push('q3');
  if (q3 === 'underserved') validationSignals.push('q3');

  // Classification: 2+ same-direction signals
  if (differentiationSignals.length >= 2) {
    return {
      riskClass: 'differentiation_risk',
      confidence: 'high',
      signals: differentiationSignals,
    };
  }

  if (validationSignals.length >= 2) {
    return {
      riskClass: 'validation_risk',
      confidence: 'high',
      signals: validationSignals,
    };
  }

  // No clear consensus: inconclusive
  return {
    riskClass: 'inconclusive',
    confidence: 'low',
    signals: [],
  };
}

/**
 * Build payload for DECLARE_PRICING_STRATEGY reducer action.
 *
 * @param {string} initiativeId - Initiative ID
 * @param {string} riskClass - Risk classification (differentiation_risk | validation_risk | inconclusive)
 * @param {string} pricingStrategy - Chosen strategy (e.g., "premium", "penetration", "hybrid")
 * @param {string} [pricingReasoning] - Optional operator override explanation
 * @returns {object} Dispatch payload
 */
export function buildPricingStrategyPayload(initiativeId, riskClass, pricingStrategy, pricingReasoning) {
  return {
    type: 'DECLARE_PRICING_STRATEGY',
    payload: {
      initiativeId: String(initiativeId || '').trim(),
      riskClassification: String(riskClass || '').trim(),
      pricingStrategy: String(pricingStrategy || '').trim(),
      pricingReasoning: pricingReasoning ? String(pricingReasoning).trim() : null,
    },
  };
}
