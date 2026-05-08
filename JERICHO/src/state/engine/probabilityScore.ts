import { addDays, dayKeyFromISO } from '../time/time.ts';
import { computeFeasibility } from './feasibility.ts';
import { derivePlanProof } from './planProof.ts';
import { deriveProbabilityStatus } from '../contracts/probabilityEligibility.ts';
import { getProbabilityWindowSpec } from './probabilityWindow.ts';

export const EXTERNALLY_MEDIATED_PROVISIONAL_QUALIFIER =
  'Reflects execution quality of preparation activities. External response evidence not yet received.';

type Constraints = {
  timezone: string;
  maxBlocksPerDay?: number;
  maxBlocksPerWeek?: number;
  workableDayPolicy?: { weekdays?: Array<number | string> };
  blackoutDates?: string[];
  dailyCapacityOverrides?: Record<string, number>;
  calendarCommittedBlocksByDate?: Record<string, number>;
  scoringWindowDays?: number;
};

export type TrustState = 'withheld' | 'provisional' | 'trusted';

export type PosDisplayPolicy = {
  showScore: boolean;
  displayValue: string;
  qualifierText: string | null;
  trustBand: TrustState | 'unknown';
};

/**
 * Pure display-policy selector. Maps trust state → rendering intent.
 * - withheld: suppress numeric confidence; show '—'
 * - provisional: show capped score + qualifier text if present
 * - trusted: show full live score; no qualifier
 * - null: preserve legacy pre-trust-state rendering behavior
 *
 * @param posTrustState - current trust state, or null if not yet computed
 * @param posValuePct   - score as integer percentage (0–100), or null if unavailable
 * @param posQualifier  - optional qualifier string (set by externally-mediated provisional path)
 */
export function derivePosDisplayPolicy(
  posTrustState: TrustState | null,
  posValuePct: number | null,
  posQualifier?: string | null
): PosDisplayPolicy {
  const pct = posValuePct !== null && Number.isFinite(posValuePct) ? `${posValuePct}%` : '—';
  const hasScore = posValuePct !== null && Number.isFinite(posValuePct);

  if (posTrustState === 'withheld') {
    return { showScore: false, displayValue: '—', qualifierText: null, trustBand: 'withheld' };
  }
  if (posTrustState === 'provisional') {
    return {
      showScore: hasScore,
      displayValue: pct,
      qualifierText: posQualifier ?? null,
      trustBand: 'provisional',
    };
  }
  if (posTrustState === 'trusted') {
    return { showScore: hasScore, displayValue: pct, qualifierText: null, trustBand: 'trusted' };
  }
  // null / not yet computed — preserve legacy behavior
  return { showScore: hasScore, displayValue: pct, qualifierText: null, trustBand: 'unknown' };
}

export type EligibilityStatus = 'disabled' | 'insufficient_evidence' | 'computed';

export type FamilyClass = 'internally_controlled' | 'externally_mediated';

// Qualifying external evidence stages per archetype.
// Only third-party-initiated responses count. User preparation actions do not.
const QUALIFYING_EXTERNAL_STAGES: Record<string, Set<string>> = {
  JobSearchPipeline: new Set(['recruiter_reply', 'interview_invite', 'screening_scheduled', 'offer_received']),
  SalesPipeline: new Set(['qualified_response', 'discovery_call_booked', 'proposal_requested', 'deal_advanced']),
  Fundraising: new Set(['investor_reply', 'meeting_booked', 'diligence_request', 'commitment_received']),
};

type ProbabilityResult = {
  value: number | null;
  status: 'INFEASIBLE' | 'UNSCHEDULABLE' | 'ELIGIBLE' | 'INELIGIBLE' | 'NO_EVIDENCE';
  trustState: TrustState;
  eligibilityStatus: EligibilityStatus;
  capApplied: boolean;
  reasons: string[];
  requiredEvents: number | null;
  proof: {
    inputs: any;
    derived: any;
    policyVersion: string;
  };
  qualifier?: string;
  evidenceSummary?: {
    totalEvents: number;
    completedCount: number;
    daysCovered: number;
  };
  scoringSummary?: {
    mu: number;
    sigma: number;
    K: number;
    D: number;
    remainingBlocksTotal: number;
    requiredBlocksPerDay: number | null;
    expectedTotal: number;
  };
};

