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
  // Opaque pass-through, not interpreted by this generic generator (2026-07-13 unified
  // schedule generation design, §6/§3) — set when the deliverable traces back to a Master
  // Grid matrix Project, so the canonical ScheduledBlock builder can resolve
  // entityId/laneId. Undefined for manually-authored causal chains and the generic
  // 3-tier fallback.
  sourceProjectId?: string;
};

export type AutoDeliverable = {
  id: string;
  title: string;
  kind: 'PLANNING' | 'CORE' | 'VERIFICATION';
  requiredBlocks: number;
  sourceProjectId?: string;
  // Per-project target deadline (YYYY-MM-DD format). Soft constraint — used as
  // tiebreaker within phase, not hard ordering override. Phase ordering is always
  // respected (hard constraint). Undefined if no target date on source project.
  targetDate?: string | null;
};

/**
 * Capacity violation payload (2026-07-13 unified schedule generation design, §5).
 *
 * Prior behavior: `targetBlocks = Math.min(totalBlocksRequired, maxBlocksForPeriod)` capped
 * silently and still reported `status: 'SUCCESS'` — whatever didn't fit just never appeared,
 * with no error, no reason code, nothing surfaced to the operator. This is the "quiet data
 * loss" shape flagged in the design doc. `PARTIAL` + this payload replaces that: the blocks
 * that DID fit are still real and schedulable, but the shortfall is named, not hidden.
 */
export type CapacityViolation = {
  requiredBlocks: number;
  availableBlocks: number;
  overageMinutes: number;
  cutSteps: Array<{ deliverableId: string; deliverableTitle: string }>;
};

/**
 * Target date conflict payload (2026-08-13, per-project deadline enforcement).
 * Parallel to CapacityViolation: when a project's targetDate cannot be satisfied,
 * flag it explicitly instead of silently stretching to next available slot.
 * Blocks still get scheduled (never silent data loss), but operator sees the conflicts.
 */
export type TargetDateConflict = {
  deliverableId: string;
  deliverableTitle: string;
  targetDate: string; // YYYY-MM-DD
  reason: 'OUTSIDE_CONTRACT_WINDOW' | 'LANDS_IN_BLACKOUT' | 'CAPACITY_CLUSTER_CONFLICT';
  placedOnDate: string; // Where it actually got scheduled (best-effort next available)
};

export type DeterministicPlanResult = {
  status: 'SUCCESS' | 'PARTIAL' | 'INFEASIBLE';
  proposedBlocks: ProposedBlock[];
  autoDeliverables: AutoDeliverable[];
  capacityViolation?: CapacityViolation;
  targetDateConflicts?: TargetDateConflict[]; // Per-project deadline conflicts (2026-08-13)
  error?: {
    code:
      | 'NO_ELIGIBLE_DAYS'
      | 'WEEKLY_CAP_ZERO'
      | 'DAILY_CAP_ZERO'
      | 'DEADLINE_BEFORE_START'
      | 'PLAN_NON_TERMINATING_GUARD';
    message: string;
    iterations?: IterationStats; // Debug: iteration counts if guard tripped
    inputSummary?: { start: string; deadline: string; daysAvailable?: number }; // Debug: input context
  };
};

