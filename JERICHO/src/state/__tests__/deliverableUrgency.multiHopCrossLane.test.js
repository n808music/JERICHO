import { describe, it, expect, beforeEach } from 'vitest';
import { computeDerivedState } from '../identityCompute.js';

describe('Task 2: multi-hop cross-lane blocking-chain urgency', () => {
  let baseState;

  beforeEach(() => {
    baseState = {
      matrix: {
        entitiesById: { e1: { id: 'e1', name: 'Entity 1' } },
        initiativesById: {},
        projectsById: {},
        deliverablesById: {},
        artifactsById: {},
        systemsById: {},
        dependenciesById: {},
      },
      masterPlanLanesById: {},
      masterPlanMilestonesById: {},
      planBlocks: {},
      appTime: {
        activeDayKey: '2026-07-31',
        nowISO: '2026-07-31T12:00:00.000Z',
      },
    };
  });

  it('multi-hop chain crossing lanes: urgency determined by farthest deadline in different lane', () => {
    // Setup:
    // d1 (Lane1, Init1) → d2 (Lane1, Init1) → d3 (Lane2, Init2)
    // Lane1 deadline: 90 days (LOW)
    // Lane2 deadline: 5 days (CRITICAL)
    // d1 should be CRITICAL because its chain reaches d3 in Lane2 with 5-day deadline

    const init1 = 'init1';
    const lane1 = 'lane1';
    const init2 = 'init2';
    const lane2 = 'lane2';
    const d1 = 'd1';
    const d2 = 'd2';
    const d3 = 'd3';

    // Initiative 1 in Lane 1 (far deadline: 90 days)
    baseState.matrix.initiativesById[init1] = {
      id: init1,
      name: 'Initiative 1 (Long Horizon)',
      owningEntityId: 'e1',
      laneId: lane1,
      phase: 'phase1',
      reviewStatus: 'CONFIRMED',
      declaredAtISO: '2026-07-31T00:00:00Z',
      confirmedAt: null,
      confirmedBy: null,
      confirmationSource: null,
    };

    // Initiative 2 in Lane 2 (near deadline: 5 days) — DIFFERENT LANE
    baseState.matrix.initiativesById[init2] = {
      id: init2,
      name: 'Initiative 2 (Urgent)',
      owningEntityId: 'e1',
      laneId: lane2,
      phase: 'phase2',
      reviewStatus: 'CONFIRMED',
      declaredAtISO: '2026-07-31T00:00:00Z',
      confirmedAt: null,
      confirmedBy: null,
      confirmationSource: null,
    };

    // Project 1 under Initiative 1
    baseState.matrix.projectsById.p1 = {
      id: 'p1',
      name: 'Project 1',
      owningInitiativeId: init1,
      declaredAtISO: '2026-07-31T00:00:00Z',
      confirmedAt: null,
      confirmedBy: null,
      confirmationSource: null,
    };

    // Project 2 under Initiative 2
    baseState.matrix.projectsById.p2 = {
      id: 'p2',
      name: 'Project 2',
      owningInitiativeId: init2,
      declaredAtISO: '2026-07-31T00:00:00Z',
      confirmedAt: null,
      confirmedBy: null,
      confirmationSource: null,
    };

    // d1 in Initiative 1 (will block d2)
    baseState.matrix.deliverablesById[d1] = {
      id: d1,
      name: 'Phase 1 Blocker (Lane 1)',
      owningProjectId: 'p1',
      owningInitiativeId: init1,
      phase: 'phase1',
      targetDate: null,
      reviewStatus: 'CONFIRMED',
      declaredAtISO: '2026-07-31T00:00:00Z',
      confirmedAt: null,
      confirmedBy: null,
      confirmationSource: null,
    };

    // d2 in Initiative 1 (blocks d3, which is in Initiative 2)
    baseState.matrix.deliverablesById[d2] = {
      id: d2,
      name: 'Phase 2 Intermediate (Lane 1)',
      owningProjectId: 'p1',
      owningInitiativeId: init1,
      phase: 'phase2',
      targetDate: null,
      reviewStatus: 'CONFIRMED',
      declaredAtISO: '2026-07-31T00:00:00Z',
      confirmedAt: null,
      confirmedBy: null,
      confirmationSource: null,
    };

    // d3 in Initiative 2 — DIFFERENT INITIATIVE/LANE (urgent)
    baseState.matrix.deliverablesById[d3] = {
      id: d3,
      name: 'Phase 3 Critical (Lane 2)',
      owningProjectId: 'p2',
      owningInitiativeId: init2,
      phase: 'phase3',
      targetDate: null,
      reviewStatus: 'CONFIRMED',
      declaredAtISO: '2026-07-31T00:00:00Z',
      confirmedAt: null,
      confirmedBy: null,
      confirmationSource: null,
    };

    // Blocking chain: d1 blocks d2, d2 blocks d3
    baseState.matrix.dependenciesById.dep1 = {
      id: 'dep1',
      blockerId: d1,
      blockedId: d2,
    };

    baseState.matrix.dependenciesById.dep2 = {
      id: 'dep2',
      blockerId: d2,
      blockedId: d3,
    };

    // Lane 1: 90 days away (far)
    baseState.masterPlanLanesById[lane1] = {
      id: lane1,
      laneEnd: '2026-10-29T23:59:59Z', // 90 days away
    };

    // Lane 2: 5 days away (urgent)
    baseState.masterPlanLanesById[lane2] = {
      id: lane2,
      laneEnd: '2026-08-05T23:59:59Z', // 5 days away
    };

    const derived = computeDerivedState(baseState, { type: 'INIT' });
    const ranking = derived.deliverableUrgencyRanking;

    // CRITICAL VERIFICATION:
    // d1 is in Lane1 (90-day deadline) but blocks d2 which blocks d3 (in Lane2, 5-day deadline)
    // d1's urgency MUST be determined by d3's lane deadline (5 days = CRITICAL)
    // NOT by d1's own lane deadline (90 days = LOW)

    expect(ranking[d1]).toBeDefined();
    expect(ranking[d1].blockedItems).toContain(d2); // d1 blocks d2 (1 hop)
    expect(ranking[d1].blockedItems).toContain(d3); // d1 blocks d3 transitively (2 hops)
    expect(ranking[d1].chainDepth).toBe(2); // 2 items in chain

    // THE CRITICAL TEST: d1 should be CRITICAL because its chain reaches d3 in Lane2
    // with a 5-day deadline, NOT LOW because d1 is in Lane1 with 90-day deadline
    expect(ranking[d1].urgencyBand).toBe('CRITICAL');
    expect(ranking[d1].daysToDeadline).toBeLessThan(7);

    // Verify d2 is also CRITICAL (also blocks d3 directly)
    expect(ranking[d2]).toBeDefined();
    expect(ranking[d2].urgencyBand).toBe('CRITICAL');
    expect(ranking[d2].blockedItems).toContain(d3);

    // d3 itself has no blocking chain, so it should be LOW
    // (it doesn't block anything; it's the end of the chain)
    expect(ranking[d3]).toBeDefined();
    expect(ranking[d3].urgencyBand).toBe('LOW');
    expect(ranking[d3].blockedItems.length).toBe(0);
  });
});
