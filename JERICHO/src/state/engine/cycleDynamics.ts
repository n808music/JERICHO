import { dayKeyFromDate, dayKeyFromISO } from '../time/time.ts';

export type CycleDynamicsTransition = {
  blockId: string;
  fromStatus: string;
  toStatus: 'MISSED' | 'EXPIRED';
  reasonCode: 'OVERDUE_UNFINISHED' | 'MISSED_GRACE_ELAPSED';
  effectiveAtISO: string;
};

export type CycleDynamicsTransitionPatch = {
  blockId: string;
  fromStatus: string;
  toStatus: 'missed' | 'expired';
  reasonCode: 'OVERDUE_UNFINISHED' | 'MISSED_GRACE_ELAPSED';
  effectiveAtISO: string;
};

export type CycleDynamicsProfile = {
  generatedAtISO: string;
  cycleId: string | null;
  goalId: string | null;
  totals: {
    totalBlocks: number;
    completed: number;
    inProgress: number;
    planned: number;
    missed: number;
    expired: number;
    dueToday: number;
    overdueUnfinished: number;
  };
  recommendedTransitions: CycleDynamicsTransition[];
};

type AnyBlock = {
  id?: string;
  cycleId?: string | null;
  goalId?: string | null;
  status?: string | null;
  start?: string | null;
  startISO?: string | null;
  end?: string | null;
  endISO?: string | null;
  missedAtISO?: string | null;
};

function normalizeStatus(raw: unknown) {
  return String(raw || 'planned')
    .trim()
    .toLowerCase();
}

function normalizeTransitionTarget(raw: unknown): 'missed' | 'expired' | null {
  const normalized = String(raw || '')
    .trim()
    .toUpperCase();
  if (normalized === 'MISSED') return 'missed';
  if (normalized === 'EXPIRED') return 'expired';
  return null;
}

function isCompleted(status: string) {
  return status === 'completed' || status === 'complete';
}

function isExpired(status: string) {
  return status === 'expired';
}

function isMissed(status: string) {
  return status === 'missed';
}

function resolveEndISO(block: AnyBlock) {
  return String(block?.end || block?.endISO || '');
}

function resolveStartISO(block: AnyBlock) {
  return String(block?.start || block?.startISO || '');
}

function parseISOOrNull(value: string) {
  const ms = Date.parse(value);
  return Number.isFinite(ms) ? ms : null;
}

function parseMissedAtISO(block: AnyBlock, fallbackISO = '') {
  const direct = String(block?.missedAtISO || '').trim();
  if (direct) return parseISOOrNull(direct);
  const fallback = parseISOOrNull(fallbackISO);
  return fallback;
}

/**
 * Universal cycle-dynamics laws (read-only in step 3):
 * 1. `completed` is terminal for deadline pressure.
 * 2. `planned`/`in_progress` with end < now are overdue unfinished.
 * 3. Overdue unfinished recommends transition to `MISSED`.
 * 4. `missed` beyond grace period recommends transition to `EXPIRED`.
 * 5. Profiles are deterministic and do not mutate source blocks in step 3.
 */