export function deriveTrustState(
  scoringStatus: ProbabilityResult['status'],
  eligibilityStatus: EligibilityStatus,
  options?: {
    familyClass?: FamilyClass;
    qualifyingExternalEvidenceCount?: number;
    // Canonical authority class from terminalOutcomeAuthority detector.
    // When provided, takes precedence over familyClass for ceiling enforcement.
    outcomeAuthorityClass?: 'fully_controllable' | 'externally_mediated' | 'market_dependent' | 'mixed' | 'unknown' | null;
  }
): TrustState {
  if (scoringStatus === 'INFEASIBLE') return 'withheld';
  if (eligibilityStatus === 'disabled') return 'withheld';
  if (eligibilityStatus === 'insufficient_evidence') return 'withheld';
  if (scoringStatus === 'ELIGIBLE') {
    // Resolve effective authority: canonical outcomeAuthorityClass takes precedence over familyClass.
    // familyClass is a raw archetype-level field; outcomeAuthorityClass is the frozen detector result.
    const canonicalAuthority = options?.outcomeAuthorityClass ?? null;
    const effectivelyExternallyMediated =
      canonicalAuthority === 'externally_mediated' ||
      canonicalAuthority === 'mixed' ||
      // Fall back to familyClass only when canonical authority is absent
      (canonicalAuthority === null && options?.familyClass === 'externally_mediated');
    // Externally-mediated goals require at least one qualifying external evidence event to be trusted.
    if (effectivelyExternallyMediated && (options?.qualifyingExternalEvidenceCount ?? 0) === 0) {
      return 'provisional';
    }
    return 'trusted';
  }
  return 'provisional';
}

const WEEKDAY_MAP: Record<string, number> = {
  sun: 0,
  mon: 1,
  tue: 2,
  wed: 3,
  thu: 4,
  fri: 5,
  sat: 6,
};

