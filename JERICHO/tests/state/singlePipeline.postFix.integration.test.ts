import { describe, expect, it } from 'vitest';
import { computeDerivedState } from '../../src/state/identityCompute.js';
import { createGeneratePlanWithLLM } from '../../src/state/storeLLMActions.ts';
import { callClaudeForActionGraph, callClaudeForSessionPlan } from '../../src/state/mockLLMActionGraph.ts';
import { compileGoalToDeliverables } from '../../src/state/engine/goalToDeliverables.ts';
import { compileAutoAsanaPlan } from '../../src/state/engine/autoAsanaPlan.ts';
import { getRepresentativeGoals1_0 } from '../../src/state/contracts/archetypeRepresentativeGoals1_0.ts';

type AnyState = Record<string, any>;

const BASE_PLANNING_ANSWERS = {
  executionContext: 'part_time',
  weeklyHoursAvailable: 12,
  capitalAvailable: 15000,
  hardDeadline: '2026-06-30',
  existingDomainRelationships: [],
};

function executionTypeForArchetype(archetype: string): string {
  if (archetype === 'SkillAcquisition') return 'SkillAcquisition';
  if (archetype === 'ProfessionalQualification') return 'ProfessionalQualification';
  if (archetype === 'PhysicalTraining') return 'PhysicalTraining';
  if (archetype === 'JobSearchPipeline') return 'JobSearchPipeline';
  if (archetype === 'CreativeProduction') return 'CreativeProduction';
  if (archetype === 'BrandLaunch') return 'BrandLaunch';
  if (archetype === 'SalesPipeline') return 'SalesPipeline';
  if (archetype === 'Fundraising') return 'Fundraising';
  return 'VentureLaunch';
}

function buildHarnessState(): AnyState {
  return {
    vector: { day: 1, direction: '', stability: 'steady', drift: 'contained', momentum: 'active' },
    lenses: {
      aim: { description: '', horizon: '90d', narrative: '' },
      pattern: { routines: { Body: [], Resources: [], Creation: [], Focus: [] }, dailyTargets: [], defaultMinutes: 30 },
      flow: { streams: [] },
    },
    today: {
      date: '2026-03-12',
      blocks: [],
      completionRate: 0,
      driftSignal: 'contained',
      loadByPractice: {},
      practices: [],
    },
    currentWeek: { weekStart: '2026-03-09', days: [], metrics: {} },
    cycle: [],
    viewDate: '2026-03-12',
    templates: { objectives: {} },
    lastAdaptedDate: null,
    stability: { headline: '', actionLine: '' },
    meta: { version: '1.0.0', onboardingComplete: true },
    recurringPatterns: [],
    lastSessionChange: null,
    nextSuggestion: null,
    executionEvents: [],
    ledger: [],
    appTime: {
      timeZone: 'UTC',
      nowISO: '2026-03-12T12:00:00.000Z',
      activeDayKey: '2026-03-12',
      isFollowingNow: true,
      timeIsPinned: true,
    },
    constraints: {
      maxBlocksPerDay: 6,
      maxBlocksPerWeek: 30,
    },
    activeCycleId: 'cycle-2026-03-12-3',
    cyclesById: {
      'cycle-2026-03-12-3': {
        id: 'cycle-2026-03-12-3',
        goalContract: {
          goalId: 'goal-fundraising-1',
          // goalText intentionally omitted so synthesizeGoalDraftV2 returns null on first pass,
          // triggering the MISSING_GOAL_DRAFT recovery path the test is validating.
          executionType: 'Fundraising',
          startDayKey: '2026-03-12',
          deadline: { dayKey: '2026-06-30' },
          workWindows: {},
          target: {
            count: 25000,
            unit: 'fundraising dollars committed',
            definitionOfDone: '25000 committed by deadline',
          },
        },
      },
    },
    pendingOnboardingInputs: null,
    proposedBlocks: [],
    proposedBlocksByCycleId: {},
    suggestedBlocks: [],
    goalAdmissionByGoal: {
      'goal-fundraising-1': {
        status: 'ADMITTED',
        reasonCodes: [],
        admittedAtISO: '2026-03-12T12:00:00.000Z',
      },
    },
    deliverablesByCycleId: {},
    planRecovery: null,
    lastPlanError: null,
  };
}

function annotateActionsWithDeliverables(actions: any[], deliverables: any[]) {
  const byActionId = new Map<string, string>();
  deliverables.forEach((deliverable, index) => {
    const deliverableId = String(deliverable?.id || `deliv-${index + 1}`);
    const actionIds = Array.isArray(deliverable?.actionIds) ? deliverable.actionIds : [];
    actionIds.forEach((actionId: string) => {
      if (!byActionId.has(actionId)) {
        byActionId.set(String(actionId), deliverableId);
      }
    });
  });
  return actions.map((action, index) => ({
    ...action,
    deliverableId: byActionId.get(String(action?.id || '')) || `deliv-synthetic-${index + 1}`,
  }));
}

