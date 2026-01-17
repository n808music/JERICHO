import { computeContractHash, hashField } from '../../src/domain/goal/GoalAdmissionPolicy';

const DEFAULT_DEADLINE = '2026-04-01';
const DEFAULT_START = '2026-01-20';

function buildBaseContract(overrides = {}) {
  const contract = {
    goalId: 'album-goal',
    cycleId: 'cycle-album',
    planGenerationMechanismClass: 'GENERIC_DETERMINISTIC',
    terminalOutcome: {
      text: 'Finish the first draft of the album',
      hash: hashField('Finish the first draft of the album'),
      verificationCriteria: 'Songs recorded and rough mix exported',
      isConcrete: true
    },
    deadline: {
      dayKey: DEFAULT_DEADLINE,
      isHardDeadline: true
    },
    sacrifice: {
      whatIsGivenUp: 'Weekend social events',
      duration: 'Jan-April',
      quantifiedImpact: '10 hrs/week',
      rationale: 'Focus on completing drafts',
      hash: hashField('Weekend social events')
    },
    temporalBinding: {
      daysPerWeek: 5,
      activationTime: '09:00',
      sessionDurationMinutes: 90,
      weeklyMinutes: 450,
      startDayKey: DEFAULT_START
    },
    causalChain: {
      steps: [
        { sequence: 1, description: 'Outline entire album structure' },
        { sequence: 2, description: 'Record rough vocals and instrumentation' },
        { sequence: 3, description: 'Revise arrangements and lyrics' },
        { sequence: 4, description: 'Finalize mixes and exports' }
      ],
      hash: hashField('Outline, record, revise, finalize')
    },
    reinforcement: {
      dailyExposureEnabled: true,
      dailyMechanism: 'Calendar block title + dashboard banner',
      checkInFrequency: 'DAILY',
      triggerDescription: 'Review progress each morning'
    },
    inscription: {
      contractHash: '',
      inscribedAtISO: new Date().toISOString(),
      acknowledgment: 'I commit to this goal',
      acknowledgmentHash: '',
      isCompromised: false
    },
    admissionStatus: 'PENDING',
    admissionAttemptCount: 0,
    rejectionCodes: [],
    createdAtISO: new Date().toISOString(),
    isAspirational: false
  };

  const merged = {
    ...contract,
    ...overrides,
    terminalOutcome: { ...contract.terminalOutcome, ...(overrides.terminalOutcome || {}) },
    sacrifice: { ...contract.sacrifice, ...(overrides.sacrifice || {}) },
    temporalBinding: { ...contract.temporalBinding, ...(overrides.temporalBinding || {}) },
    causalChain: { ...contract.causalChain, ...(overrides.causalChain || {}) },
    reinforcement: { ...contract.reinforcement, ...(overrides.reinforcement || {}) },
    deadline: { ...contract.deadline, ...(overrides.deadline || {}) },
    inscription: { ...contract.inscription, ...(overrides.inscription || {}) }
  };

  const hash = computeContractHash(merged);
  merged.inscription.contractHash = hash;
  merged.inscription.acknowledgmentHash = hash.slice(0, 16);
  merged.goalEquationHash = null;

  return merged;
}

export function standardAlbumGoalContract(overrides = {}) {
  return buildBaseContract(overrides);
}
