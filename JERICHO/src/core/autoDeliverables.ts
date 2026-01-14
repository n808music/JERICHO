/**
 * autoDeliverables.ts
 *
 * Generates deliverables from mechanism class and goal contract.
 * Each mechanism class has pre-defined delivery templates.
 *
 * Purely deterministic: same inputs produce identical outputs.
 */

import { MechanismClass, deriveMechanismClass, describeMechanismClass } from './mechanismClass';

export interface DeliverableTemplate {
  titlePattern: string; // e.g. "Research {noun}"
  requiredBlocks: number; // e.g. 8 blocks
  sequence: number; // ordering hint
}

export interface StrategyDeliverable {
  id: string;
  title: string;
  requiredBlocks: number;
}

/**
 * Template definitions per mechanism class
 *
 * Structure:
 * - titlePattern: Can contain {noun} or {outcome} placeholders
 * - requiredBlocks: Default duration estimate
 * - sequence: Display order
 */
const TEMPLATES: Record<MechanismClass, DeliverableTemplate[]> = {
  CREATE: [
    { titlePattern: 'Design {outcome}', requiredBlocks: 4, sequence: 1 },
    { titlePattern: 'Build {outcome}', requiredBlocks: 12, sequence: 2 },
    { titlePattern: 'Test & refine {outcome}', requiredBlocks: 6, sequence: 3 }
  ],

  PUBLISH: [
    { titlePattern: 'Prepare {outcome} for release', requiredBlocks: 4, sequence: 1 },
    { titlePattern: 'Create release materials', requiredBlocks: 4, sequence: 2 },
    { titlePattern: 'Deploy {outcome}', requiredBlocks: 2, sequence: 3 },
    { titlePattern: 'Monitor & support launch', requiredBlocks: 4, sequence: 4 }
  ],

  MARKET: [
    { titlePattern: 'Define {outcome} market strategy', requiredBlocks: 4, sequence: 1 },
    { titlePattern: 'Create marketing campaign', requiredBlocks: 6, sequence: 2 },
    { titlePattern: 'Execute outreach & acquisition', requiredBlocks: 8, sequence: 3 },
    { titlePattern: 'Track & optimize {outcome} metrics', requiredBlocks: 4, sequence: 4 }
  ],

  LEARN: [
    { titlePattern: 'Research & explore {outcome}', requiredBlocks: 6, sequence: 1 },
    { titlePattern: 'Complete coursework or study', requiredBlocks: 12, sequence: 2 },
    { titlePattern: 'Practice & apply learning', requiredBlocks: 6, sequence: 3 },
    { titlePattern: 'Document knowledge & share', requiredBlocks: 2, sequence: 4 }
  ],

  OPS: [
    { titlePattern: 'Plan {outcome} infrastructure', requiredBlocks: 3, sequence: 1 },
    { titlePattern: 'Implement {outcome} setup', requiredBlocks: 8, sequence: 2 },
    { titlePattern: 'Test & validate systems', requiredBlocks: 4, sequence: 3 },
    { titlePattern: 'Establish monitoring & runbooks', requiredBlocks: 2, sequence: 4 }
  ],

  REVIEW: [
    { titlePattern: 'Audit & analyze {outcome}', requiredBlocks: 4, sequence: 1 },
    { titlePattern: 'Plan improvements', requiredBlocks: 3, sequence: 2 },
    { titlePattern: 'Execute refactoring', requiredBlocks: 8, sequence: 3 },
    { titlePattern: 'Verify & document changes', requiredBlocks: 3, sequence: 4 }
  ]
};

/**
 * Extracts key noun/outcome from goal contract text
 *
 * Examples:
 * - "Publish my music to Spotify" → "music"
 * - "Learn TypeScript deeply" → "TypeScript"
 * - "Build a new dashboard" → "dashboard"
 */
function extractOutcomNoun(goalContract: any): string {
  const text = [
    goalContract?.terminalOutcome?.text,
    goalContract?.goalText,
    goalContract?.aim?.text
  ]
    .find((t) => typeof t === 'string' && t.trim().length > 0) as string;

  if (!text) return 'this goal';

  // Remove common words and extract meaningful nouns
  const words = text
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => w.length > 2)
    .filter(
      (w) =>
        !/^(the|to|a|an|and|or|but|for|in|on|at|by|is|are|be|been|have|has|do|does|did|can|could|should|would|will|am|my|your|his|her|this|that|these|those)$/.test(
          w
        )
    );

  // Take longest word (likely the main noun)
  const mainWord = words.reduce((a, b) => (a.length > b.length ? a : b), 'outcome');
  return mainWord;
}

/**
 * Generates deliverables from mechanism class
 *
 * Example:
 * - goalContract.terminalOutcome.text = "Publish my music to Spotify"
 * - Derives mechanism = PUBLISH
 * - Returns 4 deliverables with pre-sized blocks
 */
export function generateAutoDeliverables(goalContract: any): StrategyDeliverable[] {
  const mechanism = deriveMechanismClass(goalContract);
  const templates = TEMPLATES[mechanism];

  const outcomNoun = extractOutcomNoun(goalContract);

  let idCounter = 0;

  return templates.map((template) => {
    const title = template.titlePattern
      .replace('{outcome}', outcomNoun)
      .replace('{noun}', outcomNoun);

    return {
      id: `auto-${mechanism}-${idCounter++}`,
      title,
      requiredBlocks: template.requiredBlocks
    };
  });
}

/**
 * Total blocks across all auto-generated deliverables
 */
export function totalAutoBlocksRequired(goalContract: any): number {
  const deliverables = generateAutoDeliverables(goalContract);
  return deliverables.reduce((sum, d) => sum + d.requiredBlocks, 0);
}

/**
 * Diagnostic output showing mechanism derivation and deliverable plan
 */
export function debugAutoDeliverablesGeneration(goalContract: any, verbose = false) {
  const mechanism = deriveMechanismClass(goalContract);
  const deliverables = generateAutoDeliverables(goalContract);
  const totalBlocks = totalAutoBlocksRequired(goalContract);

  const output = {
    goalText: goalContract?.terminalOutcome?.text || goalContract?.goalText,
    derivedMechanism: mechanism,
    mechanismDescription: describeMechanismClass(mechanism),
    deliverables: deliverables.map((d) => ({
      title: d.title,
      blocks: d.requiredBlocks
    })),
    totalBlocksRequired: totalBlocks
  };

  if (verbose && typeof console !== 'undefined' && console.log) {
    console.log('[AUTO_DELIVERABLES]', output);
  }

  return output;
}
