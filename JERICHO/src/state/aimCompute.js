// Phase 2A deterministic AIM compute (pure functions, no side effects).

// Domain inference keywords (lowercase)
const DOMAIN_KEYWORDS = {
  RESOURCES: ['money', 'revenue', 'sales', 'client', 'customers', 'customer', 'deal', 'cash'],
  CREATION: ['music', 'album', 'song', 'label', 'content', 'video', 'script', 'write', 'record'],
  BODY: ['sleep', 'gym', 'health', 'food', 'run', 'workout', 'exercise', 'rest'],
  FOCUS: [], // fallback
};

export function computeGoalProfile(goal = '', deadlineISO = null, todayKey = null) {
  const tokens = normalizeText(goal);
  const dominantDomain = inferDomain(tokens);
  const today = todayKey ? new Date(`${todayKey}T00:00:00`) : new Date();
  const deadline = deadlineISO ? new Date(deadlineISO) : null;
  const daysRemaining = deadline
    ? Math.max(0, Math.round((deadline.getTime() - today.getTime()) / (24 * 60 * 60 * 1000)))
    : 999;
  const urgencyBand = daysRemaining <= 14 ? 'high' : daysRemaining <= 60 ? 'medium' : 'low';
  return {
    daysRemaining,
    urgencyBand,
    dominantDomain,
    goalTokens: tokens,
  };
}

export function getTodayCandidates(blocks = [], todayKey) {
  const todayBlocks = (blocks || []).filter((b) => (b.start || '').slice(0, 10) === todayKey);
  const candidates = todayBlocks.map((b) => ({
    kind: 'scheduled_block',
    blockId: b.id,
    domain: (b.practice || b.domain || 'FOCUS').toUpperCase(),
    durationMinutes: b.durationMinutes || estimateDuration(b),
    startISO: b.start,
    title: b.label || `${b.practice || b.domain || 'Block'}`,
    deliverableId: b.deliverableId, // Task 3: preserve deliverable linkage for urgency scoring
  }));
  return candidates;
}

export function scoreCandidate(candidate, goalProfile, blocksForToday = [], urgencyRanking = {}, deliverableId = null) {
  let score = 0;
  const rationale = [];
  let claimType = null;
  let urgencyBand = null;

  if (candidate.domain === goalProfile.dominantDomain) {
    score += 40;
    rationale.push('Domain matches goal');
    if (goalProfile.urgencyBand === 'high') {
      score += 25;
      rationale.push('High urgency');
    }
  }

  // Task 3: Boost score for blocks linked to urgent Deliverables
  if (deliverableId && urgencyRanking[deliverableId]) {
    const urgency = urgencyRanking[deliverableId];
    urgencyBand = urgency.urgencyBand;

    if (urgencyBand === 'CRITICAL') {
      const TODO_CALIBRATE_CRITICAL_BOOST = 25;
      score += TODO_CALIBRATE_CRITICAL_BOOST;
      rationale.push('Blocks urgent chain (CRITICAL)');
      claimType = 'CONSTRAINT';
    } else if (urgencyBand === 'HIGH') {
      const TODO_CALIBRATE_HIGH_BOOST = 15;
      score += TODO_CALIBRATE_HIGH_BOOST;
      rationale.push('Blocks urgent chain (HIGH)');
      claimType = 'CONSTRAINT';
    } else if (urgencyBand === 'MEDIUM') {
      claimType = 'INTENT';
      rationale.push('Advances important deliverable');
    }
    // LOW urgency: claimType remains null, no key added to return
  }

  if (candidate.kind === 'scheduled_block') {
    const status = findBlockStatus(blocksForToday, candidate.blockId);
    if (status === 'pending') {
      score += 15;
      rationale.push('Pending block ready to execute');
    }
    if (status === 'completed') {
      score -= 10;
      rationale.push('Already completed');
    }
  }
  if (candidate.durationMinutes >= 15 && candidate.durationMinutes <= 90) {
    score += 10;
    rationale.push('Duration in sweet spot');
  }
  if (candidate.durationMinutes > 180) {
    score -= 20;
    rationale.push('Duration too long');
  }

  // Build result object, conditionally including claimType only when assigned
  const result = { score, rationale, urgencyBand, deliverableId };
  if (claimType !== null) {
    result.claimType = claimType;
  }
  return result;
}

