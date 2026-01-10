import { dayKeyFromISO } from '../time/time.ts';
import { computeFeasibility } from './feasibility.ts';

type WorkItem = {
  workItemId: string;
  title?: string;
  blocksRemaining: number;
  mustFinishByISO?: string;
  category: 'Body' | 'Resources' | 'Focus' | 'Creation';
  focusMode: 'deep' | 'shallow';
  energyCost: 'low' | 'medium' | 'high';
  producesOutput: boolean;
  unblockType?: 'resource' | 'dependency' | null;
  dependencies?: string[];
};

type Constraints = {
  timezone: string;
  maxBlocksPerDay?: number;
  maxHighEnergyBlocksPerDay?: number;
  maxDeepBlocksPerDay?: number;
  currentHighEnergyBlocksToday?: number;
  currentDeepBlocksToday?: number;
  blackoutDates?: string[];
  workableDayPolicy?: { weekdays?: Array<number | string> };
  dailyCapacityOverrides?: Record<string, number>;
  calendarCommittedBlocksByDate?: Record<string, number>;
  allowedFocusModes?: Array<'deep' | 'shallow'>;
  allowedCategories?: Array<WorkItem['category']>;
  preferredFocusMode?: 'deep' | 'shallow';
  cooldowns?: { resuggestMinutes?: number; maxSuggestionsPerDay?: number };
};

type GuidanceResult = {
  goalId: string;
  nowISO: string;
  status: 'PRIMARY' | 'NONE';
  primary: SelectedBlock | null;
  fallback: SelectedBlock | null;
  reasons: string[];
  debug?: {
    todayLocalDate: string;
    tieBreakChain: string[];
    candidatesConsidered: number;
  };
};

type SelectedBlock = {
  workItemId: string;
  title: string;
  estimatedMinutes?: number;
  category: WorkItem['category'];
  focusMode: WorkItem['focusMode'];
  energyCost: WorkItem['energyCost'];
  producesOutput: boolean;
  unblockType?: WorkItem['unblockType'];
  reasonCodes: string[];
};

const TIEBREAK_CHAIN = [
  'subdeadline',
  'critical_path',
  'creation_cadence',
  'constraint_fit',
  'low_context_switch',
  'stable_tiebreak'
];

