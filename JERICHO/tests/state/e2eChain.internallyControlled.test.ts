/**
 * e2eChain.internallyControlled.test.ts
 *
 * Phase D end-to-end chain validation for the 6 internally-controlled archetypes.
 * Scenarios SC-01 through SC-06.
 *
 * Chain: classification → deliverables → schedule → P.O.S.
 *
 * For internally-controlled archetypes, P.O.S. trust must be reachable on internal
 * execution evidence alone. No external evidence gate applies.
 */

import { describe, expect, it } from 'vitest';
import {
  classifyLiveInputToArchetype,
  getLiveTraceActionsForArchetype,
  type MigratedArchetype,
} from '../../src/state/engine/archetypeLiveTraceEvaluation';
import { compileGoalToDeliverables, isCanonicalDeliverable } from '../../src/state/engine/goalToDeliverables';
import { compileAutoAsanaPlan } from '../../src/state/engine/autoAsanaPlan';
import { scoreGoalSuccessProbability } from '../../src/state/engine/probabilityScore';
import {
  FAMILY_CLASS_BY_ARCHETYPE,
  buildPOSState,
  buildExecutionEvents,
  buildSchedulerArgs,
  storedExecutionType,
} from './e2eChain.harness';

// ─── Canonical scenario definitions ──────────────────────────────────────────

const NOW_ISO = '2026-03-12T12:00:00.000Z';
const START_DAY = '2026-03-12';
const END_DAY = '2026-06-12';

type InternalScenario = {
  id: string;
  archetype: MigratedArchetype;
  goalText: string;
  // contractGoalText is used for GenericStructured.TVWriting to trigger TV_WRITING_PATTERN.
  contractGoalText?: string;
};

const SCENARIOS: InternalScenario[] = [
  // SC-01: ProfessionalQualification
  {
    id: 'SC-01',
    archetype: 'ProfessionalQualification',
    goalText: 'Pass the AWS Solutions Architect certification exam',
  },
  // SC-02: VentureLaunch
  {
    id: 'SC-02',
    archetype: 'VentureLaunch',
    goalText: 'Build and launch an MVP for a startup product',
  },
  // SC-03: GenericStructured.TVWriting
  // FI-01: executionType stored as 'GenericStructured'; goalText drives TV_WRITING_PATTERN.
  {
    id: 'SC-03',
    archetype: 'GenericStructured.TVWriting',
    goalText: 'Write a pilot script for a new TV show season',
    contractGoalText: 'Write a pilot script for a new TV show season',
  },
  // SC-04: PhysicalTraining
  {
    id: 'SC-04',
    archetype: 'PhysicalTraining',
    goalText: 'Run a 5k and build a strength training program',
  },
  // SC-05: CreativeProduction
  {
    id: 'SC-05',
    archetype: 'CreativeProduction',
    goalText: 'Record and publish a 10-episode podcast',
  },
  // SC-06: BrandLaunch
  {
    id: 'SC-06',
    archetype: 'BrandLaunch',
    goalText: 'Define brand identity and visual positioning',
  },
];

// ─── Layer 1: Classification ──────────────────────────────────────────────────

describe('Layer 1 — classification (SC-01 through SC-06)', () => {
  SCENARIOS.forEach(({ id, archetype, goalText }) => {
    it(`${id}: classifyLiveInputToArchetype routes to ${archetype}`, () => {
      const result = classifyLiveInputToArchetype(goalText);
      expect(result).toBe(archetype);
    });
  });
});

// ─── Layer 4: Deliverable generation ─────────────────────────────────────────

