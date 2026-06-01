import React, { useState, useCallback } from 'react';
import { GoalExecutionContract } from '../../domain/goal/GoalExecutionContract';
import type { StructuredPlanningIntake } from '../../domain/goal/StructuredPlanningIntake';
import type { IntakeFeasibilityReport, PrePlanFeasibilityResult } from '../../domain/goal/prePlanFeasibility';
import { evaluatePrePlanFeasibility, prePlanFeasibility } from '../../domain/goal/prePlanFeasibility';
import { GoalAdmissionFlow, IntakeProgressState, assembleIntake } from './GoalAdmissionFlow';
import type { GoalPlanningTier } from '../../domain/goal/planningTierClassifier';
import type { GoalArchitectureInference } from '../../domain/goal/goalArchitectureClassifier.ts';

function deriveSystemCausalChain(goalText: string) {
  const normalized = String(goalText || '').trim() || 'Reach the admitted outcome';
  return {
    steps: [{ sequence: 1, description: normalized, approximateDayOffset: 7 }],
    hash: '',
  };
}

function buildSystemGoalDraftV2(
  contract: GoalExecutionContract,
  planningIntake: StructuredPlanningIntake,
  appTimeISO: string
) {
  const goalText =
    planningIntake.goalDescription ||
    contract.goalText ||
    contract.goalLabel ||
    contract?.terminalOutcome?.text ||
    'Reach the admitted outcome';
  const executionType =
    contract.executionType ||
    contract?.goalDraftV2?.executionType ||
    (planningIntake.goalClassification === 'regulated_physical_consumable' ? 'BrandLaunch' : 'GenericStructured');
  const startDate = planningIntake.startDayKey || contract.startDayKey || appTimeISO.slice(0, 10);

  return {
    ...(contract.goalDraftV2 || {}),
    goalLabel: goalText,
    goalText,
    executionType,
    startDate,
    answeredContext: {
      ...(((contract.goalDraftV2 as Record<string, unknown> | undefined)?.answeredContext as Record<string, unknown>) || {}),
      ...planningIntake,
    },
  };
}

interface GoalAdmissionPageProps {
  contract: GoalExecutionContract;
  onContractChange: (contract: GoalExecutionContract) => void;
  onExecutionTypeChange?: (executionType: string | null) => void;
  onAdmit: (contract?: GoalExecutionContract) => void;
  onAspire: (notes: string) => void;
  existingGoalOutcomes?: string[];
  appTimeISO?: string;
  onPlanningTierRouted?: (payload: {
    planningTier: GoalPlanningTier;
    goalDescription: string;
    goalArchitecture: GoalArchitectureInference;
  }) => void;
}

type AdmissionPlanningContract = GoalExecutionContract & {
  planningIntake?: StructuredPlanningIntake;
  prePlanFeasibility?: PrePlanFeasibilityResult | null;
  capitalAcquisitionFeasibility?: IntakeFeasibilityReport | null;
  selectedFeasibilityPivot?: string | null;
};

function applySelectedPivot(intake: StructuredPlanningIntake, selectedPivot: string | null): StructuredPlanningIntake {
  if (!selectedPivot) {
    return intake;
  }
  switch (selectedPivot) {
    case 'white_label_lower_capital':
    case 'white_label_pivot':
      return {
        ...intake,
        formulaPathway: 'white_label',
        capitalAcquisitionRequired: true,
      };
    case 'crowdfund_first':
    case 'crowdfund_pivot':
      return {
        ...intake,
        capitalAcquisitionRequired: true,
        formulaPathway: intake.formulaPathway === 'undecided' ? 'white_label' : intake.formulaPathway,
      };
    case 'phased_research_only':
      return {
        ...intake,
        capitalAcquisitionRequired: true,
        formulaPathway: intake.formulaPathway === 'undecided' ? 'white_label' : intake.formulaPathway,
      };
    default:
      return intake;
  }
}

function buildSubmittedContract(
  contract: GoalExecutionContract,
  intake: StructuredPlanningIntake,
  savedState: IntakeProgressState | null,
  appTimeISO: string
): AdmissionPlanningContract {
  const planningIntake = applySelectedPivot(intake, savedState?.selectedPivot || null);
  const prePlan = evaluatePrePlanFeasibility(planningIntake, {
    startDayKey: planningIntake.startDayKey || appTimeISO.slice(0, 10),
  });
  const capitalAcquisitionFeasibility =
    planningIntake.goalClassification === 'regulated_physical_consumable' ? prePlanFeasibility(planningIntake) : null;
  const acknowledgment = 'I understand and am ready to generate my plan.';

  return {
    ...contract,
    goalDraftV2: buildSystemGoalDraftV2(contract, planningIntake, appTimeISO),
    planningIntake,
    prePlanFeasibility: prePlan,
    capitalAcquisitionFeasibility,
    selectedFeasibilityPivot: savedState?.selectedPivot || null,
    planGenerationMechanismClass: contract.planGenerationMechanismClass || 'LLM_TYPED',
    commitmentDisclosureAccepted: savedState?.immutabilityAcknowledged === true,
    commitmentDisclosureAcceptedAtISO:
      savedState?.immutabilityAcknowledged === true
        ? contract.commitmentDisclosureAcceptedAtISO || appTimeISO
        : contract.commitmentDisclosureAcceptedAtISO,
    reinforcement: {
      dailyExposureEnabled: true,
      dailyMechanism: contract.reinforcement?.dailyMechanism?.trim() || 'Daily check-in surface',
      checkInFrequency: contract.reinforcement?.checkInFrequency || 'DAILY',
      triggerDescription: contract.reinforcement?.triggerDescription?.trim() || 'Every morning before starting work',
    },
    inscription: {
      contractHash: contract.inscription?.contractHash || '',
      inscribedAtISO: contract.inscription?.inscribedAtISO || appTimeISO,
      acknowledgment: contract.inscription?.acknowledgment?.trim() || acknowledgment,
      acknowledgmentHash: contract.inscription?.acknowledgmentHash || '',
      isCompromised: false,
    },
    goalIntakeContract: contract.goalIntakeContract
      ? {
          ...contract.goalIntakeContract,
          planningIntake,
          prePlanFeasibility: prePlan,
          capitalAcquisitionFeasibility,
        }
      : contract.goalIntakeContract,
    workWindows: savedState?.workWindows || contract.workWindows,
    causalChain: contract.causalChain || deriveSystemCausalChain(planningIntake.goalDescription || contract?.terminalOutcome?.text || ''),
    startDayKey: planningIntake.startDayKey || contract.startDayKey || appTimeISO.slice(0, 10),
    startDateISO:
      planningIntake.startDayKey != null
        ? `${planningIntake.startDayKey}T00:00:00.000Z`
        : contract.startDateISO || `${appTimeISO.slice(0, 10)}T00:00:00.000Z`,
  };
}

