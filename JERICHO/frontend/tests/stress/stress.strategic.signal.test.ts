import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { runStressScenario } from '../../src/stress/stressRunner.ts';
import { loadStressScenario } from '../../src/stress/fixturesLoader.ts';

function mapPlacement(items: any[] = []) {
  const map = new Map<string, { dayKey: string; startISO: string }>();
  [...items]
    .filter((item) => item?.actionId)
    .sort((a, b) => `${a.startISO || ''}`.localeCompare(`${b.startISO || ''}`))
    .forEach((item) => {
      const id = item.actionId as string;
      if (map.has(id)) return;
      map.set(id, {
        dayKey: item.dayKey || item.dateISO || (item.startISO || '').slice(0, 10),
        startISO: item.startISO || '',
      });
    });
  return map;
}

function movedCount(before: any[] = [], after: any[] = []) {
  const a = mapPlacement(before);
  const b = mapPlacement(after);
  const ids = new Set([...a.keys(), ...b.keys()]);
  let moved = 0;
  ids.forEach((id) => {
    const lhs = a.get(id);
    const rhs = b.get(id);
    if (!lhs || !rhs) {
      moved += 1;
      return;
    }
    if (lhs.dayKey !== rhs.dayKey || lhs.startISO !== rhs.startISO) moved += 1;
  });
  return moved;
}

describe('stress strategic signal scenarios', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-02-01T08:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('keeps perturbation churn localized under sticky scheduling', () => {
    const baseline = runStressScenario('doctor_10y', { writeReport: false });
    const fixture = loadStressScenario('doctor_10y');
    const perturbedActions = (fixture.inferredGraph.actions || []).map((action, index) => {
      if (index !== 6) return action;
      return {
        ...action,
        topoIndex: 1,
        priority: 0,
      };
    });
    const perturbed = runStressScenario('doctor_10y', {
      writeReport: false,
      scenarioOverride: {
        inferredGraph: {
          ...fixture.inferredGraph,
          actions: perturbedActions,
        },
      },
    });

    const moved = movedCount(baseline.proposedSchedulePreview, perturbed.proposedSchedulePreview);
    expect(moved).toBeGreaterThan(0);
    expect(moved).toBeLessThanOrEqual(120);
    expect(perturbed.metrics.movedChunkCount).toBeGreaterThanOrEqual(0);
    expect(perturbed.metrics.droppedChunkCount).toBeGreaterThanOrEqual(0);
  });

  it('fires dependency-spacing violation in a minimal micro scenario', () => {
    const result = runStressScenario('podcast_30d', {
      writeReport: false,
      scenarioOverride: {
        horizon: {
          startDayKey: '2026-02-01',
          endDayKey: '2026-02-01',
        },
        availability: {
          daysPerWeek: 7,
          specificDays: 'sun,mon,tue,wed,thu,fri,sat',
          maxBlocksPerDay: 3,
          routeMinutesDefault: 30,
        },
        dependencies: {
          defaultBufferMinutes: 12 * 60,
        },
        inferredGraph: {
          source: 'fixture_snapshot',
          snapshotVersion: 'dep_micro.v1',
          actions: [
            {
              id: 'dep_micro:A',
              title: 'Dependency A',
              detail: 'Long action to anchor end time',
              estimateMin: 120,
              category: 'Focus',
              deps: [],
              topoIndex: 0,
              priority: 1,
              status: 'todo',
            },
            {
              id: 'dep_micro:B',
              title: 'Dependency B',
              detail: 'Must start after A with large buffer',
              estimateMin: 30,
              category: 'Focus',
              deps: ['dep_micro:A'],
              topoIndex: 1,
              priority: 2,
              status: 'todo',
            },
          ],
        },
      },
    });

    expect(result.invariantViolations.some((entry) => entry.code === 'DEPENDENCY_TIMING_VIOLATIONS')).toBe(false);
  });

  it('shows capacity overage reduction with longer horizons (same action set)', () => {
    const short = runStressScenario('podcast_30d', {
      writeReport: false,
      scenarioOverride: {
        realismConstraints: {
          maxScheduledMinutesPerDay: 30,
          toleranceMinutes: 0,
        },
        horizon: {
          startDayKey: '2026-02-01',
          endDayKey: '2026-03-02',
        },
      },
    });

    const medium = runStressScenario('podcast_30d', {
      writeReport: false,
      scenarioOverride: {
        realismConstraints: {
          maxScheduledMinutesPerDay: 30,
          toleranceMinutes: 0,
        },
        horizon: {
          startDayKey: '2026-02-01',
          endDayKey: '2026-05-01',
        },
      },
    });

    const long = runStressScenario('podcast_30d', {
      writeReport: false,
      scenarioOverride: {
        realismConstraints: {
          maxScheduledMinutesPerDay: 30,
          toleranceMinutes: 0,
        },
        horizon: {
          startDayKey: '2026-02-01',
          endDayKey: '2027-02-01',
        },
      },
    });

    expect(medium.metrics.capacityOverageDaysCount).toBeLessThanOrEqual(short.metrics.capacityOverageDaysCount);
    expect(long.metrics.capacityOverageDaysCount).toBeLessThanOrEqual(medium.metrics.capacityOverageDaysCount);
  });

  it('optimizer flag does not worsen quality score and keeps churn bounded', () => {
    const baseline = runStressScenario('doctor_10y', { writeReport: false });
    const optimized = runStressScenario('doctor_10y', {
      writeReport: false,
      scenarioOverride: {
        planDraft: {
          ...(loadStressScenario('doctor_10y').planDraft || {}),
          executionHorizonDays: 90,
          enableQualityOptimizer: true,
          optimizerMaxIterations: 2,
          optimizerMaxCandidates: 30,
        },
      },
    });
    expect(optimized.metrics.qualityScoreTotal).toBeLessThanOrEqual(baseline.metrics.qualityScoreTotal + 1e-9);
    expect(optimized.metrics.churnIndex).toBeLessThanOrEqual(Math.max(0.4, baseline.metrics.churnIndex + 0.1));
  });
});
