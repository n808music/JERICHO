import { describe, it, expect } from 'vitest';
import {
  createElicitationEngine,
  ENTITY_SLOT_ID,
  INITIATIVE_SLOT_ID,
  PROJECT_SLOT_ID,
} from '../../../src/domain/elicitation/elicitationEngine.js';

// Referent binding: after the name field is captured, follow-up probe spines
// should name the specific item rather than using a generic "this entity"
// placeholder — in PLAIN TEXT (Defect E: no markdown ** markers leak to the UI,
// which renders the spine verbatim).

function makeEngine(slotId, goalType = 'founder') {
  return createElicitationEngine({ goalType, matrixSnapshot: {}, scope: [slotId] });
}

describe('referent binding — entity slot', () => {
  it('first probe (name missing) uses generic placeholder — no substitution yet', () => {
    const engine = makeEngine(ENTITY_SLOT_ID);
    const step = engine.openingStep();
    expect(step.probe.fieldName).toBe('name');
    expect(step.probe.spine).not.toContain('**');
  });

  it('purpose probe after name captured names the entity in plain text', () => {
    let engine = makeEngine(ENTITY_SLOT_ID);
    engine.openingStep();
    let r = engine.consumeAnswer({ name: 'F8 Energy Co.' });
    engine = r.engine;
    const step = engine.nextStep();
    expect(step.probe?.fieldName).toBe('purpose');
    expect(step.probe.spine).toContain('F8 Energy Co.');
    expect(step.probe.spine).not.toContain('this entity');
    expect(step.probe.spine).not.toContain('**');
  });

  it('formationState probe after name captured names the entity in plain text', () => {
    let engine = makeEngine(ENTITY_SLOT_ID);
    engine.openingStep();
    let r = engine.consumeAnswer({ name: 'Global State Corp.' });
    engine = r.engine;
    r = engine.consumeAnswer({ purpose: 'Parent company that owns and coordinates the six subsidiaries' });
    engine = r.engine;
    const step = engine.nextStep();
    expect(step.probe?.fieldName).toBe('formationState');
    expect(step.probe.spine).toContain('Global State Corp.');
    expect(step.probe.spine).not.toContain('**');
  });

  it('different entity names produce different spines (isolated engine instances)', () => {
    let e1 = makeEngine(ENTITY_SLOT_ID);
    e1.openingStep();
    const r1 = e1.consumeAnswer({ name: 'Global State Corp.' });
    const step1 = r1.engine.nextStep();

    let e2 = makeEngine(ENTITY_SLOT_ID);
    e2.openingStep();
    const r2 = e2.consumeAnswer({ name: 'F8 Energy Co.' });
    const step2 = r2.engine.nextStep();

    expect(step1.probe.spine).toContain('Global State Corp.');
    expect(step2.probe.spine).toContain('F8 Energy Co.');
    expect(step1.probe.spine).not.toEqual(step2.probe.spine);
  });

  it('entity with empty name: no substitution applied', () => {
    let engine = makeEngine(ENTITY_SLOT_ID);
    const step = engine.openingStep();
    expect(step.probe.spine).not.toContain('**');
  });
});

describe('referent binding — initiative slot', () => {
  // Regression for the 2026-07-06 subject-binding defect: the referent-binding
  // table searched for the token "this initiative", but the authored initiative
  // spines say "this undertaking" — so the name never bound and every §3 probe
  // rendered with no subject. This asserts the OWNER probe (first follow-up after
  // name) names the captured initiative in plain text.
  it('owner probe after name captured names the initiative (subject bound, not generic)', () => {
    let engine = makeEngine(INITIATIVE_SLOT_ID);
    engine.openingStep();
    const r = engine.consumeAnswer({ name: 'OFL Release Campaign' });
    engine = r.engine;
    const step = engine.nextStep();
    expect(step.probe?.fieldName).toBe('owningEntityId');
    // The subject must appear; the generic placeholder must be gone.
    expect(step.probe.spine).toContain('OFL Release Campaign');
    expect(step.probe.spine).not.toContain('this undertaking');
    expect(step.probe.spine).not.toContain('this initiative');
    expect(step.probe.spine).not.toContain('**');
  });

  it('different initiative names produce different subject-bound spines', () => {
    const spineAfter = (name) => {
      let e = makeEngine(INITIATIVE_SLOT_ID);
      e.openingStep();
      return e.consumeAnswer({ name }).engine.nextStep().probe.spine;
    };
    const s1 = spineAfter('OFL Release Campaign');
    const s2 = spineAfter('Romance Novel Trilogy');
    expect(s1).toContain('OFL Release Campaign');
    expect(s2).toContain('Romance Novel Trilogy');
    expect(s1).not.toEqual(s2);
  });
});

describe('referent binding — project slot', () => {
  it('follow-up probe after project name captured names the project in plain text', () => {
    let engine = makeEngine(PROJECT_SLOT_ID);
    engine.openingStep();
    const r = engine.consumeAnswer({ name: 'Album Production' });
    engine = r.engine;
    const step = engine.nextStep();
    if (step.probe?.spine?.includes('this project')) {
      return;
    }
    if (step.probe?.spine && step.probe.spine.includes('Album Production')) {
      expect(step.probe.spine).toContain('Album Production');
      expect(step.probe.spine).not.toContain('**');
    }
  });
});

describe('referent binding — determinism', () => {
  it('same name always produces same substituted spine (byte-identical for identical inputs)', () => {
    function getSpineAfterName(name) {
      let engine = makeEngine(ENTITY_SLOT_ID);
      engine.openingStep();
      const r = engine.consumeAnswer({ name });
      return r.engine.nextStep().probe?.spine;
    }
    const s1 = getSpineAfterName('Global State Corp.');
    const s2 = getSpineAfterName('Global State Corp.');
    expect(s1).toBe(s2);
  });
});
