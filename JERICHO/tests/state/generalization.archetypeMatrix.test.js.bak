import { describe, expect, it, vi } from 'vitest';
import { computeDerivedState } from '../../src/state/identityCompute.js';
import { callClaudeForActionGraph } from '../../src/state/mockLLMActionGraph.ts';

vi.mock('../../src/state/engine/autoAsanaPlan.ts', () => ({
  compileAutoAsanaPlan: ({ actionSequence = [] }) => ({
    horizonBlocks: actionSequence.slice(0, 4).map((action, index) => {
      const day = String(11 + index).padStart(2, '0');
      return {
        id: `hb-${index + 1}`,
        title: action?.title || `Action ${index + 1}`,
        dayKey: `2026-03-${day}`,
        startISO: `2026-03-${day}T09:00:00.000Z`,
        durationMinutes: Math.max(30, Number(action?.estimateMin || 60)),
      };
    }),
    conflicts: [],
  }),
}));

const ARCHETYPES = [
  {
    id: 'tv_writing',
    executionType: 'GenericStructured',
    goalText: 'Write the first season of my TV show',
    expectedKeywords: ['season', 'episode', 'script'],
    supported: true,
  },
  {
    id: 'venture_launch',
    executionType: 'VentureLaunch',
    goalText: 'Launch my venture and get first users',
    expectedKeywords: ['launch', 'landing', 'customer'],
    supported: true,
  },
  {
    id: 'professional_qualification',
    executionType: 'ProfessionalQualification',
    goalText: 'Pass my certification exam',
    expectedKeywords: ['exam', 'practice', 'study'],
    supported: true,
  },
  {
    id: 'physical_training',
    executionType: 'PhysicalTraining',
    goalText: 'Complete my 12-week physical training cycle',
    expectedKeywords: ['training', 'phase', 'session'],
    supported: true,
  },
  {
    id: 'skill_acquisition_portfolio',
    executionType: 'SkillAcquisition',
    goalText: 'Build a portfolio while learning a new skill',
    expectedKeywords: ['project', 'practice', 'skill'],
    supported: true,
  },
  {
    id: 'job_search_pipeline',
    executionType: 'JobSearchPipeline',
    goalText: 'Run a weekly job search pipeline to land interviews',
    expectedKeywords: ['pipeline', 'applications', 'interviews'],
    supported: true,
  },
];

function buildStateFromActions({ cycleId, goalId, goalText, actions }) {
  const deadlineDayKey = '2026-03-15';
  return {
    appTime: { timeZone: 'UTC', nowISO: '2026-03-10T12:00:00.000Z', activeDayKey: '2026-03-10', isFollowingNow: true },
    today: { date: '2026-03-10', blocks: [] },
    currentWeek: { weekStart: '2026-03-10', days: [] },
    cycle: [],
    vector: {},
    lenses: { aim: {}, pattern: { dailyTargets: [] }, flow: {} },
    executionEvents: [],
    suggestionEvents: [],
    proposedBlocks: [],
    suggestedBlocks: [],
    constraints: {
      maxBlocksPerDay: 2,
      maxBlocksPerWeek: 10,
      maxMinutesPerDay: 120,
      weeklyWindows: {
        MON: [{ startHHMM: '09:00', endHHMM: '11:00' }],
        TUE: [{ startHHMM: '09:00', endHHMM: '11:00' }],
        WED: [{ startHHMM: '09:00', endHHMM: '11:00' }],
        THU: [{ startHHMM: '09:00', endHHMM: '11:00' }],
        FRI: [{ startHHMM: '09:00', endHHMM: '11:00' }],
      },
    },
    goalWorkById: {
      [goalId]: actions.slice(0, 6).map((action, idx) => ({
        workItemId: `work-${idx + 1}`,
        title: action?.title || `Work ${idx + 1}`,
        blocksRemaining: 2,
      })),
    },
    deliverablesByCycleId: {
      [cycleId]: {
        cycleId,
        deliverables: actions.slice(0, 3).map((action, idx) => ({
          id: `d-${idx + 1}`,
          title: action?.title || `Deliverable ${idx + 1}`,
          estimateMin: Number(action?.estimateMin || 60),
        })),
        suggestionLinks: {},
        lastUpdatedAtISO: '2026-03-10T12:00:00.000Z',
      },
    },
    goalAdmissionByGoal: { [goalId]: { status: 'ADMITTED', reasonCodes: [] } },
    cyclesById: {
      [cycleId]: {
        id: cycleId,
        status: 'active',
        goalContract: { goalId, goalText, startDayKey: '2026-03-01', endDayKey: deadlineDayKey },
        goalGovernanceContract: {
          contractId: `gov-${goalId}`,
          version: 1,
          goalId,
          activeFromISO: '2026-03-01',
          activeUntilISO: deadlineDayKey,
          scope: { timezone: 'UTC' },
          governance: { suggestionsEnabled: true, probabilityEnabled: true, minEvidenceEvents: 0 },
        },
        actions: actions.map((action) => ({ ...action })),
        planProof: {},
        metrics: {},
      },
    },
    activeCycleId: cycleId,
    goalExecutionContract: { goalId, startDayKey: '2026-03-01', endDayKey: deadlineDayKey },
    lastPlanError: null,
  };
}

