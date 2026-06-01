const warnedMirrorKeys = new Set();
const PREPARATION_PREFIXES = new Set([
  'validate',
  'define',
  'review',
  'finalprep',
  'prep',
  'concept',
  'foundation',
  'comprehension',
]);
const EXECUTION_PREFIXES = new Set([
  'build',
  'launch',
  'production',
  'practice',
  'integration',
  'draft',
  'revise',
  'package',
  'publish',
  'asset',
  'channel',
  'sales',
  'raise',
  'peak',
  'event',
  'pipeline',
]);

function uniqueStrings(values = []) {
  return Array.from(
    new Set((Array.isArray(values) ? values : []).map((value) => String(value || '').trim()).filter(Boolean))
  );
}

function normalizeDependencyType(value) {
  const normalized = String(value || '')
    .trim()
    .toLowerCase();
  if (normalized === 'hard_gate' || normalized === 'hard-gate' || normalized === 'hard') {
    return 'hard_gate';
  }
  if (normalized === 'directional' || normalized === 'soft') {
    return 'directional';
  }
  if (normalized === 'informational' || normalized === 'info') {
    return 'informational';
  }
  return null;
}

function normalizeDependencyDetails(action = null, dependencyIds = []) {
  const rawDetails = Array.isArray(action?.dependencyDetails)
    ? action.dependencyDetails
    : Array.isArray(action?.dependencyEdges)
      ? action.dependencyEdges
      : [];
  const byId = new Map();
  rawDetails.forEach((detail) => {
    const actionId = String(detail?.actionId || detail?.dependencyId || detail?.id || '')
      .trim();
    if (!actionId) {
      return;
    }
    byId.set(actionId, {
      actionId,
      dependencyType: normalizeDependencyType(detail?.dependencyType) || 'hard_gate',
    });
  });
  dependencyIds.forEach((dependencyId) => {
    if (!byId.has(dependencyId)) {
      byId.set(dependencyId, {
        actionId: dependencyId,
        dependencyType: 'hard_gate',
      });
    }
  });
  return dependencyIds
    .map((dependencyId) => byId.get(dependencyId))
    .filter((detail) => detail && detail.actionId);
}

function normalizeCanonicalActionType(value) {
  const raw = String(value || '')
    .trim()
    .toLowerCase();
  if (raw === 'preparation' || raw === 'prep' || raw === 'readiness') {
    return 'preparation';
  }
  if (raw === 'execution' || raw === 'execute') {
    return 'execution';
  }
  return null;
}

function inferLegacyActionType(action = null) {
  const normalizedKnown = normalizeCanonicalActionType(action?.actionType || action?.type);
  if (normalizedKnown) {
    return normalizedKnown;
  }
  const actionId = String(action?.id || '')
    .trim()
    .toLowerCase();
  const prefix = actionId.includes(':') ? actionId.split(':')[0] : '';
  if (PREPARATION_PREFIXES.has(prefix)) {
    return 'preparation';
  }
  if (EXECUTION_PREFIXES.has(prefix)) {
    return 'execution';
  }

  const title = String(action?.title || '')
    .trim()
    .toLowerCase();
  if (!title) {
    return null;
  }
  if (
    /^(verify|audit|define|prepare|review|capture|map|scope|clarify|assess|outline|plan|organize)\b/.test(title) ||
    /\b(readiness|checklist|criteria|protocol|baseline|eligibility|boundary|logistics)\b/.test(title)
  ) {
    return 'preparation';
  }
  if (
    /^(build|launch|deploy|write|draft|record|produce|send|complete|import|answer|design|revise|apply|solve|publish)\b/.test(
      title
    )
  ) {
    return 'execution';
  }
  return null;
}

