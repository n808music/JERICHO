import { dayKeyFromISO } from '../state/time/time.ts';
import { computePrescriptions, type PrescriptionsBundle } from '../domain/prescriptions.ts';
import { scoreSchedule } from '../planner/scoring/scoreSchedule.ts';
import type { StressAction, StressScenarioFixture } from './fixturesLoader.ts';

export type PlacementLike = {
  id?: string;
  actionId?: string | null;
  dayKey?: string;
  dateISO?: string;
  startISO?: string;
  endISO?: string;
  start?: string;
  end?: string;
  minutes?: number;
  durationMin?: number;
};

export type StressMetrics = {
  actionCount: number;
  dependencyDepthMax: number;
  horizonDays: number;
  placedBlockCount: number;
  unplacedActionCount: number;
  unplacedEstimateMinTotal: number;
  unplacedEstimateMinByCategory: Record<string, number>;
  totalScheduledMinutes: number;
  scheduleTruthRatio: number;
  scheduleCoverageRatio: number;
  dailyLoadStats: { min: number; avg: number; max: number };
  churnIndex: number;
  preservedChunkCount: number;
  movedChunkCount: number;
  droppedChunkCount: number;
  churnMovedMinutesTotal: number;
  churnReasonsCount: Record<string, number>;
  prescriptionsCount: number;
  prescriptionsPrimaryConstraint: PrescriptionsBundle['primaryConstraint'];
  prescriptionsCodes: string[];
  depViolations: number;
  depCheckCoverage: { checkedActions: number; eligibleActions: number };
  milestoneAnchoringScore: {
    score: number;
    total: number;
    anchored: number;
    missingMilestoneIds: string[];
    missingCheckpointActionIds: string[];
  };
  milestoneWindowMissCount: number;
  placementAnchoringMissCount: number;
  anchoringMissDelta: number;
  depWindowBlockedCount: number;
  depWindowBlockedByMilestone: Record<string, number>;
  depBufferBlockedCount: number;
  depBufferBlockedByMilestone: Record<string, number>;
  outsideExecutionHorizonCount: number;
  outsideExecutionHorizonEstimateMinTotal: number;
  qualityScoreTotal: number;
  qualityScoreByComponent: {
    deadlineRisk: number;
    milestoneRisk: number;
    dependencyRisk: number;
    contextSwitching: number;
    loadSmoothness: number;
    deferralPenalty: number;
  };
  qualityScorePreview: number;
  qualityScoreApplied: number;
  qualityScoreParity: boolean;
  contextSwitchCount: number;
  dailyLoadStdDev: number;
  milestoneAtRiskCount: number;
  depTightCount: number;
  milestonePlacedRatio: {
    min: number;
    avg: number;
    byMilestone: Record<string, number>;
  };
  milestoneWindowSlack: {
    slackRatioMin: number;
    slackRatioAvg: number;
    infeasibleMilestonesCount: number;
    byMilestone: Record<
      string,
      {
        requiredCriticalMinutes: number;
        availableWindowMinutes: number;
        slackMinutes: number;
        slackRatio: number;
        criticalActionCount: number;
        overlapDays: number;
        overlapWeeks: number;
        windowStartDayKey: string;
        windowEndDayKey: string;
        placementOverlapStartDayKey: string | null;
        placementOverlapEndDayKey: string | null;
      }
    >;
  };
  uniformSlotAssumptionLeak: {
    mismatchCount: number;
    checkedCount: number;
  };
  capacityOverageDaysCount: number;
  capacityMaxOverageMinutes: number;
};

type NormalizedPlacement = {
  id: string;
  actionId: string | null;
  dayKey: string;
  startISO: string;
  endISO: string;
  minutes: number;
};

function dayDiffInclusive(startDayKey: string, endDayKey: string) {
  const start = Date.parse(`${startDayKey}T00:00:00.000Z`);
  const end = Date.parse(`${endDayKey}T00:00:00.000Z`);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return 0;
  return Math.floor((end - start) / 86400000) + 1;
}

function addDays(dayKey: string, offset: number) {
  const at = Date.parse(`${dayKey}T00:00:00.000Z`);
  if (!Number.isFinite(at)) return dayKey;
  return new Date(at + offset * 86400000).toISOString().slice(0, 10);
}

function dayOfWeekUTC(dayKey: string) {
  const at = Date.parse(`${dayKey}T00:00:00.000Z`);
  if (!Number.isFinite(at)) return null;
  return new Date(at).getUTCDay();
}

function parseSpecificDays(raw = '') {
  if (!raw || typeof raw !== 'string') return [];
  const direct = raw
    .split(',')
    .map((part) => Number.parseInt(part.trim(), 10))
    .filter((n) => Number.isInteger(n) && n >= 0 && n <= 6);
  if (direct.length) return direct;
  const map: Record<string, number> = { sun: 0, mon: 1, tue: 2, tues: 2, wed: 3, thu: 4, thurs: 4, fri: 5, sat: 6 };
  return raw
    .split(',')
    .map((part) => map[(part || '').trim().toLowerCase()])
    .filter((n) => Number.isInteger(n));
}

