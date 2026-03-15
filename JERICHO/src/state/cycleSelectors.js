const warnedMirrorKeys = new Set();

function warnMirrorUsage(key, detail) {
  const env = typeof process !== 'undefined' ? process.env?.NODE_ENV : undefined;
  const isWarnEnv = env === 'development' || env === 'test' || !env;
  if (!isWarnEnv) return;
  if (warnedMirrorKeys.has(key)) return;
  warnedMirrorKeys.add(key);
  // eslint-disable-next-line no-console
  console.warn(`[jericho:sot] ${key}`, detail);
}

export function resetMirrorWarningsForTests() {
  warnedMirrorKeys.clear();
}

export function getActiveGoalOutcomes(cyclesById = {}) {
  const outcomes = [];
  if (!cyclesById || typeof cyclesById !== 'object') return outcomes;
  Object.values(cyclesById).forEach((cycle) => {
    if (!cycle || cycle.status !== 'active') return;
    const contract = cycle.goalContract || {};
    const outcomeText =
      (contract.terminalOutcome?.text || contract.goalText || contract.goalLabel || '').toString().trim();
    if (outcomeText) {
      outcomes.push(outcomeText);
    }
  });
  return outcomes;
}

export function getCanonicalCycleContract(activeCycle = null, goalExecutionContract = null, legacyCycleContract = null) {
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
    warnMirrorUsage('contract-adapter-present', { reason: 'canonical present alongside legacy cycle.contract adapter' });
  }
  if (activeCycle?.goalContract) {
    const canonical = activeCycle.goalContract;
    const mirror = goalExecutionContract;
    if (!mirror) return canonical;
    const needsMerge =
      (!canonical.startDayKey && mirror.startDayKey) ||
      (!canonical.endDayKey && mirror.endDayKey);
    if (!needsMerge) return canonical;
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
  if (!cycle) return [];
  if (
    Array.isArray(cycle.actions) &&
    cycle.actions.length &&
    Array.isArray(cycle.llmActionGraph?.actions) &&
    cycle.llmActionGraph.actions.length
  ) {
    warnMirrorUsage('actions-mirror-present', { reason: 'canonical actions present alongside llmActionGraph.actions mirror' });
    const canonicalFirst = cycle.actions[0]?.id || null;
    const mirrorFirst = cycle.llmActionGraph.actions[0]?.id || null;
    if (canonicalFirst && mirrorFirst && canonicalFirst !== mirrorFirst) {
      warnMirrorUsage('actions-mirror-drift', { canonicalFirst, mirrorFirst });
    }
  }
  if (Array.isArray(cycle.actions) && cycle.actions.length) return cycle.actions;
  if (Array.isArray(cycle.llmActionGraph?.actions) && cycle.llmActionGraph.actions.length) {
    return cycle.llmActionGraph.actions;
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

export function getCanonicalProposedBlocks(proposedBlocks = [], suggestedBlocks = []) {
  if (Array.isArray(proposedBlocks) && Array.isArray(suggestedBlocks) && proposedBlocks.length && suggestedBlocks.length) {
    warnMirrorUsage('proposed-mirror-present', { reason: 'canonical proposedBlocks present alongside suggestedBlocks mirror' });
    const canonicalFirst = proposedBlocks[0]?.id || null;
    const mirrorFirst = suggestedBlocks[0]?.id || null;
    if (canonicalFirst && mirrorFirst && canonicalFirst !== mirrorFirst) {
      warnMirrorUsage('proposed-mirror-drift', { canonicalFirst, mirrorFirst });
    }
  }
  if (Array.isArray(proposedBlocks)) return proposedBlocks;
  // Temporary compatibility adapter while legacy mirrors remain.
  if (Array.isArray(suggestedBlocks)) {
    warnMirrorUsage('proposed-mirror-read', { reason: 'canonical missing, fallback to suggestedBlocks' });
    return suggestedBlocks;
  }
  return [];
}