function normalizeCanonicalAction(action = null) {
  if (!action || typeof action !== 'object') {
    return action;
  }
  const dependencies = uniqueStrings(action?.dependencies || action?.dependsOn || action?.dependencyIds || []);
  const dependencyDetails = normalizeDependencyDetails(action, dependencies);
  const readinessConditions = uniqueStrings([
    ...(Array.isArray(action?.readinessConditions) ? action.readinessConditions : []),
    action?.readinessCondition,
    action?.readiness,
  ]);
  const assumptions = uniqueStrings([
    ...(Array.isArray(action?.assumptions) ? action.assumptions : []),
    action?.assumption,
  ]);
  const actionType = inferLegacyActionType(action);
  return {
    ...action,
    dependencies,
    dependencyIds: dependencies,
    dependencyDetails,
    readinessConditions,
    readinessCondition: readinessConditions[0] || null,
    assumptions,
    assumption: assumptions[0] || null,
    ...(actionType ? { actionType } : {}),
  };
}

function warnMirrorUsage(key, detail) {
  const env = typeof process !== 'undefined' ? process.env?.NODE_ENV : undefined;
  const isWarnEnv = env === 'development' || env === 'test' || !env;
  if (!isWarnEnv) {
    return;
  }
  if (typeof process !== 'undefined' && process.env?.JERICHO_DISABLE_GENERATE_TRACE === '1') {
    return;
  }
  if (warnedMirrorKeys.has(key)) {
    return;
  }
  warnedMirrorKeys.add(key);
  // eslint-disable-next-line no-console
  console.warn(`[jericho:sot] ${key}`, detail);
}

export function resetMirrorWarningsForTests() {
  warnedMirrorKeys.clear();
}

export function getActiveGoalOutcomes(cyclesById = {}) {
  const outcomes = [];
  if (!cyclesById || typeof cyclesById !== 'object') {
    return outcomes;
  }
  Object.values(cyclesById).forEach((cycle) => {
    if (!cycle || cycle.status !== 'active') {
      return;
    }
    const contract = cycle.goalContract || {};
    const outcomeText = (contract.terminalOutcome?.text || contract.goalText || contract.goalLabel || '')
      .toString()
      .trim();
    if (outcomeText) {
      outcomes.push(outcomeText);
    }
  });
  return outcomes;
}

export function getCanonicalCycleContract(
  activeCycle = null,
  goalExecutionContract = null,
  legacyCycleContract = null
) {
  const legacyContract = legacyCycleContract || activeCycle?.contract || null;
  if (activeCycle?.goalContract && goalExecutionContract) {
    warnMirrorUsage('contract-mirror-present', { reason: 'canonical present alongside mirror' });
    const canonicalGoalId = activeCycle.goalContract?.goalId || null;
    const mirrorGoalId = goalExecutionContract?.goalId || null;
    if (canonicalGoalId && mirrorGoalId && canonicalGoalId !== mirrorGoalId) {
      warnMirrorUsage('contract-mirror-drift', { canonicalGoalId, mirrorGoalId });
    }
  }
  if (activeCycle?.goalContract && legacyContract) {
    warnMirrorUsage('contract-adapter-present', {
      reason: 'canonical present alongside legacy cycle.contract adapter',
    });
  }
  if (activeCycle?.goalContract) {
    const canonical = activeCycle.goalContract;
    const mirror = goalExecutionContract;
    if (!mirror) {
      return canonical;
    }
    const needsMerge = (!canonical.startDayKey && mirror.startDayKey) || (!canonical.endDayKey && mirror.endDayKey);
    if (!needsMerge) {
      return canonical;
    }
    return {
      ...canonical,
      startDayKey: canonical.startDayKey || mirror.startDayKey || null,
      endDayKey: canonical.endDayKey || mirror.endDayKey || null,
    };
  }
  if (goalExecutionContract) {
    warnMirrorUsage('contract-mirror-read', { reason: 'canonical missing, fallback to goalExecutionContract' });
    return goalExecutionContract;
  }
  if (legacyContract) {
    warnMirrorUsage('contract-adapter-read', { reason: 'canonical missing, fallback to cycle.contract adapter' });
    return legacyContract;
  }
  return null;
}

