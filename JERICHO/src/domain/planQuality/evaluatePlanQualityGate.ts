import type { PlanQualityFailureCode, PlanQualityGateResult } from './planQualityTypes.ts';
import { ACTION_VERB_SET } from './actionVerbs.ts';
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
  // Substrate fields — present on full-horizon blocks, absent on goal-level ProposedBlocks
  blockType?: string | null;
  owner?: string | null;
  durationMinutes?: number | null;
  producesArtifact?: string | null;
  consumedBy?: string[] | null;
  passEvidence?: string | null;
  // Goal-level proxy classification (PLANNING | CORE | VERIFICATION)
  kind?: string | null;
  // Machine-verifiable downstream reference (present on full-horizon blocks)
  consumedByRef?: { type: string; id: string } | null;
  // Phase context for downstream ordering check
  phaseLabel?: string | null;
  // Lane context — present on full-horizon blocks
  laneId?: string | null;
  laneLabel?: string | null;
  // Execution context — carries lane family + lane status for BD professionalism checks
  executionContext?: {
    laneFamily?: string | null;
    laneStatus?: string | null;
    planOrientation?: string | null;
  } | null;
  // Phase 4 — gate criteria substrate
  gateName?: string | null;
  passCriteria?: string | null;
  failCriteria?: string | null;
  decisionAuthority?: string | null;
  passBranch?: string | null;
  failBranch?: string | null;
  evidenceRequired?: string | null;
  // Phase 5 — BD professionalism flags
  isExternalBdMechanic?: boolean;
  isExternalStakeholderTouchpoint?: boolean;
  // Phase 6 — title-family used for cadence-loop detection
  titleFamily?: string | null;
  // Phase 7 — backfill/historical/imported markers exempt past-dated blocks
  // from STALE_ACTIVE_CYCLE_STATE.
  isHistorical?: boolean;
  isBackfilled?: boolean;
  isImported?: boolean;
};

// Block types that are exempt from execution-substrate requirements.
// Exempt types are ONLY for blocks that inspect, validate, audit, or checkpoint
// already-produced work. They must not produce the primary artifact of a lane.
// If a block creates user-facing, commercial, operational, creative, technical,
// or strategic output, it is execution work and must carry execution substrate.
// Adding new exempt types requires a test explaining why the block is truly non-production.
const EXEMPT_BLOCK_TYPES = new Set([
  'review',
  'audit',
  'terminal-review',
  'terminal-readiness',
  'gate',
  'checkpoint',
]);

// Non-execution occupancy markers consume calendar time but are not production work.
// They should influence temporal gap analysis without being forced to masquerade as
// execution substrate, downstream support, or review/monitoring work.
const NON_EXECUTION_OCCUPANCY_BLOCK_TYPES = new Set(['waiting_period']);

function isReviewClassBlock(block: PlanArtifact): boolean {
  if (block?.blockType) {
    return EXEMPT_BLOCK_TYPES.has(block.blockType) || block.owner === 'reviewer' || block.owner === 'system';
  }
  if (block?.kind) {
    return block.kind === 'VERIFICATION';
  }
  return false;
}

function isNonExecutionOccupancyBlock(block: PlanArtifact): boolean {
  return Boolean(block?.blockType && NON_EXECUTION_OCCUPANCY_BLOCK_TYPES.has(block.blockType));
}

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

type PhaseObjectiveInput = {
  id: string;
  label: string;
  phaseObjective?: string | null;
  unlockCriteria?: string[] | null;
};

type LaneInput = {
  id: string;
  label?: string | null;
  laneOutcome?: string | null;
};