export function deriveCycleDynamicsProfile({
  cycleId = null,
  goalId = null,
  blocks = [],
  nowISO,
  missedGraceDays = 1,
}: {
  cycleId?: string | null;
  goalId?: string | null;
  blocks?: AnyBlock[];
  nowISO: string;
  missedGraceDays?: number;
}): CycleDynamicsProfile {
  const nowMs = parseISOOrNull(nowISO) ?? Date.now();
  const nowDayKey = dayKeyFromISO(nowISO) || dayKeyFromDate(new Date(nowMs));
  const graceMs = Math.max(0, Number(missedGraceDays || 0)) * 24 * 60 * 60 * 1000;
  const recommendedTransitions: CycleDynamicsTransition[] = [];
  const totals: CycleDynamicsProfile['totals'] = {
    totalBlocks: 0,
    completed: 0,
    inProgress: 0,
    planned: 0,
    missed: 0,
    expired: 0,
    dueToday: 0,
    overdueUnfinished: 0,
  };

  (Array.isArray(blocks) ? blocks : []).forEach((block) => {
    if (!block?.id) return;
    totals.totalBlocks += 1;
    const status = normalizeStatus(block.status);
    const endISO = resolveEndISO(block);
    const startISO = resolveStartISO(block);
    const endMs = parseISOOrNull(endISO);
    const startDayKey = startISO ? dayKeyFromISO(startISO) : null;
    const endDayKey = endISO ? dayKeyFromISO(endISO) : null;

    if (isCompleted(status)) {
      totals.completed += 1;
      return;
    }
    if (isExpired(status)) {
      totals.expired += 1;
      return;
    }
    if (isMissed(status)) {
      totals.missed += 1;
      const missedAtMs = parseMissedAtISO(block, endISO);
      if (Number.isFinite(missedAtMs) && nowMs - Number(missedAtMs) >= graceMs) {
        recommendedTransitions.push({
          blockId: String(block.id),
          fromStatus: status,
          toStatus: 'EXPIRED',
          reasonCode: 'MISSED_GRACE_ELAPSED',
          effectiveAtISO: nowISO,
        });
      }
      return;
    }

    if (status === 'in_progress') totals.inProgress += 1;
    else totals.planned += 1;

    if ((startDayKey && startDayKey === nowDayKey) || (endDayKey && endDayKey === nowDayKey)) {
      totals.dueToday += 1;
    }
    if (Number.isFinite(endMs) && Number(endMs) < nowMs) {
      totals.overdueUnfinished += 1;
      recommendedTransitions.push({
        blockId: String(block.id),
        fromStatus: status,
        toStatus: 'MISSED',
        reasonCode: 'OVERDUE_UNFINISHED',
        effectiveAtISO: nowISO,
      });
    }
  });

  return {
    generatedAtISO: nowISO,
    cycleId,
    goalId,
    totals,
    recommendedTransitions,
  };
}

/**
 * Converts dynamics recommendations into idempotent canonical transition patches.
 * This helper is pure and does not mutate source blocks.
 */
export function buildCycleDynamicsTransitionPatch({
  cycleId = null,
  goalId = null,
  blocks = [],
  recommendedTransitions = [],
}: {
  cycleId?: string | null;
  goalId?: string | null;
  blocks?: AnyBlock[];
  recommendedTransitions?: CycleDynamicsTransition[];
}): CycleDynamicsTransitionPatch[] {
  const blockById = new Map<string, AnyBlock>();
  (Array.isArray(blocks) ? blocks : []).forEach((block) => {
    const id = String(block?.id || '').trim();
    if (!id) return;
    blockById.set(id, block);
  });

  const patch: CycleDynamicsTransitionPatch[] = [];
  const seen = new Set<string>();
  (Array.isArray(recommendedTransitions) ? recommendedTransitions : []).forEach((transition) => {
    const blockId = String(transition?.blockId || '').trim();
    if (!blockId || seen.has(blockId)) return;
    const block = blockById.get(blockId);
    if (!block) return;
    if (cycleId && block?.cycleId && String(block.cycleId) !== String(cycleId)) return;
    if (goalId && block?.goalId && String(block.goalId) !== String(goalId)) return;

    const toStatus = normalizeTransitionTarget(transition?.toStatus);
    if (!toStatus) return;
    const fromStatus = normalizeStatus(block?.status);
    if (fromStatus === toStatus) return;
    if (toStatus === 'expired' && fromStatus === 'completed') return;

    patch.push({
      blockId,
      fromStatus,
      toStatus,
      reasonCode: transition?.reasonCode === 'MISSED_GRACE_ELAPSED' ? 'MISSED_GRACE_ELAPSED' : 'OVERDUE_UNFINISHED',
      effectiveAtISO: String(transition?.effectiveAtISO || ''),
    });
    seen.add(blockId);
  });

  return patch;
}
