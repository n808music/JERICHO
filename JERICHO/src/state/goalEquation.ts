import { addDays, buildLocalStartISO, nowDayKey as nowDayKeyFn } from './time/time.ts';

export type GoalFamily = 'BODY' | 'SKILL' | 'OUTPUT';
export type GoalObjective =
  | 'LOSE_WEIGHT_LBS'
  | 'PRACTICE_HOURS_TOTAL'
  | 'PUBLISH_COUNT';

export type DeadlineType = 'HARD' | 'SOFT';
export type WorkWindow = 'EARLY' | 'MID' | 'LATE' | 'VARIABLE';
export type SleepWindow = 'EARLY' | 'MID' | 'LATE' | 'VARIABLE';
export type DayWindow = 'MORNING' | 'MIDDAY' | 'AFTERNOON' | 'EVENING';

export type GoalEquationInput = {
  label?: string;
  family: GoalFamily;
  mechanismClass: 'THROUGHPUT' | 'PIPELINE' | 'PROJECT_GRAPH';
  objective: GoalObjective;
  objectiveValue: number;
  deadlineDayKey: string;
  deadlineType: DeadlineType;
  workingFullTime: boolean;
  workDaysPerWeek: 3 | 4 | 5 | 6 | 7;
  workStartWindow: WorkWindow;
  workEndWindow: WorkWindow;
  minSleepHours: 6 | 7 | 8 | 9;
  sleepFixedWindow: boolean;
  sleepStartWindow: SleepWindow;
  sleepEndWindow: SleepWindow;
  hasWeeklyRestDay: boolean;
  restDay: 0 | 1 | 2 | 3 | 4 | 5 | 6;
  blackoutBlocks: string[]; // e.g. "Mon:MORNING"
  hasGymAccess: boolean;
  canCookMostDays: boolean;
  hasTransportLimitation: boolean;
  currentlyInjured: boolean;
  beginnerLevel: boolean;
  maxDailyWorkMinutes: 30 | 60 | 90 | 120 | 180;
  noEveningWork: boolean;
  noMorningWork: boolean;
  weekendsAllowed: boolean;
  travelThisPeriod: 'NONE' | '1-3' | '4-7' | '8+';
  acceptsDailyMinimum: boolean;
  acceptsFixedSchedule: boolean;
  acceptsNoRenegotiation7d: boolean;
  acceptsAutomaticCatchUp: boolean;
};

export type FeasibilityVerdict = 'FEASIBLE' | 'FEASIBLE_WITH_CHANGES' | 'INFEASIBLE';

export type PlanProof = {
  verdict: FeasibilityVerdict;
  requiredMinutesPerDay: number;
  workableDays: number;
  scheduledBlocks: number;
  weeklyMinutes: number;
  constraintsSummary: string[];
  failureConditions: string[];
  changeList?: string[];
  status: 'SUBMITTED' | 'DRAFT';
};

export type ColdPlanBlock = {
  id: string;
  dayKey: string;
  startISO: string;
  durationMinutes: number;
  kind: 'EXECUTION' | 'PREP' | 'REVIEW' | 'RECOVERY' | 'NUTRITION';
  title: string;
  locked: boolean;
};

type CompileInput = {
  equation: GoalEquationInput;
  nowDayKey: string;
  timeZone: string;
  cycleId: string;
};

const WINDOW_TIMES: Record<DayWindow, string> = {
  MORNING: '07:30',
  MIDDAY: '12:00',
  AFTERNOON: '16:00',
  EVENING: '19:30'
};

const WINDOW_HOURS: Record<DayWindow, number> = {
  MORNING: 7,
  MIDDAY: 12,
  AFTERNOON: 16,
  EVENING: 19
};

const WORK_START_HOUR: Record<WorkWindow, number> = {
  EARLY: 5,
  MID: 9,
  LATE: 12,
  VARIABLE: 9
};
const WORK_END_HOUR: Record<WorkWindow, number> = {
  EARLY: 13,
  MID: 17,
  LATE: 21,
  VARIABLE: 17
};

const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function weekdayIndex(dayKey: string, timeZone: string) {
  const d = new Date(`${dayKey}T12:00:00.000Z`);
  const label = new Intl.DateTimeFormat('en-US', { timeZone, weekday: 'short' }).format(d);
  return WEEKDAY_LABELS.indexOf(label);
}

