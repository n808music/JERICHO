/**
 * Scheduling Agent
 *
 * Agent 4 in the integration order.
 * Collects user work window preferences, translates to scheduling policy,
 * triggers deterministic schedule proposal.
 */

import { randomUUID } from 'crypto';
import {
  assertMaterializedBlockDependencies,
  buildDependencyAwareBlocks,
  resolveTransitiveDependencyIds
} from './schedule-dependency-enforcement.js';

/**
 * Generate schedule proposal from scheduling policy
 * @param {Object} schedulingPolicy - structured scheduling policy
 * @param {Object} effortEstimate - from Agent 3
 * @param {Array} actionGraph - actions to schedule
 * @param {string} goalId - the goal ID
 * @returns {Object} schedule proposal
 */
export function generateScheduleProposal(schedulingPolicy, effortEstimate, actionGraph, goalId) {
  const {
    workWindows,
    sessionConstraints,
    dateConstraints,
    pacingPolicy,
    dependencyOrder,
    goalFamily,
    goalSubtype,
    familySchedulingPolicy
  } = schedulingPolicy;

  // Validate inputs
  if (!workWindows || !workWindows.length) {
    return {
      proposedBlocks: [],
      unscheduledItems: actionGraph,
      conflictReasons: ['No work windows defined'],
      schedulingStatus: 'FAILED',
      coveragePercent: 0,
      proposalSummary: { totalBlocks: 0, totalHours: 0 },
      errorCode: 'NO_WORK_WINDOWS'
    };
  }

  // Generate available time slots from work windows
  const availableSlots = generateAvailableSlots(schedulingPolicy);

  // Sort actions by dependency order
  const sortedActions = sortActionsByDependency(actionGraph);

  // Apply family-specific scheduling rules
  const familyAdjustedActions = applyFamilySchedulingRules(sortedActions, goalFamily, goalSubtype, familySchedulingPolicy);

  // Schedule actions into slots
  const { placedBlocks, unplacedActions, conflicts } = scheduleActionsIntoSlots(
    familyAdjustedActions,
    availableSlots,
    sessionConstraints,
    pacingPolicy,
    dateConstraints
  );
  const dependencyAwareBlocks = buildDependencyAwareBlocks(placedBlocks, actionGraph);

  try {
    assertMaterializedBlockDependencies(dependencyAwareBlocks);
  } catch (error) {
    return {
      proposedBlocks: dependencyAwareBlocks.map((block) => ({
        ...block,
        status: 'suggested',
        goalId,
        cycleId: `cycle-${goalId}-0`
      })),
      unscheduledItems: unplacedActions,
      conflictReasons: [
        ...conflicts,
        ...(error.violations || []).map((violation) =>
          `Dependency violation: ${violation.actionId} scheduled at ${violation.scheduledDate} before ${violation.dependencyActionId} completes at ${violation.dependencyCompletionDate}`
        )
      ],
      schedulingStatus: 'FAILED',
      coveragePercent: 0,
      proposalSummary: { totalBlocks: dependencyAwareBlocks.length, totalHours: 0 },
      errorCode: error.code || 'DEPENDENCY_ORDER_VIOLATED',
      constraintViolations: error.violations || []
    };
  }

  // Calculate coverage
  const totalEstimatedHours = effortEstimate.estimatedTotalEffortHours;
  const scheduledHours = dependencyAwareBlocks.reduce((sum, block) => sum + block.durationMinutes, 0) / 60;
  const coveragePercent = totalEstimatedHours > 0 ? Math.round((scheduledHours / totalEstimatedHours) * 100) : 0;

  // Build proposal summary
  const proposalSummary = {
    totalBlocks: dependencyAwareBlocks.length,
    totalHours: scheduledHours,
    firstBlockDate: dependencyAwareBlocks.length ? dependencyAwareBlocks[0].date : null,
    lastBlockDate: dependencyAwareBlocks.length ? dependencyAwareBlocks[dependencyAwareBlocks.length - 1].date : null,
    pacingActual: pacingPolicy
  };

  const schedulingStatus = unplacedActions.length === 0 ? 'COMPLETE' :
                          dependencyAwareBlocks.length > 0 ? 'PARTIAL' : 'FAILED';

  return {
    proposedBlocks: dependencyAwareBlocks.map(block => ({
      ...block,
      status: 'suggested',
      goalId,
      cycleId: `cycle-${goalId}-0` // Assuming single cycle for now
    })),
    unscheduledItems: unplacedActions,
    conflictReasons: conflicts,
    schedulingStatus,
    coveragePercent,
    proposalSummary,
    errorCode: null
  };
}

