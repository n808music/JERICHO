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

// ── GAP 3: roleTagOptions pickSet display labels ───────────────────────────

describe('GAP 3 — roleTagOptions chip labels do not collide with section names', () => {
  function getRoleTagPickSet() {
    let engine = makeEngine(ENTITY_SLOT_ID);
    engine.openingStep();
    const r = engine.consumeAnswer({ name: 'Global State Corp.' });
    // Next probe is roleTags
    const step = r.engine.nextStep();
    expect(step.probe?.fieldName).toBe('roleTags');
    return step.probe.pickSet;
  }

  it('pickSet items have display labels, not raw enum values', () => {
    const pickSet = getRoleTagPickSet();
    const labels = pickSet.items.map((i) => i.label);
    // None of these raw enum values should appear as labels
    expect(labels).not.toContain('initiative');
    expect(labels).not.toContain('project');
    expect(labels).not.toContain('system');
  });

  it('internal IDs remain as the canonical enum values', () => {
    const pickSet = getRoleTagPickSet();
    const ids = pickSet.items.map((i) => i.id);
    expect(ids).toContain('initiative');
    expect(ids).toContain('project');
    expect(ids).toContain('system');
    expect(ids).toContain('business');
  });

  it('colliding tags have distinct display labels', () => {
    const pickSet = getRoleTagPickSet();
    const byId = Object.fromEntries(pickSet.items.map((i) => [i.id, i.label]));
    expect(byId['initiative']).toBe('Campaign leader');
    expect(byId['project']).toBe('Project operator');
    expect(byId['system']).toBe('System custodian');
  });

  it('non-colliding tags have expected labels', () => {
    const pickSet = getRoleTagPickSet();
    const byId = Object.fromEntries(pickSet.items.map((i) => [i.id, i.label]));
    expect(byId['business']).toBe('Business');
  });

  it('all 4 role tags are present in the pickSet', () => {
    const pickSet = getRoleTagPickSet();
    expect(pickSet.items).toHaveLength(4);
  });
});
