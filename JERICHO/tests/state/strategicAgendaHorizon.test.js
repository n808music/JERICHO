import { describe, expect, it } from 'vitest';

import { buildMasterPlan } from '../../src/domain/masterPlan/masterPlanFactory.js';
import { resolveStrategicAgendaHorizon } from '../../src/domain/masterPlan/strategicHorizon.js';
import { deriveMasterPlanPhaseModel } from '../../src/domain/masterPlan/masterPlanPhaseModel.js';
import { createMinimalCoreMissionContract } from '../../src/domain/core/CoreMissionContractMinimal';
import { DEFAULT_PROFILE_ID } from '../../src/state/identityStore.js';

function buildPlan({
  horizonEnd = '2029-05-09',
  declaredHorizonMonths = 36,
  coreMission = 'Operation Endgame',
  northStarOutcome = 'Build the Jericho ecosystem',
} = {}) {
  return buildMasterPlan({
    profileId: DEFAULT_PROFILE_ID,
    title: 'Operation Endgame',
    northStarOutcome,
    coreMission,
    horizonStart: '2026-05-09',
    horizonEnd,
    declaredHorizonMonths,
    anchors: [{ date: '2026-10-17', label: 'Album drop', isFixed: true }],
    nowISO: '2026-05-09T10:00:00.000Z',
  });
}

describe('strategic agenda horizon separation', () => {
  it('full strategic agenda beats capped roadmap coverage when mission contract declares five years', () => {
    const plan = buildPlan();
    const missionContract = createMinimalCoreMissionContract({
      profileId: DEFAULT_PROFILE_ID,
      durableObjective: 'Build and execute Operation Endgame: a 5-year master plan through 2031.',
      horizonYears: 5,
      strategicThesis: 'The forecast roadmap may stop before the full strategic agenda.',
    });

    const resolved = resolveStrategicAgendaHorizon(plan, missionContract);

    expect(plan.horizonEnd).toBe('2029-05-09');
    expect(resolved.resolvedStrategicHorizonEndDayKey).toBe('2031-05-09');
    expect(resolved.declaredHorizonMonths).toBe(36);
    expect(resolved.missionHorizonMonths).toBe(60);
  });

  it('derives distinct committed, forecast, and strategic layer endpoints', () => {
    const plan = buildPlan({ horizonEnd: '2029-05-09', declaredHorizonMonths: 36 });
    const missionContract = createMinimalCoreMissionContract({
      profileId: DEFAULT_PROFILE_ID,
      durableObjective: 'Build and execute Operation Endgame: a 5-year master plan through 2031.',
      horizonYears: 5,
    });
    const resolved = resolveStrategicAgendaHorizon(plan, missionContract);

    const committedEnd = '2026-10-17';
    const forecastEnd = '2029-05-09';
    const strategicEnd = resolved.resolvedStrategicHorizonEndDayKey;

    expect(committedEnd).toBe('2026-10-17');
    expect(forecastEnd).toBe('2029-05-09');
    expect(strategicEnd).toBe('2031-05-09');
  });

  it('phase cards use the full strategic agenda horizon so P3 reaches 2031', () => {
    const plan = buildPlan({ horizonEnd: '2029-05-09', declaredHorizonMonths: 36 });
    const missionContract = createMinimalCoreMissionContract({
      profileId: DEFAULT_PROFILE_ID,
      durableObjective: 'Build and execute Operation Endgame: a 5-year master plan through 2031.',
      horizonYears: 5,
    });
    const resolved = resolveStrategicAgendaHorizon(plan, missionContract);
    const fullStrategicPhaseModel = deriveMasterPlanPhaseModel({
      plan,
      lanes: [
        { id: 'lane-app', title: 'App launch', domain: 'product', activationState: 'active' },
        { id: 'lane-label', title: 'Record label', domain: 'brand', activationState: 'incubating' },
      ],
      milestones: [
        { id: 'm1', laneId: 'lane-app', title: 'Launch', targetDate: '2026-10-17', milestoneType: 'anchor', status: 'pending' },
        { id: 'm2', laneId: 'lane-app', title: 'Conversion proof', targetDate: '2028-03-01', milestoneType: 'checkpoint', status: 'pending' },
      ],
      anchors: [{ id: 'a1', date: '2026-10-17', label: 'Album drop', isFixed: true }],
      horizonEndDayKey: resolved.resolvedStrategicHorizonEndDayKey,
    });
    const forecastPhaseModel = deriveMasterPlanPhaseModel({
      plan,
      lanes: [
        { id: 'lane-app', title: 'App launch', domain: 'product', activationState: 'active' },
        { id: 'lane-label', title: 'Record label', domain: 'brand', activationState: 'incubating' },
      ],
      milestones: [
        { id: 'm1', laneId: 'lane-app', title: 'Launch', targetDate: '2026-10-17', milestoneType: 'anchor', status: 'pending' },
        { id: 'm2', laneId: 'lane-app', title: 'Conversion proof', targetDate: '2028-03-01', milestoneType: 'checkpoint', status: 'pending' },
      ],
      anchors: [{ id: 'a1', date: '2026-10-17', label: 'Album drop', isFixed: true }],
      horizonEndDayKey: '2029-05-09',
    });

    expect(fullStrategicPhaseModel.phases[2].endBoundary).toBe('2031-05-09');
    expect(forecastPhaseModel.phases[2].endBoundary).toBe('2029-05-09');
  });
});
