import { describe, it, expect } from 'vitest';
import { filterCalendarBlocksByScope, availableBlockScopes } from './filterCalendarBlocksByScope.js';

// Display blocks carry entityId / initiativeId(laneId) / sourceProjectId / deliverableId
// (resolved in scheduledBlocksFromDeterministicResult). Systems carry no block id — a
// system's involved blocks derive from its owning entity.
const blocks = [
  { id: 'b1', entityId: 'e1', initiativeId: 'i1', sourceProjectId: 'p1', deliverableId: 'd1' },
  { id: 'b2', entityId: 'e1', initiativeId: 'i2', sourceProjectId: 'p2', deliverableId: 'd2' },
  { id: 'b3', entityId: 'e2', initiativeId: 'i3', sourceProjectId: 'p3', deliverableId: null },
  { id: 'b4', entityId: null, initiativeId: null, sourceProjectId: null, deliverableId: null }, // manual block, no lineage
];
const matrix = {
  systemsById: {
    s1: { id: 's1', name: 'music system', owningEntityId: 'e1' },
    s2: { id: 's2', name: 'financial funnel system', owningEntityId: 'e2' },
    s3: { id: 's3', name: 'Marketing flywheel', owningEntityId: null }, // cross-cutting, no owner
  },
};

describe('filterCalendarBlocksByScope (Gate 8 — isolate calendar blocks per category)', () => {
  it('full scope returns every block unchanged (full-scope integrity)', () => {
    expect(filterCalendarBlocksByScope(blocks, 'full', matrix)).toEqual(blocks);
    expect(filterCalendarBlocksByScope(blocks, null, matrix)).toEqual(blocks);
  });

  it('Entity scope isolates one entity’s blocks (entity to entity)', () => {
    expect(filterCalendarBlocksByScope(blocks, { kind: 'Entity', id: 'e1' }, matrix).map((b) => b.id)).toEqual(['b1', 'b2']);
    expect(filterCalendarBlocksByScope(blocks, { kind: 'Entity', id: 'e2' }, matrix).map((b) => b.id)).toEqual(['b3']);
  });

  it('Initiative scope isolates one initiative’s blocks (initiative to initiative)', () => {
    expect(filterCalendarBlocksByScope(blocks, { kind: 'Initiative', id: 'i3' }, matrix).map((b) => b.id)).toEqual(['b3']);
  });

  it('Project scope breaks down to that project’s blocks', () => {
    expect(filterCalendarBlocksByScope(blocks, { kind: 'Project', id: 'p1' }, matrix).map((b) => b.id)).toEqual(['b1']);
  });

  it('Deliverable scope isolates that deliverable’s blocks', () => {
    expect(filterCalendarBlocksByScope(blocks, { kind: 'Deliverable', id: 'd2' }, matrix).map((b) => b.id)).toEqual(['b2']);
  });

  it('System scope shows every block involved in that system (via owning entity); independent systems differ', () => {
    expect(filterCalendarBlocksByScope(blocks, { kind: 'System', id: 's1' }, matrix).map((b) => b.id)).toEqual(['b1', 'b2']); // music → e1
    expect(filterCalendarBlocksByScope(blocks, { kind: 'System', id: 's2' }, matrix).map((b) => b.id)).toEqual(['b3']);       // funnel → e2
  });

  it('a system with no owning entity isolates nothing (honest empty, not a crash)', () => {
    expect(filterCalendarBlocksByScope(blocks, { kind: 'System', id: 's3' }, matrix)).toEqual([]);
  });

  it('filtering never mutates the input array (non-destructive)', () => {
    const before = blocks.map((b) => b.id);
    filterCalendarBlocksByScope(blocks, { kind: 'Entity', id: 'e1' }, matrix);
    expect(blocks.map((b) => b.id)).toEqual(before);
  });

  it('availableBlockScopes enumerates only nodes that actually have blocks, with counts', () => {
    const opts = availableBlockScopes(blocks, matrix);
    expect(opts.Entity.map((o) => o.id).sort()).toEqual(['e1', 'e2']);
    expect(opts.Entity.find((o) => o.id === 'e1').count).toBe(2);
    expect(opts.Project.map((o) => o.id).sort()).toEqual(['p1', 'p2', 'p3']);
    // only systems whose owning entity has blocks are offered (s3 has no owner → excluded)
    expect(opts.System.map((o) => o.id).sort()).toEqual(['s1', 's2']);
  });
});
