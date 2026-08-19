/**
 * debugAutoCallingFlow.test.js
 *
 * Debug the auto-calling flow with detailed logging
 */

import { describe, it, expect } from 'vitest';
import { identityReducer, buildBlankIdentityState } from '../../src/state/identityStore.js';

describe('Debug Auto-Calling Flow', () => {
  it('should show what happens to state at each step', () => {
    let state = buildBlankIdentityState({ nowISO: '2026-08-16T00:00:00Z' });

    console.log('\n=== STEP 1: Create blank state ===');
    console.log(`state.matrix.spineInitiativeIds:`, state.matrix?.spineInitiativeIds);
    console.log(`state.matrix.initiativesById keys:`, Object.keys(state.matrix?.initiativesById || {}));

    // Create Initiative 1
    console.log('\n=== STEP 2: Declare first Initiative ===');
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

    const init1 = state.matrix.initiativesById['state-of-control'];
    console.log(`Initiative created:`, { id: init1?.id, name: init1?.name, terminalDeadline: init1?.terminalDeadline, phase: init1?.phase });

    // Create Initiative 2
    console.log('\n=== STEP 3: Declare second Initiative ===');
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

    const init2 = state.matrix.initiativesById['seeds-of-destruction'];
    console.log(`Initiative created:`, { id: init2?.id, name: init2?.name, terminalDeadline: init2?.terminalDeadline, phase: init2?.phase });

    // Create Initiative 3
    console.log('\n=== STEP 4: Declare third Initiative ===');
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

    const init3 = state.matrix.initiativesById['i-am-the-state'];
    console.log(`Initiative created:`, { id: init3?.id, name: init3?.name, terminalDeadline: init3?.terminalDeadline, phase: init3?.phase });

    // Declare spine
    console.log('\n=== STEP 5: Declare spine (should trigger auto-calling) ===');
    console.log(`Before DECLARE_SPINE: state.matrix.spineInitiativeIds =`, state.matrix?.spineInitiativeIds);

    state = identityReducer(state, {
      type: 'DECLARE_SPINE',
      payload: {
        spineInitiativeIds: ['state-of-control', 'seeds-of-destruction', 'i-am-the-state'],
      },
    });

    console.log(`After DECLARE_SPINE: state.matrix.spineInitiativeIds =`, state.matrix?.spineInitiativeIds);

    // Check phases after spine declaration
    console.log('\n=== STEP 6: Check phases after auto-calling ===');
    const phase1 = state.matrix.initiativesById['state-of-control']?.phase;
    const phase2 = state.matrix.initiativesById['seeds-of-destruction']?.phase;
    const phase3 = state.matrix.initiativesById['i-am-the-state']?.phase;

    console.log(`State of Control phase: ${phase1} (expected: 1)`);
    console.log(`Seeds phase: ${phase2} (expected: 2)`);
    console.log(`I Am The State phase: ${phase3} (expected: 3)`);
    console.log(`lastPlanError: ${state.lastPlanError ? JSON.stringify(state.lastPlanError.code) : 'none'}`);
    console.log(`lastPlanWarning: ${state.lastPlanWarning ? JSON.stringify(state.lastPlanWarning.code) : 'none'}`);

    // Just log for inspection
    expect(true).toBe(true);
  });
});
