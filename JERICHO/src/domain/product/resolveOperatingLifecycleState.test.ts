import { describe, expect, it } from 'vitest';

import {
  resolveOperatingLifecycleState,
  type OperatingLifecycleInput,
  type OperatingLifecycleState,
} from './resolveOperatingLifecycleState.ts';

function makeInput(overrides: Partial<OperatingLifecycleInput> = {}): OperatingLifecycleInput {
  return {
    isAuthenticated: true,
    activeProfileId: 'profile-1',
    activeGoalId: 'goal-1',
    activeCycleId: 'cycle-1',
    profileAccess: {
      status: 'profile_selected',
      selectedProfileId: 'profile-1',
    },
    profilesById: {
      'profile-1': {
        id: 'profile-1',
        activeGoalId: 'goal-1',
        masterCalendarId: 'calendar-1',
      },
    },
    goalsById: {
      'goal-1': {
        id: 'goal-1',
        activeCycleId: 'cycle-1',
      },
    },
    cyclesById: {
      'cycle-1': {
        id: 'cycle-1',
        scheduleLifecycle: 'draft_schedule_ready',
        goalContract: {
          startDayKey: '2026-06-08',
          phaseId: 'P1',
        },
        proposedBlocks: [{ id: 'block-1' }, { id: 'block-2' }],
      },
    },
    ...overrides,
  };
}

function expectState(input: OperatingLifecycleInput, state: OperatingLifecycleState) {
  const result = resolveOperatingLifecycleState(input);
  expect(result.state).toBe(state);
  expect(result.label).toBeTruthy();
  expect(result.reason).toBeTruthy();
  expect(result.nextAction).toBeTruthy();
  return result;
}

describe('resolveOperatingLifecycleState', () => {
  it('returns SIGNED_OUT when no authenticated user is present', () => {
    const result = expectState(makeInput({ isAuthenticated: false }), 'SIGNED_OUT');
    expect(result.blockingIssues).toContain('AUTH_REQUIRED');
  });

  it('returns PROFILE_REQUIRED when profile context is missing or incoherent', () => {
    const result = expectState(
      makeInput({
        activeProfileId: null,
        profileAccess: { status: 'profile_required', selectedProfileId: null },
      }),
      'PROFILE_REQUIRED'
    );
    expect(result.blockingIssues).toContain('ACTIVE_PROFILE_MISSING');
  });

  it('returns GOAL_REQUIRED when a profile exists but no active goal is admitted', () => {
    const result = expectState(
      makeInput({
        activeGoalId: null,
        goalsById: {},
        profilesById: {
          'profile-1': {
            id: 'profile-1',
            activeGoalId: null,
            masterCalendarId: 'calendar-1',
          },
        },
      }),
      'GOAL_REQUIRED'
    );
    expect(result.readinessSummary.goal).toBe('MISSING');
  });

  it('returns SCHEDULE_REQUIRED when a goal exists without a generated schedule', () => {
    const result = expectState(
      makeInput({
        activeCycleId: null,
        cyclesById: {},
        goalsById: { 'goal-1': { id: 'goal-1', activeCycleId: null } },
        scheduleLifecycleState: 'goal_admitted',
      }),
      'SCHEDULE_REQUIRED'
    );
    expect(result.blockingIssues).toContain('GENERATED_SCHEDULE_MISSING');
  });

  it('returns SCHEDULE_GENERATED for a draft schedule that does not yet require formal review', () => {
    const result = expectState(
      makeInput({
        scheduleLifecycleState: 'schedule_preview_ready',
        planReviewRequired: false,
        pendingPlanConfirmation: false,
      }),
      'SCHEDULE_GENERATED'
    );
    expect(result.readinessSummary.blockCount).toBe(2);
  });

  it('returns PLAN_REVIEW_REQUIRED when the generated plan still needs review', () => {
    const result = expectState(
      makeInput({
        scheduleLifecycleState: 'schedule_preview_ready',
        pendingPlanConfirmation: true,
      }),
      'PLAN_REVIEW_REQUIRED'
    );
    expect(result.blockingIssues).toContain('PLAN_REVIEW_REQUIRED');
  });

  it('returns READY_TO_ACTIVATE when an applied review schedule has passed readiness', () => {
    const result = expectState(
      makeInput({
        scheduleLifecycleState: 'schedule_applied',
        cyclesById: {
          'cycle-1': {
            id: 'cycle-1',
            scheduleLifecycle: 'applied_review',
            goalContract: { startDayKey: '2026-06-08', phaseId: 'P1' },
            scheduleReviewBlocks: [{ id: 'review-1' }],
            planQualityGate: { passed: true, dependencyAudit: 'PASS' },
          },
        },
      }),
      'READY_TO_ACTIVATE'
    );
    expect(result.readinessSummary.planQuality).toBe('PASS');
  });

  it('returns ACTIVE_EXECUTION when the schedule is active', () => {
    const result = expectState(
      makeInput({
        scheduleLifecycleState: 'in_execution',
        activeTodayBlockCount: 3,
        cyclesById: {
          'cycle-1': {
            id: 'cycle-1',
            scheduleLifecycle: 'active_schedule',
            goalContract: { startDayKey: '2026-06-08', phaseId: 'P1' },
            executionEvents: [{ id: 'evt-1' }],
          },
        },
      }),
      'ACTIVE_EXECUTION'
    );
    expect(result.readinessSummary.today).toBe('WORK_PRESENT');
  });

  it('returns COURSE_CORRECTION_REQUIRED when execution correction is elevated', () => {
    const result = expectState(
      makeInput({
        scheduleLifecycleState: 'in_execution',
        executionCorrection: {
          correctionState: 'recovery_required',
          reasonCodes: ['dependency_blocked'],
        },
      }),
      'COURSE_CORRECTION_REQUIRED'
    );
    expect(result.blockingIssues).toContain('dependency_blocked');
  });

  it('returns REASSESSMENT_PENDING when current-state reassessment is required', () => {
    const result = expectState(
      makeInput({
        cyclesById: {
          'cycle-1': {
            id: 'cycle-1',
            reassessmentStatus: 'required',
            goalContract: { startDayKey: '2026-06-08', phaseId: 'P1' },
          },
        },
      }),
      'REASSESSMENT_PENDING'
    );
    expect(result.blockingIssues).toContain('REASSESSMENT_REQUIRED');
  });

  it('returns REASSESSMENT_ACCEPTED when reassessment is complete and no regeneration flag is set', () => {
    const result = expectState(
      makeInput({
        cyclesById: {
          'cycle-1': {
            id: 'cycle-1',
            reassessmentStatus: 'complete',
            goalContract: { startDayKey: '2026-06-08', phaseId: 'P1' },
          },
        },
      }),
      'REASSESSMENT_ACCEPTED'
    );
    expect(result.blockingIssues).toEqual([]);
  });

  it('returns REGENERATION_REQUIRED when reassessment is accepted but the schedule must be regenerated', () => {
    const result = expectState(
      makeInput({
        regenerationRequired: true,
        cyclesById: {
          'cycle-1': {
            id: 'cycle-1',
            reassessmentStatus: 'complete',
            goalContract: { startDayKey: '2026-06-08', phaseId: 'P1' },
          },
        },
      }),
      'REGENERATION_REQUIRED'
    );
    expect(result.blockingIssues).toContain('REGENERATION_REQUIRED');
  });
});