export function getCanonicalCycleActions(cycle = null) {
  if (!cycle) {
    return [];
  }
  if (
    Array.isArray(cycle.actions) &&
    cycle.actions.length &&
    Array.isArray(cycle.llmActionGraph?.actions) &&
    cycle.llmActionGraph.actions.length
  ) {
    warnMirrorUsage('actions-mirror-present', {
      reason: 'canonical actions present alongside llmActionGraph.actions mirror',
    });
    const canonicalFirst = cycle.actions[0]?.id || null;
    const mirrorFirst = cycle.llmActionGraph.actions[0]?.id || null;
    if (canonicalFirst && mirrorFirst && canonicalFirst !== mirrorFirst) {
      warnMirrorUsage('actions-mirror-drift', { canonicalFirst, mirrorFirst });
    }
  }
  if (Array.isArray(cycle.actions) && cycle.actions.length) {
    return cycle.actions.map((action) => normalizeCanonicalAction(action));
  }
  if (Array.isArray(cycle.llmActionGraph?.actions) && cycle.llmActionGraph.actions.length) {
    return cycle.llmActionGraph.actions.map((action) => normalizeCanonicalAction(action));
  }
  return [];
}

export function getCanonicalCycleDeliverables(deliverablesByCycleId = {}, cycleId = null, cycle = null) {
  if (cycleId && Array.isArray(deliverablesByCycleId?.[cycleId]?.deliverables)) {
    return deliverablesByCycleId[cycleId].deliverables;
  }
  if (Array.isArray(cycle?.strategy?.deliverables)) {
    return cycle.strategy.deliverables;
  }
  return [];
}

/*
 * Canonical source of truth for schedule proposals is `proposedBlocks`.
 *
 * `suggestedBlocks` is a legacy compatibility mirror only. All new reads
 * must use `proposedBlocks` directly or go through this selector. New tests
 * should not seed `suggestedBlocks`, and new UI code should not read it
 * directly. The mirror remains only for backward compatibility and is a
 * known Yellow risk surface.
 */
export function getCanonicalProposedBlocks(proposedBlocks = [], suggestedBlocks = []) {
  if (
    Array.isArray(proposedBlocks) &&
    Array.isArray(suggestedBlocks) &&
    proposedBlocks.length &&
    suggestedBlocks.length
  ) {
    warnMirrorUsage('proposed-mirror-present', {
      reason: 'canonical proposedBlocks present alongside suggestedBlocks mirror',
    });
    const canonicalFirst = proposedBlocks[0]?.id || null;
    const mirrorFirst = suggestedBlocks[0]?.id || null;
    if (canonicalFirst && mirrorFirst && canonicalFirst !== mirrorFirst) {
      warnMirrorUsage('proposed-mirror-drift', { canonicalFirst, mirrorFirst });
    }
  }
  if (Array.isArray(proposedBlocks)) {
    return proposedBlocks;
  }
  // Temporary compatibility adapter while legacy mirrors remain.
  if (Array.isArray(suggestedBlocks)) {
    warnMirrorUsage('proposed-mirror-read', { reason: 'canonical missing, fallback to suggestedBlocks' });
    return suggestedBlocks;
  }
  return [];
}

function toDayKey(value) {
  const text = String(value || '').trim();
  if (!text) {
    return '';
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    return text;
  }
  return text.slice(0, 10);
}

function daySpanInclusive(startDayKey, endDayKey) {
  const startMs = Date.parse(`${startDayKey}T00:00:00.000Z`);
  const endMs = Date.parse(`${endDayKey}T00:00:00.000Z`);
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs < startMs) {
    return null;
  }
  return Math.floor((endMs - startMs) / 86400000) + 1;
}

function monthKeyFromDayKey(dayKey) {
  return String(dayKey || '').slice(0, 7);
}

