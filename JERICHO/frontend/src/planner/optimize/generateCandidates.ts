import type { ScoreAction, ScoreAssignment, ScoreMilestone } from '../scoring/scoreSchedule.ts';

export type CandidateGenerationInputs = {
  baselineAssignments: ScoreAssignment[];
  frozenReservations: Array<{ actionId: string; chunkIndex: number }>;
  actionGraph: { actions?: ScoreAction[] } | ScoreAction[];
  constraints: {
    maxScheduledMinutesPerDay?: number;
    maxScheduledMinutesPerWeek?: number;
  };
  horizons: {
    executionWindowStartDayKey: string;
    executionWindowEndDayKey: string;
  };
  milestones?: ScoreMilestone[];
  actionConstraintsById?: Map<
    string,
    {
      hasMilestoneBinding?: boolean;
      constraintMode?: 'hard' | 'soft';
      windowStartDayKey?: string | null;
      windowEndDayKey?: string | null;
    }
  >;
  dependencyBufferMinutes?: number;
  maxCandidates?: number;
  k1PerDay?: number;
  k2PerChunk?: number;
  k3PerDay?: number;
};

function parseDay(dayKey: string) {
  const ts = Date.parse(`${dayKey}T00:00:00.000Z`);
  return Number.isFinite(ts) ? ts : null;
}

function weekKeyForDay(dayKey: string) {
  const at = parseDay(dayKey);
  if (!Number.isFinite(at)) return dayKey;
  const day = new Date(at as number).getUTCDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  return new Date((at as number) + mondayOffset * 86400000).toISOString().slice(0, 10);
}

function keyFor(assignment: ScoreAssignment) {
  return `${assignment.actionId}::${assignment.chunkIndex}`;
}

function normalized(actions: ScoreAssignment[]) {
  return [...actions].sort((a, b) => {
    if (a.dayKey !== b.dayKey) return a.dayKey.localeCompare(b.dayKey);
    if (a.startMin !== b.startMin) return a.startMin - b.startMin;
    if ((a.actionId || '') !== (b.actionId || '')) return (a.actionId || '').localeCompare(b.actionId || '');
    return (a.chunkIndex || 0) - (b.chunkIndex || 0);
  });
}

function dedupHash(assignments: ScoreAssignment[]) {
  return normalized(assignments)
    .map((assignment) => `${assignment.actionId}:${assignment.chunkIndex}:${assignment.dayKey}:${assignment.startMin}`)
    .join('|');
}

function resolveDeps(action: ScoreAction | undefined) {
  if (!action) return [] as string[];
  if (Array.isArray(action.deps)) return action.deps.filter(Boolean);
  if (Array.isArray(action.dependencies?.ids)) return action.dependencies?.ids?.filter(Boolean) || [];
  return [] as string[];
}

function resolveBuffer(action: ScoreAction | undefined, fallback = 0) {
  const explicit = Number(action?.dependencies?.bufferMinutes);
  if (Number.isFinite(explicit)) return Math.max(0, Math.round(explicit));
  return Math.max(0, Math.round(Number(fallback || 0)));
}

function getActionMap(actionGraph: CandidateGenerationInputs['actionGraph']) {
  const actions = Array.isArray(actionGraph) ? actionGraph : actionGraph?.actions || [];
  const byId = new Map<string, ScoreAction>();
  actions.forEach((action) => {
    if (!action?.id) return;
    byId.set(action.id, action);
  });
  return byId;
}

function groupByAction(assignments: ScoreAssignment[]) {
  const byAction = new Map<string, ScoreAssignment[]>();
  assignments.forEach((assignment) => {
    if (!assignment?.actionId) return;
    if (!byAction.has(assignment.actionId)) byAction.set(assignment.actionId, []);
    byAction.get(assignment.actionId)?.push(assignment);
  });
  byAction.forEach((rows) => rows.sort((a, b) => a.chunkIndex - b.chunkIndex));
  return byAction;
}