export function scoreGoalSuccessProbability(
  goalId: string,
  state: any,
  constraints: Constraints,
  nowISO: string
): ProbabilityResult {
  const contracts = collectContracts(state);
  const eligibility = deriveProbabilityStatus({
    goalId,
    nowISO,
    executionEventCount: (state?.executionEvents || []).length,
    executionEvents: state?.executionEvents || [],
    contracts,
  });

  const policyVersion = 'probability_v2';
  const goalDeadlineISO = resolveGoalDeadline(goalId, state);
  const feasibility = computeFeasibility(
    { goalId, deadlineISO: goalDeadlineISO || nowISO },
    state,
    constraints,
    nowISO
  );

  if (feasibility.status === 'INFEASIBLE' || feasibility.workableDaysRemaining <= 0) {
    return {
      value: 0,
      status: 'INFEASIBLE',
      trustState: 'withheld',
      eligibilityStatus: eligibility.status,
      capApplied: false,
      reasons: feasibility.status === 'INFEASIBLE' ? ['INFEASIBLE'] : ['NO_WORKABLE_DAYS'],
      requiredEvents: eligibility.requiredEvents,
      evidenceSummary: eligibility.evidenceSummary,
      proof: {
        inputs: { goalId, deadlineISO: goalDeadlineISO || nowISO },
        derived: { feasibility },
        policyVersion,
      },
    };
  }

  const timezone = constraints?.timezone || 'UTC';
  const activeContract = resolveActiveGoalExecutionContract(goalId, state);
  const planProof = resolvePlanProof(goalId, state, constraints, nowISO);
  const initial = deriveInitialProbability(goalId, planProof, constraints, policyVersion);

  if (eligibility.status !== 'computed') {
    const nonComputedStatus = initial.status === 'NO_EVIDENCE' ? 'NO_EVIDENCE' : initial.status;
    return {
      ...initial,
      status: nonComputedStatus,
      trustState: deriveTrustState(nonComputedStatus, eligibility.status),
      eligibilityStatus: eligibility.status,
      reasons: [...new Set([...initial.reasons, ...(eligibility.reasons || [])])],
      requiredEvents: eligibility.requiredEvents,
      evidenceSummary: eligibility.evidenceSummary,
    };
  }

  const windowSpec = getProbabilityWindowSpec({
    activeContract,
    nowISO,
    timeZone: timezone,
    ...(constraints?.scoringWindowDays !== undefined && { scoringWindowDays: constraints.scoringWindowDays }),
  });
  const dayKeys =
    windowSpec.mode === 'cycle_to_date'
      ? collectWorkableDaysInRange(windowSpec.startDayKey, windowSpec.endDayKey, timezone, constraints)
      : collectRecentWorkableDays(nowISO, timezone, constraints, windowSpec.windowDays || 14);
  const throughput = computeCompletedThroughput({
    events: state?.executionEvents || [],
    goalId,
    cycleId: resolveCycleForGoal(goalId, state)?.id || null,
    dayKeys,
  });
  const evidenceDays = Object.keys(throughput.completedBlocksByDay || {}).length;
  const hasEvidence = throughput.completedBlocksTotal > 0;
  const series = dayKeys.map((dayKey) => throughput.completedBlocksByDay[dayKey] || 0);

  const mu = mean(series);
  const sigma = stddev(series);
  const D = feasibility.workableDaysRemaining;
  const remainingBlocksTotal = feasibility.remainingBlocksTotal;
  const requiredBlocksPerDay = feasibility.requiredBlocksPerDay;

  let value: number;
  if (sigma === 0) {
    value = D * mu >= remainingBlocksTotal ? 1 : 0;
  } else {
    const meanTotal = D * mu;
    const stdTotal = Math.sqrt(D) * sigma;
    const z = (remainingBlocksTotal - meanTotal) / stdTotal;
    value = 1 - normalCdf(z);
    value = clamp01(value);
  }

  const minEvidenceDays = 7;
  const allowAboveCap = evidenceDays >= minEvidenceDays;
  const combined = allowAboveCap ? clamp01((value + (initial.value ?? 0)) / 2) : Math.min(value, 0.65);
  const evidenceStatus = !hasEvidence ? 'NO_EVIDENCE' : evidenceDays < minEvidenceDays ? 'INELIGIBLE' : 'ELIGIBLE';

  // Wave 2: family-aware trust derivation
  const familyInfo = resolveGoalFamilyInfo(goalId, state);
  const isExternallyMediated = familyInfo.familyClass === 'externally_mediated';
  const qualifyingExternalCount =
    isExternallyMediated && familyInfo.archetype
      ? countQualifyingExternalEvidenceEvents(goalId, state, familyInfo.archetype, nowISO)
      : 0;
  const familyAwareTrustState = deriveTrustState(evidenceStatus, eligibility.status, {
    familyClass: isExternallyMediated ? 'externally_mediated' : 'internally_controlled',
    qualifyingExternalEvidenceCount: qualifyingExternalCount,
  });
  // Qualifier: set only when externally mediated + provisional due to missing external evidence
  const qualifier =
    isExternallyMediated && familyAwareTrustState === 'provisional'
      ? EXTERNALLY_MEDIATED_PROVISIONAL_QUALIFIER
      : undefined;

  // Cap invariant: value ≤ 0.65 must hold for any provisional trust state.
  // This applies even when evidenceDays >= 7 but the external evidence gate blocks trusted.
  const finalValue = familyAwareTrustState === 'provisional' ? Math.min(combined, 0.65) : combined;
  const extGateCapped = familyAwareTrustState === 'provisional' && allowAboveCap && combined > 0.65;
  const finalCapApplied = (!allowAboveCap && combined <= 0.65) || extGateCapped;
  const finalReasons = extGateCapped
    ? ['CAP_APPLIED_EXTERNALLY_MEDIATED']
    : allowAboveCap
      ? []
      : ['CAP_APPLIED_NO_EVIDENCE'];

  const baseReport: ProbabilityResult = {
    value: finalValue,
    status: evidenceStatus,
    trustState: familyAwareTrustState,
    eligibilityStatus: eligibility.status,
    ...(qualifier !== undefined && { qualifier }),
    capApplied: finalCapApplied,
    reasons: finalReasons,
    requiredEvents: eligibility.requiredEvents,
    evidenceSummary: eligibility.evidenceSummary,
    proof: {
      inputs: { goalId, windowSpec, planProof },
      derived: { feasibility, evidenceDays, evidenceValue: value, initial },
      policyVersion,
    },
    scoringSummary: {
      mu,
      sigma,
      K: series.length,
      D,
      remainingBlocksTotal,
      requiredBlocksPerDay,
      expectedTotal: D * mu,
    },
  };

  const autoAsanaPlan = resolveAutoAsanaPlan(goalId, state);
  if (autoAsanaPlan?.conflicts?.length) {
    return {
      ...baseReport,
      status: 'UNSCHEDULABLE',
      trustState: 'provisional',
      value: baseReport.value !== null ? clamp01(baseReport.value * 0.8) : null,
      reasons: [
        ...baseReport.reasons,
        ...autoAsanaPlan.conflicts.map((c: any) => `UNSCHEDULABLE_${c.kind || 'CONFLICT'}`),
      ],
    };
  }

  return baseReport;
}

