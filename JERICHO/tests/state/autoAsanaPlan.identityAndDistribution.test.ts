import { describe, expect, it } from 'vitest';
import { compileAutoAsanaPlan } from '../../src/state/engine/autoAsanaPlan.ts';

describe('autoAsanaPlan canonical identity and session-first distribution', () => {
  it('uses canonical identity key so similar titles do not collide', () => {
    const plan = compileAutoAsanaPlan({
      goalId: 'goal-ident-1',
      cycleId: 'cycle-ident-1',
      planProof: {
        workableDaysRemaining: 10,
        totalRequiredUnits: 2,
        requiredPacePerDay: 1,
        maxPerDay: 2,
        maxPerWeek: 14,
        slackUnits: 0,
        slackRatio: 0,
        intensityRatio: 0.2,
      },
      constraints: {
        timezone: 'UTC',
        weeklyWindows: {
          MON: [{ startHHMM: '09:00', endHHMM: '11:00' }],
          TUE: [{ startHHMM: '09:00', endHHMM: '11:00' }],
        },
        cycleStartDayKey: '2026-03-09',
        cycleEndDayKey: '2026-03-31',
      },
      nowISO: '2026-03-09T12:00:00.000Z',
      horizonDays: 7,
      sessionPlan: [
        {
          date: '2026-03-09',
          startTime: '09:00',
          durationMinutes: 60,
          actionSteps: ['Create diligence checklist', 'Verify checklist', 'Save checklist'],
          completionCondition: 'Checklist complete',
          deliverableId: 'deliv-a',
          actionId: 'act-a',
        },
        {
          date: '2026-03-10',
          startTime: '09:00',
          durationMinutes: 60,
          actionSteps: ['Create diligence checklist', 'Review checklist', 'Publish checklist'],
          completionCondition: 'Checklist reviewed',
          deliverableId: 'deliv-b',
          actionId: 'act-b',
        },
      ],
    });

    expect(plan.horizonBlocks).toHaveLength(2);
    const identityKeys = plan.horizonBlocks.map((block) => block.identityKey);
    expect(new Set(identityKeys).size).toBe(2);
    expect(identityKeys[0]).toContain('cycle-ident-1::deliv-a::act-a::0');
    expect(identityKeys[1]).toContain('cycle-ident-1::deliv-b::act-b::0');
  });

  it('attempts every required session and emits unschedulable conflicts for overflow', () => {
    const plan = compileAutoAsanaPlan({
      goalId: 'goal-dist-1',
      cycleId: 'cycle-dist-1',
      planProof: {
        workableDaysRemaining: 2,
        totalRequiredUnits: 6,
        requiredPacePerDay: 3,
        maxPerDay: 1,
        maxPerWeek: 2,
        slackUnits: 0,
        slackRatio: 0,
        intensityRatio: 1,
      },
      constraints: {
        timezone: 'UTC',
        maxBlocksPerDay: 1,
        maxBlocksPerWeek: 2,
        weeklyWindows: {
          MON: [{ startHHMM: '09:00', endHHMM: '10:00' }],
          TUE: [{ startHHMM: '09:00', endHHMM: '10:00' }],
        },
        cycleStartDayKey: '2026-03-09',
        cycleEndDayKey: '2026-03-10',
      },
      nowISO: '2026-03-09T12:00:00.000Z',
      horizonDays: 2,
      sessionPlan: Array.from({ length: 6 }, (_, index) => ({
        date: index % 2 === 0 ? '2026-03-09' : '2026-03-10',
        startTime: '09:00',
        durationMinutes: 60,
        actionSteps: ['Step 1', 'Step 2', 'Step 3'],
        completionCondition: `Session ${index + 1} complete`,
        deliverableId: `deliv-${index + 1}`,
        actionId: `act-${index + 1}`,
      })),
    });

    expect(plan.horizonBlocks).toHaveLength(2);
    expect(plan.conflicts.length).toBeGreaterThanOrEqual(4);
    const unschedulableConflictCount = plan.conflicts.filter((conflict) => conflict.kind === 'UNSCHEDULABLE').length;
    expect(unschedulableConflictCount).toBeGreaterThanOrEqual(4);
  });

  it('uses canonical action titles when session entries are missing actionId', () => {
    const plan = compileAutoAsanaPlan({
      goalId: 'goal-title-1',
      cycleId: 'cycle-title-1',
      planProof: {
        workableDaysRemaining: 30,
        totalRequiredUnits: 2,
        requiredPacePerDay: 1,
        maxPerDay: 2,
        maxPerWeek: 14,
        slackUnits: 0,
        slackRatio: 0,
        intensityRatio: 0.1,
      },
      constraints: {
        timezone: 'UTC',
        weeklyWindows: {
          MON: [{ startHHMM: '09:00', endHHMM: '11:00' }],
          TUE: [{ startHHMM: '09:00', endHHMM: '11:00' }],
          WED: [{ startHHMM: '09:00', endHHMM: '11:00' }],
        },
        cycleStartDayKey: '2026-03-09',
        cycleEndDayKey: '2026-04-09',
      },
      nowISO: '2026-03-09T12:00:00.000Z',
      horizonDays: 30,
      actionSequence: [
        { id: 'act-1', deliverableId: 'deliv-1', title: 'Draft creative brief and narrative intent', estimateMin: 60 },
        {
          id: 'act-2',
          deliverableId: 'deliv-2',
          title: 'Build fundraising narrative and deck storyline',
          estimateMin: 60,
        },
      ],
      sessionPlan: [
        {
          date: '2026-03-09',
          startTime: '09:00',
          durationMinutes: 60,
          actionSteps: ['Review objective for Draft creative brief', 'Step 2', 'Step 3'],
          completionCondition: 'Review objective complete',
          deliverableId: 'deliv-1',
        },
        {
          date: '2026-03-10',
          startTime: '09:00',
          durationMinutes: 60,
          actionSteps: ['Review objective for Build fundraising narrative', 'Step 2', 'Step 3'],
          completionCondition: 'Review objective complete',
          deliverableId: 'deliv-2',
        },
      ],
    });

    expect(plan.horizonBlocks).toHaveLength(2);
    expect(plan.horizonBlocks[0]?.title).toBe('Draft creative brief and narrative intent');
    expect(plan.horizonBlocks[1]?.title).toBe('Build fundraising narrative and deck storyline');
  });
});
