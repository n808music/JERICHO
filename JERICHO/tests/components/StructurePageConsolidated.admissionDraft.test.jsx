import { describe, expect, it } from 'vitest';
import { buildAdmissionDraftFromPendingInputs } from '../../src/components/zion/StructurePageConsolidated.jsx';

describe('buildAdmissionDraftFromPendingInputs', () => {
  it('preserves active contract fields while tolerating legacy sacrifice data when rebuilding from pending inputs', () => {
    const draft = buildAdmissionDraftFromPendingInputs({
      goalText: 'Raise 25k',
      executionType: 'Fundraising',
      goalDraftV2: {
        goalText: 'Raise 25k',
        goalLabel: 'Raise 25k',
        executionType: 'Fundraising',
      },
      goalContract: {
        executionType: 'Fundraising',
        terminalOutcome: {
          text: 'Raise 25k',
          verificationCriteria: '25k committed',
          isConcrete: true,
        },
        deadline: { dayKey: '2026-04-15', isHardDeadline: true },
        sacrifice: {
          whatIsGivenUp: 'Weekend leisure',
          duration: 'Until deadline',
          quantifiedImpact: '6 hours/week',
          rationale: 'Creates focused build time',
        },
        reinforcement: {
          dailyExposureEnabled: true,
          dailyMechanism: 'Morning review',
          checkInFrequency: 'daily',
        },
        workWindows: { mon: [], tue: [], wed: [], thu: [], fri: [], sat: [], sun: [] },
        commitmentDisclosureAccepted: true,
      },
    });

    expect(draft.reinforcement).toEqual({
      dailyExposureEnabled: true,
      dailyMechanism: 'Morning review',
      checkInFrequency: 'daily',
    });
    expect(draft.commitmentDisclosureAccepted).toBe(true);
    expect(draft.deadline).toEqual({ dayKey: '2026-04-15', isHardDeadline: true });
    expect(draft.goalIntakeContract).toBeTruthy();
    expect(draft.goalIntakeContract.readiness.isReadyForPlanning).toBe(true);
  });
});
