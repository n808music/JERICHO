import { describe, it, expect } from 'vitest';
import {
  INITIATIVE_SLOT,
  INITIATIVE_OWNER_ENTITY_LESS,
  buildInitiativeDeclarePayload,
} from '../../../src/domain/elicitation/initiativeSlot.ts';

// Multi-owner ownership (2026-07-10): an initiative can be owned by several
// entities, and cross-cutting describes scope — it does NOT force entity-less.
// The legacy scalar owningEntityId stays populated (first owner or null) so
// downstream consumers keep working.

const BASE = {
  name: 'Our Fearless Leader 7 Seals',
  purpose: 'Release the seven-single arc across the catalog',
  classification: 'objective',
  doneWhen: 'All 7 singles published on Spotify and Apple Music',
};

const ownerGate = INITIATIVE_SLOT.gate.find((g) => g.code === 'INITIATIVE_OWNER_UNRESOLVED');

describe('initiative multi-owner payload', () => {
  it('array of entities → all kept, first mirrored into legacy scalar', () => {
    const p = buildInitiativeDeclarePayload({
      ...BASE,
      owningEntityId: ['entity-gs-corp', 'entity-gs-productions'],
    });
    expect(p.owningEntityIds).toEqual(['entity-gs-corp', 'entity-gs-productions']);
    expect(p.owningEntityId).toBe('entity-gs-corp');
    expect(p.crossCutting).toBe(false);
  });

  it('cross-cutting ALONGSIDE entities → owners kept, crossCutting flagged', () => {
    const p = buildInitiativeDeclarePayload({
      ...BASE,
      owningEntityId: ['entity-gs-corp', INITIATIVE_OWNER_ENTITY_LESS, 'entity-f8-energy'],
    });
    expect(p.owningEntityIds).toEqual(['entity-gs-corp', 'entity-f8-energy']);
    expect(p.owningEntityId).toBe('entity-gs-corp');
    expect(p.crossCutting).toBe(true);
  });

  it('cross-cutting alone → entity-less (null scalar, empty list), crossCutting true', () => {
    const p = buildInitiativeDeclarePayload({
      ...BASE,
      owningEntityId: [INITIATIVE_OWNER_ENTITY_LESS],
    });
    expect(p.owningEntityIds).toEqual([]);
    expect(p.owningEntityId).toBeNull();
    expect(p.crossCutting).toBe(true);
  });

  it('legacy single-string answers still work (sentinel and entity)', () => {
    const sentinel = buildInitiativeDeclarePayload({ ...BASE, owningEntityId: INITIATIVE_OWNER_ENTITY_LESS });
    expect(sentinel.owningEntityId).toBeNull();
    expect(sentinel.crossCutting).toBe(true);
    const single = buildInitiativeDeclarePayload({ ...BASE, owningEntityId: 'entity-gs-corp' });
    expect(single.owningEntityId).toBe('entity-gs-corp');
    expect(single.owningEntityIds).toEqual(['entity-gs-corp']);
    expect(single.crossCutting).toBe(false);
  });
});

describe('owner gate with array answers', () => {
  it('empty array is unresolved; non-empty array resolves', () => {
    expect(ownerGate.detect({ owningEntityId: [] })).toBe(true);
    expect(ownerGate.detect({ owningEntityId: ['entity-gs-corp'] })).toBe(false);
    expect(ownerGate.detect({ owningEntityId: [INITIATIVE_OWNER_ENTITY_LESS] })).toBe(false);
    expect(ownerGate.detect({})).toBe(true);
  });
});