function enumerateMonthKeys(startDayKey, endDayKey) {
  const startText = monthKeyFromDayKey(startDayKey);
  const endText = monthKeyFromDayKey(endDayKey);
  if (!startText || !endText) {
    return [];
  }
  const [startYear, startMonth] = startText.split('-').map(Number);
  const [endYear, endMonth] = endText.split('-').map(Number);
  if (
    !Number.isFinite(startYear) ||
    !Number.isFinite(startMonth) ||
    !Number.isFinite(endYear) ||
    !Number.isFinite(endMonth)
  ) {
    return [];
  }
  const cursor = new Date(Date.UTC(startYear, startMonth - 1, 1));
  const end = new Date(Date.UTC(endYear, endMonth - 1, 1));
  if (cursor > end) {
    return [];
  }
  const monthKeys = [];
  while (cursor <= end) {
    monthKeys.push(`${cursor.getUTCFullYear()}-${String(cursor.getUTCMonth() + 1).padStart(2, '0')}`);
    cursor.setUTCMonth(cursor.getUTCMonth() + 1);
  }
  return monthKeys;
}

function inferPhaseMode(actionTypes = []) {
  const normalized = uniqueStrings(actionTypes);
  if (normalized.length === 0) {
    return 'unknown';
  }
  if (normalized.every((entry) => entry === 'preparation')) {
    return 'preparation';
  }
  if (normalized.every((entry) => entry === 'execution')) {
    return 'execution';
  }
  return 'mixed';
}

function buildLongHorizonUncertainty(phases = []) {
  if (!Array.isArray(phases) || phases.length < 2) {
    return {
      source: 'none',
      bands: [],
    };
  }
  return {
    source: 'phase_bands',
    bands: phases.map((phase, index) => ({
      id: `uncertainty-${phase.id}`,
      certainty: index === 0 ? 'firm' : 'provisional',
      uncertaintyScope: 'phase',
      temporalConfidenceBand: index === 0 ? 'firm' : 'provisional',
      phaseId: phase.id,
      phaseTitle: phase.title,
      startDayKey: phase.startDayKey || null,
      endDayKey: phase.endDayKey || null,
      reasonCode: index === 0 ? 'NEAR_HORIZON_STRUCTURE_FIRM' : 'FUTURE_PHASE_STRUCTURE_PROVISIONAL',
    })),
  };
}

function buildLongHorizonCheckpoints(phases = []) {
  if (!Array.isArray(phases) || phases.length < 2) {
    return [];
  }
  return phases
    .slice(0, -1)
    .map((phase, index) => {
      const nextPhase = phases[index + 1];
      const checkpointDayKey = phase.endDayKey || nextPhase?.startDayKey || null;
      if (!nextPhase || !checkpointDayKey) {
        return null;
      }
      return {
        checkpointId: `checkpoint-${phase.id}-to-${nextPhase.id}`,
        checkpointLabel: `Review ${phase.title} before ${nextPhase.title}`,
        checkpointDate: checkpointDayKey,
        checkpointWindow: {
          startDayKey: phase.endDayKey || checkpointDayKey,
          endDayKey: nextPhase.startDayKey || checkpointDayKey,
        },
        checkpointReason: 'phase_transition_review',
        linkedPhaseId: nextPhase.id,
        precedingPhaseId: phase.id,
      };
    })
    .filter(Boolean);
}

