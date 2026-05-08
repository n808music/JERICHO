export const DEFAULT_POS_ALPHA = 1.5;

const OUTCOME_POINTS: Record<string, number> = {
  COMPLETED_ON_TIME: 1.0,
  RESCHEDULED_BEFORE_CUTOFF: 0.7,
  COMPLETED_LATE: 0.5,
  RESCHEDULED_AFTER_CUTOFF: 0.3,
  CANCELED_VALID: 0.6,
  CANCELED_WEAK: 0.2,
  MISSED: 0.0,
  EXPIRED: 0.0,
};

export function clamp01(x: number): number {
  if (!Number.isFinite(x)) return 0;
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  return x;
}

export function outcomeToPoints(outcome: string | null | undefined): number {
  if (!outcome) return 0;
  return OUTCOME_POINTS[String(outcome)] ?? 0;
}

function inferOutcomeFromStatus(block: any): string | null {
  const explicit = String(block?.outcome || '')
    .trim()
    .toUpperCase();
  if (explicit) return explicit;
  const status = String(block?.status || '')
    .trim()
    .toLowerCase();
  if (status === 'completed' || status === 'complete') return 'COMPLETED_ON_TIME';
  if (status === 'missed') return 'MISSED';
  if (status === 'expired') return 'EXPIRED';
  return null;
}

type CycleScoreArgs = {
  cycleId: string;
  nowISO: string;
  blocks: Array<any>;
};

function parseStartISO(block: any): string {
  return String(block?.scheduledStartISO || block?.start || block?.startISO || '');
}

function resolveDurationMinutes(block: any): number {
  const direct = Number(block?.durationMinutes);
  if (Number.isFinite(direct) && direct > 0) return direct;
  const startISO = parseStartISO(block);
  const endISO = String(block?.end || block?.endISO || '');
  const startMs = Date.parse(startISO);
  const endMs = Date.parse(endISO);
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs <= startMs) return 0;
  return Math.max(0, Math.round((endMs - startMs) / 60000));
}

export function computeCycleIntegrityScore(args: CycleScoreArgs): {
  integrityScore: number;
  minutesTotal: number;
  minutesCounted: number;
} {
  const cycleId = String(args?.cycleId || '');
  const nowMs = Date.parse(String(args?.nowISO || ''));
  const blocks = Array.isArray(args?.blocks) ? args.blocks : [];

  let weighted = 0;
  let minutesTotal = 0;

  blocks.forEach((block) => {
    if (!block || String(block?.cycleId || '') !== cycleId) return;
    const startMs = Date.parse(parseStartISO(block));
    if (!Number.isFinite(startMs) || !Number.isFinite(nowMs) || startMs >= nowMs) return;
    const minutes = resolveDurationMinutes(block);
    if (!(minutes > 0)) return;
    minutesTotal += minutes;
    weighted += outcomeToPoints(inferOutcomeFromStatus(block)) * minutes;
  });

  if (minutesTotal <= 0) {
    return {
      integrityScore: 1.0,
      minutesTotal: 0,
      minutesCounted: 0,
    };
  }

  return {
    integrityScore: clamp01(weighted / minutesTotal),
    minutesTotal,
    minutesCounted: minutesTotal,
  };
}

type CyclePOSArgs = {
  cycleId: string;
  nowISO: string;
  feasibilityScore: number;
  blocks: Array<any>;
  alpha?: number;
};

export function computeCyclePOS(args: CyclePOSArgs): {
  pos: number;
  feasibility: number;
  integrity: number;
} {
  const feasibility = clamp01(Number(args?.feasibilityScore));
  const alpha = Number.isFinite(Number(args?.alpha)) ? Number(args?.alpha) : DEFAULT_POS_ALPHA;
  const integrity = computeCycleIntegrityScore({
    cycleId: args?.cycleId || '',
    nowISO: args?.nowISO || '',
    blocks: args?.blocks || [],
  }).integrityScore;

  return {
    pos: clamp01(feasibility * Math.pow(integrity, alpha)),
    feasibility,
    integrity,
  };
}