function dayKeysBetween(startDayKey: string, endDayKey: string, timeZone: string) {
  const days: string[] = [];
  let cursor = startDayKey;
  while (cursor && cursor <= endDayKey) {
    days.push(cursor);
    if (cursor === endDayKey) break;
    cursor = addDays(cursor, 1, timeZone);
  }
  return days;
}

function isWorkDay(dayKey: string, equation: GoalEquationInput, timeZone: string) {
  const dow = weekdayIndex(dayKey, timeZone);
  if (!equation.weekendsAllowed && (dow === 0 || dow === 6)) return false;
  if (equation.hasWeeklyRestDay && dow === equation.restDay) return false;
  return true;
}

function availableWindows(dayKey: string, equation: GoalEquationInput, timeZone: string) {
  const windows: DayWindow[] = ['MORNING', 'MIDDAY', 'AFTERNOON', 'EVENING'];
  const blackoutSet = new Set(equation.blackoutBlocks || []);
  const dow = weekdayIndex(dayKey, timeZone);
  const dowLabel = WEEKDAY_LABELS[dow] || 'Mon';
  const workStart = WORK_START_HOUR[equation.workStartWindow];
  const workEnd = WORK_END_HOUR[equation.workEndWindow];
  return windows.filter((windowKey) => {
    if (equation.noMorningWork && windowKey === 'MORNING') return false;
    if (equation.noEveningWork && windowKey === 'EVENING') return false;
    if (equation.workingFullTime) {
      const hour = WINDOW_HOURS[windowKey];
      if (hour >= workStart && hour < workEnd) return false;
    }
    if (equation.sleepFixedWindow) {
      const sleepStart = WORK_START_HOUR[equation.sleepStartWindow];
      const sleepEnd = WORK_END_HOUR[equation.sleepEndWindow];
      const hour = WINDOW_HOURS[windowKey];
      if (hour >= sleepStart && hour < sleepEnd) return false;
    }
    if (blackoutSet.has(`${dowLabel}:${windowKey}`)) return false;
    return true;
  });
}

function computeWorkableDays(equation: GoalEquationInput, nowDayKey: string, timeZone: string) {
  const allDays = dayKeysBetween(nowDayKey, equation.deadlineDayKey, timeZone);
  return allDays.filter((dayKey) => isWorkDay(dayKey, equation, timeZone));
}

function requiredMinutesPerUnit(equation: GoalEquationInput) {
  if (equation.objective === 'PUBLISH_COUNT') {
    return equation.beginnerLevel ? 360 : 240;
  }
  return 60;
}

function computeGoalRequirements(equation: GoalEquationInput, workableDays: number) {
  const weeksRemaining = Math.max(1, Math.ceil(workableDays / 7));
  if (equation.objective === 'LOSE_WEIGHT_LBS') {
    const weeklyRequired = equation.objectiveValue / weeksRemaining;
    const sessionsPerWeek = workableDays >= 4 ? 4 : 3;
    const nutritionBlocks = workableDays;
    const totalBlocks = sessionsPerWeek * weeksRemaining + nutritionBlocks;
    const totalMinutes = sessionsPerWeek * 45 * weeksRemaining + nutritionBlocks * 15;
    const requiredMinutesPerDay = Math.ceil(totalMinutes / Math.max(1, workableDays));
    return {
      totalBlocks,
      totalMinutes,
      requiredMinutesPerDay,
      weeklyRequired,
      sessionsPerWeek
    };
  }
  const minutesPerUnit = requiredMinutesPerUnit(equation);
  const totalMinutes = equation.objectiveValue * minutesPerUnit;
  const requiredMinutesPerDay = Math.ceil(totalMinutes / Math.max(1, workableDays));
  const blockDuration = equation.objective === 'PUBLISH_COUNT' ? 60 : 60;
  const blocksPerDay = Math.max(1, Math.ceil(requiredMinutesPerDay / blockDuration));
  const totalBlocks = blocksPerDay * workableDays;
  return {
    totalBlocks,
    totalMinutes,
    requiredMinutesPerDay,
    blockDuration,
    blocksPerDay
  };
}

