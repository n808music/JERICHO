import { describe, it, expect } from 'vitest';
import { buildBlankIdentityState } from '../../src/state/identityStore.js';
import { computeDerivedState } from '../../src/state/identityCompute.js';
import { resolveBlockPlainLanguage } from '../../src/domain/product/resolveBlockPlainLanguage.js';
import { ENTERPRISE_IDENTITY_MAP } from '../../src/domain/enterprise/enterpriseIdentityMap';

/**
 * MATRIX SECTION 2 — NODES (Entities)
 *
 * Per the contract: every enterprise node (business / initiative / project /
 * system / function) must be declared once in state.matrix.entitiesById and
 * carry its purpose, current status, desired future state, and role tags.
 *
 * A reusable seed action — SEED_CANONICAL_ENTITIES — populates the 8
 * canonical Operation Endgame entities (Global State Solutions, GS Corp.,
 * GS Productions, GS Systems, GS Holdings, GS Academy, F8 Energy Co.,
 * Capital Path or Revenue Engine) from ENTERPRISE_IDENTITY_MAP. The seed
 * is idempotent and never overwrites operator-declared nodes.
 *
 * The molecular gate emits UNDECLARED_NODE when a block claims membership
 * in an entity (block.entityId) that does not exist in the registry. Soft
 * mode: blocks with no entityId are not punished.
 */

const NODE_OE = {
  id: 'node-operation-endgame',
  name: 'Operation Endgame',
  purpose: 'Coordinate the 5-year multi-lane master plan as the umbrella node.',
  currentStatus: 'active',
  desiredFutureState: 'Every lane reaches externally verifiable proof of scale by 2031-05-19.',
  roleTags: ['Business', 'System'],
};

const NODE_GSS = {
  id: 'node-global-state-solutions',
  name: 'Global State Solutions',
  purpose: 'Parent company / project management / consulting / OE operating system.',
  currentStatus: 'active',
  desiredFutureState: 'Active scaling ecosystem with verified operating cadence.',
  roleTags: ['Business', 'System'],
};

describe('MATRIX SECTION 2 — DECLARE / UPDATE / REMOVE NODE', () => {
  it('DECLARE_NODE adds a node by id', () => {
    const initial = buildBlankIdentityState({});
    const next = computeDerivedState(initial, { type: 'DECLARE_NODE', payload: NODE_OE });
    expect(next.matrix.entitiesById[NODE_OE.id]).toEqual(
      expect.objectContaining({
        id: NODE_OE.id,
        name: NODE_OE.name,
        purpose: NODE_OE.purpose,
        currentStatus: NODE_OE.currentStatus,
        desiredFutureState: NODE_OE.desiredFutureState,
        roleTags: NODE_OE.roleTags,
      })
    );
  });

  it('DECLARE_NODE stamps declaredAtISO automatically', () => {
    const initial = buildBlankIdentityState({});
    const next = computeDerivedState(initial, { type: 'DECLARE_NODE', payload: NODE_OE });
    expect(typeof next.matrix.entitiesById[NODE_OE.id]?.declaredAtISO).toBe('string');
  });

  it('DECLARE_NODE rejects payload without id, name, or roleTags', () => {
    const initial = buildBlankIdentityState({});
    const missingRoleTags = computeDerivedState(initial, {
      type: 'DECLARE_NODE',
      payload: { id: 'node-broken-1', name: 'No tags' },
    });
    expect(missingRoleTags.matrix.entitiesById['node-broken-1']).toBeUndefined();
    expect(missingRoleTags.lastPlanError?.code).toBe('NODE_INVALID');

    const missingName = computeDerivedState(initial, {
      type: 'DECLARE_NODE',
      payload: { id: 'node-broken-2', roleTags: ['Business'] },
    });
    expect(missingName.matrix.entitiesById['node-broken-2']).toBeUndefined();
    expect(missingName.lastPlanError?.code).toBe('NODE_INVALID');
  });

  it('UPDATE_NODE patches an existing node', () => {
    const initial = buildBlankIdentityState({});
    const declared = computeDerivedState(initial, { type: 'DECLARE_NODE', payload: NODE_GSS });
    const updated = computeDerivedState(declared, {
      type: 'UPDATE_NODE',
      payload: { id: NODE_GSS.id, currentStatus: 'incubating', notes: 'Re-prioritized after Wave 3' },
    });
    expect(updated.matrix.entitiesById[NODE_GSS.id]?.currentStatus).toBe('incubating');
    expect(updated.matrix.entitiesById[NODE_GSS.id]?.notes).toBe('Re-prioritized after Wave 3');
    expect(updated.matrix.entitiesById[NODE_GSS.id]?.name).toBe(NODE_GSS.name); // preserved
  });

  it('REMOVE_NODE deletes a node by id', () => {
    const initial = buildBlankIdentityState({});
    const declared = computeDerivedState(initial, { type: 'DECLARE_NODE', payload: NODE_GSS });
    const removed = computeDerivedState(declared, {
      type: 'REMOVE_NODE',
      payload: { id: NODE_GSS.id },
    });
    expect(removed.matrix.entitiesById[NODE_GSS.id]).toBeUndefined();
  });
});

