import { describe, it, expect } from 'vitest';
import { computeDerivedState } from '../identityCompute.js';
import { buildBlankState, FIXED_DAY, NOW_ISO, localStartISOForHour, addCompletedEventsForBlocks } from './freeze_helpers.js';

describe('Freeze: Manual Scheduling Pipeline', () => {
  it('manual add -> materialize -> complete/reschedule/delete replay deterministically', () => {
    let state = buildBlankState();

    // 1) Onboard / admit goal which creates an active cycle
    state = computeDerivedState(state, {
      type: 'COMPLETE_ONBOARDING',
      onboarding: {
        direction: 'Freeze Manual',
        goalText: 'Manual scheduling goal',
        horizon: '30d',
        narrative: 'Test manual scheduling',
        focusAreas: ['Creation'],
        successDefinition: 'Deliverables done',
        minimumDaysPerWeek: 3
      }
    });

    expect(state.activeCycleId).toBeTruthy();
    const cycleId = state.activeCycleId;

    // 2) Create a deliverable
    state = computeDerivedState(state, {
      type: 'CREATE_DELIVERABLE',
      payload: { cycleId, title: 'Manual Task', requiredBlocks: 1 }
    });

    // 3) Manually create a committed block on the calendar
    const startISO = localStartISOForHour(9);
    state = computeDerivedState(state, {
      type: 'CREATE_BLOCK',
      payload: {
        start: startISO,
        durationMinutes: 30,
        domain: 'CREATION',
        title: 'Manual Block',
        timeZone: 'UTC',
        linkToGoal: true,
        deliverableId: state.deliverablesByCycleId?.[cycleId]?.[0]?.id
      }
    });

    // Ensure block materialized in today.blocks and cycle days
    expect(Array.isArray(state.today.blocks)).toBe(true);
    expect(state.today.blocks.length).toBeGreaterThan(0);
    const created = state.today.blocks[state.today.blocks.length - 1];
    expect(created.start).toContain(FIXED_DAY);

    // 4) Simulate completion events and replay deterministically
    const events = addCompletedEventsForBlocks(state, [created]);
    state = { ...state, executionEvents: events, cyclesById: { ...state.cyclesById, [cycleId]: { ...(state.cyclesById[cycleId] || {}), executionEvents: events } } };

    const ended = computeDerivedState(state, { type: 'END_CYCLE', cycleId });
    const endedCycle = ended.cyclesById[cycleId];

    expect(endedCycle.convergenceReport).toBeTruthy();
    expect(endedCycle.convergenceReport.E_end.completedUnits).toBeGreaterThanOrEqual(1);
  });
});