export function computeNextBestMove(
  goal,
  deadlineISO,
  blocks = [],
  history = [],
  todayKey,
  urgencyRanking = {},
  deliverablesById = {},
  longLeadThresholdDays = 90,
  barriersById = {}
) {
  const profile = computeGoalProfile(goal, deadlineISO, todayKey);
  let todayBlocks = blocks.filter((b) => (b.start || '').slice(0, 10) === todayKey);

  // Task 4: Apply non-domination filter for long-lead items
  todayBlocks = applyNonDominationFilter(
    todayBlocks,
    deliverablesById,
    urgencyRanking,
    longLeadThresholdDays,
    todayKey
  );

  // Step 4: Apply barrier hard-filter (exclude blocks tied to projects with CONSTRAINT barriers)
  todayBlocks = applyBarrierHardFilter(
    todayBlocks,
    barriersById,
    deliverablesById
  );

  let candidates = getTodayCandidates(blocks, todayKey);
  const unfilteredCandidatesCount = candidates.filter((c) => c.kind === 'scheduled_block').length;

  // Filter candidates to exclude those tied to projects with CONSTRAINT barriers
  candidates = candidates.filter((c) => {
    if (c.kind !== 'scheduled_block') {return true;} // Keep gap_fill and first_move
    if (!c.deliverableId) {return true;} // Keep if no deliverable
    const deliverable = deliverablesById[c.deliverableId];
    if (!deliverable) {return true;} // Keep if deliverable unknown
    // Check if deliverable's project is blocked
    const blockedProjectIds = new Set();
    for (const barrier of Object.values(barriersById)) {
      if (barrier && barrier.type === 'legalFormation' && barrier.claimType === 'CONSTRAINT' && barrier.projectId) {
        blockedProjectIds.add(barrier.projectId);
      }
    }
    return !blockedProjectIds.has(deliverable.owningProjectId);
  });

  // If barriers filtered out all scheduled blocks, return null (hard constraint)
  const filteredScheduledBlocksCount = candidates.filter((c) => c.kind === 'scheduled_block').length;
  if (unfilteredCandidatesCount > 0 && filteredScheduledBlocksCount === 0) {
    return null;
  }

  // gap_fill if no block in dominant domain today
  const hasDominant = todayBlocks.some((b) => (b.practice || b.domain || '').toUpperCase() === profile.dominantDomain);
  if (!hasDominant) {
    candidates.push({
      kind: 'gap_fill',
      domain: profile.dominantDomain,
      durationMinutes: 30,
      title: `Goal-aligned ${profile.dominantDomain.toLowerCase()} block`,
    });
  }
  if (!todayBlocks.length) {
    candidates.push({
      kind: 'first_move',
      domain: profile.dominantDomain,
      durationMinutes: 30,
      title: `First move toward goal`,
    });
  }

  if (!candidates.length) {
    return null;
  }

  const ordered = [...candidates].sort(candidateOrder);
  const scored = ordered.map((c) => {
    const scoredObj = scoreCandidate(
      c,
      profile,
      todayBlocks,
      urgencyRanking,
      c.deliverableId
    );
    // Preserve the scored object structure (claimType only present if assigned by scoreCandidate)
    return { candidate: c, ...scoredObj };
  });

  scored.sort((a, b) => {
    if (b.score !== a.score) {
      return b.score - a.score;
    }
    if ((a.candidate.durationMinutes || 0) !== (b.candidate.durationMinutes || 0)) {
      return (a.candidate.durationMinutes || 0) - (b.candidate.durationMinutes || 0);
    }
    const aStart = a.candidate.startISO ? new Date(a.candidate.startISO).getTime() : Infinity;
    const bStart = b.candidate.startISO ? new Date(b.candidate.startISO).getTime() : Infinity;
    if (aStart !== bStart) {
      return aStart - bStart;
    }
    const aLex = a.candidate.blockId || a.candidate.title || '';
    const bLex = b.candidate.blockId || b.candidate.title || '';
    return aLex.localeCompare(bLex);
  });

  const top = scored[0];
  const c = top.candidate;
  const rationale = top.rationale.slice(0, 3);

  if (c.kind === 'scheduled_block') {
    const executeResult = {
      type: 'execute',
      domain: toTitle(c.domain),
      durationMinutes: c.durationMinutes,
      blockId: c.blockId,
      rationale,
      doneWhen: 'When the referenced block is completed today.',
      deliverableId: top.deliverableId,
      urgencyBand: top.urgencyBand,
    };
    if ('claimType' in top) {
      executeResult.claimType = top.claimType;
    }
    return executeResult;
  }

  const scheduleResult = {
    type: 'schedule',
    domain: toTitle(c.domain),
    durationMinutes: 30,
    rationale,
    doneWhen: 'When a block of this domain and duration is completed today.',
    deliverableId: top.deliverableId,
    urgencyBand: top.urgencyBand,
  };
  if ('claimType' in top) {
    scheduleResult.claimType = top.claimType;
  }
  return scheduleResult;
}