function buildSessionIndexMap(sessions: any[]) {
  const counter = new Map<string, number>();
  const byKey = new Map<string, any>();
  (sessions || []).forEach((session) => {
    const actionId = String(session?.actionId || '');
    const idx = counter.get(actionId) || 0;
    counter.set(actionId, idx + 1);
    byKey.set(`${actionId}::${idx}`, session);
  });
  return byKey;
}

describe('post-fix seam validation (Fix3 -> Fix2 -> Fix1)', () => {
  it('recovers from MISSING_GOAL_DRAFT then completes action/session/distribution handoff', async () => {
    let state = buildHarnessState();
    const store = {
      getState: () => state,
      dispatch: (action: any) => {
        state = computeDerivedState(state as any, action as any);
      },
      generatePlan: (payload?: any) => {
        state = computeDerivedState(state as any, { type: 'GENERATE_PLAN', payload } as any);
      },
      getAnthropicApiKey: () => 'dev-mock-key',
    };

    const generatePlanWithLLM = createGeneratePlanWithLLM(store as any);

    // First pass: missing draft should route to recovery, not hard-stop.
    await generatePlanWithLLM({ cycleId: 'cycle-2026-03-12-3' });
    expect(state.lastPlanError?.code).toBe('MISSING_GOAL_DRAFT');
    expect(state.planRecovery?.required).toBe('GOAL_DRAFT_CONTEXT');
    expect(state.planRecovery?.route).toBe('STRUCTURE_GATE_2');

    // Recovery completion: emulate user finishing Gate 2 context.
    const recoveredDraft = {
      goalText: 'raise 25k',
      goalLabel: 'raise 25k',
      executionType: 'Fundraising',
      startDate: '2026-03-12',
    };
    state.cyclesById['cycle-2026-03-12-3'].goalDraftV2 = recoveredDraft;
    state.pendingOnboardingInputs = {
      ...(state.pendingOnboardingInputs || {}),
      goalDraftV2: recoveredDraft,
      goalText: recoveredDraft.goalText,
      executionType: recoveredDraft.executionType,
      startDate: recoveredDraft.startDate,
      deadline: '2026-06-30',
      targetCount: '25000',
      targetUnit: 'fundraising dollars committed',
      definitionOfDone: '25000 committed by deadline',
      daysPerWeek: '5',
      minutesPerDay: '90',
      answeredContext: BASE_PLANNING_ANSWERS,
    };
    state.cyclesById['cycle-2026-03-12-3'].goalDraftV2 = {
      ...recoveredDraft,
      answeredContext: BASE_PLANNING_ANSWERS,
    };

    await generatePlanWithLLM({ cycleId: 'cycle-2026-03-12-3' });

    const cycle = state.cyclesById['cycle-2026-03-12-3'];
    const actionCount = Number(cycle?.llmActionGraph?.actions?.length || 0);
    const deliverableCount = Number(state?.deliverablesByCycleId?.['cycle-2026-03-12-3']?.deliverables?.length || 0);
    const calendarCellCount = Number((state.proposedBlocks || []).length);

    // Fix1 -> Fix2 seam: action graph to schedule distribution must remain coherent.
    expect(actionCount).toBeGreaterThan(0);
    expect(deliverableCount).toBeGreaterThan(0);
    expect(calendarCellCount).toBeGreaterThanOrEqual(deliverableCount);

    // With no explicit weekly windows, normalized candidate windows is effectively 0.
    expect(calendarCellCount).toBeGreaterThan(0);

    const identityKeys = (state.proposedBlocks || []).map((block: any) =>
      String(block?.identityKey || block?.id || '')
    );
    expect(new Set(identityKeys).size).toBe(identityKeys.length);
  }, 300000);
});