function evaluateLongHorizonSaturation({ isLongHorizon, monthKeys = [], pacingBuckets = [], totalBlocks = 0 }) {
  if (!isLongHorizon || monthKeys.length === 0) {
    return {
      source: 'none',
      saturationShape: 'insufficient_data',
      overloadedSegments: [],
      understructuredSegments: [],
      densityBandSummary: [],
    };
  }

  const bucketById = new Map(
    (Array.isArray(pacingBuckets) ? pacingBuckets : []).map((bucket) => [bucket.bucketId, bucket])
  );
  const densityBandSummary = monthKeys.map((monthKey) => {
    const bucket = bucketById.get(monthKey);
    return {
      bucketId: monthKey,
      label: monthKey,
      blockCount: Number(bucket?.blockCount || 0),
      totalMinutes: Number(bucket?.totalMinutes || 0),
    };
  });
  const averageBlocks = densityBandSummary.length > 0 ? totalBlocks / densityBandSummary.length : 0;
  const overloadedSegments = densityBandSummary
    .filter((bucket) => bucket.blockCount >= Math.max(4, Math.ceil(averageBlocks * 1.75)))
    .map((bucket) => bucket.bucketId);
  const zeroBuckets = densityBandSummary.filter((bucket) => bucket.blockCount === 0).map((bucket) => bucket.bucketId);
  const hasEnoughStructureForUnderloadCheck = densityBandSummary.length >= 3 && totalBlocks > 0;
  const understructuredSegments = hasEnoughStructureForUnderloadCheck
    ? zeroBuckets.filter(() => totalBlocks <= densityBandSummary.length * 3 || zeroBuckets.length >= 2)
    : [];

  let saturationShape = 'balanced';
  if (totalBlocks === 0) {
    saturationShape = 'insufficient_data';
  } else if (overloadedSegments.length > 0 && understructuredSegments.length > 0) {
    saturationShape = 'uneven';
  } else if (overloadedSegments.length > 0) {
    saturationShape = 'overloaded';
  } else if (understructuredSegments.length > 0) {
    saturationShape = 'understructured';
  }

  return {
    source: 'month_buckets',
    saturationShape,
    overloadedSegments,
    understructuredSegments,
    densityBandSummary,
  };
}

function evaluatePrepExecutionBalance(phases = []) {
  const normalizedPhases = Array.isArray(phases) ? phases : [];
  const prepCount = normalizedPhases.filter((phase) => phase.phaseMode === 'preparation').length;
  const executionCount = normalizedPhases.filter((phase) => phase.phaseMode === 'execution').length;
  if (normalizedPhases.length === 0 || (prepCount === 0 && executionCount === 0)) {
    return { shape: 'unknown', prepCount, executionCount };
  }
  if (prepCount > 0 && executionCount > 0) {
    const firstExecutionIndex = normalizedPhases.findIndex((phase) => phase.phaseMode === 'execution');
    const lastPreparationIndex = normalizedPhases
      .map((phase, index) => ({ phase, index }))
      .filter(({ phase }) => phase.phaseMode === 'preparation')
      .map(({ index }) => index)
      .pop();
    if (
      firstExecutionIndex !== -1 &&
      lastPreparationIndex !== undefined &&
      lastPreparationIndex !== null &&
      firstExecutionIndex < lastPreparationIndex
    ) {
      return { shape: 'sequence_incoherent', prepCount, executionCount };
    }
    return { shape: 'balanced', prepCount, executionCount };
  }
  if (prepCount > 0) {
    return { shape: 'prep_heavy', prepCount, executionCount };
  }
  return { shape: 'execution_heavy', prepCount, executionCount };
}

