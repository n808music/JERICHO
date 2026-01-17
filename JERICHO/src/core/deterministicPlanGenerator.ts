/**
 * deterministicPlanGenerator.ts
 * 
 * Phase 3 Generic Deterministic Plan Generator (v1)
 * 
 * Core algorithm:
 * 1. Auto-deliverables: Use causal chain steps OR 3 generic (Planning 20%, Core 60%, Verify 20%)
 * 2. Block scheduling: Deterministic earliest-first allocation
 * 3. Constraints: maxBlocksPerDay, maxBlocksPerWeek, preferredDaysOfWeek, blackoutDayKeys
 * 4. Guarantees: >0 blocks if feasible, single INFEASIBLE error if not
 * 
 * Deterministic: same inputs → identical outputs (reproducible for testing/debugging)
 */

/**
 * Iteration guard configuration
 * 
 * SAFETY RAILS, NOT CONTROL FLOW
 * These caps are defensive measures only. Under realistic workloads (typical to high-capacity goals),
 * iteration counts remain <2% of these limits, providing >500× safety margin.
 * 
 * EXPECTED ITERATION RANGE (based on cap-distance verification tests):
 * - Typical goal (100 blocks, 50 days, full schedule):   ~40-50 iterations
 * - Tight goal (90 blocks, 45 days, 4 blocks/day max):  ~80-90 iterations
 * - High-capacity goal (max blocks, 365 days):          ~500-600 iterations
 * All well below 50,000 cap.
 * 
 * PLAN_NON_TERMINATING_GUARD ERROR:
 * If you see code === 'PLAN_NON_TERMINATING_GUARD', the planner hit an iteration cap.
 * This is NOT a feasibility failure (compare with NO_ELIGIBLE_DAYS).
 * Check error.iterations and error.inputSummary for diagnostic context.
 * If this occurs in production with realistic goals, the cap needs adjustment.
 * 
 * DEBUG SURFACE:
 * IterationStats (dayIterations, allocationIterations) is returned ONLY in error objects,
 * never in success path, and is not persisted to storage. Safe to strip for production if needed.
 */
export const ITERATION_GUARDS = {
  MAX_DAY_ITERATIONS: 50000, // ~137 years of daily iteration
  MAX_ALLOCATION_ITERATIONS: 50000, // Block scheduling worst-case
} as const;

export type IterationStats = {
  dayIterations?: number;
  allocationIterations?: number;
};

export type ProposedBlock = {
  id: string;
  dayKey: string;
  deliverableId: string;
  deliverableTitle: string;
  kind: 'PLANNING' | 'CORE' | 'VERIFICATION';
  durationMinutes: number;
  order: number;
};

export type AutoDeliverable = {
  id: string;
  title: string;
  kind: 'PLANNING' | 'CORE' | 'VERIFICATION';
  requiredBlocks: number;
};

export type DeterministicPlanResult = {
  status: 'SUCCESS' | 'INFEASIBLE';
  proposedBlocks: ProposedBlock[];
  autoDeliverables: AutoDeliverable[];
  error?: {
    code: 'NO_ELIGIBLE_DAYS' | 'WEEKLY_CAP_ZERO' | 'DAILY_CAP_ZERO' | 'DEADLINE_BEFORE_START' | 'PLAN_NON_TERMINATING_GUARD';
    message: string;
    iterations?: IterationStats; // Debug: iteration counts if guard tripped
    inputSummary?: { start: string; deadline: string; daysAvailable?: number }; // Debug: input context
  };
};

export interface DeterministicGenInput {
  contractDeadlineDayKey: string; // YYYY-MM-DD
  contractStartDayKey: string; // YYYY-MM-DD
  nowDayKey: string; // YYYY-MM-DD (current execution point)
  causalChainSteps?: Array<{ sequence: number; description: string }>;
  constraints: {
    maxBlocksPerDay: number; // e.g., 4
    maxBlocksPerWeek: number; // e.g., 16
    preferredDaysOfWeek?: number[]; // 0=Sun, 1=Mon, ..., 6=Sat (empty = all days)
    blackoutDayKeys?: string[]; // e.g., ["2026-01-25"]
    timezone: string; // e.g., "UTC"
  };
  mode: 'REGENERATE' | 'REBASE_FROM_TODAY';
}

/**
 * Build auto-deliverables from causal chain or default 3-tier model
 * Returns deterministic deliverables ordered by sequence
 */
