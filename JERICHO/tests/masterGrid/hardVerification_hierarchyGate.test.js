/**
 * hardVerification_hierarchyGate.test.js
 *
 * HARD VERIFICATION 2: Deliberate hierarchy violation detection
 * Create parent with P2 deadline, child with P1 deadline, verify lastPlanWarning fires
 */

import { describe, it, expect } from 'vitest';
import { identityReducer, buildBlankIdentityState } from '../../src/state/identityStore.js';

describe('Hard Verification: Hierarchy Gate Detection', () => {
  it('should detect and warn when child Phase < parent Phase', () => {
    let state = buildBlankIdentityState({ nowISO: '2026-08-16T00:00:00Z' });

    // Step 1: Declare spine first so we have windows to compute against
    state = identityReducer(state, {
      type: 'DECLARE_INITIATIVE',
      payload: {
        id: 'spine-p1',
        name: 'Spine P1',
        owningEntityId: null,
        purpose: 'test',
        classification: 'objective',
        doneWhen: 'test',
        terminalDeadline: '2028-02-17', // P1 boundary
      },
    });

    state = identityReducer(state, {
      type: 'DECLARE_INITIATIVE',
      payload: {
        id: 'spine-p2',
        name: 'Spine P2',
        owningEntityId: null,
        purpose: 'test',
        classification: 'objective',
        doneWhen: 'test',
        terminalDeadline: '2029-08-17', // P2 boundary
      },
    });

    state = identityReducer(state, {
      type: 'DECLARE_INITIATIVE',
      payload: {
        id: 'spine-p3',
        name: 'Spine P3',
        owningEntityId: null,
        purpose: 'test',
        classification: 'objective',
        doneWhen: 'test',
        terminalDeadline: '2031-12-31', // P3 boundary
      },
    });

    // Step 2: Declare spine (so windows are defined)
    state = identityReducer(state, {
      type: 'DECLARE_SPINE',
      payload: {
        spineInitiativeIds: ['spine-p1', 'spine-p2', 'spine-p3'],
      },
    });

    console.log('\n=== SPINE WINDOWS NOW DEFINED ===');
    console.log(`spine-p1 phase: ${state.matrix.initiativesById['spine-p1']?.phase} (expected: 1)`);
    console.log(`spine-p2 phase: ${state.matrix.initiativesById['spine-p2']?.phase} (expected: 2)`);
    console.log(`spine-p3 phase: ${state.matrix.initiativesById['spine-p3']?.phase} (expected: 3)`);

    // Step 3: Declare parent Initiative that will be P2
    state = identityReducer(state, {
      type: 'DECLARE_INITIATIVE',
      payload: {
        id: 'parent-at-p2',
        name: 'Parent at P2',
        owningEntityId: null,
        purpose: 'test',
        classification: 'objective',
        doneWhen: 'test',
        terminalDeadline: '2029-06-01', // Falls in P2 window (2028-02-17 to 2029-08-17)
      },
    });

    const parentPhaseBeforeChild = state.matrix.initiativesById['parent-at-p2']?.phase;
    console.log(`\nParent-at-p2 phase: ${parentPhaseBeforeChild} (expected: 2)`);

    // Step 4: Declare child with EARLIER deadline (P1) that violates child >= parent
    state = identityReducer(state, {
      type: 'DECLARE_INITIATIVE',
      payload: {
        id: 'child-at-p1',
        name: 'Child at P1',
        parentInitiativeId: 'parent-at-p2',
        owningEntityId: null,
        purpose: 'test',
        classification: 'objective',
        doneWhen: 'test',
        terminalDeadline: '2028-01-01', // Falls in P1 window (before 2028-02-17) — VIOLATION!
      },
    });

    const childPhase = state.matrix.initiativesById['child-at-p1']?.phase;
    const parentPhase = state.matrix.initiativesById['parent-at-p2']?.phase;

    console.log(`\n=== HIERARCHY VIOLATION DECLARED ===`);
    console.log(`Child-at-p1 phase: ${childPhase} (expected: 1)`);
    console.log(`Parent-at-p2 phase: ${parentPhase} (expected: 2)`);
    console.log(`Violation: child(${childPhase}) < parent(${parentPhase})`);

    // VERIFICATION: Gate should have fired
    console.log(`\nlastPlanWarning: ${state.lastPlanWarning ? JSON.stringify(state.lastPlanWarning.code) : 'none'}`);
    if (state.lastPlanWarning?.code === 'INITIATIVE_PHASE_HIERARCHY_VIOLATION') {
      console.log(`✅ GATE FIRED: ${state.lastPlanWarning.reason}`);
    } else {
      console.log(`❌ GATE DID NOT FIRE`);
    }

    // Hard assertion
    expect(childPhase).toBe('1');
    expect(parentPhase).toBe('2');
    expect(state.lastPlanWarning?.code).toBe('INITIATIVE_PHASE_HIERARCHY_VIOLATION');
    expect(state.lastPlanWarning?.childPhase).toBe(1);  // Stored as number, not string
    expect(state.lastPlanWarning?.parentPhase).toBe(2); // Stored as number, not string
  });
});
