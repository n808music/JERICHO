import { buildLocalStartISO } from '../time/time.ts';
import { buildExecutionEventFromBlock } from '../engine/todayAuthority.ts';

export const FIXED_DAY = '2026-01-08';
export const NOW_ISO = `${FIXED_DAY}T12:00:00.000Z`;

export function buildBlankState(override = {}) {
  return {
    vector: { day: 1, direction: '', stability: 'steady', drift: 'contained', momentum: 'active' },
    lenses: { aim: { description: '', horizon: '90d', narrative: '' } },
    today: { date: FIXED_DAY, blocks: [], completionRate: 0, driftSignal: 'contained', loadByPractice: {}, practices: [] },
    currentWeek: { weekStart: FIXED_DAY, days: [], metrics: {} },
    cycle: [],
    viewDate: FIXED_DAY,
    templates: { objectives: {} },
    lastAdaptedDate: null,
    stability: { headline: '', actionLine: '' },
    meta: { version: '1.0.0', onboardingComplete: false, lastActiveDate: FIXED_DAY, scenarioLabel: '' },
    recurringPatterns: [],
    lastSessionChange: null,
    nextSuggestion: null,
    executionEvents: [],
    ledger: [],
    appTime: { timeZone: 'UTC', nowISO: NOW_ISO, activeDayKey: FIXED_DAY, isFollowingNow: true },
    cyclesById: {},
    cycles: [],
    suggestedBlocks: [],
    suggestionEvents: [],
    planPreview: null,
    planDraft: null,
    goalExecutionContract: null,
    activeGoalId: null,
    profileLearning: null,
    ...override
  };
}

export function addCompletedEventsForBlocks(state, blocks) {
  const events = blocks.map((block, idx) => {
    return buildExecutionEventFromBlock(block, {
      completed: true,
      kind: 'complete',
      dateISO: FIXED_DAY,
      minutes: (block && block.durationMinutes) || 30
    });
  });
  state.executionEvents = [...(state.executionEvents || []), ...events];
  return events;
}

export function localStartISOForHour(hour) {
  return buildLocalStartISO(FIXED_DAY, `${String(hour).padStart(2, '0')}:00`, 'UTC').startISO;
}