function collectContracts(state: any) {
  const cycleId = state?.activeCycleId || null;
  if (!cycleId) {
    return Object.values(state?.cyclesById || {})
      .map((cycle: any) => cycle?.goalGovernanceContract)
      .filter((contract: any) => contract?.goalId);
  }
  const cycle = state?.cyclesById?.[cycleId] || null;
  if (!cycle) return [];
  const contract = cycle?.goalGovernanceContract || null;

  const canonical = cycle?.goalContract || state?.goalExecutionContract || cycle?.contract || null;
  const goalId = canonical?.goalId || null;
  if (contract?.goalId) {
    if (goalId && contract.goalId !== goalId) {
      return [{ ...contract, goalId }];
    }
    return [contract];
  }
  if (!goalId) return [];
  if (contract) return [{ ...contract, goalId }];

  const timezone = canonical?.timezone || state?.appTime?.timeZone || 'UTC';
  return [
    {
      contractId: `gov-synth-${cycleId}`,
      version: 1,
      goalId,
      activeFromISO:
        canonical?.startDayKey || state?.appTime?.activeDayKey || dayKeyFromISO(state?.appTime?.nowISO || '', timezone),
      activeUntilISO: canonical?.endDayKey || canonical?.deadline?.dayKey || null,
      scope: {
        domainsAllowed: [],
        timeHorizon: 'week',
        timezone,
      },
      governance: {
        suggestionsEnabled: true,
        probabilityEnabled: true,
        minEvidenceEvents: 1,
      },
      constraints: {
        forbiddenDirectives: ['repair'],
        maxActiveBlocks: 6,
      },
    },
  ];
}

function resolveActiveGoalExecutionContract(goalId: string, state: any) {
  const cycle = resolveCycleForGoal(goalId, state);
  if (cycle?.goalContract?.goalId === goalId) return cycle.goalContract;
  const root = state?.goalExecutionContract;
  if (root?.goalId && root.goalId === goalId) return root;
  return null;
}

function resolveGoalDeadline(goalId: string, state: any) {
  const cycle = resolveCycleForGoal(goalId, state);
  if (!cycle) return null;
  return cycle?.goalContract?.endDayKey || cycle?.definiteGoal?.deadlineDayKey || null;
}

