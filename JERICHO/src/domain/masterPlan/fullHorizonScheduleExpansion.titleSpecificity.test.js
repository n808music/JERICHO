import { describe, it, expect } from 'vitest';
import { expandFullHorizonSchedule } from './fullHorizonScheduleExpansion.js';

const HORIZON_START = '2026-06-01';
const HORIZON_END = '2031-05-19';

const PLAN = {
  id: 'title-test',
  successStandard: 'Active ecosystem by 2031',
  outcomeTarget: 'Active ecosystem by 2031-05-19',
  coreMission: 'Build ecosystem',
};

const PHASE_MODEL = {
  phases: [
    { id: 'p1', label: 'P1', startBoundary: HORIZON_START, endBoundary: '2026-12-31', phaseObjective: 'Found' },
    { id: 'p2', label: 'P2', startBoundary: '2027-01-01', endBoundary: '2028-12-31', phaseObjective: 'Operate' },
    { id: 'p3', label: 'P3', startBoundary: '2029-01-01', endBoundary: HORIZON_END, phaseObjective: 'Scale' },
  ],
};

const LANES = [
  { id: 'lane-product', laneId: 'lane-product', domain: 'product', title: 'Core Product', laneTitle: 'Core Product', activationState: 'active' },
  { id: 'lane-income', laneId: 'lane-income', domain: 'income', title: 'Services Revenue', laneTitle: 'Services Revenue', activationState: 'active' },
];

function runExpansion() {
  return expandFullHorizonSchedule({
    plan: PLAN,
    phaseModel: PHASE_MODEL,
    horizonStartDayKey: HORIZON_START,
    horizonEndDayKey: HORIZON_END,
    lanes: LANES,
    existingForecastBlocks: [],
    committedBlocks: [],
    workDays: ['mon', 'tue', 'wed', 'thu', 'fri'],
    weeklyCapacityMinutes: 30 * 60,
  });
}

const GENERIC_TITLE_PATTERNS = [
  /\bImplement next operating-system control\b/,
  /\bShip next launch-critical feature increment\b/,
  /\bValidate next milestone\b/,
  /\bReview next commercial asset\b/,
  /\bPrepare next software update\b/,
];

describe('Block title specificity', () => {
  const blocks = runExpansion();

  it('no block uses one of the banned generic templates verbatim', () => {
    for (const b of blocks) {
      for (const pat of GENERIC_TITLE_PATTERNS) {
        expect(b.title).not.toMatch(pat);
      }
    }
  });

  it('no titleFamily appears more than 60 times per (phase, lane)', () => {
    const counts = new Map();
    for (const b of blocks) {
      const key = `${b.phaseLabel}|${b.laneId}|${b.titleFamily || b.title}`;
      counts.set(key, (counts.get(key) || 0) + 1);
    }
    const overweight = Array.from(counts.entries()).filter(([, n]) => n > 60);
    expect(overweight).toEqual([]);
  });

  it('every block title is at least 30 characters long', () => {
    for (const b of blocks) {
      expect(b.title.length).toBeGreaterThanOrEqual(30);
    }
  });
});
