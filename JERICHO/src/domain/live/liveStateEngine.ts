import type { LiveStateInput, CompletionLogEntry, DimensionFlag, LiveRuntimeEvent } from './liveStateModel';
import { deriveLiveState } from './liveStateModel';

export type AutonomousStateChangeLog = {
  type:
    | 'WAIT_PERIOD_PROGRESS'
    | 'WAIT_PERIOD_COMPLETED'
    | 'GATE_APPROACH'
    | 'SESSION_GAP_ACCUMULATION'
    | 'MANUFACTURER_RESPONSE_TIMEOUT'
    | 'PRESALE_CAMPAIGN_AGING'
    | 'CONTENT_ENGAGEMENT_SIGNAL';
  timestamp: string;
  reason: string;
};

export function deriveAutonomousStateChanges(input: LiveStateInput): AutonomousStateChangeLog[] {
  const liveState = deriveLiveState(input);
  const changes: AutonomousStateChangeLog[] = [];

  liveState.activeWaitPeriods.forEach((wait) => {
    changes.push({
      type: 'WAIT_PERIOD_PROGRESS',
      timestamp: liveState.asOf,
      reason: `${wait.title} is ${wait.daysElapsed} business days into a ${wait.minimumDurationBusinessDays}-day minimum wait.`,
    });
    if (wait.daysRemaining === 0 && wait.status !== 'overdue') {
      changes.push({
        type: 'WAIT_PERIOD_COMPLETED',
        timestamp: liveState.asOf,
        reason: `${wait.title} has reached its minimum wait duration and can unblock downstream work.`,
      });
    }
    if (/manufacturer/i.test(wait.title) && wait.daysElapsed > 20) {
      changes.push({
        type: 'MANUFACTURER_RESPONSE_TIMEOUT',
        timestamp: liveState.asOf,
        reason: `${wait.title} has exceeded the 20-business-day response threshold without a logged response.`,
      });
    }
  });

  if (liveState.nextGate.daysUntilGate === 21 || liveState.nextGate.daysUntilGate === 14 || liveState.nextGate.daysUntilGate === 7 || liveState.nextGate.daysUntilGate === 3) {
    changes.push({
      type: 'GATE_APPROACH',
      timestamp: liveState.asOf,
      reason: `${liveState.nextGate.gateTitle} is now ${liveState.nextGate.daysUntilGate} days away.`,
    });
  }

  if (liveState.planPosition.sessionGap <= -1) {
    changes.push({
      type: 'SESSION_GAP_ACCUMULATION',
      timestamp: liveState.asOf,
      reason: `${Math.abs(liveState.planPosition.sessionGap)} scheduled sessions have not been completed on time.`,
    });
  }

  const capitalFlag = liveState.dimensionFlags.find((flag) => flag.dimension === 'capital');
  if (capitalFlag) {
    changes.push({
      type: 'PRESALE_CAMPAIGN_AGING',
      timestamp: capitalFlag.triggeredAt,
      reason: capitalFlag.signal,
    });
  }

  const marketFlag = liveState.dimensionFlags.find((flag) => flag.dimension === 'market');
  if (marketFlag) {
    changes.push({
      type: 'CONTENT_ENGAGEMENT_SIGNAL',
      timestamp: marketFlag.triggeredAt,
      reason: marketFlag.signal,
    });
  }

  return changes;
}

export function appendCompletionLogEntries(
  log: CompletionLogEntry[] = [],
  entries: CompletionLogEntry[] = []
) {
  return [...(Array.isArray(log) ? log : []), ...(Array.isArray(entries) ? entries : [])];
}

export function buildDailyFlagMap(flags: DimensionFlag[]) {
  return (Array.isArray(flags) ? flags : []).reduce<Record<string, DimensionFlag>>((acc, flag) => {
    acc[`${flag.dimension}:${flag.signal}`] = flag;
    return acc;
  }, {});
}

export function getLatestRuntimeEvent<T extends LiveRuntimeEvent['kind']>(
  events: LiveRuntimeEvent[] = [],
  kind: T
) {
  return [...events]
    .filter((event): event is Extract<LiveRuntimeEvent, { kind: T }> => event.kind === kind)
    .sort((left, right) => String((right as any).recordedAt || (right as any).respondedAt).localeCompare(String((left as any).recordedAt || (left as any).respondedAt)))[0];
}

