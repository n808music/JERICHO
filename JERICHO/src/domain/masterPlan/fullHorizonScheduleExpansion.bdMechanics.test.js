/**
 * Generated full-horizon schedules must include external-facing BD mechanics on
 * active commercial/capital/institution/civic lanes (Phase 5 — Execution
 * Professionalism Remediation).
 */
import { describe, expect, it } from 'vitest';

import { expandFullHorizonSchedule } from './fullHorizonScheduleExpansion.js';

const PLAN = { id: 'phase5-test-plan', successStandard: 'X', outcomeTarget: 'Y' };
const PHASE_MODEL = {
  phases: [
    { id: 'p1', label: 'P1', startBoundary: '2026-06-01', endBoundary: '2026-12-31' },
    { id: 'p2', label: 'P2', startBoundary: '2027-01-01', endBoundary: '2028-12-31' },
    { id: 'p3', label: 'P3', startBoundary: '2029-01-01', endBoundary: '2031-05-19' },
  ],
};

function laneOf(domain, title, status = 'active') {
  return {
    id: `lane-${domain}`,
    laneId: `lane-${domain}`,
    domain,
    title,
    laneTitle: title,
    activationState: status,
  };
}

function expand(lane) {
  return expandFullHorizonSchedule({
    plan: PLAN,
    phaseModel: PHASE_MODEL,
    horizonStartDayKey: '2026-06-01',
    horizonEndDayKey: '2031-05-19',
    lanes: [lane],
    existingForecastBlocks: [],
    committedBlocks: [],
    workDays: ['mon', 'tue', 'wed', 'thu', 'fri'],
  });
}

describe('generated income_stream lane carries BD mechanics', () => {
  const blocks = expand(laneOf('income', 'Services Engine'));
  it('contains at least one block flagged isExternalBdMechanic', () => {
    expect(blocks.some((b) => b.isExternalBdMechanic === true)).toBe(true);
  });
  it('contains at least one block flagged isExternalStakeholderTouchpoint', () => {
    expect(blocks.some((b) => b.isExternalStakeholderTouchpoint === true)).toBe(true);
  });
});

describe('generated capital_real_estate lane carries BD mechanics + budget artifact', () => {
  const blocks = expand(laneOf('capital', 'Real Estate Capital'));
  it('contains at least one block flagged isExternalBdMechanic', () => {
    expect(blocks.some((b) => b.isExternalBdMechanic === true)).toBe(true);
  });
  it('contains at least one stakeholder touchpoint', () => {
    expect(blocks.some((b) => b.isExternalStakeholderTouchpoint === true)).toBe(true);
  });
  it('contains at least one block whose producesArtifact declares budget or unknown-budget flag', () => {
    const pattern = /\$\s*\d|\b\d+\s*(?:k|m|b)\b|\bbudget\s+(?:range|amount)\b|\bunknown[- ]budget\b/i;
    expect(blocks.some((b) => pattern.test(String(b.producesArtifact || '')))).toBe(true);
  });
});

describe('generated institution_education lane carries BD mechanics', () => {
  const blocks = expand(laneOf('institution', 'School Pilot'));
  it('contains at least one stakeholder touchpoint', () => {
    expect(blocks.some((b) => b.isExternalStakeholderTouchpoint === true)).toBe(true);
  });
});

describe('generated civic_development lane carries BD mechanics', () => {
  const blocks = expand(laneOf('civic', 'District Coalition'));
  it('contains at least one stakeholder touchpoint', () => {
    expect(blocks.some((b) => b.isExternalStakeholderTouchpoint === true)).toBe(true);
  });
});

describe('product_software lane is exempt from BD mechanic enforcement', () => {
  const blocks = expand(laneOf('product', 'Core App'));
  it('may or may not contain BD mechanics — generation does not break', () => {
    expect(blocks.length).toBeGreaterThan(0);
  });
});
