/**
 * autoCallingIntegration.test.js
 *
 * Verify auto-calling actually executes and populates Phase values in real state mutations
 * Evidence needed before Task 7:
 * 1. Phase values populated (not null) in state.matrix.initiativesById
 * 2. Initiative hierarchy gate actually ran and held
 * 3. lastPlanWarning is clean (no unexpected violations)
 */

import { describe, it, expect } from 'vitest';
import { identityReducer, buildBlankIdentityState } from '../../src/state/identityStore.js';

describe('Auto-Calling Integration: Real State Mutation Flow', () => {
  it('should populate Phase values via auto-calling during DECLARE_SPINE action', () => {
    // Start with blank state
    let state = buildBlankIdentityState({ nowISO: '2026-08-16T00:00:00Z' });

    // Step 1: Declare three Initiatives with Terminal Deadlines
    state = identityReducer(state, {
      type: 'DECLARE_INITIATIVE',
      payload: {
        id: 'state-of-control',
        name: 'State of Control',
        owningEntityId: null,
        purpose: 'test',
        classification: 'objective',
        doneWhen: 'test',
        terminalDeadline: '2028-02-17',
      },
    });

    state = identityReducer(state, {
      type: 'DECLARE_INITIATIVE',
      payload: {
        id: 'seeds-of-destruction',
        name: 'Seeds of Destruction',
        owningEntityId: null,
        purpose: 'test',
        classification: 'objective',
        doneWhen: 'test',
        terminalDeadline: '2029-08-17',
      },
    });

    state = identityReducer(state, {
      type: 'DECLARE_INITIATIVE',
      payload: {
        id: 'i-am-the-state',
        name: 'I Am The State',
        owningEntityId: null,
        purpose: 'test',
        classification: 'objective',
        doneWhen: 'test',
        terminalDeadline: '2031-12-31',
      },
    });

    // Before spine: Phases should still be null (no spine yet, so no windows)
    console.log('\n--- BEFORE SPINE DECLARATION ---');
    console.log(`State of Control phase: ${state.matrix.initiativesById['state-of-control']?.phase || 'null'}`);
    console.log(`Seeds phase: ${state.matrix.initiativesById['seeds-of-destruction']?.phase || 'null'}`);
    console.log(`I Am The State phase: ${state.matrix.initiativesById['i-am-the-state']?.phase || 'null'}`);
    console.log(`lastPlanWarning: ${state.lastPlanWarning ? JSON.stringify(state.lastPlanWarning.code) : 'clean'}`);

    expect(state.matrix.initiativesById['state-of-control']?.phase).toBeNull();

    // Step 2: Declare spine — this triggers auto-calling
    state = identityReducer(state, {
      type: 'DECLARE_SPINE',
      payload: {
        spineInitiativeIds: ['state-of-control', 'seeds-of-destruction', 'i-am-the-state'],
      },
    });

    // EVIDENCE 1: Verify Phase values are NOW POPULATED
    console.log('\n--- AFTER SPINE DECLARATION (AUTO-CALLING SHOULD HAVE RUN) ---');
    const stateOfControlPhase = state.matrix.initiativesById['state-of-control']?.phase;
    const seedsPhase = state.matrix.initiativesById['seeds-of-destruction']?.phase;
    const iAmStatePhase = state.matrix.initiativesById['i-am-the-state']?.phase;

    console.log(`State of Control phase: ${stateOfControlPhase || 'null'} (expected: 1)`);
    console.log(`Seeds phase: ${seedsPhase || 'null'} (expected: 2)`);
    console.log(`I Am The State phase: ${iAmStatePhase || 'null'} (expected: 3)`);

    // EVIDENCE 2: Verify hierarchy gate ran (if it did, check for any warnings)
    console.log(`\nlastPlanWarning: ${state.lastPlanWarning ? JSON.stringify(state.lastPlanWarning.code) : 'clean'}`);
    console.log(`lastPlanError: ${state.lastPlanError ? JSON.stringify(state.lastPlanError.code) : 'clean'}`);

    // The actual assertions
    expect(stateOfControlPhase).toBe('1');
    expect(seedsPhase).toBe('2');
    expect(iAmStatePhase).toBe('3');

    // EVIDENCE 3: No unexpected warnings/errors
    expect(state.lastPlanWarning).toBeUndefined();
    expect(state.lastPlanError).toBeUndefined();
  });

  it('should detect hierarchy violations when child Phase < parent Phase', () => {
    let state = buildBlankIdentityState({ nowISO: '2026-08-16T00:00:00Z' });

    // Declare parent Initiative (will be P2)
    state = identityReducer(state, {
      type: 'DECLARE_INITIATIVE',
      payload: {
        id: 'parent-init',
        name: 'Parent Initiative',
        owningEntityId: null,
        purpose: 'test',
        classification: 'objective',
        doneWhen: 'test',
        terminalDeadline: '2029-08-17', // P2 terminal
      },
    });

    // Declare child Initiative (will be P1, violating child >= parent)
    state = identityReducer(state, {
      type: 'DECLARE_INITIATIVE',
      payload: {
        id: 'child-init',
        name: 'Child Initiative',
        parentInitiativeId: 'parent-init',
        owningEntityId: null,
        purpose: 'test',
        classification: 'objective',
        doneWhen: 'test',
        terminalDeadline: '2028-01-01', // P1 terminal (earlier than parent)
      },
    });

    // Declare spine to enable Phase computation
    state = identityReducer(state, {
      type: 'DECLARE_SPINE',
      payload: {
        spineInitiativeIds: ['parent-init', 'child-init'],
      },
    });

    console.log('\n--- HIERARCHY VIOLATION TEST ---');
    const parentPhase = state.matrix.initiativesById['parent-init']?.phase;
    const childPhase = state.matrix.initiativesById['child-init']?.phase;

    console.log(`Parent phase: ${parentPhase} (expected: 1 because it's the first spine member)`);
    console.log(`Child phase: ${childPhase} (expected: 1 because it's before parent's deadline)`);
    console.log(`Hierarchy violation warning: ${state.lastPlanWarning ? 'YES - ' + state.lastPlanWarning.code : 'NO'}`);

    // With corrected spine window logic (3 spines → 3 windows, last unbounded):
    // - parent-init at 2029-08-17: This is the second spine member's terminal, so it's boundary for P1→P2
    // - child-init at 2028-01-01: Falls in P1 window (before 2029-08-17)
    // So child phase (1) < parent phase (2) = VIOLATION

    if (state.lastPlanWarning?.code === 'INITIATIVE_PHASE_HIERARCHY_VIOLATION') {
      console.log(`✅ Hierarchy gate DETECTED violation: ${state.lastPlanWarning.reason}`);
      expect(state.lastPlanWarning.code).toBe('INITIATIVE_PHASE_HIERARCHY_VIOLATION');
    } else {
      console.log(`❌ Hierarchy gate did NOT detect violation`);
      expect(state.lastPlanWarning?.code).toBe('INITIATIVE_PHASE_HIERARCHY_VIOLATION');
    }
  });
});