describe('MATRIX SECTION 2 — SEED_CANONICAL_ENTITIES', () => {
  it('populates entitiesById with all 8 canonical entities from ENTERPRISE_IDENTITY_MAP', () => {
    const initial = buildBlankIdentityState({});
    const seeded = computeDerivedState(initial, {
      type: 'SEED_CANONICAL_ENTITIES',
      payload: { confirmDevRecall: true },
    });
    expect(Object.keys(seeded.matrix.entitiesById).length).toBe(ENTERPRISE_IDENTITY_MAP.length);
    ENTERPRISE_IDENTITY_MAP.forEach((entity) => {
      const expectedId = `node-${entity.displayName
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')}`;
      expect(seeded.matrix.entitiesById[expectedId]).toEqual(
        expect.objectContaining({
          id: expectedId,
          name: entity.displayName,
        })
      );
    });
  });

  it('is idempotent — re-seeding does not duplicate or mutate existing entries', () => {
    const initial = buildBlankIdentityState({});
    const seededOnce = computeDerivedState(initial, {
      type: 'SEED_CANONICAL_ENTITIES',
      payload: { confirmDevRecall: true },
    });
    const firstStamps = Object.fromEntries(
      Object.entries(seededOnce.matrix.entitiesById).map(([id, node]) => [id, node.declaredAtISO])
    );
    const seededTwice = computeDerivedState(seededOnce, {
      type: 'SEED_CANONICAL_ENTITIES',
      payload: { confirmDevRecall: true },
    });
    expect(Object.keys(seededTwice.matrix.entitiesById).length).toBe(ENTERPRISE_IDENTITY_MAP.length);
    Object.entries(firstStamps).forEach(([id, stamp]) => {
      expect(seededTwice.matrix.entitiesById[id]?.declaredAtISO).toBe(stamp);
    });
  });

  it('refuses to seed without explicit { confirmDevRecall: true } — extract-not-recall doctrine', () => {
    const initial = buildBlankIdentityState({});
    const blocked = computeDerivedState(initial, { type: 'SEED_CANONICAL_ENTITIES' });
    expect(blocked.matrix.entitiesById).toEqual({});
    expect(blocked.lastPlanError?.code).toBe('SEED_RECALLS_NOT_EXTRACT');
  });

  it('preserves operator-declared nodes when seeding (never overwrites)', () => {
    const initial = buildBlankIdentityState({});
    const manual = computeDerivedState(initial, { type: 'DECLARE_NODE', payload: NODE_OE });
    const seeded = computeDerivedState(manual, {
      type: 'SEED_CANONICAL_ENTITIES',
      payload: { confirmDevRecall: true },
    });
    expect(seeded.matrix.entitiesById[NODE_OE.id]?.name).toBe(NODE_OE.name);
    expect(seeded.matrix.entitiesById[NODE_OE.id]?.purpose).toBe(NODE_OE.purpose);
  });
});

describe('MATRIX SECTION 2 — gate code UNDECLARED_NODE', () => {
  const HIERARCHY = {
    block: 'Validate Operation Endgame hard-anchor protection rules',
    phase: 'P1',
    lane: 'Operation Endgame brand and operations system',
  };

  function baseBlock(overrides = {}) {
    return {
      id: 'b-1',
      title: 'Some block',
      laneId: 'lane-operations',
      laneLabel: 'Operation Endgame brand and operations system',
      ...overrides,
    };
  }

  it('does NOT emit UNDECLARED_NODE when block has no entityId (soft mode)', () => {
    const block = baseBlock({ entityId: null });
    const result = resolveBlockPlainLanguage(block, {
      hierarchy: HIERARCHY,
      matrix: { entitiesById: { 'node-gss': { id: 'node-gss', name: 'GSS', roleTags: ['Business'] } } },
    });
    expect(result.quality?.failureCodes || []).not.toContain('UNDECLARED_NODE');
  });

  it('does NOT emit UNDECLARED_NODE when block.entityId IS in the registry', () => {
    const block = baseBlock({ entityId: 'node-global-state-solutions' });
    const result = resolveBlockPlainLanguage(block, {
      hierarchy: HIERARCHY,
      matrix: {
        entitiesById: {
          'node-global-state-solutions': {
            id: 'node-global-state-solutions',
            name: 'Global State Solutions',
            roleTags: ['Business'],
          },
        },
      },
    });
    expect(result.quality?.failureCodes || []).not.toContain('UNDECLARED_NODE');
  });

  it('EMITS UNDECLARED_NODE when block.entityId is NOT in the registry', () => {
    const block = baseBlock({ entityId: 'node-ghost-entity' });
    const result = resolveBlockPlainLanguage(block, {
      hierarchy: HIERARCHY,
      matrix: {
        entitiesById: {
          'node-global-state-solutions': {
            id: 'node-global-state-solutions',
            name: 'Global State Solutions',
            roleTags: ['Business'],
          },
        },
      },
    });
    expect(result.quality?.failureCodes || []).toContain('UNDECLARED_NODE');
  });

  it('does NOT emit UNDECLARED_NODE when the registry is empty (soft mode — day 1)', () => {
    const block = baseBlock({ entityId: 'node-anything' });
    const result = resolveBlockPlainLanguage(block, {
      hierarchy: HIERARCHY,
      matrix: { entitiesById: {} },
    });
    expect(result.quality?.failureCodes || []).not.toContain('UNDECLARED_NODE');
  });
});
