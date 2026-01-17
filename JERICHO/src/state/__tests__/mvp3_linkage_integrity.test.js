import { describe, it, expect } from 'vitest';
import { computeDerivedState } from '../identityCompute.js';
import { buildLocalStartISO } from '../time/time.ts';
import { buildExecutionEventFromBlock, computeLinkageStatus } from '../engine/todayAuthority.ts';

const FIXED_DAY = '2026-01-08';

function buildBaseState() {
  return {
    vector: { day: 1, direction: '', stability: 'steady', drift: 'contained', momentum: 'active' },
    lenses: {
      aim: { description: '', horizon: '90d', narrative: '' },
      pattern: { routines: { Body: [], Resources: [], Creation: [], Focus: [] }, dailyTargets: [], defaultMinutes: 30 },
      flow: { streams: [] }
    },
    today: { date: FIXED_DAY, blocks: [], completionRate: 0, driftSignal: 'contained', loadByPractice: {}, practices: [] },
    currentWeek: { weekStart: FIXED_DAY, days: [], metrics: {} },
    cycle: [],
    viewDate: FIXED_DAY,
    templates: { objectives: {} },
    lastAdaptedDate: null,
    stability: { headline: '', actionLine: '' },
    meta: {
      version: '1.0.0',
      onboardingComplete: false,
      lastActiveDate: FIXED_DAY,
      scenarioLabel: '',
      demoScenarioEnabled: false,
      showHints: false
    },
    recurringPatterns: [],
    lastSessionChange: null,
    nextSuggestion: null,
    executionEvents: [],
    ledger: [],
    appTime: {
      timeZone: 'UTC',
      nowISO: `${FIXED_DAY}T12:00:00.000Z`,
      activeDayKey: FIXED_DAY,
      isFollowingNow: true
    }
  };
}

