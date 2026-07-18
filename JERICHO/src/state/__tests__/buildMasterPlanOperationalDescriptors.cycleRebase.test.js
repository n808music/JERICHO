/**
 * buildMasterPlanOperationalDescriptors must rebase the active cycle's
 * start to today when the master plan's horizonStart is in the past.
 *
 * Phase 7 cycle-creation layer follow-up — the gate enforcement landed
 * in PR #7 (failure codes STALE_ACTIVE_CYCLE_STATE +
 * ACTIVE_CYCLE_STARTS_IN_PAST_WITHOUT_CONFIRMATION), but the master-plan
 * cycle creator still defaulted to plan.horizonStart first, so the gate
 * was catching what the engine should never have produced.
 */
import { describe, expect, it } from 'vitest';

import { buildMasterPlanOperationalDescriptors, resolveFirstCycleScheduleStart } from '../identityCompute.js';

function stateOf(today, planOverrides = {}) {
  return {
    appTime: { timeZone: 'America/Chicago', activeDayKey: today },
    today: { date: today },
    profilesById: { 'profile-1': { id: 'profile-1', masterCalendarId: null } },
    masterCalendarsById: {},
    masterPlanLanesById: {},
    masterPlanMilestonesById: {},
  };
}

function planOf(horizonStart) {
  return {
    id: 'plan-1',
    profileId: 'profile-1',
    horizonStart,
    horizonEnd: '2031-05-19',
    laneIds: [],
    anchors: [],
  };
}

describe('buildMasterPlanOperationalDescriptors cycle rebase', () => {
  it('starts the cycle on today when plan horizonStart is in the past', () => {
    const today = '2026-06-15';
    const planStart = '2026-05-01';
    const descriptors = buildMasterPlanOperationalDescriptors(stateOf(today), planOf(planStart));
    expect(descriptors).not.toBeNull();
    expect(descriptors.startDayKey).toBe(today);
  });

  it('starts the cycle on plan.horizonStart when it is in the future', () => {
    const today = '2026-06-15';
    const planStart = '2026-07-01';
    const descriptors = buildMasterPlanOperationalDescriptors(stateOf(today), planOf(planStart));
    expect(descriptors).not.toBeNull();
    expect(descriptors.startDayKey).toBe(planStart);
  });

  it('starts the cycle on today when plan.horizonStart equals today', () => {
    const today = '2026-06-15';
    const descriptors = buildMasterPlanOperationalDescriptors(stateOf(today), planOf(today));
    expect(descriptors).not.toBeNull();
    expect(descriptors.startDayKey).toBe(today);
  });

  it('starts the cycle on today when plan.horizonStart is missing', () => {
    const today = '2026-06-15';
    const descriptors = buildMasterPlanOperationalDescriptors(stateOf(today), planOf(undefined));
    expect(descriptors).not.toBeNull();
    expect(descriptors.startDayKey).toBe(today);
  });

  it('prefers live appTime over stale today when rebasing the first-cycle floor', () => {
    const state = stateOf('2026-06-14');
    state.today.date = '2026-05-19';

    const resolved = resolveFirstCycleScheduleStart(state, {
      plan: planOf('2026-05-19'),
    });
    const descriptors = buildMasterPlanOperationalDescriptors(state, planOf('2026-05-19'));

    expect(resolved.candidateStartDayKey).toBe('2026-06-14');
    expect(resolved.resolvedStartDayKey).toBe('2026-06-15');
    expect(descriptors).not.toBeNull();
    expect(descriptors.todayDayKey).toBe('2026-06-14');
    expect(descriptors.startDayKey).toBe('2026-06-15');
  });

  it('resolves to the next available workday when saved availability starts later', () => {
    const state = stateOf('2026-06-04');
    state.availabilityPolicy = {
      workWindows: {
        mon: [{ start: '09:00', end: '15:00' }],
        tue: [{ start: '09:00', end: '15:00' }],
        wed: [],
        thu: [],
        fri: [],
        sat: [],
        sun: [],
      },
    };
    const resolved = resolveFirstCycleScheduleStart(state, {
      plan: planOf('2026-05-19'),
    });
    expect(resolved.resolvedStartDayKey).toBe('2026-06-08');
    expect(resolved.reasonCode).toBe('NO_AVAILABILITY_BEFORE_DATE');
  });

  it('preserves an occupied active cycle window instead of rebasing over it', () => {
    const state = stateOf('2026-06-04');
    state.cyclesById = {
      'masterplan-cycle:plan-1': {
        id: 'masterplan-cycle:plan-1',
        startedAtDayKey: '2026-08-04',
        scheduleLifecycle: 'active_schedule',
        executionEvents: [{ id: 'evt-1' }],
        goalContract: { startDayKey: '2026-08-04', endDayKey: '2026-10-17' },
      },
    };
    const descriptors = buildMasterPlanOperationalDescriptors(state, planOf('2026-05-19'));
    expect(descriptors).not.toBeNull();
    expect(descriptors.startDayKey).toBe('2026-08-04');
    expect(descriptors.startDateReasonCode).toBe('ACTIVE_CYCLE_OCCUPANCY');
  });
});
