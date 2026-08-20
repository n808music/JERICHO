/**
 * Item 4: Completed/Narrative Feed — Acceptance Test Suite
 *
 * Locked Architecture (2026-08-20):
 * - Pure selector: `resolveCompletedNarrative(state, scope)` returns structured NarrativeEntry[]
 * - No new event kinds — `complete` + canonical attestation fields + optional `external_evidence`
 * - Evidence-matching priority: blockId > relatedExecutionEventId (grounds narrative in actual producer)
 * - Aggregation-ready by design (scope filtering, no single-cycle assumption)
 * - Not cached on state; called on-demand (fresh-on-read pattern, Item 1–3 precedent)
 *
 * Test Coverage:
 * 1. Bare `complete` event produces NarrativeEntry
 * 2. Entry without deliverable/criterion is UNLINKED_ACTIVITY (but still included)
 * 3. Attestation triple joined from canonical block (not fabricated when absent)
 * 4. External evidence with matching `relatedExecutionEventId` attaches
 * 5. External evidence with no match leaves `externalEvidence: []`
 * 6. Scoping by cycleId/goalId filters correctly
 * 7. Idempotence: calling twice yields identical result, no state mutation
 * 8. Evidence-matching priority: blockId takes precedence over relatedExecutionEventId
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { resolveCompletedNarrative, NarrativeEntry, CompletedNarrativeResult } from '../../src/core/engine/resolveCompletedNarrative';

// ============================================================================
// Fixtures
// ============================================================================

const TODAY_DAYKEY = '2026-08-20';
const YESTERDAY_DAYKEY = '2026-08-19';
const GOAL_ID = 'goal-narrative-test';
const CYCLE_ID = 'cycle-narrative-test';
const DELIVERABLE_ID = 'deliv-narrative-test';
const ENTITY_ID = 'entity-narrative-test';

function createCompleteEvent(blockId: string, dayKey: string = TODAY_DAYKEY, overrides: any = {}) {
  return {
    id: `evt-complete-${blockId}`,
    blockId,
    kind: 'complete',
    dateISO: dayKey,
    startISO: `${dayKey}T09:00:00.000Z`,
    endISO: `${dayKey}T10:00:00.000Z`,
    status: 'completed',
    completed: true,
    completedAtISO: `${dayKey}T10:15:00.000Z`,
    recordedAtISO: new Date().toISOString(),
    cycleId: CYCLE_ID,
    goalId: GOAL_ID,
    minutes: 60,
    rawLabel: `Block ${blockId}`,
    domain: 'CORE',
    ...overrides,
  };
}

function createCanonicalBlock(blockId: string, dayKey: string = TODAY_DAYKEY, overrides: any = {}) {
  return {
    id: blockId,
    title: `Block ${blockId}`,
    label: `Block ${blockId}`,
    start: `${dayKey}T09:00:00.000Z`,
    end: `${dayKey}T10:00:00.000Z`,
    status: 'completed',
    cycleId: CYCLE_ID,
    goalId: GOAL_ID,
    deliverableId: DELIVERABLE_ID,
    domain: 'CORE',
    // Attestation triple (canonical only, per doctrine)
    target: 'Google Doc',
    verificationSource: 'Shared link verification',
    operatorAttestation: 'Reviewed and approved',
    ...overrides,
  };
}

function createExternalEvidenceEvent(blockId: string, dayKey: string = TODAY_DAYKEY, relatedExecutionEventId?: string) {
  return {
    id: `ext-evidence-${blockId}`,
    kind: 'external_evidence',
    evidenceType: 'artifact_published' as const,
    goalId: GOAL_ID,
    cycleId: CYCLE_ID,
    blockId,
    relatedExecutionEventId,
    dateISO: dayKey,
    recordedAtISO: new Date().toISOString(),
    source: 'user_confirmed' as const,
    confidence: 'high' as const,
    counterparty: 'Stakeholder review',
  };
}

function buildBaseState(overrides: any = {}) {
  return {
    appTime: {
      nowISO: `${TODAY_DAYKEY}T12:00:00.000Z`,
      activeDayKey: TODAY_DAYKEY,
      timeZone: 'UTC',
    },
    today: { date: TODAY_DAYKEY, blocks: [], ...overrides.today },
    executionEvents: [],
    externalEvidenceEvents: [],
    cyclesById: {
      [CYCLE_ID]: {
        id: CYCLE_ID,
        status: 'active',
        goalContract: {
          goalId: GOAL_ID,
          startDayKey: '2026-08-01',
          endDayKey: '2026-09-01',
        },
      },
    },
    goalExecutionContract: {
      goalId: GOAL_ID,
      startDayKey: '2026-08-01',
      endDayKey: '2026-09-01',
    },
    blockStore: {
      blocks: {},
      ...overrides.blockStore,
    },
    ...overrides,
  };
}

// ============================================================================
// Test Suite
// ============================================================================

describe('Item 4: Completed/Narrative Feed', () => {

  // ==========================================================================
  // Part 1: Basic Narrative Entry Creation
  // ==========================================================================

  describe('Part 1: Basic narrative entry creation', () => {

    it('bare complete event produces NarrativeEntry', () => {
      const blockId = 'blk-narrative-1';
      const state = {
        ...buildBaseState(),
        executionEvents: [
          createCompleteEvent(blockId),
        ],
        blockStore: {
          blocks: {
            [blockId]: createCanonicalBlock(blockId),
          },
        },
      };

      const result = resolveCompletedNarrative(state);

      expect(result.entries).toBeDefined();
      expect(result.entries.length).toBe(1);
      expect(result.entries[0].blockId).toBe(blockId);
      expect(result.entries[0].completedAtISO).toBeTruthy();
    });

    it('multiple complete events produce multiple entries', () => {
      const blockIds = ['blk-a', 'blk-b', 'blk-c'];
      const state = {
        ...buildBaseState(),
        executionEvents: blockIds.map(id => createCompleteEvent(id)),
        blockStore: {
          blocks: Object.fromEntries(blockIds.map(id => [id, createCanonicalBlock(id)])),
        },
      };

      const result = resolveCompletedNarrative(state);

      expect(result.entries.length).toBe(3);
      expect(result.completedCount).toBe(3);
    });

    it('incomplete events (completed: false) are excluded', () => {
      const blockId = 'blk-not-complete';
      const state = {
        ...buildBaseState(),
        executionEvents: [
          createCompleteEvent(blockId, TODAY_DAYKEY, { completed: false }),
          createCompleteEvent('blk-actually-complete'),
        ],
        blockStore: {
          blocks: {
            [blockId]: createCanonicalBlock(blockId),
            'blk-actually-complete': createCanonicalBlock('blk-actually-complete'),
          },
        },
      };

      const result = resolveCompletedNarrative(state);

      expect(result.entries.length).toBe(1);
      expect(result.entries[0].blockId).toBe('blk-actually-complete');
    });

  });

  // ==========================================================================
  // Part 2: Attestation Triple (Canonical Block Context)
  // ==========================================================================

  describe('Part 2: Attestation triple (canonical block context)', () => {

    it('attestation triple is joined from canonical block', () => {
      const blockId = 'blk-attested';
      const state = {
        ...buildBaseState(),
        executionEvents: [createCompleteEvent(blockId)],
        blockStore: {
          blocks: {
            [blockId]: createCanonicalBlock(blockId, TODAY_DAYKEY, {
              target: 'Google Docs',
              verificationSource: 'Shared link',
              operatorAttestation: 'Approved by PM',
            }),
          },
        },
      };

      const result = resolveCompletedNarrative(state);
      const entry = result.entries[0];

      expect(entry.target).toBe('Google Docs');
      expect(entry.verificationSource).toBe('Shared link');
      expect(entry.operatorAttestation).toBe('Approved by PM');
    });

    it('missing attestation fields pass through as null/undefined', () => {
      const blockId = 'blk-no-attestation';
      const state = {
        ...buildBaseState(),
        executionEvents: [createCompleteEvent(blockId)],
        blockStore: {
          blocks: {
            [blockId]: createCanonicalBlock(blockId, TODAY_DAYKEY, {
              target: null,
              verificationSource: undefined,
              operatorAttestation: null,
            }),
          },
        },
      };

      const result = resolveCompletedNarrative(state);
      const entry = result.entries[0];

      // Not fabricated, not required
      expect(entry.target).toBe(null);
      expect(entry.verificationSource).toBeUndefined();
      expect(entry.operatorAttestation).toBe(null);
    });

    it('canonical block fields carry through even without blockStore entry', () => {
      const blockId = 'blk-no-canonical';
      const state = {
        ...buildBaseState({
          blockStore: { blocks: {} },  // No entry for this block
        }),
        executionEvents: [createCompleteEvent(blockId)],
      };

      const result = resolveCompletedNarrative(state);
      const entry = result.entries[0];

      // Entry still exists; attestation fields are undefined/null
      expect(entry.blockId).toBe(blockId);
      expect(entry.target).toBeUndefined();
    });

  });

  // ==========================================================================
  // Part 3: Linkage Status (LINKED vs UNLINKED)
  // ==========================================================================

  describe('Part 3: Linkage status', () => {

    it('entry with deliverableId is LINKED_ACTIVITY', () => {
      const blockId = 'blk-linked';
      const state = {
        ...buildBaseState(),
        executionEvents: [createCompleteEvent(blockId, TODAY_DAYKEY, { deliverableId: DELIVERABLE_ID })],
        blockStore: {
          blocks: {
            [blockId]: createCanonicalBlock(blockId, TODAY_DAYKEY, { deliverableId: DELIVERABLE_ID }),
          },
        },
      };

      const result = resolveCompletedNarrative(state);
      const entry = result.entries[0];

      expect(entry.linkageStatus).toBe('LINKED');
      expect(result.linkedCount).toBe(1);
    });

    it('entry with criterionId is LINKED_ACTIVITY', () => {
      const blockId = 'blk-criterion-linked';
      const state = {
        ...buildBaseState(),
        executionEvents: [createCompleteEvent(blockId, TODAY_DAYKEY, { criterionId: 'crit-123' })],
        blockStore: {
          blocks: {
            [blockId]: createCanonicalBlock(blockId, TODAY_DAYKEY, { criterionId: 'crit-123' }),
          },
        },
      };

      const result = resolveCompletedNarrative(state);
      const entry = result.entries[0];

      expect(entry.linkageStatus).toBe('LINKED');
    });

    it('entry without deliverableId/criterionId is UNLINKED_ACTIVITY (but still included)', () => {
      const blockId = 'blk-unlinked';
      const state = {
        ...buildBaseState(),
        executionEvents: [createCompleteEvent(blockId)],
        blockStore: {
          blocks: {
            [blockId]: createCanonicalBlock(blockId, TODAY_DAYKEY, {
              deliverableId: null,
              criterionId: null,
            }),
          },
        },
      };

      const result = resolveCompletedNarrative(state);
      const entry = result.entries[0];

      expect(entry.linkageStatus).toBe('UNLINKED_ACTIVITY');
      expect(result.unlinkedCount).toBe(1);
      expect(result.entries.length).toBe(1);  // Still included!
    });

  });

  // ==========================================================================
  // Part 4: External Evidence Attachment
  // ==========================================================================

  describe('Part 4: External evidence attachment', () => {

    it('external_evidence with matching relatedExecutionEventId attaches', () => {
      const blockId = 'blk-with-evidence';
      const completeEventId = `evt-complete-${blockId}`;
      const state = {
        ...buildBaseState(),
        executionEvents: [
          createCompleteEvent(blockId, TODAY_DAYKEY, { id: completeEventId }),
        ],
        externalEvidenceEvents: [
          createExternalEvidenceEvent(blockId, TODAY_DAYKEY, completeEventId),
        ],
        blockStore: {
          blocks: {
            [blockId]: createCanonicalBlock(blockId),
          },
        },
      };

      const result = resolveCompletedNarrative(state);
      const entry = result.entries[0];

      expect(entry.externalEvidence.length).toBe(1);
      expect(entry.externalEvidence[0].evidenceType).toBe('artifact_published');
    });

    it('blockId priority: matches blockId even if relatedExecutionEventId points elsewhere', () => {
      const blockId = 'blk-priority-test';
      const completeEventId = `evt-complete-${blockId}`;
      const otherEventId = 'evt-other';
      const state = {
        ...buildBaseState(),
        executionEvents: [
          createCompleteEvent(blockId, TODAY_DAYKEY, { id: completeEventId }),
        ],
        externalEvidenceEvents: [
          // Evidence has blockId AND a relatedExecutionEventId pointing to a different event
          {
            ...createExternalEvidenceEvent(blockId, TODAY_DAYKEY, otherEventId),
            relatedExecutionEventId: otherEventId,  // Different event ID
          },
        ],
        blockStore: {
          blocks: {
            [blockId]: createCanonicalBlock(blockId),
          },
        },
      };

      const result = resolveCompletedNarrative(state);
      const entry = result.entries[0];

      // Should still attach because blockId matches (priority)
      expect(entry.externalEvidence.length).toBe(1);
    });

    it('fallback to relatedExecutionEventId when blockId is absent', () => {
      const blockId = 'blk-no-blockid-evidence';
      const completeEventId = `evt-complete-${blockId}`;
      const state = {
        ...buildBaseState(),
        executionEvents: [
          createCompleteEvent(blockId, TODAY_DAYKEY, { id: completeEventId }),
        ],
        externalEvidenceEvents: [
          {
            id: 'ext-evidence-fallback',
            kind: 'external_evidence',
            evidenceType: 'approval_received' as const,
            goalId: GOAL_ID,
            cycleId: CYCLE_ID,
            blockId: null,  // No blockId
            relatedExecutionEventId: completeEventId,  // Use this to match
            dateISO: TODAY_DAYKEY,
            recordedAtISO: new Date().toISOString(),
            source: 'user_confirmed' as const,
            confidence: 'high' as const,
          },
        ],
        blockStore: {
          blocks: {
            [blockId]: createCanonicalBlock(blockId),
          },
        },
      };

      const result = resolveCompletedNarrative(state);
      const entry = result.entries[0];

      expect(entry.externalEvidence.length).toBe(1);
      expect(entry.externalEvidence[0].evidenceType).toBe('approval_received');
    });

    it('external_evidence with no matching link leaves externalEvidence: []', () => {
      const blockId = 'blk-unmatched-evidence';
      const state = {
        ...buildBaseState(),
        executionEvents: [
          createCompleteEvent(blockId),
        ],
        externalEvidenceEvents: [
          createExternalEvidenceEvent('blk-different', TODAY_DAYKEY, 'evt-different'),
        ],
        blockStore: {
          blocks: {
            [blockId]: createCanonicalBlock(blockId),
          },
        },
      };

      const result = resolveCompletedNarrative(state);
      const entry = result.entries[0];

      expect(entry.externalEvidence.length).toBe(0);
    });

  });

  // ==========================================================================
  // Part 5: Scoping (cycleId, goalId, entityId filters)
  // ==========================================================================

  describe('Part 5: Scoping (cycleId/goalId filtering)', () => {

    it('scope by cycleId returns only entries from that cycle', () => {
      const blockA = 'blk-cycle-a';
      const blockB = 'blk-cycle-b';
      const cycleA = 'cycle-a';
      const cycleB = 'cycle-b';
      const state = {
        ...buildBaseState(),
        executionEvents: [
          createCompleteEvent(blockA, TODAY_DAYKEY, { cycleId: cycleA }),
          createCompleteEvent(blockB, TODAY_DAYKEY, { cycleId: cycleB }),
        ],
        blockStore: {
          blocks: {
            [blockA]: createCanonicalBlock(blockA, TODAY_DAYKEY, { cycleId: cycleA }),
            [blockB]: createCanonicalBlock(blockB, TODAY_DAYKEY, { cycleId: cycleB }),
          },
        },
        cyclesById: {
          [cycleA]: { id: cycleA, status: 'active' },
          [cycleB]: { id: cycleB, status: 'active' },
        },
      };

      const resultAll = resolveCompletedNarrative(state);
      const resultCycleA = resolveCompletedNarrative(state, { cycleId: cycleA });

      expect(resultAll.entries.length).toBe(2);
      expect(resultCycleA.entries.length).toBe(1);
      expect(resultCycleA.entries[0].cycleId).toBe(cycleA);
    });

    it('scope by goalId returns only entries from that goal', () => {
      const blockA = 'blk-goal-a';
      const blockB = 'blk-goal-b';
      const goalA = 'goal-a';
      const goalB = 'goal-b';
      const state = {
        ...buildBaseState(),
        executionEvents: [
          createCompleteEvent(blockA, TODAY_DAYKEY, { goalId: goalA }),
          createCompleteEvent(blockB, TODAY_DAYKEY, { goalId: goalB }),
        ],
        blockStore: {
          blocks: {
            [blockA]: createCanonicalBlock(blockA, TODAY_DAYKEY, { goalId: goalA }),
            [blockB]: createCanonicalBlock(blockB, TODAY_DAYKEY, { goalId: goalB }),
          },
        },
      };

      const resultGoalA = resolveCompletedNarrative(state, { goalId: goalA });

      expect(resultGoalA.entries.length).toBe(1);
      expect(resultGoalA.entries[0].goalId).toBe(goalA);
    });

    it('multiple scope filters work together (cycleId AND goalId)', () => {
      const blockA = 'blk-combo-1';
      const blockB = 'blk-combo-2';
      const cycleX = 'cycle-x';
      const goalY = 'goal-y';
      const state = {
        ...buildBaseState(),
        executionEvents: [
          createCompleteEvent(blockA, TODAY_DAYKEY, { cycleId: cycleX, goalId: goalY }),
          createCompleteEvent(blockB, TODAY_DAYKEY, { cycleId: cycleX, goalId: 'goal-other' }),
        ],
        blockStore: {
          blocks: {
            [blockA]: createCanonicalBlock(blockA, TODAY_DAYKEY, { cycleId: cycleX, goalId: goalY }),
            [blockB]: createCanonicalBlock(blockB, TODAY_DAYKEY, { cycleId: cycleX, goalId: 'goal-other' }),
          },
        },
        cyclesById: {
          [cycleX]: { id: cycleX, status: 'active' },
        },
      };

      const result = resolveCompletedNarrative(state, { cycleId: cycleX, goalId: goalY });

      expect(result.entries.length).toBe(1);
      expect(result.entries[0].blockId).toBe(blockA);
    });

  });

  // ==========================================================================
  // Part 6: Idempotence (calling twice yields identical result)
  // ==========================================================================

  describe('Part 6: Idempotence', () => {

    it('calling resolveCompletedNarrative twice returns identical result', () => {
      const blockId = 'blk-idempotent';
      const state = {
        ...buildBaseState(),
        executionEvents: [createCompleteEvent(blockId)],
        blockStore: {
          blocks: {
            [blockId]: createCanonicalBlock(blockId),
          },
        },
      };

      const result1 = resolveCompletedNarrative(state);
      const result2 = resolveCompletedNarrative(state);

      expect(JSON.stringify(result1)).toBe(JSON.stringify(result2));
    });

    it('calling does not mutate state', () => {
      const blockId = 'blk-no-mutation';
      const state = {
        ...buildBaseState(),
        executionEvents: [createCompleteEvent(blockId)],
        blockStore: {
          blocks: {
            [blockId]: createCanonicalBlock(blockId),
          },
        },
      };

      const stateBefore = JSON.stringify(state);
      resolveCompletedNarrative(state);
      const stateAfter = JSON.stringify(state);

      expect(stateBefore).toBe(stateAfter);
    });

  });

  // ==========================================================================
  // Part 7: Aggregation-Ready Design (entityId scope)
  // ==========================================================================

  describe('Part 7: Aggregation-ready design', () => {

    it('scope by entityId filters correctly (aggregation-ready pattern)', () => {
      const blockA = 'blk-entity-a';
      const blockB = 'blk-entity-b';
      const entityA = 'entity-player-1';
      const entityB = 'entity-team-1';
      const state = {
        ...buildBaseState(),
        executionEvents: [
          { ...createCompleteEvent(blockA), entityId: entityA },
          { ...createCompleteEvent(blockB), entityId: entityB },
        ],
        blockStore: {
          blocks: {
            [blockA]: { ...createCanonicalBlock(blockA), entityId: entityA },
            [blockB]: { ...createCanonicalBlock(blockB), entityId: entityB },
          },
        },
      };

      const resultEntityA = resolveCompletedNarrative(state, { entityId: entityA });

      expect(resultEntityA.entries.length).toBe(1);
      expect(resultEntityA.entries[0].blockId).toBe(blockA);
    });

    it('selector handles missing entityId fields gracefully', () => {
      const blockId = 'blk-no-entity';
      const state = {
        ...buildBaseState(),
        executionEvents: [createCompleteEvent(blockId)],  // No entityId
        blockStore: {
          blocks: {
            [blockId]: createCanonicalBlock(blockId),  // No entityId
          },
        },
      };

      const result = resolveCompletedNarrative(state, { entityId: 'some-entity' });

      // Should return empty (no match) rather than crash
      expect(result.entries.length).toBe(0);
    });

  });

});
