export class SchedulerConstraintError extends Error {
  constructor(violations = []) {
    const firstViolation = violations[0];
    const message = firstViolation
      ? `Dependency constraint violated for block ${firstViolation.blockId} on ${firstViolation.scheduledDate}`
      : 'Dependency constraint violated';
    super(message);
    this.name = 'SchedulerConstraintError';
    this.code = 'DEPENDENCY_ORDER_VIOLATED';
    this.violations = violations;
  }
}

export function resolveTransitiveDependencyIds(actionId, actionById, memo = new Map(), stack = new Set()) {
  if (!actionId || !actionById?.has(actionId)) {
    return [];
  }

  if (memo.has(actionId)) {
    return memo.get(actionId);
  }

  if (stack.has(actionId)) {
    return [];
  }

  stack.add(actionId);

  const action = actionById.get(actionId);
  const directDependencyIds = Array.isArray(action?.dependsOn) ? action.dependsOn.filter(Boolean) : [];
  const collectedIds = [];
  const seenIds = new Set();

  for (const dependencyId of directDependencyIds) {
    if (!seenIds.has(dependencyId)) {
      seenIds.add(dependencyId);
      collectedIds.push(dependencyId);
    }

    const transitiveIds = resolveTransitiveDependencyIds(dependencyId, actionById, memo, stack);
    for (const transitiveId of transitiveIds) {
      if (!seenIds.has(transitiveId)) {
        seenIds.add(transitiveId);
        collectedIds.push(transitiveId);
      }
    }
  }

  stack.delete(actionId);
  memo.set(actionId, collectedIds);
  return collectedIds;
}

export function buildDependencyAwareBlocks(proposedBlocks = [], actionGraph = []) {
  const actionById = new Map((actionGraph || []).map((action) => [action.actionId || action.id, action]));
  const memo = new Map();

  return (proposedBlocks || []).map((block) => {
    const actionId = block.actionId || block.id;
    const action = actionById.get(actionId);
    const directDependencyIds = Array.isArray(block.directDependencyIds)
      ? [...block.directDependencyIds]
      : Array.isArray(action?.dependsOn)
        ? action.dependsOn.filter(Boolean)
        : [];
    const transitiveDependencyIds = Array.isArray(block.transitiveDependencyIds)
      ? [...block.transitiveDependencyIds]
      : resolveTransitiveDependencyIds(actionId, actionById, memo);
    const scheduledDate = block.scheduledDate || toScheduledDate(block.date, block.startTime);
    const completionDate = block.completionDate || toScheduledDate(block.date, block.endTime);

    return {
      ...block,
      directDependencyIds,
      transitiveDependencyIds,
      preferredDate: block.preferredDate || block.date || null,
      scheduledDate,
      completionDate
    };
  });
}

export function validateMaterializedBlockDependencies(blocks = []) {
  const blockByActionId = new Map(
    (blocks || [])
      .filter((block) => block?.actionId || block?.id)
      .map((block) => [block.actionId || block.id, block])
  );

  const violations = [];

  for (const block of blocks || []) {
    const scheduledDate = block.scheduledDate || toScheduledDate(block.date, block.startTime);
    const dependencyIds = getTransitiveDependencyIdsForBlock(block, blockByActionId);

    for (const dependencyId of dependencyIds) {
      const dependencyBlock = blockByActionId.get(dependencyId);
      if (!dependencyBlock) {
        continue;
      }

      const dependencyCompletionDate =
        dependencyBlock.completionDate || toScheduledDate(dependencyBlock.date, dependencyBlock.endTime);

      if (!scheduledDate || !dependencyCompletionDate) {
        continue;
      }

      if (new Date(scheduledDate).getTime() < new Date(dependencyCompletionDate).getTime()) {
        violations.push({
          blockId: block.blockId || block.id || null,
          actionId: block.actionId || block.id || null,
          scheduledDate,
          dependencyActionId: dependencyId,
          dependencyBlockId: dependencyBlock.blockId || dependencyBlock.id || null,
          dependencyCompletionDate
        });
      }
    }
  }

  return violations;
}

export function assertMaterializedBlockDependencies(blocks = []) {
  const violations = validateMaterializedBlockDependencies(blocks);
  if (violations.length > 0) {
    throw new SchedulerConstraintError(violations);
  }
  return blocks;
}

function getTransitiveDependencyIdsForBlock(block, blockByActionId, memo = new Map(), stack = new Set()) {
  if (Array.isArray(block?.transitiveDependencyIds) && block.transitiveDependencyIds.length > 0) {
    return [...block.transitiveDependencyIds];
  }

  const actionId = block?.actionId || block?.id;
  if (!actionId) {
    return [];
  }

  if (memo.has(actionId)) {
    return memo.get(actionId);
  }

  if (stack.has(actionId)) {
    return [];
  }

  stack.add(actionId);

  const directDependencyIds = Array.isArray(block?.directDependencyIds) ? block.directDependencyIds.filter(Boolean) : [];
  const collectedIds = [];
  const seenIds = new Set();

  for (const dependencyId of directDependencyIds) {
    if (!seenIds.has(dependencyId)) {
      seenIds.add(dependencyId);
      collectedIds.push(dependencyId);
    }

    const dependencyBlock = blockByActionId.get(dependencyId);
    const transitiveIds = dependencyBlock
      ? getTransitiveDependencyIdsForBlock(dependencyBlock, blockByActionId, memo, stack)
      : [];

    for (const transitiveId of transitiveIds) {
      if (!seenIds.has(transitiveId)) {
        seenIds.add(transitiveId);
        collectedIds.push(transitiveId);
      }
    }
  }

  stack.delete(actionId);
  memo.set(actionId, collectedIds);
  return collectedIds;
}

function toScheduledDate(date, time) {
  if (!date || !time) {
    return null;
  }
  return `${date}T${time}:00.000Z`;
}