/**
 * Generate available time slots from work windows
 */
function generateAvailableSlots(policy) {
  const { workWindows, dateConstraints } = policy;
  const slots = [];

  // Generate dates between start and deadline
  const startDate = new Date(dateConstraints.startDate);
  const endDate = new Date(dateConstraints.deadline);
  const dates = [];

  for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
    dates.push(d.toISOString().split('T')[0]);
  }

  // For each date, check if it matches work windows
  for (const date of dates) {
    const dayOfWeek = new Date(date).toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();

    for (const window of workWindows) {
      if (window.dayOfWeek === dayOfWeek) {
        // Check if date is blocked
        if (isDateBlocked(date, dateConstraints)) continue;

        // Generate slots within the window
        const slotsInWindow = generateSlotsInWindow(date, window, policy.sessionConstraints);
        slots.push(...slotsInWindow);
      }
    }
  }

  return slots.sort((a, b) => {
    if (a.date !== b.date) {
      return a.date.localeCompare(b.date);
    }

    return a.startTime.localeCompare(b.startTime);
  });
}

/**
 * Check if date is blocked
 */
function isDateBlocked(date, dateConstraints) {
  const { hardBlockedDates = [] } = dateConstraints;

  if (hardBlockedDates.includes(date)) return true;

  // Check recurring blocked windows (simplified)
  // For now, assume no recurring blocks
  return false;
}

/**
 * Generate slots within a time window
 */
function generateSlotsInWindow(date, window, sessionConstraints) {
  const slots = [];
  const { startTime, endTime, availableMinutes } = window;
  const { minimumMinutes, maximumMinutes, bufferMinutes = 0 } = sessionConstraints;

  const start = new Date(`${date}T${startTime}`);
  const end = new Date(`${date}T${endTime}`);
  const totalMinutes = (end - start) / (1000 * 60);

  let currentStart = new Date(start);

  while (currentStart < end) {
    const remainingMinutes = (end - currentStart) / (1000 * 60);
    const slotMinutes = Math.min(maximumMinutes, remainingMinutes);

    if (slotMinutes >= minimumMinutes) {
      const currentEnd = new Date(currentStart.getTime() + slotMinutes * 60 * 1000);

      slots.push({
        date,
        startTime: currentStart.toTimeString().slice(0, 5),
        endTime: currentEnd.toTimeString().slice(0, 5),
        durationMinutes: slotMinutes,
        available: true
      });

      currentStart = new Date(currentEnd.getTime() + bufferMinutes * 60 * 1000);
    } else {
      break;
    }
  }

  return slots;
}

/**
 * Sort actions by dependency order
 */
function sortActionsByDependency(actions) {
  const actionById = new Map((actions || []).map((action) => [action.actionId || action.id, action]));
  const visited = new Set();
  const ordered = [];

  const visit = (action) => {
    const actionId = action.actionId || action.id;
    if (!actionId || visited.has(actionId)) {
      return;
    }

    visited.add(actionId);
    for (const dependencyId of action.dependsOn || []) {
      const dependency = actionById.get(dependencyId);
      if (dependency) {
        visit(dependency);
      }
    }
    ordered.push(action);
  };

  [...actions]
    .sort((a, b) => (a.dependencyPosition || 0) - (b.dependencyPosition || 0))
    .forEach((action) => visit(action));

  return ordered;
}

/**
 * Apply family-specific scheduling rules
 */
