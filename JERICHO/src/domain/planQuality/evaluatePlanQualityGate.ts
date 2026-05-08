import type { PlanQualityFailureCode, PlanQualityGateResult } from './planQualityTypes.ts';
import { deriveTerminalOutcomeAuthority } from '../goal/terminalOutcomeAuthority.ts';
import { hasContactStageDeliverable } from './contactStageDetector.ts';
import { detectCorridorLane } from './corridorLaneDetector.ts';
import { hasTerminalStageDeliverable } from './terminalStageDetector.ts';
import { detectTerminalEndpoint } from '../goal/terminalEndpointDetector.ts';
import { hasSecondaryEndpointCoverage } from './splitEndpointCoverageDetector.ts';
import {
  evaluateCommercialProductLaunchSemanticCoverage,
  isCommercialProductLaunchGoal,
} from './commercialProductLaunchSemanticDetector.ts';

type PlanArtifact = {
  id?: string;
  title?: string;
  deliverableId?: string | null;
  actionId?: string | null;
  lineageTitle?: string | null;
  dayKey?: string | null;
  start?: string | null;
  startISO?: string | null;
};

type PlanDeliverable = {
  id?: string;
  title?: string;
  actionIds?: string[];
};

type PlanAction = {
  id?: string;
  title?: string;
  deliverableId?: string | null;
};

type BranchCoverageSummary = {
  declaredBranches: string[]; // deliverable IDs expected to have block coverage
};

type EvaluatePlanQualityGateInput = {
  goalText?: string;
  verificationText?: string;
  deliverables?: PlanDeliverable[];
  actions?: PlanAction[];
  proposedBlocks?: PlanArtifact[];
  committedBlocks?: PlanArtifact[];
  branchCoverageSummary?: BranchCoverageSummary;
  temporalContext?: {
    contractStartDayKey?: string | null;
    contractEndDayKey?: string | null;
    isRecurring?: boolean;
    earlyCompletionJustification?: string | null;
  };
};

const TOKEN_SPLIT_PATTERN = /[^a-z0-9]+/i;

const STOPWORD_TOKENS = new Set([
  'a',
  'an',
  'and',
  'at',
  'be',
  'by',
  'for',
  'from',
  'in',
  'into',
  'of',
  'on',
  'or',
  'the',
  'to',
  'with',
  'your',
  'their',
  'this',
  'that',
  'until',
  'through',
  'per',
  'day',
  'week',
  'daily',
  'weekly',
  'deadline',
  'ready',
  'completed',
  'completion',
  'release',
  'recorded',
  'edited',
  'verified',
  'verify',
  'goal',
  'project',
  'plan',
  'work',
  'core',
  'final',
]);

const PROCESS_TOKENS = new Set([
  'start',
  'starting',
  'launch',
  'build',
  'create',
  'complete',
  'finish',
  'improve',
  'prepare',
  'finalize',
  'record',
  'edit',
  'publish',
  'draft',
  'outline',
  'produce',
  'run',
  'execute',
  'configure',
  'develop',
  'learn',
  'make',
  'establish',
  'define',
  'select',
  'refine',
  'audit',
  'review',
  'supporting',
  'set',
]);

const SHELL_TOKENS = new Set([
  'artifact',
  'brief',
  'cadence',
  'checklist',
  'format',
  'foundation',
  'framework',
  'kit',
  'map',
  'metadata',
  'notes',
  'outline',
  'package',
  'plan',
  'process',
  'session',
  'setup',
  'strategy',
  'structure',
  'system',
  'theme',
  'workflow',
]);

const DELIVERABLE_OBJECT_MISSING_PATTERNS = [
  /record and edit episode set/i,
  /reference sheet with \d+ key terms/i,
  /practice environment configured/i,
  /notes on \d+ core examples/i,
];

const DELIVERABLE_SEMANTIC_HOLLOWNESS_PATTERNS = [
  /workflow package/i,
  /project workflow/i,
  /production workflow/i,
  /stakeholder review/i,
  /weekly cadence/i,
  /process review/i,
  /artifact package/i,
];

const DELIVERABLE_TOO_GENERIC_PATTERNS = [
  /planning\s*&\s*setup/i,
  /scope definition/i,
  /core production/i,
  /verification\s*&\s*finalization/i,
  /build\s*&\s*refinement/i,
  /execution\s*&\s*iteration/i,
  /main development/i,
  /final review/i,
  /launch\s*&\s*rollout/i,
];

const BLOCK_TOO_GENERIC_PATTERNS = [
  /review notes/i,
  /practice examples/i,
  /^set up environment$/i,
  /create production outline and scene\/content map/i,
  /produce first full draft of core artifact/i,
  /run internal review and annotate revision priorities/i,
  /execute second-pass revision for clarity and flow/i,
  /complete technical polish pass and formatting cleanup/i,
  /prepare release package and supporting metadata/i,
  /configure distribution channels and publication checklist/i,
  /publish and run post-release quality review/i,
];

