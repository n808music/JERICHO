/**
 * Schedule Commit / Persistence Module
 *
 * Module 8 in the agent integration order.
 * Commits proposed schedule blocks to persistent storage.
 */

import { readState, writeState } from '../data/storage.js';

/**
 * Commit proposed schedule blocks
 * @param {Array} proposedBlocks - blocks with status 'suggested'
 * @param {Object} goal - the goal object
 * @param {Object} identity - current identity state
 * @returns {Promise<Object>} commit result
 */
export async function commitScheduleBlocks(proposedBlocks, goal, identity) {
  // Validate that all blocks are suggested
  const invalidBlocks = proposedBlocks.filter(block => block.status !== 'suggested');
  if (invalidBlocks.length > 0) {
    return {
      success: false,
      error: 'Cannot commit blocks that are not in suggested status',
      committedBlocks: [],
      errorCode: 'INVALID_BLOCK_STATUS'
    };
  }

  // Change status to committed
  const committedBlocks = proposedBlocks.map(block => ({
    ...block,
    status: 'committed',
    committedAt: new Date().toISOString()
  }));

  // Persist to state
  try {
    const currentState = await readState();
    const goalId = goal?.goalId || proposedBlocks[0]?.goalId || 'goal';
    const updatedState = {
      ...currentState,
      schedule: {
        ...currentState.schedule,
        committedBlocks: [
          ...(currentState.schedule?.committedBlocks || []),
          ...committedBlocks
        ]
      }
    };

    await writeState(updatedState);

    return {
      success: true,
      committedBlocks,
      totalCommitted: committedBlocks.length,
      scheduleId: `schedule-${goalId}-${Date.now()}`,
      errorCode: null
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
      committedBlocks: [],
      errorCode: 'PERSISTENCE_ERROR'
    };
  }
}

/**
 * Validate schedule proposal before commit
 * @param {Object} proposal - schedule proposal
 * @returns {Object} validation result
 */
export function validateScheduleProposal(proposal) {
  const { proposedBlocks, schedulingStatus } = proposal;

  if (schedulingStatus === 'FAILED') {
    return {
      valid: false,
      reason: 'Schedule generation failed',
      canCommit: false
    };
  }

  if (!proposedBlocks || proposedBlocks.length === 0) {
    return {
      valid: false,
      reason: 'No blocks to commit',
      canCommit: false
    };
  }

  // Check for conflicts or overlaps (simplified)
  const hasConflicts = checkForConflicts(proposedBlocks);
  if (hasConflicts) {
    return {
      valid: false,
      reason: 'Schedule has conflicts',
      canCommit: false
    };
  }

  return {
    valid: true,
    reason: 'Schedule is valid for commit',
    canCommit: true
  };
}

/**
 * Check for scheduling conflicts
 */
function checkForConflicts(blocks) {
  // Simplified conflict detection
  // Group by date and check for overlapping times
  const byDate = blocks.reduce((acc, block) => {
    if (!acc[block.date]) acc[block.date] = [];
    acc[block.date].push(block);
    return acc;
  }, {});

  for (const dateBlocks of Object.values(byDate)) {
    // Sort by start time
    dateBlocks.sort((a, b) => a.startTime.localeCompare(b.startTime));

    for (let i = 1; i < dateBlocks.length; i++) {
      const prev = dateBlocks[i - 1];
      const curr = dateBlocks[i];

      if (curr.startTime < prev.endTime) {
        return true; // Overlap
      }
    }
  }

  return false;
}
