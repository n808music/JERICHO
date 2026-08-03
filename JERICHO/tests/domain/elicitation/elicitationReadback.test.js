import { describe, it, expect } from 'vitest';
import { buildBlankIdentityState } from '../../../src/state/identityStore.js';
import { computeDerivedState } from '../../../src/state/identityCompute.js';
import {
  createElicitationEngine,
  PROJECT_SLOT_ID,
} from '../../../src/domain/elicitation/elicitationEngine.js';

function buildSeededState() {
  let state = buildBlankIdentityState({});
  state = computeDerivedState(state, {
    type: 'DECLARE_NODE',
    payload: { id: 'node-gs-corp', name: 'Global State Corp.', roleTags: ['Business'] },
  });
  return state;
}

/**
 * Drives the engine through all slot probes to the read-back gate.
 * Returns the engine paused at read-back (readbackPending set), plus
 * the accumulated dispatches (DECLARE_VERIFICATION_SOURCE, but NOT
 * DECLARE_PROJECT — that is withheld until confirmReadback).
 */
function driveToReadback(seedState) {
  let state = seedState;
  let engine = createElicitationEngine({
    goalType: 'musician',
    matrixSnapshot: state.matrix,
    scope: [PROJECT_SLOT_ID],
  });
  const preReadbackDispatches = [];
  const answers = [
    { name: 'Romance Riot' },
    { owningEntityId: 'node-gs-corp' },
    { successMetric: '10,000 first-week streams' },
    { verificationSource: 'Spotify for Artists', domain: 'Music streams' },
    // §5 phase attestation (Wave 2 Gate 1) — now a required project gate; supply it so the
    // engine reaches the read-back step instead of halting at PROJECT_PHASE_UNATTESTED.
    { phase: '2' },
    // Legal formation gate — added to project slot; default to false (not required)
    { requiresLegalFormation: false },
  ];
  for (const answer of answers) {
    const result = engine.consumeAnswer(answer);
    engine = result.engine;
    for (const action of result.dispatches || []) {
      preReadbackDispatches.push(action);
      state = computeDerivedState(state, action);
    }
    engine = engine.refreshMatrix(state.matrix);
  }
  return { engine, state, preReadbackDispatches };
}

describe('Elicitation Engine — read-back step', () => {
  it('halts at readback when all project slot gates pass (does not dispatch or finish)', () => {
    const { engine, preReadbackDispatches } = driveToReadback(buildSeededState());
    // VS declared but PROJECT not yet dispatched
    expect(preReadbackDispatches.find((a) => a.type === 'DECLARE_VERIFICATION_SOURCE')).toBeTruthy();
    expect(preReadbackDispatches.find((a) => a.type === 'DECLARE_PROJECT')).toBeUndefined();

    const step = engine.nextStep();
    expect(step.done).toBe(false);
    expect(step.readback).toBeDefined();
    expect(step.readback.sentence).toMatch(/Your done-when will read/);
    expect(step.readback.sentence).toContain('Spotify for Artists');
    expect(step.readback.sentence).toContain('10,000 first-week streams');
    expect(step.readback.fields.name).toBe('Romance Riot');
    expect(step.readback.fields.successMetric).toBe('10,000 first-week streams');
    expect(step.readback.fields.verificationSource).toBe('Spotify for Artists');
    // No probe — readback replaces the probe step
    expect(step.probe).toBeUndefined();
  });

  it('confirmed:true dispatches DECLARE_PROJECT and the engine is done', () => {
    const { engine } = driveToReadback(buildSeededState());
    const result = engine.confirmReadback({ confirmed: true });

    const declare = result.dispatches.find((a) => a.type === 'DECLARE_PROJECT');
    expect(declare).toBeTruthy();
    expect(declare.payload.name).toBe('Romance Riot');
    expect(declare.payload.successMetric).toBe('10,000 first-week streams');
    expect(declare.payload.owningEntityId).toBe('node-gs-corp');
    expect(declare.payload.verificationSourceId).toBeTruthy();

    const nextStep = result.engine.nextStep();
    expect(nextStep.done).toBe(true);
  });

  it('confirmed:false+reopen clears only the named field and re-probes it, preserving siblings', () => {
    const { engine } = driveToReadback(buildSeededState());
    const result = engine.confirmReadback({ confirmed: false, reopen: 'successMetric' });

    expect(result.dispatches).toHaveLength(0);

    const step = result.engine.nextStep();
    expect(step.done).toBe(false);
    expect(step.probe).toBeDefined();
    expect(step.probe.fieldName).toBe('successMetric');

    // Siblings preserved
    const captured = result.engine.snapshotCapturedFields();
    expect(captured.name).toBe('Romance Riot');
    expect(captured.owningEntityId).toBe('node-gs-corp');
    expect(captured.verificationSourceId).toBeTruthy();
    // Cleared field is gone
    expect(captured.successMetric).toBeUndefined();
  });

  it('re-answering after reject re-emits readback with updated sentence, then confirms cleanly', () => {
    const { engine, state } = driveToReadback(buildSeededState());
    const rejected = engine.confirmReadback({ confirmed: false, reopen: 'successMetric' });

    // Re-answer with a better metric
    const result2 = rejected.engine.consumeAnswer({ successMetric: '500 tickets sold' });
    let engine2 = result2.engine.refreshMatrix(state.matrix);

    const step2 = engine2.nextStep();
    expect(step2.readback).toBeDefined();
    expect(step2.readback.sentence).toContain('500 tickets sold');
    expect(step2.readback.sentence).toContain('Spotify for Artists');

    // Confirm the updated readback
    const confirmed = engine2.confirmReadback({ confirmed: true });
    const decl = confirmed.dispatches.find((a) => a.type === 'DECLARE_PROJECT');
    expect(decl.payload.successMetric).toBe('500 tickets sold');
    expect(confirmed.engine.nextStep().done).toBe(true);
  });

  it('readback sentence is byte-identical across two runs with the same inputs', () => {
    const { engine: engineA } = driveToReadback(buildSeededState());
    const { engine: engineB } = driveToReadback(buildSeededState());
    const sentenceA = engineA.nextStep().readback.sentence;
    const sentenceB = engineB.nextStep().readback.sentence;
    expect(sentenceB).toBe(sentenceA);
  });
});
