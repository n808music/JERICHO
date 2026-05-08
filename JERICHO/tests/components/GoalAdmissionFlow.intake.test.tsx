import React from 'react';
import '@testing-library/jest-dom';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import GoalAdmissionFlow from '../../src/ui/goalAdmission/GoalAdmissionFlow';
import type { IntakeProgressState } from '../../src/ui/goalAdmission/GoalAdmissionFlow';
import type { PrePlanFeasibilityResult, IntakeFeasibilityReport } from '../../src/domain/goal/prePlanFeasibility';
import { evaluatePrePlanFeasibility, prePlanFeasibility } from '../../src/domain/goal/prePlanFeasibility';

vi.mock('../../src/domain/goal/prePlanFeasibility', () => ({
  evaluatePrePlanFeasibility: vi.fn(),
  prePlanFeasibility: vi.fn(),
}));

const DEFAULT_VIABLE_RESULT: PrePlanFeasibilityResult = {
  status: 'VIABLE',
  explanation: 'Default viable for testing',
};

const DEFAULT_INTAKE_REPORT = {
  status: 'VIABLE',
  standardPathCompletionMonths: 12,
  capitalRequired: {},
  totalCapitalRequired: { min: 0, max: 0, criticalGate: 'none', criticalGateAmount: 0, criticalGateTiming: 'n/a' },
  recommendedPathway: 'white_label' as const,
  pathwayReasoning: 'mock',
} satisfies IntakeFeasibilityReport;

const GUM_VIABLE_RESULT: PrePlanFeasibilityResult = {
  status: 'VIABLE_WITH_CAPITAL_ACQUISITION_REQUIRED',
  explanation: 'Capital acquisition required via presale track.',
  recommendedPathway: 'white_label',
  criticalGate: 'phase4_moq_deposit',
  criticalGateAmount: 5000,
  criticalGateTiming: 'month_7',
};

const GUM_INTAKE_REPORT: IntakeFeasibilityReport = {
  status: 'VIABLE',
  standardPathCompletionMonths: 14,
  capitalRequired: {
    phase1_entity_and_insurance: {
      min: 150,
      max: 500,
      timing: 'month_1',
      description: 'Illinois LLC filing or Series LLC investigation, EIN, business bank account',
    },
    phase3_label_review: {
      min: 500,
      max: 1500,
      timing: 'month_4',
      description: 'Third-party food label review. Illinois has strict food labeling requirements. Do not skip.',
    },
  },
  totalCapitalRequired: {
    min: 5000,
    max: 8000,
    criticalGate: 'phase4_moq_deposit',
    criticalGateAmount: 5000,
    criticalGateTiming: 'month_7',
  },
  recommendedPathway: 'white_label',
  pathwayReasoning: 'mock',
  capitalAcquisitionPath: {
    primaryStrategy: 'presale',
    reasoning: 'Spotify audience sufficient for presale campaign',
    presaleMath: {
      target: 8000,
      suggestedUnitPrice: 40,
      unitsRequired: 200,
      audienceConversionRequired: 200 / 23000,
      interpretation:
        'At 23k Spotify listeners, 0.87% conversion funds initial production.',
    },
  },
};

