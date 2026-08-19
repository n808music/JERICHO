import { describe, it, expect } from 'vitest';
import {
  scoreGoalSuccessProbability,
  EXTERNALLY_MEDIATED_PROVISIONAL_QUALIFIER,
} from '../../src/state/engine/probabilityScore.ts';

const GOAL_ID = 'goal-ext-evidence';
const NOW_ISO = '2026-03-20T12:00:00.000Z';
const FUTURE_DEADLINE = '2026-06-01';

function governanceContract(goalId = GOAL_ID) {
  return {
    contractId: `gov-${goalId}`,
    version: 1,
    goalId,
    activeFromISO: '2026-03-01',
    activeUntilISO: '2026-12-31',
    scope: { domainsAllowed: ['Focus'], timeHorizon: 'week', timezone: 'UTC' },
    // minEvidenceEvents: 0 — permits scoring from activation day (same as POS-003 contract shape)
    governance: { probabilityEnabled: true, minEvidenceEvents: 0 },
  };
}

function externallyMediatedCycle(goalId, archetype, cycleId = 'cycle-ext') {
  return {
    id: cycleId,
    status: 'active',
    goalContract: {
      goalId,
      startDayKey: '2026-03-01',
      endDayKey: FUTURE_DEADLINE,
      familyClass: 'externally_mediated',
      archetype,
    },
    goalGovernanceContract: governanceContract(goalId),
  };
}

function sevenDayInternalEvents(goalId = GOAL_ID, cycleId = 'cycle-ext') {
  return [
    { goalId, cycleId, completed: true, kind: 'complete', dateISO: '2026-03-13' },
    { goalId, cycleId, completed: true, kind: 'complete', dateISO: '2026-03-14' },
    { goalId, cycleId, completed: true, kind: 'complete', dateISO: '2026-03-15' },
    { goalId, cycleId, completed: true, kind: 'complete', dateISO: '2026-03-16' },
    { goalId, cycleId, completed: true, kind: 'complete', dateISO: '2026-03-17' },
    { goalId, cycleId, completed: true, kind: 'complete', dateISO: '2026-03-18' },
    { goalId, cycleId, completed: true, kind: 'complete', dateISO: '2026-03-19' },
  ];
}

function baseExternalState(archetype, overrides = {}) {
  return {
    activeCycleId: 'cycle-ext',
    cyclesById: {
      'cycle-ext': externallyMediatedCycle(GOAL_ID, archetype),
    },
    goalWorkById: { [GOAL_ID]: [{ workItemId: 'w1', blocksRemaining: 5 }] },
    executionEvents: sevenDayInternalEvents(),
    externalEvidenceEvents: [],
    ...overrides,
  };
}

const CONSTRAINTS = { timezone: 'UTC', maxBlocksPerDay: 2, scoringWindowDays: 14 };

// ─── POS-005: externally-mediated stays provisional without external evidence ─

describe('POS-005: externally-mediated stays provisional without external evidence', () => {
  it('JobSearchPipeline stays provisional at 7 evidence days without external evidence', () => {
    const state = baseExternalState('JobSearchPipeline');
    const result = scoreGoalSuccessProbability(GOAL_ID, state, CONSTRAINTS, NOW_ISO);
    expect(result.trustState).toBe('provisional');
    expect(result.value).toBeLessThanOrEqual(0.65);
  });

  it('Fundraising stays provisional at 10 evidence days without external evidence', () => {
    const tenDayEvents = [
      ...sevenDayInternalEvents(),
      { goalId: GOAL_ID, cycleId: 'cycle-ext', completed: true, kind: 'complete', dateISO: '2026-03-10' },
      { goalId: GOAL_ID, cycleId: 'cycle-ext', completed: true, kind: 'complete', dateISO: '2026-03-11' },
      { goalId: GOAL_ID, cycleId: 'cycle-ext', completed: true, kind: 'complete', dateISO: '2026-03-12' },
    ];
    const state = baseExternalState('Fundraising', { executionEvents: tenDayEvents });
    const result = scoreGoalSuccessProbability(GOAL_ID, state, CONSTRAINTS, NOW_ISO);
    expect(result.trustState).toBe('provisional');
  });

  it('SalesPipeline stays provisional regardless of internal evidence depth without external evidence', () => {
    const state = baseExternalState('SalesPipeline');
    const result = scoreGoalSuccessProbability(GOAL_ID, state, CONSTRAINTS, NOW_ISO);
    expect(result.trustState).toBe('provisional');
  });

  it('externally-mediated provisional carries canonical qualifier', () => {
    const state = baseExternalState('JobSearchPipeline');
    const result = scoreGoalSuccessProbability(GOAL_ID, state, CONSTRAINTS, NOW_ISO);
    expect(result.qualifier).toBe(EXTERNALLY_MEDIATED_PROVISIONAL_QUALIFIER);
  });
});

