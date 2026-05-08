/**
 * autoDeliverables.ts
 *
 * Generates deliverables from mechanism class and goal contract.
 * Each mechanism class has pre-defined delivery templates.
 *
 * Purely deterministic: same inputs produce identical outputs.
 */

import { MechanismClass, deriveMechanismClass, describeMechanismClass } from './mechanismClass';

type LaunchIdentityFamily = 'venture_launch' | 'brand_launch';
type RevenueCapitalFamily = 'sales_pipeline' | 'fundraising';
type EmploymentPipelineFamily = 'job_search_pipeline';
type CapabilityCredentialFamily = 'skill_acquisition' | 'professional_qualification';
type PhysicalProgressionFamily = 'physical_training';
type CreativeProductionFamily = 'creative_production';

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
    { titlePattern: 'Test & refine {outcome}', requiredBlocks: 6, sequence: 3 },
  ],

  PUBLISH: [
    { titlePattern: 'Prepare {outcome} for release', requiredBlocks: 4, sequence: 1 },
    { titlePattern: 'Create release materials', requiredBlocks: 4, sequence: 2 },
    { titlePattern: 'Deploy {outcome}', requiredBlocks: 2, sequence: 3 },
    { titlePattern: 'Monitor & support launch', requiredBlocks: 4, sequence: 4 },
  ],

  MARKET: [
    { titlePattern: 'Define {outcome} market strategy', requiredBlocks: 4, sequence: 1 },
    { titlePattern: 'Create marketing campaign', requiredBlocks: 6, sequence: 2 },
    { titlePattern: 'Execute outreach & acquisition', requiredBlocks: 8, sequence: 3 },
    { titlePattern: 'Track & optimize {outcome} metrics', requiredBlocks: 4, sequence: 4 },
  ],

  LEARN: [
    { titlePattern: 'Research & explore {outcome}', requiredBlocks: 6, sequence: 1 },
    { titlePattern: 'Complete coursework or study', requiredBlocks: 12, sequence: 2 },
    { titlePattern: 'Practice & apply learning', requiredBlocks: 6, sequence: 3 },
    { titlePattern: 'Document knowledge & share', requiredBlocks: 2, sequence: 4 },
  ],

  OPS: [
    { titlePattern: 'Plan {outcome} infrastructure', requiredBlocks: 3, sequence: 1 },
    { titlePattern: 'Implement {outcome} setup', requiredBlocks: 8, sequence: 2 },
    { titlePattern: 'Test & validate systems', requiredBlocks: 4, sequence: 3 },
    { titlePattern: 'Establish monitoring & runbooks', requiredBlocks: 2, sequence: 4 },
  ],

  REVIEW: [
    { titlePattern: 'Audit & analyze {outcome}', requiredBlocks: 4, sequence: 1 },
    { titlePattern: 'Plan improvements', requiredBlocks: 3, sequence: 2 },
    { titlePattern: 'Execute refactoring', requiredBlocks: 8, sequence: 3 },
    { titlePattern: 'Verify & document changes', requiredBlocks: 3, sequence: 4 },
  ],
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
  const text = [goalContract?.terminalOutcome?.text, goalContract?.goalText, goalContract?.aim?.text].find(
    (t) => typeof t === 'string' && t.trim().length > 0
  ) as string;

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

function getGoalContractText(goalContract: any): string {
  return String(
    [
      goalContract?.terminalOutcome?.text,
      goalContract?.terminalOutcome?.verificationCriteria,
      goalContract?.goalText,
      goalContract?.goalLabel,
      goalContract?.aim?.text,
      goalContract?.goalDraftV2?.goalText,
      goalContract?.goalDraftV2?.goalLabel,
      goalContract?.goalDraftV2?.definitionOfDone,
    ]
      .filter(Boolean)
      .join(' ')
  ).toLowerCase();
}

function coerceDayKey(value: unknown): string {
  const text = String(value || '').trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
  if (/^\d{4}-\d{2}-\d{2}T/.test(text)) return text.slice(0, 10);
  return '';
}

function daysBetween(startDayKey: string, endDayKey: string): number {
  if (!startDayKey || !endDayKey) return 0;
  const start = new Date(`${startDayKey}T12:00:00.000Z`).getTime();
  const end = new Date(`${endDayKey}T12:00:00.000Z`).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return 0;
  return Math.round((end - start) / 86400000) + 1;
}

