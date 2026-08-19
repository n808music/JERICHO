import React from 'react';
import ReactDOMServer from 'react-dom/server';
import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, afterEach } from 'vitest';
import ZionDashboard from '../../src/components/ZionDashboard.jsx';
import { IdentityProvider } from '../../src/state/identityStore.js';
import {
  buildWindowSpec,
  formatWindowLabel,
  getMonthDayKeys,
  getQuarterMonths,
  getWeekDayKeys,
  getYearMonths,
  shiftAnchorDayKey,
} from '../../src/state/time/window.ts';
import { addDays } from '../../src/state/time/time.ts';

const TIME_ZONE = 'UTC';
const ANCHOR_DAY = '2026-02-10';
const ANCHOR_ISO = `${ANCHOR_DAY}T12:00:00.000Z`;

function makeBlock(id, dayKey, hour = 9, minutes = 0, duration = 30, label = 'Block') {
  const start = `${dayKey}T${String(hour).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:00.000Z`;
  const endMinutes = minutes + duration;
  const endHour = hour + Math.floor(endMinutes / 60);
  const endMinute = endMinutes % 60;
  const end = `${dayKey}T${String(endHour).padStart(2, '0')}:${String(endMinute).padStart(2, '0')}:00.000Z`;
  return { id, label, start, end, status: 'planned', practice: 'Creation' };
}

function buildState(blockLabel = 'Anchor block') {
  const block = makeBlock('blk-anchor', ANCHOR_DAY, 9, 0, 30, blockLabel);
  return {
    vector: { day: 1, direction: 'Test goal', stability: 'steady', drift: 'contained', momentum: 'active' },
    lenses: {
      aim: { description: '', horizon: '90d' },
      pattern: { routines: { Body: [], Resources: [], Creation: [], Focus: [] }, dailyTargets: [], defaultMinutes: 30 },
      flow: { streams: [] },
    },
    activeCycleId: 'cycle-1',
    cyclesById: {
      'cycle-1': {
        id: 'cycle-1',
        status: 'active',
        startedAtDayKey: '2026-02-01',
        definiteGoal: { outcome: 'Test goal', deadlineDayKey: '2026-12-31' },
      },
    },
    goalExecutionContract: {
      goalId: 'goal-1',
      goalText: 'Test goal',
      startDayKey: '2026-02-01',
      endDayKey: '2026-12-31',
    },
    today: {
      date: ANCHOR_DAY,
      blocks: [block],
      completionRate: 0,
      driftSignal: 'contained',
      loadByPractice: {},
      practices: [],
    },
    currentWeek: { weekStart: ANCHOR_DAY, days: [], metrics: {} },
    cycle: [
      {
        date: ANCHOR_DAY,
        blocks: [block],
        completionRate: 0,
        driftSignal: 'contained',
        loadByPractice: {},
        practices: [],
      },
    ],
    templates: { objectives: {} },
    stability: { headline: '', actionLine: '' },
    meta: { version: '1.0.0', onboardingComplete: true },
    recurringPatterns: [],
    lastSessionChange: null,
    nextSuggestion: null,
    executionEvents: [],
    goalDirective: null,
    directiveEligibilityByGoal: {},
    suggestionHistory: {
      dayKey: ANCHOR_DAY,
      count: 0,
      lastSuggestedAtISO: null,
      lastSuggestedAtISOByGoal: {},
      dailyCountByGoal: {},
      denials: [],
    },
    appTime: { timeZone: TIME_ZONE, nowISO: ANCHOR_ISO, activeDayKey: ANCHOR_DAY, isFollowingNow: true },
  };
}