// --- helpers ---

function normalizeText(text) {
  return (text || '')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
}

function inferDomain(tokens) {
  const match = (domain) => DOMAIN_KEYWORDS[domain].some((k) => tokens.includes(k));
  if (match('RESOURCES')) {
    return 'RESOURCES';
  }
  if (match('CREATION')) {
    return 'CREATION';
  }
  if (match('BODY')) {
    return 'BODY';
  }
  return 'FOCUS';
}

function estimateDuration(block) {
  if (block?.durationMinutes) {
    return block.durationMinutes;
  }
  const start = block?.start ? new Date(block.start) : null;
  const end = block?.end ? new Date(block.end) : null;
  if (start && end) {
    return Math.max(1, Math.round((end.getTime() - start.getTime()) / 60000));
  }
  return 30;
}

function findBlockStatus(blocks, id) {
  const b = (blocks || []).find((x) => x.id === id);
  return b ? b.status || 'pending' : 'pending';
}

function toTitle(domain) {
  const lower = (domain || 'FOCUS').toLowerCase();
  return lower.charAt(0).toUpperCase() + lower.slice(1);
}

// Deterministic ordering to keep pinning stable regardless of input order.
function candidateOrder(a, b) {
  const aStart = a.startISO ? new Date(a.startISO).getTime() : Infinity;
  const bStart = b.startISO ? new Date(b.startISO).getTime() : Infinity;
  if (aStart !== bStart) {
    return aStart - bStart;
  }

  const aDur = a.durationMinutes || 0;
  const bDur = b.durationMinutes || 0;
  if (aDur !== bDur) {
    return aDur - bDur;
  }

  const aDomain = a.domain || '';
  const bDomain = b.domain || '';
  if (aDomain !== bDomain) {
    return aDomain.localeCompare(bDomain);
  }

  const aTitle = a.title || '';
  const bTitle = b.title || '';
  if (aTitle !== bTitle) {
    return aTitle.localeCompare(bTitle);
  }

  const aId = a.blockId || '';
  const bId = b.blockId || '';
  return aId.localeCompare(bId);
}

// ─────────────────────────────────────────────────────────────────────────
// Task 4: Long-Horizon Item Distribution
// ─────────────────────────────────────────────────────────────────────────

/**
 * Determine if a block is long-lead for filtering purposes.
 * @param {object} block - Block with scheduledDate
 * @param {number} longLeadThresholdDays - Threshold (default 90)
 * @param {string} baseDate - ISO date to measure from (today)
 * @returns {boolean} True if block's scheduled date is >threshold days away
 */
export function isLongLeadForFilter(block, longLeadThresholdDays = 90, baseDate = null) {
  if (!block?.scheduledDate) {return false;}
  const base = baseDate ? new Date(baseDate) : new Date();
  const scheduled = new Date(block.scheduledDate);
  const daysUntil = (scheduled.getTime() - base.getTime()) / (1000 * 60 * 60 * 24);
  return daysUntil > longLeadThresholdDays;
}

/**
 * Determine if a Deliverable is long-lead for allocation purposes.
 * @param {object} deliverable - Deliverable with targetDate
 * @param {number} longLeadThresholdDays - Threshold (default 90)
 * @param {string} baseDate - ISO date to measure from (today)
 * @returns {boolean} True if Deliverable's targetDate is >threshold days away
 */