function getContractHorizonDays(goalContract: any): number {
  const startDayKey =
    coerceDayKey(goalContract?.startDayKey) ||
    coerceDayKey(goalContract?.startDateISO) ||
    coerceDayKey(goalContract?.temporalBinding?.startDayKey) ||
    coerceDayKey(goalContract?.goalExecutionContract?.temporalBinding?.startDayKey);
  const endDayKey =
    coerceDayKey(goalContract?.deadline?.dayKey) ||
    coerceDayKey(goalContract?.endDayKey) ||
    coerceDayKey(goalContract?.deadlineISO) ||
    coerceDayKey(goalContract?.deadline);
  return daysBetween(startDayKey, endDayKey);
}

function isCommercialProductLaunchGoal(goalContract: any): boolean {
  const text = getGoalContractText(goalContract);
  const hasLaunchSignal = /\blaunch\b|\bgo[-\s]?to[-\s]?market\b/.test(text);
  const hasProductSignal =
    /\b(caffeinated\s+)?gum\b|\bconsumer product\b|\bpackaged good\b|\bsellable (product|item|unit)\b|\bproduct\b/.test(
      text
    );
  const hasCommercialSignal =
    /\b(first real sales?|first sales|first sale|first order|sales campaign|purchase|checkout|order|pricing|fulfillment|buyers?|sell|selling)\b/.test(
      text
    );
  return hasLaunchSignal && hasProductSignal && hasCommercialSignal;
}

function extractCommercialProductObject(goalContract: any): string {
  const text = String(
    [
      goalContract?.goalText,
      goalContract?.goalLabel,
      goalContract?.goalDraftV2?.goalText,
      goalContract?.goalDraftV2?.goalLabel,
      goalContract?.terminalOutcome?.text,
      goalContract?.terminalOutcome?.verificationCriteria,
      goalContract?.aim?.text,
    ]
      .filter(Boolean)
      .join(' ')
  ).trim();
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
  if (/\bproduct\b/i.test(text)) return 'product';
  return 'commercial product';
}

function detectLaunchIdentityFamily(goalContract: any): LaunchIdentityFamily | null {
  const executionType = String(
    goalContract?.executionType || goalContract?.goalDraftV2?.executionType || ''
  ).toLowerCase();
  const goalText = String(
    [
      goalContract?.terminalOutcome?.text,
      goalContract?.terminalOutcome?.verificationCriteria,
      goalContract?.goalText,
      goalContract?.goalLabel,
      goalContract?.goalDraftV2?.goalText,
      goalContract?.goalDraftV2?.goalLabel,
      goalContract?.aim?.text,
    ]
      .filter(Boolean)
      .join(' ')
  ).toLowerCase();
  const combined = `${executionType} ${goalText}`.trim();

  if (/\bventurelaunch\b|\bventure\s+launch\b/.test(combined)) {
    return 'venture_launch';
  }
  if (/\bbrandlaunch\b|\bbrand\s+launch\b/.test(combined)) {
    return 'brand_launch';
  }
  return null;
}

function detectServiceLaunchVariant(goalContract: any): boolean {
  const text = String(
    goalContract?.terminalOutcome?.text || goalContract?.goalText || goalContract?.aim?.text || ''
  ).toLowerCase();
  return (
    /\bconsulting\b|\bservice\b/.test(text) &&
    /\boffer\b|\bpricing\b|\bonboarding\b|\boutreach\b|\bclient\b|\bdelivery\b|\bdiscovery\b/.test(text)
  );
}

function extractVentureLaunchObject(goalContract: any): string {
  const text = String(goalContract?.terminalOutcome?.text || goalContract?.goalText || '').trim();
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
  return 'venture';
}

function detectRevenueCapitalFamily(goalContract: any): RevenueCapitalFamily | null {
  const executionType = String(
    goalContract?.executionType || goalContract?.goalDraftV2?.executionType || ''
  ).toLowerCase();
  const goalText = String(
    goalContract?.terminalOutcome?.text || goalContract?.goalText || goalContract?.aim?.text || ''
  ).toLowerCase();
  const verificationText = String(goalContract?.terminalOutcome?.verificationCriteria || '').toLowerCase();
  const combined = `${executionType} ${goalText} ${verificationText}`.trim();

  if (/\bsalespipeline\b|\bsales\s+pipeline\b/.test(combined)) {
    return 'sales_pipeline';
  }
  if (/\bfundraising\b|\bfundraise\b/.test(combined)) {
    return 'fundraising';
  }
  return null;
}

