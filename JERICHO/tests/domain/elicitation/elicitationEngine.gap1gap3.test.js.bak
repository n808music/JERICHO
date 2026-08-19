import { describe, it, expect } from 'vitest';
import {
  createElicitationEngine,
  ENTITY_SLOT_ID,
  INITIATIVE_SLOT_ID,
  PROJECT_SLOT_ID,
} from '../../../src/domain/elicitation/elicitationEngine.js';

function makeEngine(slotId, goalType = 'founder') {
  return createElicitationEngine({ goalType, matrixSnapshot: {}, scope: [slotId] });
}

// ── GAP 1: isFirstField flag ───────────────────────────────────────────────

describe('GAP 1 — isFirstField on probe', () => {
  it('opening probe has isFirstField: true (no fields captured yet)', () => {
    const engine = makeEngine(ENTITY_SLOT_ID);
    const step = engine.openingStep();
    expect(step.probe.isFirstField).toBe(true);
  });

  it('follow-up probe after name answered has isFirstField: false', () => {
    let engine = makeEngine(ENTITY_SLOT_ID);
    engine.openingStep();
    const r = engine.consumeAnswer({ name: 'Global State Corp.' });
    const step = r.engine.nextStep();
    expect(step.probe.isFirstField).toBe(false);
  });

  it('third probe (after name + roleTags) still has isFirstField: false', () => {
    let engine = makeEngine(ENTITY_SLOT_ID);
    engine.openingStep();
    let r = engine.consumeAnswer({ name: 'F8 Energy Co.' });
    r = r.engine.consumeAnswer({ roleTags: ['business'] });
    const step = r.engine.nextStep();
    expect(step.probe?.isFirstField).toBe(false);
  });

  it('initiative slot opening probe has isFirstField: true', () => {
    const engine = makeEngine(INITIATIVE_SLOT_ID);
    const step = engine.openingStep();
    expect(step.probe.isFirstField).toBe(true);
  });

  it('project slot opening probe has isFirstField: true', () => {
    const engine = makeEngine(PROJECT_SLOT_ID);
    const step = engine.openingStep();
    expect(step.probe.isFirstField).toBe(true);
  });

  it('project follow-up after name captured has isFirstField: false', () => {
    let engine = makeEngine(PROJECT_SLOT_ID);
    engine.openingStep();
    const r = engine.consumeAnswer({ name: 'Album Production' });
    const step = r.engine.nextStep();
    expect(step.probe?.isFirstField).toBe(false);
  });
});