function resolvePlanProof(goalId: string, state: any, constraints: Constraints, nowISO: string) {
  const cycle = resolveCycleForGoal(goalId, state);
  if (cycle?.goalPlan?.planProof) return cycle.goalPlan.planProof;
  if (cycle?.goalEquation) {
    return derivePlanProof(cycle.goalEquation, {
      nowDayKey: state?.appTime?.activeDayKey,
      timeZone: constraints?.timezone,
    });
  }
  const fallbackMax = Number.isFinite(constraints?.maxBlocksPerDay) ? Number(constraints?.maxBlocksPerDay) : 0;
  const maxPerDay = Math.max(0, fallbackMax);
  const maxPerWeek = Number.isFinite(constraints?.maxBlocksPerWeek)
    ? Number(constraints?.maxBlocksPerWeek)
    : maxPerDay * 7;
  return {
    workableDaysRemaining: feasibilityDaysFromState(goalId, state, constraints, nowISO),
    totalRequiredUnits: 0,
    requiredPacePerDay: 0,
    maxPerDay,
    maxPerWeek,
    slackUnits: 0,
    slackRatio: 0,
    intensityRatio: 0,
    feasibilityStatus: 'FEASIBLE',
    feasibilityReasons: [],
  };
}

function feasibilityDaysFromState(goalId: string, state: any, constraints: Constraints, nowISO: string) {
  const deadlineISO = resolveGoalDeadline(goalId, state) || nowISO;
  const feasibility = computeFeasibility({ goalId, deadlineISO }, state, constraints, nowISO);
  return feasibility.workableDaysRemaining || 0;
}

function resolveAutoAsanaPlan(goalId: string, state: any) {
  const cycle = resolveCycleForGoal(goalId, state);
  if (!cycle || cycle?.goalContract?.goalId !== goalId) return null;
  return cycle.autoAsanaPlan || null;
}

function resolveGoalFamilyInfo(goalId: string, state: any): { familyClass: string | null; archetype: string | null } {
  const cycle = resolveCycleForGoal(goalId, state);
  const contract = cycle?.goalContract || null;
  return {
    familyClass: contract?.familyClass || null,
    archetype: contract?.archetype || contract?.archetypeId || null,
  };
}

// External evidence recency window: 30 days. Events older than this do not count.
const EXTERNAL_EVIDENCE_RECENCY_DAYS = 30;

function countQualifyingExternalEvidenceEvents(goalId: string, state: any, archetype: string, nowISO: string): number {
  const events: any[] = state?.externalEvidenceEvents || [];
  const qualifyingStages = QUALIFYING_EXTERNAL_STAGES[archetype] || new Set<string>();
  const nowDate = new Date(nowISO);
  const cutoffDate = new Date(nowDate.getTime() - EXTERNAL_EVIDENCE_RECENCY_DAYS * 24 * 60 * 60 * 1000);
  const cutoffKey = cutoffDate.toISOString().slice(0, 10);
  return events.filter((ev) => {
    if (!ev || ev.goalId !== goalId) return false;
    if (!ev.confirmed) return false;
    if (!qualifyingStages.has(ev.stage)) return false;
    if (!ev.dateISO || ev.dateISO < cutoffKey) return false;
    return true;
  }).length;
}

function resolveCycleForGoal(goalId: string, state: any) {
  const activeCycle = state?.activeCycleId ? state?.cyclesById?.[state.activeCycleId] : null;
  if (activeCycle?.goalContract?.goalId === goalId || activeCycle?.goalGovernanceContract?.goalId === goalId) {
    return activeCycle;
  }
  const cycles = Object.values(state?.cyclesById || {}) as any[];
  return (
    cycles.find((cycle) => cycle?.goalContract?.goalId === goalId) ||
    cycles.find((cycle) => cycle?.goalGovernanceContract?.goalId === goalId) ||
    null
  );
}