function resolveEligibleWeekdaysForFixture(fixture: StressScenarioFixture) {
  const specific = parseSpecificDays(fixture.availability?.specificDays || '');
  if (specific.length) return new Set(specific);
  const daysPerWeek = Number(fixture.availability?.daysPerWeek);
  if (!Number.isFinite(daysPerWeek)) return new Set([1, 2, 3, 4, 5]);
  if (daysPerWeek >= 7) return new Set([0, 1, 2, 3, 4, 5, 6]);
  if (daysPerWeek >= 6) return new Set([0, 1, 2, 3, 4, 5]);
  return new Set([1, 2, 3, 4, 5]);
}

function weekKeyForDay(dayKey: string) {
  const at = Date.parse(`${dayKey}T00:00:00.000Z`);
  if (!Number.isFinite(at)) return null;
  const day = new Date(at).getUTCDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  return new Date(at + mondayOffset * 86400000).toISOString().slice(0, 10);
}

function durationMinutes(entry: PlacementLike) {
  if (Number.isFinite(entry.durationMin)) return Math.max(0, Number(entry.durationMin));
  if (Number.isFinite(entry.minutes)) return Math.max(0, Number(entry.minutes));
  const start = Date.parse(entry.startISO || entry.start || '');
  const end = Date.parse(entry.endISO || entry.end || '');
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return 0;
  return Math.max(0, Math.round((end - start) / 60000));
}

function normalizePlacement(entry: PlacementLike, index: number): NormalizedPlacement | null {
  const startISO = entry.startISO || entry.start || '';
  const startAt = Date.parse(startISO);
  if (!Number.isFinite(startAt)) return null;
  const minutes = durationMinutes(entry);
  const endISO = entry.endISO || entry.end || new Date(startAt + Math.max(1, minutes || 30) * 60000).toISOString();
  const dayKey = entry.dayKey || entry.dateISO || dayKeyFromISO(startISO, 'UTC');
  if (!dayKey) return null;
  return {
    id: entry.id || `placement:${index}`,
    actionId: entry.actionId || null,
    dayKey,
    startISO,
    endISO,
    minutes: Math.max(1, minutes || 30),
  };
}

function computeDependencyDepth(actions: StressAction[] = []) {
  const byId = new Map(actions.map((action) => [action.id, action]));
  const memo = new Map<string, number>();
  const visiting = new Set<string>();

  const depthFor = (id: string): number => {
    if (memo.has(id)) return memo.get(id) || 0;
    if (visiting.has(id)) return 0;
    visiting.add(id);
    const action = byId.get(id);
    const deps = Array.isArray(action?.deps) ? action?.deps || [] : [];
    let depth = 1;
    if (deps.length) {
      depth = 1 + Math.max(...deps.map((depId) => depthFor(depId)));
    }
    visiting.delete(id);
    memo.set(id, depth);
    return depth;
  };

  return actions.reduce((max, action) => Math.max(max, depthFor(action.id)), 0);
}

function toPlacementMap(items: PlacementLike[] = []) {
  const normalized = items
    .map((item, index) => normalizePlacement(item, index))
    .filter(Boolean) as NormalizedPlacement[];
  const map = new Map<string, { dayKey: string; startISO: string }>();
  normalized
    .filter((item) => item.actionId)
    .sort((a, b) => `${a.startISO || ''}`.localeCompare(`${b.startISO || ''}`))
    .forEach((item) => {
      const actionId = item.actionId as string;
      if (map.has(actionId)) return;
      map.set(actionId, { dayKey: item.dayKey, startISO: item.startISO });
    });
  return map;
}

function computeChurnIndex(before: PlacementLike[] = [], after: PlacementLike[] = []) {
  const beforeMap = toPlacementMap(before);
  const afterMap = toPlacementMap(after);
  const ids = new Set([...beforeMap.keys(), ...afterMap.keys()]);
  let moved = 0;
  ids.forEach((id) => {
    const lhs = beforeMap.get(id);
    const rhs = afterMap.get(id);
    if (!lhs || !rhs) {
      moved += 1;
      return;
    }
    if (lhs.dayKey !== rhs.dayKey || lhs.startISO !== rhs.startISO) {
      moved += 1;
    }
  });
  return moved;
}

function aggregateByAction(placements: NormalizedPlacement[] = []) {
  const byAction = new Map<string, NormalizedPlacement[]>();
  placements.forEach((placement) => {
    if (!placement.actionId) return;
    if (!byAction.has(placement.actionId)) byAction.set(placement.actionId, []);
    byAction.get(placement.actionId)?.push(placement);
  });
  byAction.forEach((rows) => {
    rows.sort((a, b) => a.startISO.localeCompare(b.startISO));
  });
  return byAction;
}

function toScoreAssignments(placements: NormalizedPlacement[], actionById: Map<string, StressAction>) {
  return placements
    .filter((placement) => placement.actionId)
    .map((placement, index) => ({
      actionId: placement.actionId as string,
      chunkIndex: index,
      chunkCount: 1,
      dayKey: placement.dayKey,
      startMin: (() => {
        const at = Date.parse(placement.startISO);
        if (!Number.isFinite(at)) return 0;
        const date = new Date(at);
        return date.getUTCHours() * 60 + date.getUTCMinutes();
      })(),
      durationMin: Math.max(1, placement.minutes || 30),
      category: actionById.get(placement.actionId as string)?.category || 'UNKNOWN',
    }))
    .sort((a, b) => {
      if (a.dayKey !== b.dayKey) return a.dayKey.localeCompare(b.dayKey);
      if (a.startMin !== b.startMin) return a.startMin - b.startMin;
      return a.actionId.localeCompare(b.actionId);
    })
    .map((assignment, idx) => ({ ...assignment, chunkIndex: idx }));
}

