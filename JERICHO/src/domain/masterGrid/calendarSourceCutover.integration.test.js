import { describe, it, expect } from 'vitest';
import { resolveCommittedCalendarSource } from './calendarSourceCutover.js';
import { availableBlockScopes, filterCalendarBlocksByScope } from './filterCalendarBlocksByScope.js';

// Gate 2 end-to-end: the cutover is what lights up Entity/Initiative/Project isolation on the
// live calendar. OFF, the committed source is the identity-less fallback (fullHorizon forecast) —
// only Deliverable/System/Unowned are offerable. ON, the source is cycle.schedule.blocks, which
// carry full node identity, so all node scopes become available. The flip is the whole feature.

const MATRIX = {
  entitiesById: { e1: { id: 'e1', name: 'Global State Corp.' } },
  initiativesById: { i1: { id: 'i1', name: 'OFL Campaign' }, i2: { id: 'i2', name: 'Broadcast' } },
  projectsById: { p1: { id: 'p1', name: 'Romance Riot' }, p2: { id: 'p2', name: 'Help Yourself' } },
  systemsById: {},
};

// cycle.schedule.blocks — matrix-derived, full identity (what buildScheduledBlocksFromDeterministicResult emits).
const CYCLE = {
  id: 'cycle-1',
  schedule: {
    blocks: [
      { id: 'sb1', startISO: '2026-02-02T09:00:00.000Z', entityId: 'e1', initiativeId: 'i1', sourceProjectId: 'p1', deliverableId: 'd1' },
      { id: 'sb2', startISO: '2026-02-03T09:00:00.000Z', entityId: 'e1', initiativeId: 'i2', sourceProjectId: 'p2', deliverableId: 'd2' },
    ],
  },
};

// The identity-less fullHorizon forecast fallback (no entity/initiative/project ids).
const FORECAST_FALLBACK = [
  { id: 'fc1', entityId: null, initiativeId: null, sourceProjectId: null, deliverableId: 'masterplan-deliverable:lane-x' },
];

describe('Gate 2 — cutover lights up node isolation end to end', () => {
  it('OFF: committed source is the identity-less forecast — no Entity/Initiative/Project scopes, only Unowned', () => {
    const source = resolveCommittedCalendarSource({ cutoverEnabled: false, cycle: CYCLE, fallbackItems: FORECAST_FALLBACK });
    expect(source).toBe(FORECAST_FALLBACK); // unchanged, dormant
    const opts = availableBlockScopes(source, MATRIX);
    expect(opts.Entity).toEqual([]);
    expect(opts.Initiative).toEqual([]);
    expect(opts.Project).toEqual([]);
    expect(opts.Unowned).toEqual([{ id: 'unowned', label: expect.any(String), count: 1 }]); // not dropped
  });

  it('ON: committed source is cycle.schedule.blocks — Entity/Initiative/Project isolation becomes available', () => {
    const source = resolveCommittedCalendarSource({ cutoverEnabled: true, cycle: CYCLE, fallbackItems: FORECAST_FALLBACK });
    expect(source.map((b) => b.id)).toEqual(['sb1', 'sb2']);
    const opts = availableBlockScopes(source, MATRIX);
    expect(opts.Entity.map((o) => o.id)).toEqual(['e1']);
    expect(opts.Entity[0].count).toBe(2);
    expect(opts.Initiative.map((o) => o.id).sort()).toEqual(['i1', 'i2']);
    expect(opts.Project.map((o) => o.id).sort()).toEqual(['p1', 'p2']);
    // and isolation actually filters:
    expect(filterCalendarBlocksByScope(source, { kind: 'Project', id: 'p1' }, MATRIX).map((b) => b.id)).toEqual(['sb1']);
    expect(filterCalendarBlocksByScope(source, { kind: 'Entity', id: 'e1' }, MATRIX).map((b) => b.id)).toEqual(['sb1', 'sb2']);
  });

  it('ON but the cycle has no matrix schedule → falls back, never blanks the calendar', () => {
    const source = resolveCommittedCalendarSource({ cutoverEnabled: true, cycle: { id: 'empty' }, fallbackItems: FORECAST_FALLBACK });
    expect(source).toBe(FORECAST_FALLBACK);
  });
});