function deriveInitialProbability(
  goalId: string,
  planProof: any,
  constraints: Constraints,
  policyVersion: string
): ProbabilityResult {
  const reasons: string[] = [];
  if (planProof?.feasibilityStatus === 'INFEASIBLE') {
    return {
      value: 0,
      status: 'INFEASIBLE',
      trustState: 'withheld',
      eligibilityStatus: 'computed',
      capApplied: false,
      reasons: planProof?.feasibilityReasons?.length ? planProof.feasibilityReasons : ['INFEASIBLE'],
      requiredEvents: 0,
      evidenceSummary: { totalEvents: 0, completedCount: 0, daysCovered: 0 },
      proof: {
        inputs: { goalId, planProof, constraints },
        derived: {},
        policyVersion,
      },
    };
  }

  const intensityRatio = clamp01(planProof?.intensityRatio ?? 0);
  const slackRatio = clamp01(planProof?.slackRatio ?? 0);
  const constraintDensity = clamp01(constraintDensityScore(constraints));
  const slackPenalty = clamp01(1 - slackRatio);
  const intensityPenalty = intensityRatio;
  const base = clamp01(1 - (0.45 * intensityPenalty + 0.35 * slackPenalty + 0.2 * constraintDensity));
  const capped = Math.min(base, 0.65);
  if (base > capped) reasons.push('CAP_APPLIED_NO_EVIDENCE');

  return {
    value: capped,
    status: 'NO_EVIDENCE',
    trustState: 'provisional',
    eligibilityStatus: 'computed',
    capApplied: base > capped,
    reasons,
    requiredEvents: 0,
    evidenceSummary: { totalEvents: 0, completedCount: 0, daysCovered: 0 },
    proof: {
      inputs: { goalId, planProof, constraints },
      derived: { base, intensityRatio, slackRatio, constraintDensity },
      policyVersion,
    },
  };
}

function constraintDensityScore(constraints: Constraints) {
  if (!constraints) return 0;
  let count = 0;
  if (Number.isFinite(constraints.maxBlocksPerDay) && (constraints.maxBlocksPerDay || 0) > 0) count += 1;
  if (Number.isFinite(constraints.maxBlocksPerWeek) && (constraints.maxBlocksPerWeek || 0) > 0) count += 1;
  if (constraints.blackoutDates?.length) count += 1;
  if (constraints.workableDayPolicy?.weekdays?.length) count += 1;
  if (constraints.dailyCapacityOverrides && Object.keys(constraints.dailyCapacityOverrides).length) count += 1;
  return count / 5;
}

function collectRecentWorkableDays(nowISO: string, timezone: string, constraints: Constraints, count: number) {
  const days: string[] = [];
  let cursor = dayKeyFromISO(nowISO, timezone);
  while (days.length < count) {
    if (isWorkableDate(cursor, constraints, timezone)) days.push(cursor);
    cursor = addDays(cursor, -1, timezone);
    if (!cursor) break;
  }
  return days;
}

function collectWorkableDaysInRange(
  startDayKey: string,
  endDayKey: string,
  timezone: string,
  constraints: Constraints
) {
  if (!startDayKey || !endDayKey) return [];
  const days: string[] = [];
  let cursor = endDayKey;
  let guard = 0;
  while (cursor >= startDayKey && guard < 10000) {
    if (isWorkableDate(cursor, constraints, timezone)) days.push(cursor);
    const next = addDays(cursor, -1, timezone);
    if (!next || next === cursor) break;
    cursor = next;
    guard += 1;
  }
  return days;
}

type ThroughputResult = {
  completedMinutesTotal: number;
  completedBlocksTotal: number;
  completedMinutesByDay: Record<string, number>;
  completedBlocksByDay: Record<string, number>;
};