export function isLongLeadForAllocation(deliverable, longLeadThresholdDays = 90, baseDate = null) {
  if (!deliverable?.targetDate) {return false;}
  const base = baseDate ? new Date(baseDate) : new Date();
  const target = new Date(deliverable.targetDate);
  const daysUntil = (target.getTime() - base.getTime()) / (1000 * 60 * 60 * 24);
  return daysUntil > longLeadThresholdDays;
}

/**
 * Check if all CRITICAL/HIGH urgency chains are satisfied (cleared from ranking).
 * @param {Record<string, object>} urgencyRanking - Task 2's urgency ranking output
 * @returns {boolean} True if no CRITICAL or HIGH items currently ranked
 */
export function areUrgentChainsCleared(urgencyRanking = {}) {
  return !Object.values(urgencyRanking).some(
    (item) => item?.urgencyBand === 'CRITICAL' || item?.urgencyBand === 'HIGH'
  );
}

/**
 * Apply non-domination hard rule: exclude long-lead blocks from recommendations.
 * @param {Array} todayBlocks - Blocks available today
 * @param {Record<string, object>} deliverablesById - Matrix deliverables
 * @param {Record<string, object>} urgencyRanking - Task 2 urgency ranking
 * @param {number} longLeadThresholdDays - Threshold (default 90)
 * @param {string} todayKey - Today's date (ISO)
 * @returns {Array} Filtered blocks (excluding long-lead unless override/chains cleared)
 */
export function applyNonDominationFilter(
  todayBlocks = [],
  deliverablesById = {},
  urgencyRanking = {},
  longLeadThresholdDays = 90,
  todayKey = null
) {
  const baseDate = todayKey ? `${todayKey}T00:00:00Z` : null;
  const urgentCleared = areUrgentChainsCleared(urgencyRanking);

  return todayBlocks.filter((block) => {
    // If block has no deliverableId, allow it (not part of long-lead filtering)
    if (!block.deliverableId) {return true;}

    const deliverable = deliverablesById[block.deliverableId];
    if (!deliverable) {return true;} // Allow if deliverable not found

    // Check if block is long-lead
    if (isLongLeadForFilter(block, longLeadThresholdDays, baseDate)) {
      // Allow if:
      // 1. Operator has added CONSTRAINT override (checked via deliverable flag)
      // 2. OR all CRITICAL/HIGH chains are cleared (urgent work done)
      const hasOverride = deliverable._hasConstraintOverride === true;
      if (hasOverride || urgentCleared) {
        return true;
      }
      // Otherwise, filter out (suppress long-lead)
      return false;
    }

    return true; // Allow non-long-lead blocks
  });
}

/**
 * Step 4 Barrier Hard-Filter: Exclude blocks tied to projects with CONSTRAINT-level barriers.
 * A block is excluded if its deliverable links to a project that has an active legal-formation barrier.
 * @param {array} todayBlocks - Blocks scheduled for today
 * @param {object} barriersById - Matrix barriers, keyed by ID
 * @param {object} deliverablesById - Matrix deliverables, keyed by ID
 * @returns {array} Filtered blocks (excludes those tied to blocked projects)
 */
export function applyBarrierHardFilter(todayBlocks = [], barriersById = {}, deliverablesById = {}) {
  // Build a set of project IDs that have active CONSTRAINT barriers
  const blockedProjectIds = new Set();
  for (const barrier of Object.values(barriersById)) {
    if (barrier && barrier.type === 'legalFormation' && barrier.claimType === 'CONSTRAINT' && barrier.projectId) {
      blockedProjectIds.add(barrier.projectId);
    }
  }

  if (blockedProjectIds.size === 0) {
    return todayBlocks; // No barriers, return all blocks
  }

  return todayBlocks.filter((block) => {
    // Blocks without deliverable ID pass through (not linked to a project)
    if (!block.deliverableId) {return true;}

    const deliverable = deliverablesById[block.deliverableId];
    if (!deliverable) {return true;} // Allow if deliverable not found

    // Exclude if deliverable's owning project is in the blocked set
    if (deliverable.owningProjectId && blockedProjectIds.has(deliverable.owningProjectId)) {
      return false; // Filter out: project is blocked by a barrier
    }

    return true; // Allow: project is not blocked
  });
}

