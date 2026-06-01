import React, { useEffect } from 'react';
import '@testing-library/jest-dom';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import GoalAdmissionPage from '../../src/ui/goalAdmission/GoalAdmissionPage';
import { buildValidGoalContract } from '../../src/domain/goal/testHelpers';

const mockGoalAdmissionFlow = vi.fn();

vi.mock('../../src/ui/goalAdmission/GoalAdmissionFlow', () => ({
  GoalAdmissionFlow: (props: any) => {
    mockGoalAdmissionFlow(props);
    useEffect(() => {
      props.onStateChange?.({
        currentScreen: 5,
        screen1: null,
        screen2: null,
        screen3: null,
        screen4: null,
        feasibilityResult: {
          status: 'CAPITAL_CONSTRAINED',
          constrainedGate: 'regulatory_consultant',
          estimatedRequirement: 5000,
          estimatedTiming: '2026-04-25',
          userCapital: 0,
          gap: 5000,
          explanation: 'Test constraint',
        },
        intakeFeasibilityReport: null,
        selectedPivot: 'white_label_lower_capital',
        immutabilityAcknowledged: true,
        workWindows: {
          mon: [{ start: '09:00', end: '11:00' }],
          tue: [],
          wed: [],
          thu: [],
          fri: [],
          sat: [],
          sun: [],
        },
      });
    }, []);

    return (
      <button
        type="button"
        onClick={() =>
          props.onGeneratePlan({
            goalClassification: 'regulated_physical_consumable',
            goalDescription: 'Launch a caffeinated gum brand',
            startDayKey: '2026-04-25',
            formulaPathway: 'custom_development',
            executionContext: 'full_time',
            weeklyHoursAvailable: 40,
            workWindows: null,
            capitalAvailable: 0,
            capitalAcquisitionRequired: false,
            capitalAcquisitionAssets: {
              existingAudience: {
                spotifyListeners: 23000,
                instagramFollowers: 1000,
                audienceRelationship: 'music_career',
                influencerNetwork: true,
                entrepreneurNetwork: true,
              },
              existingRevenue: {
                projectManagementCompany: true,
                allocationToPossible: true,
              },
            },
            hardDeadline: null,
            existingDomainRelationships: [],
            blackoutPeriods: [],
            stopCondition: null,
            capitalCommitmentConfidence: 'uncertain',
            targetCategory: 'functional_food',
            distributionChannel: 'direct_to_consumer',
          })
        }
      >
        Generate
      </button>
    );
  },
}));

describe('GoalAdmissionPage review submission', () => {
  it('promotes acknowledgment and selected pivot into the submitted contract', () => {
    const onContractChange = vi.fn();
    const onAdmit = vi.fn();
    const contract = buildValidGoalContract({
      commitmentDisclosureAccepted: false,
      commitmentDisclosureAcceptedAtISO: undefined,
      reinforcement: undefined as any,
      inscription: undefined as any,
    });

    render(
      <GoalAdmissionPage
        contract={contract}
        onContractChange={onContractChange}
        onAdmit={onAdmit}
        onAspire={vi.fn()}
        appTimeISO="2026-04-25T12:00:00.000Z"
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /generate/i }));

    expect(onContractChange.mock.calls.length).toBeGreaterThanOrEqual(1);
    const submittedContract = onContractChange.mock.calls.at(-1)[0];

    expect(submittedContract.commitmentDisclosureAccepted).toBe(true);
    expect(submittedContract.reinforcement.dailyExposureEnabled).toBe(true);
    expect(submittedContract.reinforcement.dailyMechanism).toMatch(/daily check-in/i);
    expect(submittedContract.inscription.acknowledgment).toMatch(/ready to generate my plan/i);
    expect(submittedContract.planningIntake.formulaPathway).toBe('white_label');
    expect(submittedContract.planningIntake.capitalAcquisitionRequired).toBe(true);
    expect(submittedContract.prePlanFeasibility.status).toBe('VIABLE_WITH_CAPITAL_ACQUISITION_REQUIRED');
    expect(submittedContract.goalDraftV2).toBeTruthy();
    expect(submittedContract.goalDraftV2.goalText).toMatch(/caffeinated gum brand/i);
    expect(submittedContract.goalDraftV2.executionType).toBeTruthy();
    expect(submittedContract.goalDraftV2.startDate).toBe('2026-04-25');

    expect(onAdmit).toHaveBeenCalledWith(submittedContract);
  });
});
