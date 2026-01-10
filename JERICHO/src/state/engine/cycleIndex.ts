import { scoreGoalSuccessProbability } from './probabilityScore.ts';
import { computeFeasibility } from './feasibility.ts';

type CycleState = 'Active' | 'Ended' | 'Deleted';

type CycleIndexEntry = {
  cycleId: string;
  state: CycleState;
  goalTitle: string;
  startISO: string;
  endISO: string | null;
  deadlineISO: string | null;
  summaryStats: {
    completionCount: number;
    completionRate: number;
    probabilityAtEnd: number | null;
    feasibilityAtEnd: string | null;
  };
};

type CycleIndexInput = {
  cyclesById: Record<string, any>;
  goalWorkById?: Record<string, any>;
  constraints?: {
    timeZone?: string;
    maxBlocksPerDay?: number;
    workableDayPolicy?: any;
    blackoutDates?: string[];
    dailyCapacityOverrides?: Record<string, number>;
    calendarCommittedBlocksByDate?: Record<string, number>;
    scoringWindowDays?: number;
  };
};

function dayKeyToISO(dayKey: string) {
  if (!dayKey) return '';
  return `${dayKey}T12:00:00.000Z`;
}

function completionStats(events: Array<any>) {
  const completed = events.filter((e) => e?.completed && (!e.kind || e.kind === 'complete'));
  const created = events.filter((e) => e?.kind === 'create');
  const completionCount = completed.length;
  const completionRate = created.length ? completionCount / created.length : 0;
  return { completionCount, completionRate };
}

export function projectCyclesIndex({ cyclesById = {}, goalWorkById = {}, constraints = {} }: CycleIndexInput): CycleIndexEntry[] {
  const entries = Object.values(cyclesById || {}).map((cycle: any) => {
    const status = cycle?.status === 'deleted' ? 'Deleted' : cycle?.status === 'active' ? 'Active' : 'Ended';
    const cycleId = cycle?.id || '';
    const goalTitle = cycle?.definiteGoal?.outcome || cycle?.contract?.goalText || '—';
    const startDayKey = cycle?.startedAtDayKey || cycle?.contract?.startDayKey || '';
    const endDayKey = cycle?.endedAtDayKey || null;
    const deadlineDayKey = cycle?.definiteGoal?.deadlineDayKey || cycle?.contract?.endDayKey || null;
    const startISO = dayKeyToISO(startDayKey);
    const endISO = endDayKey ? dayKeyToISO(endDayKey) : null;
    const deadlineISO = deadlineDayKey ? dayKeyToISO(deadlineDayKey) : null;

    const events = cycle?.executionEvents || [];
    const { completionCount, completionRate } = completionStats(events);

    const nowISO = endISO || deadlineISO || startISO;
    let probabilityAtEnd: number | null = null;
    let feasibilityAtEnd: string | null = null;

    if (cycle?.goalGovernanceContract?.goalId && nowISO) {
      const goalId = cycle.goalGovernanceContract.goalId;
      const tempState = {
        activeCycleId: cycleId,
        cyclesById: { [cycleId]: cycle },
        executionEvents: events,
        goalWorkById
      };
      const timeZone = cycle?.goalGovernanceContract?.scope?.timezone || constraints?.timeZone || 'UTC';
      const score = scoreGoalSuccessProbability(goalId, tempState, { timezone: timeZone, ...constraints }, nowISO);
      probabilityAtEnd = Number.isFinite(score?.value) ? score.value : null;
      const deadlineISOResolved = deadlineISO || nowISO;
      const feasibility = computeFeasibility({ goalId, deadlineISO: deadlineISOResolved }, tempState, { timezone: timeZone, ...constraints }, nowISO);
      feasibilityAtEnd = feasibility?.status || null;
    }

    return {
      cycleId,
      state: status,
      goalTitle,
      startISO,
      endISO,
      deadlineISO,
      summaryStats: {
        completionCount,
        completionRate,
        probabilityAtEnd,
        feasibilityAtEnd
      }
    };
  });

  entries.sort((a, b) => {
    if (a.state === 'Active' && b.state !== 'Active') return -1;
    if (a.state !== 'Active' && b.state === 'Active') return 1;
    const aDate = a.endISO || a.startISO || '';
    const bDate = b.endISO || b.startISO || '';
    if (aDate !== bDate) return bDate.localeCompare(aDate);
    return a.cycleId.localeCompare(b.cycleId);
  });

  return entries;
}
