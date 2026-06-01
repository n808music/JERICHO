import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { runStressScenario } from '../../src/stress/stressRunner.ts';

describe('stress realism detector fireability', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-02-01T08:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('reports capacity-bound unplaced behavior under intentionally impossible caps', () => {
    const result = runStressScenario('podcast_30d', {
      scenarioOverride: {
        realismConstraints: {
          maxScheduledMinutesPerDay: 10,
          maxScheduledMinutesPerWeek: 30,
          toleranceMinutes: 0,
        },
      },
    });

    const diagnostics: any = result.diagnostics || {};
    expect(result.metrics.scheduleCoverageRatio).toBeLessThan(1);
    expect(diagnostics.missingSlotsWeighted ?? 0).toBeGreaterThan(0);
    expect(['CAPACITY_BOUND_UNPLACED', 'MILESTONE_WINDOW_NO_SLOT', 'DEP_NOT_READY_IN_WINDOW']).toContain(
      diagnostics.reasonCode
    );
  });

  it('fires DEPENDENCY_TIMING_VIOLATIONS when dependency buffer is intentionally too strict', () => {
    const result = runStressScenario('podcast_30d', {
      scenarioOverride: {
        dependencies: {
          defaultBufferMinutes: 3000,
        },
      },
    });

    expect(result.metrics.depCheckCoverage.eligibleActions).toBeGreaterThan(0);
    expect(result.invariantViolations.some((entry) => entry.code === 'DEPENDENCY_TIMING_VIOLATIONS')).toBe(true);
  });

  it('fires MILESTONE_ANCHORING when checkpoint windows are made impossible', () => {
    const result = runStressScenario('podcast_30d', {
      scenarioOverride: {
        milestones: [
          {
            id: 'impossible-window',
            title: 'Impossible checkpoint window',
            windowStartDayKey: '2026-01-01',
            windowEndDayKey: '2026-01-03',
            actionIds: ['podcast:24', 'podcast:23'],
            checkpointActionIds: ['podcast:22'],
          },
        ],
      },
    });

    expect(result.invariantViolations.some((entry) => entry.code === 'MILESTONE_ANCHORING')).toBe(true);
  });

  it('keeps diagnostics consistent with fully placed truthful schedules', () => {
    const result = runStressScenario('doctor_10y_tight_capacity');
    const diagnostics: any = result.diagnostics || {};

    if (result.metrics.scheduleCoverageRatio === 1 && result.metrics.scheduleTruthRatio >= 0.95) {
      expect(diagnostics.missingSlotsWeighted ?? 0).toBe(0);
      expect(diagnostics.reasonCode).not.toBe('HIT_HARD_CAP');
    }
  });

  it('keeps capacity diagnostics aligned when slots are missing', () => {
    const result = runStressScenario('podcast_30d', {
      scenarioOverride: {
        realismConstraints: {
          maxScheduledMinutesPerDay: 10,
          maxScheduledMinutesPerWeek: 30,
          toleranceMinutes: 0,
        },
      },
    });
    const diagnostics: any = result.diagnostics || {};

    if ((diagnostics.missingSlotsWeighted ?? 0) > 0) {
      expect(result.metrics.scheduleCoverageRatio < 1 || result.metrics.capacityOverageDaysCount > 0).toBe(true);
    }
  });
});
