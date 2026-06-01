export const POS_REASON_CODES = [
  'POS_NO_PLAN',
  'POS_THROUGHPUT_MODEL_MISSING',
  'POS_FEASIBILITY_INPUT_MISSING',
  'POS_UNSCHEDULABLE',
  'POS_TRAJECTORY_ON_TRACK',
  'POS_TRAJECTORY_RECOVERABLE_DRIFT',
  'POS_TRAJECTORY_AT_RISK',
  'POS_TRAJECTORY_INFEASIBLE',
  'POS_REQUIRED_WEEKLY_THROUGHPUT_UP',
  'POS_TERMINAL_DRIFT_EXPIRED',
  'POS_DOWN_MISSED_WORK',
  'POS_DOWN_LATE_COMPLETION',
  'POS_UP_ON_TIME_COMPLETION',
  'POS_UP_EARLY_RESCHEDULE',
  'POS_DOWN_LATE_RESCHEDULE',
  'POS_NEUTRAL_CANCELLATION',
  'POS_DOWN_FEASIBILITY_DECREASE',
  'POS_UP_FEASIBILITY_INCREASE',
] as const;

export type PosReasonCode = (typeof POS_REASON_CODES)[number];
export type PosReasonDirection = 'UP' | 'DOWN' | 'NEUTRAL';

export type PosReason = {
  code: PosReasonCode;
  direction: PosReasonDirection;
  magnitude: number;
  evidence?: string;
};

export type OutcomeAggregate = {
  missedMinutes: number;
  missedBlocks: number;
  expiredMinutes: number;
  expiredBlocks: number;
  lateMinutes: number;
  lateBlocks: number;
  onTimeMinutes: number;
  onTimeBlocks: number;
  earlyReschedMinutes: number;
  earlyReschedBlocks: number;
  lateReschedMinutes: number;
  lateReschedBlocks: number;
  canceledValidMinutes: number;
  canceledValidBlocks: number;
  canceledWeakMinutes: number;
  canceledWeakBlocks: number;
  totalMinutesCounted: number;
};

export type PosExplanation = {
  delta: number | null;
  reasons: PosReason[];
  conflicts: string[];
  generatedAtISO: string;
};

const UNSCHEDULABLE_CODES = new Set(['UNSCHEDULABLE', 'NO_ALLOWED_WINDOWS', 'OVERLAP_ALL_SLOTS', 'CAPACITY_OVERFLOW']);

function isFiniteNumber(value: any): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

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

function normalizeConflicts(conflicts: string[] = []): string[] {
  return Array.from(
    new Set(
      (conflicts || [])
        .map((entry) =>
          String(entry || '')
            .trim()
            .toUpperCase()
        )
        .filter((entry) => entry.length > 0)
    )
  ).sort((a, b) => a.localeCompare(b));
}

function zeroOutcomeAggregate(): OutcomeAggregate {
  return {
    missedMinutes: 0,
    missedBlocks: 0,
    expiredMinutes: 0,
    expiredBlocks: 0,
    lateMinutes: 0,
    lateBlocks: 0,
    onTimeMinutes: 0,
    onTimeBlocks: 0,
    earlyReschedMinutes: 0,
    earlyReschedBlocks: 0,
    lateReschedMinutes: 0,
    lateReschedBlocks: 0,
    canceledValidMinutes: 0,
    canceledValidBlocks: 0,
    canceledWeakMinutes: 0,
    canceledWeakBlocks: 0,
    totalMinutesCounted: 0,
  };
}

function inferOutcomeFromStatus(block: any): string {
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
  return '';
}

