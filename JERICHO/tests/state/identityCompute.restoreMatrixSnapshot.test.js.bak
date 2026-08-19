import { describe, it, expect } from 'vitest';
import { buildBlankIdentityState } from '../../src/state/identityStore.js';
import { computeDerivedState } from '../../src/state/identityCompute.js';

// RESTORE_MATRIX_SNAPSHOT — the intake Back button's rollback primitive.
// Restoring a prior matrix snapshot must (a) remove nodes declared after the
// snapshot, (b) deep-clone the payload so the caller's retained reference
// cannot alias live state, (c) reject a missing payload without clobbering.

const ENTITY = {
  id: 'entity-acme-robotics',
  name: 'Acme Robotics',
  roleTags: ['business'],
  purpose: 'Builds and sells the industrial arm product line.',
  formationState: 'operating',
  statusEvidence: 'Registered LLC, 2 shipped units, 1 signed distributor.',
};

describe('RESTORE_MATRIX_SNAPSHOT', () => {
  it('rolls back an entity declared after the snapshot was taken', () => {
    const base = buildBlankIdentityState();
    const before = computeDerivedState(base, { type: 'NO_OP' });
    const snapshot = before.matrix;

    const declared = computeDerivedState(before, { type: 'DECLARE_ENTITY', payload: ENTITY });
    expect(declared.matrix.entitiesById[ENTITY.id]).toBeTruthy();

    const restored = computeDerivedState(declared, {
      type: 'RESTORE_MATRIX_SNAPSHOT',
      payload: { matrix: snapshot },
    });
    expect(restored.matrix.entitiesById[ENTITY.id]).toBeUndefined();
  });

  it('clones the payload — mutating restored state never touches the caller snapshot', () => {
    const base = buildBlankIdentityState();
    const withEntity = computeDerivedState(base, { type: 'DECLARE_ENTITY', payload: ENTITY });
    const snapshot = withEntity.matrix;

    const restored = computeDerivedState(withEntity, {
      type: 'RESTORE_MATRIX_SNAPSHOT',
      payload: { matrix: snapshot },
    });
    expect(restored.matrix).not.toBe(snapshot);
    restored.matrix.entitiesById[ENTITY.id].name = 'MUTATED';
    expect(snapshot.entitiesById[ENTITY.id].name).toBe('Acme Robotics');
  });

  it('missing payload is a recorded no-op, not a matrix wipe', () => {
    const base = buildBlankIdentityState();
    const withEntity = computeDerivedState(base, { type: 'DECLARE_ENTITY', payload: ENTITY });
    const after = computeDerivedState(withEntity, { type: 'RESTORE_MATRIX_SNAPSHOT', payload: {} });
    expect(after.matrix.entitiesById[ENTITY.id]).toBeTruthy();
    expect(after.lastPlanError?.code).toBe('MATRIX_RESTORE_INVALID');
  });
});
