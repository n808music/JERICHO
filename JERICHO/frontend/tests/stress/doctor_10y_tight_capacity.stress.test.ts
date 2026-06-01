import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { runStressScenario } from '../../src/stress/stressRunner.ts';

describe('stress scenario: doctor_10y_tight_capacity', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T08:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('keeps determinism/parity hard invariants clean and enforces known-gap visibility', () => {
    const first = runStressScenario('doctor_10y_tight_capacity');
    const second = runStressScenario('doctor_10y_tight_capacity', {
      determinismBaseline: {
        proposedSchedulePreview: first.proposedSchedulePreview,
        committedEvents: first.committedEvents,
        materializedSchedule: first.materializedSchedule,
      },
    });

    const hardFailures = second.invariantViolations.filter((violation) => violation.severity === 'hard');
    const realismViolations = second.invariantViolations.filter((violation) => violation.severity === 'realism');

    expect(hardFailures).toEqual([]);
    expect(second.violationSummary.determinism).toBe(0);
    expect(second.violationSummary.parity).toBe(0);
    expect(second.scenarioExpectation.requireAtLeastOneViolation).toBe(true);
    expect(realismViolations.length).toBeGreaterThan(0);

    expect(second.metrics.depCheckCoverage.eligibleActions).toBeGreaterThan(0);
    expect(second.metrics.actionCount).toBeGreaterThanOrEqual(200);
    expect(second.metrics.dailyLoadStats.max).toBeGreaterThanOrEqual(30);
    expect(second.metrics.scheduleCoverageRatio).toBeLessThan(1);
    expect(second.metrics.unplacedEstimateMinTotal).toBeGreaterThan(0);
    expect(second.metrics.milestonePlacedRatio.avg).toBeGreaterThan(0);
    expect(second.metrics.anchoringMissDelta).toBe(0);
    expect(second.metrics.depWindowBlockedCount).toBeGreaterThanOrEqual(0);
    expect(second.metrics.milestoneWindowSlack.infeasibleMilestonesCount).toBeGreaterThan(0);
    expect(second.metrics.milestoneWindowSlack.slackRatioMin).toBeLessThan(1);
    expect(
      second.metrics.milestoneWindowSlack.byMilestone['tight:undergrad_complete']?.overlapDays || 0
    ).toBeGreaterThan(0);
    expect(second.metrics.milestoneWindowSlack.byMilestone['tight:mcat_taken']?.overlapDays || 0).toBeGreaterThan(0);
    expect(['CAPACITY_BOUND_UNPLACED', 'MILESTONE_WINDOW_NO_SLOT', 'DEP_NOT_READY_IN_WINDOW']).toContain(
      (second.diagnostics as any)?.reasonCode
    );
    expect(
      realismViolations.some((violation) =>
        ['CAPACITY_REALISM', 'MILESTONE_ANCHORING', 'DEPENDENCY_TIMING_VIOLATIONS'].includes(violation.code)
      )
    ).toBe(true);
  });

  it('writes a machine-readable report artifact', () => {
    const result = runStressScenario('doctor_10y_tight_capacity');
    const reportPath = resolve(process.cwd(), 'artifacts/stressReports/doctor_10y_tight_capacity.json');

    expect(existsSync(reportPath)).toBe(true);
    const report = JSON.parse(readFileSync(reportPath, 'utf8'));

    expect(report.scenarioId).toBe('doctor_10y_tight_capacity');
    expect(report.scenarioExpectation.requireAtLeastOneViolation).toBe(true);
    expect(report.violationSummary.determinism).toBe(0);
    expect(report.violationSummary.parity).toBe(0);
    expect(report.violationSummary.realism).toBeGreaterThan(0);
    expect(report.metrics.actionCount).toBe(result.metrics.actionCount);
  });
});
