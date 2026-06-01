import { QUALITY_WEIGHTS, SCORE_ROUNDING_DECIMALS } from './weights.ts';

export type ScoreAssignment = {
  actionId: string;
  chunkIndex: number;
  chunkCount: number;
  dayKey: string;
  startMin: number;
  durationMin: number;
  category?: string;
  isMilestone?: boolean;
  isCheckpoint?: boolean;
};

export type ScoreAction = {
  id: string;
  estimateMin?: number;
  category?: string;
  deps?: string[];
  dependencies?: { ids?: string[]; bufferMinutes?: number };
};

export type ScoreMilestone = {
  milestoneId: string;
  windowStartDayKey: string;
  windowEndDayKey: string;
  checkpointActionIds?: string[];
  actionIds?: string[];
};

export type ScoreInputs = {
  assignments: ScoreAssignment[];
  actionGraph: { actions?: ScoreAction[] } | ScoreAction[];
  constraints: {
    maxScheduledMinutesPerDay?: number;
    maxScheduledMinutesPerWeek?: number;
    executionHorizonDays: number;
  };
  horizons: {
    executionWindowStartDayKey: string;
    executionWindowEndDayKey: string;
    feasibilityWindowEndDayKey: string;
  };
  milestones?: ScoreMilestone[];
  metricsContext?: {
    milestoneWindowSlack?: {
      byMilestone?: Record<string, { slackRatio?: number }>;
      infeasibleMilestonesCount?: number;
    } | null;
    unplacedEstimateMinTotal?: number;
    outsideExecutionHorizonEstimateMinTotal?: number;
    outsideExecutionHorizonCount?: number;
  };
};

export type ScoreBreakdown = {
  total: number;
  components: {
    deadlineRisk: number;
    milestoneRisk: number;
    dependencyRisk: number;
    contextSwitching: number;
    loadSmoothness: number;
    deferralPenalty: number;
  };
  evidence: {
    deadlineOverrunDays?: number;
    milestoneAtRiskCount?: number;
    depTightCount?: number;
    contextSwitchCount?: number;
    dailyLoadStdDev?: number;
    outsideExecutionHorizonMinutes?: number;
  };
};

function round(value: number) {
  const factor = 10 ** SCORE_ROUNDING_DECIMALS;
  return Math.round((Number.isFinite(value) ? value : 0) * factor) / factor;
}

function parseDay(dayKey: string) {
  const ts = Date.parse(`${dayKey}T00:00:00.000Z`);
  return Number.isFinite(ts) ? ts : null;
}

function dayDiffInclusive(startDayKey: string, endDayKey: string) {
  const start = parseDay(startDayKey);
  const end = parseDay(endDayKey);
  if (!Number.isFinite(start) || !Number.isFinite(end) || (end as number) < (start as number)) return 0;
  return Math.floor(((end as number) - (start as number)) / 86400000) + 1;
}

function weekKeyForDay(dayKey: string) {
  const at = parseDay(dayKey);
  if (!Number.isFinite(at)) return dayKey;
  const day = new Date(at as number).getUTCDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  return new Date((at as number) + mondayOffset * 86400000).toISOString().slice(0, 10);
}

function normalizeGraph(actionGraph: ScoreInputs['actionGraph']) {
  const actions = Array.isArray(actionGraph) ? actionGraph : actionGraph?.actions || [];
  const byId = new Map<string, ScoreAction>();
  actions.forEach((action) => {
    if (!action?.id) return;
    byId.set(action.id, action);
  });
  return { actions, byId };
}

function resolveDeps(action: ScoreAction | undefined) {
  if (!action) return [] as string[];
  if (Array.isArray(action.deps)) return action.deps.filter(Boolean);
  if (Array.isArray(action.dependencies?.ids)) return action.dependencies?.ids?.filter(Boolean) || [];
  return [] as string[];
}

function resolveBuffer(action: ScoreAction | undefined) {
  const explicit = Number(action?.dependencies?.bufferMinutes);
  return Number.isFinite(explicit) ? Math.max(0, Math.round(explicit)) : 0;
}