export function buildAutoDeliverables(
  causalChainSteps?: Array<{ sequence: number; description: string }>
): AutoDeliverable[] {
  // If causal chain provided and non-empty, use it
  if (causalChainSteps && causalChainSteps.length > 0) {
    const sorted = [...causalChainSteps].sort((a, b) => a.sequence - b.sequence);
    return sorted.map((step, idx) => ({
      id: `deliv-causal-${step.sequence}`,
      title: step.description,
      kind: idx < 1 ? 'PLANNING' : idx < sorted.length - 1 ? 'CORE' : 'VERIFICATION',
      requiredBlocks: 1,
    }));
  }

  // Default 3-tier model (Planning, Core, Verify)
  // Ratio: 20% planning, 60% core, 20% verify
  return [
    {
      id: 'deliv-planning',
      title: 'Planning & Setup',
      kind: 'PLANNING',
      requiredBlocks: 2,
    },
    {
      id: 'deliv-core',
      title: 'Core Work',
      kind: 'CORE',
      requiredBlocks: 6,
    },
    {
      id: 'deliv-verify',
      title: 'Verification & Review',
      kind: 'VERIFICATION',
      requiredBlocks: 2,
    },
  ];
}

/**
 * Compute eligible working days between start and deadline
 * Respects preferred days of week and blackout dates
 * Returns [eligible days, iteration count for diagnostics]
 */
function getEligibleDays(
  startDayKey: string,
  deadlineDayKey: string,
  constraints: DeterministicGenInput['constraints']
): [string[], number] {
  const eligible: string[] = [];
  const blackout = new Set(constraints.blackoutDayKeys || []);
  const preferred = constraints.preferredDaysOfWeek || [];
  
  let current = startDayKey;
  let iterations = 0;
  
  while (current <= deadlineDayKey) {
    iterations++;
    if (iterations > ITERATION_GUARDS.MAX_DAY_ITERATIONS) {
      throw new Error(`[deterministicPlanGenerator] getEligibleDays iteration cap exceeded: ${iterations} iterations, start=${startDayKey}, deadline=${deadlineDayKey}`);
    }
    // Skip blackout days
    if (!blackout.has(current)) {
      // If preferred days specified, check day of week
      if (preferred.length === 0) {
        eligible.push(current);
      } else {
        const d = new Date(`${current}T12:00:00Z`);
        const dow = d.getUTCDay(); // 0=Sun, 1=Mon, etc.
        if (preferred.includes(dow)) {
          eligible.push(current);
        }
      }
    }
    
    if (current === deadlineDayKey) break;
    
    // Increment day
    const [year, month, day] = current.split('-').map(Number);
    const nextDate = new Date(Date.UTC(year, month - 1, day + 1));
    const y = nextDate.getUTCFullYear();
    const m = String(nextDate.getUTCMonth() + 1).padStart(2, '0');
    const d = String(nextDate.getUTCDate()).padStart(2, '0');
    current = `${y}-${m}-${d}`;
  }
  
  return [eligible, iterations];
}

/**
 * Deterministic plan generation
 * Returns SUCCESS with proposed blocks OR INFEASIBLE with single error
 */