// ─────────────────────────────────────────────────────────────────────────
// Demand Computation (Task 1: supporting data input to urgency ranking)
// ─────────────────────────────────────────────────────────────────────────

/**
 * Compute raw Demand (aggregated block duration) for a single Deliverable.
 * Supporting data input for Task 2's urgency ranking — not the operator-facing sort order.
 * @param {string} deliverableId - Deliverable ID to compute demand for
 * @param {object} state - Full identity state
 * @returns {number} Total minutes of blocks linked to this deliverable
 */
export function computeDeliverableDemand(deliverableId, state) {
  if (!deliverableId || !state?.planBlocks) {
    return 0;
  }
  const blocks = Object.values(state.planBlocks || {});
  const totalMinutes = blocks
    .filter((b) => b.deliverableId === deliverableId)
    .reduce((sum, b) => sum + (b.durationMinutes || 0), 0);
  return totalMinutes;
}

/**
 * Compute Demand for all Deliverables in state.
 * @param {object} state - Full identity state
 * @returns {Record<string, number>} Map of deliverable ID to total demand minutes
 */
export function computeAllDeliverableDemands(state) {
  const deliverables = state?.matrix?.deliverablesById || {};
  const result = {};
  for (const id of Object.keys(deliverables)) {
    result[id] = computeDeliverableDemand(id, state);
  }
  return result;
}

// ─────────────────────────────────────────────────────────────────────────
// Blocking-Chain Urgency Ranking (Task 2: cross-lane transitive closure)
// ─────────────────────────────────────────────────────────────────────────

/**
 * BFS traversal to find all Deliverables downstream from a given Deliverable
 * (i.e., what depends on this item, what is blocked waiting for it).
 * @param {string} deliverableId - Starting Deliverable ID
 * @param {Record<string, object>} dependenciesById - Dependency edges from matrix
 * @returns {string[]} List of downstream Deliverable IDs
 */
function traverseBlockedItems(deliverableId, dependenciesById = {}) {
  if (!deliverableId || !dependenciesById) {return [];}

  const visited = new Set();
  const queue = [deliverableId];
  const blocked = [];

  while (queue.length > 0) {
    const current = queue.shift();
    if (visited.has(current)) {continue;}
    visited.add(current);

    // Find all dependencies where 'current' is the blocker (upstream)
    for (const dep of Object.values(dependenciesById)) {
      if (!dep) {continue;}
      if (dep.blockerId === current && dep.blockedId && !visited.has(dep.blockedId)) {
        queue.push(dep.blockedId);
        blocked.push(dep.blockedId);
      }
    }
  }

  return blocked;
}

/**
 * Find the owning Initiative of a Deliverable (through its Project).
 * @param {string} itemId - Deliverable ID
 * @param {object} matrix - State matrix containing deliverables, projects, initiatives
 * @returns {string | null} Initiative ID or null
 */
function findOwningInitiativeForDeliverable(itemId, matrix = {}) {
  const deliverable = matrix.deliverablesById?.[itemId];
  if (!deliverable) {return null;}
  return deliverable.owningInitiativeId || null;
}

/**
 * Get the macro-deadline for an Initiative (from its linked Lane's milestones/laneEnd).
 * @param {string} initiativeId - Initiative ID
 * @param {object} state - Full state with matrix and masterPlan data
 * @returns {string | null} ISO date string or null
 */
function getMacroDeadlineForInitiative(initiativeId, state = {}) {
  if (!initiativeId) {return null;}

  const initiative = state.matrix?.initiativesById?.[initiativeId];
  if (!initiative || !initiative.laneId) {return null;}

  const lane = state.masterPlanLanesById?.[initiative.laneId];
  if (!lane) {return null;}

  // Prefer milestone dates if available
  const milestones = Object.values(state.masterPlanMilestonesById || {})
    .filter((m) => m?.laneIds?.includes(initiative.laneId))
    .map((m) => m.date)
    .filter(Boolean)
    .sort();

  if (milestones.length > 0) {
    return milestones[milestones.length - 1]; // Latest milestone
  }

  return lane.laneEnd || null; // Fallback to lane end
}