export function selectGuidance(goal: { goalId: string; deadlineISO: string }, state: any, constraints: Constraints, nowISO: string): GuidanceResult {
  const timezone = constraints?.timezone || 'UTC';
  const todayLocalDate = dayKeyFromISO(nowISO, timezone);
  const workItems: WorkItem[] = (state?.goalWorkById && state.goalWorkById[goal.goalId]) || [];
  const remainingBlocksTotal = workItems.reduce((sum, item) => sum + Math.max(0, Number(item?.blocksRemaining) || 0), 0);

  if (!remainingBlocksTotal) {
    return emptyResult(goal.goalId, nowISO, ['GOAL_HAS_NO_REMAINING_WORK'], todayLocalDate);
  }
  if (goal.deadlineISO <= nowISO) {
    return emptyResult(goal.goalId, nowISO, ['DEADLINE_PASSED'], todayLocalDate);
  }

  const feasibility = computeFeasibility(goal, state, constraints, nowISO);
  if (feasibility.status === 'INFEASIBLE') {
    const recovery = pickRecoveryBlock(workItems, goal.deadlineISO, timezone);
    if (!recovery) {
      return emptyResult(goal.goalId, nowISO, ['GOAL_INFEASIBLE_ONLY_RECOVERY_ALLOWED', 'NO_CANDIDATES'], todayLocalDate);
    }
    return {
      goalId: goal.goalId,
      nowISO,
      status: 'PRIMARY',
      primary: recovery,
      fallback: null,
      reasons: ['GOAL_INFEASIBLE_ONLY_RECOVERY_ALLOWED'],
      debug: {
        todayLocalDate,
        tieBreakChain: TIEBREAK_CHAIN,
        candidatesConsidered: 1
      }
    };
  }

  if (feasibility.reasons.includes('TODAY_NOT_WORKABLE')) {
    return emptyResult(goal.goalId, nowISO, ['TODAY_NOT_WORKABLE'], todayLocalDate);
  }
  if (feasibility.reasons.includes('TODAY_CAPACITY_ZERO')) {
    return emptyResult(goal.goalId, nowISO, ['TODAY_CAPACITY_ZERO'], todayLocalDate);
  }

  const dependencyMap = new Map<string, string[]>();
  const itemsById = new Map(workItems.map((item) => [item.workItemId, item]));
  workItems.forEach((item) => {
    dependencyMap.set(item.workItemId, (item.dependencies || []).filter(Boolean));
  });

  const remainingItems = workItems.filter((item) => (Number(item.blocksRemaining) || 0) > 0);
  const dependencyBlocked = remainingItems.filter((item) => isBlockedByDependencies(item, itemsById) && !item.unblockType);
  const dependencyFree = remainingItems.filter((item) => !dependencyBlocked.includes(item) || item.unblockType);

  if (!dependencyFree.length) {
    return emptyResult(goal.goalId, nowISO, ['BLOCKED_BY_DEPENDENCIES'], todayLocalDate, dependencyMapHasCycle(dependencyMap));
  }

  const constraintFiltered = dependencyFree.filter((item) => passesConstraints(item, constraints));
  if (!constraintFiltered.length) {
    return emptyResult(goal.goalId, nowISO, ['CONSTRAINTS_FILTERED_ALL'], todayLocalDate);
  }

  const dailyLimitReached = isDailyLimitReached(state, goal.goalId, todayLocalDate, constraints);
  if (dailyLimitReached) {
    return emptyResult(goal.goalId, nowISO, ['DAILY_LIMIT_REACHED'], todayLocalDate);
  }

  const eligibilityMap = state?.directiveEligibilityByGoal;
  const eligibility = eligibilityMap?.[goal.goalId];
  if (!eligibilityMap || !eligibility) {
    return emptyResult(goal.goalId, nowISO, ['MISSING_ENGINE_ARTIFACT'], todayLocalDate);
  }
  if (!eligibility.allowed) {
    const reasons = eligibility.reasons?.length ? [...eligibility.reasons] : ['GOVERNANCE_DENIED_ALL'];
    if (!reasons.includes('GOVERNANCE_DENIED_ALL')) reasons.push('GOVERNANCE_DENIED_ALL');
    return emptyResult(goal.goalId, nowISO, reasons, todayLocalDate);
  }

  const cooldownMinutes = constraints?.cooldowns?.resuggestMinutes;
  const cooldownBlocked = constraintFiltered.filter((item) => !isCooldownActive(state, goal.goalId, item.workItemId, nowISO, cooldownMinutes));
  if (!cooldownBlocked.length) {
    return emptyResult(goal.goalId, nowISO, ['COOLDOWN_BLOCKED'], todayLocalDate);
  }

  const allowedCandidates = cooldownBlocked;

  const completedCreationToday = countCompletedByCategory(state, goal.goalId, todayLocalDate, 'Creation');
  const creationBehind = feasibility.status === 'REQUIRED' && completedCreationToday < 1;
  const dependentsCount = countDependents(allowedCandidates, dependencyMap);
  const lastContext = lastCompletedContext(state, goal.goalId, todayLocalDate);

  const ranked = [...allowedCandidates].sort((a, b) =>
    compareCandidates(a, b, goal.deadlineISO, timezone, creationBehind, dependentsCount, constraints, lastContext)
  );

  const primaryItem = ranked[0];
  const primary = buildSelectedBlock(primaryItem, goal.deadlineISO, timezone, creationBehind, dependentsCount, constraints, lastContext);

  const fallback = pickFallback(primaryItem, ranked.slice(1), constraints, goal.deadlineISO, timezone, creationBehind, dependentsCount, lastContext);

  return {
    goalId: goal.goalId,
    nowISO,
    status: 'PRIMARY',
    primary,
    fallback,
    reasons: ['OK'],
    debug: {
      todayLocalDate,
      tieBreakChain: TIEBREAK_CHAIN,
      candidatesConsidered: ranked.length
    }
  };
}

function emptyResult(goalId: string, nowISO: string, reasons: string[], todayLocalDate: string, hasCycle = false): GuidanceResult {
  const finalReasons = [...reasons];
  if (hasCycle && !finalReasons.includes('BLOCKED_BY_DEPENDENCIES')) finalReasons.push('BLOCKED_BY_DEPENDENCIES');
  return {
    goalId,
    nowISO,
    status: 'NONE',
    primary: null,
    fallback: null,
    reasons: finalReasons,
    debug: {
      todayLocalDate,
      tieBreakChain: TIEBREAK_CHAIN,
      candidatesConsidered: 0
    }
  };
}