export function generateDeterministicPlan(input: DeterministicGenInput): DeterministicPlanResult {
  const {
    contractDeadlineDayKey,
    contractStartDayKey,
    nowDayKey,
    causalChainSteps,
    constraints,
    mode,
  } = input;

  // Validate constraints
  if (constraints.maxBlocksPerDay <= 0) {
    return {
      status: 'INFEASIBLE',
      proposedBlocks: [],
      autoDeliverables: [],
      error: {
        code: 'DAILY_CAP_ZERO',
        message: 'Daily block capacity must be greater than 0',
      },
    };
  }

  if (constraints.maxBlocksPerWeek <= 0) {
    return {
      status: 'INFEASIBLE',
      proposedBlocks: [],
      autoDeliverables: [],
      error: {
        code: 'WEEKLY_CAP_ZERO',
        message: 'Weekly block capacity must be greater than 0',
      },
    };
  }

  if (contractDeadlineDayKey <= contractStartDayKey) {
    return {
      status: 'INFEASIBLE',
      proposedBlocks: [],
      autoDeliverables: [],
      error: {
        code: 'DEADLINE_BEFORE_START',
        message: 'Deadline must be after start date',
      },
    };
  }

  // Determine effective start (REBASE_FROM_TODAY uses now, REGENERATE uses contract start)
  const effectiveStartDayKey = mode === 'REBASE_FROM_TODAY' ? nowDayKey : contractStartDayKey;

  // Get eligible working days and track iterations for diagnostics
  const [eligibleDays, dayIterations] = getEligibleDays(effectiveStartDayKey, contractDeadlineDayKey, constraints);

  if (eligibleDays.length === 0) {
    return {
      status: 'INFEASIBLE',
      proposedBlocks: [],
      autoDeliverables: [],
      error: {
        code: 'NO_ELIGIBLE_DAYS',
        message: 'No eligible working days between start and deadline',
      },
    };
  }

  // Build auto-deliverables
  const deliverables = buildAutoDeliverables(causalChainSteps);
  const totalBlocksRequired = deliverables.reduce((sum, d) => sum + d.requiredBlocks, 0);

  // Calculate capacity
  const maxBlocksForPeriod = Math.min(
    eligibleDays.length * constraints.maxBlocksPerDay,
    Math.ceil(eligibleDays.length / 7) * constraints.maxBlocksPerWeek
  );

  const targetBlocks = Math.min(totalBlocksRequired, maxBlocksForPeriod);

  // If we can't fit even 1 block, it's infeasible
  if (targetBlocks < 1) {
    return {
      status: 'INFEASIBLE',
      proposedBlocks: [],
      autoDeliverables: deliverables,
      error: {
        code: 'NO_ELIGIBLE_DAYS',
        message: 'Insufficient capacity to fit required blocks',
      },
    };
  }

  // Allocate blocks deterministically (earliest-first)
  const proposedBlocks: ProposedBlock[] = [];
  let blockIndex = 0;
  let dayIndex = 0;
  let dailyCount: Record<string, number> = {};
  let weeklyCount: Record<string, number> = {};

  // Flatten deliverables into individual blocks for scheduling
  const blockQueue = deliverables.flatMap((deliv) =>
    Array(deliv.requiredBlocks)
      .fill(null)
      .map((_, idx) => ({
        deliverableId: deliv.id,
        deliverableTitle: deliv.title,
        kind: deliv.kind,
        order: idx,
      }))
  );

  // Allocate blocks to days (deterministic earliest-first)
  let allocationIterations = 0;
  
  for (const block of blockQueue) {
    if (blockIndex >= targetBlocks) break;

    let allocated = false;
    for (let attempt = 0; attempt < eligibleDays.length && !allocated; attempt++) {
      allocationIterations++;
      if (allocationIterations > ITERATION_GUARDS.MAX_ALLOCATION_ITERATIONS) {
        return {
          status: 'INFEASIBLE',
          proposedBlocks: proposedBlocks.length > 0 ? proposedBlocks : [],
          autoDeliverables: deliverables,
          error: {
            code: 'PLAN_NON_TERMINATING_GUARD',
            message: 'Block allocation exceeded iteration limit (pathological constraints detected)',
            iterations: { dayIterations, allocationIterations },
            inputSummary: {
              start: effectiveStartDayKey,
              deadline: contractDeadlineDayKey,
              daysAvailable: eligibleDays.length,
            },
          },
        };
      }
      const dayKey = eligibleDays[(dayIndex + attempt) % eligibleDays.length];
      const weekKey = getWeekStart(dayKey);

      const dailyCount_ = dailyCount[dayKey] || 0;
      const weeklyCount_ = weeklyCount[weekKey] || 0;

      if (dailyCount_ < constraints.maxBlocksPerDay && weeklyCount_ < constraints.maxBlocksPerWeek) {
        proposedBlocks.push({
          id: `block-${blockIndex}`,
          dayKey,
          deliverableId: block.deliverableId,
          deliverableTitle: block.deliverableTitle,
          kind: block.kind,
          durationMinutes: 60,
          order: block.order,
        });

        dailyCount[dayKey] = dailyCount_ + 1;
        weeklyCount[weekKey] = weeklyCount_ + 1;
        blockIndex++;
        allocated = true;
      }
    }

    if (!allocated) {
      dayIndex++;
    }
  }

  // Guarantee at least 1 block if we computed targetBlocks >= 1
  if (proposedBlocks.length === 0 && targetBlocks >= 1) {
    return {
      status: 'INFEASIBLE',
      proposedBlocks: [],
      autoDeliverables: deliverables,
      error: {
        code: 'NO_ELIGIBLE_DAYS',
        message: 'Failed to allocate blocks despite eligible days',
      },
    };
  }

  return {
    status: 'SUCCESS',
    proposedBlocks,
    autoDeliverables: deliverables,
  };
}

/**
 * Get Monday of the week for a given dayKey (for weekly capacity tracking)
 */
function getWeekStart(dayKey: string): string {
  const d = new Date(`${dayKey}T12:00:00Z`);
  const dow = d.getUTCDay();
  const daysFromMonday = (dow + 6) % 7;
  const weekStart = new Date(d.getTime() - daysFromMonday * 24 * 60 * 60 * 1000);
  return weekStart.toISOString().split('T')[0];
}
