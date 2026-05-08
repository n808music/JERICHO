import { readFile } from 'fs/promises';

const inputPath = process.argv[2] || 'src/data/state.json';

const raw = await readFile(inputPath, 'utf-8');
const parsed = JSON.parse(raw);
const blocks = extractBlocks(parsed);

if (blocks.length === 0) {
  console.error(`INVALID - no persisted schedule blocks found in ${inputPath}`);
  console.error('Regenerate and commit a schedule through the enforced pipeline before running integrity verification.');
  process.exit(1);
}

const unstampedBlocks = blocks.filter(
  (block) => block.transitiveDependencyIds == null || block.transitiveDependencyDetails == null
);
if (unstampedBlocks.length > 0) {
  console.error(
    `INVALID - ${unstampedBlocks.length} blocks have no dependency enforcement stamp in ${inputPath}`
  );
  console.error('These blocks bypassed dependency enforcement. Regenerate the schedule.');
  for (const block of unstampedBlocks.slice(0, 5)) {
    console.error(
      `  ${block.blockId || block.id || block.actionId || 'unknown'} (${resolveScheduledDate(block) || 'no-date'}) - ${block.actionName || block.title || 'Untitled block'}`
    );
  }
  process.exit(1);
}

const blockByActionId = new Map(
  blocks
    .filter((block) => block?.actionId || block?.id)
    .map((block) => [block.actionId || block.id, block])
);

const violations = [];

for (const block of blocks) {
  const scheduledDate = resolveScheduledDate(block);
  const hardGateDependencyIds = normalizeDependencyDetails(
    block.transitiveDependencyDetails,
    block.transitiveDependencyIds
  )
    .filter((detail) => detail.dependencyType === 'hard_gate')
    .map((detail) => detail.actionId);
  for (const dependencyId of hardGateDependencyIds) {
    const dependencyBlock = blockByActionId.get(dependencyId);
    if (!dependencyBlock) {
      continue;
    }

    const dependencyCompletionDate = resolveCompletionDate(dependencyBlock);

    if (scheduledDate && dependencyCompletionDate && scheduledDate < dependencyCompletionDate) {
      violations.push({
        blockId: block.blockId || block.id || null,
        actionId: block.actionId || block.id || null,
        scheduledDate,
        dependencyId,
        dependencyBlockId: dependencyBlock.blockId || dependencyBlock.id || null,
        dependencyCompletionDate
      });
    }
  }
}

if (violations.length === 0) {
  console.log(`PASS - zero temporal violations in ${inputPath}`);
  process.exit(0);
}

console.error(`FAIL - ${violations.length} temporal violations in ${inputPath}`);
for (const violation of violations) {
  console.error(
    `  ${violation.blockId || violation.actionId} (${violation.scheduledDate}) before ${violation.dependencyBlockId || violation.dependencyId} (${violation.dependencyCompletionDate})`
  );
}
process.exit(1);

function toTimestampString(date, time) {
  if (!date || !time) {
    return null;
  }
  return `${date}T${time}:00.000Z`;
}

function resolveScheduledDate(block) {
  return block?.scheduledDate || block?.startISO || block?.start || toTimestampString(block?.date, block?.startTime);
}

function resolveCompletionDate(block) {
  return (
    block?.completionDate ||
    block?.endISO ||
    block?.end ||
    inferEndISO(block) ||
    toTimestampString(block?.date, block?.endTime)
  );
}

function inferEndISO(block) {
  const start = resolveScheduledDate(block);
  const minutes = Number(block?.durationMinutes || block?.minutes || 0);
  if (!start || !Number.isFinite(Date.parse(start)) || !Number.isFinite(minutes) || minutes <= 0) {
    return null;
  }
  return new Date(Date.parse(start) + minutes * 60 * 1000).toISOString();
}

function normalizeDependencyType(value) {
  const normalized = String(value || '')
    .trim()
    .toLowerCase();
  if (normalized === 'hard_gate' || normalized === 'hard-gate' || normalized === 'hard') {
    return 'hard_gate';
  }
  if (normalized === 'directional' || normalized === 'soft') {
    return 'directional';
  }
  if (normalized === 'informational' || normalized === 'info') {
    return 'informational';
  }
  return null;
}

function normalizeDependencyDetails(rawDetails, dependencyIds = []) {
  const byId = new Map();
  (Array.isArray(rawDetails) ? rawDetails : []).forEach((detail) => {
    const actionId = String(detail?.actionId || detail?.dependencyId || detail?.id || '').trim();
    if (!actionId) {
      return;
    }
    byId.set(actionId, {
      actionId,
      dependencyType: normalizeDependencyType(detail?.dependencyType) || 'hard_gate',
    });
  });
  (Array.isArray(dependencyIds) ? dependencyIds : []).forEach((dependencyId) => {
    const actionId = String(dependencyId || '').trim();
    if (!actionId || byId.has(actionId)) {
      return;
    }
    byId.set(actionId, { actionId, dependencyType: 'hard_gate' });
  });
  return Array.from(byId.values());
}

function extractBlocks(parsed) {
  const rootScheduleBlocks = Array.isArray(parsed?.schedule?.committedBlocks) ? parsed.schedule.committedBlocks : [];
  const rootBlocks = Array.isArray(parsed?.blocks) ? parsed.blocks : [];
  const proposedBlocks = Array.isArray(parsed?.proposedBlocks) ? parsed.proposedBlocks : [];
  const suggestedBlocks = Array.isArray(parsed?.suggestedBlocks) ? parsed.suggestedBlocks : [];
  const cycleBlocks = Object.values(parsed?.cyclesById || {}).flatMap((cycle) => {
    const reviewBlocks = Array.isArray(cycle?.scheduleReviewBlocks) ? cycle.scheduleReviewBlocks : [];
    const horizonBlocks = Array.isArray(cycle?.autoAsanaPlan?.horizonBlocks) ? cycle.autoAsanaPlan.horizonBlocks : [];
    return [...reviewBlocks, ...horizonBlocks];
  });

  return [...rootScheduleBlocks, ...rootBlocks, ...proposedBlocks, ...suggestedBlocks, ...cycleBlocks];
}