function pickRecoveryBlock(items: WorkItem[], deadlineISO: string, timezone: string): SelectedBlock | null {
  const recovery = items
    .filter((item) => (Number(item.blocksRemaining) || 0) > 0)
    .filter((item) => item.unblockType || item.category === 'Body')
    .sort((a, b) => {
      const aKey = dayKeyFromISO(a.mustFinishByISO || deadlineISO, timezone);
      const bKey = dayKeyFromISO(b.mustFinishByISO || deadlineISO, timezone);
      if (aKey !== bKey) return aKey.localeCompare(bKey);
      return a.workItemId.localeCompare(b.workItemId);
    })[0];
  if (!recovery) return null;
  return {
    workItemId: recovery.workItemId,
    title: recovery.title || recovery.workItemId,
    category: recovery.category,
    focusMode: recovery.focusMode,
    energyCost: recovery.energyCost,
    producesOutput: recovery.producesOutput,
    unblockType: recovery.unblockType || null,
    reasonCodes: recovery.unblockType ? ['CRITICAL_PATH_UNBLOCK', 'STABLE_TIEBREAK'] : ['STABLE_TIEBREAK']
  };
}

function isBlockedByDependencies(item: WorkItem, itemsById: Map<string, WorkItem>) {
  const deps = item.dependencies || [];
  return deps.some((depId) => {
    const dep = itemsById.get(depId);
    return dep && (Number(dep.blocksRemaining) || 0) > 0;
  });
}

function passesConstraints(item: WorkItem, constraints: Constraints) {
  if (!item) return false;
  const allowedCategories = constraints?.allowedCategories;
  if (Array.isArray(allowedCategories) && allowedCategories.length && !allowedCategories.includes(item.category)) return false;
  const allowedFocusModes = constraints?.allowedFocusModes;
  if (Array.isArray(allowedFocusModes) && allowedFocusModes.length && !allowedFocusModes.includes(item.focusMode)) return false;
  if (item.energyCost === 'high' && typeof constraints?.maxHighEnergyBlocksPerDay === 'number') {
    const current = Number(constraints.currentHighEnergyBlocksToday || 0);
    if (current >= constraints.maxHighEnergyBlocksPerDay) return false;
  }
  if (item.focusMode === 'deep' && typeof constraints?.maxDeepBlocksPerDay === 'number') {
    const current = Number(constraints.currentDeepBlocksToday || 0);
    if (current >= constraints.maxDeepBlocksPerDay) return false;
  }
  return true;
}

function isDailyLimitReached(state: any, goalId: string, todayLocalDate: string, constraints: Constraints) {
  const limit = constraints?.cooldowns?.maxSuggestionsPerDay;
  if (!Number.isFinite(limit)) return false;
  const perGoal = state?.suggestionHistoryByGoal?.[goalId];
  if (perGoal?.dailyCountByDate?.[todayLocalDate] >= limit) return true;
  const count = state?.suggestionHistory?.dailyCountByGoal?.[goalId]?.[todayLocalDate] || 0;
  return count >= limit;
}

function isCooldownActive(state: any, goalId: string, workItemId: string, nowISO: string, cooldownMinutes?: number) {
  if (!Number.isFinite(cooldownMinutes) || cooldownMinutes <= 0) return false;
  const perGoal = state?.suggestionHistoryByGoal?.[goalId];
  const lastId = perGoal?.lastSuggestedWorkItemId;
  const lastISO = perGoal?.lastSuggestedAtISO;
  if (!lastId || lastId !== workItemId || !lastISO) return false;
  const lastMs = Date.parse(lastISO);
  const nowMs = Date.parse(nowISO);
  if (!Number.isFinite(lastMs) || !Number.isFinite(nowMs)) return false;
  return (nowMs - lastMs) / 60000 < cooldownMinutes;
}

function countCompletedByCategory(state: any, goalId: string, todayLocalDate: string, category: WorkItem['category']) {
  const events = state?.executionEvents || [];
  return events.filter((e: any) => e?.goalId === goalId && e?.completed && e?.dateISO === todayLocalDate && e?.domain === category).length;
}

function lastCompletedContext(state: any, goalId: string, todayLocalDate: string) {
  const events = state?.executionEvents || [];
  for (let i = events.length - 1; i >= 0; i -= 1) {
    const e = events[i];
    if (e?.goalId === goalId && e?.completed && e?.dateISO === todayLocalDate) {
      return { category: e.domain || null };
    }
  }
  return { category: null };
}

function countDependents(items: WorkItem[], dependencyMap: Map<string, string[]>) {
  const dependents: Record<string, number> = {};
  items.forEach((item) => {
    dependencyMap.forEach((deps, id) => {
      if (deps.includes(item.workItemId)) {
        dependents[item.workItemId] = (dependents[item.workItemId] || 0) + 1;
      }
    });
  });
  return dependents;
}