const LINEAGE_VISIBLE_MEANING_LOSS_PATTERNS = [
  /^production session$/i,
  /^editing session$/i,
  /^focus block$/i,
  /^work block$/i,
  /^session$/i,
  /^prep$/i,
];

const COMMERCIAL_FAMILY_SHELL_PATTERNS = [
  /\bresolve\b.*\bgum\b.*\bformula\b.*\bpackaging\b.*\breadiness\b/i,
  /\bbuild\b.*\bgum\b.*\boffer\b.*\bpricing\b.*\bcheckout\b/i,
  /\bbuild\b.*\bgum\b.*\bpositioning\b.*\bmessaging\b.*\bassets\b/i,
  /\bactivate\b.*\bfirst[-\s]?buyer\b.*\boutreach\b.*\bfirst[-\s]?order\b/i,
  /\btrack\b.*\bbuyer\b.*\bresponses\b.*\bconversion\b/i,
  /\bcompile\b.*\bfirst[-\s]?sales\b.*\bevidence\b.*\bconversion\b/i,
  /\bdecide\b.*\bcommercial\b.*\bsales\b.*\bevidence\b/i,
];

function normalizeText(value: unknown) {
  return String(value || '').trim();
}

function canonicalizeToken(token: string) {
  const lower = token.toLowerCase();
  if (lower.length > 4 && lower.endsWith('ies')) {
    return `${lower.slice(0, -3)}y`;
  }
  if (lower.length > 4 && lower.endsWith('s') && !lower.endsWith('ss')) {
    return lower.slice(0, -1);
  }
  return lower;
}

function extractSemanticTokens(value: unknown, options: { excludeShell?: boolean } = {}) {
  const excludeShell = options.excludeShell ?? false;
  return normalizeText(value)
    .toLowerCase()
    .split(TOKEN_SPLIT_PATTERN)
    .map((token) => canonicalizeToken(token))
    .filter(Boolean)
    .filter((token) => token.length >= 3)
    .filter((token) => !STOPWORD_TOKENS.has(token))
    .filter((token) => !PROCESS_TOKENS.has(token))
    .filter((token) => !(excludeShell && SHELL_TOKENS.has(token)));
}

function intersectTokens(tokens: string[], target: Set<string>) {
  return tokens.filter((token) => target.has(token));
}

function uniqueTokens(tokens: string[]) {
  return Array.from(new Set(tokens));
}

function isShellHeavy(tokens: string[]) {
  if (tokens.length === 0) return false;
  const nonShellCount = tokens.filter((token) => !SHELL_TOKENS.has(token)).length;
  return nonShellCount <= 1 && tokens.some((token) => SHELL_TOKENS.has(token));
}

function extractExpectedEpisodeNumbers(goalText: string, verificationText: string) {
  const text = `${goalText} ${verificationText}`.toLowerCase();
  const values = new Set<number>();

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

function extractObservedEpisodeNumbers(labels: string[]) {
  const values = new Set<number>();
  labels.forEach((label) => {
    const lower = label.toLowerCase();
    const matches = lower.matchAll(/episode\s+(\d+)/g);
    for (const match of matches) {
      const value = Number(match[1]);
      if (Number.isFinite(value) && value > 0 && value <= 24) {
        values.add(value);
      }
    }
  });
  return values;
}

function hasPattern(patterns: RegExp[], value: string) {
  return patterns.some((pattern) => pattern.test(value));
}

function isDayKey(value: unknown) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(value || '').trim());
}

function resolveArtifactDayKey(block: PlanArtifact) {
  const explicitDayKey = normalizeText(block?.dayKey);
  if (isDayKey(explicitDayKey)) {
    return explicitDayKey;
  }
  const startDayKey = normalizeText(block?.start || block?.startISO).slice(0, 10);
  if (isDayKey(startDayKey)) {
    return startDayKey;
  }
  return '';
}

function resolveArtifactEndDayKey(block: PlanArtifact) {
  const explicitEndDayKey = normalizeText((block as any)?.endDayKey);
  if (isDayKey(explicitEndDayKey)) {
    return explicitEndDayKey;
  }
  const endDayKey = normalizeText((block as any)?.endISO || (block as any)?.end).slice(0, 10);
  if (isDayKey(endDayKey)) {
    return endDayKey;
  }
  return resolveArtifactDayKey(block);
}

function stripSessionOrdinalShell(value: string) {
  return normalizeText(value)
    .replace(/\s*[-–—:]*\s*session\s+\d+\s+of\s+\d+\s*$/i, '')
    .replace(/\s*\(\s*session\s+\d+\s*\/\s*\d+\s*\)\s*$/i, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function isRepeatedCommercialFamilyShellTitle(value: string) {
  const title = normalizeText(value);
  if (!title) return false;
  const hasOrdinalShell = /\bsession\s+\d+\s+(?:of|\/)\s+\d+\b/i.test(title);
  if (!hasOrdinalShell) return false;
  return COMMERCIAL_FAMILY_SHELL_PATTERNS.some((pattern) => pattern.test(title));
}

function daysBetween(startDayKey: string, endDayKey: string) {
  if (!isDayKey(startDayKey) || !isDayKey(endDayKey)) return 0;
  const start = new Date(`${startDayKey}T12:00:00.000Z`).getTime();
  const end = new Date(`${endDayKey}T12:00:00.000Z`).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end)) return 0;
  return Math.round((end - start) / 86400000);
}