function feasibilityFromRequirement(requiredMinutesPerDay: number, maxMinutesPerDay: number) {
  if (!maxMinutesPerDay) return { verdict: 'FEASIBLE' as FeasibilityVerdict, changes: [] };
  if (requiredMinutesPerDay > maxMinutesPerDay * 1.2) {
    return {
      verdict: 'INFEASIBLE' as FeasibilityVerdict,
      changes: ['Increase max daily minutes or extend deadline.']
    };
  }
  if (requiredMinutesPerDay > maxMinutesPerDay) {
    return {
      verdict: 'FEASIBLE_WITH_CHANGES' as FeasibilityVerdict,
      changes: ['Increase max daily minutes or add weekend availability.']
    };
  }
  return { verdict: 'FEASIBLE' as FeasibilityVerdict, changes: [] };
}

function makeBlockId(cycleId: string, dayKey: string, index: number) {
  return `blk-cold-${cycleId}-${dayKey}-${index}`;
}

function scheduleBlocks({
  cycleId,
  equation,
  workableDays,
  requiredMinutesPerDay,
  timeZone,
  lockUntilDayKey
}: {
  cycleId: string;
  equation: GoalEquationInput;
  workableDays: string[];
  requiredMinutesPerDay: number;
  timeZone: string;
  lockUntilDayKey: string;
}) {
  const blocks: ColdPlanBlock[] = [];
  const addPrepAndReview = (existing: ColdPlanBlock[]) => {
    if (!workableDays.length) return;
    const firstDay = workableDays[0];
    const prepSlot = availableWindows(firstDay, equation, timeZone)[0];
    if (prepSlot) {
      const prepStart = buildLocalStartISO(firstDay, WINDOW_TIMES[prepSlot], timeZone);
      if (prepStart?.ok) {
        existing.push({
          id: makeBlockId(cycleId, firstDay, existing.length + 1),
          dayKey: firstDay,
          startISO: prepStart.startISO,
          durationMinutes: 20,
          kind: 'PREP',
          title: 'Prep & setup',
          locked: firstDay <= lockUntilDayKey
        });
      }
    }
    const reviewByWeek: Record<string, string> = {};
    workableDays.forEach((dayKey) => {
      const dow = weekdayIndex(dayKey, timeZone);
      const weekStart = addDays(dayKey, -((dow + 6) % 7), timeZone);
      reviewByWeek[weekStart] = dayKey;
    });
    Object.values(reviewByWeek).forEach((dayKey) => {
      const slot = availableWindows(dayKey, equation, timeZone).slice(-1)[0];
      const reviewStart = slot ? buildLocalStartISO(dayKey, WINDOW_TIMES[slot], timeZone) : null;
      if (reviewStart?.ok) {
        existing.push({
          id: makeBlockId(cycleId, dayKey, existing.length + 1),
          dayKey,
          startISO: reviewStart.startISO,
          durationMinutes: 20,
          kind: 'REVIEW',
          title: 'Weekly review',
          locked: dayKey <= lockUntilDayKey
        });
      }
    });
  };
  if (equation.objective === 'LOSE_WEIGHT_LBS') {
    const sessionsPerWeek = workableDays.length >= 4 ? 4 : 3;
    const nutritionDuration = 15;
    const trainingDuration = 45;
    const trainingWeekdays = [1, 3, 5, 6];
    let idx = 0;
    workableDays.forEach((dayKey) => {
      const windows = availableWindows(dayKey, equation, timeZone);
      if (!windows.length) return;
      const firstSlot = windows[0];
      const nutritionStart = buildLocalStartISO(dayKey, WINDOW_TIMES[firstSlot], timeZone);
      if (nutritionStart?.ok) {
        blocks.push({
          id: makeBlockId(cycleId, dayKey, idx++),
          dayKey,
          startISO: nutritionStart.startISO,
          durationMinutes: nutritionDuration,
          kind: 'NUTRITION',
          title: 'Nutrition check',
          locked: dayKey <= lockUntilDayKey
        });
      }
      const dow = weekdayIndex(dayKey, timeZone);
      if (trainingWeekdays.includes(dow)) {
        const slot = windows[Math.min(1, windows.length - 1)] || windows[0];
        const start = buildLocalStartISO(dayKey, WINDOW_TIMES[slot], timeZone);
        if (start?.ok) {
          blocks.push({
            id: makeBlockId(cycleId, dayKey, idx++),
            dayKey,
            startISO: start.startISO,
            durationMinutes: trainingDuration,
            kind: 'EXECUTION',
            title: 'Training session',
            locked: dayKey <= lockUntilDayKey
          });
        }
      }
    });
    addPrepAndReview(blocks);
    return blocks;
  }
  const blockDuration = equation.objective === 'PUBLISH_COUNT' ? 60 : 60;
  let idx = 0;
  workableDays.forEach((dayKey) => {
    let minutesRemaining = requiredMinutesPerDay;
    const windows = availableWindows(dayKey, equation, timeZone);
    if (!windows.length) return;
    let slotIndex = 0;
    while (minutesRemaining > 0 && slotIndex < windows.length) {
      const slot = windows[slotIndex];
      const start = buildLocalStartISO(dayKey, WINDOW_TIMES[slot], timeZone);
      const duration = Math.min(blockDuration, minutesRemaining);
      if (start?.ok) {
        blocks.push({
          id: makeBlockId(cycleId, dayKey, idx++),
          dayKey,
          startISO: start.startISO,
          durationMinutes: duration,
          kind: 'EXECUTION',
          title: equation.objective === 'PUBLISH_COUNT' ? 'Publish unit' : 'Practice session',
          locked: dayKey <= lockUntilDayKey
        });
      }
      minutesRemaining -= duration;
      slotIndex += 1;
    }
  });
  addPrepAndReview(blocks);
  return blocks;
}

