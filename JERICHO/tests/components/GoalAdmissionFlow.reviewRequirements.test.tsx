import React from 'react';
import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import GoalAdmissionFlow, { IntakeProgressState } from '../../src/ui/goalAdmission/GoalAdmissionFlow';

describe('GoalAdmissionFlow review requirements', () => {
  it('renders the review screen without a causal-chain authoring module', async () => {
    const savedState: IntakeProgressState = {
      currentScreen: 5,
      screen1: {
        goalDescription: 'Launch a caffeinated gum brand and make my first real sale.',
        goalType: 'physical_product',
        isConsumable: true,
        formulaPathway: 'white_label',
        targetCategory: 'functional_food',
        distributionChannel: 'direct_to_consumer',
      },
      screen2: {
        startDayKey: '2026-04-25',
        deadlineType: 'as_fast_as_possible',
        deadline: null,
        weeklyHoursAvailable: 20,
        executionContext: 'full_time',
        existingRelationships: ['none'],
        blackoutPeriods: [],
      },
      screen3: {
        capitalAvailable: 0,
        capitalAcquisitionRequired: true,
        audienceEntries: [],
        existingRevenue: true,
        capitalCommitmentConfidence: 'uncertain',
        stopCondition: '',
      },
      screen4: {
        legalEntityExists: 'no',
        entityType: null,
        entityState: null,
        entityPurpose: null,
        entityForThisGoal: null,
        locationState: 'IL',
        industryExperience: 'no',
      },
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
      immutabilityAcknowledged: false,
      workWindows: { mon: [], tue: [], wed: [], thu: [], fri: [], sat: [], sun: [] },
    };

    render(
      <GoalAdmissionFlow
        onGeneratePlan={vi.fn()}
        onAspire={vi.fn()}
        onStateChange={vi.fn()}
        appTimeISO="2026-04-25T12:00:00.000Z"
        savedState={savedState}
      />
    );
    expect(screen.getByText(/intake in progress/i)).toBeInTheDocument();
    expect(screen.getByText(/continue where you left off/i)).toBeInTheDocument();
  });

  it('shows work windows after resuming the review screen without causal-chain authoring', async () => {
    const savedState: IntakeProgressState = {
      currentScreen: 5,
      screen1: {
        goalDescription: 'Launch a caffeinated gum brand and make my first real sale.',
        goalType: 'physical_product',
        isConsumable: true,
        formulaPathway: 'white_label',
        targetCategory: 'functional_food',
        distributionChannel: 'direct_to_consumer',
      },
      screen2: {
        startDayKey: '2026-04-25',
        deadlineType: 'as_fast_as_possible',
        deadline: null,
        weeklyHoursAvailable: 20,
        executionContext: 'full_time',
        existingRelationships: ['none'],
        blackoutPeriods: [],
      },
      screen3: {
        capitalAvailable: 0,
        capitalAcquisitionRequired: true,
        audienceEntries: [],
        existingRevenue: true,
        capitalCommitmentConfidence: 'uncertain',
        stopCondition: '',
      },
      screen4: {
        legalEntityExists: 'no',
        entityType: null,
        entityState: null,
        entityPurpose: null,
        entityForThisGoal: null,
        locationState: 'IL',
        industryExperience: 'no',
      },
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
      immutabilityAcknowledged: false,
      workWindows: { mon: [], tue: [], wed: [], thu: [], fri: [], sat: [], sun: [] },
    };

    render(
      <GoalAdmissionFlow
        onGeneratePlan={vi.fn()}
        onAspire={vi.fn()}
        onStateChange={vi.fn()}
        appTimeISO="2026-04-25T12:00:00.000Z"
        savedState={savedState}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /continue where you left off/i }));

    await waitFor(() => expect(screen.getByText(/work windows/i)).toBeInTheDocument());
    expect(screen.queryByText(/causal chain/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/outline the steps from today to your terminal outcome/i)).not.toBeInTheDocument();
  });

  it('requires target category and distribution channel for consumable products on screen 1', async () => {
    render(
      <GoalAdmissionFlow
        onGeneratePlan={vi.fn()}
        onAspire={vi.fn()}
        onStateChange={vi.fn()}
        appTimeISO="2026-04-25T12:00:00.000Z"
      />
    );

    fireEvent.change(screen.getByLabelText(/describe your goal/i), {
      target: { value: 'Launch a caffeinated gum brand and make my first real sale.' },
    });
    fireEvent.click(screen.getByLabelText(/physical product/i));
    fireEvent.click(screen.getByLabelText(/yes — it is ingested/i));
    fireEvent.click(screen.getByLabelText(/use a manufacturer's existing formula/i));
    fireEvent.click(screen.getByRole('button', { name: /continue/i }));

    expect(await screen.findByText(/please select the product category/i)).toBeInTheDocument();
  });
});
