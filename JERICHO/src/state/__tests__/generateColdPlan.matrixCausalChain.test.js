/**
 * generateColdPlan.matrixCausalChain.test.js
 *
 * Closes the seam diagnosed 2026-07-13: generateColdPlanForCycle() (GENERATE_COLD_PLAN)
 * only ever fed the deterministic plan generator `cycle.goalContract.execution.causalChainSteps`
 * — a field populated exclusively by the manual CausalChainBuilder UI in the separate Goal
 * Admission flow. Master Grid matrix intake (entities/initiatives/projects/systems,
 * CONFIRMED + Ready=YES) had zero path into it, so any matrix-driven cycle silently fell
 * back to the hardcoded 3-tier default (Planning & Setup / Core Work / Verification &
 * Review) regardless of how much confirmed matrix data existed.
 *
 * These tests exercise the real GENERATE_COLD_PLAN reducer path end to end and assert on
 * the deliverable ids actually scheduled into coldPlan.forecastByDayKey — the generic
 * fallback ids (deliv-planning/deliv-core/deliv-verify) vs. matrix-derived causal ids
 * (deliv-causal-N).
 */

import { describe, it, expect } from 'vitest';
import { computeDerivedState } from '../identityCompute.js';

const NOW_ISO = '2026-01-10T12:00:00.000Z';
const START_DAY_KEY = '2026-01-10';
const DEADLINE_DAY_KEY = '2026-02-08';

function buildState({ matrix = {}, causalChainSteps = undefined } = {}) {
  const cycleId = 'cycle-1';
  const goalContract = {
    planGenerationMechanismClass: 'GENERIC_DETERMINISTIC',
    deadlineDayKey: DEADLINE_DAY_KEY,
  };
  if (causalChainSteps) {
    goalContract.execution = { causalChainSteps };
  }

  return {
    appTime: { nowISO: NOW_ISO, timeZone: 'UTC', activeDayKey: START_DAY_KEY },
    activeCycleId: cycleId,
    cyclesById: {
      [cycleId]: {
        id: cycleId,
        status: 'Active',
        startedAtDayKey: START_DAY_KEY,
        matrixIntakeComplete: true,
        goalContract,
        strategy: {
          strategyId: `strategy-${cycleId}`,
          deliverables: [{ id: 'seed', title: 'Seed', requiredBlocks: 1 }],
          constraints: { maxBlocksPerDay: 4, maxBlocksPerWeek: 16, tz: 'UTC' },
        },
        executionEvents: [],
      },
    },
    cycleOrder: [cycleId],
    aspirations: [],
    aspirationsByCycleId: {},
    deliverablesByCycleId: {},
    matrix,
  };
}

function deliverableIdsScheduled(coldPlan) {
  const ids = new Set();
  Object.values(coldPlan.forecastByDayKey || {}).forEach((forecast) => {
    Object.keys(forecast.byDeliverable || {}).forEach((id) => ids.add(id));
  });
  return ids;
}

function totalBlocksScheduled(coldPlan) {
  return Object.values(coldPlan.forecastByDayKey || {}).reduce((sum, f) => sum + f.totalBlocks, 0);
}

describe('GENERATE_COLD_PLAN — matrix-derived causal chain', () => {
  it('falls back to the generic 3-tier default when the matrix has no CONFIRMED projects (unchanged behavior)', () => {
    const state = buildState({ matrix: {} });
    const next = computeDerivedState(state, { type: 'GENERATE_COLD_PLAN' });
    const coldPlan = next.cyclesById['cycle-1'].coldPlan;

    expect(deliverableIdsScheduled(coldPlan)).toEqual(new Set(['deliv-planning', 'deliv-core', 'deliv-verify']));
    expect(totalBlocksScheduled(coldPlan)).toBe(10); // 2 + 6 + 2
  });

  it('derives schedule steps from CONFIRMED Master Grid matrix projects when no manual causal chain exists', () => {
    const matrix = {
      initiativesById: {
        i1: { id: 'i1', name: 'Ship the Thing', owningEntityId: 'e1', phase: '1', reviewStatus: 'CONFIRMED' },
      },
      projectsById: {
        p1: {
          id: 'p1',
          name: 'Build Core Feature',
          owningEntityId: 'e1',
          owningInitiativeId: 'i1',
          reviewStatus: 'CONFIRMED',
          phase: '1',
        },
        p2: {
          id: 'p2',
          name: 'Ship Beta',
          owningEntityId: 'e1',
          owningInitiativeId: 'i1',
          reviewStatus: 'CONFIRMED',
          phase: '2',
        },
      },
    };
    const state = buildState({ matrix });
    const next = computeDerivedState(state, { type: 'GENERATE_COLD_PLAN' });
    const coldPlan = next.cyclesById['cycle-1'].coldPlan;

    // deliv-causal-1 / deliv-causal-2 come straight out of buildAutoDeliverables(causalChainSteps)
    // in deterministicPlanGenerator.ts, keyed by the causal step's `sequence`.
    expect(deliverableIdsScheduled(coldPlan)).toEqual(new Set(['deliv-causal-1', 'deliv-causal-2']));
    expect(deliverableIdsScheduled(coldPlan)).not.toContain('deliv-planning');
    expect(totalBlocksScheduled(coldPlan)).toBe(2); // one block per confirmed project, not the generic 10
  });

  it('excludes DRAFT/NEEDS_REVIEW matrix projects from the derived chain', () => {
    const matrix = {
      projectsById: {
        pConfirmed: { id: 'pConfirmed', name: 'Confirmed Work', reviewStatus: 'CONFIRMED', phase: '1' },
        pDraft: { id: 'pDraft', name: 'Draft Work', reviewStatus: 'DRAFT', phase: '2' },
        pNeedsReview: { id: 'pNeedsReview', name: 'Needs Review Work', reviewStatus: 'NEEDS_REVIEW', phase: '3' },
      },
    };
    const state = buildState({ matrix });
    const next = computeDerivedState(state, { type: 'GENERATE_COLD_PLAN' });
    const coldPlan = next.cyclesById['cycle-1'].coldPlan;

    expect(deliverableIdsScheduled(coldPlan)).toEqual(new Set(['deliv-causal-1']));
    expect(totalBlocksScheduled(coldPlan)).toBe(1);
  });

  it('a manually authored causal chain (Goal Admission) still takes precedence over the matrix', () => {
    const matrix = {
      projectsById: {
        p1: { id: 'p1', name: 'Matrix Project One', reviewStatus: 'CONFIRMED', phase: '1' },
        p2: { id: 'p2', name: 'Matrix Project Two', reviewStatus: 'CONFIRMED', phase: '2' },
      },
    };
    const state = buildState({
      matrix,
      causalChainSteps: [{ sequence: 1, description: 'Manually authored step' }],
    });
    const next = computeDerivedState(state, { type: 'GENERATE_COLD_PLAN' });
    const coldPlan = next.cyclesById['cycle-1'].coldPlan;

    // Only 1 deliverable scheduled — the manual chain (length 1), not the matrix (length 2).
    expect(deliverableIdsScheduled(coldPlan)).toEqual(new Set(['deliv-causal-1']));
    expect(totalBlocksScheduled(coldPlan)).toBe(1);
  });
});
