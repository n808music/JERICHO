export type CycleHistorySignals = {
  cycleId: string;
  startDayKey: string;
  endDayKey: string;
  scheduledMinutesTotal: number;
  completedMinutesTotal: number;
  completionRate: number;
  completionVelocityMinPerDay: number;
  movedMinutesTotal: number;
  droppedMinutesTotal: number;
  churnIndex: number;
  rescheduleCount: number;
  overCapDaysCount: number;
  avgDailyScheduledMin: number;
  maxDailyScheduledMin: number;
  depTightCount: number;
  depWindowBlockedCount: number;
  milestoneAtRiskCount: number;
  placementAnchoringMissCount: number;
  outsideExecutionHorizonMinutes: number;
  unplacedEstimateMinTotal: number;
};

export type HistoryProfile = {
  window: {
    cycleCount: number;
    usedCycleIds: string[];
    minEndDayKey: string;
    maxEndDayKey: string;
  };
  aggregates: {
    avgCompletionRate: number;
    avgVelocityMinPerDay: number;
    avgChurnIndex: number;
    avgDepTightCount: number;
    avgMilestoneAtRiskCount: number;
    avgAnchoringMissCount: number;
    avgDeferralMinutes: number;
  };
  trends: {
    completionRateTrend: 'up' | 'down' | 'flat';
    churnTrend: 'up' | 'down' | 'flat';
  };
};

type HistoryProfileOpts = {
  windowCycles?: number;
};

const DAY_MS = 86400000;

function toInt(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? Math.round(n) : 0;
}

function round6(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.round(value * 1_000_000) / 1_000_000;
}

function dayKeyToMs(dayKey: string): number {
  const ms = Date.parse(`${dayKey}T00:00:00.000Z`);
  return Number.isFinite(ms) ? ms : 0;
}

function dayDiffInclusive(startDayKey: string, endDayKey: string): number {
  const start = dayKeyToMs(startDayKey);
  const end = dayKeyToMs(endDayKey);
  if (!start || !end || end < start) return 1;
  return Math.max(1, Math.round((end - start) / DAY_MS) + 1);
}

function extractDayKey(value: unknown): string {
  const str = (value || '').toString();
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;
  if (str.length >= 10 && /^\d{4}-\d{2}-\d{2}$/.test(str.slice(0, 10))) {
    return str.slice(0, 10);
  }
  return '';
}

function trendOf(values: number[], epsilon: number): 'up' | 'down' | 'flat' {
  if (values.length < 2) return 'flat';
  const sample = values.length >= 3 ? values.slice(-3) : values;
  const delta = sample[sample.length - 1] - sample[0];
  if (delta > epsilon) return 'up';
  if (delta < -epsilon) return 'down';
  return 'flat';
}