function evaluateLongTermQuality({
  isLongHorizon,
  phases = [],
  pacingShape = 'insufficient_data',
  uncertainty = null,
  checkpoints = [],
  saturation = null,
  prepExecution = null,
  totalBlocks = 0,
}) {
  if (!isLongHorizon) {
    return {
      state: 'not_applicable',
      reasonCodes: [],
    };
  }

  const reasonCodes = [];
  if (phases.length === 0) {
    reasonCodes.push('LONG_HORIZON_PHASE_STRUCTURE_MISSING');
  }
  if ((uncertainty?.bands || []).length === 0) {
    reasonCodes.push('LONG_HORIZON_UNCERTAINTY_IMPLICIT');
  }
  if ((checkpoints || []).length === 0) {
    reasonCodes.push('LONG_HORIZON_CHECKPOINTS_MISSING');
  }
  if (pacingShape === 'front_loaded' || pacingShape === 'back_loaded' || pacingShape === 'clustered') {
    reasonCodes.push('LONG_HORIZON_PACING_WEAK');
  }
  if (saturation?.saturationShape === 'overloaded' || saturation?.saturationShape === 'uneven') {
    reasonCodes.push('LONG_HORIZON_OVERLOADED');
  }
  if (saturation?.saturationShape === 'understructured') {
    reasonCodes.push('LONG_HORIZON_UNDERSTRUCTURED');
  }
  if (
    prepExecution?.shape === 'prep_heavy' ||
    prepExecution?.shape === 'execution_heavy' ||
    prepExecution?.shape === 'sequence_incoherent'
  ) {
    reasonCodes.push('LONG_HORIZON_PREP_EXECUTION_IMBALANCE');
  }
  if (totalBlocks < 2) {
    reasonCodes.push('LONG_HORIZON_TEMPORAL_TRUTH_THIN');
  }

  let state = 'trusted';
  if (reasonCodes.includes('LONG_HORIZON_TEMPORAL_TRUTH_THIN') || (phases.length === 0 && totalBlocks < 2)) {
    state = 'withheld';
  } else if (
    reasonCodes.includes('LONG_HORIZON_OVERLOADED') ||
    reasonCodes.includes('LONG_HORIZON_UNDERSTRUCTURED') ||
    reasonCodes.includes('LONG_HORIZON_PACING_WEAK') ||
    reasonCodes.includes('LONG_HORIZON_PHASE_STRUCTURE_MISSING')
  ) {
    state = 'degraded';
  } else if (reasonCodes.length > 0) {
    state = 'provisional';
  }

  return {
    state,
    reasonCodes,
  };
}

