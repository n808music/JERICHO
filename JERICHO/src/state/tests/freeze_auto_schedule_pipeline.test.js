import { describe, it, expect } from 'vitest';
import { computeDerivedState } from '../identityCompute.js';
import { buildBlankState } from './freeze_helpers.js';

describe('Freeze: Auto Scheduling Pipeline', () => {
  it('generate cold plan produces metadata and daily projection', () => {
    let state = buildBlankState();

    // Onboard & create active cycle
    state = computeDerivedState(state, {
      type: 'COMPLETE_ONBOARDING',
      onboarding: {
        direction: 'Freeze Auto',
        goalText: 'Auto scheduling goal',
        horizon: '30d',
        narrative: 'Test auto scheduling',
        focusAreas: ['Creation'],
        successDefinition: 'Deliverables done',
        minimumDaysPerWeek: 3
      }
    });

    const cycleId = state.activeCycleId;
    expect(cycleId).toBeTruthy();

    // Create a deliverable to link suggestions
    state = computeDerivedState(state, { type: 'CREATE_DELIVERABLE', payload: { cycleId, title: 'Auto Task', requiredBlocks: 2 } });

    // Generate cold plan metadata and projection
    state = computeDerivedState(state, { type: 'GENERATE_COLD_PLAN' });

    const cycle = state.cyclesById?.[cycleId];
    expect(state.lastPlanError).toBeNull();
    expect(cycle?.coldPlan).toBeTruthy();
    expect(cycle?.coldPlan?.dailyProjection).toBeTruthy();
    expect(cycle?.coldPlan?.dailyProjection?.forecastByDayKey).toBeTruthy();
  });
});