function compareCandidates(
  a: WorkItem,
  b: WorkItem,
  deadlineISO: string,
  timezone: string,
  creationBehind: boolean,
  dependents: Record<string, number>,
  constraints: Constraints,
  lastContext: { category: string | null }
) {
  const aDeadline = dayKeyFromISO(a.mustFinishByISO || deadlineISO, timezone);
  const bDeadline = dayKeyFromISO(b.mustFinishByISO || deadlineISO, timezone);
  if (aDeadline !== bDeadline) return aDeadline.localeCompare(bDeadline);

  const aUnblock = a.unblockType ? 0 : 1;
  const bUnblock = b.unblockType ? 0 : 1;
  if (aUnblock !== bUnblock) return aUnblock - bUnblock;

  const aDependents = dependents[a.workItemId] || 0;
  const bDependents = dependents[b.workItemId] || 0;
  if (aDependents !== bDependents) return bDependents - aDependents;

  const aCreation = creationBehind && a.category === 'Creation' && a.producesOutput ? 0 : 1;
  const bCreation = creationBehind && b.category === 'Creation' && b.producesOutput ? 0 : 1;
  if (aCreation !== bCreation) return aCreation - bCreation;

  const preferred = constraints?.preferredFocusMode;
  if (preferred) {
    const aFit = a.focusMode === preferred ? 0 : 1;
    const bFit = b.focusMode === preferred ? 0 : 1;
    if (aFit !== bFit) return aFit - bFit;
  }

  if (lastContext?.category) {
    const aContext = a.category === lastContext.category ? 0 : 1;
    const bContext = b.category === lastContext.category ? 0 : 1;
    if (aContext !== bContext) return aContext - bContext;
  }

  if (a.workItemId !== b.workItemId) return a.workItemId.localeCompare(b.workItemId);
  const aTitle = a.title || '';
  const bTitle = b.title || '';
  return aTitle.localeCompare(bTitle);
}

function buildSelectedBlock(
  item: WorkItem,
  deadlineISO: string,
  timezone: string,
  creationBehind: boolean,
  dependents: Record<string, number>,
  constraints: Constraints,
  lastContext: { category: string | null }
): SelectedBlock {
  const reasons: string[] = [];
  const deadlineKey = dayKeyFromISO(item.mustFinishByISO || deadlineISO, timezone);
  if (item.mustFinishByISO && deadlineKey) reasons.push('SUBDEADLINE_SOON');
  if (item.unblockType || (dependents[item.workItemId] || 0) > 0) reasons.push('CRITICAL_PATH_UNBLOCK');
  if (creationBehind && item.category === 'Creation' && item.producesOutput) reasons.push('CREATION_CADENCE_BEHIND');
  if (constraints?.preferredFocusMode && item.focusMode === constraints.preferredFocusMode) reasons.push('BEST_CONSTRAINT_FIT');
  if (lastContext?.category && item.category === lastContext.category) reasons.push('LOW_CONTEXT_SWITCH');
  reasons.push('STABLE_TIEBREAK');

  return {
    workItemId: item.workItemId,
    title: item.title || item.workItemId,
    category: item.category,
    focusMode: item.focusMode,
    energyCost: item.energyCost,
    producesOutput: item.producesOutput,
    unblockType: item.unblockType || null,
    reasonCodes: reasons
  };
}

function pickFallback(
  primary: WorkItem,
  remaining: WorkItem[],
  constraints: Constraints,
  deadlineISO: string,
  timezone: string,
  creationBehind: boolean,
  dependents: Record<string, number>,
  lastContext: { category: string | null }
) {
  if (!remaining.length) return null;
  const preferSameFocus = remaining.filter((item) => item.focusMode === primary.focusMode);
  const pool = preferSameFocus.length ? preferSameFocus : remaining;
  const ranked = [...pool].sort((a, b) =>
    compareCandidates(a, b, deadlineISO, timezone, creationBehind, dependents, constraints, lastContext)
  );
  if (!ranked.length) return null;
  return buildSelectedBlock(ranked[0], deadlineISO, timezone, creationBehind, dependents, constraints, lastContext);
}

function dependencyMapHasCycle(dependencyMap: Map<string, string[]>) {
  const visited = new Set<string>();
  const stack = new Set<string>();
  let hasCycle = false;
  const visit = (node: string) => {
    if (stack.has(node)) {
      hasCycle = true;
      return;
    }
    if (visited.has(node)) return;
    visited.add(node);
    stack.add(node);
    const deps = dependencyMap.get(node) || [];
    deps.forEach((dep) => visit(dep));
    stack.delete(node);
  };
  dependencyMap.forEach((_deps, node) => {
    visit(node);
  });
  return hasCycle;
}