export function getCanonicalLongHorizonPlanMetadata(cycle = null, workspace = null, blocks = []) {
  const contract = cycle?.goalContract || null;
  const startDayKey = toDayKey(
    contract?.startDayKey || contract?.startDateISO || cycle?.goalGovernanceContract?.activeFromISO || ''
  );
  const endDayKey = toDayKey(
    contract?.endDayKey ||
      contract?.deadline?.dayKey ||
      contract?.deadlineISO ||
      cycle?.goalGovernanceContract?.activeUntilISO ||
      ''
  );
  const horizonDays = startDayKey && endDayKey ? daySpanInclusive(startDayKey, endDayKey) : null;
  const isLongHorizon = Number(horizonDays || 0) >= 42;
  const canonicalBlocks = (Array.isArray(blocks) ? blocks : [])
    .map((block) => ({
      ...block,
      dayKey: toDayKey(block?.start || block?.startISO || block?.dateISO || ''),
      actionId: String(block?.actionId || '').trim(),
      deliverableId: String(block?.deliverableId || '').trim(),
      durationMinutes: Number(block?.durationMinutes || 0),
    }))
    .filter((block) => block.dayKey);
  const actions = getCanonicalCycleActions(cycle);
  const actionById = new Map(actions.map((action) => [String(action?.id || '').trim(), action]).filter(([id]) => id));
  const deliverableByActionId = new Map();
  const deliverables = Array.isArray(workspace?.deliverables) ? workspace.deliverables : [];
  deliverables.forEach((deliverable) => {
    const deliverableId = String(deliverable?.id || '').trim();
    uniqueStrings(deliverable?.actionIds || []).forEach((actionId) => {
      deliverableByActionId.set(actionId, deliverableId);
    });
  });

  const scaffoldGroups = Array.isArray(workspace?.scaffoldGroups) ? workspace.scaffoldGroups : [];
  const phases =
    isLongHorizon && scaffoldGroups.length >= 2
      ? scaffoldGroups
          .map((group, index) => {
            const actionIds = uniqueStrings(group?.actionIds || []);
            const deliverableIds = uniqueStrings([
              ...(Array.isArray(group?.deliverableIds) ? group.deliverableIds : []),
              ...actionIds.map((actionId) => deliverableByActionId.get(actionId)).filter(Boolean),
            ]);
            const phaseBlocks = canonicalBlocks.filter((block) => {
              if (block.actionId && actionIds.includes(block.actionId)) {
                return true;
              }
              if (block.deliverableId && deliverableIds.includes(block.deliverableId)) {
                return true;
              }
              return false;
            });
            const blockDayKeys = phaseBlocks
              .map((block) => block.dayKey)
              .filter(Boolean)
              .sort();
            const actionTypes = actionIds
              .map((actionId) => actionById.get(actionId)?.actionType)
              .filter((value) => value === 'preparation' || value === 'execution');
            return {
              id: String(group?.id || '').trim() || `phase-${index + 1}`,
              title: String(group?.title || '').trim() || `Phase ${index + 1}`,
              type: String(group?.type || '').trim() || 'phase',
              actionIds,
              deliverableIds,
              phaseMode: inferPhaseMode(actionTypes),
              scheduledBlockCount: phaseBlocks.length,
              startDayKey: blockDayKeys[0] || null,
              endDayKey: blockDayKeys[blockDayKeys.length - 1] || null,
            };
          })
          .filter((phase) => phase.actionIds.length > 0 || phase.deliverableIds.length > 0)
      : [];

  const monthKeys = isLongHorizon ? enumerateMonthKeys(startDayKey, endDayKey) : [];
  const pacingMap = canonicalBlocks.reduce((map, block) => {
    const monthKey = monthKeyFromDayKey(block.dayKey);
    if (!monthKey) {
      return map;
    }
    const entry = map.get(monthKey) || {
      bucketId: monthKey,
      label: monthKey,
      blockCount: 0,
      totalMinutes: 0,
    };
    entry.blockCount += 1;
    entry.totalMinutes += Number.isFinite(block.durationMinutes) ? block.durationMinutes : 0;
    map.set(monthKey, entry);
    return map;
  }, new Map());
  const pacingBuckets = isLongHorizon
    ? monthKeys.map(
        (monthKey) =>
          pacingMap.get(monthKey) || {
            bucketId: monthKey,
            label: monthKey,
            blockCount: 0,
            totalMinutes: 0,
          }
      )
    : [];

  const totalBlocks = pacingBuckets.reduce((sum, bucket) => sum + bucket.blockCount, 0);
  const firstBucketCount = pacingBuckets[0]?.blockCount || 0;
  const lastBucketCount = pacingBuckets[pacingBuckets.length - 1]?.blockCount || 0;
  const maxBucketCount = pacingBuckets.reduce((maxValue, bucket) => Math.max(maxValue, bucket.blockCount), 0);
  const nonEmptyBucketCount = pacingBuckets.filter((bucket) => bucket.blockCount > 0).length;
  let pacingShape = 'insufficient_data';
  if (pacingBuckets.length > 0 && totalBlocks > 0) {
    if (firstBucketCount / totalBlocks >= 0.5 && firstBucketCount > lastBucketCount) {
      pacingShape = 'front_loaded';
    } else if (lastBucketCount / totalBlocks >= 0.5 && lastBucketCount > firstBucketCount) {
      pacingShape = 'back_loaded';
    } else if (maxBucketCount / totalBlocks >= 0.6 && nonEmptyBucketCount <= 2) {
      pacingShape = 'clustered';
    } else {
      pacingShape = 'distributed';
    }
  }

  const uncertainty = buildLongHorizonUncertainty(phases);
  const checkpoints = buildLongHorizonCheckpoints(phases);
  const saturation = evaluateLongHorizonSaturation({ isLongHorizon, monthKeys, pacingBuckets, totalBlocks });
  const prepExecution = evaluatePrepExecutionBalance(phases);
  const quality = evaluateLongTermQuality({
    isLongHorizon,
    phases,
    pacingShape,
    uncertainty,
    checkpoints,
    saturation,
    prepExecution,
    totalBlocks,
  });

  return {
    isLongHorizon,
    horizonDays,
    phaseSource: phases.length > 0 ? 'scaffold_groups' : 'none',
    phases,
    uncertainty,
    checkpoints,
    saturation,
    prepExecution,
    quality,
    pacing: {
      buckets: pacingBuckets,
      shape: pacingShape,
      totalBlocks,
      nonEmptyBucketCount,
    },
  };
}
