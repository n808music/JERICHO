import { describe, it, expect } from 'vitest';
import { computeDeliverableDemand, computeAllDeliverableDemands } from '../aimCompute.js';

describe('Deliverable Demand Computation (Task 1)', () => {
  it('computes zero demand for deliverable with no blocks', () => {
    const state = {
      planBlocks: {},
      matrix: {
        deliverablesById: {
          d1: { id: 'd1', name: 'Feature A', owningProjectId: 'p1' },
        },
      },
    };
    const demand = computeDeliverableDemand('d1', state);
    expect(demand).toBe(0);
  });

  it('aggregates block durations for a deliverable', () => {
    const state = {
      planBlocks: {
        b1: { id: 'b1', deliverableId: 'd1', durationMinutes: 60 },
        b2: { id: 'b2', deliverableId: 'd1', durationMinutes: 90 },
        b3: { id: 'b3', deliverableId: 'd2', durationMinutes: 45 },
      },
      matrix: {
        deliverablesById: {
          d1: { id: 'd1', name: 'Feature A', owningProjectId: 'p1' },
          d2: { id: 'd2', name: 'Feature B', owningProjectId: 'p1' },
        },
      },
    };
    const demandD1 = computeDeliverableDemand('d1', state);
    const demandD2 = computeDeliverableDemand('d2', state);
    expect(demandD1).toBe(150); // 60 + 90
    expect(demandD2).toBe(45);
  });

  it('ignores blocks without deliverableId', () => {
    const state = {
      planBlocks: {
        b1: { id: 'b1', deliverableId: 'd1', durationMinutes: 60 },
        b2: { id: 'b2', durationMinutes: 30 }, // no deliverableId
        b3: { id: 'b3', deliverableId: 'd1', durationMinutes: 90 },
      },
      matrix: {
        deliverablesById: {
          d1: { id: 'd1', name: 'Feature A', owningProjectId: 'p1' },
        },
      },
    };
    const demand = computeDeliverableDemand('d1', state);
    expect(demand).toBe(150); // ignores b2
  });

  it('handles blocks with missing durationMinutes', () => {
    const state = {
      planBlocks: {
        b1: { id: 'b1', deliverableId: 'd1', durationMinutes: 60 },
        b2: { id: 'b2', deliverableId: 'd1' }, // no durationMinutes
        b3: { id: 'b3', deliverableId: 'd1', durationMinutes: 90 },
      },
      matrix: {
        deliverablesById: {
          d1: { id: 'd1', name: 'Feature A', owningProjectId: 'p1' },
        },
      },
    };
    const demand = computeDeliverableDemand('d1', state);
    expect(demand).toBe(150); // treats missing duration as 0
  });

  it('computes all deliverable demands at once', () => {
    const state = {
      planBlocks: {
        b1: { id: 'b1', deliverableId: 'd1', durationMinutes: 60 },
        b2: { id: 'b2', deliverableId: 'd2', durationMinutes: 90 },
        b3: { id: 'b3', deliverableId: 'd1', durationMinutes: 45 },
      },
      matrix: {
        deliverablesById: {
          d1: { id: 'd1', name: 'Feature A', owningProjectId: 'p1' },
          d2: { id: 'd2', name: 'Feature B', owningProjectId: 'p1' },
          d3: { id: 'd3', name: 'Feature C', owningProjectId: 'p1' },
        },
      },
    };
    const allDemands = computeAllDeliverableDemands(state);
    expect(allDemands).toEqual({
      d1: 105, // 60 + 45
      d2: 90,
      d3: 0,
    });
  });

  it('returns empty object when no deliverablesById', () => {
    const state = {
      planBlocks: {
        b1: { id: 'b1', deliverableId: 'd1', durationMinutes: 60 },
      },
      matrix: {
        deliverablesById: {},
      },
    };
    const allDemands = computeAllDeliverableDemands(state);
    expect(allDemands).toEqual({});
  });

  it('handles null/undefined state gracefully', () => {
    expect(computeDeliverableDemand('d1', null)).toBe(0);
    expect(computeDeliverableDemand('d1', undefined)).toBe(0);
    expect(computeDeliverableDemand(null, {})).toBe(0);
    expect(computeAllDeliverableDemands(null)).toEqual({});
    expect(computeAllDeliverableDemands(undefined)).toEqual({});
  });
});