/**
 * Compute urgency band for a single Deliverable based on blocking chains and macro-deadlines.
 * @param {object} deliverable - Deliverable from matrix
 * @param {object} state - Full state with dependencies, initiatives, lanes, masterPlan
 * @returns {object} Urgency info: band, daysToDeadline, chainDepth, blockedItems, demandMinutes
 */
function computeBlockingChainUrgency(deliverable, state = {}) {
  if (!deliverable) {
    return {
      urgencyBand: 'LOW',
      daysToDeadline: Infinity,
      chainDepth: 0,
      blockedItems: [],
      demandMinutes: 0,
    };
  }

  // Find all downstream Deliverables that depend on this one
  const blockedItems = traverseBlockedItems(
    deliverable.id,
    state.matrix?.dependenciesById
  );

  // Find unique Initiatives owning blocked items
  const initiatives = new Set();
  for (const itemId of blockedItems) {
    const ownerId = findOwningInitiativeForDeliverable(itemId, state.matrix);
    if (ownerId) {initiatives.add(ownerId);}
  }

  // Get macro-deadlines for all initiatives in the blocked chain
  const deadlines = Array.from(initiatives)
    .map((initId) => getMacroDeadlineForInitiative(initId, state))
    .filter(Boolean)
    .sort();

  const demand = computeDeliverableDemand(deliverable.id, state);

  if (!state.appTime?.nowISO) {
    throw new Error(
      'computeBlockingChainUrgency requires state.appTime.nowISO to be set. ' +
      'Silent fallback to real wall-clock time is not permitted (breaks determinism). ' +
      'Ensure appTime is initialized in the state before computing urgency.'
    );
  }
  const now = new Date(state.appTime.nowISO);

  if (deadlines.length === 0) {
    return {
      urgencyBand: 'LOW',
      daysToDeadline: Infinity,
      chainDepth: blockedItems.length,
      blockedItems,
      demandMinutes: demand,
    };
  }

  const nearestDeadline = new Date(deadlines[0]);
  const daysRemaining = (nearestDeadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);

  let urgencyBand;
  if (daysRemaining <= 7) {urgencyBand = 'CRITICAL';}
  else if (daysRemaining <= 21) {urgencyBand = 'HIGH';}
  else if (daysRemaining <= 60) {urgencyBand = 'MEDIUM';}
  else {urgencyBand = 'LOW';}

  return {
    urgencyBand,
    daysToDeadline: Math.max(0, daysRemaining),
    chainDepth: blockedItems.length,
    blockedItems,
    demandMinutes: demand,
  };
}

/**
 * Rank all Deliverables by blocking-chain urgency for the operator.
 * @param {object} state - Full state
 * @returns {Record<string, object>} Ranked deliverables with urgency metadata
 */
export function computeDeliverableUrgencyRanking(state = {}) {
  const deliverables = state.matrix?.deliverablesById || {};
  const scored = {};

  // Compute urgency for each CONFIRMED deliverable
  for (const id of Object.keys(deliverables)) {
    const deliverable = deliverables[id];
    if (deliverable.reviewStatus !== 'CONFIRMED') {continue;}

    const urgency = computeBlockingChainUrgency(deliverable, state);
    scored[id] = {
      id,
      name: deliverable.name,
      urgencyBand: urgency.urgencyBand,
      daysToDeadline: urgency.daysToDeadline,
      chainDepth: urgency.chainDepth,
      blockedItems: urgency.blockedItems,
      demandMinutes: urgency.demandMinutes,
      owningInitiativeId: deliverable.owningInitiativeId,
      owningProjectId: deliverable.owningProjectId,
    };
  }

  // Sort by urgency band (CRITICAL > HIGH > MEDIUM > LOW)
  // then by demand within band
  const bandOrder = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
  const sortedIds = Object.keys(scored).sort((a, b) => {
    const aEntry = scored[a];
    const bEntry = scored[b];

    const bandDiff = bandOrder[aEntry.urgencyBand] - bandOrder[bEntry.urgencyBand];
    if (bandDiff !== 0) {return bandDiff;}

    // Within same band, higher demand first
    return bEntry.demandMinutes - aEntry.demandMinutes;
  });

  // Assign rank and build final result
  const result = {};
  sortedIds.forEach((id, index) => {
    result[id] = {
      ...scored[id],
      rank: index + 1, // 1-indexed
    };
  });

  return result;
}