function groupByAction(assignments: ScoreAssignment[]) {
  const byAction = new Map<string, ScoreAssignment[]>();
  assignments.forEach((assignment) => {
    if (!assignment?.actionId) return;
    if (!byAction.has(assignment.actionId)) byAction.set(assignment.actionId, []);
    byAction.get(assignment.actionId)?.push(assignment);
  });
  byAction.forEach((rows) => {
    rows.sort((a, b) => {
      if (a.dayKey !== b.dayKey) return a.dayKey.localeCompare(b.dayKey);
      if (a.startMin !== b.startMin) return a.startMin - b.startMin;
      return a.chunkIndex - b.chunkIndex;
    });
  });
  return byAction;
}

function groupByDay(assignments: ScoreAssignment[]) {
  const byDay = new Map<string, ScoreAssignment[]>();
  assignments.forEach((assignment) => {
    if (!assignment?.dayKey) return;
    if (!byDay.has(assignment.dayKey)) byDay.set(assignment.dayKey, []);
    byDay.get(assignment.dayKey)?.push(assignment);
  });
  byDay.forEach((rows) => {
    rows.sort((a, b) => {
      if (a.startMin !== b.startMin) return a.startMin - b.startMin;
      if ((a.actionId || '') !== (b.actionId || '')) return (a.actionId || '').localeCompare(b.actionId || '');
      return (a.chunkIndex || 0) - (b.chunkIndex || 0);
    });
  });
  return byDay;
}

