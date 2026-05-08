/**
 * e2eChain.externallyMediated.test.ts
 *
 * Phase D end-to-end chain validation for the 3 externally-mediated archetypes.
 * Scenarios SC-07 (JobSearchPipeline), SC-08 (Fundraising), SC-09 (SalesPipeline).
 *
 * Chain: classification → deliverables → schedule → P.O.S. → trust gate (Layer 7)
 *
 * Trust gate (Layer 7) is tested in two passes per scenario:
 *   Pass A: 7 days of internal completion evidence + 0 external evidence → trustState = 'provisional'
 *   Pass B: same internal evidence + 1 qualifying external evidence event → trustState = 'trusted'
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
  QUALIFYING_STAGE_BY_ARCHETYPE,
  buildPOSState,
  buildExecutionEvents,
  buildExternalEvidenceEvent,
  buildSchedulerArgs,
  storedExecutionType,
} from './e2eChain.harness';

// ─── Canonical scenario definitions ──────────────────────────────────────────

const NOW_ISO = '2026-03-20T12:00:00.000Z';
const START_DAY = '2026-03-12';
const END_DAY = '2026-06-12';

type ExternalScenario = {
  id: string;
  archetype: MigratedArchetype;
  goalText: string;
};

const SCENARIOS: ExternalScenario[] = [
  // SC-07: JobSearchPipeline — externally mediated via recruiter_reply
  {
    id: 'SC-07',
    archetype: 'JobSearchPipeline',
    goalText: 'Submit 20 job applications and prepare for PM role interviews',
  },
  // SC-08: Fundraising — externally mediated via investor_reply
  {
    id: 'SC-08',
    archetype: 'Fundraising',
    goalText: 'Raise an angel round with investor deck and diligence data room',
  },
  // SC-09: SalesPipeline — externally mediated via qualified_response
  {
    id: 'SC-09',
    archetype: 'SalesPipeline',
    goalText: 'Build B2B sales pipeline and close service client deals',
  },
];

// ─── Layer 1: Classification ──────────────────────────────────────────────────

describe('Layer 1 — classification (SC-07 through SC-09)', () => {
  SCENARIOS.forEach(({ id, archetype, goalText }) => {
    it(`${id}: classifyLiveInputToArchetype routes to ${archetype}`, () => {
      expect(classifyLiveInputToArchetype(goalText)).toBe(archetype);
    });
  });
});

// ─── Layer 4: Deliverable generation ─────────────────────────────────────────

describe('Layer 4 — deliverable generation (SC-07 through SC-09)', () => {
  SCENARIOS.forEach(({ id, archetype, goalText }) => {
    it(`${id}: compileGoalToDeliverables uses canonical path and produces valid deliverables`, () => {
      const cycleId = `cycle-${id.toLowerCase()}`;
      const actions = getLiveTraceActionsForArchetype(archetype);
      const contract = {
        goalText,
        terminalOutcome: { text: goalText },
        executionType: storedExecutionType(archetype),
      };

      const result = compileGoalToDeliverables({
        executionType: storedExecutionType(archetype),
        actions,
        contract,
        cycleId,
      });

      expect(result.usesCanonicalDeliverablePath).toBe(true);
      expect(result.deliverables.length).toBeGreaterThanOrEqual(1);
      result.deliverables.forEach((deliverable) => {
        expect(isCanonicalDeliverable(deliverable)).toBe(true);
      });
      expect(result.estimatedSessionCount).toBeGreaterThanOrEqual(1);
      expect(result.legacyFallbackUsed).toBe(false);
    });
  });
});

// ─── Layer 5: Schedule generation ────────────────────────────────────────────

describe('Layer 5 — schedule generation (SC-07 through SC-09)', () => {
  SCENARIOS.forEach(({ id, archetype, goalText }) => {
    it(`${id}: compileAutoAsanaPlan produces at least one proposed block within cycle window`, () => {
      const goalId = `goal-${id.toLowerCase()}`;
      const cycleId = `cycle-${id.toLowerCase()}`;
      const actions = getLiveTraceActionsForArchetype(archetype);
      const contract = { goalText, terminalOutcome: { text: goalText }, executionType: storedExecutionType(archetype) };

      const compiled = compileGoalToDeliverables({
        executionType: storedExecutionType(archetype),
        actions,
        contract,
        cycleId,
      });

      const plan = compileAutoAsanaPlan(
        buildSchedulerArgs({
          goalId,
          cycleId,
          actions,
          deliverables: compiled.deliverables,
          startDayKey: START_DAY,
          endDayKey: END_DAY,
          nowISO: NOW_ISO,
        })
      );

      expect(plan.horizonBlocks.length).toBeGreaterThanOrEqual(1);
      plan.horizonBlocks.forEach((block: any) => {
        const dayKey = String(block.dayKey || block.date || '');
        expect(dayKey >= START_DAY).toBe(true);
        expect(dayKey <= END_DAY).toBe(true);
      });
    });
  });
});

// ─── Layer 6+7: P.O.S. trust gate ────────────────────────────────────────────
//
// Pass A: 7 days of internal evidence + 0 external evidence → trustState = 'provisional'
// Pass B: 7 days of internal evidence + 1 qualifying external event → trustState = 'trusted'
//
// D-FAIL-05: trusted without external evidence is a chain failure.
// D-FAIL-06: still provisional after qualifying evidence is a chain failure.

describe('Layer 6+7 — P.O.S. trust gate (SC-07 through SC-09)', () => {
  SCENARIOS.forEach(({ id, archetype }) => {
    const goalId = `goal-${id.toLowerCase()}`;
    const cycleId = `cycle-${id.toLowerCase()}`;
    const constraints = { timezone: 'UTC', maxBlocksPerDay: 6, maxBlocksPerWeek: 30 };

    // FI-03: QUALIFYING_STAGE_BY_ARCHETYPE provides the exact stage name
    const qualifyingStage = QUALIFYING_STAGE_BY_ARCHETYPE[archetype];
    const executionEvents = buildExecutionEvents(goalId, cycleId, 7, '2026-03-13');

    it(`${id} Pass A: trustState = 'provisional' with internal evidence only (D-FAIL-05 guard)`, () => {
      const state = buildPOSState({
        goalId,
        cycleId,
        archetype,
        startDayKey: START_DAY,
        endDayKey: END_DAY,
        executionEvents,
        externalEvidenceEvents: [],
      });

      const result = scoreGoalSuccessProbability(goalId, state, constraints, NOW_ISO);

      // FI-02: familyClass must be externally_mediated for this archetype
      expect(FAMILY_CLASS_BY_ARCHETYPE[archetype]).toBe('externally_mediated');

      // D-FAIL-05: must NOT reach trusted without external evidence
      expect(result.trustState).not.toBe('trusted');
      expect(result.trustState).toBe('provisional');
    });

    it(`${id} Pass B: trustState = 'trusted' after qualifying external evidence event (D-FAIL-06 guard, stage: '${qualifyingStage}')`, () => {
      const externalEvent = buildExternalEvidenceEvent(goalId, cycleId, archetype, '2026-03-19');
      const state = buildPOSState({
        goalId,
        cycleId,
        archetype,
        startDayKey: START_DAY,
        endDayKey: END_DAY,
        executionEvents,
        externalEvidenceEvents: [externalEvent],
      });

      const result = scoreGoalSuccessProbability(goalId, state, constraints, NOW_ISO);

      // D-FAIL-06: must promote to trusted after qualifying evidence
      expect(result.trustState).toBe('trusted');
    });
  });
});
