import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { runStressScenario } from '../../src/stress/stressRunner.ts';

describe('stress scenario: doctor_10y', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T08:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('remains deterministic and reports long-horizon diagnostics', () => {
    const first = runStressScenario('doctor_10y');
    const second = runStressScenario('doctor_10y', {
      determinismBaseline: {
        proposedSchedulePreview: first.proposedSchedulePreview,
        committedEvents: first.committedEvents,
        materializedSchedule: first.materializedSchedule,
      },
    });

    const hardFailures = second.invariantViolations.filter((violation) => violation.severity === 'hard');

    expect(hardFailures).toEqual([]);
    expect(second.violationSummary.determinism).toBe(0);
    expect(second.violationSummary.parity).toBe(0);
    expect(second.violationSummary.realism).toBeGreaterThanOrEqual(0);
    expect(second.diagnostics).toHaveProperty('diagnosticsInsights');
    expect((second.diagnostics.diagnosticsInsights as string[]).length).toBeGreaterThan(0);
    expect(second.metrics.actionCount).toBeGreaterThanOrEqual(150);
    expect(second.metrics.depCheckCoverage.eligibleActions).toBeGreaterThan(100);
    expect(second.metrics.milestoneWindowMissCount).toBeGreaterThanOrEqual(0);
    expect(second.metrics.scheduleCoverageRatio).toBeLessThan(1);
    expect(second.metrics.outsideExecutionHorizonCount).toBeGreaterThan(0);
    expect(second.metrics.outsideExecutionHorizonEstimateMinTotal).toBeGreaterThan(0);
    expect(
      second.metrics.milestoneWindowSlack.byMilestone['milestone:med_school_complete']?.overlapDays || 0
    ).toBeGreaterThan(0);
  });

  it('writes a machine-readable report artifact', () => {
    const result = runStressScenario('doctor_10y');
    const reportPath = resolve(process.cwd(), 'artifacts/stressReports/doctor_10y.json');

    expect(existsSync(reportPath)).toBe(true);
    const report = JSON.parse(readFileSync(reportPath, 'utf8'));

    expect(report.scenarioId).toBe('doctor_10y');
    expect(report.violationSummary.determinism).toBe(0);
    expect(report.violationSummary.parity).toBe(0);
    expect(report.metrics.actionCount).toBe(result.metrics.actionCount);
    expect(Array.isArray(report.invariantViolations)).toBe(true);
  });
});