describe('Zion multi-view navigation', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders week view with correct header and 7 days', () => {
    const html = ReactDOMServer.renderToString(
      <IdentityProvider initialState={buildState()}>
        <ZionDashboard initialView="today" initialZionView="week" initialAnchorDayKey={ANCHOR_DAY} />
      </IdentityProvider>
    );
    const weekKeys = getWeekDayKeys(ANCHOR_ISO, TIME_ZONE);
    expect(weekKeys).toEqual([
      '2026-02-08',
      '2026-02-09',
      '2026-02-10',
      '2026-02-11',
      '2026-02-12',
      '2026-02-13',
      '2026-02-14',
    ]);
    weekKeys.forEach((dayKey) => {
      expect(html).toContain(`data-day="${dayKey}"`);
    });
    const label = formatWindowLabel(buildWindowSpec('week', ANCHOR_ISO, TIME_ZONE), TIME_ZONE);
    expect(label).toContain('Feb 8, 2026');
    expect(label).toContain('Feb 14, 2026');
    expect(html).toContain(label);
  });

  it('renders month view with correct header and day cells', () => {
    const html = ReactDOMServer.renderToString(
      <IdentityProvider initialState={buildState()}>
        <ZionDashboard initialView="today" initialZionView="month" initialAnchorDayKey={ANCHOR_DAY} />
      </IdentityProvider>
    );
    const label = formatWindowLabel(buildWindowSpec('month', ANCHOR_ISO, TIME_ZONE), TIME_ZONE);
    expect(html).toContain(label);
    const monthKeys = getMonthDayKeys(ANCHOR_ISO, TIME_ZONE);
    expect(html).toContain(`data-day="${monthKeys[0]}"`);
    expect(html).toContain(`data-day="${monthKeys[monthKeys.length - 1]}"`);
  });

  it('renders quarter view with three months and correct label', () => {
    const html = ReactDOMServer.renderToString(
      <IdentityProvider initialState={buildState()}>
        <ZionDashboard initialView="today" initialZionView="quarter" initialAnchorDayKey={ANCHOR_DAY} />
      </IdentityProvider>
    );
    const label = formatWindowLabel(buildWindowSpec('quarter', ANCHOR_ISO, TIME_ZONE), TIME_ZONE);
    expect(html).toContain(label);
    const quarterMonths = getQuarterMonths(ANCHOR_ISO, TIME_ZONE);
    quarterMonths.forEach((monthKey) => {
      expect(html).toContain(`data-month="${monthKey}"`);
    });
  });

  it('renders year view with 12 months', () => {
    const html = ReactDOMServer.renderToString(
      <IdentityProvider initialState={buildState()}>
        <ZionDashboard initialView="today" initialZionView="year" initialAnchorDayKey={ANCHOR_DAY} />
      </IdentityProvider>
    );
    const yearMonths = getYearMonths(ANCHOR_ISO, TIME_ZONE);
    yearMonths.forEach((monthKey) => {
      expect(html).toContain(`data-month="${monthKey}"`);
    });
  });

  it('shifts anchors deterministically by window unit', () => {
    const nextWeek = shiftAnchorDayKey(ANCHOR_ISO, 'week', 1, TIME_ZONE);
    expect(nextWeek).toBe(addDays(ANCHOR_DAY, 7, TIME_ZONE));
    const nextMonth = shiftAnchorDayKey(ANCHOR_ISO, 'month', 1, TIME_ZONE);
    expect(nextMonth.startsWith('2026-03-')).toBe(true);
  });

  it('treats Today as its own mode and leaves month view when selected', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-02-10T15:30:45.000Z'));
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

    render(
      <IdentityProvider initialState={buildState()}>
        <ZionDashboard initialView="today" initialZionView="month" initialAnchorDayKey={ANCHOR_DAY} />
      </IdentityProvider>
    );

    expect(screen.getByText(/February 2026/i)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /^Today$/i }));

    expect(screen.getByText('Feb 10')).toBeInTheDocument();
    expect(screen.getByText('9:30:45 AM')).toBeInTheDocument();
    expect(screen.queryByText(/February 2026/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Jump to current/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Go to next today/i })).not.toBeInTheDocument();
  });
});
