import { describe, expect, it } from 'vitest';
import { attemptGoalAdmissionPure } from '../../src/state/identityStore.js';
import { computeDerivedState } from '../../src/state/identityCompute.js';
import { computeContractHash } from '../../src/domain/goal/GoalAdmissionPolicy.ts';
import { materializeBlocksFromEvents } from '../../src/state/engine/todayAuthority.ts';

function buildBaseState() {
  return {
    vector: { day: 1, direction: '', stability: 'steady', drift: 'contained', momentum: 'active' },
    lenses: {
      aim: { description: '', horizon: '90d', narrative: '' },
      pattern: { routines: { Body: [], Resources: [], Creation: [], Focus: [] }, dailyTargets: [], defaultMinutes: 30 },
      flow: { streams: [] },
    },
    today: {
      date: '2026-03-21',
      blocks: [],
      completionRate: 0,
      driftSignal: 'contained',
      loadByPractice: {},
      practices: [],
    },
    currentWeek: { weekStart: '2026-03-21', days: [], metrics: {} },
    cycle: [],
    viewDate: '2026-03-21',
    templates: { objectives: {} },
    lastAdaptedDate: null,
    stability: { headline: '', actionLine: '' },
    meta: { version: '1.0.0', onboardingComplete: false },
    recurringPatterns: [],
    lastSessionChange: null,
    nextSuggestion: null,
    executionEvents: [],
    ledger: [],
    aspirations: [],
    aspirationsByCycleId: {},
    cyclesById: {},
    cycleOrder: [],
    activeCycleId: null,
    appTime: {
      timeZone: 'UTC',
      nowISO: '2026-03-21T12:00:00.000Z',
      activeDayKey: '2026-03-21',
      isFollowingNow: true,
    },
    constraints: {
      maxBlocksPerDay: 4,
      maxBlocksPerWeek: 16,
    },
  };
}

function buildPodcastContract() {
  const contract = {
    goalId: 'goal-cycle-2026-03-21-3',
    cycleId: 'cycle-2026-03-21-3',
    planGenerationMechanismClass: 'GENERIC_DETERMINISTIC',
    executionType: 'CreativeProduction',
    goalLabel: 'start a podcast',
    goalText: 'start a podcast',
    terminalOutcome: {
      text: 'start a podcast',
      verificationCriteria: '6 episodes recorded and edited for release',
      isConcrete: true,
      hash: '',
    },
    deadline: { dayKey: '2026-06-30', isHardDeadline: true },
    sacrifice: {
      whatIsGivenUp: 'Evening leisure time',
      duration: 'Until deadline',
      quantifiedImpact: '10 hours/week',
      rationale: 'Protect production time',
      hash: '',
    },
    workWindows: {
      mon: [{ start: '09:00', end: '11:00' }],
      tue: [],
      wed: [{ start: '09:00', end: '11:00' }],
      thu: [],
      fri: [{ start: '09:00', end: '11:00' }],
      sat: [],
      sun: [],
    },
    causalChain: {
      steps: [
        { sequence: 1, description: 'Select theme for podcast' },
        { sequence: 2, description: 'Budget for equipment' },
        { sequence: 3, description: 'Film 6 episodes' },
      ],
      hash: '',
    },
    reinforcement: {
      dailyExposureEnabled: true,
      dailyMechanism: 'Dashboard banner',
      checkInFrequency: 'DAILY',
      triggerDescription: 'Every morning 9am',
    },
    inscription: {
      contractHash: '',
      inscribedAtISO: '2026-03-21T12:00:00.000Z',
      acknowledgment: 'I understand this is binding',
      acknowledgmentHash: '',
      isCompromised: false,
    },
    commitmentDisclosureAccepted: true,
    admissionStatus: 'PENDING',
    admissionAttemptCount: 0,
    rejectionCodes: [],
    createdAtISO: '2026-03-21T12:00:00.000Z',
    isAspirational: false,
  };

  contract.inscription.contractHash = computeContractHash(contract);
  contract.inscription.acknowledgmentHash = contract.inscription.contractHash.slice(0, 16);
  contract.terminalOutcome.hash = contract.inscription.contractHash.slice(0, 16);
  contract.sacrifice.hash = contract.inscription.contractHash.slice(16, 32);
  contract.causalChain.hash = contract.inscription.contractHash.slice(32);
  return contract;
}

describe('podcast full-plan apply', () => {
  it('commits the full generated proposal set across the horizon', () => {
    const state = buildBaseState();

    const admitted = attemptGoalAdmissionPure(state, {
      contract: buildPodcastContract(),
      goalDraftV2: {
        goalLabel: 'start a podcast',
        goalText: 'start a podcast',
        executionType: 'CreativeProduction',
      },
    });

    expect(admitted.result.status).toBe('ADMITTED');

    const generated = computeDerivedState(admitted.nextState, { type: 'GENERATE_PLAN' });
    const suggested = (generated.proposedBlocks || []).filter((block) => block?.status === 'suggested');
    expect(suggested.length).toBeGreaterThan(0);
    const suggestedTitles = suggested.map((block) => String(block?.title || '').toLowerCase());
    expect(suggestedTitles).toContain('film episode 1');
    expect(suggestedTitles).toContain('edit episode 1');
    expect(suggestedTitles).toContain('publish episode 1');
    expect(suggestedTitles).toContain('film episode 6');
    expect(suggestedTitles).toContain('edit episode 6');
    expect(suggestedTitles).toContain('publish episode 6');

    const reviewed = computeDerivedState(generated, { type: 'APPLY_PLAN' });
    const reviewedCreated = (reviewed.executionEvents || []).filter(
      (event) => event?.kind === 'create' && event?.origin === 'suggested_apply'
    );

    expect(reviewedCreated.length).toBe(0);

    const activated = computeDerivedState(reviewed, { type: 'ACTIVATE_SCHEDULE' });
    const created = (activated.executionEvents || []).filter(
      (event) => event?.kind === 'create' && event?.origin === 'schedule_active'
    );

    expect(created.length).toBe(suggested.length);

    const materialized = materializeBlocksFromEvents(activated.executionEvents || [], {
      todayISO: activated.today?.date,
    });
    const appliedMonths = new Set(
      (materialized.days || [])
        .flatMap((day) => day.blocks || [])
        .map((block) => String(block?.start || '').slice(0, 7))
        .filter(Boolean)
    );
    expect(appliedMonths.size).toBeGreaterThan(1);
    const materializedTitles = (materialized.days || [])
      .flatMap((day) => day.blocks || [])
      .map((block) => String(block?.title || '').toLowerCase());
    expect(materializedTitles).toContain('film episode 1');
    expect(materializedTitles).toContain('edit episode 1');
    expect(materializedTitles).toContain('publish episode 1');
  });
});