type EvaluatePlanQualityGateInput = {
  goalText?: string;
  verificationText?: string;
  deliverables?: PlanDeliverable[];
  actions?: PlanAction[];
  proposedBlocks?: PlanArtifact[];
  committedBlocks?: PlanArtifact[];
  // Phase 7 — active-cycle rebasing inputs. evaluationDate is the day the
  // plan is being evaluated (ISO 'YYYY-MM-DD' or Date); allowsBackdatedStart
  // signals the user has explicitly confirmed the cycle is backdated.
  evaluationDate?: string | Date | null;
  allowsBackdatedStart?: boolean;
  branchCoverageSummary?: BranchCoverageSummary;
  phases?: PhaseObjectiveInput[];
  lanes?: LaneInput[];
  missionContext?: {
    coreMission?: string | null;
    outcomeTarget?: string | null;
    successStandard?: string | null;
    terminalOutcome?: string | null;
    controllabilityClass?: string | null;
    terminalTargetClass?: string | null;
  };
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

// Phase-aware temporal workload distribution check.
// Only fires for plans ≥ 1 year (365 days) that contain full-horizon blocks (blockType present).
// Goal-level ProposedBlocks without blockType are skipped entirely.
function analyzePhaseWorkloadDistribution(input: {
  executionArtifacts: PlanArtifact[];
  temporalContext?: EvaluatePlanQualityGateInput['temporalContext'];
}): { failureCodes: PlanQualityFailureCode[]; phasesWithoutExecution: string[] } | null {
  const contractStartDayKey = normalizeText(input.temporalContext?.contractStartDayKey);
  const contractEndDayKey = normalizeText(input.temporalContext?.contractEndDayKey);
  if (!isDayKey(contractStartDayKey) || !isDayKey(contractEndDayKey)) return null;
  const horizonDays = daysBetween(contractStartDayKey, contractEndDayKey) + 1;
  if (horizonDays < 365) return null;
  if (input.temporalContext?.isRecurring === true) return null;
  if (explicitEarlyCompletionAllowed(input.temporalContext?.earlyCompletionJustification)) return null;

  const EXEMPT_PHASE_TYPES = new Set([
    'review', 'audit', 'terminal-review', 'terminal-readiness', 'gate', 'checkpoint', 'waiting_period',
  ]);

  // Only analyze full-horizon blocks — those with blockType set
  const fullHorizonBlocks = input.executionArtifacts.filter((b) => b?.blockType);
  if (fullHorizonBlocks.length === 0) return null;

  // Group by phase label (P1, P2, P3)
  const byPhase: Record<string, { exec: PlanArtifact[]; all: PlanArtifact[] }> = {};
  fullHorizonBlocks.forEach((block) => {
    const phase = normalizeText((block as any)?.phaseLabel).toUpperCase();
    if (!phase || !['P1', 'P2', 'P3'].includes(phase)) return;
    if (!byPhase[phase]) byPhase[phase] = { exec: [], all: [] };
    byPhase[phase].all.push(block);
    const isExempt =
      EXEMPT_PHASE_TYPES.has(block.blockType!) ||
      block.owner === 'reviewer' ||
      block.owner === 'system';
    if (!isExempt) byPhase[phase].exec.push(block);
  });

  const presentPhases = (['P1', 'P2', 'P3'] as const).filter((p) => byPhase[p]);
  if (presentPhases.length === 0) return null;

  const foundCodes: PlanQualityFailureCode[] = [];
  const phasesWithoutExecution: string[] = [];

  // PHASE_WITHOUT_EXECUTION_WORK: phase has blocks but zero execution-class blocks
  for (const phase of presentPhases) {
    if ((byPhase[phase]?.exec.length ?? 0) === 0) {
      phasesWithoutExecution.push(phase);
    }
  }
  if (phasesWithoutExecution.length > 0) {
    foundCodes.push('PHASE_WITHOUT_EXECUTION_WORK');
  }

  // FRONT_LOADED_EXECUTION: P3 exists and has <15% of total execution blocks while total >= 10
  const totalExec = presentPhases.reduce((sum, p) => sum + (byPhase[p]?.exec.length ?? 0), 0);
  const p3Exec = byPhase['P3']?.exec.length ?? 0;
  if (byPhase['P3'] && totalExec >= 10 && p3Exec / totalExec < 0.15) {
    foundCodes.push('FRONT_LOADED_EXECUTION');
  }

  // LONG_HORIZON_WORK_GAPS: gap > 60 days between consecutive execution blocks within any phase
  // Extends the existing commercial-specific check to all goal types at a higher threshold
  const MAX_INTRA_PHASE_GAP_DAYS = 60;
  for (const phase of presentPhases) {
    const execDayKeys = (byPhase[phase]?.exec ?? [])
      .map((b) => resolveArtifactDayKey(b))
      .filter(isDayKey)
      .sort();
    if (execDayKeys.length < 2) continue;
    for (let i = 1; i < execDayKeys.length; i++) {
      const gap = daysBetween(execDayKeys[i - 1] ?? '', execDayKeys[i] ?? '');
      if (gap > MAX_INTRA_PHASE_GAP_DAYS) {
        if (!foundCodes.includes('LONG_HORIZON_WORK_GAPS')) {
          foundCodes.push('LONG_HORIZON_WORK_GAPS');
        }
        break;
      }
    }
  }

  // SPARSE_HORIZON_COVERAGE: fewer than 1 execution block per 2 months of horizon
  // Only meaningful when there are full-horizon blocks to evaluate
  const horizonMonths = horizonDays / 30;
  const minRequired = Math.floor(horizonMonths / 2);
  if (totalExec > 0 && totalExec < minRequired) {
    foundCodes.push('SPARSE_HORIZON_COVERAGE');
  }

  return foundCodes.length > 0 ? { failureCodes: foundCodes, phasesWithoutExecution } : null;
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

// Phase Objective Authenticity: each phase in a full-horizon plan must carry a concrete
// objective and measurable unlock criteria, and must have at least one execution-class block
// supporting it. Fires only when phases are explicitly provided (non-phased plans are skipped).
function analyzePhaseObjectiveAuthenticity(input: {
  phases: PhaseObjectiveInput[];
  executionArtifacts: PlanArtifact[];
}): {
  failureCodes: PlanQualityFailureCode[];
  phasesWithMissingObjective: string[];
  phasesWithVagueObjective: string[];
  phasesWithMissingUnlockCriteria: string[];
  phasesWithVagueUnlockCriteria: string[];
  phasesWithoutSupportingBlocks: string[];
} | null {
  const { phases, executionArtifacts } = input;
  if (!Array.isArray(phases) || phases.length === 0) return null;

  // A phase objective is vague if it has fewer than 3 specific semantic tokens after filtering
  // stopwords, process-class verbs (build/prepare/improve/execute), and shell tokens.
  // This catches "Scale" (1), "Build momentum" (1, "build" filtered), "Continue execution" (2).
  const OBJECTIVE_TOKEN_THRESHOLD = 3;

  // A single unlock criterion is vague if it has fewer than 2 specific semantic tokens.
  // Fires only when ALL criteria in the array are vague.
  const CRITERION_TOKEN_THRESHOLD = 2;

  // Additional denylist for known vague objective phrases.
  const VAGUE_OBJECTIVE_PHRASES = new Set([
    'scale',
    'build momentum',
    'prepare for growth',
    'continue execution',
    'improve operations',
    'growth',
    'momentum',
    'move forward',
    'scale up',
  ]);

  // Count execution-class blocks per phase label (uppercase key).
  // Review/checkpoint blocks do not satisfy phase support.
  const execBlocksByPhase = new Map<string, number>();
  for (const block of executionArtifacts) {
    const phaseKey = normalizeText((block as any)?.phaseLabel).toUpperCase();
    if (!phaseKey || !block?.blockType || isReviewClassBlock(block) || isNonExecutionOccupancyBlock(block)) continue;
    execBlocksByPhase.set(phaseKey, (execBlocksByPhase.get(phaseKey) ?? 0) + 1);
  }

  const foundCodes: PlanQualityFailureCode[] = [];
  const phasesWithMissingObjective: string[] = [];
  const phasesWithVagueObjective: string[] = [];
  const phasesWithMissingUnlockCriteria: string[] = [];
  const phasesWithVagueUnlockCriteria: string[] = [];
  const phasesWithoutSupportingBlocks: string[] = [];

  for (const phase of phases) {
    const label = normalizeText(phase.label) || normalizeText(phase.id);

    // --- Objective checks ---
    const objectiveText = normalizeText(phase.phaseObjective);
    if (!objectiveText) {
      phasesWithMissingObjective.push(label);
    } else {
      const tokens = extractSemanticTokens(objectiveText, { excludeShell: true });
      if (VAGUE_OBJECTIVE_PHRASES.has(objectiveText.toLowerCase()) || tokens.length < OBJECTIVE_TOKEN_THRESHOLD) {
        phasesWithVagueObjective.push(label);
      }
    }

    // --- Unlock criteria checks ---
    const criteria = Array.isArray(phase.unlockCriteria) ? (phase.unlockCriteria as string[]).filter(Boolean) : [];
    if (criteria.length === 0) {
      phasesWithMissingUnlockCriteria.push(label);
    } else {
      const allVague = criteria.every(
        (criterion) => extractSemanticTokens(criterion, { excludeShell: true }).length < CRITERION_TOKEN_THRESHOLD,
      );
      if (allVague) {
        phasesWithVagueUnlockCriteria.push(label);
      }
    }

    // --- Supporting blocks check ---
    const phaseKey = normalizeText(phase.label).toUpperCase();
    if ((execBlocksByPhase.get(phaseKey) ?? 0) === 0) {
      phasesWithoutSupportingBlocks.push(label);
    }
  }

  if (phasesWithMissingObjective.length > 0) foundCodes.push('MISSING_PHASE_OBJECTIVE');
  if (phasesWithVagueObjective.length > 0) foundCodes.push('VAGUE_PHASE_OBJECTIVE');
  if (phasesWithMissingUnlockCriteria.length > 0) foundCodes.push('MISSING_PHASE_UNLOCK_CRITERIA');
  if (phasesWithVagueUnlockCriteria.length > 0) foundCodes.push('VAGUE_PHASE_UNLOCK_CRITERIA');
  if (phasesWithoutSupportingBlocks.length > 0) foundCodes.push('PHASE_OBJECTIVE_WITHOUT_SUPPORTING_BLOCKS');

  if (foundCodes.length === 0) return null;
  return {
    failureCodes: foundCodes,
    phasesWithMissingObjective,
    phasesWithVagueObjective,
    phasesWithMissingUnlockCriteria,
    phasesWithVagueUnlockCriteria,
    phasesWithoutSupportingBlocks,
  };
}

// Mission Alignment Authenticity: phase objectives must share meaningful tokens with the declared
// mission context, and a terminal outcome requires a P3 phase to support it.
// Fires only when both phases and non-empty missionContext are explicitly provided.
function analyzeMissionAlignment(input: {
  phases: PhaseObjectiveInput[];
  missionContext: EvaluatePlanQualityGateInput['missionContext'];
}): { failureCodes: PlanQualityFailureCode[]; misalignedPhases: string[] } | null {
  const { phases, missionContext } = input;
  if (!Array.isArray(phases) || phases.length === 0) return null;
  if (!missionContext) return null;

  // Build combined mission reference text from all provided mission context fields
  const missionRefText = [
    missionContext.coreMission,
    missionContext.outcomeTarget,
    missionContext.successStandard,
    missionContext.terminalOutcome,
  ]
    .filter(Boolean)
    .join(' ');
  if (!normalizeText(missionRefText)) return null;

  const missionTokens = new Set(extractSemanticTokens(missionRefText, { excludeShell: true }));
  if (missionTokens.size === 0) return null;

  const foundCodes: PlanQualityFailureCode[] = [];
  const misalignedPhases: string[] = [];

  // PHASE_OBJECTIVE_NOT_MISSION_ALIGNED: phase objective has zero token overlap with mission context
  for (const phase of phases) {
    const label = normalizeText(phase.label) || normalizeText(phase.id);
    const objectiveText = normalizeText(phase.phaseObjective);
    if (!objectiveText) continue; // missing objective handled by analyzePhaseObjectiveAuthenticity
    const objectiveTokens = extractSemanticTokens(objectiveText, { excludeShell: true });
    const overlap = objectiveTokens.filter((t) => missionTokens.has(t));
    if (overlap.length === 0) {
      misalignedPhases.push(label);
    }
  }
  if (misalignedPhases.length > 0) {
    foundCodes.push('PHASE_OBJECTIVE_NOT_MISSION_ALIGNED');
  }

  // TERMINAL_OUTCOME_WITHOUT_PHASE_SUPPORT: a declared terminal outcome requires a P3 phase
  const terminalOutcome = normalizeText(missionContext.terminalOutcome);
  if (terminalOutcome) {
    const hasP3 = phases.some((p) => normalizeText(p.label).toUpperCase() === 'P3');
    if (!hasP3) {
      foundCodes.push('TERMINAL_OUTCOME_WITHOUT_PHASE_SUPPORT');
    }
  }

  if (foundCodes.length === 0) return null;
  return { failureCodes: foundCodes, misalignedPhases };
}

function analyzeLaneContributionAuthenticity(input: {
  lanes?: LaneInput[];
  executionArtifacts: PlanArtifact[];
}): {
  failureCodes: PlanQualityFailureCode[];
  lanesWithMissingOutcome: string[];
  lanesWithVagueOutcome: string[];
  lanesWithoutExecution: string[];
  lanesWithoutSupport: string[];
} | null {
  const lanes = Array.isArray(input.lanes) ? input.lanes.filter(Boolean) : [];
  if (lanes.length === 0) return null;

  const fullHorizonArtifacts = input.executionArtifacts.filter((artifact) => artifact?.blockType);
  if (fullHorizonArtifacts.length === 0) return null;

  const VAGUE_LANE_OUTCOME_PATTERNS = new Set([
    'build momentum',
    'support growth',
    'improve operations',
    'create content',
    'make progress',
  ]);
  const LANE_OUTCOME_TOKEN_THRESHOLD = 2;

  const executionBlocksByLane = new Map<string, PlanArtifact[]>();
  for (const artifact of fullHorizonArtifacts) {
    const laneId = normalizeText(artifact?.laneId);
    if (!laneId || isReviewClassBlock(artifact) || isNonExecutionOccupancyBlock(artifact)) continue;
    if (!executionBlocksByLane.has(laneId)) {
      executionBlocksByLane.set(laneId, []);
    }
    executionBlocksByLane.get(laneId)?.push(artifact);
  }

  const foundCodes: PlanQualityFailureCode[] = [];
  const lanesWithMissingOutcome: string[] = [];
  const lanesWithVagueOutcome: string[] = [];
  const lanesWithoutExecution: string[] = [];
  const lanesWithoutSupport: string[] = [];

  for (const lane of lanes) {
    const laneId = normalizeText(lane?.id);
    if (!laneId) continue;

    const laneLabel = normalizeText(lane?.label) || laneId;
    const laneOutcome = normalizeText(lane?.laneOutcome);
    if (!laneOutcome) {
      lanesWithMissingOutcome.push(laneLabel);
    } else {
      const outcomeTokens = extractSemanticTokens(laneOutcome, { excludeShell: true });
      if (
        VAGUE_LANE_OUTCOME_PATTERNS.has(laneOutcome.toLowerCase()) ||
        outcomeTokens.length < LANE_OUTCOME_TOKEN_THRESHOLD
      ) {
        lanesWithVagueOutcome.push(laneLabel);
      }
    }

    const laneExecutionBlocks = executionBlocksByLane.get(laneId) || [];
    if (laneExecutionBlocks.length === 0) {
      lanesWithoutExecution.push(laneLabel);
      continue;
    }

    const hasContributionPath = laneExecutionBlocks.some((block) => {
      const refType = normalizeText(block?.consumedByRef?.type);
      const refId = normalizeText(block?.consumedByRef?.id);
      if (!refType || !refId) return false;
      if (refType === 'phaseObjective' || refType === 'terminalOutcome') return true;
      if (refType !== 'laneOutcome') return false;
      return refId === laneId || refId.startsWith(`${laneId}:`);
    });

    if (!hasContributionPath) {
      lanesWithoutSupport.push(laneLabel);
    }
  }

  if (lanesWithMissingOutcome.length > 0) foundCodes.push('MISSING_LANE_OUTCOME');
  if (lanesWithVagueOutcome.length > 0) foundCodes.push('VAGUE_LANE_OUTCOME');
  if (lanesWithoutExecution.length > 0) foundCodes.push('LANE_WITHOUT_EXECUTION_WORK');
  if (lanesWithoutSupport.length > 0) foundCodes.push('LANE_OUTCOME_WITHOUT_PHASE_OR_MISSION_SUPPORT');

  if (foundCodes.length === 0) return null;
  return {
    failureCodes: foundCodes,
    lanesWithMissingOutcome,
    lanesWithVagueOutcome,
    lanesWithoutExecution,
    lanesWithoutSupport,
  };
}

export function evaluatePlanQualityGate(input: EvaluatePlanQualityGateInput): PlanQualityGateResult {
  const goalText = normalizeText(input.goalText);
  const verificationText = normalizeText(input.verificationText);
  const deliverables = Array.isArray(input.deliverables) ? input.deliverables.filter(Boolean) : [];
  const actions = Array.isArray(input.actions) ? input.actions.filter(Boolean) : [];
  const proposedBlocks = Array.isArray(input.proposedBlocks) ? input.proposedBlocks.filter(Boolean) : [];
  const committedBlocks = Array.isArray(input.committedBlocks) ? input.committedBlocks.filter(Boolean) : [];
  const executionArtifacts = [...proposedBlocks, ...committedBlocks];
  // Phase 7 — normalize evaluationDate into an ISO day key for past-date checks.
  const evaluationDayKey = (() => {
    const raw = input.evaluationDate;
    if (!raw) return null;
    if (raw instanceof Date) return raw.toISOString().slice(0, 10);
    const s = String(raw).trim();
    return s.length >= 10 ? s.slice(0, 10) : null;
  })();
  const allowsBackdatedStart = input.allowsBackdatedStart === true;

  const failureCodes = new Set<PlanQualityFailureCode>();
  const reasonCodes = new Set<string>();

  // MISSING_OUTCOME_TARGET: a plan whose outcome depends on external markets,
  // stakeholders, or funding (semi_controllable / externally_mediated) must declare
  // a falsifiable terminal target. A purely self-controllable goal can rely on
  // coreMission alone — this check only fires when controllabilityClass is provided.
  if (input.missionContext) {
    const controllabilityClass = normalizeText(input.missionContext.controllabilityClass || '').toLowerCase();
    const requiresTerminalTarget =
      controllabilityClass === 'semi_controllable' || controllabilityClass === 'externally_mediated';
    if (requiresTerminalTarget && !normalizeText(input.missionContext.outcomeTarget)) {
      failureCodes.add('MISSING_OUTCOME_TARGET');
      reasonCodes.add('MISSING_OUTCOME_TARGET');
    }
  }

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

  // Action Title Executability: execution block titles must be complete, action-oriented instructions.
  // Only applies to full-horizon execution blocks (blockType present, not review-class).
  // ACTION_VERB_SET is imported from ./actionVerbs.ts — the single source of truth shared
  // with fullHorizonBlockQuality so both validators agree on what counts as actionable.
  const INTERROGATIVE_WORDS = new Set([
    'what', 'how', 'why', 'when', 'where', 'who', 'which',
    'is', 'are', 'does', 'do', 'can', 'should', 'will', 'would', 'could',
  ]);

  function checkTitleExecutability(title: string): {
    fragmentary: boolean; nonActionable: boolean; question: boolean;
  } {
    if (!title) return { fragmentary: false, nonActionable: false, question: false };
    const words = title.trim().split(/\s+/);
    const firstWord = (words[0] || '').toLowerCase().replace(/[^a-z-]/g, '');
    return {
      fragmentary: words.length < 3,
      question: title.includes('?') || INTERROGATIVE_WORDS.has(firstWord),
      nonActionable: words.length >= 3 && !ACTION_VERB_SET.has(firstWord),
    };
  }

  // Artifact specificity: vague phrase denylists for known placeholder outputs.
  // "With context" exceptions: a category word paired with 2+ substantive descriptor tokens passes.
  const VAGUE_ARTIFACT_PHRASES = new Set([
    'work product matching expected output',
    'completed artifact matching expected output',
    'work product',
    'output',
    'artifact',
    'result',
    'progress',
  ]);
  const VAGUE_EVIDENCE_PHRASES = new Set([
    'work product matching expected output',
    'completed artifact matching expected output',
    'done',
    'complete',
    'completed',
    'finished',
    'assembled',
    'created',
    'produced',
    'work done',
    'work complete',
    'work completed',
    'block passed',
    'task done',
    'task complete',
    'evidence exists',
    'artifact exists',
  ]);

  function isVagueArtifact(value: string | null | undefined): boolean {
    const text = normalizeText(value).toLowerCase();
    if (!text) return false; // empty already caught by MISSING_EXECUTION_ARTIFACT
    if (VAGUE_ARTIFACT_PHRASES.has(text)) return true;
    // Shell-only check: no substantive (non-shell, non-stop, non-process) tokens at all
    return extractSemanticTokens(text, { excludeShell: true }).length === 0;
  }

  function isVagueEvidence(value: string | null | undefined): boolean {
    const text = normalizeText(value).toLowerCase();
    if (!text) return false; // empty already caught by MISSING_EXECUTION_PASS_EVIDENCE
    if (VAGUE_EVIDENCE_PHRASES.has(text)) return true;
    return extractSemanticTokens(text, { excludeShell: true }).length === 0;
  }

  // Plan Substance Gate: execution blocks must answer who owns the work, how long it takes,
  // what artifact it produces, what consumes that output, and what evidence proves it passed.
  // Full-horizon blocks carry blockType + all 5 fields; goal-level blocks carry kind only.
  // Review/audit/checkpoint/gate blocks are exempt from execution-substrate requirements.
  const substanceMissingBlockIds = new Set<string>();
  const vagueArtifactBlockIds = new Set<string>();
  const vagueEvidenceBlockIds = new Set<string>();
  const fragmentaryBlockIds = new Set<string>();
  const nonActionableBlockIds = new Set<string>();
  const questionBlockIds = new Set<string>();
  let reviewClassCount = 0;
  let executionClassCount = 0;

  executionArtifacts.forEach((block, index) => {
    const blockId = normalizeText(block?.id) || `block-${index + 1}`;
    const title = normalizeText(block?.title);
    // Gate Criteria Substrate (Phase 4): gate blocks are execution-substrate
    // exempt, but they MUST declare pass criteria, fail criteria, and a failure
    // branch — otherwise a "gate" is just a label that authorizes neither
    // advance nor remediation.
    if (block?.blockType === 'gate') {
      if (!normalizeText(block?.passCriteria)) {
        failureCodes.add('MISSING_GATE_PASS_CRITERIA');
        reasonCodes.add('MISSING_GATE_PASS_CRITERIA');
      }
      if (!normalizeText(block?.failCriteria)) {
        failureCodes.add('MISSING_GATE_FAIL_CRITERIA');
        reasonCodes.add('MISSING_GATE_FAIL_CRITERIA');
      }
      if (!normalizeText(block?.failBranch)) {
        failureCodes.add('MISSING_GATE_FAILURE_BRANCH');
        reasonCodes.add('MISSING_GATE_FAILURE_BRANCH');
      }
    }
    if (isReviewClassBlock(block)) {
      reviewClassCount++;
      return;
    }
    if (isNonExecutionOccupancyBlock(block)) {
      return;
    }
    executionClassCount++;
    // Substrate field enforcement applies only to full-horizon blocks (blockType present).
    // Goal-level ProposedBlocks (kind only) contribute to the ratio check but are not
    // individually flagged for missing fields they structurally cannot carry.
    if (!block?.blockType) return;
    if (!normalizeText(block?.owner)) {
      substanceMissingBlockIds.add(blockId);
      failureCodes.add('MISSING_EXECUTION_OWNER');
      reasonCodes.add('MISSING_EXECUTION_OWNER');
    }
    if (!block?.durationMinutes || block.durationMinutes <= 0) {
      substanceMissingBlockIds.add(blockId);
      failureCodes.add('MISSING_EXECUTION_DURATION');
      reasonCodes.add('MISSING_EXECUTION_DURATION');
    }
    if (!normalizeText(block?.producesArtifact)) {
      substanceMissingBlockIds.add(blockId);
      failureCodes.add('MISSING_EXECUTION_ARTIFACT');
      reasonCodes.add('MISSING_EXECUTION_ARTIFACT');
    }
    if (!Array.isArray(block?.consumedBy) || block.consumedBy.length === 0) {
      substanceMissingBlockIds.add(blockId);
      failureCodes.add('MISSING_EXECUTION_CONSUMER');
      reasonCodes.add('MISSING_EXECUTION_CONSUMER');
    }
    if (!normalizeText(block?.passEvidence)) {
      substanceMissingBlockIds.add(blockId);
      failureCodes.add('MISSING_EXECUTION_PASS_EVIDENCE');
      reasonCodes.add('MISSING_EXECUTION_PASS_EVIDENCE');
    }
    // Artifact Specificity: present fields must still be specific enough to be actionable.
    // Only fires when the field is non-empty (missing fields are caught above).
    if (normalizeText(block?.producesArtifact) && isVagueArtifact(block?.producesArtifact)) {
      vagueArtifactBlockIds.add(blockId);
      failureCodes.add('VAGUE_EXECUTION_ARTIFACT');
      reasonCodes.add('VAGUE_EXECUTION_ARTIFACT');
    }
    if (normalizeText(block?.passEvidence) && isVagueEvidence(block?.passEvidence)) {
      vagueEvidenceBlockIds.add(blockId);
      failureCodes.add('VAGUE_PASS_EVIDENCE');
      reasonCodes.add('VAGUE_PASS_EVIDENCE');
    }
    // Action Title Executability: title must be a complete, action-oriented instruction.
    // Checked only when title is present (empty titles are caught by BLOCK_TOO_GENERIC/LINEAGE checks).
    if (title) {
      const titleCheck = checkTitleExecutability(title);
      if (titleCheck.fragmentary) {
        fragmentaryBlockIds.add(blockId);
        failureCodes.add('FRAGMENTARY_BLOCK_TITLE');
        reasonCodes.add('FRAGMENTARY_BLOCK_TITLE');
      } else if (titleCheck.question) {
        questionBlockIds.add(blockId);
        failureCodes.add('QUESTION_BLOCK_TITLE');
        reasonCodes.add('QUESTION_BLOCK_TITLE');
      } else if (titleCheck.nonActionable) {
        nonActionableBlockIds.add(blockId);
        failureCodes.add('NON_ACTIONABLE_BLOCK_TITLE');
        reasonCodes.add('NON_ACTIONABLE_BLOCK_TITLE');
      }
    }
  });

  // MONITORING_WITHOUT_PRODUCTION: a plan whose classified blocks are majority review/audit/checkpoint
  // has scheduled oversight of work it never scheduled. Requires at least 3 classified blocks to fire.
  const totalClassifiedBlocks = reviewClassCount + executionClassCount;
  if (totalClassifiedBlocks >= 3 && reviewClassCount / totalClassifiedBlocks > 0.5) {
    failureCodes.add('MONITORING_WITHOUT_PRODUCTION');
    reasonCodes.add('MONITORING_WITHOUT_PRODUCTION');
  }

  // Business Development Professionalism (Phase 5): commercial/capital/institution/civic
  // lanes that have ANY active execution work must include real external-facing BD
  // mechanics (outreach, proposal, pilot, partnership) and at least one external
  // stakeholder touchpoint. Capital lanes must additionally declare a budget amount,
  // budget range, or an explicit unknown-budget flag for resolution. Blocked /
  // incubating / gated lanes (no active execution work) are exempt — they are allowed
  // to carry only readiness / audit / gate work until upstream dependencies clear.
  const BD_REQUIRED_LANE_FAMILIES = new Set([
    'income_stream',
    'capital_real_estate',
    'institution_education',
    'civic_development',
  ]);
  const CAPITAL_BUDGET_PATTERN = /\$\s*\d|\b\d+\s*(?:k|m|b)\b|\bbudget\s+(?:range|amount)\b|\bfunding\s+amount\b|\bcapital\s+(?:range|amount)\b|\bunknown[- ]budget\b/i;
  const bdLaneBlocks = new Map<string, { laneFamily: string; activeBlocks: PlanArtifact[]; allBlocks: PlanArtifact[] }>();
  executionArtifacts.forEach((block) => {
    const laneId = normalizeText(block?.laneId);
    if (!laneId) return;
    const laneFamily = String(block?.executionContext?.laneFamily || '').trim();
    if (!BD_REQUIRED_LANE_FAMILIES.has(laneFamily)) return;
    const entry = bdLaneBlocks.get(laneId) || { laneFamily, activeBlocks: [], allBlocks: [] };
    entry.allBlocks.push(block);
    if (String(block?.executionContext?.laneStatus || '').trim() === 'active') {
      entry.activeBlocks.push(block);
    }
    bdLaneBlocks.set(laneId, entry);
  });
  bdLaneBlocks.forEach(({ laneFamily, activeBlocks }) => {
    if (activeBlocks.length === 0) return;
    const hasBdMechanic = activeBlocks.some((b) => b?.isExternalBdMechanic === true);
    if (!hasBdMechanic) {
      failureCodes.add('MISSING_BD_EXECUTION_MECHANICS');
      reasonCodes.add('MISSING_BD_EXECUTION_MECHANICS');
    }
    const hasStakeholderTouchpoint = activeBlocks.some((b) => b?.isExternalStakeholderTouchpoint === true);
    if (!hasStakeholderTouchpoint) {
      failureCodes.add('MISSING_EXTERNAL_STAKEHOLDER_TOUCHPOINT');
      reasonCodes.add('MISSING_EXTERNAL_STAKEHOLDER_TOUCHPOINT');
    }
    if (laneFamily === 'capital_real_estate') {
      const hasBudget = activeBlocks.some((b) => CAPITAL_BUDGET_PATTERN.test(normalizeText(b?.producesArtifact)));
      if (!hasBudget) {
        failureCodes.add('MISSING_CAPITAL_AMOUNT_OR_BUDGET_RANGE');
        reasonCodes.add('MISSING_CAPITAL_AMOUNT_OR_BUDGET_RANGE');
      }
    }
  });

  // Review/Audit Artifact Pairing (Phase 6): every review-class block must
  // declare what upstream artifact it is reviewing. evidenceRequired carries
  // that pointer; without it, a "review" is just a calendar event consuming
  // time without authority.
  const REVIEW_CLASS_REQUIRING_EVIDENCE = new Set(['review', 'audit', 'validation', 'readiness']);
  executionArtifacts.forEach((block) => {
    if (!REVIEW_CLASS_REQUIRING_EVIDENCE.has(String(block?.blockType))) return;
    if (!normalizeText(block?.evidenceRequired)) {
      failureCodes.add('REVIEW_WITHOUT_PRIOR_ARTIFACT');
      reasonCodes.add('REVIEW_WITHOUT_PRIOR_ARTIFACT');
    }
  });

  // Review/Action Ratio (Phase 6): per (lane, phase) the production-to-review
  // ratio must be defensible. P1 demands action-heavy work (action ≥ review);
  // P2 allows audit/gate structure to grow but still requires production; P3
  // may add validation/terminal-readiness without limit. Gated/blocked/
  // incubating/deferred lanes are exempt — they are allowed to carry only
  // readiness/audit/gate work while upstream dependencies clear.
  const REVIEW_CLASS_TYPES = new Set(['review', 'audit', 'validation', 'readiness']);
  const ACTION_CLASS_TYPES = new Set(['action', 'milestone']);
  const EXEMPT_LANE_STATUSES = new Set(['gated', 'blocked', 'incubating', 'deferred']);
  const lanePhaseCounts = new Map<string, { reviewCount: number; actionCount: number; laneStatus: string; phaseLabel: string }>();
  executionArtifacts.forEach((block) => {
    const laneId = normalizeText(block?.laneId);
    const phaseLabel = normalizeText(block?.phaseLabel);
    if (!laneId || !phaseLabel) return;
    const key = `${laneId}::${phaseLabel}`;
    const laneStatus = String(block?.executionContext?.laneStatus || 'active').trim();
    const entry = lanePhaseCounts.get(key) || { reviewCount: 0, actionCount: 0, laneStatus, phaseLabel };
    if (REVIEW_CLASS_TYPES.has(String(block?.blockType))) entry.reviewCount += 1;
    if (ACTION_CLASS_TYPES.has(String(block?.blockType))) entry.actionCount += 1;
    lanePhaseCounts.set(key, entry);
  });
  lanePhaseCounts.forEach(({ reviewCount, actionCount, laneStatus, phaseLabel }) => {
    if (EXEMPT_LANE_STATUSES.has(laneStatus)) return;
    if (reviewCount + actionCount < 3) return;
    const phaseThreshold = phaseLabel === 'P1' ? 1.0 : phaseLabel === 'P2' ? 1.5 : 2.5;
    if (actionCount === 0 || reviewCount / Math.max(actionCount, 1) > phaseThreshold) {
      failureCodes.add('EXCESSIVE_REVIEW_AUDIT_RATIO');
      reasonCodes.add('EXCESSIVE_REVIEW_AUDIT_RATIO');
    }
  });

  // Mechanical Cadence Loop (Phase 6): a (lane, phase) that schedules 4+
  // consecutive review-class blocks with no action/milestone block between
  // them is looping reviews without artifact progression. Round-robin
  // generation that interleaves actions and reviews is exempt — the action
  // blocks are the upstream artifact the next review consumes.
  const blocksByLanePhase = new Map<string, PlanArtifact[]>();
  executionArtifacts.forEach((block) => {
    const laneId = normalizeText(block?.laneId);
    const phaseLabel = normalizeText(block?.phaseLabel);
    if (!laneId || !phaseLabel) return;
    const key = `${laneId}::${phaseLabel}`;
    const entry = blocksByLanePhase.get(key) || [];
    entry.push(block);
    blocksByLanePhase.set(key, entry);
  });
  outer: for (const sameLanePhaseBlocks of blocksByLanePhase.values()) {
    const sorted = sameLanePhaseBlocks
      .slice()
      .sort((a, b) => String(a?.dayKey || '').localeCompare(String(b?.dayKey || '')));
    let run = 0;
    for (const b of sorted) {
      const bt = String(b?.blockType);
      if (REVIEW_CLASS_TYPES.has(bt)) {
        run += 1;
        if (run >= 4) {
          failureCodes.add('MECHANICAL_CADENCE_LOOP');
          reasonCodes.add('MECHANICAL_CADENCE_LOOP');
          break outer;
        }
      } else if (ACTION_CLASS_TYPES.has(bt)) {
        run = 0;
      }
    }
  }

  // Active Cycle Rebasing (Phase 7): a plan evaluated on day X should not
  // silently schedule actionable blocks before X. Past-dated blocks must
  // either be flagged as historical/backfilled/imported (intentional backfill)
  // or the entire plan must declare allowsBackdatedStart. Without these
  // signals, the active cycle has either drifted off the real execution
  // timeline (STALE_ACTIVE_CYCLE_STATE) or started in the past without
  // confirmation (ACTIVE_CYCLE_STARTS_IN_PAST_WITHOUT_CONFIRMATION).
  if (evaluationDayKey && proposedBlocks.length > 0) {
    const stalePastBlocks = proposedBlocks.filter((b) => {
      const dayKey = normalizeText(b?.dayKey);
      if (!dayKey || dayKey >= evaluationDayKey) return false;
      return b?.isHistorical !== true && b?.isBackfilled !== true && b?.isImported !== true;
    });
    if (stalePastBlocks.length > 0) {
      failureCodes.add('STALE_ACTIVE_CYCLE_STATE');
      reasonCodes.add('STALE_ACTIVE_CYCLE_STATE');
    }
    const earliestProposedDayKey = proposedBlocks
      .map((b) => normalizeText(b?.dayKey))
      .filter((k) => k)
      .sort()[0];
    if (earliestProposedDayKey && earliestProposedDayKey < evaluationDayKey && !allowsBackdatedStart) {
      failureCodes.add('ACTIVE_CYCLE_STARTS_IN_PAST_WITHOUT_CONFIRMATION');
      reasonCodes.add('ACTIVE_CYCLE_STARTS_IN_PAST_WITHOUT_CONFIRMATION');
    }
  }

  // Dependency Chain Authenticity: execution blocks must reference a real downstream plan object.
  // consumedByRef is the machine-verifiable link; consumedBy is the human-readable label.
  // Only fires for full-horizon blocks that carry blockType — goal-level blocks are not checked here.
  const KNOWN_PHASE_LABELS = new Set(['P1', 'P2', 'P3']);
  const PHASE_ORDER: Record<string, number> = { P1: 1, P2: 2, P3: 3 };
  const VAGUE_REF_IDS = new Set(['plan', 'downstream', 'later', 'tbd', 'future', 'unknown', '']);
  const consumedByRefMissingBlockIds = new Set<string>();
  const consumedByRefUnresolvedBlockIds = new Set<string>();
  const consumedByRefNonDownstreamBlockIds = new Set<string>();

  executionArtifacts.forEach((block, index) => {
    const blockId = normalizeText(block?.id) || `block-${index + 1}`;
    if (isReviewClassBlock(block) || isNonExecutionOccupancyBlock(block)) return;
    if (!block?.blockType) return;
    const ref = block?.consumedByRef;
    const refId = normalizeText(ref?.id).toLowerCase();
    if (!ref || !refId || VAGUE_REF_IDS.has(refId)) {
      consumedByRefMissingBlockIds.add(blockId);
      failureCodes.add('MISSING_CONSUMED_BY_REF');
      reasonCodes.add('MISSING_CONSUMED_BY_REF');
      return;
    }
    if (ref.type === 'phaseObjective' && !KNOWN_PHASE_LABELS.has(normalizeText(ref.id).toUpperCase())) {
      consumedByRefUnresolvedBlockIds.add(blockId);
      failureCodes.add('UNRESOLVED_CONSUMED_BY_REF');
      reasonCodes.add('UNRESOLVED_CONSUMED_BY_REF');
      return;
    }
    if (ref.type === 'phaseObjective' && block?.phaseLabel) {
      const blockOrder = PHASE_ORDER[normalizeText(block.phaseLabel).toUpperCase()];
      const refOrder = PHASE_ORDER[normalizeText(ref.id).toUpperCase()];
      if (blockOrder && refOrder && refOrder <= blockOrder) {
        consumedByRefNonDownstreamBlockIds.add(blockId);
        failureCodes.add('NON_DOWNSTREAM_CONSUMED_BY_REF');
        reasonCodes.add('NON_DOWNSTREAM_CONSUMED_BY_REF');
      }
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

  const phaseWorkloadFinding = analyzePhaseWorkloadDistribution({
    executionArtifacts,
    temporalContext: input.temporalContext,
  });
  phaseWorkloadFinding?.failureCodes.forEach((code) => {
    failureCodes.add(code);
    reasonCodes.add(code);
  });

  const phaseObjectiveFinding = analyzePhaseObjectiveAuthenticity({
    phases: Array.isArray(input.phases) ? input.phases : [],
    executionArtifacts,
  });
  phaseObjectiveFinding?.failureCodes.forEach((code) => {
    failureCodes.add(code);
    reasonCodes.add(code);
  });

  const missionAlignmentFinding = analyzeMissionAlignment({
    phases: Array.isArray(input.phases) ? input.phases : [],
    missionContext: input.missionContext,
  });
  missionAlignmentFinding?.failureCodes.forEach((code) => {
    failureCodes.add(code);
    reasonCodes.add(code);
  });

  const laneContributionFinding = analyzeLaneContributionAuthenticity({
    lanes: input.lanes,
    executionArtifacts,
  });
  laneContributionFinding?.failureCodes.forEach((code) => {
    failureCodes.add(code);
    reasonCodes.add(code);
  });

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
      ...(substanceMissingBlockIds.size > 0 && { substanceMissingBlockIds: Array.from(substanceMissingBlockIds) }),
      ...(vagueArtifactBlockIds.size > 0 && { vagueArtifactBlockIds: Array.from(vagueArtifactBlockIds) }),
      ...(vagueEvidenceBlockIds.size > 0 && { vagueEvidenceBlockIds: Array.from(vagueEvidenceBlockIds) }),
      ...(fragmentaryBlockIds.size > 0 && { fragmentaryBlockIds: Array.from(fragmentaryBlockIds) }),
      ...(nonActionableBlockIds.size > 0 && { nonActionableBlockIds: Array.from(nonActionableBlockIds) }),
      ...(questionBlockIds.size > 0 && { questionBlockIds: Array.from(questionBlockIds) }),
      ...(consumedByRefMissingBlockIds.size > 0 && { consumedByRefMissingBlockIds: Array.from(consumedByRefMissingBlockIds) }),
      ...(consumedByRefUnresolvedBlockIds.size > 0 && { consumedByRefUnresolvedBlockIds: Array.from(consumedByRefUnresolvedBlockIds) }),
      ...(consumedByRefNonDownstreamBlockIds.size > 0 && { consumedByRefNonDownstreamBlockIds: Array.from(consumedByRefNonDownstreamBlockIds) }),
      ...(phaseWorkloadFinding?.phasesWithoutExecution?.length && {
        phasesWithoutExecution: phaseWorkloadFinding.phasesWithoutExecution,
      }),
      ...(phaseObjectiveFinding?.phasesWithMissingObjective?.length && {
        phasesWithMissingObjective: phaseObjectiveFinding.phasesWithMissingObjective,
      }),
      ...(phaseObjectiveFinding?.phasesWithVagueObjective?.length && {
        phasesWithVagueObjective: phaseObjectiveFinding.phasesWithVagueObjective,
      }),
      ...(phaseObjectiveFinding?.phasesWithMissingUnlockCriteria?.length && {
        phasesWithMissingUnlockCriteria: phaseObjectiveFinding.phasesWithMissingUnlockCriteria,
      }),
      ...(phaseObjectiveFinding?.phasesWithVagueUnlockCriteria?.length && {
        phasesWithVagueUnlockCriteria: phaseObjectiveFinding.phasesWithVagueUnlockCriteria,
      }),
      ...(phaseObjectiveFinding?.phasesWithoutSupportingBlocks?.length && {
        phasesWithoutSupportingBlocks: phaseObjectiveFinding.phasesWithoutSupportingBlocks,
      }),
      ...(missionAlignmentFinding?.misalignedPhases?.length && {
        phasesNotMissionAligned: missionAlignmentFinding.misalignedPhases,
      }),
      ...(laneContributionFinding?.lanesWithMissingOutcome?.length && {
        lanesWithMissingOutcome: laneContributionFinding.lanesWithMissingOutcome,
      }),
      ...(laneContributionFinding?.lanesWithVagueOutcome?.length && {
        lanesWithVagueOutcome: laneContributionFinding.lanesWithVagueOutcome,
      }),
      ...(laneContributionFinding?.lanesWithoutExecution?.length && {
        lanesWithoutExecution: laneContributionFinding.lanesWithoutExecution,
      }),
      ...(laneContributionFinding?.lanesWithoutSupport?.length && {
        lanesWithoutSupport: laneContributionFinding.lanesWithoutSupport,
      }),
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