export function aggregateCycleOutcomes(args: {
  cycleId: string;
  nowISO: string;
  blocks: Array<any>;
}): OutcomeAggregate {
  const cycleId = String(args?.cycleId || '');
  const nowMs = Date.parse(String(args?.nowISO || ''));
  const blocks = Array.isArray(args?.blocks) ? args.blocks : [];
  const agg = zeroOutcomeAggregate();

  blocks.forEach((block) => {
    if (!block || String(block?.cycleId || '') !== cycleId) return;
    const startMs = Date.parse(parseStartISO(block));
    if (!Number.isFinite(startMs) || !Number.isFinite(nowMs) || startMs >= nowMs) return;
    const minutes = resolveDurationMinutes(block);
    if (!(minutes > 0)) return;
    agg.totalMinutesCounted += minutes;

    const outcome = inferOutcomeFromStatus(block);
    switch (outcome) {
      case 'MISSED':
        agg.missedBlocks += 1;
        agg.missedMinutes += minutes;
        break;
      case 'EXPIRED':
        agg.expiredBlocks += 1;
        agg.expiredMinutes += minutes;
        break;
      case 'COMPLETED_LATE':
        agg.lateBlocks += 1;
        agg.lateMinutes += minutes;
        break;
      case 'COMPLETED_ON_TIME':
        agg.onTimeBlocks += 1;
        agg.onTimeMinutes += minutes;
        break;
      case 'RESCHEDULED_BEFORE_CUTOFF':
        agg.earlyReschedBlocks += 1;
        agg.earlyReschedMinutes += minutes;
        break;
      case 'RESCHEDULED_AFTER_CUTOFF':
        agg.lateReschedBlocks += 1;
        agg.lateReschedMinutes += minutes;
        break;
      case 'CANCELED_VALID':
        agg.canceledValidBlocks += 1;
        agg.canceledValidMinutes += minutes;
        break;
      case 'CANCELED_WEAK':
        agg.canceledWeakBlocks += 1;
        agg.canceledWeakMinutes += minutes;
        break;
      default:
        break;
    }
  });

  return agg;
}

function sortAndTrimReasons(reasons: PosReason[]): PosReason[] {
  return [...reasons]
    .sort((a, b) => {
      if (b.magnitude !== a.magnitude) return b.magnitude - a.magnitude;
      return a.code.localeCompare(b.code);
    })
    .slice(0, 3);
}

function reasonMagnitudeFromMinutesDelta(
  integrityPrev: number | null,
  integrityNow: number | null,
  minutesDelta: number,
  totalMinutesCountedNow: number
): number {
  const iNow = isFiniteNumber(integrityNow) ? Number(integrityNow) : 1;
  const iPrev = isFiniteNumber(integrityPrev) ? Number(integrityPrev) : 1;
  const integrityPowerDelta = Math.abs(Math.pow(iNow, 1.5) - Math.pow(iPrev, 1.5));
  const weight = Math.max(0, minutesDelta) / Math.max(1, Number(totalMinutesCountedNow) || 0);
  return integrityPowerDelta * weight;
}

function minutesDelta(now: number, prev: number): number {
  return Math.max(0, Number(now || 0) - Number(prev || 0));
}

function blocksDelta(now: number, prev: number): number {
  return Math.max(0, Number(now || 0) - Number(prev || 0));
}