function safeAvg(values: number[]): number {
  if (!values.length) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function byCycleEnd(a: CycleHistorySignals, b: CycleHistorySignals): number {
  if (a.endDayKey !== b.endDayKey) return a.endDayKey.localeCompare(b.endDayKey);
  return a.cycleId.localeCompare(b.cycleId);
}

export function deriveCycleHistorySignals(
  cycle: any,
  materializedBlocks: any[] = [],
  executionEvents: any[] = [],
  diagnostics: any = {}
): CycleHistorySignals {
  const cycleId = (cycle?.id || cycle?.cycleId || '').toString();
  const startDayKey = extractDayKey(cycle?.startedAtDayKey) || '1970-01-01';
  const endDayKey = extractDayKey(cycle?.endedAtDayKey) || startDayKey;
  const dayLoads = new Map<string, number>();

  const scheduledMinutesTotal = materializedBlocks.reduce((sum, block) => {
    const start = Date.parse(block?.start || '');
    const end = Date.parse(block?.end || '');
    const duration =
      Number.isFinite(start) && Number.isFinite(end)
        ? Math.max(0, Math.round((end - start) / 60000))
        : toInt(block?.durationMinutes);
    const dayKey = extractDayKey(block?.start);
    if (dayKey) {
      dayLoads.set(dayKey, (dayLoads.get(dayKey) || 0) + duration);
    }
    return sum + duration;
  }, 0);

  const completedMinutesTotal = materializedBlocks.reduce((sum, block) => {
    const status = (block?.status || '').toString().toLowerCase();
    if (status !== 'completed' && status !== 'complete') return sum;
    const start = Date.parse(block?.start || '');
    const end = Date.parse(block?.end || '');
    const duration =
      Number.isFinite(start) && Number.isFinite(end)
        ? Math.max(0, Math.round((end - start) / 60000))
        : toInt(block?.durationMinutes);
    return sum + duration;
  }, 0);

  const completionRate = scheduledMinutesTotal > 0 ? round6(completedMinutesTotal / scheduledMinutesTotal) : 0;
  const activeDays = Math.max(1, dayLoads.size || dayDiffInclusive(startDayKey, endDayKey));
  const completionVelocityMinPerDay = round6(completedMinutesTotal / activeDays);

  let movedMinutesTotal = 0;
  let droppedMinutesTotal = 0;
  let rescheduleCount = 0;
  executionEvents.forEach((event) => {
    const kind = (event?.kind || '').toString().toLowerCase();
    const minutes = Math.max(0, toInt(event?.minutes));
    if (kind === 'reschedule') {
      movedMinutesTotal += minutes;
      rescheduleCount += 1;
    }
    if (kind === 'delete' || kind === 'missed') {
      droppedMinutesTotal += minutes;
    }
  });

  const churnIndex =
    scheduledMinutesTotal > 0 ? round6(((movedMinutesTotal + droppedMinutesTotal) / scheduledMinutesTotal) * 100) : 0;
  const dayCaps = toInt(cycle?.planDraft?.maxScheduledMinutesPerDay) || 1440;
  const dailyLoads = [...dayLoads.values()];
  const overCapDaysCount = dailyLoads.filter((minutes) => minutes > dayCaps).length;
  const avgDailyScheduledMin = round6(safeAvg(dailyLoads));
  const maxDailyScheduledMin = dailyLoads.length ? Math.max(...dailyLoads) : 0;

  const depTightCount = toInt(
    diagnostics?.depTightCount ?? cycle?.planPreview?.policySelectionSignalsSnapshot?.depTightCount
  );
  const depWindowBlockedCount = toInt(diagnostics?.depWindowBlockedCount);
  const milestoneAtRiskCount = toInt(
    diagnostics?.milestoneAtRiskCount ?? cycle?.planPreview?.policySelectionSignalsSnapshot?.milestoneAtRiskCount
  );
  const placementAnchoringMissCount = toInt(
    diagnostics?.placementAnchoringMissCount ?? cycle?.planPreview?.pacingAnchoringMissCount
  );
  const outsideExecutionHorizonMinutes = toInt(
    diagnostics?.outsideExecutionHorizonMinutes ??
      cycle?.planPreview?.policySelectionSignalsSnapshot?.outsideExecutionHorizonEstimateMinTotal
  );
  const unplacedEstimateMinTotal = toInt(
    diagnostics?.unplacedEstimateMinTotal ??
      cycle?.planPreview?.policySelectionSignalsSnapshot?.unplacedEstimateMinTotal
  );

  return {
    cycleId,
    startDayKey,
    endDayKey,
    scheduledMinutesTotal,
    completedMinutesTotal,
    completionRate,
    completionVelocityMinPerDay,
    movedMinutesTotal,
    droppedMinutesTotal,
    churnIndex,
    rescheduleCount,
    overCapDaysCount,
    avgDailyScheduledMin,
    maxDailyScheduledMin,
    depTightCount,
    depWindowBlockedCount,
    milestoneAtRiskCount,
    placementAnchoringMissCount,
    outsideExecutionHorizonMinutes,
    unplacedEstimateMinTotal,
  };
}

export function buildHistoryProfile(
  endedCyclesSignals: CycleHistorySignals[] = [],
  opts: HistoryProfileOpts = {}
): HistoryProfile {
  const windowCycles = Number.isFinite(opts.windowCycles) ? Math.max(1, Number(opts.windowCycles)) : 5;
  const sorted = [...endedCyclesSignals].filter((entry) => entry && entry.cycleId && entry.endDayKey).sort(byCycleEnd);
  const used = sorted.slice(-windowCycles);
  if (!used.length) {
    return {
      window: {
        cycleCount: 0,
        usedCycleIds: [],
        minEndDayKey: '',
        maxEndDayKey: '',
      },
      aggregates: {
        avgCompletionRate: 0,
        avgVelocityMinPerDay: 0,
        avgChurnIndex: 0,
        avgDepTightCount: 0,
        avgMilestoneAtRiskCount: 0,
        avgAnchoringMissCount: 0,
        avgDeferralMinutes: 0,
      },
      trends: {
        completionRateTrend: 'flat',
        churnTrend: 'flat',
      },
    };
  }

  const completionRates = used.map((entry) => entry.completionRate);
  const churnValues = used.map((entry) => entry.churnIndex);
  const deferralValues = used.map((entry) => entry.outsideExecutionHorizonMinutes + entry.unplacedEstimateMinTotal);

  return {
    window: {
      cycleCount: used.length,
      usedCycleIds: used.map((entry) => entry.cycleId),
      minEndDayKey: used[0].endDayKey,
      maxEndDayKey: used[used.length - 1].endDayKey,
    },
    aggregates: {
      avgCompletionRate: round6(safeAvg(completionRates)),
      avgVelocityMinPerDay: round6(safeAvg(used.map((entry) => entry.completionVelocityMinPerDay))),
      avgChurnIndex: round6(safeAvg(churnValues)),
      avgDepTightCount: round6(safeAvg(used.map((entry) => entry.depTightCount))),
      avgMilestoneAtRiskCount: round6(safeAvg(used.map((entry) => entry.milestoneAtRiskCount))),
      avgAnchoringMissCount: round6(safeAvg(used.map((entry) => entry.placementAnchoringMissCount))),
      avgDeferralMinutes: round6(safeAvg(deferralValues)),
    },
    trends: {
      completionRateTrend: trendOf(completionRates, 0.03),
      churnTrend: trendOf(churnValues, 3),
    },
  };
}