function inferRecurringGoal(goalText: string, verificationText: string) {
  const text = `${goalText} ${verificationText}`.toLowerCase();
  return /\b(daily|weekly|monthly|every\s+(day|week|month)|per\s+(day|week|month)|cadence|recurring|ongoing)\b/.test(
    text
  );
}

function explicitEarlyCompletionAllowed(value: unknown) {
  return normalizeText(value).length >= 12;
}

function analyzeLongHorizonTemporalDistribution(input: {
  goalText: string;
  verificationText: string;
  executionArtifacts: PlanArtifact[];
  temporalContext?: EvaluatePlanQualityGateInput['temporalContext'];
}) {
  const contractStartDayKey = normalizeText(input.temporalContext?.contractStartDayKey);
  const contractEndDayKey = normalizeText(input.temporalContext?.contractEndDayKey);
  if (!isDayKey(contractStartDayKey) || !isDayKey(contractEndDayKey)) return null;

  const horizonDays = daysBetween(contractStartDayKey, contractEndDayKey) + 1;
  if (horizonDays < 180) return null;
  if (input.temporalContext?.isRecurring === true || inferRecurringGoal(input.goalText, input.verificationText)) {
    return null;
  }
  if (explicitEarlyCompletionAllowed(input.temporalContext?.earlyCompletionJustification)) {
    return null;
  }

  const scheduledDayKeys = input.executionArtifacts
    .map((block) => resolveArtifactDayKey(block))
    .filter(isDayKey)
    .filter((dayKey) => dayKey >= contractStartDayKey && dayKey <= contractEndDayKey)
    .sort();
  const occupiedIntervals = input.executionArtifacts
    .map((block) => {
      const startDayKey = resolveArtifactDayKey(block);
      const rawEndDayKey = resolveArtifactEndDayKey(block);
      const endDayKey =
        isDayKey(rawEndDayKey) && rawEndDayKey >= startDayKey ? rawEndDayKey : startDayKey;
      if (!isDayKey(startDayKey)) return null;
      if (startDayKey < contractStartDayKey || startDayKey > contractEndDayKey) return null;
      return {
        startDayKey,
        endDayKey: endDayKey > contractEndDayKey ? contractEndDayKey : endDayKey,
      };
    })
    .filter((interval): interval is { startDayKey: string; endDayKey: string } => Boolean(interval))
    .sort((left, right) => left.startDayKey.localeCompare(right.startDayKey));
  if (scheduledDayKeys.length === 0 || occupiedIntervals.length === 0) return null;

  const firstScheduledDayKey = occupiedIntervals[0]?.startDayKey || scheduledDayKeys[0];
  const lastScheduledDayKey = occupiedIntervals[occupiedIntervals.length - 1]?.endDayKey || scheduledDayKeys[scheduledDayKeys.length - 1];
  const occupiedMonths = Array.from(
    new Set(
      occupiedIntervals.flatMap((interval) => {
        const months: string[] = [];
        let cursor = interval.startDayKey;
        let guard = 0;
        while (cursor <= interval.endDayKey && guard < 5000) {
          months.push(cursor.slice(0, 7));
          const next = new Date(`${cursor}T12:00:00.000Z`);
          next.setUTCDate(next.getUTCDate() + 1);
          cursor = next.toISOString().slice(0, 10);
          guard += 1;
        }
        return months;
      })
    )
  );
  const scheduledSpanDays = daysBetween(firstScheduledDayKey, lastScheduledDayKey) + 1;
  const latestScheduledHorizonRatio = Math.max(0, daysBetween(contractStartDayKey, lastScheduledDayKey)) / horizonDays;
  const requiredLatestHorizonRatio = 2 / 3;
  const horizonMonths = Math.max(1, Math.ceil(horizonDays / 30));
  const requiredOccupiedMonths = Math.max(3, Math.min(horizonMonths, Math.ceil(horizonMonths / 2)));
  const remainingTailDays = Math.max(0, daysBetween(lastScheduledDayKey, contractEndDayKey));
  const remainingTailRatio = remainingTailDays / horizonDays;
  const maxUnjustifiedTailRatio = 0.25;
  const compressionLatestHorizonRatio = 0.5;
  const severeOccupiedMonthFloor = 3;
  const scheduledBlockCount = scheduledDayKeys.length;
  const averageBlocksPerWeek = scheduledBlockCount / Math.max(1, horizonDays / 7);
  const requiredAverageBlocksPerWeek = 2;
  const mergedIntervals = occupiedIntervals.reduce((intervals, nextInterval) => {
    const previousInterval = intervals[intervals.length - 1];
    if (!previousInterval) {
      intervals.push({ ...nextInterval });
      return intervals;
    }
    if (nextInterval.startDayKey <= previousInterval.endDayKey) {
      if (nextInterval.endDayKey > previousInterval.endDayKey) {
        previousInterval.endDayKey = nextInterval.endDayKey;
      }
      return intervals;
    }
    intervals.push({ ...nextInterval });
    return intervals;
  }, [] as Array<{ startDayKey: string; endDayKey: string }>);
  const maxInterBlockGapDays = mergedIntervals.reduce((maxGap, interval, index) => {
    if (index === 0) return maxGap;
    return Math.max(maxGap, daysBetween(mergedIntervals[index - 1]!.endDayKey, interval.startDayKey));
  }, 0);
  const maxAllowedInterBlockGapDays = 6;
  const activeWeekdayCounts = new Map<number, Set<string>>();
  scheduledDayKeys.forEach((dayKey) => {
    const weekIndex = Math.floor(daysBetween(contractStartDayKey, dayKey) / 7);
    const weekday = new Date(`${dayKey}T12:00:00.000Z`).getUTCDay();
    if (!activeWeekdayCounts.has(weekIndex)) {
      activeWeekdayCounts.set(weekIndex, new Set());
    }
    activeWeekdayCounts.get(weekIndex)?.add(String(weekday));
  });
  const scheduledWeekCount = activeWeekdayCounts.size;
  const averageActiveWeekdaysPerScheduledWeek =
    scheduledWeekCount > 0
      ? Array.from(activeWeekdayCounts.values()).reduce((sum, weekdays) => sum + weekdays.size, 0) / scheduledWeekCount
      : 0;
  const requiredActiveWeekdaysPerScheduledWeek = 3;
  const commercialProductLaunch = isCommercialProductLaunchGoal(input.goalText, input.verificationText);

  const temporalDistribution = {
    contractStartDayKey,
    contractEndDayKey,
    firstScheduledDayKey,
    lastScheduledDayKey,
    horizonDays,
    scheduledSpanDays,
    occupiedMonths,
    latestScheduledHorizonRatio,
    requiredLatestHorizonRatio,
    requiredOccupiedMonths,
    remainingTailDays,
    remainingTailRatio,
    maxUnjustifiedTailRatio,
    scheduledBlockCount,
    averageBlocksPerWeek,
    requiredAverageBlocksPerWeek,
    maxInterBlockGapDays,
    maxAllowedInterBlockGapDays,
    averageActiveWeekdaysPerScheduledWeek,
    requiredActiveWeekdaysPerScheduledWeek,
  };

  if (latestScheduledHorizonRatio < compressionLatestHorizonRatio || occupiedMonths.length < severeOccupiedMonthFloor) {
    return {
      failureCode: 'LONG_HORIZON_TEMPORAL_COMPRESSION' as const,
      temporalDistribution,
    };
  }

  if (remainingTailRatio > maxUnjustifiedTailRatio && remainingTailDays >= 60) {
    return {
      failureCode: 'LONG_HORIZON_UNJUSTIFIED_TAIL_GAP' as const,
      temporalDistribution,
    };
  }

  if (commercialProductLaunch && averageBlocksPerWeek < requiredAverageBlocksPerWeek) {
    const failureCodes: PlanQualityFailureCode[] = ['LONG_HORIZON_SPARSE_CADENCE'];
    if (maxInterBlockGapDays > maxAllowedInterBlockGapDays) {
      failureCodes.push('LONG_HORIZON_WORK_GAPS');
    }
    return {
      failureCode: failureCodes[0],
      failureCodes,
      temporalDistribution,
    };
  }

  if (commercialProductLaunch && maxInterBlockGapDays > maxAllowedInterBlockGapDays) {
    return {
      failureCode: 'LONG_HORIZON_WORK_GAPS' as const,
      temporalDistribution,
    };
  }

  if (
    commercialProductLaunch &&
    horizonDays >= 120 &&
    scheduledWeekCount >= 8 &&
    averageActiveWeekdaysPerScheduledWeek < requiredActiveWeekdaysPerScheduledWeek
  ) {
    return {
      failureCode: 'COMMERCIAL_WORK_WINDOW_UNDERUSED' as const,
      temporalDistribution,
    };
  }

  return {
    temporalDistribution,
  };
}

