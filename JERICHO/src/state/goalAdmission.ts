import { addDays, dayKeyFromISO, nowDayKey } from './time/time.ts';
import { compileGoalEquationPlan, type GoalEquationInput } from './goalEquation.ts';
import { derivePlanProof } from './engine/planProof.ts';
import { compileAutoAsanaPlan } from './engine/autoAsanaPlan.ts';

export type AdmissionStatus =
  | 'ADMITTED'
  | 'REJECTED_NO_MECHANISM'
  | 'REJECTED_MISSING_CONSTRAINTS'
  | 'REJECTED_INFEASIBLE';

export type AdmissionReasonCode =
  | 'MISSING_GOAL_FAMILY'
  | 'MISSING_NUMERIC_TARGET'
  | 'MISSING_DEADLINE'
  | 'MISSING_MECHANISM_CLASS'
  | 'MISSING_CONSTRAINTS'
  | 'DEADLINE_PASSED'
  | 'NO_WORKABLE_DAYS'
  | 'MAX_PER_DAY_ZERO'
  | 'REQUIRED_PACE_EXCEEDS_MAX_PER_DAY'
  | 'REQUIRED_PACE_EXCEEDS_MAX_PER_WEEK'
  | 'MIN_PIPELINE_YEARS_EXCEED_TIME_AVAILABLE'
  | 'UNSCHEDULABLE_FORBIDDEN_WINDOWS'
  | 'UNSCHEDULABLE_OVERLAP_EXISTING_BLOCKS'
  | 'UNSCHEDULABLE_CAPACITY_CONSUMED'
  | 'UNSCHEDULABLE_HORIZON_TOO_SMALL';

type AdmissionContext = {
  nowISO: string;
  timeZone: string;
  cycleId: string;
  constraints?: {
    maxBlocksPerDay?: number;
    maxBlocksPerWeek?: number;
    workableDayPolicy?: { weekdays?: Array<number | string> };
    blackoutDates?: string[];
    dailyCapacityOverrides?: Record<string, number>;
    calendarCommittedBlocksByDate?: Record<string, number>;
    workingHoursWindows?: Array<{ startMin: number; endMin: number }>;
    forbiddenTimeWindows?: Array<{ startMin: number; endMin: number }>;
    forbiddenDayKeys?: string[];
    minSessionMinutes?: number;
  };
  acceptedBlocks?: Array<{ id: string; startISO: string; durationMinutes: number }>;
};

export type AdmissionResult = {
  status: AdmissionStatus;
  reasonCodes: AdmissionReasonCode[];
  planProof?: ReturnType<typeof derivePlanProof>;
  coldPlan?: any;
  schedulability?: {
    status: 'SCHEDULABLE' | 'UNSCHEDULABLE';
    reasonCodes: AdmissionReasonCode[];
    conflicts?: any[];
    recoveryOptions?: any[];
  };
};

export function admitGoal(draft: GoalEquationInput | null, ctx: AdmissionContext): AdmissionResult {
  const reasons: AdmissionReasonCode[] = [];
  if (!draft) {
    return { status: 'REJECTED_NO_MECHANISM', reasonCodes: ['MISSING_MECHANISM_CLASS'] };
  }

  if (!draft.family) reasons.push('MISSING_GOAL_FAMILY');
  if (!Number.isFinite(draft.objectiveValue) || Number(draft.objectiveValue) <= 0) reasons.push('MISSING_NUMERIC_TARGET');
  if (!draft.deadlineDayKey) reasons.push('MISSING_DEADLINE');
  if (!draft.mechanismClass) reasons.push('MISSING_MECHANISM_CLASS');

  const hasConstraints =
    Number.isFinite(draft.maxDailyWorkMinutes) &&
    Number.isFinite(draft.workDaysPerWeek) &&
    typeof draft.weekendsAllowed === 'boolean';
  if (!hasConstraints) reasons.push('MISSING_CONSTRAINTS');

  if (reasons.length) {
    const status = reasons.includes('MISSING_CONSTRAINTS') ? 'REJECTED_MISSING_CONSTRAINTS' : 'REJECTED_NO_MECHANISM';
    return { status, reasonCodes: reasons };
  }

  const nowKey = ctx?.nowISO ? dayKeyFromISO(ctx.nowISO, ctx.timeZone) : nowDayKey(ctx.timeZone);
  if (draft.deadlineDayKey && nowKey && draft.deadlineDayKey <= nowKey) {
    return { status: 'REJECTED_INFEASIBLE', reasonCodes: ['DEADLINE_PASSED'] };
  }

  const planProof = derivePlanProof(draft, { nowDayKey: nowKey, timeZone: ctx.timeZone });
  const plan = compileGoalEquationPlan({ equation: draft, nowDayKey: nowKey, timeZone: ctx.timeZone, cycleId: ctx.cycleId });

  if (plan?.planProof?.verdict === 'INFEASIBLE') {
    const infeasibleReasons: AdmissionReasonCode[] = [];
    if (plan.planProof.workableDays === 0) infeasibleReasons.push('NO_WORKABLE_DAYS');
    if ((draft.maxDailyWorkMinutes || 0) <= 0) infeasibleReasons.push('MAX_PER_DAY_ZERO');
    if (plan.planProof.requiredMinutesPerDay > (draft.maxDailyWorkMinutes || 0)) {
      infeasibleReasons.push('REQUIRED_PACE_EXCEEDS_MAX_PER_DAY');
    }
    const maxPerWeek = (draft.maxDailyWorkMinutes || 0) * (draft.workDaysPerWeek || 0);
    const requiredPerWeek = plan.planProof.requiredMinutesPerDay * 7;
    if (maxPerWeek > 0 && requiredPerWeek > maxPerWeek) {
      infeasibleReasons.push('REQUIRED_PACE_EXCEEDS_MAX_PER_WEEK');
    }
    if (draft.mechanismClass === 'PIPELINE') {
      const daysRemaining = daySpan(nowKey, draft.deadlineDayKey, ctx.timeZone);
      if (daysRemaining < 365) infeasibleReasons.push('MIN_PIPELINE_YEARS_EXCEED_TIME_AVAILABLE');
    }
    return {
      status: 'REJECTED_INFEASIBLE',
      reasonCodes: infeasibleReasons.length ? infeasibleReasons : ['NO_WORKABLE_DAYS'],
      planProof
    };
  }

  const coldPlan = buildColdPlanSkeleton(draft);
  const schedulability = deriveSchedulability(draft, ctx, planProof);

  return {
    status: 'ADMITTED',
    reasonCodes: [],
    planProof,
    coldPlan,
    schedulability
  };
}