function applyFamilySchedulingRules(actions, goalFamily, goalSubtype, familyPolicy) {
  // Apply family rules to modify action scheduling preferences
  const modifiedActions = actions.map(action => ({ ...action }));

  switch (goalFamily) {
    case 'SkillAcquisition':
      // Enforce minimum rest days
      modifiedActions.forEach(action => {
        action.minRestDays = familyPolicy.practiceFrequency === 'daily' ? 0 : 1;
      });
      break;
    case 'PhysicalTraining':
      // Apply rest day requirements
      {
        const restDays = getRestDaysForSubtype(goalSubtype);
        modifiedActions.forEach(action => {
          action.minRestDays = restDays;
        });
      }
      break;
    case 'JobSearchPipeline':
      // Pair outreach with follow-up
      modifiedActions.forEach(action => {
        if (action.type === 'outreach') {
          action.requiresFollowUp = true;
          action.followUpDelayDays = 3;
        }
      });
      break;
    // Add other families as needed
  }

  return modifiedActions;
}

/**
 * Get rest days for physical training subtypes
 */
function getRestDaysForSubtype(subtype) {
  switch (subtype) {
    case 'Strength Program': return 1;
    case 'Rehab Return to Training': return 2;
    default: return 0;
  }
}

/**
 * Schedule actions into available slots
 */
function scheduleActionsIntoSlots(actions, availableSlots, sessionConstraints, pacingPolicy, dateConstraints) {
  const placedBlocks = [];
  const unplacedActions = [];
  const conflicts = [];
  const placedBlocksByActionId = new Map();
  const actionById = new Map((actions || []).map((action) => [action.actionId || action.id, action]));
  const transitiveDependencyMemo = new Map();

  // Apply pacing policy to distribute actions
  const pacedActions = applyPacingPolicy(actions, pacingPolicy, dateConstraints);

  for (const action of pacedActions) {
    const actionId = action.actionId || action.id;
    const transitiveDependencyIds = resolveTransitiveDependencyIds(actionId, actionById, transitiveDependencyMemo);
    const missingDependencyIds = transitiveDependencyIds.filter((dependencyId) => !placedBlocksByActionId.has(dependencyId));

    if (missingDependencyIds.length > 0) {
      unplacedActions.push({
        ...action,
        reason: `Blocked by unscheduled dependencies: ${missingDependencyIds.join(', ')}`
      });
      conflicts.push(`Could not place action: ${action.title || action.id}; blocked by dependencies`);
      continue;
    }

    const earliestStartTime = transitiveDependencyIds.reduce((latestTimestamp, dependencyId) => {
      const dependencyBlock = placedBlocksByActionId.get(dependencyId);
      const dependencyCompletion = dependencyBlock?.completionDate ? new Date(dependencyBlock.completionDate).getTime() : 0;
      return Math.max(latestTimestamp, dependencyCompletion);
    }, 0);

    const placed = tryPlaceAction(action, availableSlots, sessionConstraints, earliestStartTime, transitiveDependencyIds);
    if (placed) {
      placedBlocks.push(placed);
      placedBlocksByActionId.set(placed.actionId, placed);
    } else {
      unplacedActions.push(action);
      conflicts.push(`Could not place action: ${action.title || action.id}`);
    }
  }

  return { placedBlocks, unplacedActions, conflicts };
}

/**
 * Apply pacing policy to distribute actions over time
 */
function applyPacingPolicy(actions, pacingPolicy, dateConstraints) {
  if (pacingPolicy === 'STEADY' || !pacingPolicy) return actions;

  // Simplified: for now, just return actions as-is
  // Full implementation would redistribute action deadlines based on pacing
  return actions;
}

/**
 * Try to place an action in available slots
 */
function tryPlaceAction(action, availableSlots, sessionConstraints, earliestStartTime = 0, transitiveDependencyIds = []) {
  const requiredMinutes = action.estimatedMinutes || 60;

  for (const slot of availableSlots) {
    if (!slot.available) continue;
    const slotStartTime = toUtcTimestamp(slot.date, slot.startTime);
    if (slotStartTime < earliestStartTime) continue;

    if (slot.durationMinutes >= requiredMinutes) {
      slot.available = false;
      const endTime = calculateEndTime(slot.startTime, requiredMinutes);

      // Place the action in this slot
      return {
        blockId: randomUUID(),
        actionId: action.actionId || action.id,
        actionName: action.title || action.name || action.label || action.description || action.actionId,
        date: slot.date,
        preferredDate: slot.date,
        startTime: slot.startTime,
        endTime,
        durationMinutes: requiredMinutes,
        dependencyPosition: action.dependencyPosition || 0,
        directDependencyIds: Array.isArray(action.dependsOn) ? action.dependsOn.filter(Boolean) : [],
        transitiveDependencyIds,
        scheduledDate: `${slot.date}T${slot.startTime}:00.000Z`,
        completionDate: `${slot.date}T${endTime}:00.000Z`
      };
    }
  }

  return null;
}