function computeDepViolations(
  actions: StressAction[] = [],
  materializedBlocks: PlacementLike[] = [],
  bufferMinutes = 0
) {
  const normalized = materializedBlocks
    .map((item, index) => normalizePlacement(item, index))
    .filter(Boolean) as NormalizedPlacement[];
  const byAction = aggregateByAction(normalized);

  let depActions = 0;
  let checkedActions = 0;
  let violations = 0;

  actions.forEach((action) => {
    const deps = Array.isArray(action?.deps) ? action.deps : [];
    if (!deps.length) return;
    depActions += 1;
    const actionBlocks = byAction.get(action.id) || [];
    if (!actionBlocks.length) return;

    let depMaxEndAt = -Infinity;
    let depResolved = false;
    deps.forEach((depId) => {
      const depBlocks = byAction.get(depId) || [];
      if (!depBlocks.length) return;
      depResolved = true;
      depBlocks.forEach((depBlock) => {
        const endAt = Date.parse(depBlock.endISO || '');
        const fallbackEndAt = Number.isFinite(endAt)
          ? endAt
          : Date.parse(depBlock.startISO) + Math.max(1, depBlock.minutes || 30) * 60000;
        if (Number.isFinite(fallbackEndAt)) {
          depMaxEndAt = Math.max(depMaxEndAt, fallbackEndAt);
        }
      });
    });

    if (!depResolved || !Number.isFinite(depMaxEndAt)) return;

    checkedActions += 1;
    const actionStartAt = Date.parse(actionBlocks[0].startISO || '');
    if (!Number.isFinite(actionStartAt)) return;

    const earliestAllowed = depMaxEndAt + Math.max(0, bufferMinutes) * 60000;
    if (actionStartAt < earliestAllowed) {
      violations += 1;
    }
  });

  return {
    violations,
    checkedActions,
    eligibleActions: depActions,
  };
}

function computeMilestoneAnchoringScore(
  fixture: StressScenarioFixture,
  materializedBlocks: PlacementLike[] = []
): StressMetrics['milestoneAnchoringScore'] {
  const milestones = fixture.milestones || [];
  if (!milestones.length) {
    return { score: 1, total: 0, anchored: 0, missingMilestoneIds: [], missingCheckpointActionIds: [] };
  }

  const normalized = materializedBlocks
    .map((item, index) => normalizePlacement(item, index))
    .filter(Boolean) as NormalizedPlacement[];

  const byAction = aggregateByAction(normalized);
  const missingMilestoneIds: string[] = [];
  const missingCheckpointActionIds: string[] = [];
  let anchored = 0;

  milestones.forEach((milestone) => {
    const inWindow = (placement: NormalizedPlacement) =>
      placement.dayKey >= milestone.windowStartDayKey && placement.dayKey <= milestone.windowEndDayKey;

    const checkpoints = milestone.checkpointActionIds || [];
    const hasCheckpointInWindow = checkpoints.some((actionId) => {
      const rows = byAction.get(actionId) || [];
      const matched = rows.some(inWindow);
      if (!matched) missingCheckpointActionIds.push(actionId);
      return matched;
    });

    const milestoneActions = milestone.actionIds || [];
    const hasMilestoneActionInWindow = milestoneActions.some((actionId) => {
      const rows = byAction.get(actionId) || [];
      return rows.some(inWindow);
    });

    let predecessorsPlacedBeforeMilestone = false;
    if (hasMilestoneActionInWindow && milestoneActions.length) {
      const milestoneActionId = milestoneActions[0];
      const milestoneRows = byAction.get(milestoneActionId) || [];
      const milestoneStartAt = Date.parse((milestoneRows.find(inWindow)?.startISO || '') as string);
      const precedingActionIds = milestoneActions.slice(1);
      if (Number.isFinite(milestoneStartAt)) {
        predecessorsPlacedBeforeMilestone = precedingActionIds.every((precedingId) => {
          const rows = byAction.get(precedingId) || [];
          const lastEnd = rows.reduce((max, row) => {
            const endAt = Date.parse(row.endISO || '');
            return Number.isFinite(endAt) ? Math.max(max, endAt) : max;
          }, -Infinity);
          return Number.isFinite(lastEnd) && lastEnd <= milestoneStartAt;
        });
      }
    }

    if (
      hasCheckpointInWindow ||
      (hasMilestoneActionInWindow && (milestoneActions.length <= 1 || predecessorsPlacedBeforeMilestone))
    ) {
      anchored += 1;
    } else {
      missingMilestoneIds.push(milestone.id);
    }
  });

  return {
    score: milestones.length ? anchored / milestones.length : 1,
    total: milestones.length,
    anchored,
    missingMilestoneIds: Array.from(new Set(missingMilestoneIds)),
    missingCheckpointActionIds: Array.from(new Set(missingCheckpointActionIds)),
  };
}

