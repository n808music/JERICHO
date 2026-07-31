import { describe, it, expect } from 'vitest';
import { computeDerivedState } from '../identityCompute.js';

describe('deliverableDemand integration', () => {
  it('computes deliverableDemands in derived state for each deliverable', () => {
    const state = {
      matrix: {
        entitiesById: { e1: { id: 'e1', name: 'Entity 1' } },
        initiativesById: { i1: { id: 'i1', name: 'Initiative 1', owningEntityId: 'e1' } },
        projectsById: { p1: { id: 'p1', name: 'Project 1', owningInitiativeId: 'i1' } },
        deliverablesById: {
          d1: { id: 'd1', name: 'Deliverable 1', owningProjectId: 'p1', owningInitiativeId: 'i1' },
          d2: { id: 'd2', name: 'Deliverable 2', owningProjectId: 'p1', owningInitiativeId: 'i1' },
        },
        artifactsById: {},
        systemsById: {},
      },
      planBlocks: {
        b1: { id: 'b1', durationMinutes: 60, deliverableId: 'd1' },
        b2: { id: 'b2', durationMinutes: 30, deliverableId: 'd1' },
        b3: { id: 'b3', durationMinutes: 45, deliverableId: 'd2' },
        b4: { id: 'b4', durationMinutes: 20 }, // no deliverableId
      },
    };

    const derived = computeDerivedState(state, { type: 'INIT' });

    expect(derived.deliverableDemands).toBeDefined();
    expect(derived.deliverableDemands.d1).toBe(90); // 60 + 30
    expect(derived.deliverableDemands.d2).toBe(45); // 45
  });

  it('handles empty deliverables', () => {
    const state = {
      matrix: {
        entitiesById: {},
        initiativesById: {},
        projectsById: {},
        deliverablesById: {},
        artifactsById: {},
        systemsById: {},
      },
      planBlocks: {},
    };

    const derived = computeDerivedState(state, { type: 'INIT' });

    expect(derived.deliverableDemands).toBeDefined();
    expect(Object.keys(derived.deliverableDemands).length).toBe(0);
  });

  it('updates deliverableDemands when blocks are added', () => {
    const state = {
      matrix: {
        entitiesById: { e1: { id: 'e1', name: 'Entity 1' } },
        initiativesById: { i1: { id: 'i1', name: 'Initiative 1', owningEntityId: 'e1' } },
        projectsById: { p1: { id: 'p1', name: 'Project 1', owningInitiativeId: 'i1' } },
        deliverablesById: {
          d1: { id: 'd1', name: 'Deliverable 1', owningProjectId: 'p1', owningInitiativeId: 'i1' },
        },
        artifactsById: {},
        systemsById: {},
      },
      planBlocks: {
        b1: { id: 'b1', durationMinutes: 60, deliverableId: 'd1' },
      },
    };

    let derived = computeDerivedState(state, { type: 'INIT' });
    expect(derived.deliverableDemands.d1).toBe(60);

    // Add another block
    derived.planBlocks.b2 = { id: 'b2', durationMinutes: 40, deliverableId: 'd1' };
    derived = computeDerivedState(derived, { type: 'ADD_BLOCK' });

    expect(derived.deliverableDemands.d1).toBe(100); // 60 + 40
  });
});
