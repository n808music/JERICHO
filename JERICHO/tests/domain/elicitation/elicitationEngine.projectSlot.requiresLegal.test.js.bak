import { describe, it, expect } from 'vitest';
import { buildBlankIdentityState } from '../../../src/state/identityStore.js';
import { computeDerivedState } from '../../../src/state/identityCompute.js';
import {
  createElicitationEngine,
  PROJECT_SLOT_ID,
} from '../../../src/domain/elicitation/elicitationEngine.js';

function runProjectScript(script, opts = {}) {
  let state = buildBlankIdentityState({});
  let engine = createElicitationEngine({
    goalType: opts.goalType || 'founder',
    matrixSnapshot: state.matrix,
    scope: [PROJECT_SLOT_ID],
  });
  const dispatchedActions = [];
  let step = engine.openingStep();
  let pendingAnswers = [...script];
  let safety = 0;
  while (!step.done) {
    if (safety++ > 50) {throw new Error('Engine did not terminate within safety bound');}
    if (pendingAnswers.length === 0) {
      throw new Error(`Out of scripted answers — engine still asking about "${step.probe.fieldName}" (${step.probe.code})`);
    }
    const answer = pendingAnswers.shift();
    const result = engine.consumeAnswer(answer);
    engine = result.engine;
    for (const action of result.dispatches || []) {
      dispatchedActions.push(action);
      state = computeDerivedState(state, action);
    }
    engine = engine.refreshMatrix(state.matrix);
    step = engine.nextStep();
  }
  return { state, dispatchedActions };
}

describe('Project slot — requiresLegalFormation field capture', () => {
  it('captures requiresLegalFormation=true when declared', () => {
    // Pre-populate matrix with entity and verification source
    let state = buildBlankIdentityState({});
    state = computeDerivedState(state, {
      type: 'DECLARE_ENTITY',
      payload: {
        id: 'entity-test',
        name: 'Test Entity',
        roleTags: ['business'],
        purpose: 'Test entity for project',
        formationState: 'named-only',
        statusEvidence: 'Test evidence',
        legallyFormed: false,
      },
    });
    state = computeDerivedState(state, {
      type: 'DECLARE_VERIFICATION_SOURCE',
      payload: {
        id: 'vs-test',
        source: 'Test Source',
        domain: 'Test Domain',
      },
    });

    // Run project script with requiresLegalFormation=true
    const script = [
      { name: 'Lease Signing' },
      { owningEntityId: 'entity-test' },
      { successMetric: 'Lease is signed' },
      { verificationSourceId: 'vs-test' },
      { phase: '1' },
      { requiresLegalFormation: true },
    ];

    let engine = createElicitationEngine({
      goalType: 'founder',
      matrixSnapshot: state.matrix,
      scope: [PROJECT_SLOT_ID],
    });
    let step = engine.openingStep();
    for (const answer of script) {
      if (!step.done) {
        const result = engine.consumeAnswer(answer);
        engine = result.engine;
        for (const action of result.dispatches || []) {
          state = computeDerivedState(state, action);
        }
        engine = engine.refreshMatrix(state.matrix);
        step = engine.nextStep();
      }
    }

    // After all answers, engine is at readback — confirm to dispatch DECLARE_PROJECT
    if (step.readback && !step.done) {
      const result = engine.confirmReadback({ confirmed: true });
      engine = result.engine;
      for (const action of result.dispatches || []) {
        state = computeDerivedState(state, action);
      }
    }

    const projects = Object.values(state.matrix.projectsById);
    expect(projects.length).toBeGreaterThan(0);
    expect(projects[0].requiresLegalFormation).toBe(true);
    expect(projects[0].name).toBe('Lease Signing');
  });

  it('captures requiresLegalFormation=false when declared', () => {
    let state = buildBlankIdentityState({});
    state = computeDerivedState(state, {
      type: 'DECLARE_ENTITY',
      payload: {
        id: 'entity-marketing',
        name: 'Marketing Entity',
        roleTags: ['business'],
        purpose: 'Marketing entity for project',
        formationState: 'named-only',
        statusEvidence: 'Test evidence',
        legallyFormed: true,
      },
    });
    state = computeDerivedState(state, {
      type: 'DECLARE_VERIFICATION_SOURCE',
      payload: {
        id: 'vs-marketing',
        source: 'Analytics',
        domain: 'Campaign Metrics',
      },
    });

    const script = [
      { name: 'Marketing Campaign' },
      { owningEntityId: 'entity-marketing' },
      { successMetric: '1000 signups' },
      { verificationSourceId: 'vs-marketing' },
      { phase: '1' },
      { requiresLegalFormation: false },
    ];

    let engine = createElicitationEngine({
      goalType: 'founder',
      matrixSnapshot: state.matrix,
      scope: [PROJECT_SLOT_ID],
    });
    let step = engine.openingStep();
    for (const answer of script) {
      if (!step.done) {
        const result = engine.consumeAnswer(answer);
        engine = result.engine;
        for (const action of result.dispatches || []) {
          state = computeDerivedState(state, action);
        }
        engine = engine.refreshMatrix(state.matrix);
        step = engine.nextStep();
      }
    }

    // After all answers, engine is at readback — confirm to dispatch DECLARE_PROJECT
    if (step.readback && !step.done) {
      const result = engine.confirmReadback({ confirmed: true });
      engine = result.engine;
      for (const action of result.dispatches || []) {
        state = computeDerivedState(state, action);
      }
    }

    const projects = Object.values(state.matrix.projectsById);
    expect(projects.length).toBeGreaterThan(0);
    expect(projects[0].requiresLegalFormation).toBe(false);
    expect(projects[0].name).toBe('Marketing Campaign');
  });
});