function validateCandidate(assignments: ScoreAssignment[], inputs: CandidateGenerationInputs) {
  const byAction = groupByAction(assignments);
  const byId = getActionMap(inputs.actionGraph);

  const dayRows = new Map<string, ScoreAssignment[]>();
  assignments.forEach((assignment) => {
    if (!dayRows.has(assignment.dayKey)) dayRows.set(assignment.dayKey, []);
    dayRows.get(assignment.dayKey)?.push(assignment);
  });

  const dayTotals = new Map<string, number>();
  const weekTotals = new Map<string, number>();
  for (const [dayKey, rows] of dayRows.entries()) {
    const ordered = [...rows].sort((a, b) => a.startMin - b.startMin);
    let prevEnd = -Infinity;
    let daily = 0;
    for (const row of ordered) {
      if (row.startMin < prevEnd) return false;
      prevEnd = row.startMin + Math.max(1, Number(row.durationMin) || 30);
      daily += Math.max(1, Number(row.durationMin) || 30);
    }
    dayTotals.set(dayKey, daily);
    const weekKey = weekKeyForDay(dayKey);
    weekTotals.set(weekKey, (weekTotals.get(weekKey) || 0) + daily);

    const dayTs = parseDay(dayKey);
    const startTs = parseDay(inputs.horizons.executionWindowStartDayKey);
    const endTs = parseDay(inputs.horizons.executionWindowEndDayKey);
    if (!Number.isFinite(dayTs) || !Number.isFinite(startTs) || !Number.isFinite(endTs)) return false;
    if ((dayTs as number) < (startTs as number) || (dayTs as number) > (endTs as number)) return false;
  }

  const dayCap = Number(inputs.constraints?.maxScheduledMinutesPerDay);
  const weekCap = Number(inputs.constraints?.maxScheduledMinutesPerWeek);
  if (Number.isFinite(dayCap)) {
    for (const value of dayTotals.values()) {
      if (value > dayCap) return false;
    }
  }
  if (Number.isFinite(weekCap)) {
    for (const value of weekTotals.values()) {
      if (value > weekCap) return false;
    }
  }

  const frozenKeySet = new Set((inputs.frozenReservations || []).map((row) => `${row.actionId}::${row.chunkIndex}`));
  const baselineByKey = new Map(inputs.baselineAssignments.map((a) => [keyFor(a), a]));
  for (const assignment of assignments) {
    const rowKey = keyFor(assignment);
    if (!frozenKeySet.has(rowKey)) continue;
    const baseline = baselineByKey.get(rowKey);
    if (!baseline) return false;
    if (baseline.dayKey !== assignment.dayKey || baseline.startMin !== assignment.startMin) return false;
  }

  const actionConstraintsById = inputs.actionConstraintsById;
  if (actionConstraintsById) {
    for (const assignment of assignments) {
      const constraints = actionConstraintsById.get(assignment.actionId);
      if (!constraints || constraints.constraintMode !== 'hard' || !constraints.hasMilestoneBinding) continue;
      if (!constraints.windowStartDayKey || !constraints.windowEndDayKey) continue;
      if (assignment.dayKey < constraints.windowStartDayKey || assignment.dayKey > constraints.windowEndDayKey)
        return false;
    }
  }

  const fallbackBuffer = Number(inputs.dependencyBufferMinutes || 0);
  for (const [actionId, rows] of byAction.entries()) {
    const action = byId.get(actionId);
    const deps = resolveDeps(action);
    if (!deps.length) continue;
    const first = [...rows].sort((a, b) => {
      if (a.dayKey !== b.dayKey) return a.dayKey.localeCompare(b.dayKey);
      return a.startMin - b.startMin;
    })[0];
    const firstTs = (parseDay(first.dayKey) as number) + first.startMin * 60000;
    let cutoff = -Infinity;
    for (const depId of deps) {
      const depRows = byAction.get(depId) || [];
      if (!depRows.length) return false;
      for (const dep of depRows) {
        const depEnd = (parseDay(dep.dayKey) as number) + (dep.startMin + dep.durationMin) * 60000;
        cutoff = Math.max(cutoff, depEnd);
      }
    }
    cutoff += resolveBuffer(action, fallbackBuffer) * 60000;
    if (firstTs < cutoff) return false;
  }

  return true;
}