export function scoreSchedule(inputs: ScoreInputs): ScoreBreakdown {
  const assignments = [...(inputs.assignments || [])].sort((a, b) => {
    if (a.dayKey !== b.dayKey) return a.dayKey.localeCompare(b.dayKey);
    if (a.startMin !== b.startMin) return a.startMin - b.startMin;
    if ((a.actionId || '') !== (b.actionId || '')) return (a.actionId || '').localeCompare(b.actionId || '');
    return (a.chunkIndex || 0) - (b.chunkIndex || 0);
  });
  const { byId: actionById } = normalizeGraph(inputs.actionGraph);
  const byAction = groupByAction(assignments);
  const byDay = groupByDay(assignments);

  let contextSwitchCount = 0;
  byDay.forEach((rows) => {
    let prevCategory: string | null = null;
    rows.forEach((row) => {
      const category = (row.category || actionById.get(row.actionId)?.category || 'UNKNOWN').toUpperCase();
      if (prevCategory && prevCategory !== category) contextSwitchCount += 1;
      prevCategory = category;
    });
  });

  const executionDays = Math.max(1, Number(inputs.constraints?.executionHorizonDays || 1));
  const dayLoads = new Array(executionDays).fill(0);
  for (let i = 0; i < executionDays; i += 1) {
    const dayKey = new Date((parseDay(inputs.horizons.executionWindowStartDayKey) as number) + i * 86400000)
      .toISOString()
      .slice(0, 10);
    const rows = byDay.get(dayKey) || [];
    dayLoads[i] = rows.reduce((sum, row) => sum + Math.max(1, Number(row.durationMin) || 0), 0);
  }
  const loadAvg = dayLoads.reduce((sum, value) => sum + value, 0) / Math.max(1, dayLoads.length);
  const loadVariance =
    dayLoads.reduce((sum, value) => sum + (value - loadAvg) * (value - loadAvg), 0) / Math.max(1, dayLoads.length);
  const dailyLoadStdDev = Math.sqrt(loadVariance);
  const spikePenalty = dayLoads.reduce((sum, value) => sum + Math.max(0, value - loadAvg - 60), 0) / 60;

  let depTightCount = 0;
  let dependencyRisk = 0;
  byAction.forEach((rows, actionId) => {
    const action = actionById.get(actionId);
    const deps = resolveDeps(action);
    if (!deps.length || !rows.length) return;
    const first = rows[0];
    const firstStart = (parseDay(first.dayKey) as number) + first.startMin * 60000;
    let cutoff = -Infinity;
    deps.forEach((depId) => {
      const depRows = byAction.get(depId) || [];
      depRows.forEach((row) => {
        const rowStart = (parseDay(row.dayKey) as number) + row.startMin * 60000;
        const rowEnd = rowStart + Math.max(1, Number(row.durationMin) || 30) * 60000;
        cutoff = Math.max(cutoff, rowEnd);
      });
    });
    if (!Number.isFinite(cutoff)) return;
    cutoff += resolveBuffer(action) * 60000;
    const marginMin = (firstStart - cutoff) / 60000;
    if (marginMin < 60) {
      depTightCount += 1;
      dependencyRisk += marginMin < 0 ? 5 + Math.abs(marginMin) / 10 : (60 - marginMin) / 60;
    }
  });

  let milestoneAtRiskCount = 0;
  let milestoneRisk = 0;
  const milestoneSlack = inputs.metricsContext?.milestoneWindowSlack?.byMilestone || {};
  (inputs.milestones || [])
    .slice()
    .sort((a, b) => (a.milestoneId || '').localeCompare(b.milestoneId || ''))
    .forEach((milestone) => {
      const slackRatio = Number(milestoneSlack[milestone.milestoneId || '']?.slackRatio);
      if (Number.isFinite(slackRatio)) {
        if (slackRatio < 1) {
          milestoneAtRiskCount += 1;
          milestoneRisk += 1 - slackRatio;
        }
        return;
      }
      const criticalIds = new Set([...(milestone.actionIds || []), ...(milestone.checkpointActionIds || [])]);
      if (!criticalIds.size) return;
      let total = 0;
      let placed = 0;
      criticalIds.forEach((id) => {
        total += Math.max(1, Number(actionById.get(id)?.estimateMin || 0));
        const rows = byAction.get(id) || [];
        const inWindow = rows.some(
          (row) => row.dayKey >= milestone.windowStartDayKey && row.dayKey <= milestone.windowEndDayKey
        );
        if (inWindow) placed += Math.max(1, Number(actionById.get(id)?.estimateMin || 0));
      });
      const ratio = placed / Math.max(1, total);
      if (ratio < 1) {
        milestoneAtRiskCount += 1;
        milestoneRisk += 1 - ratio;
      }
    });

  const outsideExecutionHorizonMinutes = Math.max(
    0,
    Number(inputs.metricsContext?.outsideExecutionHorizonEstimateMinTotal || 0)
  );
  const unplacedMinutes = Math.max(0, Number(inputs.metricsContext?.unplacedEstimateMinTotal || 0));
  const deferralPenalty = (outsideExecutionHorizonMinutes + unplacedMinutes) / 120;

  const capacityPerDay = Math.max(1, Number(inputs.constraints?.maxScheduledMinutesPerDay || 240));
  const feasibilityDays = Math.max(
    1,
    dayDiffInclusive(inputs.horizons.executionWindowStartDayKey, inputs.horizons.feasibilityWindowEndDayKey)
  );
  const deadlineOverrunDays = Math.max(
    0,
    Math.ceil((outsideExecutionHorizonMinutes + unplacedMinutes) / capacityPerDay) - feasibilityDays
  );
  const deadlineRisk =
    deadlineOverrunDays + (outsideExecutionHorizonMinutes + unplacedMinutes) / Math.max(1, capacityPerDay * 10);

  const components = {
    deadlineRisk: round(deadlineRisk),
    milestoneRisk: round(milestoneRisk),
    dependencyRisk: round(dependencyRisk),
    contextSwitching: round(contextSwitchCount),
    loadSmoothness: round(dailyLoadStdDev / 30 + spikePenalty),
    deferralPenalty: round(deferralPenalty),
  };

  const total = round(
    components.deadlineRisk * QUALITY_WEIGHTS.deadlineRisk +
      components.milestoneRisk * QUALITY_WEIGHTS.milestoneRisk +
      components.dependencyRisk * QUALITY_WEIGHTS.dependencyRisk +
      components.contextSwitching * QUALITY_WEIGHTS.contextSwitching +
      components.loadSmoothness * QUALITY_WEIGHTS.loadSmoothness +
      components.deferralPenalty * QUALITY_WEIGHTS.deferralPenalty
  );

  return {
    total,
    components,
    evidence: {
      deadlineOverrunDays,
      milestoneAtRiskCount,
      depTightCount,
      contextSwitchCount,
      dailyLoadStdDev: round(dailyLoadStdDev),
      outsideExecutionHorizonMinutes: round(outsideExecutionHorizonMinutes),
    },
  };
}