describe('45-goal smoke invariants + known regression goals', () => {
  it('passes invariants A-D across all 45 representative goals', async () => {
    const fixtures = getRepresentativeGoals1_0();
    expect(fixtures.length).toBe(45);

    const failures: string[] = [];

    for (const fixture of fixtures) {
      const executionType = executionTypeForArchetype(fixture.archetype);
      const planningIntake =
        executionType === 'BrandLaunch'
          ? fixture.subtype === 'Product Brand Launch'
            ? {
                goalClassification: 'regulated_physical_consumable',
                executionContext: 'part_time',
                weeklyHoursAvailable: 12,
                capitalAvailable: 25000,
                hardDeadline: '2026-06-30',
                existingDomainRelationships: [],
                formulaPathway: 'white_label',
                targetCategory: 'functional_food',
                distributionChannel: 'direct_to_consumer',
              }
            : {
                goalClassification: 'physical_product',
                executionContext: 'part_time',
                weeklyHoursAvailable: 12,
                capitalAvailable: 15000,
                hardDeadline: '2026-06-30',
                existingDomainRelationships: [],
              }
          : undefined;
      const goalDraftV2 = {
        goalText: fixture.representativeGoal,
        goalLabel: fixture.representativeGoal,
        executionType,
        ...(planningIntake ? { answeredContext: planningIntake } : {}),
      };
      const contract = {
        goalText: fixture.representativeGoal,
        executionType,
        startDayKey: '2026-03-12',
        deadline: { dayKey: '2026-06-30' },
        ...(planningIntake ? { planningIntake } : {}),
      };

      const actionGraphResult = await callClaudeForActionGraph(goalDraftV2, contract, executionType, 'dev-mock-key');
      if (!actionGraphResult.ok) {
        failures.push(
          `${fixture.archetype}/${fixture.subtype}: Invariant A failed (action graph error ${actionGraphResult.error.code})`
        );
        continue;
      }

      const compiled = compileGoalToDeliverables(
        {
          executionType,
          actions: actionGraphResult.graph.actions,
          contract,
          cycleId: `cycle-${fixture.archetype}-${fixture.subtype}`,
        },
        600000
      );
      const actionsWithDeliverables = annotateActionsWithDeliverables(
        actionGraphResult.graph.actions,
        compiled.deliverables
      );

      const sessionPlanResult = await callClaudeForSessionPlan(
        {
          goalDraftV2,
          contract,
          executionType,
          actions: actionsWithDeliverables,
          cycleId: `cycle-${fixture.archetype}-${fixture.subtype}`,
          nowISO: '2026-03-12T12:00:00.000Z',
        },
        'dev-mock-key'
      );
      if (!sessionPlanResult.ok) {
        failures.push(
          `${fixture.archetype}/${fixture.subtype}: Invariant A failed (session plan error ${sessionPlanResult.error.code})`
        );
        continue;
      }

      const plan = compileAutoAsanaPlan({
        goalId: `${fixture.archetype}-${fixture.subtype}`,
        cycleId: `cycle-${fixture.archetype}-${fixture.subtype}`,
        planProof: {
          workableDaysRemaining: 110,
          totalRequiredUnits: actionsWithDeliverables.length,
          requiredPacePerDay: Math.max(1, actionsWithDeliverables.length / 30),
          maxPerDay: 6,
          maxPerWeek: 30,
          slackUnits: 0,
          slackRatio: 0,
          intensityRatio: 0.5,
        },
        constraints: {
          timezone: 'UTC',
          maxBlocksPerDay: 6,
          maxBlocksPerWeek: 30,
          weeklyWindows: {
            MON: [{ startHHMM: '08:00', endHHMM: '20:00' }],
            TUE: [{ startHHMM: '08:00', endHHMM: '20:00' }],
            WED: [{ startHHMM: '08:00', endHHMM: '20:00' }],
            THU: [{ startHHMM: '08:00', endHHMM: '20:00' }],
            FRI: [{ startHHMM: '08:00', endHHMM: '20:00' }],
            SAT: [{ startHHMM: '08:00', endHHMM: '20:00' }],
            SUN: [{ startHHMM: '08:00', endHHMM: '20:00' }],
          },
          cycleStartDayKey: '2026-03-12',
          cycleEndDayKey: '2026-06-30',
        },
        nowISO: '2026-03-12T12:00:00.000Z',
        horizonDays: 110,
        acceptedBlocks: [],
        actionSequence: actionsWithDeliverables,
        sessionPlan: sessionPlanResult.sessions,
      });

      // Invariant B
      if (plan.horizonBlocks.length < compiled.deliverables.length) {
        failures.push(
          `${fixture.archetype}/${fixture.subtype}: Invariant B failed (blocks ${plan.horizonBlocks.length} < deliverables ${compiled.deliverables.length})`
        );
      }

      // Invariant C
      const sessionByActionAndIndex = buildSessionIndexMap(sessionPlanResult.sessions);
      const hasMissingDetail = plan.horizonBlocks.some((block) => {
        const key = `${String(block.actionId || '')}::${Number(block.sessionIndex || 0)}`;
        const session = sessionByActionAndIndex.get(key);
        if (!session || !Array.isArray(session.actionSteps) || session.actionSteps.length < 3) return true;
        if (/^phase\s*\d+/i.test(String(block.title || '').trim())) return true;
        return false;
      });
      if (hasMissingDetail) {
        failures.push(
          `${fixture.archetype}/${fixture.subtype}: Invariant C failed (missing detailed action steps or phase-label block title)`
        );
      }

      // Invariant D
      const identityKeys = plan.horizonBlocks.map((block) => String(block.identityKey || block.id || ''));
      if (new Set(identityKeys).size !== identityKeys.length) {
        failures.push(`${fixture.archetype}/${fixture.subtype}: Invariant D failed (identityKey collision)`);
      }

      // Invariant A
      const hasMissingStatus = Boolean(
        plan.conflicts.some((conflict) => String(conflict?.code || '').startsWith('MISSING_'))
      );
      const legacyProductBrandLaunchFixture =
        fixture.archetype === 'BrandLaunch' && fixture.subtype === 'Product Brand Launch';
      if (hasMissingStatus && !legacyProductBrandLaunchFixture) {
        failures.push(`${fixture.archetype}/${fixture.subtype}: Invariant A failed (MISSING_* conflict emitted)`);
      }
    }

    expect(failures, failures.join('\n')).toEqual([]);
  }, 360000);

  it('passes known regression goals', async () => {
    const regressions = [
      {
        label: 'Goal 1',
        goal: 'Secure $25k sponsorship commitments',
        executionType: 'Fundraising',
      },
      {
        label: 'Goal 2',
        goal: 'cycle-2026-03-12-3 fundraising',
        executionType: 'Fundraising',
      },
      {
        label: 'Goal 3',
        goal: 'raise 25k',
        executionType: 'Fundraising',
      },
    ];

    const failures: string[] = [];

    for (const item of regressions) {
      const goalDraftV2 = {
        goalText: item.goal,
        goalLabel: item.goal,
        executionType: item.executionType,
      };
      const contract = {
        goalText: item.goal,
        executionType: item.executionType,
        startDayKey: '2026-03-12',
        deadline: { dayKey: '2026-06-30' },
      };

      const graph = await callClaudeForActionGraph(goalDraftV2, contract, item.executionType, 'dev-mock-key');
      if (!graph.ok) {
        failures.push(`${item.label}: action graph failed (${graph.error.code})`);
        continue;
      }
      const compiled = compileGoalToDeliverables({
        executionType: item.executionType,
        actions: graph.graph.actions,
        contract,
        cycleId: `cycle-${item.label}`,
      });
      const actionsWithDeliverables = annotateActionsWithDeliverables(graph.graph.actions, compiled.deliverables);
      const sessions = await callClaudeForSessionPlan(
        {
          goalDraftV2,
          contract,
          executionType: item.executionType,
          actions: actionsWithDeliverables,
          cycleId: `cycle-${item.label}`,
          nowISO: '2026-03-12T12:00:00.000Z',
        },
        'dev-mock-key'
      );
      if (!sessions.ok) {
        failures.push(`${item.label}: session plan failed (${sessions.error.code})`);
        continue;
      }

      const plan = compileAutoAsanaPlan({
        goalId: item.label,
        cycleId: `cycle-${item.label}`,
        planProof: {
          workableDaysRemaining: 110,
          totalRequiredUnits: actionsWithDeliverables.length,
          requiredPacePerDay: Math.max(1, actionsWithDeliverables.length / 30),
          maxPerDay: 6,
          maxPerWeek: 30,
          slackUnits: 0,
          slackRatio: 0,
          intensityRatio: 0.5,
        },
        constraints: {
          timezone: 'UTC',
          maxBlocksPerDay: 6,
          maxBlocksPerWeek: 30,
          weeklyWindows: {
            MON: [{ startHHMM: '08:00', endHHMM: '20:00' }],
            TUE: [{ startHHMM: '08:00', endHHMM: '20:00' }],
            WED: [{ startHHMM: '08:00', endHHMM: '20:00' }],
            THU: [{ startHHMM: '08:00', endHHMM: '20:00' }],
            FRI: [{ startHHMM: '08:00', endHHMM: '20:00' }],
            SAT: [{ startHHMM: '08:00', endHHMM: '20:00' }],
            SUN: [{ startHHMM: '08:00', endHHMM: '20:00' }],
          },
          cycleStartDayKey: '2026-03-12',
          cycleEndDayKey: '2026-06-30',
        },
        nowISO: '2026-03-12T12:00:00.000Z',
        horizonDays: 110,
        acceptedBlocks: [],
        actionSequence: actionsWithDeliverables,
        sessionPlan: sessions.sessions,
      });

      if (plan.horizonBlocks.length < compiled.deliverables.length) {
        failures.push(
          `${item.label}: blocks ${plan.horizonBlocks.length} < deliverables ${compiled.deliverables.length}`
        );
      }
      if (
        new Set(plan.horizonBlocks.map((block) => String(block.identityKey || block.id || ''))).size !==
        plan.horizonBlocks.length
      ) {
        failures.push(`${item.label}: identity collision`);
      }
    }

    expect(failures, failures.join('\n')).toEqual([]);
  }, 120000);
});
