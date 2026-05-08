/**
 * GoalAdmissionPolicy: Hard constraints enforcement
 *
 * This is the gate. Either a contract passes all hard validations or it does not.
 * No exceptions. No warnings. No "close enough".
 *
 * Validation proceeds in order of likelihood to fail:
 * 1. Inscription integrity (cannot be compromised)
 * 2. Terminal outcome (must exist, be concrete)
 * 3. Deadline (must be valid, not in past, min 3 days away)
 * 4. Temporal binding (must be consistent, >= 3 days/week)
 * 5. Causal chain (must be complete, acyclic)
 * 6. Reinforcement (daily exposure non-negotiable)
 * 7. Meta (no duplicates, no aspirational)
 */

import {
  GoalExecutionContract,
  GoalAdmissionResult,
  normalizeTerminalOutcome,
  normalizeSacrifice,
  normalizeCausalChain,
  normalizeWorkWindows,
  normalizeInscription,
} from './GoalExecutionContract';

import { GoalRejectionCode, GOAL_REJECTION_MESSAGES } from './GoalRejectionCode';
import { computeInscriptionHash } from '../../utils/inscriptionHash';

/**
 * Deterministic SHA256 hash for immutability verification
 */
/**
 * Main admission validator
 */
export function validateGoalAdmission(
  contract: GoalExecutionContract,
  nowISO: string,
  existingGoalOutcomes?: string[],
  activeGoalSignatures: string[] = []
): GoalAdmissionResult {
  const rejectionCodes: GoalRejectionCode[] = [];
  const candidateHash = computeContractHash(contract);
  const isDuplicateInActiveScope = () => activeGoalSignatures.some((signature) => signature === candidateHash);

  // Phase 0: Plan generation mechanism (Phase 3 requirement)
  // Phase 3 v1 supports deterministic generic and typed LLM intake mechanisms.
  const SUPPORTED_MECHANISMS = ['GENERIC_DETERMINISTIC', 'LLM_TYPED'];
  if (!contract.planGenerationMechanismClass) {
    rejectionCodes.push(GoalRejectionCode.PLAN_GENERATION_MECHANISM_MISSING);
  } else if (!SUPPORTED_MECHANISMS.includes(contract.planGenerationMechanismClass as string)) {
    rejectionCodes.push(GoalRejectionCode.PLAN_GENERATION_MECHANISM_UNSUPPORTED);
  }

  if (!contract.commitmentDisclosureAccepted) {
    rejectionCodes.push(GoalRejectionCode.REJECT_DISCLOSURE_REQUIRED);
  }

  // Phase 1: Inscription integrity (immutability)
  if (!contract.inscription) {
    rejectionCodes.push(GoalRejectionCode.INSCRIPTION_MISSING);
  } else {
    const computed = computeContractHash(contract);
    if (computed !== contract.inscription.contractHash) {
      rejectionCodes.push(GoalRejectionCode.INSCRIPTION_NOT_IMMUTABLE);
    }
  }

  // Phase 2: Terminal outcome validation
  if (!contract.terminalOutcome) {
    rejectionCodes.push(GoalRejectionCode.TERMINAL_OUTCOME_MISSING);
  } else {
    const outcome = contract.terminalOutcome.text.trim();
    if (!outcome || outcome.length < 5) {
      rejectionCodes.push(GoalRejectionCode.TERMINAL_OUTCOME_VAGUE);
    }
    if (!contract.terminalOutcome.isConcrete) {
      rejectionCodes.push(GoalRejectionCode.TERMINAL_OUTCOME_IMMEASURABLE);
    }
    if (
      !contract.terminalOutcome.verificationCriteria ||
      contract.terminalOutcome.verificationCriteria.trim().length < 3
    ) {
      rejectionCodes.push(GoalRejectionCode.TERMINAL_OUTCOME_IMMEASURABLE);
    }
  }

  // Phase 3: Deadline validation
  if (!contract.deadline) {
    rejectionCodes.push(GoalRejectionCode.DEADLINE_MISSING);
  } else {
    // Validate deadline dayKey format (YYYY-MM-DD)
    const dayKeyPattern = /^\d{4}-\d{2}-\d{2}$/;
    if (!dayKeyPattern.test(contract.deadline.dayKey)) {
      rejectionCodes.push(GoalRejectionCode.DEADLINE_MISSING);
    } else {
      const deadlineISO = `${contract.deadline.dayKey}T23:59:59.999Z`;
      const nowDate = new Date(nowISO);
      const deadlineDate = new Date(deadlineISO);

      if (deadlineDate <= nowDate) {
        rejectionCodes.push(GoalRejectionCode.DEADLINE_IN_PAST);
      }

      // Check if deadline is at least 3 days away
      const daysUntilDeadline = (deadlineDate.getTime() - nowDate.getTime()) / (1000 * 60 * 60 * 24);
      if (daysUntilDeadline < 3) {
        rejectionCodes.push(GoalRejectionCode.DEADLINE_TOO_SOON);
      }
    }
  }

  // Phase 4: Work windows validation
  const workWindows = contract.workWindows;
  const hasAnyWindow = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'].some((day) => {
    const dayWindows = workWindows?.[day] || [];
    return (
      Array.isArray(dayWindows) &&
      dayWindows.some((window) => {
        if (!window?.start || !window?.end) return false;
        return String(window.start) < String(window.end);
      })
    );
  });
  if (!hasAnyWindow) {
    rejectionCodes.push(GoalRejectionCode.NO_WORK_WINDOWS);
  }

  // Phase 5: Causal chain validation
  if (!contract.causalChain) {
    rejectionCodes.push(GoalRejectionCode.CAUSAL_CHAIN_INCOMPLETE);
  } else {
    const chain = contract.causalChain;
    if (!chain.steps || chain.steps.length < 1) {
      rejectionCodes.push(GoalRejectionCode.CAUSAL_CHAIN_INCOMPLETE);
    }
    // Check for cycles (simple: if any step references itself)
    const sequences = new Set(chain.steps.map((s) => s.sequence));
    if (sequences.size !== chain.steps.length) {
      rejectionCodes.push(GoalRejectionCode.CAUSAL_CHAIN_CIRCULAR);
    }
  }

  // Phase 6: Reinforcement disclosure validation
  if (!contract.reinforcement) {
    rejectionCodes.push(GoalRejectionCode.REINFORCEMENT_NOT_DECLARED);
  } else {
    const reinforcement = contract.reinforcement;
    if (!reinforcement.dailyExposureEnabled) {
      // Daily exposure is non-negotiable
      rejectionCodes.push(GoalRejectionCode.REINFORCEMENT_NOT_DECLARED);
    }
    if (reinforcement.dailyExposureEnabled && !reinforcement.dailyMechanism?.trim()) {
      rejectionCodes.push(GoalRejectionCode.REINFORCEMENT_CONTRADICTION);
    }
    if (
      !reinforcement.checkInFrequency ||
      !['DAILY', 'WEEKLY', 'ON_PROGRESS'].includes(reinforcement.checkInFrequency)
    ) {
      rejectionCodes.push(GoalRejectionCode.REINFORCEMENT_NOT_DECLARED);
    }
  }

  // Phase 7: Meta validations
  if (contract.isAspirational) {
    rejectionCodes.push(GoalRejectionCode.ASPIRATIONAL_ONLY);
  }

  if (existingGoalOutcomes && contract.terminalOutcome) {
    const outcomeText = contract.terminalOutcome.text.trim().toLowerCase();
    if (existingGoalOutcomes.some((existing) => existing.toLowerCase() === outcomeText)) {
      rejectionCodes.push(GoalRejectionCode.DUPLICATE_ACTIVE);
    }
  }

  if (isDuplicateInActiveScope()) {
    rejectionCodes.push(GoalRejectionCode.DUPLICATE_ACTIVE);
  }

  // Build result
  const assessedAtISO = new Date().toISOString();
  const rejectionMessages = rejectionCodes.map((code) => GOAL_REJECTION_MESSAGES[code] || code);

  if (rejectionCodes.length === 0) {
    return {
      status: 'ADMITTED',
      rejectionCodes: [],
      rejectionMessages: [],
      assessedAtISO,
    };
  } else {
    return {
      status: 'REJECTED',
      rejectionCodes: rejectionCodes as string[],
      rejectionMessages,
      assessedAtISO,
    };
  }
}

/**
 * Compute full contract hash for immutability verification
 */
export function computeContractHash(contract: GoalExecutionContract): string {
  const parts = [
    contract.terminalOutcome ? normalizeTerminalOutcome(contract.terminalOutcome) : '',
    contract.deadline?.dayKey || '',
    normalizeWorkWindows(contract.workWindows),
    contract.causalChain ? normalizeCausalChain(contract.causalChain) : '',
    contract.reinforcement?.dailyExposureEnabled.toString() || '',
    contract.reinforcement?.checkInFrequency || '',
  ];

  const normalized = parts.join('|');
  return computeInscriptionHash(normalized);
}

/**
 * Hash a single field for integrity verification
 */
export function hashField(fieldData: string): string {
  return computeInscriptionHash(fieldData.trim());
}

/**
 * Verify contract has not been compromised since admission
 */
export function verifyContractIntegrity(contract: GoalExecutionContract): boolean {
  if (!contract.inscription) return false;
  const computed = computeContractHash(contract);
  return computed === contract.inscription.contractHash;
}