export interface DeterministicGenInput {
  contractDeadlineDayKey: string; // YYYY-MM-DD
  contractStartDayKey: string; // YYYY-MM-DD
  nowDayKey: string; // YYYY-MM-DD (current execution point)
  causalChainSteps?: Array<{
    sequence: number;
    description: string;
    projectId?: string;
    targetDate?: string | null; // Per-project deadline (2026-08-13), YYYY-MM-DD or null
    synchronizedDate?: string | null; // Buffer-adjusted date (2026-08-13 Gap 3), takes precedence over targetDate
  }>;
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
  causalChainSteps?: Array<{ sequence: number; description: string; projectId?: string; targetDate?: string | null }>
): AutoDeliverable[] {
  // If causal chain provided and non-empty, use it
  if (causalChainSteps && causalChainSteps.length > 0) {
    const sorted = [...causalChainSteps].sort((a, b) => a.sequence - b.sequence);
    return sorted.map((step, idx) => ({
      id: `deliv-causal-${step.sequence}`,
      title: step.description,
      kind: idx < 1 ? 'PLANNING' : idx < sorted.length - 1 ? 'CORE' : 'VERIFICATION',
      requiredBlocks: 1,
      sourceProjectId: step.projectId,
      targetDate: step.targetDate || null,
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
      throw new Error(
        `[deterministicPlanGenerator] getEligibleDays iteration cap exceeded: ${iterations} iterations, start=${startDayKey}, deadline=${deadlineDayKey}`
      );
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
  const { contractDeadlineDayKey, contractStartDayKey, nowDayKey, causalChainSteps, constraints, mode } = input;

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

  // Allocate blocks deterministically (phase-first, target-date-secondary)
  // Track daily duration totals (in minutes) for constraint enforcement
  const proposedBlocks: ProposedBlock[] = [];
  const targetDateConflicts: TargetDateConflict[] = [];
  let blockIndex = 0;
  const dailyMinutesTotal: Record<string, number> = {}; // Track minutes, not counts
  const maxDailyMinutes = constraints.maxBlocksPerDay * 60; // Convert hours constraint to minutes
  let weeklyCount: Record<string, number> = {};

  // Build block queue with deliverable metadata (phase, target date)
  interface BlockWithMeta {
    deliverableId: string;
    deliverableTitle: string;
    kind: 'PLANNING' | 'CORE' | 'VERIFICATION';
    order: number;
    sourceProjectId?: string;
    targetDate?: string | null;
  }
  const blockQueue: BlockWithMeta[] = deliverables.flatMap((deliv) =>
    Array(deliv.requiredBlocks)
      .fill(null)
      .map((_, idx) => ({
        deliverableId: deliv.id,
        deliverableTitle: deliv.title,
        kind: deliv.kind,
        order: idx,
        sourceProjectId: deliv.sourceProjectId,
        targetDate: deliv.targetDate || null,
      }))
  );

  /**
   * Find preferred day index for a block with a target date.
   * Prioritizes synchronizedDate (buffer-adjusted) over targetDate.
   * Returns the index in eligibleDays that matches or is closest to the preferred date.
   * Returns -1 if the date is outside the contract window.
   */
  function findPreferredDayIndex(targetDate: string | null, synchronizedDate: string | null): number {
    // Synchronized date (buffer-adjusted) takes precedence over declared target date
    const preferredDate = synchronizedDate || targetDate;
    if (!preferredDate) return 0; // No target date, use earliest-first (index 0)

    // Check if preferredDate is within contract window
    if (preferredDate < effectiveStartDayKey || preferredDate > contractDeadlineDayKey) {
      return -1; // Outside contract window — conflict
    }

    // Find the index of the matching or closest earlier eligible day
    for (let i = eligibleDays.length - 1; i >= 0; i--) {
      if (eligibleDays[i] <= preferredDate) {
        return i;
      }
    }

    // Preferred date is before all eligible days (shouldn't happen if window check passed)
    return 0;
  }

  // Track which deliverables have had conflicts flagged (to avoid duplicate flagging)
  const conflictFlaggedDeliverables = new Set<string>();

  // Allocate blocks to days (phase-first, target-date-secondary)
  // Track current position to enforce phase ordering: blocks must progress forward in time
  let currentDayIndex = 0;
  let allocationIterations = 0;

  for (const block of blockQueue) {
    if (blockIndex >= targetBlocks) break;

    let allocated = false;
    const preferredDayIndex = findPreferredDayIndex(block.targetDate, block.synchronizedDate);

    // If target date is outside contract window, flag conflict but still allocate
    if (preferredDayIndex === -1 && !conflictFlaggedDeliverables.has(block.deliverableId)) {
      const conflictDate = block.synchronizedDate || block.targetDate;
      targetDateConflicts.push({
        deliverableId: block.deliverableId,
        deliverableTitle: block.deliverableTitle,
        targetDate: conflictDate!,
        reason: 'OUTSIDE_CONTRACT_WINDOW',
        placedOnDate: '', // Will be filled after allocation
      });
      conflictFlaggedDeliverables.add(block.deliverableId);
    }

    // Flag divergence between targetDate and synchronizedDate (buffer adjustment)
    if (block.targetDate && block.synchronizedDate && block.targetDate !== block.synchronizedDate &&
        !conflictFlaggedDeliverables.has(block.deliverableId)) {
      targetDateConflicts.push({
        deliverableId: block.deliverableId,
        deliverableTitle: block.deliverableTitle,
        targetDate: block.targetDate,
        reason: 'CONVERGENCE_BUFFER_ADJUSTED',
        placedOnDate: block.synchronizedDate,
      });
      conflictFlaggedDeliverables.add(block.deliverableId);
    }

    // Determine start index: prefer target date if valid and >= current position (phase order), else use current
    let startIndex: number;
    if (preferredDayIndex >= 0 && preferredDayIndex >= currentDayIndex) {
      // Target date is valid and doesn't violate phase ordering
      startIndex = preferredDayIndex;
    } else if (preferredDayIndex >= 0 && preferredDayIndex < currentDayIndex) {
      // Target date is earlier than current position (would violate phase order), flag and use current
      if (!conflictFlaggedDeliverables.has(block.deliverableId)) {
        targetDateConflicts.push({
          deliverableId: block.deliverableId,
          deliverableTitle: block.deliverableTitle,
          targetDate: block.targetDate!,
          reason: 'CAPACITY_CLUSTER_CONFLICT',
          placedOnDate: '', // Will be filled after allocation
        });
        conflictFlaggedDeliverables.add(block.deliverableId);
      }
      startIndex = currentDayIndex;
    } else {
      // No target date, use current position (earliest-first within phase order)
      startIndex = currentDayIndex;
    }

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

      const dayKey = eligibleDays[(startIndex + attempt) % eligibleDays.length];
      const weekKey = getWeekStart(dayKey);

      const currentDailyMinutes = dailyMinutesTotal[dayKey] || 0;
      const weeklyCount_ = weeklyCount[weekKey] || 0;
      const blockDurationMinutes = 60; // All blocks in deterministic generator are 60 min

      // Check if adding this block would exceed daily duration limit and weekly block count limit
      if (currentDailyMinutes + blockDurationMinutes <= maxDailyMinutes && weeklyCount_ < constraints.maxBlocksPerWeek) {
        proposedBlocks.push({
          id: `block-${blockIndex}`,
          dayKey,
          deliverableId: block.deliverableId,
          deliverableTitle: block.deliverableTitle,
          kind: block.kind,
          durationMinutes: blockDurationMinutes,
          order: block.order,
          sourceProjectId: block.sourceProjectId,
        });

        // Update current day index to this day (blocks should generally progress forward)
        const placedDayIndex = eligibleDays.indexOf(dayKey);
        if (placedDayIndex >= currentDayIndex) {
          currentDayIndex = placedDayIndex;
        }

        // Check if we placed it on the preferred (synchronized or target) date
        const preferredDate = block.synchronizedDate || block.targetDate;
        if (preferredDate && dayKey !== preferredDate &&
            !conflictFlaggedDeliverables.has(block.deliverableId) &&
            preferredDayIndex >= 0 && preferredDayIndex >= currentDayIndex) {
          // Only flag if this was a capacity cluster (preferred was valid but we placed elsewhere due to capacity)
          targetDateConflicts.push({
            deliverableId: block.deliverableId,
            deliverableTitle: block.deliverableTitle,
            targetDate: block.targetDate || null,
            reason: 'CAPACITY_CLUSTER_CONFLICT',
            placedOnDate: dayKey,
          });
          conflictFlaggedDeliverables.add(block.deliverableId);
        } else if (preferredDate && dayKey === preferredDate) {
          // Successfully placed on preferred date — mark so we don't flag it again
          conflictFlaggedDeliverables.add(block.deliverableId);
        }

        dailyMinutesTotal[dayKey] = currentDailyMinutes + blockDurationMinutes;
        weeklyCount[weekKey] = weeklyCount_ + 1;
        blockIndex++;
        allocated = true;
      }
    }
  }

  // Guarantee at least 1 block if we computed targetBlocks >= 1
  if (proposedBlocks.length === 0 && targetBlocks >= 1) {
    return {
      status: 'INFEASIBLE',
      proposedBlocks: [],
      autoDeliverables: deliverables,
      targetDateConflicts: targetDateConflicts.length > 0 ? targetDateConflicts : undefined,
      error: {
        code: 'NO_ELIGIBLE_DAYS',
        message: 'Failed to allocate blocks despite eligible days',
      },
    };
  }

  // Capacity violation contract (2026-07-13, §5): if what actually got allocated is less
  // than what the causal chain / auto-deliverables required, this is PARTIAL, not SUCCESS.
  // Name what got cut instead of letting it disappear silently.
  if (proposedBlocks.length < totalBlocksRequired) {
    const allocatedByDeliverable: Record<string, number> = {};
    proposedBlocks.forEach((b) => {
      allocatedByDeliverable[b.deliverableId] = (allocatedByDeliverable[b.deliverableId] || 0) + 1;
    });
    const cutSteps: CapacityViolation['cutSteps'] = [];
    deliverables.forEach((deliv) => {
      const allocated = allocatedByDeliverable[deliv.id] || 0;
      if (allocated < deliv.requiredBlocks) {
        cutSteps.push({ deliverableId: deliv.id, deliverableTitle: deliv.title });
      }
    });
    const shortfall = totalBlocksRequired - proposedBlocks.length;
    return {
      status: 'PARTIAL',
      proposedBlocks,
      autoDeliverables: deliverables,
      capacityViolation: {
        requiredBlocks: totalBlocksRequired,
        availableBlocks: maxBlocksForPeriod,
        overageMinutes: shortfall * 60,
        cutSteps,
      },
      targetDateConflicts: targetDateConflicts.length > 0 ? targetDateConflicts : undefined,
    };
  }

  return {
    status: 'SUCCESS',
    proposedBlocks,
    autoDeliverables: deliverables,
    targetDateConflicts: targetDateConflicts.length > 0 ? targetDateConflicts : undefined,
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