describe('MVP 3.0 Linkage Integrity (Model B: Soft Allow + Hard Truth)', () => {
  describe('linkageStatus computation', () => {
    it('marked as LINKED when deliverableId present', () => {
      const status = computeLinkageStatus({ deliverableId: 'deliv-1', criterionId: null });
      expect(status).toBe('LINKED');
    });

    it('marked as LINKED when criterionId present', () => {
      const status = computeLinkageStatus({ deliverableId: null, criterionId: 'crit-1' });
      expect(status).toBe('LINKED');
    });

    it('marked as UNLINKED_ACTIVITY when neither present', () => {
      const status = computeLinkageStatus({ deliverableId: null, criterionId: null });
      expect(status).toBe('UNLINKED_ACTIVITY');
    });
  });

  describe('manual_block_without_admission_marked_unlinked', () => {
    it('manual block created without goal admission still gets created but marked UNLINKED_ACTIVITY', () => {
      const base = buildBaseState();
      // No onboarding, no admission
      const startISO = buildLocalStartISO(FIXED_DAY, '09:00', 'UTC').startISO;
      const withBlock = computeDerivedState(base, {
        type: 'CREATE_BLOCK',
        payload: {
          start: startISO,
          durationMinutes: 30,
          domain: 'FOCUS',
          title: 'No Admission Block',
          timeZone: 'UTC',
          linkToGoal: false
        }
      });

      const block = withBlock.today.blocks[0];
      expect(block).toBeTruthy();

      const event = buildExecutionEventFromBlock(block, {
        completed: false,
        kind: 'create',
        dateISO: FIXED_DAY,
        minutes: 30
      });

      expect(event.linkageStatus).toBe('UNLINKED_ACTIVITY');
    });
  });

  describe('accepted_suggestion_without_linkage_marked_unlinked', () => {
    it('accepted suggestion without criterion linkage is marked UNLINKED_ACTIVITY', () => {
      const base = buildBaseState();
      const onboarded = computeDerivedState(base, {
        type: 'COMPLETE_ONBOARDING',
        onboarding: {
          direction: 'Goal X',
          goalText: 'Goal X',
          horizon: '30d',
          narrative: '',
          focusAreas: ['Creation'],
          successDefinition: 'Ship X',
          minimumDaysPerWeek: 4
        }
      });

      const suggestions = onboarded.suggestedBlocks || [];
      const firstSuggestion = suggestions.find((s) => s.status === 'suggested');
      expect(firstSuggestion).toBeTruthy();

      // Accept it (suggestions may have deliverable linkage or not)
      const accepted = computeDerivedState(onboarded, {
        type: 'ACCEPT_SUGGESTED_BLOCK',
        proposalId: firstSuggestion.id
      });

      // Find the created event
      const createEvent = (accepted.executionEvents || []).find(
        (e) => e.kind === 'create' && e.suggestionId === firstSuggestion.id
      );
      expect(createEvent).toBeTruthy();

      // If suggestion had no deliverable linkage, event should be UNLINKED_ACTIVITY
      if (!firstSuggestion.deliverableId && !firstSuggestion.criterionId) {
        expect(createEvent.linkageStatus).toBe('UNLINKED_ACTIVITY');
      }
    });
  });

  describe('unlinked_activity_excluded_from_convergence', () => {
    it('unlinked completed blocks do not contribute to E_end units', () => {
      const base = buildBaseState();
      const onboarded = computeDerivedState(base, {
        type: 'COMPLETE_ONBOARDING',
        onboarding: {
          direction: 'Goal Y',
          goalText: 'Goal Y',
          horizon: '30d',
          narrative: '',
          focusAreas: ['Creation'],
          successDefinition: 'Ship Y',
          minimumDaysPerWeek: 4
        }
      });

      const cycleId = onboarded.activeCycleId;

      // Create deliverable requiring 1 block
      const withDeliv = computeDerivedState(onboarded, {
        type: 'CREATE_DELIVERABLE',
        payload: {
          cycleId,
          title: 'Y Deliverable',
          requiredBlocks: 1
        }
      });

      // Create and complete UNLINKED block
      const startISO = buildLocalStartISO(FIXED_DAY, '09:00', 'UTC').startISO;
      const withUnlinked = computeDerivedState(withDeliv, {
        type: 'CREATE_BLOCK',
        payload: {
          start: startISO,
          durationMinutes: 30,
          domain: 'FOCUS',
          title: 'Unlinked',
          timeZone: 'UTC',
          linkToGoal: false
        }
      });

      const block = withUnlinked.today.blocks[0];
      const completeEvent = buildExecutionEventFromBlock(block, {
        completed: true,
        kind: 'complete',
        dateISO: FIXED_DAY,
        minutes: 30
        // NO deliverableId or criterionId
      });

      const withComplete = {
        ...withUnlinked,
        executionEvents: [...(withUnlinked.executionEvents || []), completeEvent],
        cyclesById: {
          ...withUnlinked.cyclesById,
          [cycleId]: {
            ...withUnlinked.cyclesById[cycleId],
            executionEvents: [...(withUnlinked.executionEvents || []), completeEvent]
          }
        }
      };

      const ended = computeDerivedState(withComplete, { type: 'END_CYCLE', cycleId });
      const cycle = ended.cyclesById[cycleId];

      // Verify: unlinked activity counted separately
      expect(cycle.convergenceReport.E_end.completedUnits).toBe(0); // Unlinked doesn't count
      expect(cycle.convergenceReport.E_end.unlinkedActivityBlocks).toBe(1); // But tracked
      expect(cycle.convergenceReport.verdict).toBe('INCOMPLETE'); // Goal not met
    });
  });

  describe('linked_activity_counts_toward_convergence', () => {
    it('linked completed blocks DO contribute to E_end units', () => {
      const base = buildBaseState();
      const onboarded = computeDerivedState(base, {
        type: 'COMPLETE_ONBOARDING',
        onboarding: {
          direction: 'Goal Z',
          goalText: 'Goal Z',
          horizon: '30d',
          narrative: '',
          focusAreas: ['Creation'],
          successDefinition: 'Ship Z',
          minimumDaysPerWeek: 4
        }
      });

      const cycleId = onboarded.activeCycleId;

      // Create deliverable
      const withDeliv = computeDerivedState(onboarded, {
        type: 'CREATE_DELIVERABLE',
        payload: {
          cycleId,
          title: 'Z Deliverable',
          requiredBlocks: 1
        }
      });

      // Create and complete LINKED block
      const startISO = buildLocalStartISO(FIXED_DAY, '09:00', 'UTC').startISO;
      const withLinked = computeDerivedState(withDeliv, {
        type: 'CREATE_BLOCK',
        payload: {
          start: startISO,
          durationMinutes: 30,
          domain: 'FOCUS',
          title: 'Linked',
          timeZone: 'UTC',
          linkToGoal: true
        }
      });

      const block = withLinked.today.blocks[0];
      const delivId = (withLinked.deliverablesByCycleId?.[cycleId] || [])[0]?.id || null;
      const completeEvent = buildExecutionEventFromBlock(block, {
        completed: true,
        kind: 'complete',
        dateISO: FIXED_DAY,
        minutes: 30,
        deliverableId: delivId
      });

      const withComplete = {
        ...withLinked,
        executionEvents: [...(withLinked.executionEvents || []), completeEvent],
        cyclesById: {
          ...withLinked.cyclesById,
          [cycleId]: {
            ...withLinked.cyclesById[cycleId],
            executionEvents: [...(withLinked.executionEvents || []), completeEvent]
          }
        }
      };

      const ended = computeDerivedState(withComplete, { type: 'END_CYCLE', cycleId });
      const cycle = ended.cyclesById[cycleId];

      // Verify: linked activity counts toward convergence
      expect(cycle.convergenceReport.E_end.completedUnits).toBe(1);
      expect(cycle.convergenceReport.verdict).toBe('CONVERGED');
    });
  });
});