export function buildPosExplanation(input: {
  cycleId: string;
  nowISO: string;
  posPrev: number | null | undefined;
  posNow: number | null | undefined;
  feasibilityPrev: number | null | undefined;
  feasibilityNow: number | null | undefined;
  integrityPrev: number | null | undefined;
  integrityNow: number | null | undefined;
  conflictsNow: string[];
  outcomeAggPrev?: OutcomeAggregate | null;
  outcomeAggNow?: OutcomeAggregate | null;
}): PosExplanation {
  const nowISO = String(input?.nowISO || '');
  const conflicts = normalizeConflicts(input?.conflictsNow || []);
  const feasibilityNow = isFiniteNumber(input?.feasibilityNow) ? Number(input?.feasibilityNow) : null;
  const feasibilityPrev = isFiniteNumber(input?.feasibilityPrev) ? Number(input?.feasibilityPrev) : null;
  const integrityNow = isFiniteNumber(input?.integrityNow) ? Number(input?.integrityNow) : null;
  const integrityPrev = isFiniteNumber(input?.integrityPrev) ? Number(input?.integrityPrev) : null;
  const posNow = isFiniteNumber(input?.posNow) ? Number(input?.posNow) : null;
  const posPrev = isFiniteNumber(input?.posPrev) ? Number(input?.posPrev) : null;
  const outcomeAggNow = input?.outcomeAggNow || zeroOutcomeAggregate();
  const outcomeAggPrev = input?.outcomeAggPrev || zeroOutcomeAggregate();

  const delta = posNow !== null && posPrev !== null ? posNow - posPrev : null;

  if (feasibilityNow === null) {
    const hasThroughputModelMissing = conflicts.includes('POS_THROUGHPUT_MODEL_MISSING');
    const hasFeasibilityInputMissing = conflicts.includes('POS_FEASIBILITY_INPUT_MISSING');
    const reasonCode = hasThroughputModelMissing
      ? 'POS_THROUGHPUT_MODEL_MISSING'
      : hasFeasibilityInputMissing
        ? 'POS_FEASIBILITY_INPUT_MISSING'
        : 'POS_NO_PLAN';
    const evidence = hasThroughputModelMissing
      ? 'throughput model missing'
      : hasFeasibilityInputMissing
        ? 'feasibility input missing'
        : undefined;
    return {
      delta,
      conflicts,
      generatedAtISO: nowISO,
      reasons: [
        {
          code: reasonCode,
          direction: 'NEUTRAL',
          magnitude: 1,
          evidence,
        },
      ],
    };
  }

  const hasUnschedulableConflict = conflicts.some((code) => UNSCHEDULABLE_CODES.has(code));
  if (feasibilityNow === 0 && hasUnschedulableConflict) {
    const dominantCode = conflicts.find((code) => UNSCHEDULABLE_CODES.has(code)) || 'UNSCHEDULABLE';
    return {
      delta,
      conflicts,
      generatedAtISO: nowISO,
      reasons: [
        {
          code: 'POS_UNSCHEDULABLE',
          direction: 'DOWN',
          magnitude: posPrev !== null ? Math.abs(posPrev) : 1,
          evidence: `unschedulable: ${dominantCode}`,
        },
      ],
    };
  }

  const reasons: PosReason[] = [];

  if (feasibilityPrev !== null && Math.abs(feasibilityNow - feasibilityPrev) >= 0.01) {
    const feasibilityDelta = feasibilityNow - feasibilityPrev;
    reasons.push({
      code: feasibilityDelta < 0 ? 'POS_DOWN_FEASIBILITY_DECREASE' : 'POS_UP_FEASIBILITY_INCREASE',
      direction: feasibilityDelta < 0 ? 'DOWN' : 'UP',
      magnitude: Math.abs(feasibilityDelta),
      evidence: `feasibility ${feasibilityDelta < 0 ? '-' : '+'}${Math.round(Math.abs(feasibilityDelta) * 100)}pp`,
    });
  }

  const totalMinutesCountedNow = Number(outcomeAggNow.totalMinutesCounted || 0);

  const missedBlockDelta = blocksDelta(outcomeAggNow.missedBlocks, outcomeAggPrev.missedBlocks);
  if (missedBlockDelta > 0) {
    const deltaMinutes = minutesDelta(outcomeAggNow.missedMinutes, outcomeAggPrev.missedMinutes);
    reasons.push({
      code: 'POS_DOWN_MISSED_WORK',
      direction: 'DOWN',
      magnitude: reasonMagnitudeFromMinutesDelta(integrityPrev, integrityNow, deltaMinutes, totalMinutesCountedNow),
      evidence: `missed ${deltaMinutes}m`,
    });
  }

  const expiredBlockDelta = blocksDelta(outcomeAggNow.expiredBlocks, outcomeAggPrev.expiredBlocks);
  if (expiredBlockDelta > 0) {
    const deltaMinutes = minutesDelta(outcomeAggNow.expiredMinutes, outcomeAggPrev.expiredMinutes);
    reasons.push({
      code: 'POS_TERMINAL_DRIFT_EXPIRED',
      direction: 'DOWN',
      magnitude: reasonMagnitudeFromMinutesDelta(integrityPrev, integrityNow, deltaMinutes, totalMinutesCountedNow),
      evidence: `expired +${expiredBlockDelta} (${deltaMinutes}m)`,
    });
  }

  const lateBlockDelta = blocksDelta(outcomeAggNow.lateBlocks, outcomeAggPrev.lateBlocks);
  if (lateBlockDelta > 0) {
    const deltaMinutes = minutesDelta(outcomeAggNow.lateMinutes, outcomeAggPrev.lateMinutes);
    reasons.push({
      code: 'POS_DOWN_LATE_COMPLETION',
      direction: 'DOWN',
      magnitude: reasonMagnitudeFromMinutesDelta(integrityPrev, integrityNow, deltaMinutes, totalMinutesCountedNow),
      evidence: `late completions +${lateBlockDelta} (${deltaMinutes}m)`,
    });
  }

  const onTimeBlockDelta = blocksDelta(outcomeAggNow.onTimeBlocks, outcomeAggPrev.onTimeBlocks);
  if (onTimeBlockDelta > 0) {
    const deltaMinutes = minutesDelta(outcomeAggNow.onTimeMinutes, outcomeAggPrev.onTimeMinutes);
    reasons.push({
      code: 'POS_UP_ON_TIME_COMPLETION',
      direction: 'UP',
      magnitude: reasonMagnitudeFromMinutesDelta(integrityPrev, integrityNow, deltaMinutes, totalMinutesCountedNow),
      evidence: `on-time completions +${onTimeBlockDelta} (${deltaMinutes}m)`,
    });
  }

  const earlyReschedBlockDelta = blocksDelta(outcomeAggNow.earlyReschedBlocks, outcomeAggPrev.earlyReschedBlocks);
  if (earlyReschedBlockDelta > 0) {
    const deltaMinutes = minutesDelta(outcomeAggNow.earlyReschedMinutes, outcomeAggPrev.earlyReschedMinutes);
    reasons.push({
      code: 'POS_UP_EARLY_RESCHEDULE',
      direction: 'UP',
      magnitude: reasonMagnitudeFromMinutesDelta(integrityPrev, integrityNow, deltaMinutes, totalMinutesCountedNow),
      evidence: `early reschedules +${earlyReschedBlockDelta} (${deltaMinutes}m)`,
    });
  }

  const lateReschedBlockDelta = blocksDelta(outcomeAggNow.lateReschedBlocks, outcomeAggPrev.lateReschedBlocks);
  if (lateReschedBlockDelta > 0) {
    const deltaMinutes = minutesDelta(outcomeAggNow.lateReschedMinutes, outcomeAggPrev.lateReschedMinutes);
    reasons.push({
      code: 'POS_DOWN_LATE_RESCHEDULE',
      direction: 'DOWN',
      magnitude: reasonMagnitudeFromMinutesDelta(integrityPrev, integrityNow, deltaMinutes, totalMinutesCountedNow),
      evidence: `late reschedules +${lateReschedBlockDelta} (${deltaMinutes}m)`,
    });
  }

  const cancellationBlockDelta =
    blocksDelta(outcomeAggNow.canceledValidBlocks, outcomeAggPrev.canceledValidBlocks) +
    blocksDelta(outcomeAggNow.canceledWeakBlocks, outcomeAggPrev.canceledWeakBlocks);
  if (cancellationBlockDelta > 0) {
    const deltaMinutes =
      minutesDelta(outcomeAggNow.canceledValidMinutes, outcomeAggPrev.canceledValidMinutes) +
      minutesDelta(outcomeAggNow.canceledWeakMinutes, outcomeAggPrev.canceledWeakMinutes);
    reasons.push({
      code: 'POS_NEUTRAL_CANCELLATION',
      direction: 'NEUTRAL',
      magnitude: reasonMagnitudeFromMinutesDelta(integrityPrev, integrityNow, deltaMinutes, totalMinutesCountedNow),
      evidence: `cancellations +${cancellationBlockDelta} (${deltaMinutes}m)`,
    });
  }

  return {
    delta,
    conflicts,
    generatedAtISO: nowISO,
    reasons: sortAndTrimReasons(reasons),
  };
}
