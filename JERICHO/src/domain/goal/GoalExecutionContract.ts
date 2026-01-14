/**
 * GoalExecutionContract: The immutable specification of a goal commitment
 * 
 * This is NOT a draft or preference object.
 * It represents a binding declaration of:
 * - What will be achieved (terminal outcome)
 * - By when (deadline)
 * - At what cost (sacrifice declaration)
 * - How often (temporal commitment)
 * - Why it matters (causal chain)
 * - How daily (reinforcement)
 * 
 * Immutability is enforced by cryptographic hash (inscription).
 * No "Save Draft". No partial contracts. Either admitted or aspired.
 */

export interface TerminalOutcome {
  /** Raw text declaration of the goal outcome */
  text: string;
  
  /** Hash of outcome text for immutability verification */
  hash: string;
  
  /** Verification criteria: how will this be confirmed at deadline? */
  verificationCriteria: string;
  
  /** True if outcome is concrete and measurable */
  isConcrete: boolean;
}

export interface SacrificeDeclaration {
  /** What will be given up, delayed, or reduced */
  whatIsGivenUp: string;
  
  /** For how long (e.g., "6 weeks", "until deadline") */
  duration: string;
  
  /** Quantified impact (e.g., "1 hour/day", "50% of leisure time") */
  quantifiedImpact: string;
  
  /** Why this cost is necessary */
  rationale: string;
  
  /** Hash of entire sacrifice declaration */
  hash: string;
}

export interface TemporalBinding {
  /** Number of days per week committed to this goal (3-7) */
  daysPerWeek: 3 | 4 | 5 | 6 | 7;
  
  /** Which calendar days (e.g., "Mon, Wed, Fri" or "Every day") */
  specificDays?: string;
  
  /** Hour of day to activate this goal (e.g., "09:00") */
  activationTime: string;
  
  /** Duration of each session (minutes) */
  sessionDurationMinutes: number;
  
  /** Total committed time per week (auto-calculated) */
  weeklyMinutes: number;
  
  /** Start day for this commitment */
  startDayKey: string;
}

export interface CausalChain {
  /** List of intermediate milestones from now to terminal outcome */
  steps: CausalStep[];
  
  /** Hash of entire chain for immutability */
  hash: string;
}

export interface CausalStep {
  sequence: number;
  description: string;
  approximateDayOffset?: number; // Relative to deadline
}

export interface ReinforcementDisclosure {
  /** Does user commit to daily visible reminder? (cannot be disabled) */
  dailyExposureEnabled: boolean;
  
  /** If enabled, mechanism (e.g., "Calendar block title", "Dashboard banner") */
  dailyMechanism?: string;
  
  /** Frequency: DAILY, WEEKLY, or ON_PROGRESS */
  checkInFrequency: 'DAILY' | 'WEEKLY' | 'ON_PROGRESS';
  
  /** What will trigger check-in (e.g., "Every morning", "Every progress event") */
  triggerDescription: string;
}

export interface Inscription {
  /** Hash of entire contract (all fields) */
  contractHash: string;
  
  /** ISO timestamp of inscription */
  inscribedAtISO: string;
  
  /** User's acknowledgment text (e.g., "I understand this is binding") */
  acknowledgment: string;
  
  /** Hash of acknowledgment for verification */
  acknowledgmentHash: string;
  
  /** True if any field changed since inscription */
  isCompromised: boolean;
}

export interface GoalExecutionContract {
  // Identity
  goalId: string;
  cycleId: string;
  
  // Plan generation mechanism (Phase 3)
  planGenerationMechanismClass: 'GENERIC_DETERMINISTIC' | 'TEMPLATE_PIPELINE' | 'HABIT_LOOP' | 'PROJECT_MILESTONE' | 'DELIVERABLE_DRIVEN' | 'CUSTOM';
  
  // Core commitment
  terminalOutcome: TerminalOutcome;
  deadline: {
    dayKey: string; // YYYY-MM-DD format
    isHardDeadline: boolean; // If false, soft deadline (no enforcement)
  };
  
  // Cost declaration
  sacrifice: SacrificeDeclaration;
  
  // Calendar commitment
  temporalBinding: TemporalBinding;
  
  // Reasoning
  causalChain: CausalChain;
  
  // Daily presence
  reinforcement: ReinforcementDisclosure;
  
  // Immutability
  inscription: Inscription;
  
  // Meta
  admissionStatus: 'PENDING' | 'ADMITTED' | 'ASPIRED' | 'REJECTED' | 'ENDED';
  admissionAttemptCount: number;
  rejectionCodes: string[]; // GoalRejectionCode[]
  
  // Timestamps
  createdAtISO: string;
  admittedAtISO?: string;
  endedAtISO?: string;
  
  // Aspiration fallback
  isAspirational: boolean; // User marked as aspiration (not admitted)
  aspirationNotes?: string;
}

/**
 * Validation result from admission policy
 */
export interface GoalAdmissionResult {
  status: 'ADMITTED' | 'REJECTED' | 'ASPIRED';
  
  /** List of hard rejection codes (if status is REJECTED) */
  rejectionCodes: string[];
  
  /** Human-readable rejection reasons */
  rejectionMessages: string[];
  
  /** Timestamp of assessment */
  assessedAtISO: string;
  
  /** If ASPIRED, the reason provided by user */
  aspirationReason?: string;
}

/**
 * Serialization helpers for hashing and storage
 */
export function normalizeTerminalOutcome(outcome: TerminalOutcome): string {
  return JSON.stringify({
    text: outcome.text.trim(),
    verificationCriteria: outcome.verificationCriteria.trim(),
    isConcrete: outcome.isConcrete,
  });
}

export function normalizeSacrifice(sacrifice: SacrificeDeclaration): string {
  return JSON.stringify({
    whatIsGivenUp: sacrifice.whatIsGivenUp.trim(),
    duration: sacrifice.duration.trim(),
    quantifiedImpact: sacrifice.quantifiedImpact.trim(),
    rationale: sacrifice.rationale.trim(),
  });
}

export function normalizeCausalChain(chain: CausalChain): string {
  return JSON.stringify({
    steps: chain.steps.map((s) => ({
      sequence: s.sequence,
      description: s.description.trim(),
      approximateDayOffset: s.approximateDayOffset,
    })),
  });
}

export function normalizeInscription(inscription: Inscription): string {
  return JSON.stringify({
    acknowledgment: inscription.acknowledgment.trim(),
    dailyExposureEnabled: true, // Must always be true; cannot be disabled
  });
}
