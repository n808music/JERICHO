export type ScaleScenarioConfig = {
  scenarioId: string;
  horizon: { startDayKey: string; endDayKey: string };
  executionHorizonDays: number;
  maxScheduledMinutesPerDay?: number;
  maxScheduledMinutesPerWeek?: number;
  actions: {
    count: number;
    estimatePatternMin: number[];
    categoryPattern: string[];
    deps: {
      mode: 'chain' | 'fan_in' | 'fan_out' | 'layered';
      depth?: number;
      fan?: number;
    };
  };
  milestones?: {
    count: number;
    windowDays: number;
    spacingDays: number;
    attachEveryNActions: number;
    checkpointActionIds?: 'auto';
  };
  optimizerMode?: 'off' | 'on';
  qualityPolicyId?: string;
  autoPolicySelection?: boolean;
  enableMilestonePacing?: boolean;
  enableHistoryPolicySelection?: boolean;
  historyWindowCycles?: number;
  historyInfluenceStrength?: 'light' | 'standard' | 'strong';
};

function actionId(i: number) {
  return `A${String(i + 1).padStart(4, '0')}`;
}

function addDays(dayKey: string, delta: number) {
  const ms = Date.parse(`${dayKey}T00:00:00.000Z`);
  if (!Number.isFinite(ms)) return dayKey;
  const d = new Date(ms + delta * 86400000);
  return d.toISOString().slice(0, 10);
}

function buildDeps(config: ScaleScenarioConfig, i: number): string[] {
  const { mode, fan = 3, depth = 10 } = config.actions.deps;
  if (i === 0) return [];
  if (mode === 'chain') return [actionId(i - 1)];
  if (mode === 'fan_out') return [actionId(0)];
  if (mode === 'fan_in') {
    const deps: string[] = [];
    for (let k = 1; k <= fan; k += 1) {
      const idx = i - k;
      if (idx >= 0) deps.push(actionId(idx));
    }
    return deps.sort();
  }
  const layerSize = Math.max(1, Math.ceil(config.actions.count / Math.max(1, depth)));
  const layer = Math.floor(i / layerSize);
  if (layer === 0) return [];
  const prevLayerStart = (layer - 1) * layerSize;
  const deps: string[] = [];
  for (let k = 0; k < fan; k += 1) {
    const idx = prevLayerStart + ((i + k) % layerSize);
    if (idx >= 0 && idx < i) deps.push(actionId(idx));
  }
  return [...new Set(deps)].sort();
}

export function buildScaleScenario(config: ScaleScenarioConfig) {
  const actions = Array.from({ length: config.actions.count }, (_, i) => ({
    id: actionId(i),
    estimateMin: config.actions.estimatePatternMin[i % config.actions.estimatePatternMin.length],
    category: config.actions.categoryPattern[i % config.actions.categoryPattern.length],
    dependencies: buildDeps(config, i),
  }));

  const milestones = Array.from({ length: config.milestones?.count || 0 }, (_, i) => {
    const start = addDays(config.horizon.startDayKey, i * (config.milestones?.spacingDays || 28));
    const end = addDays(start, (config.milestones?.windowDays || 14) - 1);
    const attachEvery = Math.max(1, config.milestones?.attachEveryNActions || 20);
    const actionIds = actions.filter((_, idx) => idx % attachEvery === i % attachEvery).map((a) => a.id);
    return {
      milestoneId: `M${String(i + 1).padStart(2, '0')}`,
      windowStartDayKey: start,
      windowEndDayKey: end,
      actionIds,
      checkpointActionIds: config.milestones?.checkpointActionIds === 'auto' ? [] : [],
    };
  });

  return {
    scenarioId: config.scenarioId,
    planDraft: {
      id: `plan-${config.scenarioId}`,
      goalId: `goal-${config.scenarioId}`,
      status: 'calibrated',
      createdAtISO: `${config.horizon.startDayKey}T00:00:00.000Z`,
      blocksPerWeek: Math.max(6, Math.ceil(config.actions.count / 8)),
      totalMinutesPerWeek: Math.max(180, Math.ceil(config.actions.count / 8) * 45),
      primaryDomain: 'FOCUS',
      archetype: 'scale',
      templates: [{ title: 'Scale Task', domain: 'Focus', durationMinutes: 45, frequency: 'weekly', reason: 'deterministic' }],
      horizonDays: config.executionHorizonDays,
      daysPerWeek: 7,
      qualityPolicyId: config.qualityPolicyId || 'BALANCED',
      autoPolicySelection: config.autoPolicySelection === true,
      enableHistoryPolicySelection: config.enableHistoryPolicySelection === true,
      historyWindowCycles: Number.isFinite(config.historyWindowCycles) ? config.historyWindowCycles : 5,
      historyInfluenceStrength: config.historyInfluenceStrength || 'standard',
      enableQualityOptimizer: config.optimizerMode === 'on',
      optimizerMaxIterations: 2,
      optimizerMaxCandidates: 30,
      enableMilestonePacing: config.enableMilestonePacing === true,
      pacingCadenceMode: 'adaptive',
      actions,
      milestones,
      maxScheduledMinutesPerDay: config.maxScheduledMinutesPerDay,
      maxScheduledMinutesPerWeek: config.maxScheduledMinutesPerWeek,
      executionHorizonDays: config.executionHorizonDays,
    },
    goalContractInputs: {
      goalId: `goal-${config.scenarioId}`,
      goalText: `Scale scenario ${config.scenarioId}`,
      horizonDays: config.executionHorizonDays,
      domains: ['Focus', 'Creation'],
      startDayKey: config.horizon.startDayKey,
      endDayKey: config.horizon.endDayKey,
      successDefinition: 'Scale validation',
    },
    expectedTargets: {
      runtime: {},
    },
  };
}
