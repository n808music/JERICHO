import { describe, expect, it } from 'vitest';
import { computeDerivedState, getAllBlocks, getCanonicalBlocks } from '../../src/state/identityCompute.js';

function buildState({ nowDayKey = '2026-03-10', generatedAtISO = null } = {}) {
  const cycleId = 'cycle-apply-1';
  const dayKey = nowDayKey;
  const masterPlanId = 'plan-1';
  return {
    appTime: { timeZone: 'UTC', nowISO: `${dayKey}T12:00:00.000Z`, activeDayKey: dayKey, isFollowingNow: true },
    today: { date: dayKey, blocks: [] },
    currentWeek: { weekStart: dayKey, days: [] },
    cycle: [],
    vector: {},
    lenses: { aim: {}, pattern: { dailyTargets: [] }, flow: {} },
    executionEvents: [],
    suggestionEvents: [],
    proposedBlocks: [
      {
        id: 'p1',
        goalId: 'goal-1',
        cycleId,
        status: 'suggested',
        title: 'Validate onboarding path for Operation Endgame app platform',
        laneId: 'product',
        laneLabel: 'Operation Endgame app platform',
        entityId: 'global-state-systems',
        entityLabel: 'Global State Systems',
        phaseId: 'phase-p1',
        phaseLabel: 'P1',
        initiativeLabel: 'Jericho System',
        workType: 'Validation',
        masterPlanLaneId: 'product',
        owner: 'James / Operation Endgame',
        producesArtifact: 'Validated onboarding path report',
        passEvidence: 'Saved onboarding validation report with blocker status.',
        startISO: '2026-03-11T09:00:00.000Z',
        dayKey: '2026-03-11',
        durationMinutes: 60,
        domain: 'FOCUS',
      },
    ],
    suggestedBlocks: [
      {
        id: 's1',
        goalId: 'goal-1',
        cycleId,
        status: 'suggested',
        title: 'Mirror Suggested Title',
        startISO: '2026-03-12T09:00:00.000Z',
        dayKey: '2026-03-12',
        durationMinutes: 60,
        domain: 'FOCUS',
      },
    ],
    constraints: {},
    cyclesById: {
      [cycleId]: {
        id: cycleId,
        status: 'active',
        masterPlanId,
        scheduleGeneratedAtISO: generatedAtISO,
        goalContract: { goalId: 'goal-1', startDayKey: dayKey, endDayKey: '2026-03-30' },
        proposedBlocks: [
          {
            id: 'p1',
            goalId: 'goal-1',
            cycleId,
            status: 'suggested',
            title: 'Validate onboarding path for Operation Endgame app platform',
            laneId: 'product',
            laneLabel: 'Operation Endgame app platform',
            entityId: 'global-state-systems',
            entityLabel: 'Global State Systems',
            phaseId: 'phase-p1',
            phaseLabel: 'P1',
            initiativeLabel: 'Jericho System',
            workType: 'Validation',
            masterPlanLaneId: 'product',
            owner: 'James / Operation Endgame',
            producesArtifact: 'Validated onboarding path report',
            passEvidence: 'Saved onboarding validation report with blocker status.',
            startISO: '2026-03-11T09:00:00.000Z',
            dayKey: '2026-03-11',
            durationMinutes: 60,
            domain: 'FOCUS',
          },
        ],
        suggestedBlocks: [
          {
            id: 's1',
            goalId: 'goal-1',
            cycleId,
            status: 'suggested',
            title: 'Mirror Suggested Title',
            startISO: '2026-03-12T09:00:00.000Z',
            dayKey: '2026-03-12',
            durationMinutes: 60,
            domain: 'FOCUS',
          },
        ],
      },
    },
    activeCycleId: cycleId,
    goalExecutionContract: { goalId: 'goal-1', startDayKey: dayKey, endDayKey: '2026-03-30' },
    masterPlansById: {
      [masterPlanId]: {
        id: masterPlanId,
        laneIds: ['product'],
        anchors: [{ id: 'anchor-1', date: '2026-03-15', label: 'Fixed launch anchor', isFixed: true }],
      },
    },
    masterPlanLanesById: {
      product: {
        id: 'product',
        domain: 'product',
        title: 'Operation Endgame app platform',
        label: 'Operation Endgame app platform',
      },
    },
    deliverablesByCycleId: {
      [cycleId]: {
        deliverables: [{ id: 'd-1', title: 'Mandatory work package', requiredBlocks: 1 }],
        suggestionLinks: {},
      },
    },
    lastPlanError: null,
  };
}

