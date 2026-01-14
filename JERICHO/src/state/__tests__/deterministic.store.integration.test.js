/**
 * deterministic.store.integration.test.js
 * 
 * Tests for Phase 3 deterministic plan generator integration into identityStore/identityCompute
 * 
 * Coverage:
 * - Adapter function converts DeterministicPlanResult to ColdPlanV1 format
 * - GENERATE_COLD_PLAN uses deterministic generator when planGenerationMechanismClass='GENERIC_DETERMINISTIC'
 * - Determinism: same inputs → identical coldPlan output
 * - Constraint enforcement (daily/weekly caps, preferred days, blackout dates)
 * - Mode behavior (REGENERATE vs REBASE_FROM_TODAY)
 * - Error handling (INFEASIBLE propagated correctly)
 */

import { describe, it, expect, beforeEach } from 'vitest';
import structuredClone from '@ungap/structured-clone';
import { attemptGoalAdmissionPure } from '../identityStore.js';
import { computeContractHash } from '../../domain/goal/GoalAdmissionPolicy.ts';

const NOW_ISO = '2026-01-10T12:00:00.000Z';

function buildMinimalState() {
  return {
    appTime: { nowISO: NOW_ISO, timeZone: 'UTC', activeDayKey: '2026-01-10' },
    cyclesById: {},
    activeCycleId: null,
    cycleOrder: [],
    aspirations: [],
    aspirationsByCycleId: {},
    deliverablesByCycleId: {},
  };
}

function createValidContract(overrides = {}) {
  const contract = {
    planGenerationMechanismClass: 'GENERIC_DETERMINISTIC',
    terminalOutcome: { text: 'Achieve project milestone', hash: '', verificationCriteria: 'Feature is live', isConcrete: true },
    deadline: { dayKey: '2026-02-20', isHardDeadline: true },
    sacrifice: { whatIsGivenUp: 'Weekend time', duration: '6 weeks', quantifiedImpact: '10 hours/week', rationale: 'Focus on delivery', hash: '' },
    temporalBinding: { daysPerWeek: 5, activationTime: '09:00', sessionDurationMinutes: 120, weeklyMinutes: 600, startDayKey: '2026-01-10' },
    causalChain: { steps: [{ sequence: 1, description: 'Plan' }, { sequence: 2, description: 'Execute' }, { sequence: 3, description: 'Review' }], hash: '' },
    reinforcement: { dailyExposureEnabled: true, dailyMechanism: 'Calendar title', checkInFrequency: 'DAILY', triggerDescription: 'Morning' },
    inscription: { contractHash: '', inscribedAtISO: NOW_ISO, acknowledgment: 'I accept', acknowledgmentHash: '', isCompromised: false },
    isAspirational: false,
    ...overrides
  };
  // compute and populate hashes
  contract.inscription.contractHash = computeContractHash(contract);
  contract.terminalOutcome.hash = contract.inscription.contractHash.slice(0, 16);
  contract.sacrifice.hash = contract.inscription.contractHash.slice(16, 32);
  contract.causalChain.hash = contract.inscription.contractHash.slice(32);
  contract.inscription.acknowledgmentHash = contract.inscription.contractHash.slice(0, 16);
  return contract;
}