function detectEmploymentPipelineFamily(goalContract: any): EmploymentPipelineFamily | null {
  const executionType = String(
    goalContract?.executionType || goalContract?.goalDraftV2?.executionType || ''
  ).toLowerCase();
  const goalText = String(
    goalContract?.terminalOutcome?.text || goalContract?.goalText || goalContract?.aim?.text || ''
  ).toLowerCase();
  const verificationText = String(goalContract?.terminalOutcome?.verificationCriteria || '').toLowerCase();
  const combined = `${executionType} ${goalText} ${verificationText}`.trim();

  if (/\bjobsearchpipeline\b|\bjob\s+search\s+pipeline\b/.test(combined)) {
    return 'job_search_pipeline';
  }
  return null;
}

function detectCapabilityCredentialFamily(goalContract: any): CapabilityCredentialFamily | null {
  const executionType = String(
    goalContract?.executionType || goalContract?.goalDraftV2?.executionType || ''
  ).toLowerCase();
  const goalText = String(
    goalContract?.terminalOutcome?.text || goalContract?.goalText || goalContract?.aim?.text || ''
  ).toLowerCase();
  const combined = `${executionType} ${goalText}`.trim();

  if (/\bskillacquisition\b|\bskill\s+acquisition\b/.test(combined)) {
    return 'skill_acquisition';
  }
  if (/\bprofessionalqualification\b|\bprofessional\s+qualification\b/.test(combined)) {
    return 'professional_qualification';
  }
  return null;
}

function detectPhysicalProgressionFamily(goalContract: any): PhysicalProgressionFamily | null {
  const executionType = String(
    goalContract?.executionType || goalContract?.goalDraftV2?.executionType || ''
  ).toLowerCase();
  const goalText = String(
    goalContract?.terminalOutcome?.text || goalContract?.goalText || goalContract?.aim?.text || ''
  ).toLowerCase();
  const combined = `${executionType} ${goalText}`.trim();

  if (/\bphysicaltraining\b|\bphysical\s+training\b|\bphysical\s+progression\b/.test(combined)) {
    return 'physical_training';
  }
  return null;
}

function detectCreativeProductionFamily(goalContract: any): CreativeProductionFamily | null {
  const executionType = String(
    goalContract?.executionType || goalContract?.goalDraftV2?.executionType || ''
  ).toLowerCase();
  const goalText = String(
    goalContract?.terminalOutcome?.text || goalContract?.goalText || goalContract?.aim?.text || ''
  ).toLowerCase();
  const combined = `${executionType} ${goalText}`.trim();

  if (/\bcreativeproduction\b|\bcreative\s+production\b/.test(combined)) {
    return 'creative_production';
  }
  return null;
}

function extractCapabilityStartingStateHint(text: string) {
  const lower = String(text || '').toLowerCase();
  if (lower.includes('baseline recorded') || lower.includes('already practicing')) return 'baseline_recorded';
  if (lower.includes('proof ready') || lower.includes('assessment ready')) return 'proof_ready';
  return 'unknown';
}

