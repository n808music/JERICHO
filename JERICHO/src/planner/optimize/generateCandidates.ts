import type { ScheduleAssignment } from '../scoring/scoreSchedule.ts';

type CandidateInput = {
  baselineAssignments: ScheduleAssignment[];
  frozenReservations?: Array<{ actionId: string; chunkIndex: number }>;
  maxPerDay?: number;
  slotStepMin?: number;
  maxCandidates?: number;
};

function keyOf(assignment: ScheduleAssignment) {
  return `${assignment.actionId}#${assignment.chunkIndex}`;
}

function sortAssignments(assignments: ScheduleAssignment[]) {
  return [...assignments].sort((a, b) => {
    if (a.dayKey !== b.dayKey) return a.dayKey.localeCompare(b.dayKey);
    if (a.startMin !== b.startMin) return a.startMin - b.startMin;
    if (a.actionId !== b.actionId) return a.actionId.localeCompare(b.actionId);
    return a.chunkIndex - b.chunkIndex;
  });
}

function stableHash(assignments: ScheduleAssignment[]) {
  return assignments.map((a) => `${a.actionId}:${a.chunkIndex}:${a.dayKey}:${a.startMin}`).join('|');
}

export function generateCandidates({
  baselineAssignments,
  frozenReservations = [],
  maxPerDay = 5,
  slotStepMin = 30,
  maxCandidates = Number.POSITIVE_INFINITY,
}: CandidateInput): ScheduleAssignment[][] {
  const baseline = sortAssignments(baselineAssignments || []);
  const frozen = new Set(frozenReservations.map((r) => `${r.actionId}#${r.chunkIndex}`));
  const emitted = new Set<string>();
  const candidates: ScheduleAssignment[][] = [];
  const indexByKey = new Map<string, number>();
  baseline.forEach((assignment, index) => {
    indexByKey.set(keyOf(assignment), index);
  });

  const byDay = new Map<string, ScheduleAssignment[]>();
  baseline.forEach((a) => {
    const row = byDay.get(a.dayKey) || [];
    row.push(a);
    byDay.set(a.dayKey, row);
  });

  [...byDay.keys()].sort().forEach((dayKey) => {
    if (candidates.length >= maxCandidates) return;
    const dayItems = sortAssignments(byDay.get(dayKey) || []);

    // Adjacent swap
    for (let i = 0; i < dayItems.length - 1 && i < maxPerDay; i += 1) {
      const left = dayItems[i];
      const right = dayItems[i + 1];
      if (left.durationMin !== right.durationMin) continue;
      if (frozen.has(keyOf(left)) || frozen.has(keyOf(right))) continue;
      const leftIndex = indexByKey.get(keyOf(left));
      const rightIndex = indexByKey.get(keyOf(right));
      if (!Number.isInteger(leftIndex) || !Number.isInteger(rightIndex)) continue;
      const next = baseline.slice();
      next[leftIndex] = { ...left, startMin: right.startMin };
      next[rightIndex] = { ...right, startMin: left.startMin };
      const hash = stableHash(next);
      if (!emitted.has(hash)) {
        emitted.add(hash);
        candidates.push(next);
        if (candidates.length >= maxCandidates) break;
      }
    }
    if (candidates.length >= maxCandidates) return;

    // Local +/- shift
    dayItems.forEach((item) => {
      if (candidates.length >= maxCandidates) return;
      if (frozen.has(keyOf(item))) return;
      [-slotStepMin, slotStepMin].forEach((delta) => {
        if (candidates.length >= maxCandidates) return;
        const startMin = item.startMin + delta;
        if (startMin < 0) return;
        const endMin = startMin + item.durationMin;
        if (endMin > 24 * 60) return;
        const conflict = dayItems.some((other) => {
          if (other.actionId === item.actionId && other.chunkIndex === item.chunkIndex) return false;
          const otherStart = other.startMin;
          const otherEnd = other.startMin + other.durationMin;
          return !(endMin <= otherStart || startMin >= otherEnd);
        });
        if (conflict) return;
        const itemIndex = indexByKey.get(keyOf(item));
        if (!Number.isInteger(itemIndex)) return;
        const next = baseline.slice();
        next[itemIndex] = { ...item, startMin };
        const hash = stableHash(next);
        if (!emitted.has(hash)) {
          emitted.add(hash);
          candidates.push(next);
          if (candidates.length >= maxCandidates) return;
        }
      });
    });
  });

  return candidates;
}