function computeUniformSlotLeak(actions: StressAction[] = [], materializedBlocks: PlacementLike[] = []) {
  const normalized = materializedBlocks
    .map((item, index) => normalizePlacement(item, index))
    .filter(Boolean) as NormalizedPlacement[];
  const estimateById = new Map(actions.map((action) => [action.id, Number(action.estimateMin) || 0]));
  const byAction = aggregateByAction(normalized);

  let checkedCount = 0;
  let mismatchCount = 0;

  byAction.forEach((rows, actionId) => {
    const estimate = estimateById.get(actionId) || 0;
    if (!Number.isFinite(estimate) || estimate <= 0) return;
    checkedCount += 1;
    const actualTotal = rows.reduce((sum, row) => sum + Math.max(1, row.minutes || 30), 0);
    if (actualTotal !== estimate) mismatchCount += 1;
  });

  return { checkedCount, mismatchCount };
}

function computeCapacityOverages(fixture: StressScenarioFixture, materializedBlocks: PlacementLike[] = []) {
  const dailyCap = Number(fixture.realismConstraints?.maxScheduledMinutesPerDay || 0);
  const tolerance = Number(fixture.realismConstraints?.toleranceMinutes || 0);
  const normalized = materializedBlocks
    .map((item, index) => normalizePlacement(item, index))
    .filter(Boolean) as NormalizedPlacement[];

  if (!dailyCap) return { overageDaysCount: 0, maxOverageMinutes: 0, dailyLoads: new Map<string, number>() };

  const dailyLoads = new Map<string, number>();
  normalized.forEach((placement) => {
    dailyLoads.set(placement.dayKey, (dailyLoads.get(placement.dayKey) || 0) + placement.minutes);
  });

  let overageDaysCount = 0;
  let maxOverageMinutes = 0;
  dailyLoads.forEach((load) => {
    const over = load - (dailyCap + tolerance);
    if (over > 0) {
      overageDaysCount += 1;
      maxOverageMinutes = Math.max(maxOverageMinutes, over);
    }
  });

  return { overageDaysCount, maxOverageMinutes, dailyLoads };
}

function computeMilestonePlacedRatio(
  fixture: StressScenarioFixture,
  actions: StressAction[] = [],
  placedActionIds: Set<string> = new Set()
) {
  const milestones = fixture.milestones || [];
  if (!milestones.length) {
    return { min: 1, avg: 1, byMilestone: {} as Record<string, number> };
  }

  const actionById = new Map(actions.map((action) => [action.id, action]));
  const collectDeps = (rootId: string, visited = new Set<string>()) => {
    if (!rootId || visited.has(rootId)) return visited;
    visited.add(rootId);
    const action = actionById.get(rootId);
    const deps = Array.isArray(action?.deps) ? action.deps : [];
    deps.forEach((depId) => collectDeps(depId, visited));
    return visited;
  };

  const byMilestone: Record<string, number> = {};
  milestones.forEach((milestone) => {
    const milestoneId = milestone.id || 'milestone';
    const checkpointActionIds = Array.isArray(milestone.checkpointActionIds) ? milestone.checkpointActionIds : [];
    const milestoneActionIds = Array.isArray(milestone.actionIds) ? milestone.actionIds : [];
    const depCritical = new Set<string>();
    milestoneActionIds.forEach((actionId) => collectDeps(actionId, depCritical));
    const criticalActionIds = Array.from(new Set([...milestoneActionIds, ...checkpointActionIds, ...depCritical]));

    const criticalMinutesTotal = criticalActionIds.reduce((sum, actionId) => {
      const action = actionById.get(actionId);
      return sum + Math.max(0, Number(action?.estimateMin) || 0);
    }, 0);
    const criticalMinutesPlaced = criticalActionIds.reduce((sum, actionId) => {
      if (!placedActionIds.has(actionId)) return sum;
      const action = actionById.get(actionId);
      return sum + Math.max(0, Number(action?.estimateMin) || 0);
    }, 0);

    byMilestone[milestoneId] = Number((criticalMinutesPlaced / Math.max(criticalMinutesTotal, 1)).toFixed(4));
  });

  const ratios = Object.values(byMilestone);
  const min = ratios.length ? Math.min(...ratios) : 1;
  const avg = ratios.length ? ratios.reduce((sum, value) => sum + value, 0) / ratios.length : 1;
  return {
    min: Number(min.toFixed(4)),
    avg: Number(avg.toFixed(4)),
    byMilestone,
  };
}

