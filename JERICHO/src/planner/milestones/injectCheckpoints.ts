export type MilestoneAction = {
  id: string;
  estimateMin?: number;
  category?: string;
  dependencies?: string[];
  isCheckpoint?: boolean;
  milestoneId?: string;
};

export type Milestone = {
  milestoneId: string;
  windowStartDayKey: string;
  windowEndDayKey: string;
  checkpointActionIds?: string[];
  actionIds?: string[];
};

export type InjectCheckpointsInput = {
  actions: MilestoneAction[];
  milestones: Milestone[];
  constraints?: { maxScheduledMinutesPerDay?: number; maxScheduledMinutesPerWeek?: number };
  horizons: { startDayKey: string; endDayKey: string };
  policy?: { cadenceMode?: 'weekly' | 'biweekly' | 'adaptive' };
};

function daysBetween(start: string, end: string) {
  const s = Date.parse(`${start}T00:00:00.000Z`);
  const e = Date.parse(`${end}T00:00:00.000Z`);
  if (!Number.isFinite(s) || !Number.isFinite(e)) return 0;
  return Math.max(0, Math.round((e - s) / 86400000));
}

function inferIntervalDays(windowDays: number, mode?: 'weekly' | 'biweekly' | 'adaptive') {
  if (mode === 'weekly') return 7;
  if (mode === 'biweekly') return 14;
  if (mode === 'adaptive') {
    if (windowDays <= 120) return 7;
    if (windowDays <= 240) return 14;
    return 28;
  }
  if (windowDays <= 120) return 7;
  if (windowDays <= 240) return 14;
  return 28;
}

function topoOrder(actions: MilestoneAction[]) {
  const byId = new Map(actions.map((a) => [a.id, a]));
  const inDegree = new Map<string, number>();
  const next = new Map<string, string[]>();
  actions.forEach((a) => {
    inDegree.set(a.id, 0);
    next.set(a.id, []);
  });
  actions.forEach((a) => {
    (a.dependencies || []).forEach((dep) => {
      if (!byId.has(dep)) return;
      inDegree.set(a.id, (inDegree.get(a.id) || 0) + 1);
      next.get(dep)?.push(a.id);
    });
  });
  const queue = [...actions.map((a) => a.id)].filter((id) => (inDegree.get(id) || 0) === 0).sort();
  const order: string[] = [];
  while (queue.length) {
    const id = queue.shift()!;
    order.push(id);
    (next.get(id) || []).sort().forEach((n) => {
      inDegree.set(n, (inDegree.get(n) || 0) - 1);
      if ((inDegree.get(n) || 0) === 0) {
        queue.push(n);
        queue.sort();
      }
    });
  }
  if (order.length !== actions.length) {
    return [...actions.map((a) => a.id)].sort();
  }
  return order;
}

function dominantCategory(actions: MilestoneAction[]) {
  const counts = new Map<string, number>();
  actions.forEach((a) => {
    const key = (a.category || 'CHECKPOINT').toString().toUpperCase();
    counts.set(key, (counts.get(key) || 0) + 1);
  });
  return (
    [...counts.keys()].sort((a, b) => {
      const delta = (counts.get(b) || 0) - (counts.get(a) || 0);
      if (delta !== 0) return delta;
      return a.localeCompare(b);
    })[0] || 'CHECKPOINT'
  );
}

export function injectCheckpoints(input: InjectCheckpointsInput) {
  const actions = [...(input.actions || [])].map((a) => ({ ...a, dependencies: [...(a.dependencies || [])] }));
  const byId = new Map(actions.map((a) => [a.id, a]));
  const injectedByMilestone: Record<string, { count: number; ids: string[] }> = {};
  const cadenceMode = input.policy?.cadenceMode;

  (input.milestones || [])
    .slice()
    .sort((a, b) => a.milestoneId.localeCompare(b.milestoneId))
    .forEach((milestone) => {
      const existingCheckpointIds = new Set(
        actions.filter((a) => a.id.startsWith(`CHECKPOINT::${milestone.milestoneId}::S`)).map((a) => a.id)
      );

      const criticalSet = new Set<string>([...(milestone.actionIds || []), ...(milestone.checkpointActionIds || [])]);
      [...criticalSet].forEach((id) => {
        const action = byId.get(id);
        if (!action) return;
        (action.dependencies || []).forEach((dep) => criticalSet.add(dep));
      });

      const criticalActions = [...criticalSet].map((id) => byId.get(id)).filter(Boolean) as MilestoneAction[];

      const windowDays = daysBetween(milestone.windowStartDayKey, milestone.windowEndDayKey) + 1;
      const intervalDays = inferIntervalDays(windowDays, cadenceMode);
      const segmentCount = Math.max(1, Math.ceil(windowDays / Math.max(1, intervalDays)));
      const requiredCriticalMinutes = Math.max(
        0,
        Math.round(criticalActions.reduce((sum, a) => sum + (Number(a.estimateMin) || 0), 0))
      );
      const perCheckpoint = Math.max(15, Math.round(requiredCriticalMinutes / Math.max(1, segmentCount)));

      const orderedCriticalIds = topoOrder(criticalActions);
      const bucketSize = Math.max(1, Math.ceil(orderedCriticalIds.length / segmentCount));
      const dominant = dominantCategory(criticalActions);

      const ids: string[] = [];
      let prevId: string | null = null;
      for (let i = 0; i < segmentCount; i += 1) {
        const id = `CHECKPOINT::${milestone.milestoneId}::S${String(i + 1).padStart(2, '0')}`;
        ids.push(id);
        if (existingCheckpointIds.has(id)) {
          prevId = id;
          continue;
        }
        const bucketStart = i * bucketSize;
        const deps = orderedCriticalIds.slice(bucketStart, bucketStart + bucketSize).sort();
        const checkpointDeps = [...new Set([...(prevId ? [prevId] : []), ...deps])].sort();
        const action: MilestoneAction = {
          id,
          estimateMin: perCheckpoint,
          category: dominant,
          dependencies: checkpointDeps,
          isCheckpoint: true,
          milestoneId: milestone.milestoneId,
        };
        actions.push(action);
        byId.set(id, action);
        prevId = id;
      }

      injectedByMilestone[milestone.milestoneId] = {
        count: ids.length,
        ids: ids.slice().sort(),
      };
    });

  const checkpointCount = Object.values(injectedByMilestone).reduce((s, e) => s + e.count, 0);
  return {
    actionsWithCheckpoints: actions,
    injected: {
      checkpointCount,
      byMilestone: injectedByMilestone,
    },
  };
}
