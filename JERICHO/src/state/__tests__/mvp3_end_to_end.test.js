import { describe, it, expect } from 'vitest';
import { computeDerivedState } from '../identityCompute.js';
import { buildLocalStartISO } from '../time/time.ts';
import { buildExecutionEventFromBlock } from '../engine/todayAuthority.ts';

const FIXED_DAY = '2026-01-08';
const DEADLINE_DAY = '2026-02-04'; // 4 weeks

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

describe('MVP 3.0 End-to-End Smoke Test', () => {
  it('full cycle: onboarding → goal admission → plan generation → execution → convergence', () => {
    const base = buildBaseState();

    // Step 1: Onboarding (start active cycle with goal)
    const onboarded = computeDerivedState(base, {
      type: 'COMPLETE_ONBOARDING',
      onboarding: {
        direction: 'MVP3 Goal',
        goalText: 'Complete MVP 3.0 validation',
        horizon: '30d',
        narrative: 'Validate cold plan first + convergence + learning gate',
        focusAreas: ['Creation'],
        successDefinition: 'MVP3 delivered',
        minimumDaysPerWeek: 4
      }
    });

    expect(onboarded.activeCycleId).toBeTruthy();
    const cycleId = onboarded.activeCycleId;
    const cycle1 = onboarded.cyclesById[cycleId];

    expect(cycle1).toBeTruthy();
    expect(cycle1.status).toBe('active');
    expect(cycle1.goalExecutionContract || cycle1.goalContract).toBeTruthy();

    // Step 2: Create deliverables defining success
    const withDeliv1 = computeDerivedState(onboarded, {
      type: 'CREATE_DELIVERABLE',
      payload: {
        cycleId,
        title: 'Design Phase',
        requiredBlocks: 2
      }
    });

    const withDeliv2 = computeDerivedState(withDeliv1, {
      type: 'CREATE_DELIVERABLE',
      payload: {
        cycleId,
        title: 'Implementation',
        requiredBlocks: 3
      }
    });

    const deliverables = withDeliv2.deliverablesByCycleId?.[cycleId] || [];
    expect(deliverables.length).toBe(2);
    const delivId1 = deliverables[0].id;
    const delivId2 = deliverables[1].id;

    // Step 3: Execute linked work (5 blocks across deliverables)
    let state = withDeliv2;
    const blocks = [];

    for (let i = 0; i < 5; i++) {
      const hour = 9 + (i % 3); // Spread across morning
      const startISO = buildLocalStartISO(FIXED_DAY, `0${hour}:00`, 'UTC').startISO;
      const delivId = i < 2 ? delivId1 : delivId2; // First 2 for Design, last 3 for Impl

      state = computeDerivedState(state, {
        type: 'CREATE_BLOCK',
        payload: {
          start: startISO,
          durationMinutes: 30,
          domain: i % 2 === 0 ? 'FOCUS' : 'CREATION',
          title: `Block ${i + 1}`,
          timeZone: 'UTC',
          linkToGoal: true,
          deliverableId: delivId
        }
      });

      blocks.push(state.today.blocks[state.today.blocks.length - 1]);
    }

    // Step 4: Complete all blocks (mark as complete with linkage)
    const completedEvents = blocks.map((block, idx) => {
      const delivId = idx < 2 ? delivId1 : delivId2;
      return buildExecutionEventFromBlock(block, {
        completed: true,
        kind: 'complete',
        dateISO: FIXED_DAY,
        minutes: 30,
        deliverableId: delivId
      });
    });

    state = {
      ...state,
      executionEvents: [...(state.executionEvents || []), ...completedEvents],
      cyclesById: {
        ...state.cyclesById,
        [cycleId]: {
          ...state.cyclesById[cycleId],
          executionEvents: [...(state.executionEvents || []), ...completedEvents]
        }
      }
    };

    // Step 5: End cycle and verify convergence
    const ended = computeDerivedState(state, { type: 'END_CYCLE', cycleId });
    const endedCycle = ended.cyclesById[cycleId];

    // Verify convergence was computed
    expect(endedCycle.convergenceReport).toBeTruthy();
    expect(endedCycle.convergenceReport.verdict).toBe('CONVERGED');
    expect(endedCycle.convergenceReport.P_end.deliverables.length).toBe(2);
    expect(endedCycle.convergenceReport.E_end.completedUnits).toBe(5);
    expect(endedCycle.convergenceReport.reasons.length).toBe(0); // No deficits

    // Step 6: Verify learning only counts this cycle
    const learning = ended.profileLearning || {};
    expect(learning.cycleCount).toBe(1); // One CONVERGED cycle
    expect(learning.totalCompletionCount).toBeGreaterThan(0);

    // Step 7: Start new cycle and verify learning is isolated
    const newCycle = computeDerivedState(ended, {
      type: 'START_NEW_CYCLE',
      payload: {
        goalText: 'Next iteration',
        deadlineDayKey: '2026-03-08'
      }
    });

    const cycle2Id = newCycle.activeCycleId;
    expect(cycle2Id).not.toBe(cycleId);

    // End new cycle without completing any work
    const ended2 = computeDerivedState(newCycle, { type: 'END_CYCLE', cycleId: cycle2Id });
    const cycle2 = ended2.cyclesById[cycle2Id];

    // This cycle should be INCOMPLETE (no deliverables completed)
    expect(cycle2.convergenceReport.verdict).toBe('INCOMPLETE');

    // Learning should still only count cycle 1 (because cycle 2 is INCOMPLETE)
    const learning2 = ended2.profileLearning || {};
    expect(learning2.cycleCount).toBe(1); // Still just the CONVERGED one
  });
});
