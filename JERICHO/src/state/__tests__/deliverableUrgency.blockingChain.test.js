import { describe, it, expect, beforeEach } from 'vitest';
import { computeDerivedState } from '../identityCompute.js';

describe('Task 2: blocking-chain urgency ranking', () => {
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
        timeIsPinned: true,
        nowISO: '2026-07-31T12:00:00.000Z',
      },
    };
  });

  it('ranks deliverable CRITICAL when blocking chain reaches lane with deadline ≤7 days', () => {
    const initiativeId = 'init1';
    const laneId = 'lane1';
    const d1 = 'd1'; // upstream blocker
    const d2 = 'd2'; // downstream, blocked by d1

    baseState.matrix.initiativesById[initiativeId] = {
      id: initiativeId,
      name: 'Initiative 1',
      owningEntityId: 'e1',
      laneId, // FK to lane
      phase: 'phase1',
      reviewStatus: 'CONFIRMED',
      declaredAtISO: '2026-07-31T00:00:00Z',
      confirmedAt: null,
      confirmedBy: null,
      confirmationSource: null,
    };

    baseState.matrix.projectsById.p1 = {
      id: 'p1',
      name: 'Project 1',
      owningInitiativeId: initiativeId,
      declaredAtISO: '2026-07-31T00:00:00Z',
      confirmedAt: null,
      confirmedBy: null,
      confirmationSource: null,
    };

    // d1 is the upstream blocker
    baseState.matrix.deliverablesById[d1] = {
      id: d1,
      name: 'Blocker',
      owningProjectId: 'p1',
      owningInitiativeId: initiativeId,
      phase: 'phase1',
      targetDate: null,
      reviewStatus: 'CONFIRMED',
      declaredAtISO: '2026-07-31T00:00:00Z',
      confirmedAt: null,
      confirmedBy: null,
      confirmationSource: null,
    };

    // d2 is blocked by d1, owned by same initiative
    baseState.matrix.deliverablesById[d2] = {
      id: d2,
      name: 'Blocked Item',
      owningProjectId: 'p1',
      owningInitiativeId: initiativeId,
      phase: 'phase2',
      targetDate: null,
      reviewStatus: 'CONFIRMED',
      declaredAtISO: '2026-07-31T00:00:00Z',
      confirmedAt: null,
      confirmedBy: null,
      confirmationSource: null,
    };

    // d1 blocks d2 dependency
    baseState.matrix.dependenciesById.dep1 = {
      id: 'dep1',
      blockerId: d1,
      blockedId: d2,
    };

    // Lane with deadline 3 days away = CRITICAL
    baseState.masterPlanLanesById[laneId] = {
      id: laneId,
      laneEnd: '2026-08-03T23:59:59Z',
    };

    const derived = computeDerivedState(baseState, { type: 'INIT' });
    const ranking = derived.deliverableUrgencyRanking;

    // d1 should be CRITICAL because it blocks d2, which is in initiative with deadline ≤7 days
    expect(ranking[d1]).toBeDefined();
    expect(ranking[d1].urgencyBand).toBe('CRITICAL');
    expect(ranking[d1].blockedItems).toContain(d2);
    expect(ranking[d1].chainDepth).toBeGreaterThan(0);
  });

  it('ranks deliverable HIGH when blocking chain reaches lane with deadline ≤21 days', () => {
    const initiativeId = 'init1';
    const laneId = 'lane1';
    const d1 = 'd1';
    const d2 = 'd2';

    baseState.matrix.initiativesById[initiativeId] = {
      id: initiativeId,
      name: 'Initiative 1',
      owningEntityId: 'e1',
      laneId,
      phase: 'phase1',
      reviewStatus: 'CONFIRMED',
      declaredAtISO: '2026-07-31T00:00:00Z',
      confirmedAt: null,
      confirmedBy: null,
      confirmationSource: null,
    };

    baseState.matrix.projectsById.p1 = {
      id: 'p1',
      name: 'Project 1',
      owningInitiativeId: initiativeId,
      declaredAtISO: '2026-07-31T00:00:00Z',
      confirmedAt: null,
      confirmedBy: null,
      confirmationSource: null,
    };

    baseState.matrix.deliverablesById[d1] = {
      id: d1,
      name: 'Blocker with HIGH urgency',
      owningProjectId: 'p1',
      owningInitiativeId: initiativeId,
      phase: 'phase1',
      targetDate: null,
      reviewStatus: 'CONFIRMED',
      declaredAtISO: '2026-07-31T00:00:00Z',
      confirmedAt: null,
      confirmedBy: null,
      confirmationSource: null,
    };

    baseState.matrix.deliverablesById[d2] = {
      id: d2,
      name: 'Blocked by d1',
      owningProjectId: 'p1',
      owningInitiativeId: initiativeId,
      phase: 'phase2',
      targetDate: null,
      reviewStatus: 'CONFIRMED',
      declaredAtISO: '2026-07-31T00:00:00Z',
      confirmedAt: null,
      confirmedBy: null,
      confirmationSource: null,
    };

    // d1 blocks d2
    baseState.matrix.dependenciesById.dep1 = {
      id: 'dep1',
      blockerId: d1,
      blockedId: d2,
    };

    // Lane with deadline 10 days away = HIGH
    baseState.masterPlanLanesById[laneId] = {
      id: laneId,
      laneEnd: '2026-08-10T23:59:59Z',
    };

    const derived = computeDerivedState(baseState, { type: 'INIT' });
    const ranking = derived.deliverableUrgencyRanking;

    expect(ranking[d1]).toBeDefined();
    expect(ranking[d1].urgencyBand).toBe('HIGH');
    expect(ranking[d1].blockedItems).toContain(d2);
  });

  it('returns LOW urgency for deliverable with no blocking chain and no deadline', () => {
    const d1 = 'd1';

    baseState.matrix.initiativesById.init1 = {
      id: 'init1',
      name: 'Initiative 1',
      owningEntityId: 'e1',
      laneId: null,
      phase: 'phase1',
      reviewStatus: 'CONFIRMED',
      declaredAtISO: '2026-07-31T00:00:00Z',
      confirmedAt: null,
      confirmedBy: null,
      confirmationSource: null,
    };

    baseState.matrix.projectsById.p1 = {
      id: 'p1',
      name: 'Project 1',
      owningInitiativeId: 'init1',
      declaredAtISO: '2026-07-31T00:00:00Z',
      confirmedAt: null,
      confirmedBy: null,
      confirmationSource: null,
    };

    baseState.matrix.deliverablesById[d1] = {
      id: d1,
      name: 'No Dependencies',
      owningProjectId: 'p1',
      owningInitiativeId: 'init1',
      phase: 'phase1',
      targetDate: null,
      reviewStatus: 'CONFIRMED',
      declaredAtISO: '2026-07-31T00:00:00Z',
      confirmedAt: null,
      confirmedBy: null,
      confirmationSource: null,
    };

    const derived = computeDerivedState(baseState, { type: 'INIT' });
    const ranking = derived.deliverableUrgencyRanking;

    expect(ranking[d1]).toBeDefined();
    expect(ranking[d1].urgencyBand).toBe('LOW');
    expect(ranking[d1].blockedItems.length).toBe(0);
  });

  it('within same urgency band, sorts by demand (higher demand first)', () => {
    const init1 = 'init1';
    const lane1 = 'lane1';
    const lowDemandD = 'low-demand';
    const highDemandD = 'high-demand';
    const d3 = 'd3'; // blocked by both

    baseState.matrix.initiativesById[init1] = {
      id: init1,
      name: 'Initiative 1',
      owningEntityId: 'e1',
      laneId: lane1,
      phase: 'phase1',
      reviewStatus: 'CONFIRMED',
      declaredAtISO: '2026-07-31T00:00:00Z',
      confirmedAt: null,
      confirmedBy: null,
      confirmationSource: null,
    };

    baseState.matrix.projectsById.p1 = {
      id: 'p1',
      name: 'Project 1',
      owningInitiativeId: init1,
      declaredAtISO: '2026-07-31T00:00:00Z',
      confirmedAt: null,
      confirmedBy: null,
      confirmationSource: null,
    };

    // Low demand blocker (both in same band, HIGH)
    baseState.matrix.deliverablesById[lowDemandD] = {
      id: lowDemandD,
      name: 'LOW demand blocker',
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

    // High demand blocker (same HIGH urgency band)
    baseState.matrix.deliverablesById[highDemandD] = {
      id: highDemandD,
      name: 'HIGH demand blocker',
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

    // Item blocked by both
    baseState.matrix.deliverablesById[d3] = {
      id: d3,
      name: 'Blocked item',
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

    // Dependencies
    baseState.matrix.dependenciesById.dep1 = {
      id: 'dep1',
      blockerId: lowDemandD,
      blockedId: d3,
    };

    baseState.matrix.dependenciesById.dep2 = {
      id: 'dep2',
      blockerId: highDemandD,
      blockedId: d3,
    };

    // Add demand blocks
    baseState.planBlocks.b1 = {
      id: 'b1',
      durationMinutes: 60, // 1 hour for low demand blocker
      deliverableId: lowDemandD,
    };

    baseState.planBlocks.b2 = {
      id: 'b2',
      durationMinutes: 300, // 5 hours for high demand blocker
      deliverableId: highDemandD,
    };

    // Lane: 10 days away = HIGH band for both
    baseState.masterPlanLanesById[lane1] = {
      id: lane1,
      laneEnd: '2026-08-10T23:59:59Z',
    };

    const derived = computeDerivedState(baseState, { type: 'INIT' });
    const ranking = derived.deliverableUrgencyRanking;

    // Both should be HIGH urgency
    expect(ranking[lowDemandD].urgencyBand).toBe('HIGH');
    expect(ranking[highDemandD].urgencyBand).toBe('HIGH');

    // But highDemandD should rank first within the band due to higher demand
    expect(ranking[highDemandD].rank).toBeLessThan(ranking[lowDemandD].rank);
    expect(ranking[highDemandD].demandMinutes).toBeGreaterThan(ranking[lowDemandD].demandMinutes);
  });
});