function analyzeCommercialBlockSpecificity(input: {
  goalText: string;
  verificationText: string;
  executionArtifacts: PlanArtifact[];
}) {
  if (!isCommercialProductLaunchGoal(input.goalText, input.verificationText)) return null;
  if (input.executionArtifacts.length < 8) return null;

  const repeatedShellEntries = input.executionArtifacts
    .map((block, index) => ({
      id: normalizeText(block?.id) || `block-${index + 1}`,
      title: normalizeText(block?.title),
      shellTitle: stripSessionOrdinalShell(normalizeText(block?.title)),
    }))
    .filter((entry) => isRepeatedCommercialFamilyShellTitle(entry.title));

  const repeatedShellCounts = repeatedShellEntries.reduce((map, entry) => {
    map.set(entry.shellTitle, (map.get(entry.shellTitle) || 0) + 1);
    return map;
  }, new Map<string, number>());
  const repeatedShellBlockIds = repeatedShellEntries
    .filter((entry) => (repeatedShellCounts.get(entry.shellTitle) || 0) >= 3)
    .map((entry) => entry.id);
  const repeatedShellTitleCount = repeatedShellBlockIds.length;
  const repeatedShellTitleRatio = repeatedShellTitleCount / Math.max(1, input.executionArtifacts.length);
  const maxRepeatedShellTitleCount = 6;
  const maxRepeatedShellTitleRatio = 0.25;

  if (repeatedShellTitleCount > maxRepeatedShellTitleCount || repeatedShellTitleRatio > maxRepeatedShellTitleRatio) {
    return {
      failureCode: 'COMMERCIAL_BLOCK_SPECIFICITY_WEAK' as const,
      repeatedShellBlockIds,
      repeatedShellTitleCount,
      repeatedShellTitleRatio,
      maxRepeatedShellTitleCount,
      maxRepeatedShellTitleRatio,
    };
  }

  return null;
}

