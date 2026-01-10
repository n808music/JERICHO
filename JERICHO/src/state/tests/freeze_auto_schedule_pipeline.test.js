import { describe, it, expect } from 'vitest';
import { computeDerivedState } from '../identityCompute.js';
import { buildBlankState, localStartISOForHour } from './freeze_helpers.js';

describe('Freeze: Auto Scheduling Pipeline', () => {
  it('generate cold plan -> proposed blocks -> accept -> committed blocks appear', () => {
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

    // Generate cold plan (proposed suggestions)
    state = computeDerivedState(state, { type: 'GENERATE_COLD_PLAN' });

    const suggestions = state.suggestedBlocks || [];
    const proposed = suggestions.find((s) => s && s.status === 'suggested');
    expect(proposed).toBeTruthy();

    // Accept a suggested block
    state = computeDerivedState(state, { type: 'ACCEPT_SUGGESTED_BLOCK', proposalId: proposed.id });

    // Acceptance should create a create execution event referencing the suggestion
    const createdEvent = (state.executionEvents || []).find((e) => e.kind === 'create' && (e.suggestionId === proposed.id || e.blockId === `blk-${proposed.id}`));
    expect(createdEvent).toBeTruthy();

    // Idempotent accept: calling accept again should not create a duplicate
    const beforeCount = (state.executionEvents || []).filter((e) => e.kind === 'create' && e.suggestionId === proposed.id).length;
    state = computeDerivedState(state, { type: 'ACCEPT_SUGGESTED_BLOCK', proposalId: proposed.id });
    const afterCount = (state.executionEvents || []).filter((e) => e.kind === 'create' && e.suggestionId === proposed.id).length;
    expect(afterCount).toBe(beforeCount);
  });
});