/**
 * Calculate end time from start time and duration
 */
function calculateEndTime(startTime, minutes) {
  const [hours, mins] = startTime.split(':').map(Number);
  const totalMinutes = hours * 60 + mins + minutes;
  const endHours = Math.floor(totalMinutes / 60);
  const endMins = totalMinutes % 60;
  return `${endHours.toString().padStart(2, '0')}:${endMins.toString().padStart(2, '0')}`;
}

function toUtcTimestamp(date, time) {
  return new Date(`${date}T${time}:00.000Z`).getTime();
}

/**
 * Build scheduling policy from user inputs
 */
export function buildSchedulingPolicy(rawInputs, goalFamily, goalSubtype) {
  const {
    preferredWorkDays,
    preferredTimeOfDay,
    earliestStartTime,
    latestEndTime,
    minimumSessionLength,
    maximumSessionLength,
    bufferBetweenSessions = 0,
    hardBlockedDates = [],
    recurringBlockedWindows = [],
    deadlineFlexibility,
    frontLoadOrBackLoadPreference,
    dependencySequencingAwareness,
    familySchedulingInputs = {}
  } = rawInputs;

  // Build work windows
  const workWindows = buildWorkWindows(preferredWorkDays, preferredTimeOfDay, earliestStartTime, latestEndTime);

  // Build session constraints
  const sessionConstraints = {
    minimumMinutes: parseSessionLength(minimumSessionLength),
    maximumMinutes: parseSessionLength(maximumSessionLength),
    bufferMinutes: bufferBetweenSessions
  };

  // Build date constraints
  const dateConstraints = {
    startDate: rawInputs.startDate,
    deadline: rawInputs.deadline,
    deadlineType: deadlineFlexibility === 'hard' ? 'HARD' : 'TARGET',
    hardBlockedDates,
    recurringBlockedWindows
  };

  // Determine pacing policy
  const pacingPolicy = frontLoadOrBackLoadPreference === 'front-load' ? 'FRONT_LOADED' :
                      frontLoadOrBackLoadPreference === 'back-load' ? 'BACK_LOADED' : 'STEADY';

  return {
    workWindows,
    sessionConstraints,
    dateConstraints,
    pacingPolicy,
    dependencyOrder: 'ENFORCED', // Always enforced
    goalFamily,
    goalSubtype,
    familySchedulingPolicy: familySchedulingInputs
  };
}

/**
 * Build work windows from preferences
 */
function buildWorkWindows(preferredWorkDays, timeOfDay, earliestStart, latestEnd) {
  const windows = [];
  const days = preferredWorkDays || ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'];

  const timeDefaults = {
    morning: { start: '06:00', end: '12:00' },
    afternoon: { start: '12:00', end: '17:00' },
    evening: { start: '17:00', end: '21:00' },
    flexible: { start: earliestStart || '06:00', end: latestEnd || '21:00' }
  };

  const { start, end } = timeDefaults[timeOfDay] || timeDefaults.flexible;

  for (const day of days) {
    windows.push({
      dayOfWeek: day,
      startTime: start,
      endTime: end,
      availableMinutes: calculateMinutesBetween(start, end)
    });
  }

  return windows;
}

/**
 * Parse session length string to minutes
 */
function parseSessionLength(length) {
  if (typeof length === 'number') return length;
  if (typeof length === 'string') {
    if (length.includes('hour')) return parseFloat(length) * 60;
    if (length.includes('min')) return parseFloat(length);
  }
  return 60; // default
}

/**
 * Calculate minutes between two times
 */
function calculateMinutesBetween(startTime, endTime) {
  const [startH, startM] = startTime.split(':').map(Number);
  const [endH, endM] = endTime.split(':').map(Number);
  return (endH * 60 + endM) - (startH * 60 + startM);
}
