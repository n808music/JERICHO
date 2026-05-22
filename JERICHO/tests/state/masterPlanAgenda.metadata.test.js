import { describe, it, expect } from 'vitest';
import { buildBlankIdentityState, DEFAULT_PROFILE_ID } from '../../src/state/identityStore.js';
import { applyMasterPlanAction } from '../../src/state/masterPlanStore.js';

describe('Master Plan Agenda metadata', () => {
  it('creates constraint and agenda versions and links to profile and master plan', () => {
    const state = buildBlankIdentityState({});
    const profileId = DEFAULT_PROFILE_ID;

    // Create a master plan to attach agenda to
    applyMasterPlanAction(state, { type: 'CREATE_MASTER_PLAN', payload: { profileId, title: 'Test Plan', northStarOutcome: 'Test North Star', horizonEnd: '2031-05-19', nowISO: new Date().toISOString() }, nowISO: new Date().toISOString() });
    const masterPlanId = state.profilesById[profileId].activeMasterPlanId;
    expect(masterPlanId).toBeTruthy();

    // Create a schedule constraint version
    const constraintPayload = { source: 'manual', constraintHash: 'hash-1', officialStartDayKey: '2026-05-20', weeklyCapacityMinutes: 240 }; 
    applyMasterPlanAction(state, { type: 'CREATE_SCHEDULE_CONSTRAINT_VERSION', payload: constraintPayload, profileId, nowISO: new Date().toISOString() });

    const constraintIds = state.profilesById[profileId].agendaConstraintVersionIds || [];
    expect(constraintIds.length).toBeGreaterThan(0);
    const constraint = state.scheduleConstraintVersionsById[constraintIds[0]];
    expect(constraint).toMatchObject({ constraintHash: 'hash-1', source: 'manual' });

    // Create an agenda version referencing the constraint
    const agendaPayload = {
      profileId,
      masterPlanId,
      sourceConstraintVersionId: constraint.id,
      state: 'current',
      range: { startDayKey: '2026-05-20', endDayKey: '2031-05-19' },
      blockCount: 3,
      blockIds: ['block-a', 'block-b', 'block-c'],
      summary: { byPhase: {}, byYear: { '2031': 1 }, scheduledCount: 3, unscheduledCount: 0, overloadCount: 0 },
      quality: { strategicCoverageState: 'covered', planQualityState: 'provisional', blockQualityState: 'ok' },
    };

    applyMasterPlanAction(state, { type: 'CREATE_AGENDA_VERSION', masterPlanId, payload: agendaPayload, profileId, nowISO: new Date().toISOString() });

    const agendaIds = state.profilesById[profileId].agendaVersionIds || [];
    expect(agendaIds.length).toBeGreaterThan(0);
    const agenda = state.masterPlanAgendaVersionsById[agendaIds[0]];
    expect(agenda).toBeTruthy();
    expect(agenda.range.endDayKey).toBe('2031-05-19');
    expect(agenda.blockCount).toBe(3);

    // Agenda blocks must not be present in Today by default (not executable)
    const todayBlocks = state.today?.blocks || [];
    expect(todayBlocks.find(b => agenda.blockIds.includes(b?.id))).toBeUndefined();

    // Master plan should reference the active agenda when state is 'current'
    const plan = state.masterPlansById[masterPlanId];
    expect(plan.activeAgendaVersionId || plan.activeAgendaVersionId === agenda.id).toBeTruthy();
  });
});
