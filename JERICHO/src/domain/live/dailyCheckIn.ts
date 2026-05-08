import type {
  CompletionLogEntry,
  DimensionFlag,
  LiveRuntimeEvent,
  LiveState,
  LiveStateInput,
  ScheduledSession,
} from './liveStateModel';
import { deriveLiveState } from './liveStateModel';

export type DailyCheckInSection =
  | { key: 'where_you_are'; title: 'Where You Are'; lines: string[] }
  | { key: 'what_the_system_noticed'; title: 'What The System Noticed'; signals: string[] }
  | {
      key: 'todays_action';
      title: "Today's Action";
      primary: string;
      why: string;
      time: string;
      unlocks: string;
      secondary?: string | null;
    }
  | {
      key: 'check_in_prompt';
      title: 'Check-In Prompt';
      prompt: string;
      fields: Array<{ id: string; label: string; kind: 'boolean' | 'number' | 'text' }>;
    };

export type GapRecapEvent = { kind: string; message: string };

export type DailyCheckInView = {
  liveState: LiveState;
  sections: DailyCheckInSection[];
  gapRecap: GapRecapEvent[];
  reengagementOptions: Array<'RESUME' | 'RESTRUCTURE' | 'CLOSE'>;
};

function titleCaseStatus(value: string) {
  return String(value || '')
    .toLowerCase()
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function formatDateOnly(value: string | null | undefined) {
  return String(value || '').slice(0, 10);
}

function choosePositiveSignal(liveState: LiveState) {
  if (liveState.activeWaitPeriods[0]) {
    const wait = liveState.activeWaitPeriods[0];
    return `${wait.title} is within normal range at day ${wait.daysElapsed} of ${wait.minimumDurationBusinessDays}.`;
  }
  if (liveState.recentlyCompleted[0]) {
    return `${liveState.recentlyCompleted[0].title} was completed and is now protecting the current phase.`;
  }
  return 'No signals to surface. The current plan is within its normal operating range.';
}

function sortFlags(flags: DimensionFlag[]) {
  const rank = { alert: 0, caution: 1, watch: 2 } as const;
  return [...flags].sort((left, right) => rank[left.severity] - rank[right.severity]);
}

function getSessionTimeLabel(session: ScheduledSession | null) {
  if (!session) return '30 minutes';
  const minutes = Number(session.durationMinutes || 30);
  if (minutes <= 45) return '30-45 minutes';
  if (minutes <= 75) return '60 minutes';
  return `${minutes} minutes`;
}

function buildGapRecap(
  liveState: LiveState,
  runtimeEvents: LiveRuntimeEvent[],
  completionLog: CompletionLogEntry[]
) {
  if (liveState.daysSinceLastCheckIn <= 3) {
    return [];
  }
  const recap: GapRecapEvent[] = [
    {
      kind: 'gap',
      message: `${liveState.daysSinceLastCheckIn} days since your last check-in. Here is what happened.`,
    },
  ];
  const lastCheckIn = liveState.lastCheckIn;
  const responsesDuringGap = runtimeEvents
    .filter((event): event is Extract<LiveRuntimeEvent, { kind: 'manufacturer_response' }> => event.kind === 'manufacturer_response')
    .filter((event) => !lastCheckIn || String(event.respondedAt) > String(lastCheckIn))
    .sort((left, right) => String(left.respondedAt).localeCompare(String(right.respondedAt)));
  responsesDuringGap.forEach((event) => {
    recap.push({
      kind: 'manufacturer_response',
      message: `${event.manufacturerName || 'A manufacturer'} responded${event.detail ? ` with ${event.detail}` : ''}. That response is waiting for your review.`,
    });
  });

  const completedWaitsDuringGap = liveState.activeWaitPeriods.filter((wait) => wait.daysRemaining === 0);
  completedWaitsDuringGap.forEach((wait) => {
    recap.push({
      kind: 'wait_complete',
      message: `${wait.title} completed during the gap and can now unblock downstream work.`,
    });
  });

  const scheduledMisses = (completionLog || []).filter((event) => String(event?.kind || '') === 'missed');
  if (scheduledMisses.length > 0) {
    recap.push({
      kind: 'missed_sessions',
      message: `${scheduledMisses.length} sessions were logged as skipped during the gap.`,
    });
  } else if (liveState.planPosition.sessionGap < 0) {
    recap.push({
      kind: 'scheduled_gap',
      message: `${Math.abs(liveState.planPosition.sessionGap)} sessions were scheduled during the gap and were not completed.`,
    });
  }

  if (liveState.nextGate.daysUntilGate < 9999) {
    recap.push({
      kind: 'gate_shift',
      message: `${liveState.nextGate.gateTitle} is now ${liveState.nextGate.daysUntilGate} days away.`,
    });
  }
  recap.push({
    kind: 'current_position',
    message: `Here is where you are now. Projected completion is ${formatDateOnly(
      liveState.planPosition.projectedCompletionDate
    )}.`,
  });
  return recap;
}

function choosePrimaryAction(
  liveState: LiveState,
  runtimeEvents: LiveRuntimeEvent[]
) {
  const latestManufacturerResponse = [...runtimeEvents]
    .filter((event): event is Extract<LiveRuntimeEvent, { kind: 'manufacturer_response' }> => event.kind === 'manufacturer_response')
    .sort((left, right) => String(right.respondedAt).localeCompare(String(left.respondedAt)))[0];
  if (liveState.daysSinceLastCheckIn > 3 && latestManufacturerResponse) {
    const label = latestManufacturerResponse.manufacturerName
      ? `Review ${latestManufacturerResponse.manufacturerName} catalog`
      : 'Review the manufacturer response that arrived during your gap';
    return {
      primary: label,
      why: 'A manufacturer response arrived while you were away, and reviewing it is now the fastest way to reopen the formula-selection path.',
      time: '30-45 minutes',
      unlocks: 'This reopens sample ordering and keeps the manufacturer corridor moving.',
      secondary: liveState.todaysSessions[0] ? `Secondary: ${liveState.todaysSessions[0].title}.` : null,
    };
  }

  const urgentFlag = sortFlags(liveState.dimensionFlags).find((flag) => flag.severity === 'alert' || flag.severity === 'caution');
  if (urgentFlag) {
    const secondary = liveState.todaysSessions[0] ? `Secondary: ${liveState.todaysSessions[0].title}.` : null;
    return {
      primary: urgentFlag.recommendedAction,
      why: urgentFlag.signal,
      time: '30-60 minutes',
      unlocks: `This protects the ${urgentFlag.dimension} dimension before the risk compounds.`,
      secondary,
    };
  }

  const session = liveState.todaysSessions[0] || null;
  const nextWait = liveState.activeWaitPeriods[0] || null;
  if (session) {
    return {
      primary: session.title,
      why: nextWait
        ? `${session.title} matters now because ${nextWait.title} is still running and this is the best available parallel work.`
        : `${session.title} is the next committed session on the schedule and keeps the current phase moving.`,
      time: getSessionTimeLabel(session),
      unlocks: nextWait
        ? `This protects progress while ${nextWait.title} finishes.`
        : 'This protects the next downstream gate in the plan.',
      secondary: null,
    };
  }

  return {
    primary: 'Review the next committed block and explicitly reschedule or skip what no longer matches reality.',
    why: 'There is no usable session on the calendar today, so the most honest action is to clean the runtime state first.',
    time: '20-30 minutes',
    unlocks: 'This restores a truthful today-state before more drift accumulates.',
    secondary: null,
  };
}

export function deriveDailyCheckIn(input: LiveStateInput): DailyCheckInView {
  const liveState = deriveLiveState(input);
  const runtimeEvents = Array.isArray(input.runtimeEvents) ? input.runtimeEvents : [];
  const completionLog = Array.isArray(input.completionLog) ? input.completionLog : [];
  const gapRecap = buildGapRecap(liveState, runtimeEvents, completionLog);

  const whereYouAreLines = [
    `Week ${liveState.planPosition.currentWeek} of ${liveState.planPosition.totalWeeks}. ${liveState.planPosition.currentPhase} phase, week ${liveState.planPosition.currentPhaseWeek} of ${liveState.planPosition.currentPhaseTotalWeeks}.`,
    `${liveState.planPosition.sessionsCompleted} of ${liveState.planPosition.sessionsTotal} sessions complete.`,
    liveState.planPosition.sessionGap >= 0
      ? `Running ${liveState.planPosition.sessionGap} session${liveState.planPosition.sessionGap === 1 ? '' : 's'} ahead of plan.`
      : `Running ${Math.abs(liveState.planPosition.sessionGap)} session${Math.abs(liveState.planPosition.sessionGap) === 1 ? '' : 's'} behind plan.`,
    liveState.activeWaitPeriods[0]
      ? `${liveState.activeWaitPeriods[0].title}: day ${liveState.activeWaitPeriods[0].daysElapsed} of ${liveState.activeWaitPeriods[0].minimumDurationBusinessDays} minimum. ${liveState.activeWaitPeriods[0].daysRemaining} days remaining.`
      : `Live status: ${titleCaseStatus(liveState.liveStatus)}.`,
    liveState.activeWaitPeriods[0]?.parallelWorkSuggestions?.length
      ? `Parallel work available: ${liveState.activeWaitPeriods[0].parallelWorkSuggestions.slice(0, 2).join(', ')}.`
      : `Projected completion: ${formatDateOnly(liveState.planPosition.projectedCompletionDate)}.`,
    liveState.capitalTrack.presaleOrderTarget
      ? `Capital: $${liveState.capitalTrack.currentBalance.toLocaleString()} of $${liveState.capitalTrack.target.toLocaleString()} target.`
      : `Capital: $${liveState.capitalTrack.currentBalance.toLocaleString()} available.`,
    liveState.capitalTrack.presaleOrderCount !== null
      ? `Presale orders: ${liveState.capitalTrack.presaleOrderCount} of ${liveState.capitalTrack.presaleOrderTarget || 'target not set'}.`
      : 'Presale campaign: not yet launched.',
  ];

  const activeSignals = sortFlags(liveState.dimensionFlags).filter(
    (flag) => flag.severity === 'alert' || flag.severity === 'caution'
  );
  const signalLines =
    activeSignals.length > 0
      ? activeSignals.slice(0, liveState.daysSinceLastCheckIn > 3 ? activeSignals.length : 3).map((flag) => {
          const prefix = flag.severity === 'alert' ? 'ALERT' : 'CAUTION';
          return `${prefix}: ${flag.signal} ${flag.recommendedAction}`;
        })
      : [choosePositiveSignal(liveState)];

  const action = choosePrimaryAction(liveState, runtimeEvents);
  const yesterdaysSession = liveState.todaysSessions[0] || null;
  const promptFields: Array<{ id: string; label: string; kind: 'boolean' | 'number' | 'text' }> = [
    {
      id: 'completed_yesterday',
      label: yesterdaysSession
        ? `Did you complete "${yesterdaysSession.title}"?`
        : 'Did you complete yesterday’s intended session?',
      kind: 'boolean',
    },
  ];
  if (/presale/i.test(action.primary) || liveState.capitalTrack.strategy === 'presale') {
    promptFields.push({ id: 'presale_orders', label: 'Log presale orders since last check-in', kind: 'number' });
  }
  if (/manufacturer/i.test(liveState.planPosition.currentPhase) || /manufacturer/i.test(action.primary)) {
    promptFields.push({ id: 'manufacturer_response', label: 'Log any manufacturer response or catalog received', kind: 'text' });
  }

  const reengagementOptions: Array<'RESUME' | 'RESTRUCTURE' | 'CLOSE'> = [];
  if (liveState.daysSinceLastCheckIn >= 31) {
    const canResume = !(liveState.nextGate.daysUntilGate <= 0 && !liveState.nextGate.prerequisitesMet);
    if (canResume) {
      reengagementOptions.push('RESUME');
    }
    reengagementOptions.push('RESTRUCTURE', 'CLOSE');
  }

  return {
    liveState,
    gapRecap,
    reengagementOptions,
    sections: [
      { key: 'where_you_are', title: 'Where You Are', lines: whereYouAreLines.slice(0, 7) },
      { key: 'what_the_system_noticed', title: 'What The System Noticed', signals: signalLines },
      {
        key: 'todays_action',
        title: "Today's Action",
        primary: action.primary,
        why: action.why,
        time: action.time,
        unlocks: action.unlocks,
        secondary: action.secondary,
      },
      {
        key: 'check_in_prompt',
        title: 'Check-In Prompt',
        prompt: 'Log what actually happened. Skipped sessions are recorded, not judged.',
        fields: promptFields.slice(0, 3),
      },
    ],
  };
}
