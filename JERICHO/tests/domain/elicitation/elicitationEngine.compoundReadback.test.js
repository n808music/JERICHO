import { describe, it, expect } from 'vitest';
import { createElicitationEngine, PROJECT_SLOT_ID } from '../../../src/domain/elicitation/elicitationEngine.js';
import { buildBlankIdentityState } from '../../../src/state/identityStore.js';
import { computeDerivedState } from '../../../src/state/identityCompute.js';

// Compound-attestation advisory (2026-07-10, live report): "JERICHO 1.0"
// carried metric "1.0 App and Behavioral Execution Engine" with source
// "USPTO and application store" — an app and a patent welded into one record,
// read back as a check nobody performs. The engine can't comprehend meaning,
// but it CAN notice the compound shape (coordinator on BOTH sides) and flag
// it at the readback. Advisory only — confirming still works.

function seededState() {
  let state = buildBlankIdentityState({});
  state = computeDerivedState(state, {
    type: 'DECLARE_ENTITY',
    payload: {
      id: 'ent-gs-systems',
      name: 'Global State Systems',
      roleTags: ['business', 'project'],
      purpose: 'Technology company that builds and ships Jericho',
      formationState: 'functioning',
      statusEvidence: 'Jericho running locally, provisional patent filed',
    },
  });
  return state;
}

function driveToReadback({ metric, source }) {
  const state = seededState();
  let engine = createElicitationEngine({
    goalType: 'founder',
    matrixSnapshot: state.matrix,
    scope: [PROJECT_SLOT_ID],
  });
  engine.openingStep();
  const script = {
    name: 'JERICHO 1.0',
    owningEntityId: 'ent-gs-systems',
    successMetric: metric,
    verificationSource: source,
    // VS spawn sub-slot fields:
    source,
    domain: 'filings',
  };
  let step = engine.nextStep();
  let guard = 0;
  while (!step.readback && !step.done && guard < 25) {
    const field = step.probe.fieldName;
    const value = script[field];
    if (value === undefined) break;
    const res = engine.consumeAnswer({ [field]: value });
    engine = res.engine.refreshMatrix(state.matrix);
    step = engine.nextStep();
    guard += 1;
  }
  return step;
}

describe('project readback — reopening verificationSource re-asks it', () => {
  it('reopen cascades to the resolved id, so the source question actually returns', () => {
    const step = driveToReadback({
      metric: '1.0 App live in the App Store',
      source: 'USPTO and application store',
    });
    expect(step.readback).toBeTruthy();
    // Reopen the source — the gate keys off verificationSourceId; without the
    // cascade this produced a mangled readback ('Open  and confirm ...')
    // instead of re-asking (2026-07-10).
    const state = seededState();
    let engine = createElicitationEngine({
      goalType: 'founder',
      matrixSnapshot: state.matrix,
      scope: [PROJECT_SLOT_ID],
    });
    engine.openingStep();
    const script = {
      name: 'JERICHO 1.0',
      owningEntityId: 'ent-gs-systems',
      successMetric: '1.0 App live in the App Store',
      verificationSource: 'USPTO and application store',
      source: 'USPTO and application store',
      domain: 'filings',
    };
    let s = engine.nextStep();
    let guard = 0;
    while (!s.readback && !s.done && guard < 25) {
      const f = s.probe.fieldName;
      if (script[f] === undefined) break;
      const r = engine.consumeAnswer({ [f]: script[f] });
      engine = r.engine.refreshMatrix(state.matrix);
      s = engine.nextStep();
      guard += 1;
    }
    expect(s.readback).toBeTruthy();
    const reopened = engine.confirmReadback({ confirmed: false, reopen: 'verificationSource' });
    const after = reopened.engine.nextStep();
    expect(after.readback).toBeFalsy();
    expect(after.probe?.fieldName).toBe('verificationSource');
  });
});

describe('project readback — compound-attestation advisory', () => {
  it('flags when BOTH metric and source join two things with a coordinator', () => {
    const step = driveToReadback({
      metric: '1.0 App and Behavioral Execution Engine non-provisional patent',
      source: 'USPTO and application store',
    });
    expect(step.readback).toBeTruthy();
    expect(step.readback.compoundSuspected).toBe(true);
  });

  it('does NOT flag a single-check record (coordinator on one side only)', () => {
    const step = driveToReadback({
      metric: '1 album mixed and mastered',
      source: 'DistroKid dashboard',
    });
    expect(step.readback).toBeTruthy();
    expect(step.readback.compoundSuspected).toBe(false);
  });
});