export function generateCandidates(inputs: CandidateGenerationInputs): ScoreAssignment[][] {
  const baseline = normalized(inputs.baselineAssignments || []);
  const candidates: ScoreAssignment[][] = [];
  const seen = new Set<string>();
  const frozenKeys = new Set((inputs.frozenReservations || []).map((row) => `${row.actionId}::${row.chunkIndex}`));
  const editable = baseline.filter((row) => !frozenKeys.has(keyFor(row)));
  const maxCandidates = Math.max(1, Number(inputs.maxCandidates || 30));
  const k1 = Math.max(1, Number(inputs.k1PerDay || 5));
  const k2 = Math.max(1, Number(inputs.k2PerChunk || 2));
  const k3 = Math.max(1, Number(inputs.k3PerDay || 3));

  const tryPush = (next: ScoreAssignment[]) => {
    if (candidates.length >= maxCandidates) return;
    const hash = dedupHash(next);
    if (seen.has(hash)) return;
    if (!validateCandidate(next, inputs)) return;
    seen.add(hash);
    candidates.push(normalized(next));
  };

  const byDay = new Map<string, ScoreAssignment[]>();
  editable.forEach((row) => {
    if (!byDay.has(row.dayKey)) byDay.set(row.dayKey, []);
    byDay.get(row.dayKey)?.push(row);
  });
  for (const rows of byDay.values()) {
    rows.sort((a, b) => a.startMin - b.startMin);
  }

  // 1) Adjacent swap same duration.
  Array.from(byDay.keys())
    .sort()
    .forEach((dayKey) => {
      const rows = byDay.get(dayKey) || [];
      let emitted = 0;
      for (let i = 0; i < rows.length - 1 && emitted < k1; i += 1) {
        const a = rows[i];
        const b = rows[i + 1];
        if (a.durationMin !== b.durationMin) continue;
        const next = baseline.map((row) => {
          if (keyFor(row) === keyFor(a)) return { ...row, startMin: b.startMin };
          if (keyFor(row) === keyFor(b)) return { ...row, startMin: a.startMin };
          return { ...row };
        });
        tryPush(next);
        emitted += 1;
      }
    });

  // 2) Local shift ± one slot width (same day).
  editable
    .slice()
    .sort((a, b) => {
      if (a.dayKey !== b.dayKey) return a.dayKey.localeCompare(b.dayKey);
      if (a.startMin !== b.startMin) return a.startMin - b.startMin;
      if ((a.actionId || '') !== (b.actionId || '')) return (a.actionId || '').localeCompare(b.actionId || '');
      return a.chunkIndex - b.chunkIndex;
    })
    .forEach((row) => {
      const slotStep = Math.max(15, Number(row.durationMin) || 30);
      const deltas = [-slotStep, slotStep].slice(0, k2);
      deltas.forEach((delta) => {
        const shifted = baseline.map((item) =>
          keyFor(item) === keyFor(row) ? { ...item, startMin: Math.max(0, item.startMin + delta) } : { ...item }
        );
        tryPush(shifted);
      });
    });

  // 3) Category batching micro-swap on high-switching days.
  Array.from(byDay.keys())
    .sort()
    .forEach((dayKey) => {
      const rows = (byDay.get(dayKey) || []).slice().sort((a, b) => a.startMin - b.startMin);
      let emitted = 0;
      for (let i = 0; i < rows.length - 2 && emitted < k3; i += 1) {
        const a = rows[i];
        const b = rows[i + 1];
        const c = rows[i + 2];
        const catA = (a.category || '').toUpperCase();
        const catB = (b.category || '').toUpperCase();
        const catC = (c.category || '').toUpperCase();
        if (!catA || !catB || !catC) continue;
        if (catA === catB || catA !== catC) continue;
        const next = baseline.map((item) => {
          if (keyFor(item) === keyFor(b)) return { ...item, startMin: c.startMin };
          if (keyFor(item) === keyFor(c)) return { ...item, startMin: b.startMin };
          return { ...item };
        });
        tryPush(next);
        emitted += 1;
      }
    });

  return candidates.slice(0, maxCandidates);
}