function buildDraftContractFromProgress(
  contract: GoalExecutionContract,
  savedState: IntakeProgressState | null,
  appTimeISO: string
): AdmissionPlanningContract {
  const nextContract: AdmissionPlanningContract = {
    ...contract,
    workWindows: savedState?.workWindows || contract.workWindows,
    causalChain:
      contract.causalChain ||
      deriveSystemCausalChain(savedState?.screen1?.goalDescription || contract?.terminalOutcome?.text || ''),
    commitmentDisclosureAccepted: savedState?.immutabilityAcknowledged === true,
    startDayKey: savedState?.screen2?.startDayKey || contract.startDayKey || appTimeISO.slice(0, 10),
    startDateISO:
      savedState?.screen2?.startDayKey != null
        ? `${savedState.screen2.startDayKey}T00:00:00.000Z`
        : contract.startDateISO || `${appTimeISO.slice(0, 10)}T00:00:00.000Z`,
  };

  if (savedState?.screen1?.goalDescription?.trim()) {
    nextContract.goalLabel = savedState.screen1.goalDescription.trim();
    nextContract.goalText = savedState.screen1.goalDescription.trim();
    nextContract.terminalOutcome = {
      ...(contract.terminalOutcome || {}),
      text: savedState.screen1.goalDescription.trim(),
      verificationCriteria:
        contract.terminalOutcome?.verificationCriteria || 'Complete the admitted goal as defined in the intake review',
      isConcrete: contract.terminalOutcome?.isConcrete ?? true,
      hash: contract.terminalOutcome?.hash || '',
    };
  }

  if (savedState?.screen2?.deadlineType === 'specific' && savedState.screen2.deadline) {
    nextContract.deadline = {
      ...(contract.deadline || {}),
      dayKey: savedState.screen2.deadline,
      isHardDeadline: contract.deadline?.isHardDeadline ?? true,
    };
  }

  if (savedState?.screen1 && savedState?.screen2 && savedState?.screen3 && savedState?.screen4) {
    const planningIntake = applySelectedPivot(
      assembleIntake(savedState.screen1, savedState.screen2, savedState.screen3, savedState.screen4),
      savedState.selectedPivot || null
    );
    nextContract.planningIntake = {
      ...planningIntake,
      workWindows: savedState.workWindows,
    };
    nextContract.goalDraftV2 = buildSystemGoalDraftV2(
      { ...contract, goalText: nextContract.goalText, goalLabel: nextContract.goalLabel, executionType: contract.executionType },
      nextContract.planningIntake,
      appTimeISO
    );
  }

  return nextContract;
}

export default function GoalAdmissionPage({
  contract,
  onContractChange,
  onAdmit,
  onAspire,
  appTimeISO = new Date().toISOString(),
  onPlanningTierRouted,
}: GoalAdmissionPageProps) {
  const [savedState, setSavedState] = useState<IntakeProgressState | null>(null);

  const handleStateChange = useCallback(
    (nextState: IntakeProgressState) => {
      setSavedState(nextState);
      onContractChange(buildDraftContractFromProgress(contract, nextState, appTimeISO));
    },
    [appTimeISO, contract, onContractChange]
  );

  const handleGeneratePlan = useCallback(
    (intake: StructuredPlanningIntake) => {
      const nextContract = buildSubmittedContract(
        contract,
        {
          ...intake,
          workWindows: savedState?.workWindows || intake.workWindows || null,
        },
        savedState,
        appTimeISO
      );
      onContractChange(nextContract);
      onAdmit(nextContract);
    },
    [appTimeISO, contract, onAdmit, onContractChange, savedState],
  );

  return (
    <GoalAdmissionFlow
      onGeneratePlan={handleGeneratePlan}
      onAspire={() => onAspire('')}
      savedState={savedState}
      onStateChange={handleStateChange}
      appTimeISO={appTimeISO}
      onPlanningTierRouted={(payload) => {
        onPlanningTierRouted?.({
          planningTier: payload.planningTier,
          goalDescription: payload.goalDescription,
          goalArchitecture: payload.goalArchitecture,
        });
      }}
    />
  );
}
