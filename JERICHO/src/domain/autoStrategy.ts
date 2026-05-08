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
  detectedType:
    | 'music_release'
    | 'tv_writing'
    | 'episodic_production'
    | 'software_build'
    | 'fitness_training'
    | 'business_launch'
    | 'sales_pipeline'
    | 'fundraising'
    | 'job_search_pipeline'
    | 'skill_acquisition'
    | 'professional_qualification'
    | 'physical_training'
    | 'venture_launch'
    | 'brand_launch'
    | 'real_estate_project'
    | 'generic';
  rationale: string;
}

/**
 * Detect if goal is music/release related based on terminal outcome text
 */
function detectGoalType(
  outcomeText: string,
  verificationText: string = '',
  executionType: string = ''
):
  | 'music_release'
  | 'tv_writing'
  | 'episodic_production'
  | 'software_build'
  | 'fitness_training'
  | 'business_launch'
  | 'sales_pipeline'
  | 'fundraising'
  | 'job_search_pipeline'
  | 'skill_acquisition'
  | 'professional_qualification'
  | 'physical_training'
  | 'venture_launch'
  | 'brand_launch'
  | 'real_estate_project'
  | 'generic' {
  const text = `${outcomeText || ''} ${verificationText || ''}`.toLowerCase();
  const combined = `${text} ${executionType || ''}`.toLowerCase();
  if (/\bventurelaunch\b|\bventure\s+launch\b/.test(combined)) return 'venture_launch';
  if (
    /\bbrandlaunch\b|\bbrand\s+launch\b/.test(combined) ||
    (/\bbrand\b/.test(combined) &&
      (/\blaunch\b/.test(combined) || /\bidentity\b/.test(combined) || /\bmessaging\b/.test(combined)))
  ) {
    return 'brand_launch';
  }
  if (isCommercialProductLaunchText(combined)) return 'brand_launch';
  if (/\bjobsearchpipeline\b|\bjob\s+search\s+pipeline\b/.test(combined)) return 'job_search_pipeline';
  if (/\bskillacquisition\b|\bskill\s+acquisition\b/.test(combined)) return 'skill_acquisition';
  if (/\bprofessionalqualification\b|\bprofessional\s+qualification\b/.test(combined))
    return 'professional_qualification';
  if (/\bphysicaltraining\b|\bphysical\s+training\b|\bphysical\s+progression\b/.test(combined))
    return 'physical_training';
  if (/\bsalespipeline\b|\bsales\s+pipeline\b/.test(combined)) return 'sales_pipeline';
  if (/\bfundraising\b|\bfundraise\b/.test(combined)) return 'fundraising';
  const musicKeywords = [
    'release',
    'album',
    'songs',
    'spotify',
    'ep',
    'track',
    'beats',
    'production',
    'mix',
    'master',
    'promo',
    'radio',
  ];
  const hasBoundedKeyword = (keyword: string) => {
    const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+');
    return new RegExp(`\\b${escaped}\\b`, 'i').test(text);
  };
  const tvWritingKeywords = [
    'tv show',
    'television',
    'season',
    'episode',
    'pilot',
    'screenplay',
    'script',
    'writers room',
  ];
  const foundTvKeywords = tvWritingKeywords.filter((kw) => text.includes(kw));
  if (foundTvKeywords.length >= 2) return 'tv_writing';
  const hasEpisodicAnchor = /\bpodcast\b|\bepisode\b|\bepisodes\b/.test(text);
  const episodicSupportKeywords = ['record', 'recorded', 'edited', 'release', 'publish', 'published'];
  const foundEpisodicSupportKeywords = episodicSupportKeywords.filter((kw) => text.includes(kw));
  if (hasEpisodicAnchor && foundEpisodicSupportKeywords.length >= 1) return 'episodic_production';
  const softwareKeywords = ['software', 'product', 'app', 'feature', 'mvp', 'deploy', 'ship', 'launch'];
  const foundSoftwareKeywords = softwareKeywords.filter((kw) => {
    if (!hasBoundedKeyword(kw)) return false;
    // "software" in "software engineer" is a job title, not a build context
    if (kw === 'software') {
      const stripped = text.replace(/\bsoftware\s+engineer\b/gi, '');
      return /\bsoftware\b/i.test(stripped);
    }
    return true;
  });
  if (foundSoftwareKeywords.length >= 2) return 'software_build';
  const fitnessKeywords = ['marathon', 'half marathon', 'training', 'workout', 'run', 'race', 'fitness'];
  const foundFitnessKeywords = fitnessKeywords.filter((kw) => text.includes(kw));
  if (foundFitnessKeywords.length >= 2) return 'fitness_training';
  const businessKeywords = ['business', 'service', 'offer', 'customer', 'client', 'startup', 'revenue', 'sales'];
  const foundBusinessKeywords = businessKeywords.filter((kw) => text.includes(kw));
  if (foundBusinessKeywords.length >= 2) return 'business_launch';
  const realEstateKeywords = [
    'real estate',
    'property',
    'tenant',
    'inspection',
    'renovate',
    'permit',
    'unit',
    'office',
  ];
  const foundRealEstateKeywords = realEstateKeywords.filter((kw) => text.includes(kw));
  if (foundRealEstateKeywords.length >= 2) return 'real_estate_project';
  const foundKeywords = musicKeywords.filter((kw) => hasBoundedKeyword(kw));
  return foundKeywords.length >= 2 ? 'music_release' : 'generic';
}

function isCommercialProductLaunchText(text: string): boolean {
  const normalized = String(text || '').toLowerCase();
  const hasLaunchSignal = /\blaunch\b|\bgo[-\s]?to[-\s]?market\b/.test(normalized);
  const hasProductSignal =
    /\b(caffeinated\s+)?gum\b|\bconsumer product\b|\bpackaged good\b|\bsellable (product|item|unit)\b|\bproduct\b/.test(
      normalized
    );
  const hasCommercialSignal =
    /\b(first real sales?|first sales|first sale|first order|sales campaign|purchase|checkout|order|pricing|fulfillment|buyers?|sell|selling)\b/.test(
      normalized
    );
  return hasLaunchSignal && hasProductSignal && hasCommercialSignal;
}

function extractCommercialProductObject(outcomeText: string, verificationText: string): string {
  const text = `${outcomeText || ''} ${verificationText || ''}`.trim();
  const patterns = [
    /\blaunch\s+(?:a|an|my|the)?\s*(.+?)(?:\s+and\s+take\b|\s+in\b|\s+with\b|\s+to\s+first\b|\s+to\b|\s+by\b|$)/i,
    /\bbuild\s+(?:a|an|my|the)?\s*(.+?)(?:\s+and\s+take\b|\s+in\b|\s+with\b|\s+to\s+first\b|\s+to\b|\s+by\b|$)/i,
  ];
  for (const pattern of patterns) {
    const match = pattern.exec(text);
    const candidate = String(match?.[1] || '')
      .replace(/\bbrand\b/gi, '')
      .replace(/\band\s+take\b.*$/i, '')
      .replace(/\bto\s+first\b.*$/i, '')
      .replace(/\s+/g, ' ')
      .replace(/[.,;:]+$/g, '')
      .trim();
    if (candidate.length >= 3 && !/^(a|an|the)$/i.test(candidate)) return candidate;
  }
  if (/\bgum\b/i.test(text)) return 'caffeinated gum product';
  return extractGoalObjectPhrase(outcomeText, verificationText) || 'product';
}

function extractStartingStateHint(text: string) {
  const lower = String(text || '').toLowerCase();
  if (lower.includes('from scratch') || lower.includes('starting from scratch')) return 'from_scratch';
  if (
    lower.includes('already equipped') ||
    lower.includes('already branded') ||
    lower.includes('identity defined') ||
    lower.includes('brand ready') ||
    lower.includes('brand defined') ||
    lower.includes('set up')
  ) {
    return 'already_equipped';
  }
  if (lower.includes('prototype ready') || lower.includes('prototype')) return 'prototype_ready';
  if (lower.includes('baseline recorded') || lower.includes('baseline')) return 'baseline_recorded';
  if (lower.includes('offer defined') || lower.includes('offer ready')) return 'offer_defined';
  if (lower.includes('site verified') || lower.includes('site ready')) return 'site_verified';
  return 'unknown';
}

function isServiceLaunchGoal(outcomeText: string, verificationText: string, executionType: string): boolean {
  const combined = `${outcomeText || ''} ${verificationText || ''} ${executionType || ''}`.toLowerCase();
  return (
    /\bconsulting\b|\bservice\b/.test(combined) &&
    /\boffer\b|\bpricing\b|\bonboarding\b|\boutreach\b|\bclient\b|\bdelivery\b|\bdiscovery\b/.test(combined)
  );
}

function extractVentureLaunchObject(outcomeText: string, verificationText: string): string {
  const text = `${outcomeText || ''} ${verificationText || ''}`.trim();
  if (!text) return 'venture';

  const patterns = [
    /\blaunch\s+(?:a|an|my|the)?\s*(.+?)(?:\s+in\b|\s+with\b|\s+to\b|\s+by\b|$)/i,
    /\bbuild\s+(?:a|an|my|the)?\s*(.+?)(?:\s+in\b|\s+with\b|\s+to\b|\s+by\b|$)/i,
  ];
  for (const pattern of patterns) {
    const match = pattern.exec(text);
    const candidate = String(match?.[1] || '')
      .replace(/\b(first users?|customers?|clients?)\b/gi, '')
      .replace(/\s+/g, ' ')
      .replace(/[.,;:]+$/g, '')
      .trim();
    if (candidate.length >= 3) return candidate;
  }

  if (/\bconsulting\b|\bservice\b/i.test(text)) return 'service venture';
  if (/\bapp\b|\bsaas\b|\bsoftware\b|\bproduct\b|\bmvp\b/i.test(text)) return 'product venture';
  return extractGoalObjectPhrase(outcomeText, verificationText) || 'venture';
}