describe('GoalAdmissionFlow - Structured Intake UI', () => {
  const mockOnGeneratePlan = vi.fn();
  const mockOnAspire = vi.fn();
  const mockOnStateChange = vi.fn();
  const mockOnPlanningTierRouted = vi.fn();

  const defaultProps = {
    onGeneratePlan: mockOnGeneratePlan,
    onAspire: mockOnAspire,
    onStateChange: mockOnStateChange,
    appTimeISO: '2026-04-25T12:00:00.000Z',
    onPlanningTierRouted: mockOnPlanningTierRouted,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(evaluatePrePlanFeasibility).mockReturnValue(DEFAULT_VIABLE_RESULT);
    vi.mocked(prePlanFeasibility).mockReturnValue(DEFAULT_INTAKE_REPORT);
  });

  describe('Screen progression', () => {
    it('routes multi-lane ecosystem goals into master-plan classification from the first screen', async () => {
      const user = userEvent.setup();
      render(<GoalAdmissionFlow {...defaultProps} />);

      const goalDescription = screen.getByLabelText(/describe your goal/i);
      await user.type(
        goalDescription,
        'Build and coordinate a multi-lane master plan from today through October 17, centered on releasing my album and launching the supporting ecosystem around it, including the app, podcast, PM brand, and income runway.'
      );

      await user.click(screen.getByLabelText('Other'));
      await user.click(screen.getByRole('button', { name: /^continue$/i }));

      expect(mockOnPlanningTierRouted).toHaveBeenCalledWith(
        expect.objectContaining({
          planningTier: 'master_plan',
        })
      );
      expect(screen.getByText('What are you trying to do?')).toBeInTheDocument();
    });

    it('Screen 1 advances to Screen 2 on valid input', async () => {
      const user = userEvent.setup();
      render(<GoalAdmissionFlow {...defaultProps} />);

      const goalDescription = screen.getByLabelText(/describe your goal/i);
      await user.type(goalDescription, 'Launch a caffeinated gum brand and make my first real sale.');

      const physicalProductRadio = screen.getByLabelText('Physical product');
      await user.click(physicalProductRadio);

      const consumableYes = screen.getByLabelText(/it is ingested/i);
      await user.click(consumableYes);

      const whiteLabelRadio = screen.getByLabelText(/use a manufacturer's existing formula/i);
      await user.click(whiteLabelRadio);

      const continueButton = screen.getByRole('button', { name: /continue/i });
      await user.click(continueButton);

      await waitFor(() => {
        expect(screen.getByText('When and how?')).toBeInTheDocument();
      });
    });

    it('Screen 1 does not advance with empty goal description', async () => {
      const user = userEvent.setup();
      render(<GoalAdmissionFlow {...defaultProps} />);

      const continueButton = screen.getByRole('button', { name: /continue/i });
      await user.click(continueButton);

      expect(screen.getByText('What are you trying to do?')).toBeInTheDocument();
      expect(screen.getByText(/please describe your goal/i)).toBeInTheDocument();
    });

    it('Screen 1 shows formula pathway when consumable selected', async () => {
      const user = userEvent.setup();
      render(<GoalAdmissionFlow {...defaultProps} />);

      const physicalProductRadio = screen.getByLabelText('Physical product');
      await user.click(physicalProductRadio);

      const consumableYes = screen.getByLabelText(/it is ingested/i);
      await user.click(consumableYes);

      expect(screen.getByText(/how do you plan to develop the product formula/i)).toBeInTheDocument();
    });

    it('Screen 1 does not show formula pathway for non-physical goals', async () => {
      const user = userEvent.setup();
      render(<GoalAdmissionFlow {...defaultProps} />);

      const digitalProductRadio = screen.getByLabelText('Digital product');
      await user.click(digitalProductRadio);

      expect(screen.queryByText(/how do you plan to develop the product formula/i)).not.toBeInTheDocument();
    });

    it('Back button from Screen 2 returns to Screen 1 with data preserved', async () => {
      const user = userEvent.setup();
      render(<GoalAdmissionFlow {...defaultProps} />);

      const goalDescription = screen.getByLabelText(/describe your goal/i);
      await user.type(goalDescription, 'Test goal description for my plan');

      const digitalProductRadio = screen.getByLabelText('Digital product');
      await user.click(digitalProductRadio);

      const continueButton = screen.getByRole('button', { name: /continue/i });
      await user.click(continueButton);

      await waitFor(() => {
        expect(screen.getByText('When and how?')).toBeInTheDocument();
      });

      const backButton = screen.getByRole('button', { name: /back/i });
      await user.click(backButton);

      expect(screen.getByText('What are you trying to do?')).toBeInTheDocument();
    });

    it('Back button from Screen 3 returns to Screen 2 with data preserved', async () => {
      const user = userEvent.setup();
      render(<GoalAdmissionFlow {...defaultProps} />);

      await fillScreen1(user);
      await advanceToScreen2(user);
      await fillScreen2(user);
      await advanceToScreen3(user);

      const backButton = screen.getByRole('button', { name: /back/i });
      await user.click(backButton);

      expect(screen.getByText('When and how?')).toBeInTheDocument();
    });

    it('Back button from Screen 4 returns to Screen 3 with data preserved', async () => {
      const user = userEvent.setup();
      render(<GoalAdmissionFlow {...defaultProps} />);

      await fillScreen1(user);
      await advanceToScreen2(user);
      await fillScreen2(user);
      await advanceToScreen3(user);
      await fillScreen3(user);
      await advanceToScreen4(user);

      const backButton = screen.getByRole('button', { name: /back/i });
      await user.click(backButton);

      expect(screen.getByText('How much money?')).toBeInTheDocument();
    });
  });

  describe('Field mapping', () => {
    it('"Primary focus" maps to executionContext full_time', async () => {
      const user = userEvent.setup();
      render(<GoalAdmissionFlow {...defaultProps} />);

      await fillScreen1(user);
      await advanceToScreen2(user);

      const primaryFocusRadio = screen.getByLabelText(/this is my main focus/i);
      await user.click(primaryFocusRadio);

      await fillScreen2(user);
      await advanceToScreen3(user);
      await fillScreen3(user);
      await advanceToScreen4(user);
      await fillScreen4(user);
      await advanceToScreen5(user);

      await addWorkWindowAndAcknowledge(user);

      const generateButton = screen.getByRole('button', { name: /generate plan/i });
      await user.click(generateButton);

      expect(mockOnGeneratePlan).toHaveBeenCalledWith(
        expect.objectContaining({ executionContext: 'full_time' })
      );
    });

    it('"Alongside other commitment" maps to part_time', async () => {
      const user = userEvent.setup();
      render(<GoalAdmissionFlow {...defaultProps} />);

      await fillScreen1(user);
      await advanceToScreen2(user);

      // Fill Screen 2 inline so executionContext isn't overwritten by fillScreen2
      await user.click(screen.getByLabelText(/as fast as realistically possible/i));
      const weeklyHoursInput = screen.getByLabelText(/how many hours per week/i);
      await user.clear(weeklyHoursInput);
      await user.type(weeklyHoursInput, '20');
      await user.click(screen.getByLabelText(/alongside a full-time job/i));
      await advanceToScreen3(user);
      await fillScreen3(user);
      await advanceToScreen4(user);
      await fillScreen4(user);
      await advanceToScreen5(user);

      await addWorkWindowAndAcknowledge(user);

      const generateButton = screen.getByRole('button', { name: /generate plan/i });
      await user.click(generateButton);

      expect(mockOnGeneratePlan).toHaveBeenCalledWith(
        expect.objectContaining({ executionContext: 'part_time' })
      );
    });

    it('"Existing formula my branding" maps to white_label', async () => {
      const user = userEvent.setup();
      render(<GoalAdmissionFlow {...defaultProps} />);

      // Inline Screen 1 for physical/consumable/white_label (cannot use fillScreen1 which selects digital_product)
      const goalDescription = screen.getByLabelText(/describe your goal/i);
      await user.type(goalDescription, 'Test goal description for my plan');
      await user.click(screen.getByLabelText('Physical product'));
      await user.click(screen.getByLabelText(/it is ingested/i));
      await user.click(screen.getByLabelText(/use a manufacturer's existing formula/i));

      await advanceToScreen2(user);
      await fillScreen2ForPhysical(user);
      await advanceToScreen3(user);
      await fillScreen3(user);
      await advanceToScreen4(user);
      await fillScreen4(user);
      await advanceToScreen5(user);

      await addWorkWindowAndAcknowledge(user);

      const generateButton = screen.getByRole('button', { name: /generate plan/i });
      await user.click(generateButton);

      expect(mockOnGeneratePlan).toHaveBeenCalledWith(
        expect.objectContaining({ formulaPathway: 'white_label' })
      );
    });

    it('"Help me decide" maps to undecided (null formula pathway)', async () => {
      const user = userEvent.setup();
      render(<GoalAdmissionFlow {...defaultProps} />);

      // Inline Screen 1 for physical/consumable/undecided
      const goalDescription = screen.getByLabelText(/describe your goal/i);
      await user.type(goalDescription, 'Test goal description for my plan');
      await user.click(screen.getByLabelText('Physical product'));
      await user.click(screen.getByLabelText(/it is ingested/i));
      await user.click(screen.getByLabelText(/help me decide/i));

      await advanceToScreen2(user);
      await fillScreen2ForPhysical(user);
      await advanceToScreen3(user);
      await fillScreen3(user);
      await advanceToScreen4(user);
      await fillScreen4(user);
      await advanceToScreen5(user);

      await addWorkWindowAndAcknowledge(user);

      const generateButton = screen.getByRole('button', { name: /generate plan/i });
      await user.click(generateButton);

      expect(mockOnGeneratePlan).toHaveBeenCalledWith(
        expect.objectContaining({ formulaPathway: null })
      );
    });

    it('capitalAcquisitionRequired true when capital < 5000', async () => {
      const user = userEvent.setup();
      render(<GoalAdmissionFlow {...defaultProps} />);

      await fillScreen1(user);
      await advanceToScreen2(user);
      await fillScreen2(user);
      await advanceToScreen3(user);

      // Set capital < 5000 atomically to avoid intermediate values triggering sticky flag
      const capitalInput = screen.getByLabelText(/how much capital do you have/i);
      fireEvent.change(capitalInput, { target: { value: '2000' } });

      // Audience section appears since capital < 5000
      const addAudienceButton = screen.getByRole('button', { name: /add audience platform/i });
      await user.click(addAudienceButton);
      const confirmedConfidence = screen.getByLabelText(/confirmed — it is available now/i);
      await user.click(confirmedConfidence);

      await advanceToScreen4(user);
      await fillScreen4(user);
      await advanceToScreen5(user);

      await addWorkWindowAndAcknowledge(user);

      const generateButton = screen.getByRole('button', { name: /generate plan/i });
      await user.click(generateButton);

      expect(mockOnGeneratePlan).toHaveBeenCalledWith(
        expect.objectContaining({
          capitalAvailable: 2000,
          capitalAcquisitionRequired: true,
        })
      );
    });

    it('audience entry required when capitalAcquisitionRequired true', async () => {
      const user = userEvent.setup();
      render(<GoalAdmissionFlow {...defaultProps} />);

      await fillScreen1(user);
      await advanceToScreen2(user);
      await fillScreen2(user);
      await advanceToScreen3(user);

      // Use fireEvent to set 1000 atomically (< 5000 triggers acquisition section)
      const capitalInput = screen.getByLabelText(/how much capital do you have/i);
      fireEvent.change(capitalInput, { target: { value: '1000' } });

      await waitFor(() => {
        expect(screen.getByText(/do you have an existing audience/i)).toBeInTheDocument();
      });

      // Set confidence (required field — validation checks this before audience)
      const confirmedConfidence = screen.getByLabelText(/confirmed — it is available now/i);
      await user.click(confirmedConfidence);

      // Click Continue WITHOUT adding audience
      const continueButton = screen.getByRole('button', { name: /continue/i });
      await user.click(continueButton);

      expect(screen.getByText(/please add at least one audience platform/i)).toBeInTheDocument();
    });

    it('"Different business" entity maps gumEntityExists to false', async () => {
      const user = userEvent.setup();
      render(<GoalAdmissionFlow {...defaultProps} />);

      await fillScreen1(user);
      await advanceToScreen2(user);
      await fillScreen2(user);
      await advanceToScreen3(user);
      await fillScreen3(user);
      await advanceToScreen4(user);

      const yesEntity = screen.getByLabelText(/^yes$/i);
      await user.click(yesEntity);

      await user.selectOptions(screen.getByLabelText(/entity type/i), 'LLC');
      await user.selectOptions(screen.getByLabelText(/entity state/i), 'IL');

      const purposeInput = screen.getByPlaceholderText(/e\.g\., project management/i);
      await user.type(purposeInput, 'Different business consulting');

      const differentBusinessRadio = screen.getByLabelText(/different business/i);
      await user.click(differentBusinessRadio);

      await fillScreen4(user);
      await advanceToScreen5(user);

      await addWorkWindowAndAcknowledge(user);

      const generateButton = screen.getByRole('button', { name: /generate plan/i });
      await user.click(generateButton);

      expect(mockOnGeneratePlan).toHaveBeenCalledWith(
        expect.objectContaining({
          legalFoundation: expect.objectContaining({ gumEntityExists: false }),
        })
      );
    });
  });

  describe('Feasibility screen', () => {
    it('Screen 5 shows VIABLE state correctly', async () => {
      const user = userEvent.setup();
      render(<GoalAdmissionFlow {...defaultProps} />);

      await fillAllScreens(user);

      await waitFor(() => {
        expect(screen.getByText('Your goal is viable.')).toBeInTheDocument();
      });
    });

    it('Screen 5 shows CAPITAL_CONSTRAINED with gap amount', async () => {
      vi.mocked(evaluatePrePlanFeasibility).mockReturnValue({
        status: 'CAPITAL_CONSTRAINED',
        explanation: 'Capital constrained explanation.',
        constrainedGate: 'production_deposit',
        estimatedRequirement: 8000,
        estimatedTiming: 'month 7',
        userCapital: 2000,
        gap: 6000,
      });

      const user = userEvent.setup();
      render(<GoalAdmissionFlow {...defaultProps} />);

      await fillAllScreens(user);

      await waitFor(() => {
        expect(screen.getByText(/requires more capital than you currently have/i)).toBeInTheDocument();
        expect(screen.getByText('$6,000')).toBeInTheDocument();
      });
    });

    it('Screen 5 shows VIABLE_WITH_CAPITAL_ACQUISITION with presale-math block', async () => {
      vi.mocked(evaluatePrePlanFeasibility).mockReturnValue({
        status: 'VIABLE_WITH_CAPITAL_ACQUISITION_REQUIRED',
        explanation: 'Viable with capital acquisition',
        recommendedPathway: 'white_label',
        criticalGate: 'phase4_moq_deposit',
        criticalGateAmount: 5000,
        criticalGateTiming: 'month_7',
      });
      vi.mocked(prePlanFeasibility).mockReturnValue({
        ...DEFAULT_INTAKE_REPORT,
        capitalAcquisitionPath: {
          primaryStrategy: 'presale',
          reasoning: 'audience available',
          presaleMath: {
            target: 8000,
            suggestedUnitPrice: 40,
            unitsRequired: 200,
            audienceConversionRequired: 0.0087,
            interpretation: 'test interpretation',
          },
        },
      });

      const user = userEvent.setup();
      render(<GoalAdmissionFlow {...defaultProps} />);

      await fillAllScreens(user);

      await waitFor(() => {
        expect(screen.getByText(/viable with a capital acquisition track/i)).toBeInTheDocument();
        expect(screen.getByTestId('presale-math')).toBeInTheDocument();
      });
    });

    it('Screen 5 shows pivot options for VIABLE_WITH_ADJUSTED_TIMELINE', async () => {
      vi.mocked(evaluatePrePlanFeasibility).mockReturnValue({
        status: 'VIABLE_WITH_ADJUSTED_TIMELINE',
        explanation: 'Timeline constraint explanation.',
        statedDeadline: '2026-08-25',
        realisticMinimumDate: '2026-12-25',
        primaryConstraint: 'regulatory_review',
      });

      const user = userEvent.setup();
      render(<GoalAdmissionFlow {...defaultProps} />);

      await fillAllScreens(user);

      await waitFor(() => {
        expect(screen.getByText(/viable, but not by/i)).toBeInTheDocument();
      });

      expect(screen.getAllByRole('button', { name: /use this approach/i })).toHaveLength(3);
    });

    it('Generate plan button disabled until immutability checkbox checked', async () => {
      const user = userEvent.setup();
      render(<GoalAdmissionFlow {...defaultProps} />);

      await fillAllScreens(user);

      await waitFor(() => {
        expect(screen.getByText('Your goal is viable.')).toBeInTheDocument();
      });

      const generateButton = screen.getByRole('button', { name: /generate plan/i });
      expect(generateButton).toBeDisabled();

      const checkbox = screen.getByLabelText(/i understand and am ready/i);
      await user.click(checkbox);

      expect(screen.getByRole('button', { name: /generate plan/i })).not.toBeDisabled();
    });

    it('Generate plan dispatches onGeneratePlan with assembled intake', async () => {
      const user = userEvent.setup();
      render(<GoalAdmissionFlow {...defaultProps} />);

      await fillAllScreens(user);

      await waitFor(() => {
        expect(screen.getByText('Your goal is viable.')).toBeInTheDocument();
      });

      await addWorkWindowAndAcknowledge(user);

      const generateButton = screen.getByRole('button', { name: /generate plan/i });
      await user.click(generateButton);

      expect(mockOnGeneratePlan).toHaveBeenCalledWith(
        expect.objectContaining({
          goalClassification: expect.any(String),
        })
      );
    });
  });

  describe('Removed surfaces', () => {
    it('Causal Chain section is not rendered', () => {
      render(<GoalAdmissionFlow {...defaultProps} />);
      expect(screen.queryByText(/causal chain/i)).not.toBeInTheDocument();
    });

    it('Reinforcement Disclosure section is not rendered', () => {
      render(<GoalAdmissionFlow {...defaultProps} />);
      expect(screen.queryByText(/reinforcement disclosure/i)).not.toBeInTheDocument();
    });

    it('Sacrifice field is not rendered', () => {
      render(<GoalAdmissionFlow {...defaultProps} />);
      expect(screen.queryByText(/sacrifice/i)).not.toBeInTheDocument();
    });

    it('Inscription section renders only on Screen 5 not as standalone step', async () => {
      const user = userEvent.setup();
      render(<GoalAdmissionFlow {...defaultProps} />);

      expect(screen.queryByText(/immutable/i)).not.toBeInTheDocument();

      await fillAllScreens(user);

      await waitFor(() => {
        expect(screen.getByText(/immutable/i)).toBeInTheDocument();
      });
    });
  });

  describe('Gum goal acceptance', () => {
    beforeEach(() => {
      vi.mocked(evaluatePrePlanFeasibility).mockReturnValue(GUM_VIABLE_RESULT);
      vi.mocked(prePlanFeasibility).mockReturnValue(GUM_INTAKE_REPORT);
    });

    it('Completing all screens with gum founder intake produces VIABLE_WITH_CAPITAL_ACQUISITION_REQUIRED on Screen 5', async () => {
      const user = userEvent.setup();
      render(<GoalAdmissionFlow {...defaultProps} />);

      await fillGumGoalData(user);

      await waitFor(() => {
        expect(screen.getByText(/viable with a capital acquisition track/i)).toBeInTheDocument();
      });
    });

    it('Screen 5 shows presale math: 200 orders, $40, $8000 target, 0.87% conversion', async () => {
      const user = userEvent.setup();
      render(<GoalAdmissionFlow {...defaultProps} />);

      await fillGumGoalData(user);

      await waitFor(() => {
        const presaleSection = screen.getByTestId('presale-math');
        expect(presaleSection).toHaveTextContent('$8,000');
        expect(presaleSection).toHaveTextContent('$40');
        expect(presaleSection).toHaveTextContent('200');
        expect(presaleSection).toHaveTextContent('0.87%');
      });
    });

    it('Screen 5 shows Illinois label review in capital gate sequence', async () => {
      const user = userEvent.setup();
      render(<GoalAdmissionFlow {...defaultProps} />);

      await fillGumGoalData(user);

      await waitFor(() => {
        expect(screen.getByText(/illinois.*strict food labeling/i)).toBeInTheDocument();
      });
    });

    it('Screen 5 shows Series LLC option surfaced for Illinois founder with existing LLC for different business', async () => {
      const user = userEvent.setup();
      render(<GoalAdmissionFlow {...defaultProps} />);

      await fillGumGoalData(user);

      await waitFor(() => {
        expect(screen.getByText(/series llc/i)).toBeInTheDocument();
      });
    });
  });

  describe('Abandonment recovery', () => {
    it('Navigating away mid-flow preserves IntakeProgressState via onStateChange', () => {
      render(<GoalAdmissionFlow {...defaultProps} />);

      const goalDescription = screen.getByLabelText(/describe your goal/i);
      fireEvent.change(goalDescription, { target: { value: 'Test goal' } });

      expect(mockOnStateChange).toHaveBeenCalledWith(
        expect.objectContaining({
          currentScreen: 1,
          screen1: expect.objectContaining({ goalDescription: 'Test goal' }),
        })
      );
    });

    it('Returning to admission route with savedState offers continue or start over', () => {
      const savedState: IntakeProgressState = {
        currentScreen: 2,
        screen1: {
          goalDescription: 'Saved goal description',
          goalType: 'digital_product',
          isConsumable: null,
          formulaPathway: null,
        },
        screen2: null,
        screen3: null,
        screen4: null,
        feasibilityResult: null,
        intakeFeasibilityReport: null,
        selectedPivot: null,
        immutabilityAcknowledged: false,
        workWindows: {},
      };

      render(<GoalAdmissionFlow {...defaultProps} savedState={savedState} />);

      expect(screen.getByText(/intake in progress/i)).toBeInTheDocument();
      expect(screen.getByText(/continue where you left off/i)).toBeInTheDocument();
      expect(screen.getByText(/start over/i)).toBeInTheDocument();
    });

    it('Start over clears IntakeProgressState and returns to Screen 1', async () => {
      const user = userEvent.setup();
      const savedState: IntakeProgressState = {
        currentScreen: 2,
        screen1: {
          goalDescription: 'Saved goal description',
          goalType: 'digital_product',
          isConsumable: null,
          formulaPathway: null,
        },
        screen2: null,
        screen3: null,
        screen4: null,
        feasibilityResult: null,
        intakeFeasibilityReport: null,
        selectedPivot: null,
        immutabilityAcknowledged: false,
        workWindows: {},
      };

      render(<GoalAdmissionFlow {...defaultProps} savedState={savedState} />);

      const startOverButton = screen.getByText(/start over/i);
      await user.click(startOverButton);

      expect(screen.getByText('What are you trying to do?')).toBeInTheDocument();
      const ta = screen.getByLabelText(/describe your goal/i) as HTMLTextAreaElement;
      expect(ta.value).not.toBe('Saved goal description');
    });
  });

  // ─── Helpers ───────────────────────────────────────────────────────────────

  async function fillScreen1(user: ReturnType<typeof userEvent.setup>) {
    const goalDescription = screen.getByLabelText(/describe your goal/i);
    const current = (goalDescription as HTMLTextAreaElement).value;
    if (!current || current.trim().length < 10) {
      await user.clear(goalDescription);
      await user.type(goalDescription, 'Test goal description for my plan');
    }
    if (!screen.queryByLabelText('Digital product')?.matches(':checked')) {
      const digitalProductRadio = screen.getByLabelText('Digital product');
      await user.click(digitalProductRadio);
    }
  }

  async function advanceToScreen2(user: ReturnType<typeof userEvent.setup>) {
    const continueButton = screen.getByRole('button', { name: /continue/i });
    await user.click(continueButton);
    await waitFor(() => {
      expect(screen.getByText('When and how?')).toBeInTheDocument();
    });
  }

  async function fillScreen2(user: ReturnType<typeof userEvent.setup>) {
    const asFastAsPossibleRadio = screen.getByLabelText(/as fast as realistically possible/i);
    await user.click(asFastAsPossibleRadio);

    const weeklyHoursInput = screen.getByLabelText(/how many hours per week/i);
    await user.clear(weeklyHoursInput);
    await user.type(weeklyHoursInput, '20');

    const primaryFocusRadio = screen.getByLabelText(/this is my main focus/i);
    await user.click(primaryFocusRadio);
    // No relationship checkbox for digital_product goals
  }

  async function fillScreen2ForPhysical(user: ReturnType<typeof userEvent.setup>) {
    const asFastAsPossibleRadio = screen.getByLabelText(/as fast as realistically possible/i);
    await user.click(asFastAsPossibleRadio);

    const weeklyHoursInput = screen.getByLabelText(/how many hours per week/i);
    await user.clear(weeklyHoursInput);
    await user.type(weeklyHoursInput, '20');

    const primaryFocusRadio = screen.getByLabelText(/this is my main focus/i);
    await user.click(primaryFocusRadio);

    const noneRelationship = screen.getByLabelText('None of the above — starting from scratch');
    await user.click(noneRelationship);
  }

  async function advanceToScreen3(user: ReturnType<typeof userEvent.setup>) {
    const continueButton = screen.getByRole('button', { name: /continue/i });
    await user.click(continueButton);
    await waitFor(() => {
      expect(screen.getByText('How much money?')).toBeInTheDocument();
    });
  }

  async function fillScreen3(user: ReturnType<typeof userEvent.setup>) {
    // Use fireEvent.change to avoid intermediate < 5000 values triggering the
    // sticky capitalAcquisitionRequired flag (user.type fires onChange per keystroke)
    const capitalInput = screen.getByLabelText(/how much capital do you have/i);
    fireEvent.change(capitalInput, { target: { value: '10000' } });

    const confirmedConfidence = screen.getByLabelText(/confirmed — it is available now/i);
    await user.click(confirmedConfidence);
  }

  async function advanceToScreen4(user: ReturnType<typeof userEvent.setup>) {
    const continueButton = screen.getByRole('button', { name: /continue/i });
    await user.click(continueButton);
    await waitFor(() => {
      expect(screen.getByText('Your existing assets')).toBeInTheDocument();
    });
  }

  async function fillScreen4(user: ReturnType<typeof userEvent.setup>) {
    if (!screen.queryByLabelText(/no — i do not have one yet/i)?.matches(':checked')) {
      const noEntity = screen.getByLabelText(/no — i do not have one yet/i);
      await user.click(noEntity);
    }

    const stateSelect = screen.getByLabelText(/what state are you based in/i);
    await user.selectOptions(stateSelect, 'CA');

    const yesExperience = screen.getByLabelText(/yes — i have worked in this industry/i);
    await user.click(yesExperience);
  }

  async function advanceToScreen5(user: ReturnType<typeof userEvent.setup>) {
    const continueButton = screen.getByRole('button', { name: /continue/i });
    await user.click(continueButton);
    await waitFor(() => {
      expect(screen.getByText('Feasibility Result')).toBeInTheDocument();
    });
  }

  async function addWorkWindowAndAcknowledge(user: ReturnType<typeof userEvent.setup>) {
    // Add at least one work window (default {start:'09:00', end:'10:00'} passes hasAnyWorkWindow)
    const addWindowButtons = screen.getAllByRole('button', { name: /add window/i });
    await user.click(addWindowButtons[0]);

    // Check immutability to enable the generate button
    const checkbox = screen.getByLabelText(/i understand and am ready/i);
    if (!(checkbox as HTMLInputElement).checked) {
      await user.click(checkbox);
    }
  }

  async function fillAllScreens(user: ReturnType<typeof userEvent.setup>) {
    await fillScreen1(user);
    await advanceToScreen2(user);
    await fillScreen2(user);
    await advanceToScreen3(user);
    await fillScreen3(user);
    await advanceToScreen4(user);
    await fillScreen4(user);
    await advanceToScreen5(user);
  }

  async function fillGumGoalData(user: ReturnType<typeof userEvent.setup>) {
    // Screen 1
    const goalDescription = screen.getByLabelText(/describe your goal/i);
    await user.type(goalDescription, 'Launch a caffeinated gum brand and make my first real sale.');

    await user.click(screen.getByLabelText('Physical product'));
    await user.click(screen.getByLabelText(/it is ingested/i));
    await user.click(screen.getByLabelText(/use a manufacturer's existing formula/i));

    await advanceToScreen2(user);

    // Screen 2 — physical product needs relationship selection
    await user.click(screen.getByLabelText(/as fast as realistically possible/i));
    const weeklyHours = screen.getByLabelText(/how many hours per week/i);
    await user.clear(weeklyHours);
    await user.type(weeklyHours, '25');
    await user.click(screen.getByLabelText(/this is my main focus/i));
    await user.click(screen.getByLabelText('Manufacturer or supplier contact'));

    await advanceToScreen3(user);

    // Screen 3 — low capital triggers acquisition section (atomic to avoid sticky flag)
    const capitalInput = screen.getByLabelText(/how much capital do you have/i);
    fireEvent.change(capitalInput, { target: { value: '2000' } });

    const addAudienceButton = screen.getByRole('button', { name: /add audience platform/i });
    await user.click(addAudienceButton);

    await user.selectOptions(screen.getByLabelText(/audience platform 1/i), 'Spotify');

    const sizeInput = screen.getByLabelText(/audience size 1/i);
    await user.clear(sizeInput);
    await user.type(sizeInput, '23000');

    await user.click(screen.getByLabelText(/they follow my creative work/i));
    await user.click(screen.getByLabelText(/confirmed — it is available now/i));

    await advanceToScreen4(user);

    // Screen 4 — Illinois with existing LLC for different business
    await user.click(screen.getByLabelText(/^yes$/i)); // entity: bare "Yes"
    await user.selectOptions(screen.getByLabelText(/entity type/i), 'LLC');
    await user.selectOptions(screen.getByLabelText(/entity state/i), 'IL');

    const purposeInput = screen.getByPlaceholderText(/e\.g\., project management/i);
    await user.type(purposeInput, 'Project management consulting');

    await user.click(screen.getByLabelText(/different business/i));

    await user.selectOptions(screen.getByLabelText(/what state are you based in/i), 'IL');
    await user.click(screen.getByLabelText(/yes — i have worked in this industry/i));

    await advanceToScreen5(user);
  }
});