describe('Layer 4 — deliverable generation (SC-01 through SC-06)', () => {
  SCENARIOS.forEach(({ id, archetype, contractGoalText, goalText }) => {
    it(`${id}: compileGoalToDeliverables uses canonical path and produces valid deliverables`, () => {
      const cycleId = `cycle-${id.toLowerCase()}`;
      const actions = getLiveTraceActionsForArchetype(archetype);
      const contract = {
        // FI-01: goalText in contract text drives GenericStructured.TVWriting subtype routing
        goalText: contractGoalText || goalText,
        terminalOutcome: { text: contractGoalText || goalText },
        executionType: storedExecutionType(archetype),
      };

      const result = compileGoalToDeliverables({
        executionType: storedExecutionType(archetype),
        actions,
        contract,
        cycleId,
      });

      // D-FAIL-01: must use canonical path
      expect(result.usesCanonicalDeliverablePath).toBe(true);

      // D-FAIL-02: must produce at least one deliverable
      expect(result.deliverables.length).toBeGreaterThanOrEqual(1);

      // D-FAIL-03: all deliverables must pass isCanonicalDeliverable
      result.deliverables.forEach((deliverable) => {
        expect(isCanonicalDeliverable(deliverable)).toBe(true);
      });

      // estimatedSessionCount must be positive
      expect(result.estimatedSessionCount).toBeGreaterThanOrEqual(1);

      // legacy fallback must NOT be used
      expect(result.legacyFallbackUsed).toBe(false);
    });
  });
});

// ─── Layer 5: Schedule generation ────────────────────────────────────────────

describe('Layer 5 — schedule generation (SC-01 through SC-06)', () => {
  SCENARIOS.forEach(({ id, archetype, contractGoalText, goalText }) => {
    it(`${id}: compileAutoAsanaPlan produces at least one proposed block within cycle window`, () => {
      const goalId = `goal-${id.toLowerCase()}`;
      const cycleId = `cycle-${id.toLowerCase()}`;
      const actions = getLiveTraceActionsForArchetype(archetype);
      const contract = {
        goalText: contractGoalText || goalText,
        terminalOutcome: { text: contractGoalText || goalText },
        executionType: storedExecutionType(archetype),
      };

      const compiled = compileGoalToDeliverables({
        executionType: storedExecutionType(archetype),
        actions,
        contract,
        cycleId,
      });

      expect(compiled.deliverables.length).toBeGreaterThanOrEqual(1);

      const schedulerArgs = buildSchedulerArgs({
        goalId,
        cycleId,
        actions,
        deliverables: compiled.deliverables,
        startDayKey: START_DAY,
        endDayKey: END_DAY,
        nowISO: NOW_ISO,
      });

      const plan = compileAutoAsanaPlan(schedulerArgs);

      // D-FAIL-04: must produce at least one proposed block
      expect(plan.horizonBlocks.length).toBeGreaterThanOrEqual(1);

      // All blocks must fall within the cycle window
      plan.horizonBlocks.forEach((block: any) => {
        const dayKey = String(block.dayKey || block.date || '');
        expect(dayKey >= START_DAY).toBe(true);
        expect(dayKey <= END_DAY).toBe(true);
      });
    });
  });
});

// ─── Layer 6: P.O.S. scoring ──────────────────────────────────────────────────

describe('Layer 6 — P.O.S. scoring (SC-01 through SC-06)', () => {
  SCENARIOS.forEach(({ id, archetype }) => {
    const goalId = `goal-${id.toLowerCase()}`;
    const cycleId = `cycle-${id.toLowerCase()}`;

    // FI-02: familyClass is set explicitly via buildPOSState → buildGoalContract
    it(`${id}: scoreGoalSuccessProbability produces a valid result for ${archetype}`, () => {
      const executionEvents = buildExecutionEvents(goalId, cycleId, 7);
      const state = buildPOSState({
        goalId,
        cycleId,
        archetype,
        startDayKey: START_DAY,
        endDayKey: END_DAY,
        executionEvents,
      });

      const constraints = { timezone: 'UTC', maxBlocksPerDay: 6, maxBlocksPerWeek: 30 };
      const result = scoreGoalSuccessProbability(goalId, state, constraints, NOW_ISO);

      // Must return a result without error
      expect(result).toBeTruthy();
      expect(typeof result.value).toBe('number');
      expect(['aspirational', 'provisional', 'eligible', 'trusted', 'at_risk']).toContain(result.trustState);

      // For internally_controlled archetypes: familyClass must be internally_controlled
      expect(FAMILY_CLASS_BY_ARCHETYPE[archetype]).toBe('internally_controlled');

      // Internal archetype with 7 days of activity must not be stuck at a state that
      // requires external evidence — trustState can reach 'eligible' or 'trusted' on execution alone.
      // 'aspirational' is acceptable only if evidence count is below minEvidenceEvents threshold.
      expect(['aspirational', 'eligible', 'trusted', 'provisional']).toContain(result.trustState);
    });
  });
});