function computeMilestoneWindowSlack(
  fixture: StressScenarioFixture,
  actions: StressAction[] = [],
  diagnostics: Record<string, unknown> | null = null
): StressMetrics['milestoneWindowSlack'] {
  const milestones = fixture.milestones || [];
  if (!milestones.length) {
    return {
      slackRatioMin: 1,
      slackRatioAvg: 1,
      infeasibleMilestonesCount: 0,
      byMilestone: {},
    };
  }

  const actionById = new Map(actions.map((action) => [action.id, action]));
  const collectDeps = (rootId: string, visited = new Set<string>()) => {
    if (!rootId || visited.has(rootId)) return visited;
    visited.add(rootId);
    const action = actionById.get(rootId);
    const deps = Array.isArray(action?.deps) ? action.deps : [];
    deps.forEach((depId) => collectDeps(depId, visited));
    return visited;
  };
  const eligibleWeekdays = resolveEligibleWeekdaysForFixture(fixture);
  const perDayFromAvailability =
    Math.max(1, Number(fixture.availability?.maxBlocksPerDay || 0)) *
    Math.max(1, Number(fixture.availability?.routeMinutesDefault || 30));
  const dailyCap = Number(fixture.realismConstraints?.maxScheduledMinutesPerDay || 0);
  const weeklyCap = Number(fixture.realismConstraints?.maxScheduledMinutesPerWeek || 0);
  const perDayCapacityMinutes =
    Number.isFinite(dailyCap) && dailyCap > 0 ? Math.min(perDayFromAvailability, dailyCap) : perDayFromAvailability;

  const placementStartDayKey = dayKeyFromISO(
    String((diagnostics as any)?.feasibilityWindowStartISO || (diagnostics as any)?.placementWindowStartISO || ''),
    'UTC'
  );
  const placementEndDayKey = dayKeyFromISO(
    String((diagnostics as any)?.feasibilityWindowEndISO || (diagnostics as any)?.placementWindowEndISO || ''),
    'UTC'
  );

  const byMilestone: StressMetrics['milestoneWindowSlack']['byMilestone'] = {};
  milestones.forEach((milestone) => {
    const milestoneId = milestone.id || 'milestone';
    const checkpointActionIds = Array.isArray(milestone.checkpointActionIds) ? milestone.checkpointActionIds : [];
    const milestoneActionIds = Array.isArray(milestone.actionIds) ? milestone.actionIds : [];
    const depCritical = new Set<string>();
    milestoneActionIds.forEach((actionId) => collectDeps(actionId, depCritical));
    const criticalActionIds = Array.from(new Set([...milestoneActionIds, ...checkpointActionIds, ...depCritical]));
    const requiredCriticalMinutes = criticalActionIds.reduce((sum, actionId) => {
      const action = actionById.get(actionId);
      return sum + Math.max(0, Number(action?.estimateMin) || 0);
    }, 0);

    let overlapStart = milestone.windowStartDayKey;
    let overlapEnd = milestone.windowEndDayKey;
    if (placementStartDayKey && overlapStart < placementStartDayKey) overlapStart = placementStartDayKey;
    if (placementEndDayKey && overlapEnd > placementEndDayKey) overlapEnd = placementEndDayKey;

    let overlapDays = 0;
    let overlapWeeks = 0;
    let availableWindowMinutes = 0;
    if (overlapStart <= overlapEnd) {
      const weekKeys = new Set<string>();
      const days = dayDiffInclusive(overlapStart, overlapEnd);
      for (let i = 0; i < days; i += 1) {
        const dayKey = addDays(overlapStart, i);
        const weekday = dayOfWeekUTC(dayKey);
        if (weekday === null || !eligibleWeekdays.has(weekday)) continue;
        overlapDays += 1;
        availableWindowMinutes += perDayCapacityMinutes;
        const wk = weekKeyForDay(dayKey);
        if (wk) weekKeys.add(wk);
      }
      overlapWeeks = weekKeys.size;
      if (Number.isFinite(weeklyCap) && weeklyCap > 0) {
        availableWindowMinutes = Math.min(availableWindowMinutes, overlapWeeks * weeklyCap);
      }
    }
    const slackMinutes = availableWindowMinutes - requiredCriticalMinutes;
    const slackRatio = Number((availableWindowMinutes / Math.max(requiredCriticalMinutes, 1)).toFixed(4));
    byMilestone[milestoneId] = {
      requiredCriticalMinutes,
      availableWindowMinutes,
      slackMinutes,
      slackRatio,
      criticalActionCount: criticalActionIds.length,
      overlapDays,
      overlapWeeks,
      windowStartDayKey: milestone.windowStartDayKey,
      windowEndDayKey: milestone.windowEndDayKey,
      placementOverlapStartDayKey: overlapStart <= overlapEnd ? overlapStart : null,
      placementOverlapEndDayKey: overlapStart <= overlapEnd ? overlapEnd : null,
    };
  });

  const ratios = Object.values(byMilestone).map((entry) => entry.slackRatio);
  const slackRatioMin = ratios.length ? Number(Math.min(...ratios).toFixed(4)) : 1;
  const slackRatioAvg = ratios.length
    ? Number((ratios.reduce((sum, ratio) => sum + ratio, 0) / ratios.length).toFixed(4))
    : 1;
  const infeasibleMilestonesCount = Object.values(byMilestone).filter((entry) => entry.slackRatio < 1).length;

  return {
    slackRatioMin,
    slackRatioAvg,
    infeasibleMilestonesCount,
    byMilestone,
  };
}

