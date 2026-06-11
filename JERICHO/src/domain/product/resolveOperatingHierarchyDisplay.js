const PHASE_LABELS = {
  P1: 'P1 Launch / Proof',
  P2: 'P2 Conversion / Operating System',
  P3: 'P3 Scale / Terminal Readiness',
};

const MILESTONE_TYPE_LABELS = {
  macro: 'Macro Milestone',
  cross_lane: 'Macro Milestone',
  'cross-lane': 'Macro Milestone',
  lane: 'Lane Milestone',
  initiative: 'Initiative Milestone',
  sprint: 'Sprint Milestone',
  gate: 'Lane Milestone',
  anchor: 'Macro Milestone',
  checkpoint: 'Lane Milestone',
};

function normalizeText(value) {
  return String(value || '')
    .trim()
    .replace(/\s+/g, ' ');
}

function titleFromBlock(block) {
  return (
    normalizeText(block?.displayTitle) ||
    normalizeText(block?.title) ||
    normalizeText(block?.label) ||
    normalizeText(block?.name) ||
    normalizeText(block?.id) ||
    'Block'
  );
}

function phaseFromInput({ phase, block }) {
  const explicitPhase = normalizeText(phase?.label || phase?.name || phase?.title || phase);
  if (explicitPhase) {
    return explicitPhase;
  }

  const phaseLabel = normalizeText(block?.phaseLabel || block?.phase);
  const phaseName = normalizeText(block?.phaseName);
  const canonicalPhase = PHASE_LABELS[phaseLabel.toUpperCase()];
  if (canonicalPhase) {
    return canonicalPhase;
  }
  if (phaseLabel && phaseName) {
    return `${phaseLabel} ${phaseName}`;
  }
  return phaseLabel || phaseName || '';
}

function laneFromInput({ lane, block }) {
  return (
    normalizeText(lane?.label || lane?.title || lane?.name || lane) ||
    normalizeText(block?.laneLabel || block?.laneName || block?.lane)
  );
}

function initiativeFromInput({ initiative, block, laneLabel }) {
  return (
    normalizeText(initiative?.label || initiative?.title || initiative?.name || initiative) ||
    normalizeText(block?.initiativeLabel || block?.initiativeTitle || block?.initiativeName || block?.initiative) ||
    laneLabel
  );
}

function cycleFromInput({ operatingCycle, cycle }) {
  return normalizeText(
    operatingCycle?.label ||
      operatingCycle?.title ||
      operatingCycle?.name ||
      operatingCycle ||
      cycle?.label ||
      cycle?.title ||
      cycle?.name ||
      cycle
  );
}

function formatShortDate(dayKey) {
  const normalized = normalizeText(dayKey);
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(normalized);
  if (!match) {
    return normalized;
  }
  const [, , month, day] = match;
  const monthLabels = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const monthIndex = Number(month) - 1;
  const monthLabel = monthLabels[monthIndex] || month;
  return `${monthLabel} ${Number(day)}`;
}

function sprintFromInput({ sprint, block }) {
  const explicitLabel = normalizeText(sprint?.label || sprint?.title || sprint?.name || sprint);
  if (explicitLabel) {
    return explicitLabel;
  }

  const startDayKey = normalizeText(block?.sprintStartDayKey || block?.windowStartDayKey || block?.startDayKey);
  const endDayKey = normalizeText(block?.sprintEndDayKey || block?.windowEndDayKey || block?.endDayKey);
  if (startDayKey && endDayKey) {
    return `${formatShortDate(startDayKey)}–${formatShortDate(endDayKey)} Sprint`;
  }
  return '';
}

function milestoneTypeFromInput({ milestoneType, block, laneLabel }) {
  const explicitType = normalizeText(
    milestoneType || block?.milestoneType || block?.milestoneLabel || block?.milestoneKind
  ).toLowerCase();
  if (explicitType && MILESTONE_TYPE_LABELS[explicitType]) {
    return MILESTONE_TYPE_LABELS[explicitType];
  }

  const blockType = normalizeText(block?.blockType).toLowerCase();
  if (blockType !== 'milestone') {
    return '';
  }

  const laneText = laneLabel.toLowerCase();
  const titleText = titleFromBlock(block).toLowerCase();
  if (laneText.includes('cross-lane') || titleText.includes('public launch convergence')) {
    return 'Macro Milestone';
  }
  return 'Lane Milestone';
}

export function resolveOperatingHierarchyDisplay(input = {}) {
  const block = input?.block || {};
  const laneLabel = laneFromInput({ lane: input?.lane, block });

  return {
    masterPlan: normalizeText(input?.masterPlan || 'Operation Endgame'),
    activatedPlan: normalizeText(input?.activatedPlan || 'Activated Plan'),
    phase: phaseFromInput({ phase: input?.phase, block }),
    operatingCycle: cycleFromInput({ operatingCycle: input?.operatingCycle, cycle: input?.cycle }),
    sprint: sprintFromInput({ sprint: input?.sprint, block }),
    lane: laneLabel,
    initiative: initiativeFromInput({ initiative: input?.initiative, block, laneLabel }),
    block: titleFromBlock(block),
    milestoneType: milestoneTypeFromInput({ milestoneType: input?.milestoneType, block, laneLabel }),
  };
}

export default resolveOperatingHierarchyDisplay;