function extractJobSearchStartingStateHint(text: string) {
  const lower = String(text || '').toLowerCase();
  if (lower.includes('applications submitted') || lower.includes('already applying')) return 'applications_submitted';
  if (lower.includes('interviews active') || lower.includes('already interviewing')) return 'interview_active';
  if (lower.includes('offer received') || lower.includes('offer ready')) return 'offer_received';
  if (lower.includes('resume ready') || lower.includes('portfolio ready') || lower.includes('materials ready')) {
    return 'materials_ready';
  }
  if (
    lower.includes('target role map') ||
    lower.includes('target role family') ||
    lower.includes('role family defined')
  ) {
    return 'target_role_defined';
  }
  return 'unknown';
}

/**
 * Stage deliverables based on progress through cycle
 * Early (0-33%), Middle (33-66%), Late (66-100%)
 */
function stageDeliverable(stage: 'early' | 'middle' | 'late', index: number): string {
  const stageLabels: Record<string, string[]> = {
    early: ['Planning & setup', 'Scope definition', 'Resource allocation', 'Foundation & setup', 'Initial planning'],
    middle: [
      'Core production',
      'Execution & iteration',
      'Main development',
      'Build & refinement',
      'Production & testing',
    ],
    late: [
      'Verification & finalization',
      'Quality assurance',
      'Final review',
      'Delivery & publication',
      'Launch & rollout',
    ],
  };

  const options = stageLabels[stage] ?? stageLabels['late'];
  return options[index % options.length] ?? 'Final review';
}

/**
 * Extract the primary object noun phrase from goal text for use in deliverable titles.
 * Returns the first meaningful non-stopword, non-process fragment suitable for a title prefix.
 */
function extractGoalObjectPhrase(outcomeText: string, verificationText: string): string {
  const combined = `${outcomeText || ''} ${verificationText || ''}`.toLowerCase().trim();
  if (!combined) return '';

  const OBJECT_STOPWORDS = new Set([
    'a',
    'an',
    'the',
    'my',
    'our',
    'your',
    'their',
    'its',
    'i',
    'we',
    'you',
    'to',
    'for',
    'of',
    'in',
    'on',
    'at',
    'by',
    'with',
    'from',
    'into',
    'as',
    'and',
    'or',
    'but',
    'so',
    'that',
    'this',
    'it',
    'is',
    'am',
    'are',
    'was',
    'be',
    'been',
    'being',
    'have',
    'has',
    'had',
    'do',
    'does',
    'did',
  ]);
  const OBJECT_PROCESS_VERBS = new Set([
    'start',
    'launch',
    'build',
    'create',
    'complete',
    'finish',
    'get',
    'make',
    'run',
    'establish',
    'develop',
    'grow',
    'learn',
    'become',
    'achieve',
    'reach',
    'publish',
    'release',
    'deliver',
    'produce',
    'write',
    'design',
    'plan',
  ]);

  const words = combined
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
  const objectWords: string[] = [];
  let capturing = false;

  for (const word of words) {
    if (OBJECT_PROCESS_VERBS.has(word)) {
      capturing = true;
      continue;
    }
    if (capturing && !OBJECT_STOPWORDS.has(word) && word.length >= 3) {
      objectWords.push(word);
      if (objectWords.length >= 3) break;
    }
  }

  if (objectWords.length === 0) {
    // Fallback: take first 2 content words that are not stopwords/verbs
    for (const word of words) {
      if (!OBJECT_STOPWORDS.has(word) && !OBJECT_PROCESS_VERBS.has(word) && word.length >= 3) {
        objectWords.push(word);
        if (objectWords.length >= 2) break;
      }
    }
  }

  return objectWords.join(' ');
}

/**
 * Build a deliverable title that carries the goal object through a phase position.
 * Falls back to stageDeliverable() only if no object can be extracted.
 */
