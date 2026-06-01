import { describe, it, expect } from 'vitest';
import { compileAutoAsanaPlan } from '../engine/autoAsanaPlan.ts';
import { buildLocalStartISO } from '../time/time.ts';

const NOW_ISO = '2026-01-08T12:00:00.000Z';

describe('autoAsana scheduler v1.1', () => {
  it('avoids forbidden windows and places at earliest valid slot', () => {
    const plan = compileAutoAsanaPlan({
      goalId: 'goal-1',
      cycleId: 'cycle-1',
      nowISO: NOW_ISO,
      horizonDays: 1,
      planProof: {
        workableDaysRemaining: 1,
        totalRequiredUnits: 1,
        requiredPacePerDay: 1,
        maxPerDay: 2,
        maxPerWeek: 7,
        slackUnits: 1,
        slackRatio: 0.5,
        intensityRatio: 0.5,
      },
      constraints: {
        timezone: 'America/Chicago',
        maxBlocksPerDay: 2,
        workingHoursWindows: [{ startMin: 9 * 60, endMin: 17 * 60 }],
        forbiddenTimeWindows: [{ startMin: 12 * 60, endMin: 13 * 60 }],
      },
    });
    const placed = plan.horizonBlocks[0];
    expect(placed).toBeTruthy();
    expect(minutesFromISO(placed.startISO, 'America/Chicago')).toBe(9 * 60);
  });

  it('avoids overlap with accepted blocks', () => {
    const plan = compileAutoAsanaPlan({
      goalId: 'goal-2',
      cycleId: 'cycle-2',
      nowISO: NOW_ISO,
      horizonDays: 1,
      planProof: {
        workableDaysRemaining: 1,
        totalRequiredUnits: 1,
        requiredPacePerDay: 1,
        maxPerDay: 2,
        maxPerWeek: 7,
        slackUnits: 1,
        slackRatio: 0.5,
        intensityRatio: 0.5,
      },
      constraints: {
        timezone: 'America/Chicago',
        maxBlocksPerDay: 2,
        workingHoursWindows: [{ startMin: 9 * 60, endMin: 11 * 60 }],
      },
      acceptedBlocks: [
        {
          id: 'blk-1',
          startISO: buildLocalStartISO('2026-01-08', '09:00', 'America/Chicago').startISO,
          durationMinutes: 60,
        },
      ],
    });
    const placed = plan.horizonBlocks[0];
    expect(placed).toBeTruthy();
    expect(minutesFromISO(placed.startISO, 'America/Chicago')).toBe(10 * 60);
  });

  it('skips forbidden day keys', () => {
    const plan = compileAutoAsanaPlan({
      goalId: 'goal-3',
      cycleId: 'cycle-3',
      nowISO: NOW_ISO,
      horizonDays: 2,
      planProof: {
        workableDaysRemaining: 2,
        totalRequiredUnits: 2,
        requiredPacePerDay: 1,
        maxPerDay: 2,
        maxPerWeek: 7,
        slackUnits: 1,
        slackRatio: 0.5,
        intensityRatio: 0.5,
      },
      constraints: {
        timezone: 'America/Chicago',
        maxBlocksPerDay: 2,
        forbiddenDayKeys: ['2026-01-08'],
      },
    });
    expect(plan.horizonBlocks.every((b) => b.dayKey !== '2026-01-08')).toBe(true);
  });

  it('enforces max per day', () => {
    const plan = compileAutoAsanaPlan({
      goalId: 'goal-5',
      cycleId: 'cycle-5',
      nowISO: NOW_ISO,
      horizonDays: 1,
      planProof: {
        workableDaysRemaining: 1,
        totalRequiredUnits: 2,
        requiredPacePerDay: 2,
        maxPerDay: 1,
        maxPerWeek: 7,
        slackUnits: 0,
        slackRatio: 0,
        intensityRatio: 1,
      },
      constraints: {
        timezone: 'America/Chicago',
        maxBlocksPerDay: 1,
        workingHoursWindows: [{ startMin: 9 * 60, endMin: 12 * 60 }],
      },
    });
    expect(plan.horizonBlocks.length).toBe(1);
    expect(plan.conflicts.some((c) => c.code === 'EXCEEDS_MAX_PER_DAY')).toBe(true);
  });

  it('reports horizon insufficiency when valid work exceeds schedulable slots', () => {
    const plan = compileAutoAsanaPlan({
      goalId: 'goal-5b',
      cycleId: 'cycle-5b',
      nowISO: NOW_ISO,
      horizonDays: 1,
      planProof: {
        workableDaysRemaining: 1,
        totalRequiredUnits: 2,
        requiredPacePerDay: 2,
        maxPerDay: 1,
        maxPerWeek: 7,
        slackUnits: 0,
        slackRatio: 0,
        intensityRatio: 1,
      },
      constraints: {
        timezone: 'UTC',
        maxBlocksPerDay: 1,
        weeklyWindows: {
          THU: [{ startHHMM: '09:00', endHHMM: '10:00' }],
        },
        cycleStartDayKey: '2026-01-08',
        cycleEndDayKey: '2026-01-08',
      },
      sessionPlan: [
        {
          date: '2026-01-08',
          startTime: '09:00',
          durationMinutes: 60,
          deliverableId: 'deliv-a',
          actionId: 'act-a',
          title: 'First required block',
        },
        {
          date: '2026-01-08',
          startTime: '09:00',
          durationMinutes: 60,
          deliverableId: 'deliv-b',
          actionId: 'act-b',
          title: 'Second required block',
        },
      ],
    });

    expect(plan.summary).toEqual(
      expect.objectContaining({
        planStatus: 'VALID_BUT_HORIZON_INSUFFICIENT',
        requiredBlockCount: 2,
        scheduledBlockCount: 1,
        unscheduledBlockCount: 1,
      })
    );
    expect(plan.summary.candidateResolutionKinds).toEqual(
      expect.arrayContaining(['EXTEND_HORIZON', 'ACCEPT_PARTIAL_PLAN'])
    );
    expect(plan.summary.recommendations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: 'EXTEND_HORIZON',
          unscheduledBlockCount: 1,
        }),
        expect.objectContaining({
          kind: 'ACCEPT_PARTIAL_PLAN',
          scheduledBlockCount: 1,
          unscheduledBlockCount: 1,
        }),
      ])
    );
  });

  it('stamps commerce readiness level from commerce action lineage', () => {
    const plan = compileAutoAsanaPlan({
      goalId: 'goal-commerce-readiness',
      cycleId: 'cycle-commerce-readiness',
      nowISO: NOW_ISO,
      horizonDays: 5,
      planProof: {
        workableDaysRemaining: 5,
        totalRequiredUnits: 3,
        requiredPacePerDay: 1,
        maxPerDay: 2,
        maxPerWeek: 7,
        slackUnits: 2,
        slackRatio: 0.5,
        intensityRatio: 0.5,
      },
      constraints: {
        timezone: 'UTC',
        maxBlocksPerDay: 2,
        cycleStartDayKey: '2026-01-08',
        cycleEndDayKey: '2026-01-12',
      },
      sessionPlan: [
        {
          date: '2026-01-08',
          startTime: '09:00',
          durationMinutes: 60,
          deliverableId: 'deliverable-commerce',
          actionId: 'brand:02:01:gum-commerce-readiness',
          title: 'Define launch offer promise, pack size, price hypothesis, and buyer guarantee',
        },
        {
          date: '2026-01-09',
          startTime: '09:00',
          durationMinutes: 60,
          deliverableId: 'deliverable-sales',
          actionId: 'brand:04:01:cycle-1-outreach-response',
          title: 'Cycle 1 outreach batch and response capture',
        },
      ],
    });

    expect(plan.horizonBlocks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          actionId: 'brand:02:01:gum-commerce-readiness',
          commerceReadinessLevel: 'hypothesis',
        }),
        expect.objectContaining({
          actionId: 'brand:04:01:cycle-1-outreach-response',
          commerceReadinessLevel: 'validated',
        }),
      ])
    );
  });

  it('is deterministic with identical inputs', () => {
    const payload = {
      goalId: 'goal-6',
      cycleId: 'cycle-6',
      nowISO: NOW_ISO,
      horizonDays: 3,
      planProof: {
        workableDaysRemaining: 3,
        totalRequiredUnits: 3,
        requiredPacePerDay: 1,
        maxPerDay: 2,
        maxPerWeek: 7,
        slackUnits: 2,
        slackRatio: 0.5,
        intensityRatio: 0.5,
      },
      constraints: {
        timezone: 'America/Chicago',
        maxBlocksPerDay: 2,
        workingHoursWindows: [{ startMin: 9 * 60, endMin: 17 * 60 }],
      },
    };
    const planA = compileAutoAsanaPlan(payload);
    const planB = compileAutoAsanaPlan(payload);
    expect(planA.horizonBlocks).toEqual(planB.horizonBlocks);
    expect(planA.conflicts).toEqual(planB.conflicts);
  });

  it('does not re-emit already accepted session identities when regenerating later in the cycle', () => {
    const plan = compileAutoAsanaPlan({
      goalId: 'goal-7',
      cycleId: 'cycle-7',
      nowISO: '2026-04-01T12:00:00.000Z',
      horizonDays: 30,
      planProof: {
        workableDaysRemaining: 30,
        totalRequiredUnits: 4,
        requiredPacePerDay: 1,
        maxPerDay: 2,
        maxPerWeek: 7,
        slackUnits: 2,
        slackRatio: 0.5,
        intensityRatio: 0.5,
      },
      constraints: {
        timezone: 'America/Chicago',
        maxBlocksPerDay: 2,
        workingHoursWindows: [{ startMin: 9 * 60, endMin: 17 * 60 }],
      },
      acceptedBlocks: [
        {
          id: 'blk-accepted-1',
          startISO: buildLocalStartISO('2026-03-18', '09:00', 'America/Chicago').startISO,
          durationMinutes: 60,
          deliverableId: 'deliv-1',
          actionId: 'act-1',
          sessionIndex: 0,
          identityKey: 'cycle-7::deliv-1::act-1::0',
        },
      ],
      sessionPlan: [
        {
          date: '2026-03-18',
          startTime: '09:00',
          durationMinutes: 60,
          deliverableId: 'deliv-1',
          actionId: 'act-1',
          title: 'Draft creative brief and narrative intent',
        },
        {
          date: '2026-04-03',
          startTime: '09:00',
          durationMinutes: 60,
          deliverableId: 'deliv-2',
          actionId: 'act-2',
          title: 'Build reference board and style direction',
        },
      ],
    });

    const titles = plan.horizonBlocks.map((block) => block.title);
    const identities = plan.horizonBlocks.map((block) => block.identityKey);
    expect(titles).not.toContain('Draft creative brief and narrative intent');
    expect(identities).not.toContain('cycle-7::deliv-1::act-1::0');
    expect(titles).toContain('Build reference board and style direction');
  });

  it('still schedules explicit session plans when plan proof pace collapses to zero', () => {
    const plan = compileAutoAsanaPlan({
      goalId: 'goal-9',
      cycleId: 'cycle-9',
      nowISO: '2026-03-23T12:00:00.000Z',
      horizonDays: 30,
      planProof: {
        workableDaysRemaining: 30,
        totalRequiredUnits: 10,
        requiredPacePerDay: 0,
        maxPerDay: 0,
        maxPerWeek: 0,
        slackUnits: 0,
        slackRatio: 0,
        intensityRatio: 1,
      },
      constraints: {
        timezone: 'America/Chicago',
        maxBlocksPerDay: 6,
        weeklyWindows: {
          MON: [{ startHHMM: '09:00', endHHMM: '17:00' }],
          TUE: [{ startHHMM: '09:00', endHHMM: '17:00' }],
          WED: [{ startHHMM: '09:00', endHHMM: '17:00' }],
          THU: [{ startHHMM: '09:00', endHHMM: '17:00' }],
          FRI: [{ startHHMM: '09:00', endHHMM: '17:00' }],
        },
      },
      sessionPlan: [
        {
          date: '2026-03-23',
          startTime: '09:00',
          durationMinutes: 60,
          deliverableId: 'deliv-1',
          actionId: 'act-1',
          title: 'Draft creative brief and narrative intent',
        },
      ],
    });

    expect(plan.horizonBlocks.length).toBe(1);
    expect(plan.horizonBlocks[0].dayKey).toBe('2026-03-23');
    expect(plan.horizonBlocks[0].title).toBe('Draft creative brief and narrative intent');
  });

  it('stamps dependency arrays on every block, including dependency-free roots', () => {
    const plan = compileAutoAsanaPlan({
      goalId: 'goal-deps-1',
      cycleId: 'cycle-deps-1',
      nowISO: '2026-03-23T12:00:00.000Z',
      horizonDays: 14,
      planProof: {
        workableDaysRemaining: 14,
        totalRequiredUnits: 3,
        requiredPacePerDay: 1,
        maxPerDay: 3,
        maxPerWeek: 10,
        slackUnits: 0,
        slackRatio: 0,
        intensityRatio: 1,
      },
      constraints: {
        timezone: 'UTC',
        weeklyWindows: {
          MON: [{ startHHMM: '09:00', endHHMM: '12:00' }],
          TUE: [{ startHHMM: '09:00', endHHMM: '12:00' }],
          WED: [{ startHHMM: '09:00', endHHMM: '12:00' }],
        },
        cycleStartDayKey: '2026-03-23',
        cycleEndDayKey: '2026-04-06',
      },
      actionSequence: [
        {
          id: 'gate',
          title: 'Resolve MOQ gate',
          estimateMin: 60,
          deliverableId: 'deliv-gate',
          deliverableTitle: 'Resolve MOQ gate',
          dependencies: [],
        },
        {
          id: 'mid',
          title: 'Configure commerce chunk',
          estimateMin: 60,
          deliverableId: 'deliv-mid',
          deliverableTitle: 'Configure commerce chunk',
          dependencies: ['gate'],
        },
        {
          id: 'leaf',
          title: 'Configure checkout fields',
          estimateMin: 60,
          deliverableId: 'deliv-leaf',
          deliverableTitle: 'Configure checkout fields',
          dependencies: ['mid'],
        },
      ],
    });

    const gateBlock = plan.horizonBlocks.find((block) => block.actionId === 'gate');
    const leafBlock = plan.horizonBlocks.find((block) => block.actionId === 'leaf');

    expect(gateBlock.directDependencyIds).toEqual([]);
    expect(gateBlock.directDependencyDetails).toEqual([]);
    expect(gateBlock.transitiveDependencyIds).toEqual([]);
    expect(gateBlock.transitiveDependencyDetails).toEqual([]);
    expect(gateBlock.endISO).toBeTruthy();
    expect(Date.parse(gateBlock.endISO)).toBeGreaterThan(Date.parse(gateBlock.startISO));
    expect(leafBlock.directDependencyIds).toEqual(['mid']);
    expect(leafBlock.directDependencyDetails).toEqual([{ actionId: 'mid', dependencyType: 'hard_gate' }]);
    expect(leafBlock.transitiveDependencyIds).toEqual(['mid', 'gate']);
    expect(leafBlock.transitiveDependencyDetails).toEqual([
      { actionId: 'mid', dependencyType: 'hard_gate' },
      { actionId: 'gate', dependencyType: 'hard_gate' },
    ]);
    expect(leafBlock.endISO).toBeTruthy();
    expect(Date.parse(leafBlock.endISO)).toBeGreaterThan(Date.parse(leafBlock.startISO));
  });

  it('enforces dependency completion before placing downstream explicit session blocks', () => {
    const plan = compileAutoAsanaPlan({
      goalId: 'goal-deps-2',
      cycleId: 'cycle-deps-2',
      nowISO: '2026-03-23T12:00:00.000Z',
      horizonDays: 7,
      planProof: {
        workableDaysRemaining: 7,
        totalRequiredUnits: 2,
        requiredPacePerDay: 1,
        maxPerDay: 4,
        maxPerWeek: 10,
        slackUnits: 0,
        slackRatio: 0,
        intensityRatio: 1,
      },
      constraints: {
        timezone: 'UTC',
        weeklyWindows: {
          MON: [{ startHHMM: '09:00', endHHMM: '17:00' }],
          TUE: [{ startHHMM: '09:00', endHHMM: '17:00' }],
        },
        cycleStartDayKey: '2026-03-23',
        cycleEndDayKey: '2026-03-24',
      },
      actionSequence: [
        {
          id: 'gate',
          title: 'Resolve MOQ gate',
          estimateMin: 60,
          deliverableId: 'deliv-gate',
          deliverableTitle: 'Resolve MOQ gate',
          dependencies: [],
        },
        {
          id: 'leaf',
          title: 'Configure checkout fields',
          estimateMin: 60,
          deliverableId: 'deliv-leaf',
          deliverableTitle: 'Configure checkout fields',
          dependencies: ['gate'],
        },
      ],
      sessionPlan: [
        {
          date: '2026-03-23',
          startTime: '09:00',
          durationMinutes: 60,
          deliverableId: 'deliv-leaf',
          actionId: 'leaf',
          title: 'Configure checkout fields',
        },
        {
          date: '2026-03-23',
          startTime: '09:00',
          durationMinutes: 60,
          deliverableId: 'deliv-gate',
          actionId: 'gate',
          title: 'Resolve MOQ gate',
        },
      ],
    });

    const gateBlock = plan.horizonBlocks.find((block) => block.actionId === 'gate');
    const leafBlock = plan.horizonBlocks.find((block) => block.actionId === 'leaf');

    expect(gateBlock).toBeTruthy();
    expect(leafBlock).toBeTruthy();
    expect(Date.parse(leafBlock.startISO)).toBeGreaterThanOrEqual(Date.parse(gateBlock.endISO));
    expect(plan.conflicts.some((conflict) => conflict.code === 'DEPENDENCY_ORDER_VIOLATED')).toBe(false);
  });

  it('places directional dependencies on assumption when the prerequisite is not yet scheduled', () => {
    const plan = compileAutoAsanaPlan({
      goalId: 'goal-deps-3',
      cycleId: 'cycle-deps-3',
      nowISO: '2026-03-23T12:00:00.000Z',
      horizonDays: 7,
      planProof: {
        workableDaysRemaining: 7,
        totalRequiredUnits: 1,
        requiredPacePerDay: 1,
        maxPerDay: 4,
        maxPerWeek: 10,
        slackUnits: 0,
        slackRatio: 0,
        intensityRatio: 1,
      },
      constraints: {
        timezone: 'UTC',
        weeklyWindows: {
          MON: [{ startHHMM: '09:00', endHHMM: '17:00' }],
        },
        cycleStartDayKey: '2026-03-23',
        cycleEndDayKey: '2026-03-23',
      },
      actionSequence: [
        {
          id: 'gate',
          title: 'Resolve MOQ gate',
          estimateMin: 60,
          deliverableId: 'deliv-gate',
          deliverableTitle: 'Resolve MOQ gate',
          dependencies: [],
        },
        {
          id: 'leaf',
          title: 'Draft commerce hypothesis',
          estimateMin: 60,
          deliverableId: 'deliv-leaf',
          deliverableTitle: 'Draft commerce hypothesis',
          dependencies: ['gate'],
          dependencyDetails: [{ actionId: 'gate', dependencyType: 'directional' }],
        },
      ],
      sessionPlan: [
        {
          date: '2026-03-23',
          startTime: '09:00',
          durationMinutes: 60,
          deliverableId: 'deliv-leaf',
          actionId: 'leaf',
          title: 'Draft commerce hypothesis',
        },
      ],
    });

    const leafBlock = plan.horizonBlocks.find((block) => block.actionId === 'leaf');

    expect(leafBlock).toBeTruthy();
    expect(leafBlock.directDependencyDetails).toEqual([{ actionId: 'gate', dependencyType: 'directional' }]);
    expect(leafBlock.transitiveDependencyDetails).toEqual([{ actionId: 'gate', dependencyType: 'directional' }]);
    expect(leafBlock.placementBasis).toBe('assumption');
    expect(leafBlock.assumedDependencies).toEqual(['gate']);
    expect(plan.conflicts.some((conflict) => conflict.code === 'MISSING_HARD_GATE_COMPLETION')).toBe(false);
    expect(plan.conflicts.some((conflict) => conflict.code === 'DEPENDENCY_ORDER_VIOLATED')).toBe(false);
  });

  it('prefers deliverable titles over generic session titles when placing explicit session plans', () => {
    const plan = compileAutoAsanaPlan({
      goalId: 'goal-10',
      cycleId: 'cycle-10',
      nowISO: '2026-03-23T12:00:00.000Z',
      horizonDays: 30,
      planProof: {
        workableDaysRemaining: 30,
        totalRequiredUnits: 1,
        requiredPacePerDay: 1,
        maxPerDay: 1,
        maxPerWeek: 7,
        slackUnits: 1,
        slackRatio: 0.5,
        intensityRatio: 0.5,
      },
      constraints: {
        timezone: 'America/Chicago',
        maxBlocksPerDay: 2,
        workingHoursWindows: [{ startMin: 9 * 60, endMin: 17 * 60 }],
      },
      actionSequence: [
        {
          id: 'act-episode-1',
          title: 'Record and edit episode set',
          deliverableId: 'deliv-episode-1',
          deliverableTitle: 'Film episode 1',
        },
      ],
      sessionPlan: [
        {
          date: '2026-03-23',
          startTime: '09:00',
          durationMinutes: 60,
          deliverableId: 'deliv-episode-1',
          actionId: 'act-episode-1',
          title: 'Execution session 1',
        },
      ],
    });

    expect(plan.horizonBlocks[0].title).toBe('Film episode 1');
  });

  it('prefers deliverable titles over generic action labels when expanding action sequences', () => {
    const plan = compileAutoAsanaPlan({
      goalId: 'goal-11',
      cycleId: 'cycle-11',
      nowISO: '2026-03-23T12:00:00.000Z',
      horizonDays: 30,
      planProof: {
        workableDaysRemaining: 30,
        totalRequiredUnits: 1,
        requiredPacePerDay: 1,
        maxPerDay: 1,
        maxPerWeek: 7,
        slackUnits: 1,
        slackRatio: 0.5,
        intensityRatio: 0.5,
      },
      constraints: {
        timezone: 'America/Chicago',
        maxBlocksPerDay: 2,
        workingHoursWindows: [{ startMin: 9 * 60, endMin: 17 * 60 }],
      },
      actionSequence: [
        {
          id: 'act-episode-2',
          title: 'Record and edit episode set',
          deliverableId: 'deliv-episode-2',
          deliverableTitle: 'Film episode 2',
        },
      ],
    });

    expect(plan.horizonBlocks[0].title).toBe('Film episode 2');
  });
});

function minutesFromISO(iso, timeZone) {
  const date = new Date(iso);
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(date);
  const map = {};
  parts.forEach((p) => {
    if (p.type !== 'literal') {
      map[p.type] = p.value;
    }
  });
  const hours = Number(map.hour || 0);
  const minutes = Number(map.minute || 0);
  return hours * 60 + minutes;
}