describe('generalization validation matrix by archetype', () => {
  it('classifies archetype compile support vs compile gaps explicitly', async () => {
    let compiledCount = 0;
    for (const archetype of ARCHETYPES) {
      const graph = await callClaudeForActionGraph(
        { executionType: archetype.executionType, goalText: archetype.goalText, goalLabel: archetype.goalText },
        { terminalOutcome: { text: archetype.goalText } },
        archetype.executionType,
        'mock-key'
      );

      if (!graph.ok) {
        // Compile gap should fail honestly with deterministic error code.
        expect(typeof graph.error?.code).toBe('string');
        continue;
      }

      compiledCount += 1;
      if (!archetype.supported) {
        // If a previously unsupported archetype starts compiling, that is acceptable.
        // Keep keyword assertion below as authenticity check.
      }

      const actions = graph.graph?.actions || [];
      const titles = actions.map((action) => String(action?.title || '').toLowerCase()).join(' ');
      const matchedKeywordCount = archetype.expectedKeywords.filter((keyword) => titles.includes(keyword)).length;
      expect(matchedKeywordCount).toBeGreaterThan(0);
    }
    expect(compiledCount).toBe(ARCHETYPES.length);
  }, 20000);

  it('holds universal gate chain for compile-supported archetypes (compile -> generate -> apply -> score -> recovery)', async () => {
    let validatedCount = 0;
    for (const archetype of ARCHETYPES) {
      const graph = await callClaudeForActionGraph(
        { executionType: archetype.executionType, goalText: archetype.goalText, goalLabel: archetype.goalText },
        { terminalOutcome: { text: archetype.goalText } },
        archetype.executionType,
        'mock-key'
      );
      if (!graph.ok) {
        continue;
      }
      const actions = graph.graph?.actions || [];
      if (!actions.length) {
        expect(graph.ok).toBe(false);
        continue;
      }
      validatedCount += 1;

      const cycleId = `cycle-${archetype.id}`;
      const goalId = `goal-${archetype.id}`;
      const state = buildStateFromActions({
        cycleId,
        goalId,
        goalText: archetype.goalText,
        actions,
      });

      const scored = computeDerivedState(state, { type: 'NO_OP' });
      const generated = computeDerivedState(scored, {
        type: 'GENERATE_PLAN',
        payload: { cycleId, source: 'RENEGOTIATION_APPLY' },
      });
      const applied = computeDerivedState(generated, { type: 'APPLY_DRAFT_SCHEDULE', payload: { cycleId } });
      expect((applied.executionEvents || []).filter((event) => event?.kind === 'create')).toHaveLength(0);
      expect(applied.scheduleLifecycle).toBe('applied_review');

      const activated = computeDerivedState(applied, { type: 'ACTIVATE_SCHEDULE', payload: { cycleId } });
      const rescored = computeDerivedState(activated, { type: 'NO_OP' });
      const metrics = rescored.cyclesById?.[cycleId]?.metrics || {};

      expect((generated.proposedBlocks || []).length).toBeGreaterThan(0);
      expect((activated.executionEvents || []).filter((event) => event?.kind === 'create').length).toBeGreaterThan(0);
      expect(
        Number.isFinite(metrics.posScore) ||
          Number.isFinite(metrics.feasibilityScore) ||
          metrics.posUnavailableReasonCode
      ).toBeTruthy();
      expect(typeof metrics.contractFailureState).toBe('string');
      expect(typeof metrics.recoveryState).toBe('string');
      expect(Array.isArray(metrics.renegotiationOptions)).toBe(true);
    }
    expect(validatedCount).toBe(ARCHETYPES.length);
  }, 45000);
});
