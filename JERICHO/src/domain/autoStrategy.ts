/**
 * autoStrategy.ts
 *
 * Deterministic auto-generation of deliverables from goal contracts.
 * Rules:
 * - Always return at least 3 deliverables
 * - Stage deliverables into phases (Early, Middle, Late)
 * - Detect goal type (music/release vs generic) from terminal outcome text
 * - Never requires LLM; pattern-based only
 */

import { GoalExecutionContract } from './goal/GoalExecutionContract';
import { addDays, dayKeyFromISO } from '../state/time/time';
import { StrategyDeliverable } from '../state/strategy';

export interface AutoStrategyResult {
  deliverables: StrategyDeliverable[];
  detectedType: 'music_release' | 'generic';
  rationale: string;
}

/**
 * Detect if goal is music/release related based on terminal outcome text
 */
function detectGoalType(outcomeText: string): 'music_release' | 'generic' {
  const text = (outcomeText || '').toLowerCase();
  const musicKeywords = ['release', 'album', 'songs', 'spotify', 'ep', 'track', 'beats', 'production', 'mix', 'master', 'promo', 'radio'];
  const foundKeywords = musicKeywords.filter((kw) => text.includes(kw));
  return foundKeywords.length >= 2 ? 'music_release' : 'generic';
}

/**
 * Stage deliverables based on progress through cycle
 * Early (0-33%), Middle (33-66%), Late (66-100%)
 */
function stageDeliverable(stage: 'early' | 'middle' | 'late', index: number): string {
  const stageLabels: Record<string, string[]> = {
    early: [
      'Planning & setup',
      'Scope definition',
      'Resource allocation',
      'Foundation & setup',
      'Initial planning'
    ],
    middle: [
      'Core production',
      'Execution & iteration',
      'Main development',
      'Build & refinement',
      'Production & testing'
    ],
    late: [
      'Verification & finalization',
      'Quality assurance',
      'Final review',
      'Delivery & publication',
      'Launch & rollout'
    ]
  };

  const options = stageLabels[stage];
  return options[index % options.length];
}

/**
 * Calculate required blocks for a deliverable based on time window
 */
function calculateRequiredBlocks(totalDays: number, phasePosition: number, phaseCount: number): number {
  // Rough heuristic: 1-2 blocks per 3 days on average
  const baseBlocks = Math.max(3, Math.floor(totalDays / 3));
  // Distribute across phases
  const perPhase = Math.max(2, Math.floor(baseBlocks / phaseCount));
  return perPhase;
}

/**
 * Build auto deliverables for a music release goal
 */
function buildMusicReleaseDeliverables(
  daysUntilDeadline: number
): StrategyDeliverable[] {
  const baseBlocks = Math.max(8, Math.floor(daysUntilDeadline / 5)); // 1 block per 5 days
  const deliverables: StrategyDeliverable[] = [
    {
      id: `auto-deliv-1`,
      title: 'Finalize tracklist + masters',
      requiredBlocks: Math.max(6, Math.floor(baseBlocks * 0.3))
    },
    {
      id: `auto-deliv-2`,
      title: 'Artwork + distribution setup',
      requiredBlocks: Math.max(3, Math.floor(baseBlocks * 0.15))
    },
    {
      id: `auto-deliv-3`,
      title: 'Promo assets + rollout plan',
      requiredBlocks: Math.max(4, Math.floor(baseBlocks * 0.25))
    },
    {
      id: `auto-deliv-4`,
      title: 'Daily promo execution',
      requiredBlocks: Math.max(5, Math.floor(baseBlocks * 0.3))
    }
  ];

  // Ensure we have at least 3 and reasonable total
  return deliverables.slice(0, 4);
}

/**
 * Build generic auto deliverables (fallback)
 */
