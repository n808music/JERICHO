import { GoalExecutionContract } from './GoalExecutionContract';
import { hashField, computeContractHash } from './GoalAdmissionPolicy';

const NOW_ISO = '2026-01-10T12:00:00.000Z';
const DEADLINE_VALID = '2026-02-15';

export function buildValidGoalContract(overrides: Partial<GoalExecutionContract> = {}): GoalExecutionContract {
  const base: GoalExecutionContract = {
    goalId: 'goal-1',
    cycleId: 'cycle-1',
    planGenerationMechanismClass: 'GENERIC_DETERMINISTIC',
    terminalOutcome: {
      text: 'Complete the JERICHO implementation',
      hash: hashField('Complete the JERICHO implementation'),
      verificationCriteria: 'All modules deployed and tested in production',
      isConcrete: true
    },
    deadline: {
      dayKey: DEADLINE_VALID,
      isHardDeadline: true
    },
    sacrifice: {
      whatIsGivenUp: 'Free time on weekends',
      duration: '6 weeks',
      quantifiedImpact: '8 hours/week',
      rationale: 'Weekend time needed for focused development',
      hash: hashField('Free time on weekends')
    },
    temporalBinding: {
      daysPerWeek: 5,
      activationTime: '09:00',
      sessionDurationMinutes: 120,
      weeklyMinutes: 600,
      startDayKey: '2026-01-10'
    },
    causalChain: {
      steps: [
        { sequence: 1, description: 'Design API schema', approximateDayOffset: 7 },
        { sequence: 2, description: 'Implement core services', approximateDayOffset: 14 },
        { sequence: 3, description: 'Build UI components', approximateDayOffset: 21 },
        { sequence: 4, description: 'Deploy to production', approximateDayOffset: 35 }
      ],
      hash: hashField('design-implement-build-deploy')
    },
    reinforcement: {
      dailyExposureEnabled: true,
      dailyMechanism: 'Calendar block title + dashboard banner',
      checkInFrequency: 'DAILY',
      triggerDescription: 'Every morning at 6 AM'
    },
    inscription: {
      contractHash: 'abc123def456',
      inscribedAtISO: NOW_ISO,
      acknowledgment: 'I understand this is binding',
      acknowledgmentHash: hashField('I understand this is binding'),
      isCompromised: false
    },
    admissionStatus: 'PENDING',
    admissionAttemptCount: 0,
    rejectionCodes: [],
    createdAtISO: NOW_ISO,
    isAspirational: false,
    commitmentDisclosureAccepted: true,
    commitmentDisclosureAcceptedAtISO: NOW_ISO
  };
  const contract = {
    ...base,
    ...overrides
  } as GoalExecutionContract;
  if (contract.inscription) {
    contract.inscription.contractHash = computeContractHash(contract);
  }
  return contract;
}
