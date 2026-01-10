import { describe, it, expect } from 'vitest';
import { computeDerivedState } from '../identityCompute.js';
import { buildBlankState, addCompletedEventsForBlocks, localStartISOForHour } from './freeze_helpers.js';

describe('Freeze: Cycle Isolation', () => {
  it('cycle A -> end/archive -> start cycle B isolates evidence and projections', () => {
    let state = buildBlankState();

    // Start cycle A via onboarding
    state = computeDerivedState(state, {
      type: 'COMPLETE_ONBOARDING',
      onboarding: {
        direction: 'Isolation',
        goalText: 'Cycle A goal',
        horizon: '30d',
        narrative: 'Test isolation',
        focusAreas: ['Creation'],
        successDefinition: 'Done',
        minimumDaysPerWeek: 2
      }
    });
    const cycleA = state.activeCycleId;
    expect(cycleA).toBeTruthy();

    // Create a deliverable and a block, accept materialization
    state = computeDerivedState(state, { type: 'CREATE_DELIVERABLE', payload: { cycleId: cycleA, title: 'A Task', requiredBlocks: 1 } });
    state = computeDerivedState(state, { type: 'CREATE_BLOCK', payload: { start: localStartISOForHour(10), durationMinutes: 30, domain: 'CREATION', title: 'A Block', timeZone: 'UTC', linkToGoal: true, deliverableId: state.deliverablesByCycleId?.[cycleA]?.[0]?.id } });

    // Add completion event and end cycle A (archive)
    const created = state.today.blocks[state.today.blocks.length - 1];
    const events = addCompletedEventsForBlocks(state, [created]);
    state = { ...state, executionEvents: events, cyclesById: { ...state.cyclesById, [cycleA]: { ...(state.cyclesById[cycleA] || {}), executionEvents: events } } };
    const ended = computeDerivedState(state, { type: 'END_CYCLE', cycleId: cycleA });

    // Active projections should be cleared after ending the cycle
    expect(ended.activeCycleId).toBeFalsy();
    expect((ended.today.blocks || []).length).toBe(0);

    // Start cycle B
    const started = computeDerivedState(ended, { type: 'START_NEW_CYCLE', payload: { goalText: 'Cycle B goal', deadlineDayKey: '2026-03-08' } });
    const cycleB = started.activeCycleId;
    expect(cycleB).toBeTruthy();
    expect(cycleB).not.toBe(cycleA);

    // Ensure no cross-cycle contamination: cycle B's calendar empty, cycle A still preserved in cyclesById
    expect((started.today.blocks || []).length).toBe(0);
    expect(started.cyclesById[cycleA]).toBeTruthy();
    expect(started.cyclesById[cycleA].executionEvents && started.cyclesById[cycleA].executionEvents.length).toBeGreaterThan(0);
  });
});