// ─── POS-006: transitions to trusted on qualifying external evidence + 7 days ─

describe('POS-006: transitions to trusted on first qualifying external event + 7 internal days', () => {
  it('JobSearchPipeline transitions to trusted on recruiter_reply with 7 internal days', () => {
    const state = baseExternalState('JobSearchPipeline', {
      externalEvidenceEvents: [
        {
          type: 'external_evidence',
          goalId: GOAL_ID,
          cycleId: 'cycle-ext',
          dateISO: '2026-03-15',
          familyClass: 'externally_mediated',
          stage: 'recruiter_reply',
          evidenceLabel: 'Recruiter replied to application',
          confirmed: true,
        },
      ],
    });
    const result = scoreGoalSuccessProbability(GOAL_ID, state, CONSTRAINTS, NOW_ISO);
    expect(result.trustState).toBe('trusted');
  });

  it('Fundraising transitions to trusted on meeting_booked with 7 internal days', () => {
    const state = baseExternalState('Fundraising', {
      externalEvidenceEvents: [
        {
          type: 'external_evidence',
          goalId: GOAL_ID,
          cycleId: 'cycle-ext',
          dateISO: '2026-03-15',
          stage: 'meeting_booked',
          confirmed: true,
        },
      ],
    });
    const result = scoreGoalSuccessProbability(GOAL_ID, state, CONSTRAINTS, NOW_ISO);
    expect(result.trustState).toBe('trusted');
  });

  it('SalesPipeline transitions to trusted on discovery_call_booked with 7 internal days', () => {
    const state = baseExternalState('SalesPipeline', {
      externalEvidenceEvents: [
        {
          type: 'external_evidence',
          goalId: GOAL_ID,
          cycleId: 'cycle-ext',
          dateISO: '2026-03-15',
          stage: 'discovery_call_booked',
          confirmed: true,
        },
      ],
    });
    const result = scoreGoalSuccessProbability(GOAL_ID, state, CONSTRAINTS, NOW_ISO);
    expect(result.trustState).toBe('trusted');
  });

  it('trusted externally-mediated goal does not carry externally-mediated qualifier', () => {
    const state = baseExternalState('JobSearchPipeline', {
      externalEvidenceEvents: [
        {
          type: 'external_evidence',
          goalId: GOAL_ID,
          cycleId: 'cycle-ext',
          dateISO: '2026-03-15',
          stage: 'recruiter_reply',
          confirmed: true,
        },
      ],
    });
    const result = scoreGoalSuccessProbability(GOAL_ID, state, CONSTRAINTS, NOW_ISO);
    expect(result.qualifier).not.toBe(EXTERNALLY_MEDIATED_PROVISIONAL_QUALIFIER);
  });
});

// ─── POS-006b: non-qualifying external events do not unlock trusted ───────────

describe('POS-006b: non-qualifying external events do not unlock trusted state', () => {
  it('application_sent does not unlock trusted for JobSearchPipeline', () => {
    const state = baseExternalState('JobSearchPipeline', {
      externalEvidenceEvents: [
        {
          type: 'external_evidence',
          goalId: GOAL_ID,
          cycleId: 'cycle-ext',
          dateISO: '2026-03-15',
          stage: 'application_sent', // user action, not external response
          confirmed: true,
        },
      ],
    });
    const result = scoreGoalSuccessProbability(GOAL_ID, state, CONSTRAINTS, NOW_ISO);
    expect(result.trustState).toBe('provisional');
    expect(result.value).toBeLessThanOrEqual(0.65);
  });

  it('deck_updated does not count as qualifying external evidence for Fundraising', () => {
    const state = baseExternalState('Fundraising', {
      externalEvidenceEvents: [
        {
          type: 'external_evidence',
          goalId: GOAL_ID,
          cycleId: 'cycle-ext',
          dateISO: '2026-03-15',
          stage: 'deck_updated', // user preparation action
          confirmed: true,
        },
      ],
    });
    const result = scoreGoalSuccessProbability(GOAL_ID, state, CONSTRAINTS, NOW_ISO);
    expect(result.trustState).toBe('provisional');
  });

  it('outreach_sent does not count as qualifying external evidence for SalesPipeline', () => {
    const state = baseExternalState('SalesPipeline', {
      externalEvidenceEvents: [
        {
          type: 'external_evidence',
          goalId: GOAL_ID,
          cycleId: 'cycle-ext',
          dateISO: '2026-03-15',
          stage: 'outreach_sent', // user action, prospect has not responded
          confirmed: true,
        },
      ],
    });
    const result = scoreGoalSuccessProbability(GOAL_ID, state, CONSTRAINTS, NOW_ISO);
    expect(result.trustState).toBe('provisional');
  });

  it('unconfirmed qualifying event does not unlock trusted', () => {
    const state = baseExternalState('JobSearchPipeline', {
      externalEvidenceEvents: [
        {
          type: 'external_evidence',
          goalId: GOAL_ID,
          cycleId: 'cycle-ext',
          dateISO: '2026-03-15',
          stage: 'recruiter_reply',
          confirmed: false, // pending confirmation
        },
      ],
    });
    const result = scoreGoalSuccessProbability(GOAL_ID, state, CONSTRAINTS, NOW_ISO);
    expect(result.trustState).toBe('provisional');
  });
});

