import { describe, it, expect } from 'vitest';
import { computeDerivedState } from '../identityCompute.js';
import { buildLocalStartISO } from '../time/time.ts';
import { buildExecutionEventFromBlock } from '../engine/todayAuthority.ts';

const FIXED_DAY = '2026-01-08';

function buildBaseState() {
  return {
    vector: { day: 1, direction: '', stability: 'steady', drift: 'contained', momentum: 'active' },
    lenses: {
      aim: { description: '', horizon: '90d', narrative: '' },
      pattern: { routines: { Body: [], Resources: [], Creation: [], Focus: [] }, dailyTargets: [], defaultMinutes: 30 },
      flow: { streams: [] }
    },
    today: { date: FIXED_DAY, blocks: [], completionRate: 0, driftSignal: 'contained', loadByPractice: {}, practices: [] },
    currentWeek: { weekStart: FIXED_DAY, days: [], metrics: {} },
    cycle: [],
    viewDate: FIXED_DAY,
    templates: { objectives: {} },
    lastAdaptedDate: null,
    stability: { headline: '', actionLine: '' },
    meta: {
      version: '1.0.0',
      onboardingComplete: false,
      lastActiveDate: FIXED_DAY,
      scenarioLabel: '',
      demoScenarioEnabled: false,
      showHints: false
    },
    recurringPatterns: [],
    lastSessionChange: null,
    nextSuggestion: null,
    executionEvents: [],
    ledger: [],
    appTime: {
      timeZone: 'UTC',
      nowISO: `${FIXED_DAY}T12:00:00.000Z`,
      activeDayKey: FIXED_DAY,
      isFollowingNow: true
    }
  };
}

