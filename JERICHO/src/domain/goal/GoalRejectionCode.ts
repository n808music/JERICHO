/**
 * GoalRejectionCode: Hard constraints that prevent goal admission
 * 
 * No soft validations. No warnings that can be overridden.
 * Each code represents a contract violation that makes the goal non-admissible.
 */

export enum GoalRejectionCode {
  // Plan generation mechanism violations (Phase 3)
  PLAN_GENERATION_MECHANISM_MISSING = 'PLAN_GENERATION_MECHANISM_MISSING',
  PLAN_GENERATION_MECHANISM_UNSUPPORTED = 'PLAN_GENERATION_MECHANISM_UNSUPPORTED', // Only GENERIC_DETERMINISTIC supported in v1

  // Terminal outcome violations
  TERMINAL_OUTCOME_MISSING = 'TERMINAL_OUTCOME_MISSING',
  TERMINAL_OUTCOME_VAGUE = 'TERMINAL_OUTCOME_VAGUE',
  TERMINAL_OUTCOME_IMMEASURABLE = 'TERMINAL_OUTCOME_IMMEASURABLE',

  // Deadline violations
  DEADLINE_MISSING = 'DEADLINE_MISSING',
  DEADLINE_IN_PAST = 'DEADLINE_IN_PAST',
  DEADLINE_TOO_SOON = 'DEADLINE_TOO_SOON', // Less than 3 days from now

  // Sacrifice declaration violations
  SACRIFICE_MISSING = 'SACRIFICE_MISSING',
  SACRIFICE_VAGUE = 'SACRIFICE_VAGUE',
  SACRIFICE_NOT_BINDING = 'SACRIFICE_NOT_BINDING', // Claimed cost is trivial

  // Temporal binding violations
  TEMPORAL_BINDING_INVALID = 'TEMPORAL_BINDING_INVALID', // No calendar commitment
  TEMPORAL_BINDING_INSUFFICIENT = 'TEMPORAL_BINDING_INSUFFICIENT', // Less than 3 days/week

  // Causal chain violations
  CAUSAL_CHAIN_INCOMPLETE = 'CAUSAL_CHAIN_INCOMPLETE', // Missing steps from now to outcome
  CAUSAL_CHAIN_CIRCULAR = 'CAUSAL_CHAIN_CIRCULAR',

  // Reinforcement disclosure violations
  REINFORCEMENT_NOT_DECLARED = 'REINFORCEMENT_NOT_DECLARED', // User denies daily exposure but no alt mechanism
  REINFORCEMENT_CONTRADICTION = 'REINFORCEMENT_CONTRADICTION', // Claims daily but provides no anchor

  // Inscription violations
  INSCRIPTION_MISSING = 'INSCRIPTION_MISSING',
  INSCRIPTION_NOT_IMMUTABLE = 'INSCRIPTION_NOT_IMMUTABLE', // Hash mismatch after declaration

  // Meta violations
  ASPIRATIONAL_ONLY = 'ASPIRATIONAL_ONLY', // User marks as aspiration, cannot admit
  DUPLICATE_ACTIVE = 'DUPLICATE_ACTIVE', // Same outcome already active
  REJECT_DISCLOSURE_REQUIRED = 'REJECT_DISCLOSURE_REQUIRED', // Commitment disclosure not accepted
}

/**
 * Severity levels for diagnostics (not used for admission logic)
 */
export enum GoalRejectionSeverity {
  HARD = 'HARD', // Admission fails
  SOFT = 'SOFT', // Warning only (not used in this system)
}

/**
 * Human-readable messages (for UI display only)
 */
export const GOAL_REJECTION_MESSAGES: Record<GoalRejectionCode, string> = {
  [GoalRejectionCode.PLAN_GENERATION_MECHANISM_MISSING]: 'Plan generation mechanism is required.',
  [GoalRejectionCode.PLAN_GENERATION_MECHANISM_UNSUPPORTED]: 'Plan generation mechanism must be GENERIC_DETERMINISTIC (only supported type in v1).',

  [GoalRejectionCode.TERMINAL_OUTCOME_MISSING]: 'Terminal outcome is required.',
  [GoalRejectionCode.TERMINAL_OUTCOME_VAGUE]: 'Terminal outcome must be concrete and unambiguous.',
  [GoalRejectionCode.TERMINAL_OUTCOME_IMMEASURABLE]: 'Terminal outcome must be verifiable at deadline.',

  [GoalRejectionCode.DEADLINE_MISSING]: 'Deadline date is required.',
  [GoalRejectionCode.DEADLINE_IN_PAST]: 'Deadline cannot be in the past.',
  [GoalRejectionCode.DEADLINE_TOO_SOON]: 'Deadline must be at least 3 days from today.',

  [GoalRejectionCode.SACRIFICE_MISSING]: 'You must declare what you will sacrifice to achieve this.',
  [GoalRejectionCode.SACRIFICE_VAGUE]: 'Sacrifice must be specific and quantified.',
  [GoalRejectionCode.SACRIFICE_NOT_BINDING]: 'Declared sacrifice must represent real cost.',

  [GoalRejectionCode.TEMPORAL_BINDING_INVALID]: 'You must commit to a recurring schedule (days/week).',
  [GoalRejectionCode.TEMPORAL_BINDING_INSUFFICIENT]: 'Committed days must be at least 3 per week.',

  [GoalRejectionCode.CAUSAL_CHAIN_INCOMPLETE]: 'You must outline steps from today to the outcome.',
  [GoalRejectionCode.CAUSAL_CHAIN_CIRCULAR]: 'Causal chain contains a loop; cannot reach outcome.',

  [GoalRejectionCode.REINFORCEMENT_NOT_DECLARED]: 'You must declare daily visibility mechanism.',
  [GoalRejectionCode.REINFORCEMENT_CONTRADICTION]: 'Daily visibility claim contradicts declared mechanism.',

  [GoalRejectionCode.INSCRIPTION_MISSING]: 'Goal inscription is required for immutability.',
  [GoalRejectionCode.INSCRIPTION_NOT_IMMUTABLE]: 'Goal has been altered since inscription; integrity compromised.',

  [GoalRejectionCode.ASPIRATIONAL_ONLY]: 'Goal marked as aspiration; cannot admit to calendar.',
  [GoalRejectionCode.DUPLICATE_ACTIVE]: 'Same outcome already active; archive or complete first.',
  [GoalRejectionCode.REJECT_DISCLOSURE_REQUIRED]:
    'You must accept the immutable goal commitment disclosure before admitting.',
};