describe('APPLY_DRAFT_SCHEDULE canonical proposal source', () => {
  it('applies canonical proposedBlocks into review blocks even when suggestedBlocks mirror diverges', () => {
    const next = computeDerivedState(buildState(), {
      type: 'APPLY_DRAFT_SCHEDULE',
      payload: { cycleId: 'cycle-apply-1' },
    });

    expect(next.scheduleLifecycle).toBe('applied_review');
    expect((next.executionEvents || []).filter((event) => event?.kind === 'create')).toHaveLength(0);
    expect((next.scheduleReviewBlocks || []).some((block) => block?.suggestionId === 'p1')).toBe(true);
    expect((next.scheduleReviewBlocks || []).some((block) => block?.suggestionId === 's1')).toBe(false);
    expect(next.scheduleReviewBlocks[0]).toEqual(
      expect.objectContaining({
        laneId: 'product',
        laneLabel: 'Operation Endgame app platform',
        entityId: 'global-state-systems',
        entityLabel: 'Global State Systems',
        phaseId: 'phase-p1',
        phaseLabel: 'P1',
        workType: 'Validation',
        masterPlanLaneId: 'product',
        owner: 'James / Operation Endgame',
      })
    );
    const transitionTraceLog = (next.debug?.traceLog || []).filter((entry) => entry?.transition);
    expect(transitionTraceLog).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          transition: 'apply',
          blockId: 'p1',
          label: 'Validate onboarding path for Operation Endgame app platform',
        }),
      ])
    );
  });

  it('uses canonical cycle.goalContract over goalExecutionContract mirror when activating blocks', () => {
    const state = buildState();
    state.cyclesById['cycle-apply-1'].goalContract.goalId = 'goal-canonical';
    state.goalExecutionContract.goalId = 'goal-mirror';
    const reviewed = computeDerivedState(state, {
      type: 'APPLY_DRAFT_SCHEDULE',
      payload: { cycleId: 'cycle-apply-1' },
    });
    const next = computeDerivedState(reviewed, { type: 'ACTIVATE_SCHEDULE', payload: { cycleId: 'cycle-apply-1' } });

    const createEvents = (next.executionEvents || []).filter((event) => event?.kind === 'create');
    expect(createEvents.length).toBeGreaterThan(0);
    expect(createEvents.every((event) => event?.goalId === 'goal-canonical')).toBe(true);
  });

  it('rematerializes today and cycle views after activating reviewed blocks', () => {
    const reviewed = computeDerivedState(buildState(), {
      type: 'APPLY_DRAFT_SCHEDULE',
      payload: { cycleId: 'cycle-apply-1' },
    });
    const next = computeDerivedState(reviewed, {
      type: 'ACTIVATE_SCHEDULE',
      payload: { cycleId: 'cycle-apply-1' },
    });

    expect((reviewed.executionEvents || []).some((event) => event?.kind === 'create')).toBe(false);
    expect((reviewed.cycle || []).some((day) => Array.isArray(day?.blocks) && day.blocks.length > 0)).toBe(true);
    expect((next.executionEvents || []).some((event) => event?.kind === 'create')).toBe(true);
    expect((next.cycle || []).some((day) => Array.isArray(day?.blocks) && day.blocks.length > 0)).toBe(true);
  });

  it('returns NO_PROPOSED_BLOCKS and does not re-apply when all blocks are already accepted', () => {
    const generated = computeDerivedState(buildState(), {
      type: 'APPLY_DRAFT_SCHEDULE',
      payload: { cycleId: 'cycle-apply-1' },
    });
    const eventCountAfterGenerate = (generated.executionEvents || []).length;
    expect(eventCountAfterGenerate).toBe(0);
    expect((generated.proposedBlocks || []).every((block) => block?.status === 'accepted')).toBe(true);

    const reapplied = computeDerivedState(generated, {
      type: 'APPLY_DRAFT_SCHEDULE',
      payload: { cycleId: 'cycle-apply-1' },
    });

    expect((reapplied.executionEvents || []).length).toBe(eventCountAfterGenerate);
    expect(reapplied.lastPlanError?.code).toBe('NO_PROPOSED_BLOCKS');
    expect((reapplied.proposedBlocks || []).every((block) => block?.status === 'accepted')).toBe(true);
  });

  it('blocks stale next-day apply and preserves hard anchors plus mandatory work', () => {
    const state = buildState({
      nowDayKey: '2026-03-11',
      generatedAtISO: '2026-03-10T12:00:00.000Z',
    });

    const next = computeDerivedState(state, {
      type: 'APPLY_DRAFT_SCHEDULE',
      payload: { cycleId: 'cycle-apply-1' },
    });

    expect(next.lastPlanError?.code).toBe('GENERATED_SCHEDULE_STALE');
    expect(next.cyclesById['cycle-apply-1'].reassessmentStatus).toBe('required');
    expect(next.cyclesById['cycle-apply-1'].scheduleLifecycle).not.toBe('applied_review');
    expect(next.masterPlansById['plan-1'].anchors).toEqual(state.masterPlansById['plan-1'].anchors);
    expect(next.deliverablesByCycleId['cycle-apply-1'].deliverables).toEqual(
      state.deliverablesByCycleId['cycle-apply-1'].deliverables
    );
  });

  it('defers hard-fail execution objects instead of surfacing them in review blocks', () => {
    const state = buildState();
    state.proposedBlocks = [
      {
        id: 'bad-1',
        goalId: 'goal-1',
        cycleId: 'cycle-apply-1',
        status: 'suggested',
        title: 'First revenue event',
        laneId: 'revenue',
        laneLabel: 'Operation Endgame services revenue bridge',
        entityId: 'capital-path',
        entityLabel: 'Capital Path or Revenue Engine',
        phaseId: 'phase-p1',
        phaseLabel: 'P1',
        workType: 'Execution',
        owner: 'James / Operation Endgame',
        startISO: '2026-03-11T09:00:00.000Z',
        dayKey: '2026-03-11',
        durationMinutes: 60,
        domain: 'FOCUS',
      },
    ];
    state.cyclesById['cycle-apply-1'].proposedBlocks = [...state.proposedBlocks];

    const next = computeDerivedState(state, {
      type: 'APPLY_DRAFT_SCHEDULE',
      payload: { cycleId: 'cycle-apply-1' },
    });

    expect(next.scheduleLifecycle).not.toBe('applied_review');
    expect(next.lastPlanError?.code).toBe('NO_ADMISSIBLE_PROPOSED_BLOCKS');
    expect(next.scheduleReviewBlocks || []).toHaveLength(0);
    expect(next.proposedBlocks[0]?.status).toBe('rejected');
    expect(next.proposedBlocks[0]?.admissionFailureCodes || []).toContain('MILESTONE_RENDERED_AS_EXECUTION_BLOCK');
    expect(next.cyclesById['cycle-apply-1']?.deferredScheduleBlocks || []).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'bad-1',
          deferredReason: 'admission_audit_failed',
        }),
      ])
    );
  });
});
