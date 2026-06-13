const COMPLETE_STATUSES = new Set(['completed', 'complete']);

function normalizeText(value) {
  return String(value || '')
    .trim()
    .replace(/\s+/g, ' ');
}

function isGeneratedScheduleBlock(block) {
  const origin = normalizeText(block?.origin).toLowerCase();
  return Boolean(block?.requiredSystemBlock) || origin === 'schedule_active' || origin === 'schedule_review';
}

function blockTitle(block) {
  return normalizeText(block?.displayTitle || block?.title || block?.label || block?.id || 'Block');
}

function isComplete(block) {
  return COMPLETE_STATUSES.has(normalizeText(block?.status).toLowerCase());
}

function compareBlocks(left, right) {
  const leftStart = normalizeText(left?.start);
  const rightStart = normalizeText(right?.start);
  if (leftStart !== rightStart) {
    return leftStart.localeCompare(rightStart);
  }
  const leftEnd = normalizeText(left?.end);
  const rightEnd = normalizeText(right?.end);
  if (leftEnd !== rightEnd) {
    return leftEnd.localeCompare(rightEnd);
  }
  const leftLabel = normalizeText(left?.displayTitle || left?.title || left?.label);
  const rightLabel = normalizeText(right?.displayTitle || right?.title || right?.label);
  if (leftLabel !== rightLabel) {
    return leftLabel.localeCompare(rightLabel);
  }
  return normalizeText(left?.id).localeCompare(normalizeText(right?.id));
}

function resolveLabelById(id, labelById = {}) {
  const key = normalizeText(id);
  if (!key) {
    return '';
  }
  return normalizeText(labelById[key]) || key;
}

function getDependencyRefs(block, allBlocks = []) {
  const ids = Array.isArray(block?.dependencyIds)
    ? block.dependencyIds
    : Array.isArray(block?.dependsOn)
      ? block.dependsOn
      : [];
  if (!ids.length) {
    return [];
  }
  const blockById = new Map(
    (Array.isArray(allBlocks) ? allBlocks : [])
      .filter(Boolean)
      .map((candidate) => [normalizeText(candidate?.id), candidate])
      .filter(([id]) => Boolean(id))
  );
  return ids
    .map((id) => {
      const resolvedId = normalizeText(id);
      if (resolvedId.startsWith('phase:')) {
        return {
          id: resolvedId,
          title: resolvedId,
          label: `Locked phase prerequisite ${resolvedId.slice(6).toUpperCase()}`,
          displayTitle: `Locked phase prerequisite ${resolvedId.slice(6).toUpperCase()}`,
          semanticDependency: 'phase',
          unresolved: false,
        };
      }
      const ref = blockById.get(resolvedId) || null;
      return ref
        ? ref
        : {
            id: resolvedId,
            title: resolvedId,
            label: resolvedId,
            displayTitle: resolvedId,
            unresolved: true,
          };
    })
    .filter(Boolean);
}

function getOpenPredecessor(block, allBlocks = []) {
  const ordered = [...(Array.isArray(allBlocks) ? allBlocks : [])]
    .filter((candidate) => candidate && normalizeText(candidate?.id))
    .sort(compareBlocks);
  const index = ordered.findIndex((candidate) => normalizeText(candidate?.id) === normalizeText(block?.id));
  if (index <= 0) {
    return null;
  }
  for (let i = index - 1; i >= 0; i -= 1) {
    const candidate = ordered[i];
    if (candidate && !isComplete(candidate)) {
      return candidate;
    }
  }
  return null;
}

export function describeBlockMeaning(
  block,
  allBlocks = [],
  { deliverableLabelById = {}, criterionLabelById = {} } = {}
) {
  const deliverableLabel = resolveLabelById(block?.deliverableId, deliverableLabelById);
  const criterionLabel = resolveLabelById(block?.criterionId, criterionLabelById);
  const lines = [];

  if (deliverableLabel) {
    lines.push(`Serves: ${deliverableLabel}`);
  }
  if (criterionLabel) {
    lines.push(`Why: ${criterionLabel}`);
  }
  if (!deliverableLabel && !criterionLabel) {
    lines.push(isGeneratedScheduleBlock(block) ? 'Canonical scheduled block' : 'Manual block');
  }

  const dependencyRefs = getDependencyRefs(block, allBlocks);
  const phaseDependencyRefs = dependencyRefs.filter((ref) => ref?.semanticDependency === 'phase');
  const unresolvedDependencyRefs = dependencyRefs.filter((ref) => ref?.unresolved);
  const openDependencyRefs = dependencyRefs.filter(
    (ref) => ref && !ref.unresolved && !ref.semanticDependency && !isComplete(ref)
  );

  if (phaseDependencyRefs.length > 0) {
    lines.push(
      `Locked by phase prerequisite: ${phaseDependencyRefs
        .slice(0, 2)
        .map((ref) => String(ref.id || '').slice(6).toUpperCase())
        .join(', ')}`
    );
  }
  if (openDependencyRefs.length > 0) {
    lines.push(
      `Waiting on: ${openDependencyRefs
        .slice(0, 2)
        .map((ref) => blockTitle(ref))
        .join(', ')}`
    );
  } else if (dependencyRefs.length > 0 && phaseDependencyRefs.length === 0) {
    if (unresolvedDependencyRefs.length > 0) {
      lines.push(
        `Dependency missing: ${unresolvedDependencyRefs
          .slice(0, 2)
          .map((ref) => ref.id)
          .join(', ')}`
      );
    } else {
      lines.push('Dependencies satisfied');
    }
  } else {
    const predecessor = getOpenPredecessor(block, allBlocks);
    if (predecessor) {
      lines.push(`Earlier open: ${blockTitle(predecessor)}`);
    }
  }

  return {
    lines,
    deliverableLabel,
    criterionLabel,
    summaryText: lines.join(' · '),
    hasOpenPredecessor: Boolean(getOpenPredecessor(block, allBlocks)),
  };
}