describe('MVP 3.0 Invariants', () => {
  describe('terminal_convergence_converged_when_all_requirements_met_by_deadline', () => {
    it('returns CONVERGED verdict when deliverables met by deadline', () => {
      const base = buildBaseState();
      const onboarded = computeDerivedState(base, {
        type: 'COMPLETE_ONBOARDING',
        onboarding: {
          direction: 'Goal A',
          goalText: 'Goal A',
          horizon: '30d',
          narrative: '',
          focusAreas: ['Creation'],
          successDefinition: 'Ship A',
          minimumDaysPerWeek: 4
        }
      });

      const cycleId = onboarded.activeCycleId;
      const cycle = onboarded.cyclesById[cycleId];

      // Create a deliverable with 1 required block
      const withDeliverable = computeDerivedState(onboarded, {
        type: 'CREATE_DELIVERABLE',
        payload: {
          cycleId,
          title: 'Primary Deliverable',
          requiredBlocks: 1
        }
      });

      // Complete a linked block (before deadline)
      const startISO = buildLocalStartISO(FIXED_DAY, '09:00', 'UTC').startISO;
      const withBlock = computeDerivedState(withDeliverable, {
        type: 'CREATE_BLOCK',
        payload: {
          start: startISO,
          durationMinutes: 30,
          domain: 'FOCUS',
          title: 'Deliver A',
          timeZone: 'UTC',
          linkToGoal: true
        }
      });

      const block = withBlock.today.blocks[0];
      const completeEvent = buildExecutionEventFromBlock(block, {
        completed: true,
        kind: 'complete',
        dateISO: FIXED_DAY,
        minutes: 30,
        deliverableId: (withBlock.deliverablesByCycleId?.[cycleId] || [])[0]?.id || null
      });

      const withCompletion = {
        ...withBlock,
        executionEvents: [...(withBlock.executionEvents || []), completeEvent],
        cyclesById: {
          ...withBlock.cyclesById,
          [cycleId]: {
            ...withBlock.cyclesById[cycleId],
            executionEvents: [...(withBlock.executionEvents || []), completeEvent]
          }
        }
      };

      // End cycle
      const ended = computeDerivedState(withCompletion, { type: 'END_CYCLE', cycleId });
      const endedCycle = ended.cyclesById[cycleId];

      expect(endedCycle?.convergenceReport).toBeTruthy();
      expect(endedCycle.convergenceReport.verdict).toBe('CONVERGED');
      expect(endedCycle.convergenceReport.reasons.length).toBe(0);
    });
  });

  describe('terminal_convergence_incomplete_when_requirements_not_met', () => {
    it('returns INCOMPLETE verdict when deliverables not met', () => {
      const base = buildBaseState();
      const onboarded = computeDerivedState(base, {
        type: 'COMPLETE_ONBOARDING',
        onboarding: {
          direction: 'Goal B',
          goalText: 'Goal B',
          horizon: '30d',
          narrative: '',
          focusAreas: ['Creation'],
          successDefinition: 'Ship B',
          minimumDaysPerWeek: 4
        }
      });

      const cycleId = onboarded.activeCycleId;

      // Create a deliverable with 2 required blocks
      const withDeliverable = computeDerivedState(onboarded, {
        type: 'CREATE_DELIVERABLE',
        payload: {
          cycleId,
          title: 'Primary Deliverable',
          requiredBlocks: 2
        }
      });

      // Complete only 1 block
      const startISO = buildLocalStartISO(FIXED_DAY, '09:00', 'UTC').startISO;
      const withBlock = computeDerivedState(withDeliverable, {
        type: 'CREATE_BLOCK',
        payload: {
          start: startISO,
          durationMinutes: 30,
          domain: 'FOCUS',
          title: 'Deliver B',
          timeZone: 'UTC',
          linkToGoal: true
        }
      });

      const block = withBlock.today.blocks[0];
      const deliverableId = (withBlock.deliverablesByCycleId?.[cycleId] || [])[0]?.id || null;
      const completeEvent = buildExecutionEventFromBlock(block, {
        completed: true,
        kind: 'complete',
        dateISO: FIXED_DAY,
        minutes: 30,
        deliverableId
      });

      const withCompletion = {
        ...withBlock,
        executionEvents: [...(withBlock.executionEvents || []), completeEvent],
        cyclesById: {
          ...withBlock.cyclesById,
          [cycleId]: {
            ...withBlock.cyclesById[cycleId],
            executionEvents: [...(withBlock.executionEvents || []), completeEvent]
          }
        }
      };

      // End cycle
      const ended = computeDerivedState(withCompletion, { type: 'END_CYCLE', cycleId });
      const endedCycle = ended.cyclesById[cycleId];

      expect(endedCycle?.convergenceReport).toBeTruthy();
      expect(endedCycle.convergenceReport.verdict).toBe('INCOMPLETE');
      expect(endedCycle.convergenceReport.reasons.length).toBeGreaterThan(0);
      expect(endedCycle.convergenceReport.reasons[0]).toMatch(/deficit/i);
    });
  });

  describe('terminal_convergence_ignores_unlinked_activity', () => {
    it('unlinked activity blocks do not count toward deliverable requirements', () => {
      const base = buildBaseState();
      const onboarded = computeDerivedState(base, {
        type: 'COMPLETE_ONBOARDING',
        onboarding: {
          direction: 'Goal C',
          goalText: 'Goal C',
          horizon: '30d',
          narrative: '',
          focusAreas: ['Creation'],
          successDefinition: 'Ship C',
          minimumDaysPerWeek: 4
        }
      });

      const cycleId = onboarded.activeCycleId;

      // Create a deliverable with 1 required block
      const withDeliverable = computeDerivedState(onboarded, {
        type: 'CREATE_DELIVERABLE',
        payload: {
          cycleId,
          title: 'Primary Deliverable',
          requiredBlocks: 1
        }
      });

      // Create and complete an UNLINKED block (linkToGoal: false)
      const startISO = buildLocalStartISO(FIXED_DAY, '09:00', 'UTC').startISO;
      const withUnlinked = computeDerivedState(withDeliverable, {
        type: 'CREATE_BLOCK',
        payload: {
          start: startISO,
          durationMinutes: 30,
          domain: 'FOCUS',
          title: 'Unlinked activity',
          timeZone: 'UTC',
          linkToGoal: false
        }
      });

      const block = withUnlinked.today.blocks[0];
      const completeEvent = buildExecutionEventFromBlock(block, {
        completed: true,
        kind: 'complete',
        dateISO: FIXED_DAY,
        minutes: 30
        // NO deliverableId or criterionId
      });

      const withCompletion = {
        ...withUnlinked,
        executionEvents: [...(withUnlinked.executionEvents || []), completeEvent],
        cyclesById: {
          ...withUnlinked.cyclesById,
          [cycleId]: {
            ...withUnlinked.cyclesById[cycleId],
            executionEvents: [...(withUnlinked.executionEvents || []), completeEvent]
          }
        }
      };

      // End cycle
      const ended = computeDerivedState(withCompletion, { type: 'END_CYCLE', cycleId });
      const endedCycle = ended.cyclesById[cycleId];

      // Should report INCOMPLETE because unlinked activity doesn't count
      expect(endedCycle?.convergenceReport).toBeTruthy();
      expect(endedCycle.convergenceReport.verdict).toBe('INCOMPLETE');
      expect(endedCycle.convergenceReport.E_end.completedUnits).toBe(0);
      expect(endedCycle.convergenceReport.E_end.unlinkedActivityBlocks).toBe(1);
    });
  });

  describe('learning_requires_ended_cycle_with_convergence_verdict', () => {
    it('only CONVERGED cycles contribute to profile learning', () => {
      const base = buildBaseState();

      // Cycle 1: converged
      const converged = computeDerivedState(base, {
        type: 'COMPLETE_ONBOARDING',
        onboarding: {
          direction: 'Goal D',
          goalText: 'Goal D',
          horizon: '30d',
          narrative: '',
          focusAreas: ['Creation'],
          successDefinition: 'Ship D',
          minimumDaysPerWeek: 4
        }
      });

      const cycle1Id = converged.activeCycleId;
      const withDeliv1 = computeDerivedState(converged, {
        type: 'CREATE_DELIVERABLE',
        payload: { cycleId: cycle1Id, title: 'D Deliverable', requiredBlocks: 1 }
      });

      const startISO = buildLocalStartISO(FIXED_DAY, '09:00', 'UTC').startISO;
      const withBlock1 = computeDerivedState(withDeliv1, {
        type: 'CREATE_BLOCK',
        payload: {
          start: startISO,
          durationMinutes: 30,
          domain: 'FOCUS',
          title: 'Deliver D',
          timeZone: 'UTC',
          linkToGoal: true
        }
      });

      const block1 = withBlock1.today.blocks[0];
      const deliv1Id = (withBlock1.deliverablesByCycleId?.[cycle1Id] || [])[0]?.id || null;
      const event1 = buildExecutionEventFromBlock(block1, {
        completed: true,
        kind: 'complete',
        dateISO: FIXED_DAY,
        minutes: 30,
        deliverableId: deliv1Id
      });

      const convergedComplete = {
        ...withBlock1,
        executionEvents: [...(withBlock1.executionEvents || []), event1],
        cyclesById: {
          ...withBlock1.cyclesById,
          [cycle1Id]: {
            ...withBlock1.cyclesById[cycle1Id],
            executionEvents: [...(withBlock1.executionEvents || []), event1]
          }
        }
      };

      const ended1 = computeDerivedState(convergedComplete, { type: 'END_CYCLE', cycleId: cycle1Id });

      // Cycle 2: incomplete (for contrast)
      const newCycle2 = computeDerivedState(ended1, {
        type: 'START_NEW_CYCLE',
        payload: {
          goalText: 'Goal E',
          deadlineDayKey: '2026-02-07'
        }
      });

      const cycle2Id = newCycle2.activeCycleId;
      const withDeliv2 = computeDerivedState(newCycle2, {
        type: 'CREATE_DELIVERABLE',
        payload: { cycleId: cycle2Id, title: 'E Deliverable', requiredBlocks: 2 }
      });

      // Complete only 1 of 2 required
      const withBlock2 = computeDerivedState(withDeliv2, {
        type: 'CREATE_BLOCK',
        payload: {
          start: startISO,
          durationMinutes: 30,
          domain: 'FOCUS',
          title: 'Partial E',
          timeZone: 'UTC',
          linkToGoal: true
        }
      });

      const block2 = withBlock2.today.blocks[0];
      const deliv2Id = (withBlock2.deliverablesByCycleId?.[cycle2Id] || [])[0]?.id || null;
      const event2 = buildExecutionEventFromBlock(block2, {
        completed: true,
        kind: 'complete',
        dateISO: FIXED_DAY,
        minutes: 30,
        deliverableId: deliv2Id
      });

      const incomplete = {
        ...withBlock2,
        executionEvents: [...(withBlock2.executionEvents || []), event2],
        cyclesById: {
          ...withBlock2.cyclesById,
          [cycle2Id]: {
            ...withBlock2.cyclesById[cycle2Id],
            executionEvents: [...(withBlock2.executionEvents || []), event2]
          }
        }
      };

      const ended2 = computeDerivedState(incomplete, { type: 'END_CYCLE', cycleId: cycle2Id });

      // Check learning: should only count cycle 1 (CONVERGED)
      const learning = ended2.profileLearning || {};
      expect(learning.cycleCount).toBe(1); // Only the CONVERGED cycle
      expect(learning.totalCompletionCount).toBeGreaterThan(0);
    });
  });

  describe('convergence_report_stored_in_cycle_summary', () => {
    it('cycle summary includes convergence report after endCycle', () => {
      const base = buildBaseState();
      const onboarded = computeDerivedState(base, {
        type: 'COMPLETE_ONBOARDING',
        onboarding: {
          direction: 'Goal F',
          goalText: 'Goal F',
          horizon: '30d',
          narrative: '',
          focusAreas: ['Creation'],
          successDefinition: 'Ship F',
          minimumDaysPerWeek: 4
        }
      });

      const cycleId = onboarded.activeCycleId;
      const ended = computeDerivedState(onboarded, { type: 'END_CYCLE', cycleId });
      const cycle = ended.cyclesById[cycleId];

      expect(cycle.convergenceReport).toBeTruthy();
      expect(cycle.convergenceReport.verdict).toBeDefined();
      expect(['CONVERGED', 'INCOMPLETE', 'FAILED']).toContain(cycle.convergenceReport.verdict);
      expect(cycle.convergenceReport.P_end).toBeTruthy();
      expect(cycle.convergenceReport.E_end).toBeTruthy();
    });
  });
});