function extractQualificationObject(goalContract: any): string {
  const text = String(goalContract?.terminalOutcome?.text || goalContract?.goalText || '').trim();
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

function extractSkillGoalObject(goalContract: any): string {
  const text = String(goalContract?.terminalOutcome?.text || goalContract?.goalText || '').trim();
  if (!text) return 'target skill';
  const patterns = [
    /\blearn\s+(.+?)(?:\s+well enough|\s+to\b|\s+by\b|\s+within\b|\s+in\s+\d+\s+days?\b|$)/i,
    /\bmaster\s+(.+?)(?:\s+to\b|\s+by\b|\s+within\b|\s+in\s+\d+\s+days?\b|$)/i,
    /\bbecome\s+proficient\s+in\s+(.+?)(?:\s+to\b|\s+by\b|\s+within\b|\s+in\s+\d+\s+days?\b|$)/i,
    /\bdevelop\s+(.+?)\s+skills?(?:\s+to\b|\s+by\b|\s+within\b|\s+in\s+\d+\s+days?\b|$)/i,
  ];
  for (const pattern of patterns) {
    const match = pattern.exec(text);
    const candidate = String(match?.[1] || '')
      .replace(/\b(my|the|a|an)\b/gi, '')
      .replace(/\s+/g, ' ')
      .trim();
    if (candidate.length >= 3) return candidate;
  }
  return extractOutcomNoun(goalContract);
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
  if (wordMatch) {
    return wordToNumber[wordMatch[1]] || 0;
  }
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
    /\b(project|dashboard|analysis|case study|portfolio|prototype|build|system|workflow|plan|model)\b/i.test(cleaned)
  ) {
    return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
  }
  if (goalObject && !cleaned.toLowerCase().includes(goalObject.toLowerCase())) {
    return `${cleaned.charAt(0).toUpperCase() + cleaned.slice(1)} for ${goalObject}`;
  }
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
}

