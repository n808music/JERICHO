import { describe, it, expect } from 'vitest';
import {
  createElicitationEngine,
  ENTITY_SLOT_ID,
} from '../../../src/domain/elicitation/elicitationEngine.js';

// Wave 1 engine API addition: createElicitationEngine({ restoreState }) rebuilds
// the slot stack from a prior snapshotState() so an in-flight intake can resume
// exactly where it left off (Defect B). Additive — the fresh-scope path is
// unchanged when restoreState is absent.

describe('elicitation engine — snapshot/restore round-trip', () => {
  it('restoring from snapshotState() reproduces engine state, incl. per-slot captured answers', () => {
    // Drive an entity slot partway (name + roleTags captured, slot not complete).
    let engine = createElicitationEngine({ goalType: 'generic', matrixSnapshot: {}, scope: [ENTITY_SLOT_ID] });
    engine = engine.consumeAnswer({ name: 'Acme Robotics' }).engine;
    engine = engine.consumeAnswer({ roleTags: ['business'] }).engine;

    const snap = engine.snapshotState();
    // Sanity: the snapshot actually carries the captured answers.
    expect(snap.slotStack[snap.slotStack.length - 1].captured).toMatchObject({
      name: 'Acme Robotics',
      roleTags: ['business'],
    });

    // Restore into a brand-new engine instance.
    const restored = createElicitationEngine({
      goalType: 'generic',
      matrixSnapshot: {},
      restoreState: snap,
    });

    // 1. Round-trip: the restored engine's snapshot deep-equals the original.
    expect(restored.snapshotState()).toEqual(snap);

    // 2. Resume lands on the SAME next field (purpose), not back at name.
    const step = restored.nextStep();
    expect(step.probe?.fieldName).toBe('purpose');

    // 3. Captured answers survived — the resumed probe is referent-bound to the
    //    name the user already gave.
    expect(step.probe.spine).toContain('**Acme Robotics**');
  });

  it('without restoreState the engine still starts fresh (additive, no behavior change)', () => {
    const engine = createElicitationEngine({ goalType: 'generic', matrixSnapshot: {}, scope: [ENTITY_SLOT_ID] });
    const step = engine.nextStep();
    expect(step.probe?.fieldName).toBe('name');
    expect(engine.snapshotState().completedSlotIds).toEqual([]);
  });
});