function buildObjectAwareStagedTitle(stage: 'early' | 'middle' | 'late', index: number, goalObject: string): string {
  if (!goalObject) return stageDeliverable(stage, index);

  const phaseTemplates: Record<string, string[]> = {
    early: [
      `{object} foundation and setup`,
      `{object} scope and initial structure`,
      `{object} planning and preparation`,
    ],
    middle: [`{object} core production`, `{object} development and iteration`, `{object} build and refinement`],
    late: [`{object} completion and review`, `{object} final delivery`, `{object} release and closeout`],
  };

  const templates = phaseTemplates[stage] ?? phaseTemplates['late'];
  const template = templates[index % templates.length] ?? `{object} final delivery`;
  return template.replace('{object}', goalObject);
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
function buildMusicReleaseDeliverables(daysUntilDeadline: number): StrategyDeliverable[] {
  const baseBlocks = Math.max(8, Math.floor(daysUntilDeadline / 5)); // 1 block per 5 days
  const deliverables: StrategyDeliverable[] = [
    {
      id: `auto-deliv-1`,
      title: 'Define music release concept, tracklist, and audience direction',
      requiredBlocks: Math.max(3, Math.floor(baseBlocks * 0.18)),
    },
    {
      id: `auto-deliv-2`,
      title: 'Complete tracked recordings for all songs in the music release',
      requiredBlocks: Math.max(4, Math.floor(baseBlocks * 0.22)),
    },
    {
      id: `auto-deliv-3`,
      title: 'Complete mix, master, and sequencing pass for music release',
      requiredBlocks: Math.max(3, Math.floor(baseBlocks * 0.18)),
    },
    {
      id: `auto-deliv-4`,
      title: 'Prepare music release artwork, metadata, and distribution package',
      requiredBlocks: Math.max(3, Math.floor(baseBlocks * 0.18)),
    },
    {
      id: `auto-deliv-5`,
      title: 'Run music release readiness review and launch checklist',
      requiredBlocks: Math.max(2, Math.floor(baseBlocks * 0.14)),
    },
  ];

  return deliverables;
}

function buildTvWritingDeliverables(daysUntilDeadline: number): StrategyDeliverable[] {
  const baseBlocks = Math.max(10, Math.floor(daysUntilDeadline / 4));
  return [
    {
      id: 'auto-deliv-tv-1',
      title: 'Season premise and story outline',
      requiredBlocks: Math.max(3, Math.floor(baseBlocks * 0.15)),
    },
    {
      id: 'auto-deliv-tv-2',
      title: 'Character and cast definitions',
      requiredBlocks: Math.max(3, Math.floor(baseBlocks * 0.15)),
    },
    {
      id: 'auto-deliv-tv-3',
      title: 'Season arc map',
      requiredBlocks: Math.max(4, Math.floor(baseBlocks * 0.2)),
    },
    {
      id: 'auto-deliv-tv-4',
      title: 'Episode outlines',
      requiredBlocks: Math.max(6, Math.floor(baseBlocks * 0.25)),
    },
    {
      id: 'auto-deliv-tv-5',
      title: 'Episode draft scripts',
      requiredBlocks: Math.max(6, Math.floor(baseBlocks * 0.2)),
    },
    {
      id: 'auto-deliv-tv-6',
      title: 'Continuity and final revision',
      requiredBlocks: Math.max(4, Math.floor(baseBlocks * 0.15)),
    },
  ];
}

function extractEpisodeNumbers(outcomeText: string, verificationText: string): number[] {
  const text = `${outcomeText || ''} ${verificationText || ''}`.toLowerCase();
  const values = new Set<number>();

  const rangePattern = /episodes?\s+(\d+)\s*(?:-|through|to)\s*(\d+)/g;
  let rangeMatch;
  while ((rangeMatch = rangePattern.exec(text)) !== null) {
    const start = Number(rangeMatch[1]);
    const end = Number(rangeMatch[2]);
    if (!Number.isFinite(start) || !Number.isFinite(end)) continue;
    const lower = Math.max(1, Math.min(start, end));
    const upper = Math.min(24, Math.max(start, end));
    for (let cursor = lower; cursor <= upper; cursor += 1) {
      values.add(cursor);
    }
  }

  const explicitPattern = /episode\s+(\d+)/g;
  let explicitMatch;
  while ((explicitMatch = explicitPattern.exec(text)) !== null) {
    const value = Number(explicitMatch[1]);
    if (Number.isFinite(value) && value > 0 && value <= 24) {
      values.add(value);
    }
  }

  if (values.size > 0) {
    return Array.from(values).sort((a, b) => a - b);
  }

  const countPattern = /(\d+)[-\s]episode\b|(\d+)\s+episodes\b/g;
  let countMatch;
  while ((countMatch = countPattern.exec(text)) !== null) {
    const count = Number(countMatch[1] || countMatch[2]);
    if (!Number.isFinite(count) || count <= 0) continue;
    const capped = Math.min(12, Math.max(1, count));
    return Array.from({ length: capped }, (_, index) => index + 1);
  }

  return [];
}

function buildEpisodeSpecificTvDeliverables(
  daysUntilDeadline: number,
  outcomeText: string,
  verificationText: string
): StrategyDeliverable[] {
  const episodeNumbers = extractEpisodeNumbers(outcomeText, verificationText);
  if (episodeNumbers.length === 0) {
    return buildTvWritingDeliverables(daysUntilDeadline);
  }

  const baseBlocks = Math.max(12, Math.floor(daysUntilDeadline / 4));
  const deliverables: StrategyDeliverable[] = [
    {
      id: 'auto-deliv-tv-premise',
      title: 'Season premise and story outline',
      requiredBlocks: Math.max(3, Math.floor(baseBlocks * 0.12)),
    },
    {
      id: 'auto-deliv-tv-arc',
      title: 'Season arc map',
      requiredBlocks: Math.max(4, Math.floor(baseBlocks * 0.16)),
    },
  ];

  episodeNumbers.forEach((episodeNumber) => {
    deliverables.push({
      id: `auto-deliv-tv-episode-${episodeNumber}-outline`,
      title: `Outline episode ${episodeNumber}`,
      requiredBlocks: Math.max(2, Math.floor(baseBlocks * 0.08)),
    });
    deliverables.push({
      id: `auto-deliv-tv-episode-${episodeNumber}-draft`,
      title: `Draft episode ${episodeNumber} script`,
      requiredBlocks: Math.max(3, Math.floor(baseBlocks * 0.1)),
    });
  });

  deliverables.push({
    id: 'auto-deliv-tv-continuity',
    title: 'Continuity and final revision',
    requiredBlocks: Math.max(3, Math.floor(baseBlocks * 0.12)),
  });

  return deliverables;
}

function buildEpisodeProductionDeliverables(
  daysUntilDeadline: number,
  outcomeText: string,
  verificationText: string
): StrategyDeliverable[] {
  const episodeNumbers = extractEpisodeNumbers(outcomeText, verificationText);
  const text = `${outcomeText || ''} ${verificationText || ''}`;
  const startingState = extractStartingStateHint(text);
  if (episodeNumbers.length === 0) {
    return [
      {
        id: 'auto-deliv-podcast-format',
        title:
          startingState === 'already_equipped'
            ? 'Audit existing podcast show format and theme'
            : 'Finalize podcast show format and theme',
        requiredBlocks: Math.max(3, Math.floor(Math.max(10, Math.floor(daysUntilDeadline / 4)) * 0.2)),
      },
      {
        id: 'auto-deliv-podcast-setup',
        title:
          startingState === 'already_equipped'
            ? 'Refine podcast recording workflow and equipment'
            : 'Prepare podcast recording workflow and equipment',
        requiredBlocks: Math.max(3, Math.floor(Math.max(10, Math.floor(daysUntilDeadline / 4)) * 0.2)),
      },
      {
        id: 'auto-deliv-podcast-episodes',
        title: 'Record and edit podcast episode batch',
        requiredBlocks: Math.max(8, Math.floor(Math.max(10, Math.floor(daysUntilDeadline / 4)) * 0.45)),
      },
      {
        id: 'auto-deliv-podcast-release',
        title: 'Finalize podcast release package and publishing plan',
        requiredBlocks: Math.max(3, Math.floor(Math.max(10, Math.floor(daysUntilDeadline / 4)) * 0.15)),
      },
    ];
  }

  const baseBlocks = Math.max(12, Math.floor(daysUntilDeadline / 4));
  const deliverables: StrategyDeliverable[] = [
    {
      id: 'auto-deliv-podcast-format',
      title:
        startingState === 'already_equipped'
          ? 'Audit existing podcast show format and theme'
          : 'Finalize podcast show format and theme',
      requiredBlocks: Math.max(2, Math.floor(baseBlocks * 0.1)),
    },
    {
      id: 'auto-deliv-podcast-setup',
      title:
        startingState === 'already_equipped'
          ? 'Refine podcast recording workflow and equipment'
          : 'Prepare podcast recording workflow and equipment',
      requiredBlocks: Math.max(2, Math.floor(baseBlocks * 0.12)),
    },
  ];

  episodeNumbers.forEach((episodeNumber) => {
    deliverables.push({
      id: `auto-deliv-podcast-episode-${episodeNumber}-film`,
      title: `Film episode ${episodeNumber}`,
      requiredBlocks: Math.max(2, Math.floor(baseBlocks * 0.06)),
    });
    deliverables.push({
      id: `auto-deliv-podcast-episode-${episodeNumber}-edit`,
      title: `Edit episode ${episodeNumber}`,
      requiredBlocks: Math.max(2, Math.floor(baseBlocks * 0.06)),
    });
    deliverables.push({
      id: `auto-deliv-podcast-episode-${episodeNumber}-publish`,
      title: `Publish episode ${episodeNumber}`,
      requiredBlocks: Math.max(2, Math.floor(baseBlocks * 0.05)),
    });
  });

  deliverables.push({
    id: 'auto-deliv-podcast-release',
    title: 'Finalize podcast release package and publishing plan',
    requiredBlocks: Math.max(3, Math.floor(baseBlocks * 0.12)),
  });

  return deliverables;
}

function extractCreativeProductionObject(outcomeText: string, verificationText: string) {
  const text = `${outcomeText || ''} ${verificationText || ''}`.toLowerCase();
  if (/\bpodcast\b/.test(text)) return 'podcast episode release';
  if (/\b(album|ep|song|single|track|mixtape)\b/.test(text)) return 'music release';
  if (/\b(documentary|film|video|short film|video essay|youtube)\b/.test(text)) return 'video production';
  if (/\b(book|novel|manuscript|chapter|essay collection|newsletter)\b/.test(text)) return 'manuscript draft';
  if (/\b(script|screenplay|pilot|series)\b/.test(text)) return 'script draft';
  return extractGoalObjectPhrase(outcomeText, verificationText) || 'creative project';
}

function buildCreativeProductionDeliverables(
  daysUntilDeadline: number,
  outcomeText: string,
  verificationText: string
): StrategyDeliverable[] {
  const text = `${outcomeText || ''} ${verificationText || ''}`;
  const lower = text.toLowerCase();
  const startingState = extractStartingStateHint(text);
  const baseBlocks = Math.max(10, Math.floor(daysUntilDeadline / 4));
  const creativeObject = extractCreativeProductionObject(outcomeText, verificationText);

  if (/\b(documentary|film|video|short film|video essay|youtube)\b/.test(lower)) {
    return [
      {
        id: 'auto-deliv-creative-video-brief',
        title: `Define ${creativeObject} concept, outline, and audience brief`,
        requiredBlocks: Math.max(2, Math.floor(baseBlocks * 0.14)),
      },
      {
        id: 'auto-deliv-creative-video-plan',
        title: `Build ${creativeObject} shot plan, production checklist, and asset list`,
        requiredBlocks: Math.max(2, Math.floor(baseBlocks * 0.18)),
      },
      {
        id: 'auto-deliv-creative-video-cut',
        title: `Produce first cut and rough edit for ${creativeObject}`,
        requiredBlocks: Math.max(3, Math.floor(baseBlocks * 0.24)),
      },
      {
        id: 'auto-deliv-creative-video-polish',
        title: `Complete final edit, sound polish, and graphics for ${creativeObject}`,
        requiredBlocks: Math.max(2, Math.floor(baseBlocks * 0.16)),
      },
      {
        id: 'auto-deliv-creative-video-release',
        title: `Prepare ${creativeObject} release package and publication checklist`,
        requiredBlocks: Math.max(2, Math.floor(baseBlocks * 0.14)),
      },
    ];
  }

  if (/\b(book|novel|manuscript|chapter|essay collection|newsletter)\b/.test(lower)) {
    return [
      {
        id: 'auto-deliv-creative-book-outline',
        title:
          startingState === 'prototype_ready'
            ? `Audit ${creativeObject} outline, chapter map, and reader promise`
            : `Define ${creativeObject} outline, chapter map, and reader promise`,
        requiredBlocks: Math.max(2, Math.floor(baseBlocks * 0.14)),
      },
      {
        id: 'auto-deliv-creative-book-draft',
        title: `Draft core sections and writing cadence for ${creativeObject}`,
        requiredBlocks: Math.max(3, Math.floor(baseBlocks * 0.24)),
      },
      {
        id: 'auto-deliv-creative-book-revision',
        title: `Revise structure, clarity, and continuity across ${creativeObject}`,
        requiredBlocks: Math.max(2, Math.floor(baseBlocks * 0.18)),
      },
      {
        id: 'auto-deliv-creative-book-proof',
        title: `Prepare ${creativeObject} proofread pass and submission package`,
        requiredBlocks: Math.max(2, Math.floor(baseBlocks * 0.16)),
      },
      {
        id: 'auto-deliv-creative-book-review',
        title: `Run ${creativeObject} publication review and final checklist`,
        requiredBlocks: Math.max(2, Math.floor(baseBlocks * 0.14)),
      },
    ];
  }

  if (/\b(album|ep|song|single|track|mixtape)\b/.test(lower)) {
    return [
      {
        id: 'auto-deliv-creative-music-brief',
        title:
          startingState === 'prototype_ready'
            ? 'Audit music release concept, tracklist, and audience direction'
            : 'Define music release concept, tracklist, and audience direction',
        requiredBlocks: Math.max(2, Math.floor(baseBlocks * 0.14)),
      },
      {
        id: 'auto-deliv-creative-music-draft',
        title: 'Complete tracked recordings for all songs in the music release',
        requiredBlocks: Math.max(3, Math.floor(baseBlocks * 0.24)),
      },
      {
        id: 'auto-deliv-creative-music-polish',
        title: 'Complete mix, master, and sequencing pass for music release',
        requiredBlocks: Math.max(2, Math.floor(baseBlocks * 0.18)),
      },
      {
        id: 'auto-deliv-creative-music-package',
        title: 'Prepare music release artwork, metadata, and distribution package',
        requiredBlocks: Math.max(2, Math.floor(baseBlocks * 0.16)),
      },
      {
        id: 'auto-deliv-creative-music-review',
        title: 'Run music release readiness review and launch checklist',
        requiredBlocks: Math.max(2, Math.floor(baseBlocks * 0.14)),
      },
    ];
  }

  return [
    {
      id: 'auto-deliv-creative-concept',
      title: `Define ${creativeObject} concept, audience, and success criteria`,
      requiredBlocks: Math.max(2, Math.floor(baseBlocks * 0.14)),
    },
    {
      id: 'auto-deliv-creative-plan',
      title: `Build ${creativeObject} outline, workflow, and production checklist`,
      requiredBlocks: Math.max(2, Math.floor(baseBlocks * 0.18)),
    },
    {
      id: 'auto-deliv-creative-draft',
      title: `Produce first draft or working cut for ${creativeObject}`,
      requiredBlocks: Math.max(3, Math.floor(baseBlocks * 0.24)),
    },
    {
      id: 'auto-deliv-creative-polish',
      title: `Complete revision and technical polish for ${creativeObject}`,
      requiredBlocks: Math.max(2, Math.floor(baseBlocks * 0.16)),
    },
    {
      id: 'auto-deliv-creative-package',
      title: `Prepare ${creativeObject} release package and review checklist`,
      requiredBlocks: Math.max(2, Math.floor(baseBlocks * 0.14)),
    },
  ];
}

function extractCapabilityStartingStateHint(text: string) {
  const lower = String(text || '').toLowerCase();
  if (lower.includes('baseline recorded') || lower.includes('already practicing')) return 'baseline_recorded';
  if (lower.includes('proof ready') || lower.includes('assessment ready')) return 'proof_ready';
  return 'unknown';
}

function extractQualificationObject(outcomeText: string) {
  const text = String(outcomeText || '').trim();
  if (!text) return 'certification exam';
  const patterns = [
    /\bpass\s+the\s+(.+?)(?:\s+by\b|\s+within\b|\s+in\s+\d+\s+days?\b|$)/i,
    /\bprepare\s+for\s+and\s+pass\s+the\s+(.+?)(?:\s+by\b|\s+within\b|\s+in\s+\d+\s+days?\b|$)/i,
    /\bprepare\s+for\s+the\s+(.+?)(?:\s+by\b|\s+within\b|\s+in\s+\d+\s+days?\b|$)/i,
    /\bbe\s+ready\s+for\s+the\s+(.+?)(?:\s+by\b|\s+within\b|\s+in\s+\d+\s+days?\b|$)/i,
  ];
  for (const pattern of patterns) {
    const match = pattern.exec(text);
    const candidate = String(match?.[1] || '')
      .replace(/\s+/g, ' ')
      .replace(/[.,;:]+$/g, '')
      .trim();
    if (candidate.length >= 3) return candidate;
  }
  if (/\bexam\b/i.test(text) || /\bcertification\b/i.test(text)) {
    return text.replace(/\s+/g, ' ').trim();
  }
  return 'certification exam';
}

function normalizeQualificationObject(value: string) {
  const cleaned = String(value || '')
    .replace(/\b(pass|prepare for|be ready for|complete)\b/gi, '')
    .replace(/\bby\s+[A-Za-z]+\s+\d{1,2}\b/gi, '')
    .replace(/\bwithin\s+\d+\s+(days?|weeks?|months?)\b/gi, '')
    .replace(/\bin\s+\d+\s+days?\b/gi, '')
    .replace(/\s+/g, ' ')
    .replace(/[.,;:]+$/g, '')
    .trim();
  return cleaned || 'certification exam';
}

function extractPhysicalStartingStateHint(text: string) {
  const lower = String(text || '').toLowerCase();
  if (lower.includes('baseline recorded') || lower.includes('baseline established')) return 'baseline_recorded';
  if (lower.includes('recovery stable') || lower.includes('load tolerant')) return 'recovery_stable';
  if (lower.includes('benchmark ready') || lower.includes('benchmark recorded')) return 'benchmark_ready';
  if (lower.includes('event ready') || lower.includes('race ready')) return 'event_ready';
  if (lower.includes('rehab') || lower.includes('return to training') || lower.includes('injury')) {
    return 'rehab_return';
  }
  return 'unknown';
}

function extractSkillGoalObject(outcomeText: string, verificationText: string): string {
  const text = `${outcomeText || ''} ${verificationText || ''}`.trim();
  if (!text) return 'target skill';
  const patterns = [
    /\blearn\s+(.+?)(?:\s+well enough|\s+to\b|\s+by\b|\s+within\b|\s+in\s+\d+\s+days?\b|$)/i,
    /\bmaster\s+(.+?)(?:\s+to\b|\s+by\b|\s+within\b|\s+in\s+\d+\s+days?\b|$)/i,
    /\bbecome\s+proficient\s+in\s+(.+?)(?:\s+to\b|\s+by\b|\s+within\b|\s+in\s+\d+\s+days?\b|$)/i,
    /\bdevelop\s+(.+?)\s+skills?(?:\s+to\b|\s+by\b|\s+within\b|\s+in\s+\d+\s+days?\b|$)/i,
    /\bbuild\s+(.+?)\s+skills?(?:\s+to\b|\s+by\b|\s+within\b|\s+in\s+\d+\s+days?\b|$)/i,
  ];
  for (const pattern of patterns) {
    const match = pattern.exec(text);
    const candidate = String(match?.[1] || '')
      .replace(/\b(my|the|a|an)\b/gi, '')
      .replace(/\s+/g, ' ')
      .trim();
    if (candidate.length >= 3) return candidate;
  }
  return extractGoalObjectPhrase(outcomeText, verificationText) || 'target skill';
}

function extractExplicitProjectCount(text: string) {
  const lower = String(text || '').toLowerCase();
  const wordToNumber: Record<string, number> = {
    one: 1,
    two: 2,
    three: 3,
    four: 4,
    five: 5,
    six: 6,
  };
  const numericMatch = /\b(\d+)\s+(?:(?:working|portfolio|capstone)\s+){0,3}projects?\b/.exec(lower);
  if (numericMatch) {
    const count = Number(numericMatch[1]);
    return Number.isFinite(count) ? Math.max(0, count) : 0;
  }
  const wordMatch = new RegExp(
    `\\b(${Object.keys(wordToNumber).join('|')})\\s+(?:(?:working|portfolio|capstone)\\s+){0,3}projects?\\b`
  ).exec(lower);
  if (wordMatch) return wordToNumber[wordMatch[1]] || 0;
  return 0;
}

function normalizeSkillProjectTitle(value: string, goalObject: string) {
  const cleaned = String(value || '')
    .replace(/^[\s:;,\-–—]+|[\s:;,\-–—]+$/g, '')
    .replace(/\b(project|projects)\s+\d+\s*[:\-]?\s*/i, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!cleaned) return '';
  if (
    /\b(project|dashboard|analysis|case study|portfolio|prototype|build|system|workflow|plan|model|exercise|drill)\b/i.test(
      cleaned
    )
  ) {
    return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
  }
  if (goalObject && !cleaned.toLowerCase().includes(goalObject.toLowerCase())) {
    return `${cleaned.charAt(0).toUpperCase() + cleaned.slice(1)} for ${goalObject}`;
  }
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
}

function extractNamedSkillProjects(outcomeText: string, verificationText: string, goalObject: string): string[] {
  const text = `${outcomeText || ''} ${verificationText || ''}`;
  const projectListMatch = /projects?\s*:\s*([\s\S]+)/i.exec(text);
  if (projectListMatch) {
    const listed = String(projectListMatch[1] || '')
      .split(/[;,\n]+/)
      .map((entry) => normalizeSkillProjectTitle(entry, goalObject))
      .filter(Boolean);
    if (listed.length > 0) return Array.from(new Set(listed));
  }

  const candidates = String(text || '')
    .split(/[\n;]+/)
    .map((segment) => segment.trim())
    .filter(Boolean);
  const explicit = candidates
    .flatMap((segment) => {
      const projectMatches = Array.from(segment.matchAll(/\bproject\s*\d+\s*[:\-]?\s*([^,;\n]+)/gi), (match) =>
        normalizeSkillProjectTitle(match[1], goalObject)
      ).filter(Boolean);
      if (projectMatches.length > 0) return projectMatches;
      const colonList = /projects?\s*:\s*(.+)$/i.exec(segment);
      if (!colonList) return [];
      return String(colonList[1] || '')
        .split(/,\s*/)
        .map((entry) => normalizeSkillProjectTitle(entry, goalObject))
        .filter(Boolean);
    })
    .filter(Boolean);
  return Array.from(new Set(explicit));
}

function isSqlSkillGoal(outcomeText: string, verificationText: string) {
  const text = `${outcomeText || ''} ${verificationText || ''}`.toLowerCase();
  return (
    /\bsql\b/.test(text) &&
    /\b(query|queries|dashboard|analysis|analytics|portfolio|project|projects|interview|join|joins|cte|window)\b/.test(
      text
    )
  );
}

function buildSkillAcquisitionDeliverables(
  daysUntilDeadline: number,
  outcomeText: string,
  verificationText: string
): StrategyDeliverable[] {
  const baseBlocks = Math.max(8, Math.floor(daysUntilDeadline / 5));
  const text = `${outcomeText || ''} ${verificationText || ''}`;
  const startingState = extractCapabilityStartingStateHint(text);
  const goalObject = extractSkillGoalObject(outcomeText, verificationText);
  const explicitProjectTitles = extractNamedSkillProjects(outcomeText, verificationText, goalObject);
  const explicitProjectCount = Math.max(explicitProjectTitles.length, extractExplicitProjectCount(text));

  if (isSqlSkillGoal(outcomeText, verificationText)) {
    return [
      {
        id: 'auto-deliv-skill-baseline',
        title:
          startingState === 'baseline_recorded'
            ? 'Audit SQL fundamentals query practice baseline'
            : 'Establish SQL fundamentals query practice baseline',
        requiredBlocks: Math.max(2, Math.floor(baseBlocks * 0.14)),
      },
      {
        id: 'auto-deliv-skill-project-1',
        title: 'Complete relational schema and data import project',
        requiredBlocks: Math.max(2, Math.floor(baseBlocks * 0.18)),
      },
      {
        id: 'auto-deliv-skill-project-2',
        title: 'Complete business analysis query case study',
        requiredBlocks: Math.max(2, Math.floor(baseBlocks * 0.18)),
      },
      {
        id: 'auto-deliv-skill-project-3',
        title: 'Complete advanced reporting and window function project',
        requiredBlocks: Math.max(2, Math.floor(baseBlocks * 0.18)),
      },
      {
        id: 'auto-deliv-skill-proof',
        title: 'Produce GitHub portfolio and query explanation package',
        requiredBlocks: Math.max(2, Math.floor(baseBlocks * 0.16)),
      },
      {
        id: 'auto-deliv-skill-review',
        title: 'Run SQL interview drill and readiness review',
        requiredBlocks: Math.max(2, Math.floor(baseBlocks * 0.14)),
      },
    ];
  }

  if (explicitProjectCount >= 2) {
    const projectTitles = Array.from({ length: explicitProjectCount }, (_, index) => {
      if (explicitProjectTitles[index]) {
        return explicitProjectTitles[index];
      }
      return index === 0
        ? `Complete first ${goalObject} portfolio project and walkthrough`
        : index === 1
          ? `Complete second ${goalObject} portfolio project with higher complexity`
          : `Complete ${goalObject} portfolio project ${index + 1} and evidence summary`;
    });
    return [
      {
        id: 'auto-deliv-skill-baseline',
        title:
          startingState === 'baseline_recorded'
            ? `Audit baseline in ${goalObject}`
            : `Establish baseline in ${goalObject}`,
        requiredBlocks: Math.max(2, Math.floor(baseBlocks * 0.14)),
      },
      ...projectTitles.map((title, index) => ({
        id: `auto-deliv-skill-project-${index + 1}`,
        title,
        requiredBlocks: Math.max(2, Math.floor(baseBlocks * 0.18)),
      })),
      {
        id: 'auto-deliv-skill-proof',
        title: `Produce proof artifact showing ${goalObject}`,
        requiredBlocks: Math.max(2, Math.floor(baseBlocks * 0.16)),
      },
      {
        id: 'auto-deliv-skill-review',
        title: `Run final readiness review for ${goalObject}`,
        requiredBlocks: Math.max(2, Math.floor(baseBlocks * 0.14)),
      },
    ];
  }

  return [
    {
      id: 'auto-deliv-skill-baseline',
      title:
        startingState === 'baseline_recorded'
          ? `Audit ${goalObject} fundamentals baseline and reference set`
          : `Establish ${goalObject} fundamentals baseline and reference set`,
      requiredBlocks: Math.max(2, Math.floor(baseBlocks * 0.14)),
    },
    {
      id: 'auto-deliv-skill-practice',
      title: `Complete ${goalObject} guided exercises and drill set`,
      requiredBlocks: Math.max(2, Math.floor(baseBlocks * 0.18)),
    },
    {
      id: 'auto-deliv-skill-reps',
      title: `Complete ${goalObject} applied project or case study`,
      requiredBlocks: Math.max(2, Math.floor(baseBlocks * 0.18)),
    },
    {
      id: 'auto-deliv-skill-proof',
      title: `Produce ${goalObject} portfolio demonstration and explanation package`,
      requiredBlocks: Math.max(2, Math.floor(baseBlocks * 0.16)),
    },
    {
      id: 'auto-deliv-skill-review',
      title: `Run ${goalObject} readiness drill and weak-skill remediation review`,
      requiredBlocks: Math.max(2, Math.floor(baseBlocks * 0.14)),
    },
  ];
}

function buildProfessionalQualificationDeliverables(
  daysUntilDeadline: number,
  outcomeText: string,
  verificationText: string
): StrategyDeliverable[] {
  const baseBlocks = Math.max(8, Math.floor(daysUntilDeadline / 5));
  const startingState = extractCapabilityStartingStateHint(`${outcomeText || ''} ${verificationText || ''}`);
  const qualificationObject = normalizeQualificationObject(extractQualificationObject(outcomeText));

  return [
    {
      id: 'auto-deliv-qualify-boundary',
      title:
        startingState === 'baseline_recorded'
          ? `Audit ${qualificationObject} requirements, eligibility, and scheduling gaps`
          : `Verify ${qualificationObject} requirements, eligibility, and exam boundary`,
      requiredBlocks: Math.max(2, Math.floor(baseBlocks * 0.14)),
    },
    {
      id: 'auto-deliv-qualify-study',
      title: `Build ${qualificationObject} domain coverage map and study note set`,
      requiredBlocks: Math.max(2, Math.floor(baseBlocks * 0.18)),
    },
    {
      id: 'auto-deliv-qualify-practice',
      title: `Complete ${qualificationObject} question bank and timed mock exam set`,
      requiredBlocks: Math.max(2, Math.floor(baseBlocks * 0.18)),
    },
    {
      id: 'auto-deliv-qualify-proof',
      title: `Compile ${qualificationObject} weak-domain remediation log and cheat sheet`,
      requiredBlocks: Math.max(2, Math.floor(baseBlocks * 0.16)),
    },
    {
      id: 'auto-deliv-qualify-review',
      title: `Run ${qualificationObject} readiness review and credential-day checklist`,
      requiredBlocks: Math.max(2, Math.floor(baseBlocks * 0.14)),
    },
  ];
}

function buildPhysicalTrainingDeliverables(
  daysUntilDeadline: number,
  outcomeText: string,
  verificationText: string
): StrategyDeliverable[] {
  const baseBlocks = Math.max(8, Math.floor(daysUntilDeadline / 5));
  const text = `${outcomeText || ''} ${verificationText || ''}`;
  const startingState = extractPhysicalStartingStateHint(text);
  const lower = text.toLowerCase();
  const isRehab = /\brehab\b|\breturn to training\b|\binjury\b|\bload tolerance\b/.test(lower);
  const isEndurance = /\bmarathon\b|\bhalf marathon\b|\b5k\b|\b10k\b|\brace\b|\brun\b|\bendurance\b/.test(lower);
  const isStrength = /\bstrength\b|\blift\b|\bsquat\b|\bdeadlift\b|\bbench\b|\bbarbell\b/.test(lower);
  const isBodyComp =
    /\bweight loss\b|\bbody composition\b|\bfat loss\b|\bcut\b/.test(lower) ||
    /\blose\s+(?:\d+\s+)?pounds?\b|\blose\s+weight\b|\bpounds?\s+lost\b|\bbody-fat\b/.test(lower);

  const baselineTitle = isRehab
    ? 'Assess recovery baseline and load tolerance'
    : isEndurance
      ? 'Establish baseline run benchmark and pacing profile'
      : isStrength
        ? 'Establish baseline lift benchmark and load profile'
        : isBodyComp
          ? 'Establish body composition baseline and calorie/protein targets'
          : 'Establish baseline benchmark and recovery profile';

  const progressionTitle = isStrength
    ? 'Build periodized strength progression and load structure'
    : isEndurance
      ? 'Build periodized endurance structure and pacing plan'
      : isBodyComp
        ? 'Complete weekly conditioning and strength sessions'
        : 'Build periodized training structure and load progression';

  const checkpointTitle = isRehab
    ? 'Complete return-to-training blocks and recovery checkpoints'
    : isBodyComp
      ? 'Complete nutrition adherence and weigh-in tracking block'
      : 'Complete training block with recovery checkpoints';

  const reviewTitle = isEndurance
    ? 'Run benchmark re-test and pacing review'
    : isStrength
      ? 'Run benchmark re-test and readiness review'
      : isBodyComp
        ? 'Review body composition trend and adjust training plan'
        : 'Run benchmark re-test and readiness review';

  return [
    {
      id: 'auto-deliv-physical-baseline',
      title: startingState === 'baseline_recorded' ? `Audit ${baselineTitle.toLowerCase()}` : baselineTitle,
      requiredBlocks: Math.max(2, Math.floor(baseBlocks * 0.16)),
    },
    {
      id: 'auto-deliv-physical-progression',
      title: progressionTitle,
      requiredBlocks: Math.max(3, Math.floor(baseBlocks * 0.22)),
    },
    {
      id: 'auto-deliv-physical-checkpoints',
      title: checkpointTitle,
      requiredBlocks: Math.max(2, Math.floor(baseBlocks * 0.18)),
    },
    {
      id: 'auto-deliv-physical-review',
      title: reviewTitle,
      requiredBlocks: Math.max(2, Math.floor(baseBlocks * 0.14)),
    },
  ];
}

function buildSoftwareBuildDeliverables(
  daysUntilDeadline: number,
  outcomeText: string,
  verificationText: string
): StrategyDeliverable[] {
  const baseBlocks = Math.max(8, Math.floor(daysUntilDeadline / 5));
  const text = `${outcomeText || ''} ${verificationText || ''}`;
  const startingState = extractStartingStateHint(text);
  const launchBoundary = /\blaunch\b|\bship\b|\brelease\b|\blive\b/i.test(text);

  const deliverables: StrategyDeliverable[] = [
    {
      id: 'auto-deliv-software-artifact',
      title:
        startingState === 'prototype_ready'
          ? 'Audit prototype gaps and target release scope'
          : 'Define product artifact and acceptance criteria',
      requiredBlocks: Math.max(2, Math.floor(baseBlocks * 0.1)),
    },
    {
      id: 'auto-deliv-software-implementation',
      title: 'Implement core feature set',
      requiredBlocks: Math.max(3, Math.floor(baseBlocks * 0.18)),
    },
    {
      id: 'auto-deliv-software-verification',
      title: 'Write verification tests and QA checklist',
      requiredBlocks: Math.max(2, Math.floor(baseBlocks * 0.14)),
    },
    {
      id: 'auto-deliv-software-release',
      title: launchBoundary ? 'Prepare release workflow and deployment' : 'Prepare integration and handoff workflow',
      requiredBlocks: Math.max(2, Math.floor(baseBlocks * 0.12)),
    },
  ];

  if (launchBoundary) {
    deliverables.push({
      id: 'auto-deliv-software-launch',
      title: 'Launch v1 and monitor post-release issues',
      requiredBlocks: Math.max(2, Math.floor(baseBlocks * 0.12)),
    });
  }

  return deliverables;
}

function buildFitnessTrainingDeliverables(
  daysUntilDeadline: number,
  outcomeText: string,
  verificationText: string
): StrategyDeliverable[] {
  const baseBlocks = Math.max(8, Math.floor(daysUntilDeadline / 5));
  const text = `${outcomeText || ''} ${verificationText || ''}`;
  const startingState = extractStartingStateHint(text);

  return [
    {
      id: 'auto-deliv-fitness-baseline',
      title:
        startingState === 'baseline_recorded'
          ? 'Assess current performance and training gap'
          : 'Record baseline metrics and target pace',
      requiredBlocks: Math.max(2, Math.floor(baseBlocks * 0.12)),
    },
    {
      id: 'auto-deliv-fitness-plan',
      title: 'Build weekly training structure',
      requiredBlocks: Math.max(2, Math.floor(baseBlocks * 0.16)),
    },
    {
      id: 'auto-deliv-fitness-sessions',
      title: 'Complete progressive training sessions',
      requiredBlocks: Math.max(3, Math.floor(baseBlocks * 0.22)),
    },
    {
      id: 'auto-deliv-fitness-recovery',
      title: 'Complete recovery and milestone checks',
      requiredBlocks: Math.max(2, Math.floor(baseBlocks * 0.14)),
    },
  ];
}

function buildBusinessLaunchDeliverables(
  daysUntilDeadline: number,
  outcomeText: string,
  verificationText: string
): StrategyDeliverable[] {
  const baseBlocks = Math.max(8, Math.floor(daysUntilDeadline / 5));
  const text = `${outcomeText || ''} ${verificationText || ''}`;
  const startingState = extractStartingStateHint(text);

  if (isServiceLaunchGoal(outcomeText, verificationText, 'BusinessLaunch')) {
    return [
      {
        id: 'auto-deliv-business-offer',
        title:
          startingState === 'offer_defined'
            ? 'Audit service offer and target client'
            : 'Define service offer and target client',
        requiredBlocks: Math.max(2, Math.floor(baseBlocks * 0.18)),
      },
      {
        id: 'auto-deliv-business-pricing',
        title: 'Define pricing tiers and qualification gates',
        requiredBlocks: Math.max(2, Math.floor(baseBlocks * 0.18)),
      },
      {
        id: 'auto-deliv-business-process',
        title: 'Prepare delivery process and onboarding workflow',
        requiredBlocks: Math.max(2, Math.floor(baseBlocks * 0.2)),
      },
      {
        id: 'auto-deliv-business-outreach',
        title: 'Build outreach scripts and first prospect list',
        requiredBlocks: Math.max(2, Math.floor(baseBlocks * 0.18)),
      },
      {
        id: 'auto-deliv-business-close',
        title: 'Run discovery calls and close first client',
        requiredBlocks: Math.max(2, Math.floor(baseBlocks * 0.16)),
      },
    ];
  }

  return [
    {
      id: 'auto-deliv-business-offer',
      title:
        startingState === 'offer_defined' ? 'Refine offer and delivery boundary' : 'Define offer and target customer',
      requiredBlocks: Math.max(2, Math.floor(baseBlocks * 0.12)),
    },
    {
      id: 'auto-deliv-business-delivery',
      title: 'Prepare service delivery workflow',
      requiredBlocks: Math.max(2, Math.floor(baseBlocks * 0.16)),
    },
    {
      id: 'auto-deliv-business-channel',
      title: 'Set up acquisition channel',
      requiredBlocks: Math.max(2, Math.floor(baseBlocks * 0.16)),
    },
    {
      id: 'auto-deliv-business-launch',
      title: 'Run launch outreach',
      requiredBlocks: Math.max(2, Math.floor(baseBlocks * 0.14)),
    },
    {
      id: 'auto-deliv-business-review',
      title: 'Close first clients and review results',
      requiredBlocks: Math.max(2, Math.floor(baseBlocks * 0.12)),
    },
  ];
}

function buildVentureLaunchDeliverables(
  daysUntilDeadline: number,
  outcomeText: string,
  verificationText: string
): StrategyDeliverable[] {
  const baseBlocks = Math.max(8, Math.floor(daysUntilDeadline / 5));
  const text = `${outcomeText || ''} ${verificationText || ''}`;
  const startingState = extractStartingStateHint(text);
  const ventureObject = extractVentureLaunchObject(outcomeText, verificationText);

  if (isServiceLaunchGoal(outcomeText, verificationText, 'VentureLaunch')) {
    return [
      {
        id: 'auto-deliv-venture-offer',
        title:
          startingState === 'offer_defined'
            ? `Audit ${ventureObject} offer and ideal client profile`
            : `Define ${ventureObject} offer and ideal client profile`,
        requiredBlocks: Math.max(2, Math.floor(baseBlocks * 0.18)),
      },
      {
        id: 'auto-deliv-venture-pricing',
        title: `Set ${ventureObject} pricing tiers and qualification gates`,
        requiredBlocks: Math.max(2, Math.floor(baseBlocks * 0.18)),
      },
      {
        id: 'auto-deliv-venture-process',
        title: `Build ${ventureObject} onboarding workflow and delivery checklist`,
        requiredBlocks: Math.max(2, Math.floor(baseBlocks * 0.2)),
      },
      {
        id: 'auto-deliv-venture-outreach',
        title: `Prepare ${ventureObject} outreach scripts and first prospect list`,
        requiredBlocks: Math.max(2, Math.floor(baseBlocks * 0.18)),
      },
      {
        id: 'auto-deliv-venture-close',
        title: `Run ${ventureObject} discovery calls and close first client`,
        requiredBlocks: Math.max(2, Math.floor(baseBlocks * 0.16)),
      },
    ];
  }

  return [
    {
      id: 'auto-deliv-venture-offer',
      title:
        startingState === 'offer_defined'
          ? `Audit ${ventureObject} value proposition and target customer`
          : `Define ${ventureObject} value proposition and target customer`,
      requiredBlocks: Math.max(2, Math.floor(baseBlocks * 0.18)),
    },
    {
      id: 'auto-deliv-venture-funnel',
      title: `Build ${ventureObject} landing page, waitlist flow, and first-user funnel`,
      requiredBlocks: Math.max(2, Math.floor(baseBlocks * 0.2)),
    },
    {
      id: 'auto-deliv-venture-outreach',
      title: `Prepare ${ventureObject} customer outreach list and interview script`,
      requiredBlocks: Math.max(2, Math.floor(baseBlocks * 0.18)),
    },
    {
      id: 'auto-deliv-venture-validation',
      title: `Run ${ventureObject} first-user validation and feedback loop`,
      requiredBlocks: Math.max(2, Math.floor(baseBlocks * 0.16)),
    },
    {
      id: 'auto-deliv-venture-review',
      title: `Compile ${ventureObject} traction evidence and launch next-step review`,
      requiredBlocks: Math.max(2, Math.floor(baseBlocks * 0.14)),
    },
  ];
}

function buildBrandLaunchDeliverables(
  daysUntilDeadline: number,
  outcomeText: string,
  verificationText: string
): StrategyDeliverable[] {
  const text = `${outcomeText || ''} ${verificationText || ''}`;
  const startingState = extractStartingStateHint(text);
  const commercialProductLaunch = isCommercialProductLaunchText(text);
  const baseBlocks = Math.max(8, Math.floor(daysUntilDeadline / 5));
  if (commercialProductLaunch) {
    const productObject = extractCommercialProductObject(outcomeText, verificationText);
    const workload = deriveCommercialProductLaunchWorkload(daysUntilDeadline);
    return [
      {
        id: 'auto-deliv-product-readiness',
        title: `Finalize ${productObject} formula, sample approval, packaging, sourcing, and sellable unit readiness`,
        requiredBlocks: workload.productReadiness,
      },
      {
        id: 'auto-deliv-product-commerce',
        title: `Set ${productObject} offer, pricing, product page, checkout, ordering, and fulfillment path`,
        requiredBlocks: workload.commercialReadiness,
      },
      {
        id: 'auto-deliv-product-launch-communications',
        title: `Create ${productObject} positioning, launch messaging, campaign assets, and sales CTA`,
        requiredBlocks: workload.launchCommunications,
      },
      {
        id: 'auto-deliv-product-first-sales',
        title: `Activate ${productObject} first-sales outreach to initial buyers and track first order attempts`,
        requiredBlocks: workload.firstSalesExecution,
      },
      {
        id: 'auto-deliv-product-sales-review',
        title: `Review ${productObject} first-sales evidence, conversion results, and next-step decision`,
        requiredBlocks: workload.terminalReview,
      },
    ];
  }

  return [
    {
      id: 'auto-deliv-brand-positioning',
      title:
        startingState === 'already_equipped'
          ? 'Refine brand positioning and audience promise'
          : 'Define brand positioning and audience promise',
      requiredBlocks: Math.max(2, Math.floor(baseBlocks * 0.12)),
    },
    {
      id: 'auto-deliv-brand-messaging',
      title: 'Build messaging architecture for priority channels',
      requiredBlocks: Math.max(2, Math.floor(baseBlocks * 0.16)),
    },
    {
      id: 'auto-deliv-brand-identity',
      title: 'Select visual identity direction and standards',
      requiredBlocks: Math.max(2, Math.floor(baseBlocks * 0.14)),
    },
    {
      id: 'auto-deliv-brand-assets',
      title: 'Assemble core brand kit and starter assets',
      requiredBlocks: Math.max(2, Math.floor(baseBlocks * 0.12)),
    },
    {
      id: 'auto-deliv-brand-rollout',
      title: 'Update priority channel profiles and bios',
      requiredBlocks: Math.max(2, Math.floor(baseBlocks * 0.12)),
    },
    {
      id: 'auto-deliv-brand-launch',
      title: 'Publish brand launch announcement and audience CTA',
      requiredBlocks: Math.max(2, Math.floor(baseBlocks * 0.1)),
    },
  ];
}

function deriveCommercialProductLaunchWorkload(daysUntilDeadline: number) {
  // Horizons beyond 12 months earn additional commercial cycles (one cycle per ~60 days).
  // Cap is 5 for standard horizons (≤ 365 days) and rises to 8 for 14-month+ plans so
  // that 15-month regulated-consumable launches carry meaningfully more sourcing loops,
  // compliance checks, merchant readiness gates, and sales cycles than 9-month plans.
  const cycleCap = daysUntilDeadline > 365 ? 8 : 5;
  const operatingCycles = Math.max(3, Math.min(cycleCap, Math.ceil(Math.max(90, daysUntilDeadline || 0) / 60)));
  return {
    operatingCycles,
    productReadiness: 14 + operatingCycles * 2,
    commercialReadiness: 14 + operatingCycles * 3,
    launchCommunications: 10 + operatingCycles * 2,
    firstSalesExecution: operatingCycles * 8,
    terminalReview: operatingCycles * 5,
  };
}

function buildSalesPipelineDeliverables(
  daysUntilDeadline: number,
  outcomeText: string,
  verificationText: string
): StrategyDeliverable[] {
  const baseBlocks = Math.max(10, Math.floor(daysUntilDeadline / 4));
  const text = `${outcomeText || ''} ${verificationText || ''}`.toLowerCase();
  const pipelineActive = /\bpipeline\s+active\b|\balready\s+qualified\b|\balready\s+outreaching\b/.test(text);

  return [
    {
      id: 'auto-deliv-sales-offer',
      title: pipelineActive
        ? 'Audit offer, qualification criteria, and active pipeline gaps'
        : 'Clarify offer, pricing tiers, and qualification criteria',
      requiredBlocks: Math.max(2, Math.floor(baseBlocks * 0.12)),
    },
    {
      id: 'auto-deliv-sales-targets',
      title: 'Define ICP and build first target account list',
      requiredBlocks: Math.max(2, Math.floor(baseBlocks * 0.14)),
    },
    {
      id: 'auto-deliv-sales-outreach',
      title: 'Create outreach scripts and objection-handling library',
      requiredBlocks: Math.max(2, Math.floor(baseBlocks * 0.14)),
    },
    {
      id: 'auto-deliv-sales-crm',
      title: 'Configure CRM stages and pipeline tracking dashboard',
      requiredBlocks: Math.max(2, Math.floor(baseBlocks * 0.14)),
    },
    {
      id: 'auto-deliv-sales-wave',
      title: 'Execute first outreach wave to top-priority leads',
      requiredBlocks: Math.max(3, Math.floor(baseBlocks * 0.16)),
    },
    {
      id: 'auto-deliv-sales-discovery',
      title: 'Run discovery calls and qualify active opportunities',
      requiredBlocks: Math.max(2, Math.floor(baseBlocks * 0.12)),
    },
    {
      id: 'auto-deliv-sales-proposals',
      title: 'Prepare tailored proposal packages for qualified leads',
      requiredBlocks: Math.max(2, Math.floor(baseBlocks * 0.1)),
    },
    {
      id: 'auto-deliv-sales-close',
      title: 'Execute follow-up and negotiation sequence',
      requiredBlocks: Math.max(2, Math.floor(baseBlocks * 0.08)),
    },
    {
      id: 'auto-deliv-sales-handoff',
      title: 'Close deals and prepare onboarding handoff package',
      requiredBlocks: Math.max(2, Math.floor(baseBlocks * 0.06)),
    },
  ];
}

function buildFundraisingDeliverables(
  daysUntilDeadline: number,
  outcomeText: string,
  verificationText: string
): StrategyDeliverable[] {
  const baseBlocks = Math.max(10, Math.floor(daysUntilDeadline / 4));
  const text = `${outcomeText || ''} ${verificationText || ''}`.toLowerCase();
  const deckReady = /\bdeck\s+ready\b|\balready\s+pitched\b|\bdiligence\s+started\b/.test(text);

  const packagePrepMode =
    /\b(package|pitch|investor-ready|investor ready|materials?)\b/.test(text) &&
    /\b(prepare|clear|ready|readiness|story|ask|use[- ]of[- ]funds)\b/.test(text) &&
    !/\b(meetings?|diligence\s+(?:started|requests?)|commitments?|term(?:s)?\b|close\b|closing\b|signature\b|investor conversations?)\b/.test(
      text
    );

  if (packagePrepMode) {
    return [
      {
        id: 'auto-deliv-raise-thesis',
        title: deckReady
          ? 'Audit raise objective, use-of-funds, and investor thesis'
          : 'Define raise objective, use-of-funds, and investor thesis',
        requiredBlocks: Math.max(2, Math.floor(baseBlocks * 0.14)),
      },
      {
        id: 'auto-deliv-raise-deck',
        title: 'Build fundraising narrative, pitch deck, and financial ask storyline',
        requiredBlocks: Math.max(2, Math.floor(baseBlocks * 0.16)),
      },
      {
        id: 'auto-deliv-raise-dataroom',
        title: 'Create diligence checklist, financial package, and data room structure',
        requiredBlocks: Math.max(2, Math.floor(baseBlocks * 0.14)),
      },
      {
        id: 'auto-deliv-raise-targets',
        title: 'Build target investor list and fit scoring model',
        requiredBlocks: Math.max(2, Math.floor(baseBlocks * 0.16)),
      },
      {
        id: 'auto-deliv-raise-outreach',
        title: 'Prepare outreach sequences, intro request scripts, and send package checklist',
        requiredBlocks: Math.max(2, Math.floor(baseBlocks * 0.14)),
      },
      {
        id: 'auto-deliv-raise-readiness',
        title: 'Run fundraising readiness review, objection handling, and investor-ready materials check',
        requiredBlocks: Math.max(2, Math.floor(baseBlocks * 0.12)),
      },
    ];
  }

  return [
    {
      id: 'auto-deliv-raise-thesis',
      title: deckReady
        ? 'Audit raise objective, use-of-funds, and investor thesis'
        : 'Define raise objective, use-of-funds, and investor thesis',
      requiredBlocks: Math.max(2, Math.floor(baseBlocks * 0.12)),
    },
    {
      id: 'auto-deliv-raise-deck',
      title: 'Build fundraising narrative and deck storyline',
      requiredBlocks: Math.max(2, Math.floor(baseBlocks * 0.14)),
    },
    {
      id: 'auto-deliv-raise-dataroom',
      title: 'Create diligence checklist and data room structure',
      requiredBlocks: Math.max(2, Math.floor(baseBlocks * 0.1)),
    },
    {
      id: 'auto-deliv-raise-targets',
      title: 'Build target investor list and fit scoring model',
      requiredBlocks: Math.max(2, Math.floor(baseBlocks * 0.14)),
    },
    {
      id: 'auto-deliv-raise-outreach',
      title: 'Prepare outreach sequences and intro request scripts',
      requiredBlocks: Math.max(2, Math.floor(baseBlocks * 0.14)),
    },
    {
      id: 'auto-deliv-raise-meetings',
      title: 'Run first wave of investor outreach and meetings',
      requiredBlocks: Math.max(3, Math.floor(baseBlocks * 0.16)),
    },
    {
      id: 'auto-deliv-raise-followup',
      title: 'Deliver follow-up materials and manage diligence requests',
      requiredBlocks: Math.max(2, Math.floor(baseBlocks * 0.1)),
    },
    {
      id: 'auto-deliv-raise-terms',
      title: 'Coordinate term discussions and commitment tracking',
      requiredBlocks: Math.max(2, Math.floor(baseBlocks * 0.08)),
    },
    {
      id: 'auto-deliv-raise-close',
      title: 'Finalize legal close process and signature workflow',
      requiredBlocks: Math.max(2, Math.floor(baseBlocks * 0.06)),
    },
  ];
}

function buildJobSearchPipelineDeliverables(
  daysUntilDeadline: number,
  outcomeText: string,
  verificationText: string
): StrategyDeliverable[] {
  const baseBlocks = Math.max(10, Math.floor(daysUntilDeadline / 4));
  const text = `${outcomeText || ''} ${verificationText || ''}`;
  const startingState = extractJobSearchStartingStateHint(text);

  return [
    {
      id: 'auto-deliv-job-target',
      title:
        startingState === 'applications_submitted' || startingState === 'interview_active'
          ? 'Audit target role family, submitted applications, and response gaps'
          : startingState === 'materials_ready'
            ? 'Audit target role family and existing materials gaps'
            : 'Define target role family and search criteria',
      requiredBlocks: Math.max(2, Math.floor(baseBlocks * 0.14)),
    },
    {
      id: 'auto-deliv-job-materials',
      title: 'Tailor resume and portfolio for target roles',
      requiredBlocks: Math.max(2, Math.floor(baseBlocks * 0.16)),
    },
    {
      id: 'auto-deliv-job-company-list',
      title: 'Build target company list and prioritization model',
      requiredBlocks: Math.max(2, Math.floor(baseBlocks * 0.14)),
    },
    {
      id: 'auto-deliv-job-tracker',
      title: 'Create application pipeline tracking and outreach workflow',
      requiredBlocks: Math.max(2, Math.floor(baseBlocks * 0.14)),
    },
    {
      id: 'auto-deliv-job-batch',
      title: 'Submit first tailored application batch',
      requiredBlocks: Math.max(3, Math.floor(baseBlocks * 0.16)),
    },
    {
      id: 'auto-deliv-job-interview',
      title: 'Prepare interview story bank and answer framework',
      requiredBlocks: Math.max(2, Math.floor(baseBlocks * 0.12)),
    },
    {
      id: 'auto-deliv-job-mock',
      title: 'Run mock interviews and follow-up practice',
      requiredBlocks: Math.max(2, Math.floor(baseBlocks * 0.1)),
    },
    {
      id: 'auto-deliv-job-followup',
      title: 'Log responses and manage active interview stages',
      requiredBlocks: Math.max(2, Math.floor(baseBlocks * 0.08)),
    },
  ];
}

function buildRealEstateProjectDeliverables(
  daysUntilDeadline: number,
  outcomeText: string,
  verificationText: string
): StrategyDeliverable[] {
  const baseBlocks = Math.max(8, Math.floor(daysUntilDeadline / 5));
  const text = `${outcomeText || ''} ${verificationText || ''}`;
  const startingState = extractStartingStateHint(text);

  return [
    {
      id: 'auto-deliv-real-estate-scope',
      title:
        startingState === 'site_verified'
          ? 'Audit site conditions and permit gaps'
          : 'Confirm site, permit, and approval status',
      requiredBlocks: Math.max(2, Math.floor(baseBlocks * 0.12)),
    },
    {
      id: 'auto-deliv-real-estate-budget',
      title: 'Finalize scope and budget',
      requiredBlocks: Math.max(2, Math.floor(baseBlocks * 0.14)),
    },
    {
      id: 'auto-deliv-real-estate-contractors',
      title: 'Coordinate contractors and materials',
      requiredBlocks: Math.max(2, Math.floor(baseBlocks * 0.16)),
    },
    {
      id: 'auto-deliv-real-estate-work',
      title: 'Complete inspection-critical work',
      requiredBlocks: Math.max(3, Math.floor(baseBlocks * 0.22)),
    },
    {
      id: 'auto-deliv-real-estate-handoff',
      title: 'Pass inspection and handoff',
      requiredBlocks: Math.max(2, Math.floor(baseBlocks * 0.12)),
    },
  ];
}

/**
 * Build generic auto deliverables (fallback)
 */
function buildGenericDeliverables(daysUntilDeadline: number, goalObject: string = ''): StrategyDeliverable[] {
  const baseBlocks = Math.max(6, Math.floor(daysUntilDeadline / 4));
  const phaseCount = 3;
  const perPhase = Math.max(2, Math.floor(baseBlocks / phaseCount));

  return [
    {
      id: `auto-deliv-1`,
      title: buildObjectAwareStagedTitle('early', 0, goalObject),
      requiredBlocks: perPhase,
    },
    {
      id: `auto-deliv-2`,
      title: buildObjectAwareStagedTitle('middle', 0, goalObject),
      requiredBlocks: perPhase,
    },
    {
      id: `auto-deliv-3`,
      title: buildObjectAwareStagedTitle('late', 0, goalObject),
      requiredBlocks: perPhase,
    },
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
  const outcomeText = goalContract?.terminalOutcome?.text || '';
  const verificationText = goalContract?.terminalOutcome?.verificationCriteria || '';
  const executionType =
    ((goalContract as unknown as Record<string, unknown>)?.executionType as string | undefined) ?? '';
  const rawGoalText = String(
    ((goalContract as unknown as Record<string, unknown>)?.goalText as string | undefined) ||
      ((goalContract as unknown as Record<string, unknown>)?.goalLabel as string | undefined) ||
      (((goalContract as unknown as Record<string, unknown>)?.goalDraftV2 as Record<string, unknown> | undefined)
        ?.goalText as string | undefined) ||
      (((goalContract as unknown as Record<string, unknown>)?.goalDraftV2 as Record<string, unknown> | undefined)
        ?.goalLabel as string | undefined) ||
      ''
  );
  const planningOutcomeText = [outcomeText, rawGoalText].filter(Boolean).join(' ');
  const goalType = detectGoalType(planningOutcomeText, verificationText, executionType);
  const goalObject = extractGoalObjectPhrase(planningOutcomeText, verificationText);

  // Generate deliverables
  let deliverables: StrategyDeliverable[];
  if (goalType === 'music_release') {
    deliverables = buildMusicReleaseDeliverables(daysRemaining);
  } else if (goalType === 'episodic_production') {
    deliverables = buildEpisodeProductionDeliverables(daysRemaining, outcomeText, verificationText);
  } else if (goalType === 'tv_writing') {
    deliverables = buildEpisodeSpecificTvDeliverables(daysRemaining, outcomeText, verificationText);
  } else if (goalType === 'skill_acquisition') {
    deliverables = buildSkillAcquisitionDeliverables(daysRemaining, outcomeText, verificationText);
  } else if (goalType === 'professional_qualification') {
    deliverables = buildProfessionalQualificationDeliverables(daysRemaining, outcomeText, verificationText);
  } else if (goalType === 'physical_training') {
    deliverables = buildPhysicalTrainingDeliverables(daysRemaining, outcomeText, verificationText);
  } else if (goalType === 'venture_launch') {
    deliverables = buildVentureLaunchDeliverables(daysRemaining, planningOutcomeText, verificationText);
  } else if (goalType === 'brand_launch') {
    deliverables = buildBrandLaunchDeliverables(daysRemaining, planningOutcomeText, verificationText);
  } else if (goalType === 'job_search_pipeline') {
    deliverables = buildJobSearchPipelineDeliverables(daysRemaining, outcomeText, verificationText);
  } else if (goalType === 'sales_pipeline') {
    deliverables = buildSalesPipelineDeliverables(daysRemaining, outcomeText, verificationText);
  } else if (goalType === 'fundraising') {
    deliverables = buildFundraisingDeliverables(daysRemaining, outcomeText, verificationText);
  } else if (goalType === 'software_build') {
    deliverables = buildSoftwareBuildDeliverables(daysRemaining, outcomeText, verificationText);
  } else if (goalType === 'fitness_training') {
    deliverables = buildFitnessTrainingDeliverables(daysRemaining, outcomeText, verificationText);
  } else if (goalType === 'business_launch') {
    deliverables = buildBusinessLaunchDeliverables(daysRemaining, outcomeText, verificationText);
  } else if (goalType === 'real_estate_project') {
    deliverables = buildRealEstateProjectDeliverables(daysRemaining, outcomeText, verificationText);
  } else if (executionType === 'CreativeProduction') {
    deliverables = buildCreativeProductionDeliverables(daysRemaining, outcomeText, verificationText);
  } else {
    deliverables = buildGenericDeliverables(daysRemaining, goalObject);
  }

  // Ensure minimum 3 deliverables
  while (deliverables.length < 3) {
    deliverables.push({
      id: `auto-deliv-${deliverables.length + 1}`,
      title: buildObjectAwareStagedTitle('late', deliverables.length, goalObject),
      requiredBlocks: Math.max(1, Math.floor(daysRemaining / 7)),
    });
  }

  return {
    deliverables,
    detectedType: goalType,
    rationale: `Auto-generated ${goalType.replace('_', ' ')} deliverables for ${daysRemaining} days until deadline`,
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
    /;\s*(?:also|meanwhile|additionally)/i,
  ];

  const hasCompoundPattern = compoundPatterns.some((pattern) => pattern.test(outcomeText));

  // Look for multiple semicolons or list-like structures
  const semicolonCount = (outcomeText.match(/;/g) || []).length;
  const hasMultipleSentences = semicolonCount > 0 && outcomeText.split(';').filter((s) => s.trim()).length > 2;

  const isCompound = hasCompoundPattern || hasMultipleSentences;

  const outcomes = isCompound
    ? outcomeText
        .split(/[;,]/)
        .map((s) => s.trim())
        .filter((s) => s.length > 10)
    : [outcomeText];

  return { isCompound, outcomes };
}