function extractNamedSkillProjects(goalContract: any, goalObject: string): string[] {
  const text = `${goalContract?.terminalOutcome?.text || ''} ${goalContract?.terminalOutcome?.verificationCriteria || ''}`;
  const projectListMatch = /projects?\s*:\s*([\s\S]+)/i.exec(String(text || ''));
  if (projectListMatch) {
    const listed = String(projectListMatch[1] || '')
      .split(/[;,\n]+/)
      .map((entry) => normalizeSkillProjectTitle(entry, goalObject))
      .filter(Boolean);
    if (listed.length > 0) {
      return Array.from(new Set(listed));
    }
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

function isSqlSkillGoal(goalContract: any) {
  const text =
    `${goalContract?.terminalOutcome?.text || ''} ${goalContract?.terminalOutcome?.verificationCriteria || ''} ${
      goalContract?.goalText || ''
    }`.toLowerCase();
  return (
    /\bsql\b/.test(text) &&
    /\b(query|queries|dashboard|analysis|analytics|portfolio|project|projects|interview|join|joins|cte|window)\b/.test(
      text
    )
  );
}

function extractCreativeProductionObject(goalContract: any) {
  const text =
    `${goalContract?.terminalOutcome?.text || ''} ${goalContract?.terminalOutcome?.verificationCriteria || ''} ${
      goalContract?.goalText || ''
    }`.toLowerCase();

  if (/\bpodcast\b/.test(text)) return 'podcast episode release';
  if (/\b(album|ep|song|single|track|mixtape)\b/.test(text)) return 'music release';
  if (/\b(documentary|film|video|short film|video essay|youtube)\b/.test(text)) return 'video production';
  if (/\b(book|novel|manuscript|chapter|essay collection|newsletter)\b/.test(text)) return 'manuscript draft';
  if (/\b(script|screenplay|pilot|series)\b/.test(text)) return 'script draft';
  return 'creative project';
}

function buildCreativeProductionDeliverables(goalContract: any): StrategyDeliverable[] {
  const text =
    `${goalContract?.terminalOutcome?.text || ''} ${goalContract?.terminalOutcome?.verificationCriteria || ''}`.trim();
  const lower = text.toLowerCase();
  const startingState = extractCapabilityStartingStateHint(text);
  const baseBlocks = 18;
  const creativeObject = extractCreativeProductionObject(goalContract);

  if (/\bpodcast\b/.test(lower)) {
    return [
      {
        id: 'auto-deliv-creative-podcast-format',
        title:
          startingState === 'already_equipped'
            ? 'Audit podcast show format and audience promise'
            : 'Define podcast show format and audience promise',
        requiredBlocks: Math.max(2, Math.floor(baseBlocks * 0.14)),
      },
      {
        id: 'auto-deliv-creative-podcast-workflow',
        title: 'Build podcast recording workflow and episode production checklist',
        requiredBlocks: Math.max(2, Math.floor(baseBlocks * 0.18)),
      },
      {
        id: 'auto-deliv-creative-podcast-batch',
        title: 'Record and edit podcast episode batch',
        requiredBlocks: Math.max(3, Math.floor(baseBlocks * 0.24)),
      },
      {
        id: 'auto-deliv-creative-podcast-package',
        title: 'Prepare podcast release package and publishing metadata',
        requiredBlocks: Math.max(2, Math.floor(baseBlocks * 0.16)),
      },
      {
        id: 'auto-deliv-creative-podcast-review',
        title: 'Run podcast release review and distribution checklist',
        requiredBlocks: Math.max(2, Math.floor(baseBlocks * 0.14)),
      },
    ];
  }

  if (/\b(album|ep|song|single|track|mixtape)\b/.test(lower)) {
    return [
      {
        id: 'auto-deliv-creative-music-brief',
        title: 'Define music release concept, tracklist, and audience direction',
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
        id: 'auto-deliv-creative-video-draft',
        title: `Produce first cut and rough edit for ${creativeObject}`,
        requiredBlocks: Math.max(3, Math.floor(baseBlocks * 0.24)),
      },
      {
        id: 'auto-deliv-creative-video-polish',
        title: `Complete final edit, sound polish, and graphics for ${creativeObject}`,
        requiredBlocks: Math.max(2, Math.floor(baseBlocks * 0.16)),
      },
      {
        id: 'auto-deliv-creative-video-package',
        title: `Prepare ${creativeObject} release package and publication checklist`,
        requiredBlocks: Math.max(2, Math.floor(baseBlocks * 0.14)),
      },
    ];
  }

  if (/\b(book|novel|manuscript|chapter|essay collection|newsletter)\b/.test(lower)) {
    return [
      {
        id: 'auto-deliv-creative-book-outline',
        title: `Define ${creativeObject} outline, chapter map, and reader promise`,
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

function buildSkillAcquisitionDeliverables(goalContract: any): StrategyDeliverable[] {
  const text = String(goalContract?.terminalOutcome?.text || goalContract?.goalText || '').trim();
  const verificationText = String(goalContract?.terminalOutcome?.verificationCriteria || '').trim();
  const startingState = extractCapabilityStartingStateHint(`${text} ${verificationText}`);
  const baseBlocks = 18;
  const goalObject = extractSkillGoalObject(goalContract);
  const explicitProjectTitles = extractNamedSkillProjects(goalContract, goalObject);
  const explicitProjectCount = Math.max(
    explicitProjectTitles.length,
    extractExplicitProjectCount(`${text} ${verificationText}`)
  );

  if (isSqlSkillGoal(goalContract)) {
    return [
      {
        id: 'auto-deliv-sql-baseline',
        title:
          startingState === 'baseline_recorded'
            ? 'Audit SQL fundamentals query practice baseline'
            : 'Establish SQL fundamentals query practice baseline',
        requiredBlocks: Math.max(2, Math.floor(baseBlocks * 0.14)),
      },
      {
        id: 'auto-deliv-sql-project-1',
        title: 'Complete relational schema and data import project',
        requiredBlocks: Math.max(3, Math.floor(baseBlocks * 0.18)),
      },
      {
        id: 'auto-deliv-sql-project-2',
        title: 'Complete business analysis query case study',
        requiredBlocks: Math.max(3, Math.floor(baseBlocks * 0.18)),
      },
      {
        id: 'auto-deliv-sql-project-3',
        title: 'Complete advanced reporting and window function project',
        requiredBlocks: Math.max(3, Math.floor(baseBlocks * 0.18)),
      },
      {
        id: 'auto-deliv-sql-proof',
        title: 'Produce GitHub portfolio and query explanation package',
        requiredBlocks: Math.max(2, Math.floor(baseBlocks * 0.16)),
      },
      {
        id: 'auto-deliv-sql-review',
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
        requiredBlocks: Math.max(3, Math.floor(baseBlocks * 0.18)),
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

function buildProfessionalQualificationDeliverables(goalContract: any): StrategyDeliverable[] {
  const text = String(goalContract?.terminalOutcome?.text || goalContract?.goalText || '').trim();
  const verificationText = String(goalContract?.terminalOutcome?.verificationCriteria || '').trim();
  const startingState = extractCapabilityStartingStateHint(`${text} ${verificationText}`);
  const baseBlocks = 18;
  const qualificationObject = normalizeQualificationObject(extractQualificationObject(goalContract));

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

function buildPhysicalTrainingDeliverables(goalContract: any): StrategyDeliverable[] {
  const text = String(goalContract?.terminalOutcome?.text || goalContract?.goalText || '').trim();
  const verificationText = String(goalContract?.terminalOutcome?.verificationCriteria || '').trim();
  const startingState = extractPhysicalStartingStateHint(`${text} ${verificationText}`);
  const lower = `${text} ${verificationText}`.toLowerCase();
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
      requiredBlocks: 4,
    },
    {
      id: 'auto-deliv-physical-progression',
      title: progressionTitle,
      requiredBlocks: 5,
    },
    {
      id: 'auto-deliv-physical-checkpoints',
      title: checkpointTitle,
      requiredBlocks: 5,
    },
    {
      id: 'auto-deliv-physical-review',
      title: reviewTitle,
      requiredBlocks: 4,
    },
  ];
}

function buildVentureLaunchDeliverables(goalContract: any): StrategyDeliverable[] {
  const text = String(goalContract?.terminalOutcome?.text || goalContract?.goalText || '').toLowerCase();
  const alreadyDefined = /\boffer\s+defined\b|\balready\s+defined\b|\boffer\s+ready\b/.test(text);
  const baseBlocks = 18;
  const ventureObject = extractVentureLaunchObject(goalContract);

  if (detectServiceLaunchVariant(goalContract)) {
    return [
      {
        id: 'auto-deliv-venture-offer',
        title: alreadyDefined
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
      title: alreadyDefined
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

function buildBrandLaunchDeliverables(goalContract: any): StrategyDeliverable[] {
  const text = String(goalContract?.terminalOutcome?.text || goalContract?.goalText || '').toLowerCase();
  const alreadyBranded = /\balready\s+branded\b|\bbrand\s+ready\b|\bidentity\s+defined\b/.test(text);
  const commercialProductLaunch = isCommercialProductLaunchGoal(goalContract);
  const horizonDays = getContractHorizonDays(goalContract);
  const baseBlocks = 18;
  if (commercialProductLaunch) {
    const productObject = extractCommercialProductObject(goalContract);
    const workload = deriveCommercialProductLaunchWorkload(horizonDays);
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
      title: alreadyBranded
        ? 'Refine brand positioning and audience promise'
        : 'Define brand positioning and audience promise',
      requiredBlocks: Math.max(2, Math.floor(baseBlocks * 0.18)),
    },
    {
      id: 'auto-deliv-brand-messaging',
      title: 'Build messaging architecture for priority channels',
      requiredBlocks: Math.max(2, Math.floor(baseBlocks * 0.18)),
    },
    {
      id: 'auto-deliv-brand-identity',
      title: 'Select visual identity direction and standards',
      requiredBlocks: Math.max(2, Math.floor(baseBlocks * 0.16)),
    },
    {
      id: 'auto-deliv-brand-assets',
      title: 'Assemble core brand kit and starter assets',
      requiredBlocks: Math.max(2, Math.floor(baseBlocks * 0.14)),
    },
    {
      id: 'auto-deliv-brand-rollout',
      title: 'Update priority channel profiles and bios',
      requiredBlocks: Math.max(2, Math.floor(baseBlocks * 0.14)),
    },
    {
      id: 'auto-deliv-brand-launch',
      title: 'Publish brand launch announcement and audience CTA',
      requiredBlocks: Math.max(2, Math.floor(baseBlocks * 0.1)),
    },
  ];
}

function deriveCommercialProductLaunchWorkload(horizonDays: number) {
  const cycleCap = horizonDays > 365 ? 8 : 5;
  const operatingCycles = Math.max(3, Math.min(cycleCap, Math.ceil(Math.max(90, horizonDays || 0) / 60)));
  return {
    operatingCycles,
    productReadiness: 14 + operatingCycles * 2,
    commercialReadiness: 14 + operatingCycles * 3,
    launchCommunications: 10 + operatingCycles * 2,
    firstSalesExecution: operatingCycles * 8,
    terminalReview: operatingCycles * 5,
  };
}

function buildSalesPipelineDeliverables(goalContract: any): StrategyDeliverable[] {
  const text = String(goalContract?.terminalOutcome?.text || goalContract?.goalText || '').toLowerCase();
  const alreadyPipelineActive = /\bpipeline\s+active\b|\balready\s+qualified\b|\balready\s+outreaching\b/.test(text);
  const baseBlocks = 20;

  return [
    {
      id: 'auto-deliv-sales-offer',
      title: alreadyPipelineActive
        ? 'Audit offer, qualification criteria, and active pipeline gaps'
        : 'Clarify offer, pricing tiers, and qualification criteria',
      requiredBlocks: Math.max(2, Math.floor(baseBlocks * 0.14)),
    },
    {
      id: 'auto-deliv-sales-icp',
      title: 'Define ICP and build first target account list',
      requiredBlocks: Math.max(2, Math.floor(baseBlocks * 0.16)),
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
      requiredBlocks: Math.max(2, Math.floor(baseBlocks * 0.14)),
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

function buildFundraisingDeliverables(goalContract: any): StrategyDeliverable[] {
  const text = String(goalContract?.terminalOutcome?.text || goalContract?.goalText || '').toLowerCase();
  const alreadyDeckReady = /\bdeck\s+ready\b|\balready\s+pitched\b|\bdiligence\s+started\b/.test(text);
  const packagePrepMode =
    /\b(package|pitch|investor-ready|investor ready|materials?)\b/.test(text) &&
    /\b(prepare|clear|ready|readiness|story|ask|use[- ]of[- ]funds)\b/.test(text) &&
    !/\b(meetings?|diligence\s+(?:started|requests?)|commitments?|term(?:s)?\b|close\b|closing\b|signature\b|investor conversations?)\b/.test(
      text
    );
  const baseBlocks = 20;

  if (packagePrepMode) {
    return [
      {
        id: 'auto-deliv-raise-thesis',
        title: alreadyDeckReady
          ? 'Audit raise objective, use-of-funds, and investor thesis'
          : 'Define raise objective, use-of-funds, and investor thesis',
        requiredBlocks: Math.max(2, Math.floor(baseBlocks * 0.16)),
      },
      {
        id: 'auto-deliv-raise-deck',
        title: 'Build fundraising narrative, pitch deck, and financial ask storyline',
        requiredBlocks: Math.max(2, Math.floor(baseBlocks * 0.18)),
      },
      {
        id: 'auto-deliv-raise-dataroom',
        title: 'Create diligence checklist, financial package, and data room structure',
        requiredBlocks: Math.max(2, Math.floor(baseBlocks * 0.16)),
      },
      {
        id: 'auto-deliv-raise-targets',
        title: 'Build target investor list and fit scoring model',
        requiredBlocks: Math.max(2, Math.floor(baseBlocks * 0.16)),
      },
      {
        id: 'auto-deliv-raise-outreach',
        title: 'Prepare outreach sequences, intro request scripts, and send package checklist',
        requiredBlocks: Math.max(2, Math.floor(baseBlocks * 0.16)),
      },
      {
        id: 'auto-deliv-raise-readiness',
        title: 'Run fundraising readiness review, objection handling, and investor-ready materials check',
        requiredBlocks: Math.max(2, Math.floor(baseBlocks * 0.14)),
      },
    ];
  }

  return [
    {
      id: 'auto-deliv-raise-thesis',
      title: alreadyDeckReady
        ? 'Audit raise objective, use-of-funds, and investor thesis'
        : 'Define raise objective, use-of-funds, and investor thesis',
      requiredBlocks: Math.max(2, Math.floor(baseBlocks * 0.14)),
    },
    {
      id: 'auto-deliv-raise-deck',
      title: 'Build fundraising narrative and deck storyline',
      requiredBlocks: Math.max(2, Math.floor(baseBlocks * 0.15)),
    },
    {
      id: 'auto-deliv-raise-dataroom',
      title: 'Create diligence checklist and data room structure',
      requiredBlocks: Math.max(2, Math.floor(baseBlocks * 0.12)),
    },
    {
      id: 'auto-deliv-raise-targets',
      title: 'Build target investor list and fit scoring model',
      requiredBlocks: Math.max(2, Math.floor(baseBlocks * 0.16)),
    },
    {
      id: 'auto-deliv-raise-outreach',
      title: 'Prepare outreach sequences and intro request scripts',
      requiredBlocks: Math.max(2, Math.floor(baseBlocks * 0.14)),
    },
    {
      id: 'auto-deliv-raise-meetings',
      title: 'Run first wave of investor outreach and meetings',
      requiredBlocks: Math.max(2, Math.floor(baseBlocks * 0.12)),
    },
    {
      id: 'auto-deliv-raise-followup',
      title: 'Deliver follow-up materials and manage diligence requests',
      requiredBlocks: Math.max(2, Math.floor(baseBlocks * 0.1)),
    },
    {
      id: 'auto-deliv-raise-close',
      title: 'Coordinate term discussions and commitment tracking',
      requiredBlocks: Math.max(2, Math.floor(baseBlocks * 0.07)),
    },
    {
      id: 'auto-deliv-raise-legal-close',
      title: 'Finalize legal close process and signature workflow',
      requiredBlocks: Math.max(2, Math.floor(baseBlocks * 0.06)),
    },
  ];
}

function buildJobSearchPipelineDeliverables(goalContract: any): StrategyDeliverable[] {
  const text = String(
    goalContract?.terminalOutcome?.text ||
      goalContract?.goalText ||
      goalContract?.terminalOutcome?.verificationCriteria ||
      ''
  ).toLowerCase();
  const baseBlocks = 20;
  const alreadyApplying =
    /\bapplications\s+submitted\b|\balready\s+applying\b|\binterviews?\s+active\b|\boffer\s+received\b/.test(text);
  const materialsReady = /\bresume\s+ready\b|\bportfolio\s+ready\b|\bmaterials\s+ready\b/.test(text);

  return [
    {
      id: 'auto-deliv-job-target',
      title: alreadyApplying
        ? 'Audit target role family, submitted applications, and response gaps'
        : materialsReady
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
      requiredBlocks: Math.max(2, Math.floor(baseBlocks * 0.14)),
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

/**
 * Generates deliverables from mechanism class
 *
 * Example:
 * - goalContract.terminalOutcome.text = "Publish my music to Spotify"
 * - Derives mechanism = PUBLISH
 * - Returns 4 deliverables with pre-sized blocks
 */
export function generateAutoDeliverables(goalContract: any): StrategyDeliverable[] {
  const creativeProductionFamily = detectCreativeProductionFamily(goalContract);
  if (creativeProductionFamily === 'creative_production') {
    return buildCreativeProductionDeliverables(goalContract);
  }
  const employmentPipelineFamily = detectEmploymentPipelineFamily(goalContract);
  if (employmentPipelineFamily === 'job_search_pipeline') {
    return buildJobSearchPipelineDeliverables(goalContract);
  }
  const capabilityCredentialFamily = detectCapabilityCredentialFamily(goalContract);
  if (capabilityCredentialFamily === 'skill_acquisition') {
    return buildSkillAcquisitionDeliverables(goalContract);
  }
  if (capabilityCredentialFamily === 'professional_qualification') {
    return buildProfessionalQualificationDeliverables(goalContract);
  }
  const physicalProgressionFamily = detectPhysicalProgressionFamily(goalContract);
  if (physicalProgressionFamily === 'physical_training') {
    return buildPhysicalTrainingDeliverables(goalContract);
  }
  const revenueCapitalFamily = detectRevenueCapitalFamily(goalContract);
  if (revenueCapitalFamily === 'sales_pipeline') {
    return buildSalesPipelineDeliverables(goalContract);
  }
  if (revenueCapitalFamily === 'fundraising') {
    return buildFundraisingDeliverables(goalContract);
  }

  const launchIdentityFamily = detectLaunchIdentityFamily(goalContract);
  if (launchIdentityFamily === 'venture_launch') {
    return buildVentureLaunchDeliverables(goalContract);
  }
  if (launchIdentityFamily === 'brand_launch') {
    return buildBrandLaunchDeliverables(goalContract);
  }

  const mechanism = deriveMechanismClass(goalContract);
  const templates = TEMPLATES[mechanism];

  const outcomNoun = extractOutcomNoun(goalContract);

  let idCounter = 0;

  return templates.map((template) => {
    const title = template.titlePattern.replace('{outcome}', outcomNoun).replace('{noun}', outcomNoun);

    return {
      id: `auto-${mechanism}-${idCounter++}`,
      title,
      requiredBlocks: template.requiredBlocks,
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
      blocks: d.requiredBlocks,
    })),
    totalBlocksRequired: totalBlocks,
  };

  if (verbose && typeof console !== 'undefined' && console.log) {
    console.log('[AUTO_DELIVERABLES]', output);
  }

  return output;
}