export function compileGoalEquationPlan({ equation, nowDayKey, timeZone, cycleId }: CompileInput) {
  const startKey = nowDayKey || nowDayKeyFn(timeZone);
  const workableDays = computeWorkableDays(equation, startKey, timeZone);
  if (!workableDays.length) {
    return {
      planProof: {
        verdict: 'INFEASIBLE' as FeasibilityVerdict,
        requiredMinutesPerDay: 0,
        workableDays: 0,
        scheduledBlocks: 0,
        weeklyMinutes: 0,
        constraintsSummary: ['No workable days in window.'],
        failureConditions: ['No workable days available.'],
        status: equation.acceptsDailyMinimum && equation.acceptsFixedSchedule && equation.acceptsNoRenegotiation7d && equation.acceptsAutomaticCatchUp ? 'SUBMITTED' : 'DRAFT'
      },
      scheduleBlocks: []
    };
  }
  const requirements = computeGoalRequirements(equation, workableDays.length);
  const maxMinutesPerDay = equation.maxDailyWorkMinutes || 120;
  const feasibility = feasibilityFromRequirement(requirements.requiredMinutesPerDay, maxMinutesPerDay);
  const constraintsSummary = [
    `Workable days: ${workableDays.length}`,
    `Max daily minutes: ${maxMinutesPerDay}`,
    `Weekend allowed: ${equation.weekendsAllowed ? 'yes' : 'no'}`
  ];
  if (equation.workingFullTime) constraintsSummary.push('Full-time work schedule applied.');
  if (equation.hasWeeklyRestDay) constraintsSummary.push('Weekly rest day honored.');
  const failureConditions = ['Miss 2 execution blocks in a week → recompile required.'];
  const status =
    equation.acceptsDailyMinimum &&
    equation.acceptsFixedSchedule &&
    equation.acceptsNoRenegotiation7d &&
    equation.acceptsAutomaticCatchUp
      ? 'SUBMITTED'
      : 'DRAFT';
  const lockUntilDayKey = addDays(startKey, 6, timeZone);
  const scheduledBlocks = scheduleBlocks({
    cycleId,
    equation,
    workableDays,
    requiredMinutesPerDay: requirements.requiredMinutesPerDay,
    timeZone,
    lockUntilDayKey
  });
  const weeklyMinutes = Math.ceil(requirements.totalMinutes / Math.max(1, Math.ceil(workableDays.length / 7)));
  const planProof: PlanProof = {
    verdict: feasibility.verdict,
    requiredMinutesPerDay: requirements.requiredMinutesPerDay,
    workableDays: workableDays.length,
    scheduledBlocks: scheduledBlocks.length,
    weeklyMinutes,
    constraintsSummary,
    failureConditions,
    changeList: feasibility.changes,
    status
  };
  return {
    planProof,
    scheduleBlocks: scheduledBlocks
  };
}
