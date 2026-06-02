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

import { buildMasterPlanOperationalDescriptors } from '../identityCompute.js';

function stateOf(today, planOverrides = {}) {
  return {
    appTime: { timeZone: 'America/Chicago' },
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
});