// Probability evidence = completed execution only. Planning churn is ignored here by design.
export function computeCompletedThroughput({
  events,
  goalId,
  cycleId = null,
  dayKeys,
}: {
  events: Array<{
    goalId?: string;
    cycleId?: string;
    dateISO?: string;
    completed?: boolean;
    kind?: string;
    minutes?: number;
  }>;
  goalId: string;
  cycleId?: string | null;
  dayKeys: string[];
}): ThroughputResult {
  const completedMinutesByDay: Record<string, number> = {};
  const completedBlocksByDay: Record<string, number> = {};
  const allowedDays = new Set(dayKeys || []);

  (events || []).forEach((event) => {
    if (!event) return;
    const goalMatches = Boolean(event.goalId && event.goalId === goalId);
    const cycleMatches = Boolean(cycleId && event.cycleId && event.cycleId === cycleId);
    if (!goalMatches && !cycleMatches) return;
    if (!event.completed) return;
    const normalizedKind = String(event.kind || '')
      .trim()
      .toLowerCase();
    if (normalizedKind && !['complete', 'create', 'update'].includes(normalizedKind)) return;
    if (!event.dateISO || !allowedDays.has(event.dateISO)) return;
    const minutes = Number.isFinite(event.minutes) ? Math.max(0, Math.round(event.minutes || 0)) : 0;
    completedMinutesByDay[event.dateISO] = (completedMinutesByDay[event.dateISO] || 0) + minutes;
    completedBlocksByDay[event.dateISO] = (completedBlocksByDay[event.dateISO] || 0) + 1;
  });

  const completedMinutesTotal = Object.values(completedMinutesByDay).reduce((sum, v) => sum + (v || 0), 0);
  const completedBlocksTotal = Object.values(completedBlocksByDay).reduce((sum, v) => sum + (v || 0), 0);

  return {
    completedMinutesTotal,
    completedBlocksTotal,
    completedMinutesByDay,
    completedBlocksByDay,
  };
}

function mean(values: number[]) {
  if (!values.length) return 0;
  const sum = values.reduce((acc, v) => acc + v, 0);
  return sum / values.length;
}

function stddev(values: number[]) {
  if (!values.length) return 0;
  const mu = mean(values);
  const variance = values.reduce((acc, v) => acc + Math.pow(v - mu, 2), 0) / values.length;
  return Math.sqrt(variance);
}

function normalCdf(z: number) {
  return 0.5 * (1 + erf(z / Math.SQRT2));
}

function erf(x: number) {
  const sign = x >= 0 ? 1 : -1;
  const abs = Math.abs(x);
  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const p = 0.3275911;
  const t = 1 / (1 + p * abs);
  const y = 1 - ((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t * Math.exp(-abs * abs);
  return sign * y;
}

function clamp01(value: number) {
  if (!Number.isFinite(value)) return 0;
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}

function isWorkableDate(dateKey: string, constraints: Constraints, timezone: string) {
  if (!dateKey) return false;
  const blackout = new Set(constraints?.blackoutDates || []);
  if (blackout.has(dateKey)) return false;
  const weekdays = normalizeWeekdays(constraints?.workableDayPolicy?.weekdays);
  if (!weekdays) return true;
  const weekday = weekdayIndex(dateKey, timezone);
  return weekdays.includes(weekday);
}

function normalizeWeekdays(weekdays?: Array<number | string>) {
  if (!weekdays || !weekdays.length) return null;
  const out: number[] = [];
  weekdays.forEach((d) => {
    if (typeof d === 'number' && d >= 0 && d <= 6) out.push(d);
    if (typeof d === 'string') {
      const key = d.slice(0, 3).toLowerCase();
      const mapped = WEEKDAY_MAP[key];
      if (mapped !== undefined) out.push(mapped);
    }
  });
  return Array.from(new Set(out));
}

function weekdayIndex(dateKey: string, timezone: string) {
  const parts = dateKey.split('-').map(Number);
  const y = parts[0] ?? 0;
  const m = parts[1] ?? 1;
  const d = parts[2] ?? 1;
  const dt = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
  const day = new Intl.DateTimeFormat('en-US', { timeZone: timezone, weekday: 'short' }).format(dt);
  const key = day.slice(0, 3).toLowerCase();
  return WEEKDAY_MAP[key] ?? 0;
}