export function evaluatePlanQualityGate(input: EvaluatePlanQualityGateInput): PlanQualityGateResult {
  const goalText = normalizeText(input.goalText);
  const verificationText = normalizeText(input.verificationText);
  const deliverables = Array.isArray(input.deliverables) ? input.deliverables.filter(Boolean) : [];
  const actions = Array.isArray(input.actions) ? input.actions.filter(Boolean) : [];
  const proposedBlocks = Array.isArray(input.proposedBlocks) ? input.proposedBlocks.filter(Boolean) : [];
  const committedBlocks = Array.isArray(input.committedBlocks) ? input.committedBlocks.filter(Boolean) : [];
  const executionArtifacts = [...proposedBlocks, ...committedBlocks];

  const failureCodes = new Set<PlanQualityFailureCode>();
  const reasonCodes = new Set<string>();
  const missingMajorComponents = new Set<string>();
  const missingDeliverableBranches = new Set<string>();
  const missingExecutionDescendants = new Set<string>();
  const weakDeliverableIds = new Set<string>();
  const weakBlockIds = new Set<string>();
  const goalDisconnectedDeliverableIds = new Set<string>();
  const semanticHollowDeliverableIds = new Set<string>();
  const goalObjectMissingBlockIds = new Set<string>();
  const meaningLossBlockIds = new Set<string>();
  const deliverableBlockCoverageMap = new Map<string, boolean>();
  const deliverableHasActionsMap = new Map<string, boolean>();
  const commercialProductLaunch = isCommercialProductLaunchGoal(goalText, verificationText);
  const goalAnchorTokens = new Set(extractSemanticTokens(`${goalText} ${verificationText}`, { excludeShell: true }));
  const deliverableById = new Map(
    deliverables.map((deliverable, index) => [
      normalizeText(deliverable?.id) || `deliverable-${index + 1}`,
      deliverable,
    ])
  );
  const actionById = new Map(actions.map((action) => [normalizeText(action?.id), action]));

  const expectedEpisodes = extractExpectedEpisodeNumbers(goalText, verificationText);
  if (expectedEpisodes.length > 0) {
    const observedEpisodes = extractObservedEpisodeNumbers([
      ...deliverables.map((deliverable) => normalizeText(deliverable?.title)),
      ...actions.map((action) => normalizeText(action?.title)),
      ...executionArtifacts.map((block) => normalizeText(block?.title)),
    ]);
    expectedEpisodes.forEach((episodeNumber) => {
      if (!observedEpisodes.has(episodeNumber)) {
        missingMajorComponents.add(`episode ${episodeNumber}`);
      }
    });
    if (missingMajorComponents.size > 0) {
      failureCodes.add('PLAN_COVERAGE_MISSING_MAJOR_COMPONENT');
      reasonCodes.add('PLAN_COVERAGE_MISSING_MAJOR_COMPONENT');
    }
  }

  deliverables.forEach((deliverable, index) => {
    const deliverableId = normalizeText(deliverable?.id) || `deliverable-${index + 1}`;
    const title = normalizeText(deliverable?.title);
    const actionIds = Array.isArray(deliverable?.actionIds) ? deliverable.actionIds.filter(Boolean) : [];
    const descendantActions = actions.filter((action) => {
      const actionId = normalizeText(action?.id);
      return actionIds.includes(actionId) || normalizeText(action?.deliverableId) === deliverableId;
    });
    const descendantBlocks = executionArtifacts.filter(
      (block) => normalizeText(block?.deliverableId) === deliverableId
    );

    if (descendantActions.length === 0 && descendantBlocks.length === 0) {
      missingExecutionDescendants.add(deliverableId);
      failureCodes.add('PLAN_COVERAGE_MISSING_EXECUTION_DESCENDANTS');
      reasonCodes.add('PLAN_COVERAGE_MISSING_EXECUTION_DESCENDANTS');
    }

    const actionIdsInBranch = descendantActions.map((action) => normalizeText(action?.id));
    const branchBlocks = executionArtifacts.filter(
      (block) =>
        normalizeText(block?.deliverableId) === deliverableId ||
        actionIdsInBranch.includes(normalizeText(block?.actionId))
    );
    deliverableBlockCoverageMap.set(deliverableId, branchBlocks.length > 0);
    deliverableHasActionsMap.set(deliverableId, descendantActions.length > 0);

    if (input.branchCoverageSummary?.declaredBranches?.includes(deliverableId) && branchBlocks.length === 0) {
      missingDeliverableBranches.add(deliverableId);
      failureCodes.add('PLAN_COVERAGE_MISSING_DELIVERABLE_BRANCH');
      reasonCodes.add('PLAN_COVERAGE_MISSING_DELIVERABLE_BRANCH');
    }

    if (title && hasPattern(DELIVERABLE_OBJECT_MISSING_PATTERNS, title)) {
      weakDeliverableIds.add(deliverableId);
      failureCodes.add('DELIVERABLE_OBJECT_MISSING');
      reasonCodes.add('DELIVERABLE_OBJECT_MISSING');
    } else if (title && hasPattern(DELIVERABLE_TOO_GENERIC_PATTERNS, title)) {
      weakDeliverableIds.add(deliverableId);
      failureCodes.add('DELIVERABLE_TOO_GENERIC');
      reasonCodes.add('DELIVERABLE_TOO_GENERIC');
    }

    const titleTokens = extractSemanticTokens(title);
    const titleGoalOverlap = intersectTokens(titleTokens, goalAnchorTokens);
    const branchTokens = uniqueTokens([
      ...titleTokens,
      ...descendantActions.flatMap((action) => extractSemanticTokens(action?.title)),
      ...descendantBlocks.flatMap((block) => extractSemanticTokens(block?.title)),
    ]);
    const branchGoalOverlap = intersectTokens(branchTokens, goalAnchorTokens);
    const shellHeavyTitle = isShellHeavy(titleTokens);

    if (
      title &&
      goalAnchorTokens.size > 0 &&
      branchGoalOverlap.length === 0 &&
      (shellHeavyTitle || hasPattern(DELIVERABLE_SEMANTIC_HOLLOWNESS_PATTERNS, title))
    ) {
      goalDisconnectedDeliverableIds.add(deliverableId);
      failureCodes.add('DELIVERABLE_GOAL_DISCONNECTED');
      reasonCodes.add('DELIVERABLE_GOAL_DISCONNECTED');
    }

    if (
      title &&
      titleGoalOverlap.length === 0 &&
      (shellHeavyTitle ||
        hasPattern(DELIVERABLE_OBJECT_MISSING_PATTERNS, title) ||
        hasPattern(DELIVERABLE_SEMANTIC_HOLLOWNESS_PATTERNS, title))
    ) {
      semanticHollowDeliverableIds.add(deliverableId);
      failureCodes.add('DELIVERABLE_SEMANTIC_HOLLOWNESS');
      reasonCodes.add('DELIVERABLE_SEMANTIC_HOLLOWNESS');
    }
  });

  if (executionArtifacts.length > 0 && deliverables.length >= 2) {
    const allDeliverableIds = deliverables.map(
      (deliverable, index) => normalizeText(deliverable?.id) || `deliverable-${index + 1}`
    );
    const coveredCount = allDeliverableIds.filter((id) => deliverableBlockCoverageMap.get(id)).length;
    const declaredButUnscheduled = allDeliverableIds.filter(
      (id) => !deliverableBlockCoverageMap.get(id) && deliverableHasActionsMap.get(id)
    );
    if (coveredCount > allDeliverableIds.length / 2 && declaredButUnscheduled.length > 0) {
      declaredButUnscheduled.forEach((id) => missingDeliverableBranches.add(id));
      failureCodes.add('PLAN_COVERAGE_PARTIAL_SCOPE_COLLAPSE');
      reasonCodes.add('PLAN_COVERAGE_PARTIAL_SCOPE_COLLAPSE');
    }
  }

  actions.forEach((action) => {
    if (deliverables.length > 0 && !normalizeText(action?.deliverableId)) {
      failureCodes.add('ACTION_LINEAGE_BROKEN');
      reasonCodes.add('ACTION_LINEAGE_BROKEN');
    }
  });

  executionArtifacts.forEach((block, index) => {
    const blockId = normalizeText(block?.id) || `block-${index + 1}`;
    const title = normalizeText(block?.title);
    const blockTokens = extractSemanticTokens(title);
    if (!normalizeText(block?.deliverableId) && !normalizeText(block?.actionId)) {
      weakBlockIds.add(blockId);
      failureCodes.add('BLOCK_LINEAGE_BROKEN');
      reasonCodes.add('BLOCK_LINEAGE_BROKEN');
    }
    if (title && hasPattern(BLOCK_TOO_GENERIC_PATTERNS, title)) {
      weakBlockIds.add(blockId);
      failureCodes.add('BLOCK_TOO_GENERIC');
      reasonCodes.add('BLOCK_TOO_GENERIC');
    }

    const linkedDeliverable = deliverableById.get(normalizeText(block?.deliverableId));
    const linkedAction = actionById.get(normalizeText(block?.actionId));
    const ancestorGoalObjectTokens = uniqueTokens([
      ...intersectTokens(extractSemanticTokens(linkedDeliverable?.title), goalAnchorTokens),
      ...intersectTokens(extractSemanticTokens(linkedAction?.title), goalAnchorTokens),
      ...intersectTokens(extractSemanticTokens(block?.lineageTitle), goalAnchorTokens),
    ]);
    const ancestorSemanticTokens = new Set(
      uniqueTokens([
        ...extractSemanticTokens(linkedDeliverable?.title, { excludeShell: true }),
        ...extractSemanticTokens(linkedAction?.title, { excludeShell: true }),
        ...extractSemanticTokens(block?.lineageTitle, { excludeShell: true }),
      ])
    );
    const blockGoalOverlap = intersectTokens(blockTokens, goalAnchorTokens);
    const blockAncestorOverlap = intersectTokens(blockTokens, ancestorSemanticTokens);
    const commercialSpecificOperationalBlock =
      commercialProductLaunch &&
      normalizeText(block?.deliverableId || block?.actionId) &&
      ancestorGoalObjectTokens.length > 0 &&
      blockGoalOverlap.length === 0 &&
      blockAncestorOverlap.length === 0 &&
      blockTokens.length >= 3 &&
      !isShellHeavy(blockTokens) &&
      !hasPattern(BLOCK_TOO_GENERIC_PATTERNS, title) &&
      !hasPattern(LINEAGE_VISIBLE_MEANING_LOSS_PATTERNS, title);

    if (
      normalizeText(block?.deliverableId || block?.actionId) &&
      ancestorGoalObjectTokens.length > 0 &&
      blockGoalOverlap.length === 0 &&
      blockAncestorOverlap.length === 0 &&
      !commercialSpecificOperationalBlock
    ) {
      goalObjectMissingBlockIds.add(blockId);
      failureCodes.add('BLOCK_GOAL_OBJECT_MISSING');
      reasonCodes.add('BLOCK_GOAL_OBJECT_MISSING');
    }

    if (
      normalizeText(block?.deliverableId || block?.actionId) &&
      ancestorGoalObjectTokens.length > 0 &&
      blockGoalOverlap.length === 0 &&
      blockAncestorOverlap.length === 0 &&
      (hasPattern(LINEAGE_VISIBLE_MEANING_LOSS_PATTERNS, title) || blockTokens.length <= 2)
    ) {
      meaningLossBlockIds.add(blockId);
      failureCodes.add('LINEAGE_VISIBLE_MEANING_LOSS');
      reasonCodes.add('LINEAGE_VISIBLE_MEANING_LOSS');
    }
  });

  const deliverableTitles = deliverables.map((deliverable) => normalizeText(deliverable?.title));
  const commercialSemanticFinding = evaluateCommercialProductLaunchSemanticCoverage({
    goalText,
    verificationText,
    deliverables,
    actions,
    executionArtifacts,
  });
  commercialSemanticFinding?.failureCodes.forEach((code) => {
    failureCodes.add(code);
    reasonCodes.add(code);
  });

  // Phase 2: prep-only insufficiency check for externally mediated goals.
  // A plan with no contact-stage deliverable never reaches the external decision-maker.
  // Scope: externally_mediated and mixed authority classes only.
  // fully_controllable and market_dependent goals are not checked here.
  const outcomeAuthority = deriveTerminalOutcomeAuthority(goalText, verificationText);
  if (outcomeAuthority.authority === 'externally_mediated' || outcomeAuthority.authority === 'mixed') {
    if (!hasContactStageDeliverable(deliverableTitles)) {
      failureCodes.add('OUTCOME_COVERAGE_PREP_ONLY');
      reasonCodes.add('OUTCOME_COVERAGE_PREP_ONLY');
    }

    // Phase 3: terminal-stage coverage check for known corridor lanes.
    // A plan that has contact-stage coverage but no terminal-stage deliverable
    // has not modeled the corridor to the external decision event.
    // Scope: known lanes only (JobSearch, Fundraising). Unknown lanes are skipped.
    const lane = detectCorridorLane(goalText, verificationText);
    if (lane !== 'unknown') {
      if (!hasTerminalStageDeliverable(lane, deliverableTitles)) {
        failureCodes.add('OUTCOME_COVERAGE_TERMINAL_STAGE_MISSING');
        reasonCodes.add('OUTCOME_COVERAGE_TERMINAL_STAGE_MISSING');
      }
    }
  }

  // Phase D: endpoint-presence and split-dimension coverage checks.
  // OUTCOME_ENDPOINT_MISSING: externally_mediated/mixed goal with no detectable terminal event.
  // OUTCOME_SPLIT_DIMENSION_UNCOVERED: split goal whose secondary endpoint dimension has
  //   zero representation in the plan. Dimension-presence only — not corridor completeness.
  const terminalEndpoint = detectTerminalEndpoint(goalText, verificationText);
  if (
    (outcomeAuthority.authority === 'externally_mediated' || outcomeAuthority.authority === 'mixed') &&
    (terminalEndpoint.status === 'missing' || terminalEndpoint.status === 'ambiguous')
  ) {
    failureCodes.add('OUTCOME_ENDPOINT_MISSING');
    reasonCodes.add('OUTCOME_ENDPOINT_MISSING');
  }
  if (terminalEndpoint.status === 'split' && terminalEndpoint.secondaryEndpoint !== undefined) {
    if (!hasSecondaryEndpointCoverage(terminalEndpoint.secondaryEndpoint, deliverableTitles)) {
      failureCodes.add('OUTCOME_SPLIT_DIMENSION_UNCOVERED');
      reasonCodes.add('OUTCOME_SPLIT_DIMENSION_UNCOVERED');
    }
  }

  const temporalFinding = analyzeLongHorizonTemporalDistribution({
    goalText,
    verificationText,
    executionArtifacts,
    temporalContext: input.temporalContext,
  });
  if (temporalFinding?.failureCode) {
    const temporalFailureCodes = Array.isArray(temporalFinding.failureCodes)
      ? temporalFinding.failureCodes
      : [temporalFinding.failureCode];
    temporalFailureCodes.forEach((failureCode) => {
      failureCodes.add(failureCode);
      reasonCodes.add(failureCode);
    });
  }
  const commercialBlockSpecificityFinding = analyzeCommercialBlockSpecificity({
    goalText,
    verificationText,
    executionArtifacts,
  });
  if (commercialBlockSpecificityFinding) {
    failureCodes.add(commercialBlockSpecificityFinding.failureCode);
    reasonCodes.add(commercialBlockSpecificityFinding.failureCode);
    commercialBlockSpecificityFinding.repeatedShellBlockIds.forEach((id) => weakBlockIds.add(id));
  }

  if (failureCodes.size === 0) {
    return {
      status: 'PLAN_QUALITY_PASSED',
      failureCodes: [],
      reasonCodes: [],
      meta: {
        ...(temporalFinding?.temporalDistribution && { temporalDistribution: temporalFinding.temporalDistribution }),
      },
    };
  }

  return {
    status: 'PLAN_QUALITY_WITHHELD',
    failureCodes: Array.from(failureCodes),
    reasonCodes: Array.from(reasonCodes),
    meta: {
      ...(missingMajorComponents.size > 0 && { missingMajorComponents: Array.from(missingMajorComponents) }),
      ...(missingDeliverableBranches.size > 0 && {
        missingDeliverableBranches: Array.from(missingDeliverableBranches),
      }),
      ...(missingExecutionDescendants.size > 0 && {
        missingExecutionDescendants: Array.from(missingExecutionDescendants),
      }),
      ...(weakDeliverableIds.size > 0 && { weakDeliverableIds: Array.from(weakDeliverableIds) }),
      ...(weakBlockIds.size > 0 && { weakBlockIds: Array.from(weakBlockIds) }),
      ...(goalDisconnectedDeliverableIds.size > 0 && {
        goalDisconnectedDeliverableIds: Array.from(goalDisconnectedDeliverableIds),
      }),
      ...(semanticHollowDeliverableIds.size > 0 && {
        semanticHollowDeliverableIds: Array.from(semanticHollowDeliverableIds),
      }),
      ...(goalObjectMissingBlockIds.size > 0 && {
        goalObjectMissingBlockIds: Array.from(goalObjectMissingBlockIds),
      }),
      ...(meaningLossBlockIds.size > 0 && { meaningLossBlockIds: Array.from(meaningLossBlockIds) }),
      ...(temporalFinding && { temporalDistribution: temporalFinding.temporalDistribution }),
      ...(commercialBlockSpecificityFinding && {
        commercialBlockSpecificity: {
          repeatedShellBlockIds: commercialBlockSpecificityFinding.repeatedShellBlockIds,
          repeatedShellTitleCount: commercialBlockSpecificityFinding.repeatedShellTitleCount,
          repeatedShellTitleRatio: commercialBlockSpecificityFinding.repeatedShellTitleRatio,
          maxRepeatedShellTitleCount: commercialBlockSpecificityFinding.maxRepeatedShellTitleCount,
          maxRepeatedShellTitleRatio: commercialBlockSpecificityFinding.maxRepeatedShellTitleRatio,
        },
      }),
      ...(commercialSemanticFinding && {
        commercialSemanticCoverage: commercialSemanticFinding.coverage,
      }),
    },
  };
}