function buildGenericDeliverables(daysUntilDeadline: number): StrategyDeliverable[] {
  const baseBlocks = Math.max(6, Math.floor(daysUntilDeadline / 4));
  const phaseCount = 3;
  const perPhase = Math.max(2, Math.floor(baseBlocks / phaseCount));

  return [
    {
      id: `auto-deliv-1`,
      title: stageDeliverable('early', 0),
      requiredBlocks: perPhase
    },
    {
      id: `auto-deliv-2`,
      title: stageDeliverable('middle', 0),
      requiredBlocks: perPhase
    },
    {
      id: `auto-deliv-3`,
      title: stageDeliverable('late', 0),
      requiredBlocks: perPhase
    }
  ];
}

/**
 * Main export: Generate auto deliverables from goal contract
 *
 * @param goalContract - The admitted goal contract
 * @param nowDayKey - Current day in YYYY-MM-DD format
 * @returns Deliverables array + metadata
 */
export function buildAutoDeliverablesFromGoalContract(
  goalContract: GoalExecutionContract,
  nowDayKey: string,
  timeZone: string = 'UTC'
): AutoStrategyResult {
  // Parse deadline
  const deadlineKey = goalContract?.deadline?.dayKey;
  if (!deadlineKey || !deadlineKey.match(/^\d{4}-\d{2}-\d{2}$/)) {
    // Fallback: use 3 weeks from now
    const fallbackDeadline = addDays(nowDayKey, 21, timeZone);
    return buildAutoDeliverablesFromGoalContract(
      { ...goalContract, deadline: { ...goalContract.deadline, dayKey: fallbackDeadline } },
      nowDayKey,
      timeZone
    );
  }

  // Calculate days remaining
  let daysRemaining = 0;
  let cursor = nowDayKey;
  while (cursor <= deadlineKey) {
    daysRemaining++;
    if (cursor === deadlineKey) break;
    cursor = addDays(cursor, 1, timeZone);
  }
  daysRemaining = Math.max(1, daysRemaining - 1); // Exclude current day

  // Detect goal type
  const goalType = detectGoalType(goalContract?.terminalOutcome?.text || '');

  // Generate deliverables
  let deliverables: StrategyDeliverable[];
  if (goalType === 'music_release') {
    deliverables = buildMusicReleaseDeliverables(daysRemaining);
  } else {
    deliverables = buildGenericDeliverables(daysRemaining);
  }

  // Ensure minimum 3 deliverables
  while (deliverables.length < 3) {
    deliverables.push({
      id: `auto-deliv-${deliverables.length + 1}`,
      title: stageDeliverable('late', deliverables.length),
      requiredBlocks: Math.max(1, Math.floor(daysRemaining / 7))
    });
  }

  return {
    deliverables,
    detectedType: goalType,
    rationale: `Auto-generated ${goalType === 'music_release' ? 'music release' : 'generic'} deliverables for ${daysRemaining} days until deadline`
  };
}

/**
 * Check if goal is a compound goal (multiple outcomes) - for policy enforcement
 */
export function detectCompoundGoal(goalContract: GoalExecutionContract): {
  isCompound: boolean;
  outcomes: string[];
} {
  const outcomeText = (goalContract?.terminalOutcome?.text || '').toLowerCase();
  
  // Look for conjunction patterns that suggest multiple goals
  const compoundPatterns = [
    /and\s+(?:then\s+)?.*(?:also|simultaneously|in parallel)/i,
    /(?:both|also|plus|additionally|furthermore).*and/i,
    /;\s*(?:also|meanwhile|additionally)/i
  ];

  const hasCompoundPattern = compoundPatterns.some((pattern) => pattern.test(outcomeText));

  // Look for multiple semicolons or list-like structures
  const semicolonCount = (outcomeText.match(/;/g) || []).length;
  const hasMultipleSentences = semicolonCount > 0 && outcomeText.split(';').filter((s) => s.trim()).length > 2;

  const isCompound = hasCompoundPattern || hasMultipleSentences;

  const outcomes = isCompound
    ? outcomeText.split(/[;,]/).map((s) => s.trim()).filter((s) => s.length > 10)
    : [outcomeText];

  return { isCompound, outcomes };
}