export function isAdmitted(admission: { status?: string } | null | undefined) {
  return admission?.status === 'ADMITTED';
}

export function selectAspirationsForCycle(state: any, cycleId: string) {
  return state?.aspirationsByCycleId?.[cycleId] || [];
}

export function selectGoalAdmission(state: any, goalId: string) {
  return state?.goalAdmissionByGoal?.[goalId] || null;
}

function deriveSchedulability(draft: GoalEquationInput, ctx: AdmissionContext, planProof: ReturnType<typeof derivePlanProof>) {
  const constraints = ctx.constraints || {};
  const autoPlan = compileAutoAsanaPlan({
    goalId: 'goal',
    cycleId: ctx.cycleId,
    planProof,
    constraints: {
      timezone: ctx.timeZone,
      maxBlocksPerDay: constraints.maxBlocksPerDay,
      maxBlocksPerWeek: constraints.maxBlocksPerWeek,
      workableDayPolicy: constraints.workableDayPolicy,
      blackoutDates: constraints.blackoutDates,
      workingHoursWindows: constraints.workingHoursWindows,
      forbiddenTimeWindows: constraints.forbiddenTimeWindows,
      forbiddenDayKeys: constraints.forbiddenDayKeys,
      minSessionMinutes: constraints.minSessionMinutes,
      calendarCommittedBlocksByDate: constraints.calendarCommittedBlocksByDate
    },
    nowISO: ctx.nowISO,
    horizonDays: 14,
    acceptedBlocks: ctx.acceptedBlocks || []
  });
  const reasonCodes = mapConflictCodes(autoPlan.conflicts || []);
  return {
    status: reasonCodes.length ? 'UNSCHEDULABLE' : 'SCHEDULABLE',
    reasonCodes,
    conflicts: autoPlan.conflicts || [],
    recoveryOptions: autoPlan.recoveryOptions || []
  };
}

function mapConflictCodes(conflicts: Array<{ code?: string }>) {
  const codes = new Set<AdmissionReasonCode>();
  conflicts.forEach((conflict) => {
    switch (conflict.code) {
      case 'NO_ALLOWED_WINDOWS':
        codes.add('UNSCHEDULABLE_FORBIDDEN_WINDOWS');
        break;
      case 'OVERLAP_ALL_SLOTS':
        codes.add('UNSCHEDULABLE_OVERLAP_EXISTING_BLOCKS');
        break;
      case 'EXCEEDS_MAX_PER_DAY':
      case 'EXCEEDS_MAX_PER_WEEK':
        codes.add('UNSCHEDULABLE_CAPACITY_CONSUMED');
        break;
      case 'NO_WORKABLE_DAYS':
        codes.add('UNSCHEDULABLE_HORIZON_TOO_SMALL');
        break;
      default:
        break;
    }
  });
  return Array.from(codes);
}

function buildColdPlanSkeleton(draft: GoalEquationInput) {
  return {
    deliverables: [
      {
        id: `deliv-${draft.family.toLowerCase()}`,
        title: `${draft.family} objective`,
        required: true
      }
    ],
    criteria: [
      {
        id: `crit-${draft.objective.toLowerCase()}`,
        deliverableId: `deliv-${draft.family.toLowerCase()}`,
        required: true
      }
    ]
  };
}

function daySpan(startDayKey: string, endDayKey: string, timeZone: string) {
  if (!startDayKey || !endDayKey) return 0;
  let cursor = startDayKey;
  let count = 0;
  while (cursor && cursor <= endDayKey && count < 5000) {
    count += 1;
    const next = addDays(cursor, 1, timeZone);
    if (!next || next === cursor) break;
    cursor = next;
  }
  return count;
}