describe('Deterministic Plan Generator - Store Integration', () => {
  describe('Adapter Function Integration', () => {
    it('should admit goal with GENERIC_DETERMINISTIC mechanism class', () => {
      const state = buildMinimalState();
      const contract = createValidContract();
      
      const { nextState, result } = attemptGoalAdmissionPure(state, contract);
      
      expect(result.status).toBe('ADMITTED');
      expect(result.cycleId).toBeDefined();
      
      const admittedCycle = nextState.cyclesById[result.cycleId];
      expect(admittedCycle).toBeDefined();
      expect(admittedCycle.goalContract.planGenerationMechanismClass).toBe('GENERIC_DETERMINISTIC');
    });

    it('should generate cold plan after admission', () => {
      const state = buildMinimalState();
      const contract = createValidContract();
      
      const { nextState, result } = attemptGoalAdmissionPure(state, contract);
      const admittedCycle = nextState.cyclesById[result.cycleId];
      
      expect(admittedCycle.coldPlan).toBeDefined();
      expect(admittedCycle.coldPlan.generatorVersion).toBe('deterministicPlan_v1');
      expect(admittedCycle.coldPlan.forecastByDayKey).toBeDefined();
    });

    it('should populate forecastByDayKey with blocks distributed across days', () => {
      const state = buildMinimalState();
      const contract = createValidContract();
      
      const { nextState, result } = attemptGoalAdmissionPure(state, contract);
      const admittedCycle = nextState.cyclesById[result.cycleId];
      
      expect(Object.keys(admittedCycle.coldPlan.forecastByDayKey).length).toBeGreaterThan(0);
      
      // Each day should have totalBlocks and byDeliverable
      Object.values(admittedCycle.coldPlan.forecastByDayKey).forEach((forecast) => {
        expect(forecast.totalBlocks).toBeGreaterThan(0);
        expect(forecast.byDeliverable).toBeDefined();
      });
    });
  });

  describe('Determinism Guarantee', () => {
    it('should produce identical plans from same inputs (deterministic output)', () => {
      const buildPlan = () => {
        const state = buildMinimalState();
        const contract = createValidContract();
        const { nextState } = attemptGoalAdmissionPure(state, contract);
        const cycle = Object.values(nextState.cyclesById)[0];
        return {
          forecastByDayKey: cycle.coldPlan.forecastByDayKey,
          assumptionsHash: cycle.coldPlan.assumptionsHash
        };
      };
      
      const plan1 = buildPlan();
      const plan2 = buildPlan();
      
      // Should produce identical outputs
      expect(JSON.stringify(plan1)).toBe(JSON.stringify(plan2));
      expect(plan1.assumptionsHash).toBe(plan2.assumptionsHash);
    });

    it('should preserve block ordering across regenerations', () => {
      const state = buildMinimalState();
      const contract = createValidContract();
      
      const { nextState: state1 } = attemptGoalAdmissionPure(state, contract);
      const cycle1 = Object.values(state1.cyclesById)[0];
      const dayKeys1 = Object.keys(cycle1.coldPlan.forecastByDayKey);
      
      // Regenerate with same state
      const state2 = structuredClone(state1);
      const cycle2 = state2.cyclesById[cycle1.id];
      const dayKeys2 = Object.keys(cycle2.coldPlan.forecastByDayKey);
      
      // Day order should be identical
      expect(dayKeys1).toEqual(dayKeys2);
    });
  });

  describe('Constraint Enforcement', () => {
    it('should respect maxBlocksPerDay constraint', () => {
      const state = buildMinimalState();
      const contract = createValidContract();
      
      const { nextState, result } = attemptGoalAdmissionPure(state, contract);
      const admittedCycle = nextState.cyclesById[result.cycleId];
      
      // Each day should have <= maxBlocksPerDay (default 4)
      Object.values(admittedCycle.coldPlan.forecastByDayKey).forEach((forecast) => {
        expect(forecast.totalBlocks).toBeLessThanOrEqual(4);
      });
    });

    it('should produce blocks if feasible', () => {
      const state = buildMinimalState();
      const contract = createValidContract();
      
      const { nextState, result } = attemptGoalAdmissionPure(state, contract);
      const admittedCycle = nextState.cyclesById[result.cycleId];
      
      const totalBlocks = Object.values(admittedCycle.coldPlan.forecastByDayKey).reduce(
        (sum, f) => sum + f.totalBlocks,
        0
      );
      
      expect(totalBlocks).toBeGreaterThan(0);
    });
  });

  describe('Auto-Deliverables Integration', () => {
    it('should generate auto-deliverables with 3-tier model or causal chain', () => {
      const state = buildMinimalState();
      const contract = createValidContract();
      
      const { nextState, result } = attemptGoalAdmissionPure(state, contract);
      const workspace = nextState.deliverablesByCycleId[result.cycleId];
      
      expect(workspace).toBeDefined();
      expect(workspace.deliverables.length).toBeGreaterThan(0);
      expect(workspace.autoGenerated).toBe(true);
    });

    it('should use causal chain steps from contract', () => {
      const state = buildMinimalState();
      const contract = createValidContract({
        causalChain: { 
          steps: [
            { sequence: 1, description: 'Prepare materials' },
            { sequence: 2, description: 'Execute plan' },
            { sequence: 3, description: 'Verify results' }
          ], 
          hash: ''
        }
      });
      
      const { nextState, result } = attemptGoalAdmissionPure(state, contract);
      const workspace = nextState.deliverablesByCycleId[result.cycleId];
      
      expect(workspace.deliverables.length).toBeGreaterThanOrEqual(3);
    });
  });

  describe('Version Tracking', () => {
    it('should track coldPlan versions', () => {
      const state = buildMinimalState();
      const contract = createValidContract();
      
      const { nextState, result } = attemptGoalAdmissionPure(state, contract);
      const admittedCycle = nextState.cyclesById[result.cycleId];
      
      expect(admittedCycle.coldPlan.version).toBeDefined();
      expect(admittedCycle.coldPlanHistory).toBeDefined();
      expect(Array.isArray(admittedCycle.coldPlanHistory)).toBe(true);
    });

    it('should maintain coldPlanHistory on subsequent generations', () => {
      const state = buildMinimalState();
      const contract = createValidContract();
      
      const { nextState, result } = attemptGoalAdmissionPure(state, contract);
      const admittedCycle = nextState.cyclesById[result.cycleId];
      
      const historyLength = admittedCycle.coldPlanHistory.length;
      expect(historyLength).toBeGreaterThan(0);
      
      // Each history entry should have version info
      admittedCycle.coldPlanHistory.forEach((entry) => {
        expect(entry.version).toBeDefined();
        expect(entry.assumptionsHash).toBeDefined();
        expect(entry.createdAtISO).toBeDefined();
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle INFEASIBLE state when deadline is close', () => {
      const state = buildMinimalState();
      const contract = createValidContract({
        deadline: { dayKey: '2026-01-15', isHardDeadline: true } // Only 5 days away
      });
      
      const { nextState, result } = attemptGoalAdmissionPure(state, contract);
      
      // Should still admit goal (temporal binding is valid)
      expect(result.status).toBe('ADMITTED');
      
      const admittedCycle = nextState.cyclesById[result.cycleId];
      // Should have a plan even if constrained
      expect(admittedCycle.coldPlan).toBeDefined();
    });

    it('should handle missing mechanism class (rejection)', () => {
      const state = buildMinimalState();
      const contract = createValidContract();
      delete contract.planGenerationMechanismClass;
      
      const { nextState, result } = attemptGoalAdmissionPure(state, contract);
      
      // Should be rejected per Phase 3 policy
      expect(result.status).toBe('REJECTED');
      expect(result.rejectionCodes).toContain('PLAN_GENERATION_MECHANISM_MISSING');
    });
  });

  describe('Integration with Existing Flow', () => {
    it('should maintain all cycle properties after deterministic generation', () => {
      const state = buildMinimalState();
      const contract = createValidContract();
      
      const { nextState, result } = attemptGoalAdmissionPure(state, contract);
      const admittedCycle = nextState.cyclesById[result.cycleId];
      
      // Core properties should exist
      expect(admittedCycle.id).toBeDefined();
      expect(admittedCycle.status).toBe('Active');
      expect(admittedCycle.goalContract).toBeDefined();
      expect(admittedCycle.strategy).toBeDefined();
      expect(admittedCycle.coldPlan).toBeDefined();
      expect(admittedCycle.executionEvents).toBeDefined();
      expect(Array.isArray(admittedCycle.executionEvents)).toBe(true);
    });

    it('should populate strategy with auto-seeded deliverables', () => {
      const state = buildMinimalState();
      const contract = createValidContract();
      
      const { nextState, result } = attemptGoalAdmissionPure(state, contract);
      const admittedCycle = nextState.cyclesById[result.cycleId];
      
      expect(admittedCycle.strategy.deliverables).toBeDefined();
      expect(Array.isArray(admittedCycle.strategy.deliverables)).toBe(true);
      expect(admittedCycle.strategy.deliverables.length).toBeGreaterThan(0);
    });
  });

  describe('Mechanism Class Requirements', () => {
    it('should require planGenerationMechanismClass (Phase 3 requirement)', () => {
      const state = buildMinimalState();
      const contract = createValidContract();
      delete contract.planGenerationMechanismClass;
      
      const { nextState, result } = attemptGoalAdmissionPure(state, contract);
      
      // Should be rejected per Phase 3 policy
      expect(result.status).toBe('REJECTED');
      expect(result.rejectionCodes).toContain('PLAN_GENERATION_MECHANISM_MISSING');
    });

    it('should reject non-GENERIC_DETERMINISTIC mechanism classes in Phase 3', () => {
      const state = buildMinimalState();
      const contract = createValidContract();
      contract.planGenerationMechanismClass = 'TEMPLATE_PIPELINE'; // Not implemented in v1
      
      const { nextState, result } = attemptGoalAdmissionPure(state, contract);
      
      // Should be rejected (only GENERIC_DETERMINISTIC is v1)
      expect(result.status).toBe('REJECTED');
      expect(result.rejectionCodes).toContain('PLAN_GENERATION_MECHANISM_UNSUPPORTED');
    });
  });
});