// ─── POS-DOWN-3: external evidence recency expiry ─────────────────────────────

describe('POS-DOWN-3: external evidence recency expiry downgrades trusted to provisional', () => {
  it('stale external evidence (30+ days old) does not count toward trusted', () => {
    // NOW_ISO is 2026-03-20. 35 days prior = 2026-02-13. Outside the 30-day recency window.
    const state = baseExternalState('JobSearchPipeline', {
      externalEvidenceEvents: [
        {
          type: 'external_evidence',
          goalId: GOAL_ID,
          cycleId: 'cycle-ext',
          dateISO: '2026-02-13', // 35 days before NOW_ISO
          stage: 'recruiter_reply',
          confirmed: true,
        },
      ],
    });
    const result = scoreGoalSuccessProbability(GOAL_ID, state, CONSTRAINTS, NOW_ISO);
    expect(result.trustState).toBe('provisional');
  });

  it('fresh external evidence (within 30 days) still counts toward trusted', () => {
    // NOW_ISO is 2026-03-20. 15 days prior = 2026-03-05. Within the 30-day recency window.
    const state = baseExternalState('JobSearchPipeline', {
      externalEvidenceEvents: [
        {
          type: 'external_evidence',
          goalId: GOAL_ID,
          cycleId: 'cycle-ext',
          dateISO: '2026-03-05', // 15 days before NOW_ISO — within window
          stage: 'recruiter_reply',
          confirmed: true,
        },
      ],
    });
    const result = scoreGoalSuccessProbability(GOAL_ID, state, CONSTRAINTS, NOW_ISO);
    expect(result.trustState).toBe('trusted');
  });
});

// ─── Internally-controlled families unaffected by external evidence gate ──────

describe('Internally-controlled families unaffected by external evidence gate', () => {
  it('PhysicalTraining reaches trusted at 7 evidence days without external evidence', () => {
    const state = {
      activeCycleId: 'cycle-internal',
      cyclesById: {
        'cycle-internal': {
          id: 'cycle-internal',
          status: 'active',
          goalContract: {
            goalId: GOAL_ID,
            startDayKey: '2026-03-01',
            endDayKey: FUTURE_DEADLINE,
            familyClass: 'internally_controlled',
            archetype: 'PhysicalTraining',
          },
          goalGovernanceContract: governanceContract(GOAL_ID),
        },
      },
      goalWorkById: { [GOAL_ID]: [{ workItemId: 'w1', blocksRemaining: 5 }] },
      executionEvents: sevenDayInternalEvents(GOAL_ID, 'cycle-internal'),
      externalEvidenceEvents: [],
    };
    const result = scoreGoalSuccessProbability(GOAL_ID, state, CONSTRAINTS, NOW_ISO);
    expect(result.trustState).toBe('trusted');
  });

  it('internally-controlled provisional does not carry externally-mediated qualifier', () => {
    // PhysicalTraining with only 3 evidence days — provisional, but internally controlled
    const threeEvents = sevenDayInternalEvents(GOAL_ID, 'cycle-internal').slice(0, 3);
    const state = {
      activeCycleId: 'cycle-internal',
      cyclesById: {
        'cycle-internal': {
          id: 'cycle-internal',
          status: 'active',
          goalContract: {
            goalId: GOAL_ID,
            startDayKey: '2026-03-01',
            endDayKey: FUTURE_DEADLINE,
            familyClass: 'internally_controlled',
            archetype: 'PhysicalTraining',
          },
          goalGovernanceContract: governanceContract(GOAL_ID),
        },
      },
      goalWorkById: { [GOAL_ID]: [{ workItemId: 'w1', blocksRemaining: 5 }] },
      executionEvents: threeEvents,
      externalEvidenceEvents: [],
    };
    const result = scoreGoalSuccessProbability(GOAL_ID, state, CONSTRAINTS, NOW_ISO);
    expect(result.trustState).toBe('provisional');
    expect(result.qualifier).not.toBe(EXTERNALLY_MEDIATED_PROVISIONAL_QUALIFIER);
  });
});