export function computeStressMetrics({
  fixture,
  actions,
  previewItems,
  materializedBlocks,
  rebuildPreviewItems,
  diagnostics,
}: {
  fixture: StressScenarioFixture;
  actions: StressAction[];
  previewItems: PlacementLike[];
  materializedBlocks: PlacementLike[];
  rebuildPreviewItems?: PlacementLike[];
  diagnostics?: Record<string, unknown> | null;
}): StressMetrics {
  const actionCount = actions.length;
  const horizonDays = dayDiffInclusive(fixture.horizon.startDayKey, fixture.horizon.endDayKey);
  const dependencyDepthMax = computeDependencyDepth(actions);

  const normalizedMaterialized = materializedBlocks
    .map((item, index) => normalizePlacement(item, index))
    .filter(Boolean) as NormalizedPlacement[];
  const knownActionIds = new Set(actions.map((action) => action.id));
  const placedActionIds = new Set(normalizedMaterialized.map((block) => block.actionId).filter(Boolean));
  const unplacedActionCount = Math.max(0, actionCount - placedActionIds.size);
  const unplacedEstimateMinByCategory = actions.reduce(
    (acc, action) => {
      if (placedActionIds.has(action.id)) return acc;
      const key = ((action.category || (action as any)?.domain || 'UNKNOWN') + '').toUpperCase();
      acc[key] = (acc[key] || 0) + Math.max(0, Number(action.estimateMin) || 0);
      return acc;
    },
    {} as Record<string, number>
  );
  const unplacedEstimateMinTotal = Object.values(unplacedEstimateMinByCategory).reduce((sum, value) => sum + value, 0);

  const totalsByDay = new Map<string, number>();
  normalizedMaterialized.forEach((block) => {
    const current = totalsByDay.get(block.dayKey) || 0;
    totalsByDay.set(block.dayKey, current + block.minutes);
  });

  const dailyLoads: number[] = [];
  for (let i = 0; i < horizonDays; i += 1) {
    const dayKey = addDays(fixture.horizon.startDayKey, i);
    dailyLoads.push(totalsByDay.get(dayKey) || 0);
  }

  const totalScheduledMinutes = dailyLoads.reduce((sum, value) => sum + value, 0);
  const scheduledTotalMin = normalizedMaterialized.reduce((sum, block) => {
    if (!block.actionId || !knownActionIds.has(block.actionId)) return sum;
    return sum + Math.max(0, Number(block.minutes) || 0);
  }, 0);
  const estimateById = new Map(actions.map((action) => [action.id, Math.max(0, Number(action.estimateMin) || 0)]));
  const actionById = new Map(actions.map((action) => [action.id, action]));
  const estimateTotalMinAll = actions.reduce((sum, action) => sum + (estimateById.get(action.id) || 0), 0);
  const estimateTotalMinPlaced = Array.from(placedActionIds).reduce((sum, actionId) => {
    return sum + (estimateById.get(actionId as string) || 0);
  }, 0);
  const scheduleTruthRatio = Number((scheduledTotalMin / Math.max(estimateTotalMinPlaced, 1)).toFixed(4));
  const scheduleCoverageRatio = Number((estimateTotalMinPlaced / Math.max(estimateTotalMinAll, 1)).toFixed(4));
  const dailyMin = dailyLoads.length ? Math.min(...dailyLoads) : 0;
  const dailyMax = dailyLoads.length ? Math.max(...dailyLoads) : 0;
  const dailyAvg = dailyLoads.length ? totalScheduledMinutes / dailyLoads.length : 0;

  const churnPreviewToCommitted = computeChurnIndex(previewItems, materializedBlocks);
  const churnAcrossRebuilds = rebuildPreviewItems ? computeChurnIndex(previewItems, rebuildPreviewItems) : 0;
  const diagnosticReservationInputCount = Number((diagnostics as any)?.reservationInputCount);
  const diagnosticPreservedChunkCount = Number((diagnostics as any)?.preservedChunkCount);
  const diagnosticMovedChunkCount = Number((diagnostics as any)?.movedChunkCount);
  const diagnosticDroppedChunkCount = Number((diagnostics as any)?.droppedChunkCount);
  const diagnosticChurnMovedMinutesTotal = Number((diagnostics as any)?.churnMovedMinutesTotal);
  const diagnosticChurnReasonsCount = (diagnostics as any)?.churnReasonsCount;

  const depStats = computeDepViolations(
    actions,
    materializedBlocks,
    Number(fixture.dependencies?.defaultBufferMinutes || 0)
  );
  const milestoneAnchoring = computeMilestoneAnchoringScore(fixture, materializedBlocks);
  const diagnosticPlacementMissCount = Number((diagnostics as any)?.milestoneWindowMissCountPlacement);
  const diagnosticDepWindowBlockedCount = Number((diagnostics as any)?.depWindowBlockedCount);
  const diagnosticDepWindowBlockedByMilestone = (diagnostics as any)?.depWindowBlockedByMilestone;
  const diagnosticDepBufferBlockedCount = Number((diagnostics as any)?.depBufferBlockedCount);
  const diagnosticDepBufferBlockedByMilestone = (diagnostics as any)?.depBufferBlockedByMilestone;
  const diagnosticOutsideExecutionHorizonCount = Number((diagnostics as any)?.outsideExecutionHorizonCount);
  const diagnosticOutsideExecutionHorizonEstimateMinTotal = Number(
    (diagnostics as any)?.outsideExecutionHorizonEstimateMinTotal
  );
  const hardWindowMode = String((diagnostics as any)?.milestoneWindowConstraintMode || '').toLowerCase() === 'hard';
  const placementAnchoringMissCount = Number.isFinite(diagnosticPlacementMissCount)
    ? Math.max(0, Math.round(diagnosticPlacementMissCount))
    : milestoneAnchoring.missingMilestoneIds.length;
  const depWindowBlockedCount = Number.isFinite(diagnosticDepWindowBlockedCount)
    ? Math.max(0, Math.round(diagnosticDepWindowBlockedCount))
    : 0;
  const depWindowBlockedByMilestone =
    diagnosticDepWindowBlockedByMilestone && typeof diagnosticDepWindowBlockedByMilestone === 'object'
      ? Object.entries(diagnosticDepWindowBlockedByMilestone).reduce(
          (acc, [milestoneId, count]) => {
            const numericCount = Number(count);
            if (!Number.isFinite(numericCount)) return acc;
            acc[String(milestoneId)] = Math.max(0, Math.round(numericCount));
            return acc;
          },
          {} as Record<string, number>
        )
      : {};
  const depBufferBlockedCount = Number.isFinite(diagnosticDepBufferBlockedCount)
    ? Math.max(0, Math.round(diagnosticDepBufferBlockedCount))
    : depWindowBlockedCount;
  const depBufferBlockedByMilestone =
    diagnosticDepBufferBlockedByMilestone && typeof diagnosticDepBufferBlockedByMilestone === 'object'
      ? Object.entries(diagnosticDepBufferBlockedByMilestone).reduce(
          (acc, [milestoneId, count]) => {
            const numericCount = Number(count);
            if (!Number.isFinite(numericCount)) return acc;
            acc[String(milestoneId)] = Math.max(0, Math.round(numericCount));
            return acc;
          },
          {} as Record<string, number>
        )
      : depWindowBlockedByMilestone;
  const outsideExecutionHorizonCount = Number.isFinite(diagnosticOutsideExecutionHorizonCount)
    ? Math.max(0, Math.round(diagnosticOutsideExecutionHorizonCount))
    : 0;
  const outsideExecutionHorizonEstimateMinTotal = Number.isFinite(diagnosticOutsideExecutionHorizonEstimateMinTotal)
    ? Math.max(0, Number(diagnosticOutsideExecutionHorizonEstimateMinTotal))
    : 0;
  const preservedChunkCount = Number.isFinite(diagnosticPreservedChunkCount)
    ? Math.max(0, Math.round(diagnosticPreservedChunkCount))
    : 0;
  const movedChunkCount = Number.isFinite(diagnosticMovedChunkCount)
    ? Math.max(0, Math.round(diagnosticMovedChunkCount))
    : 0;
  const droppedChunkCount = Number.isFinite(diagnosticDroppedChunkCount)
    ? Math.max(0, Math.round(diagnosticDroppedChunkCount))
    : 0;
  const churnMovedMinutesTotal = Number.isFinite(diagnosticChurnMovedMinutesTotal)
    ? Math.max(0, Number(diagnosticChurnMovedMinutesTotal))
    : 0;
  const churnReasonsCount =
    diagnosticChurnReasonsCount && typeof diagnosticChurnReasonsCount === 'object'
      ? Object.entries(diagnosticChurnReasonsCount).reduce(
          (acc, [key, value]) => {
            const numericValue = Number(value);
            if (!Number.isFinite(numericValue)) return acc;
            acc[String(key)] = Math.max(0, Math.round(numericValue));
            return acc;
          },
          {} as Record<string, number>
        )
      : {};
  const reservationInputCount = Number.isFinite(diagnosticReservationInputCount)
    ? Math.max(0, Math.round(diagnosticReservationInputCount))
    : 0;
  const diagnosticChurnIndex =
    reservationInputCount > 0 ? (movedChunkCount + droppedChunkCount) / Math.max(reservationInputCount, 1) : null;
  const alignedPlacementMissCount = hardWindowMode
    ? milestoneAnchoring.missingMilestoneIds.length
    : placementAnchoringMissCount;
  const anchoringMissDelta = milestoneAnchoring.missingMilestoneIds.length - alignedPlacementMissCount;
  const milestonePlacedRatio = computeMilestonePlacedRatio(fixture, actions, placedActionIds as Set<string>);
  const milestoneWindowSlack = computeMilestoneWindowSlack(fixture, actions, diagnostics);
  const derivedWeeklyCapacity = (() => {
    const explicit = Number(fixture.realismConstraints?.maxScheduledMinutesPerWeek);
    if (Number.isFinite(explicit) && explicit > 0) return explicit;
    const perDay =
      Math.max(1, Number(fixture.availability?.maxBlocksPerDay || 1)) *
      Math.max(1, Number(fixture.availability?.routeMinutesDefault || 30));
    const daysPerWeek = Math.max(1, Number(fixture.availability?.daysPerWeek || 5));
    return perDay * daysPerWeek;
  })();
  const prescriptions = computePrescriptions({
    unplacedEstimateMinTotal,
    unplacedEstimateMinByCategory,
    outsideExecutionHorizonEstimateMinTotal,
    outsideExecutionHorizonCount,
    executionHorizonDays: Number((diagnostics as any)?.executionHorizonDays) || undefined,
    placementWindowDays: Number((diagnostics as any)?.placementHorizonDays) || undefined,
    maxScheduledMinutesPerWeek: derivedWeeklyCapacity,
    milestoneWindowMissCountPlacement: placementAnchoringMissCount,
    milestoneWindowSlack: placementAnchoringMissCount > 0 ? milestoneWindowSlack : null,
  });
  const slotLeak = computeUniformSlotLeak(actions, materializedBlocks);
  const capacity = computeCapacityOverages(fixture, materializedBlocks);
  const normalizedPreview = previewItems
    .map((item, index) => normalizePlacement(item, index))
    .filter(Boolean) as NormalizedPlacement[];
  const scoreInputsShared = {
    actionGraph: { actions },
    constraints: {
      maxScheduledMinutesPerDay: fixture.realismConstraints?.maxScheduledMinutesPerDay,
      maxScheduledMinutesPerWeek: fixture.realismConstraints?.maxScheduledMinutesPerWeek,
      executionHorizonDays:
        Number((diagnostics as any)?.executionHorizonDays) ||
        Math.max(1, dayDiffInclusive(fixture.horizon.startDayKey, fixture.horizon.endDayKey)),
    },
    horizons: {
      executionWindowStartDayKey:
        dayKeyFromISO(String((diagnostics as any)?.executionWindowStartISO || ''), 'UTC') ||
        fixture.horizon.startDayKey,
      executionWindowEndDayKey:
        dayKeyFromISO(String((diagnostics as any)?.executionWindowEndISO || ''), 'UTC') || fixture.horizon.endDayKey,
      feasibilityWindowEndDayKey:
        dayKeyFromISO(String((diagnostics as any)?.feasibilityWindowEndISO || ''), 'UTC') || fixture.horizon.endDayKey,
    },
    milestones: (fixture.milestones || []).map((milestone) => ({
      milestoneId: milestone.id,
      windowStartDayKey: milestone.windowStartDayKey,
      windowEndDayKey: milestone.windowEndDayKey,
      checkpointActionIds: milestone.checkpointActionIds || [],
      actionIds: milestone.actionIds || [],
    })),
    metricsContext: {
      milestoneWindowSlack,
      unplacedEstimateMinTotal,
      outsideExecutionHorizonEstimateMinTotal,
      outsideExecutionHorizonCount,
    },
  };
  const qualityPreview = scoreSchedule({
    ...scoreInputsShared,
    assignments: toScoreAssignments(normalizedPreview, actionById),
  });
  const qualityApplied = scoreSchedule({
    ...scoreInputsShared,
    assignments: toScoreAssignments(normalizedMaterialized, actionById),
  });
  const qualityScoreParity = qualityPreview.total === qualityApplied.total;

  return {
    actionCount,
    dependencyDepthMax,
    horizonDays,
    placedBlockCount: normalizedMaterialized.length,
    unplacedActionCount,
    unplacedEstimateMinTotal,
    unplacedEstimateMinByCategory,
    totalScheduledMinutes,
    scheduleTruthRatio,
    scheduleCoverageRatio,
    dailyLoadStats: {
      min: dailyMin,
      avg: Number(dailyAvg.toFixed(2)),
      max: dailyMax,
    },
    churnIndex: Number(
      (
        (Number.isFinite(diagnosticChurnIndex)
          ? diagnosticChurnIndex
          : churnPreviewToCommitted + churnAcrossRebuilds) || 0
      ).toFixed(4)
    ),
    preservedChunkCount,
    movedChunkCount,
    droppedChunkCount,
    churnMovedMinutesTotal,
    churnReasonsCount,
    prescriptionsCount: prescriptions.prescriptionsCount,
    prescriptionsPrimaryConstraint: prescriptions.primaryConstraint,
    prescriptionsCodes: prescriptions.mustIncludeCodes,
    depViolations: depStats.violations,
    depCheckCoverage: {
      checkedActions: depStats.checkedActions,
      eligibleActions: depStats.eligibleActions,
    },
    milestoneAnchoringScore: milestoneAnchoring,
    milestoneWindowMissCount: milestoneAnchoring.missingMilestoneIds.length,
    placementAnchoringMissCount: alignedPlacementMissCount,
    anchoringMissDelta,
    depWindowBlockedCount,
    depWindowBlockedByMilestone,
    depBufferBlockedCount,
    depBufferBlockedByMilestone,
    outsideExecutionHorizonCount,
    outsideExecutionHorizonEstimateMinTotal,
    qualityScoreTotal: qualityApplied.total,
    qualityScoreByComponent: qualityApplied.components,
    qualityScorePreview: qualityPreview.total,
    qualityScoreApplied: qualityApplied.total,
    qualityScoreParity,
    contextSwitchCount: Number(qualityApplied.evidence.contextSwitchCount || 0),
    dailyLoadStdDev: Number(qualityApplied.evidence.dailyLoadStdDev || 0),
    milestoneAtRiskCount: Number(qualityApplied.evidence.milestoneAtRiskCount || 0),
    depTightCount: Number(qualityApplied.evidence.depTightCount || 0),
    milestonePlacedRatio,
    milestoneWindowSlack,
    uniformSlotAssumptionLeak: slotLeak,
    capacityOverageDaysCount: capacity.overageDaysCount,
    capacityMaxOverageMinutes: capacity.maxOverageMinutes,
  };
}
