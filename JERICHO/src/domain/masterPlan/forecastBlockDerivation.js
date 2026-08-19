/**
 * forecastBlockDerivation.js
 *
 * Deterministically derives dated future forecast/gated/locked planning blocks
 * from the canonical master-plan substrate (phase model + lanes + plan metadata).
 *
 * These blocks are NOT execution events. They are visible planning artifacts that
 * represent the execution burden the user must inspect before committing to a
 * multi-year plan. They carry executionEligibility: 'locked' and cannot be
 * completed/missed/skipped until committed into an active cycle.
 *
 * Density doctrine:
 *   P2 (Conversion / Operating System): biweekly → monthly cadence blocks
 *   P3 (Scale / Terminal Readiness): monthly → quarterly strategic review blocks
 *
 * Action-title rule: every block title must be a specific object + action phrase
 * (e.g. "Validate post-launch conversion path for product lane", not "Review").
 */

import { defaultOwnerForLaneFamily } from './ownerLabels.js';

// ─── Title templates ──────────────────────────────────────────────────────────

const LANE_FAMILY_LABELS = {
  product_software: 'product/software lane',
  creative_media: 'media/creative lane',
  media_channel: 'media channel lane',
  company_operations: 'company operations lane',
  income_stream: 'income stream lane',
  capital_real_estate: 'capital/real-estate lane',
  institution_education: 'institution/education lane',
  civic_development: 'civic development lane',
  general: 'primary lane',
};

function hasWord(text, pattern) {
  return new RegExp(`\\b${pattern}\\b`, 'i').test(String(text || ''));
}

function inferLaneFamily(lane) {
  const domain = String(lane?.domain || '').trim().toLowerCase();
  const title = String(lane?.title || '').trim().toLowerCase();
  if (domain === 'product' || hasWord(title, 'app') || title.includes('software')) return 'product_software';
  if (domain === 'creative' || title.includes('album') || title.includes('release') || title.includes('music')) return 'creative_media';
  if (domain === 'media' || title.includes('podcast') || title.includes('content')) return 'media_channel';
  if (domain === 'brand' || title.includes('company') || title.includes('agency') || title.includes('studio')) return 'company_operations';
  if (domain === 'income' || title.includes('income') || title.includes('revenue')) return 'income_stream';
  if (domain === 'capital' || domain === 'real_estate' || title.includes('real estate') || title.includes('property')) return 'capital_real_estate';
  if (domain === 'institution' || domain === 'education' || title.includes('school') || title.includes('franchise')) return 'institution_education';
  if (domain === 'civic' || domain === 'district' || title.includes('district') || title.includes('community')) return 'civic_development';
  return domain || 'general';
}

function laneLabel(lane) {
  if (!lane) return 'primary lane';
  const family = inferLaneFamily(lane);
  return LANE_FAMILY_LABELS[family] || 'primary lane';
}

function p2TitleTemplates(lane) {
  const ll = laneLabel(lane);
  return [
    `Validate post-launch conversion path for ${ll}`,
    `Review operating cadence quality and schedule consistency for ${ll}`,
    `Compare revenue architecture options against first proof data for ${ll}`,
    `Audit conversion repeatability and operating rhythm for ${ll}`,
    `Assess P2 expansion readiness for ${ll} before widening commitment`,
    `Define stable operating cadence and review schedule for ${ll}`,
    `Gate ${ll} expansion until conversion evidence supports increased commitment`,
    `Review lane-priority evidence and dependency clearance for ${ll}`,
  ];
}

function p3TitleTemplates(lane) {
  const ll = laneLabel(lane);
  return [
    `Review scale-readiness evidence packet against validated P2 proof for ${ll}`,
    `Audit validated pathway and operating-system health evidence for ${ll}`,
    `Assess capital and partnership gate-clearance packet for ${ll}`,
    `Compare trajectory evidence packet against outcome target for ${ll}`,
    `Review institutionalization and delegation readiness packet for ${ll}`,
  ];
}

const TERMINAL_READINESS_TITLE =
  'Assess terminal-readiness evidence for the cross-lane Operation Endgame review against the success standard and outcome target';

function buildForecastExpectedOutput({ blockType, lane, phase, title }) {
  const laneContext = lane ? laneLabel({ domain: lane.domain, title: lane.laneTitle }) : 'cross-lane terminal review';
  const phaseLabel = String(phase?.label || '').trim() || 'phase';
  const normalizedTitle = String(title || '').trim();

  if (blockType === 'gate') {
    return `Gate decision for ${laneContext} recorded with pass/fail criteria, blocked dependencies, and next unlock timing.`;
  }
  if (blockType === 'terminal-readiness') {
    return `Terminal-readiness evidence package for ${laneContext} updated with success-standard alignment, outcome evidence, unresolved gaps, final horizon decision, and next proof owner.`;
  }
  if (blockType === 'readiness') {
    return `Readiness decision for ${laneContext} documented with owner, threshold, and next evidence requirement for ${phaseLabel}.`;
  }
  if (blockType === 'audit') {
    return `Audit findings for ${laneContext} captured with weak points, corrective actions, and follow-up review timing.`;
  }
  if (blockType === 'validation') {
    return `Validation result for ${laneContext} captured with evidence reviewed, disposition, and required next action.`;
  }
  if (blockType === 'action') {
    return `Updated action package for ${laneContext} with owner, cadence, and deliverable needed before the next review.`;
  }
  if (blockType === 'review') {
    return `Review decision for ${laneContext} documented with evidence summary, hold/advance choice, and next proof target.`;
  }
  return `Specific ${phaseLabel} output for ${laneContext} documented from: ${normalizedTitle}.`;
}

function p1PostCycleTitleTemplates(lane) {
  const ll = laneLabel(lane);
  return [
    `Audit post-anchor conversion evidence packet for ${ll}`,
    `Validate first-proof cadence and operating-rhythm evidence for ${ll}`,
    `Compare post-launch evidence packet against P1 unlock criteria for ${ll}`,
    `Prepare next-cycle commitment scope packet from current execution evidence for ${ll}`,
    `Assess milestone progress packet and schedule-consistency risks for ${ll} before P2 transition`,
    `Reassess P1-to-P2 expansion readiness packet for ${ll}`,
    `Review execution evidence-density packet before unlocking next-phase commitment for ${ll}`,
  ];
}

// ─── Date utilities ───────────────────────────────────────────────────────────

function addDaysToKey(dayKey, days) {
  const d = new Date(`${dayKey}T12:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function addMonthsToKey(dayKey, months) {
  const d = new Date(`${dayKey}T12:00:00.000Z`);
  d.setUTCMonth(d.getUTCMonth() + months);
  return d.toISOString().slice(0, 10);
}

function daysBetween(startKey, endKey) {
  const ms = new Date(`${endKey}T12:00:00.000Z`) - new Date(`${startKey}T12:00:00.000Z`);
  return Math.max(0, Math.round(ms / 86400000));
}

function clampKey(key, maxKey) {
  if (!key || !maxKey) return key || maxKey;
  return key < maxKey ? key : maxKey;
}

function nextFirstOfMonth(dayKey) {
  const d = new Date(`${dayKey}T12:00:00.000Z`);
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + 1);
  return d.toISOString().slice(0, 10);
}

function formatMonthYear(dayKey) {
  const date = new Date(`${dayKey}T12:00:00.000Z`);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

function formatQuarterYear(dayKey) {
  const date = new Date(`${dayKey}T12:00:00.000Z`);
  return `Q${Math.floor(date.getUTCMonth() / 3) + 1} ${date.getUTCFullYear()}`;
}

function buildForecastOccurrenceLabel(phaseLabel, dayKey) {
  if (phaseLabel === 'P3') {
    return `${formatQuarterYear(dayKey)} scale review window`;
  }
  return `${formatMonthYear(dayKey)} review window`;
}

// ─── ID generator ─────────────────────────────────────────────────────────────

function forecastBlockId(planId, phaseLabel, dayKey, index) {
  return `forecast-${planId}-${phaseLabel.toLowerCase()}-${dayKey}-${index}`;
}

// ─── Block factory ────────────────────────────────────────────────────────────

function resolveForecastBlockOwner(blockType, laneFamily = null) {
  if (blockType === 'waiting_period') return 'TBD — must be resolved before activation';
  return defaultOwnerForLaneFamily(laneFamily);
}

function resolveForecastPassEvidence(blockType) {
  switch (blockType) {
    case 'action': return 'Completed action artifact matching the forecast expected output';
    case 'review': return 'Written review with pass/fail determination and evidence summary';
    case 'audit': return 'Audit report with findings, gaps, and status determination';
    case 'validation': return 'Validation result with evidence collected and criteria checked';
    case 'readiness': return 'Readiness checklist with binary go/no-go decision';
    case 'gate': return 'Gate decision with explicit pass/fail criteria and unblocking conditions';
    case 'terminal-readiness': return 'Terminal-readiness evidence package with final horizon decision';
    case 'terminal-review': return 'Terminal review conclusion with outcome verdict';
    default: return 'Forecast work product matching expected output';
  }
}

// Phase 4 — mirrors resolveGateCriteria in fullHorizonScheduleExpansion.js so
// forecast-emitted gates carry the same six substrate fields as
// expansion-engine gates.
// RTG Finding 2: see resolveGateCriteria in fullHorizonScheduleExpansion.js —
// descriptor evidence goes in a parenthetical reference so the criteria read
// as plain English regardless of expectedOutput phrasing.
function resolveForecastGateCriteria({ phase, lane, expectedOutput, title }) {
  const phaseLabel = phase?.label || null;
  const laneId = lane?.laneId || lane?.id || 'cross-lane';
  const laneTitleResolved = lane ? laneLabel({ domain: lane.domain, title: lane.laneTitle }) : 'cross-lane';
  const nextPhase = phaseLabel === 'P1' ? 'P2' : phaseLabel === 'P2' ? 'P3' : 'terminal-review';
  const nextLabel = nextPhase === 'terminal-review' ? 'terminal review' : nextPhase;
  const gateName = `${phaseLabel || 'phase'}→${nextPhase} gate: ${laneTitleResolved}`;
  const evidence = expectedOutput || title || `${laneTitleResolved} proof packet`;
  const evidenceRef = String(evidence).toLowerCase().replace(/\.\s*$/, '');
  return {
    gateName,
    passCriteria: `Upstream proof threshold for ${laneTitleResolved} is met — advance to ${nextLabel}. Required evidence: ${evidenceRef}.`,
    failCriteria: `Upstream proof threshold for ${laneTitleResolved} is not met — hold and remediate the gap before reattempting. Missing or weak evidence: ${evidenceRef}.`,
    evidenceRequired: evidence,
    decisionAuthority: 'Operator',
    passBranch: nextPhase === 'terminal-review'
      ? `advance:terminal-review:${laneId}`
      : `advance:phase:${nextPhase}:${laneId}`,
    failBranch: `hold:${phaseLabel || 'phase'}:${laneId}:remediate-upstream`,
  };
}

function buildForecastBlock({
  planId,
  phase,
  lane,
  dayKey,
  title,
  commitmentState,
  index,
  blockType = 'review',
  laneIdOverride = null,
  laneLabelOverride = null,
  titleFamily = null,
}) {
  const laneId = laneIdOverride || lane?.laneId || null;
  const resolvedLaneLabel =
    laneLabelOverride || (lane ? laneLabel({ domain: lane.domain, title: lane.laneTitle }) : null);
  const phaseName = String(phase?.phaseTitle || phase?.title || phase?.label || '').trim() || null;
  const laneFamily = lane ? inferLaneFamily(lane) : null;
  const owner = resolveForecastBlockOwner(blockType, laneFamily);
  const durationMinutes = blockType === 'terminal-readiness' ? 90 : 60;
  const dependsOn = phase?.label === 'P2' ? ['phase:P1'] : phase?.label === 'P3' ? ['phase:P2'] : [];
  const unlocks =
    phase?.label === 'P1'
      ? ['phase:P2']
      : phase?.label === 'P2'
        ? ['phase:P3']
        : ['terminal-review'];
  const primaryUnlock = unlocks[0] || null;
  const consumedByRef = primaryUnlock
    ? primaryUnlock.startsWith('phase:')
      ? { type: 'phaseObjective', id: primaryUnlock.slice(6) }
      : primaryUnlock.startsWith('terminal-review')
        ? { type: 'terminalOutcome', id: primaryUnlock.includes(':') ? primaryUnlock.split(':')[1] : 'cross-lane' }
        : { type: 'block', id: primaryUnlock }
    : null;
  const expectedOutput = buildForecastExpectedOutput({ blockType, lane, phase, title });
  const occurrenceLabel = buildForecastOccurrenceLabel(phase?.label, dayKey);
  const gateCriteria = blockType === 'gate' ? resolveForecastGateCriteria({ phase, lane, expectedOutput, title }) : null;
  return {
    id: forecastBlockId(planId, phase.label, dayKey, index),
    title: `${title} for the ${occurrenceLabel}`,
    dayKey,
    date: dayKey,
    phaseId: phase.id,
    phaseLabel: phase.label,
    phaseName,
    laneId,
    laneLabel: resolvedLaneLabel,
    blockType,
    titleFamily,
    commitmentState: commitmentState || phase.commitmentState || 'forecast',
    executionEligibility: 'locked',
    executionLockReason:
      'Forecast block visible for long-horizon inspection. Not executable until committed into an active cycle.',
    source: 'derived',
    derivationReason: `Derived from ${phase.label} phase substrate for ${resolvedLaneLabel || 'cross-lane terminal review'} during the ${occurrenceLabel}: ${phase.phaseObjective || 'phase objective'}`,
    expectedOutput: `${expectedOutput} Occurrence focus: ${occurrenceLabel}.`,
    durationMinutes,
    // timeEstimateMinutes retained as legacy alias — existing readers reference it.
    timeEstimateMinutes: durationMinutes,
    owner,
    producesArtifact: expectedOutput,
    consumedBy: unlocks,
    consumedByRef,
    passEvidence: resolveForecastPassEvidence(blockType),
    gateName: gateCriteria ? gateCriteria.gateName : null,
    passCriteria: gateCriteria ? gateCriteria.passCriteria : null,
    failCriteria: gateCriteria ? gateCriteria.failCriteria : null,
    evidenceRequired: gateCriteria ? gateCriteria.evidenceRequired : null,
    decisionAuthority: gateCriteria ? gateCriteria.decisionAuthority : null,
    passBranch: gateCriteria ? gateCriteria.passBranch : null,
    failBranch: gateCriteria ? gateCriteria.failBranch : null,
    sourceInputs: [
      `plan:${planId}`,
      phase?.id ? `phase:${phase.id}` : null,
      laneId ? `lane:${laneId}` : null,
    ].filter(Boolean),
    dependsOn,
    unlocks,
    riskOrConstraintAddressed: `Keeps ${phase.label} future work visible without allowing execution mutation before commitment.`,
    successCriterionServed:
      phase?.label === 'P1'
        ? 'Launch proof and next-phase readiness'
        : phase?.label === 'P2'
          ? 'Conversion and operating-system proof'
          : 'Scale and terminal-readiness evidence',
  };
}

// ─── P2 derivation ────────────────────────────────────────────────────────────

function deriveP2Blocks({ planId, phase, lane, horizonEndDayKey }) {
  const { startBoundary, endBoundary } = phase;
  if (!startBoundary || !endBoundary) return [];

  const phaseEnd = clampKey(endBoundary, horizonEndDayKey);
  const totalDays = daysBetween(startBoundary, phaseEnd);
  if (totalDays < 14) return [];

  const templates = p2TitleTemplates(lane ? { domain: lane.domain, title: lane.laneTitle } : null);
  const blocks = [];

  // Entry block: first month start after phase start
  const entryKey = clampKey(nextFirstOfMonth(startBoundary), phaseEnd);
  if (entryKey <= phaseEnd) {
    blocks.push(buildForecastBlock({
      planId, phase, lane, dayKey: entryKey,
      title: templates[0 % templates.length],
      commitmentState: phase.commitmentState,
      index: blocks.length,
      blockType: 'readiness',
    }));
  }

  // Biweekly/monthly blocks through the phase — cap density based on duration
  const intervalDays = totalDays > 365 ? 28 : 14; // monthly for long P2, biweekly for short
  const maxBlocks = Math.min(Math.floor(totalDays / intervalDays), 8);

  let cursor = entryKey ? addDaysToKey(entryKey, intervalDays) : addDaysToKey(startBoundary, intervalDays);
  let templateIdx = 1;
  while (cursor <= phaseEnd && blocks.length <= maxBlocks) {
    const title = templates[templateIdx % templates.length];
    blocks.push(buildForecastBlock({
      planId, phase, lane, dayKey: cursor,
      title,
      commitmentState: phase.commitmentState,
      index: blocks.length,
      blockType: templateIdx % 2 === 0 ? 'audit' : 'action',
    }));
    cursor = addDaysToKey(cursor, intervalDays);
    templateIdx++;
  }

  // Late-P2 gate review block: 2 months before phase end
  const gateKey = clampKey(addMonthsToKey(phaseEnd, -2), phaseEnd);
  if (gateKey > (blocks[blocks.length - 1]?.dayKey || startBoundary) && gateKey <= phaseEnd) {
    blocks.push(buildForecastBlock({
      planId, phase, lane, dayKey: gateKey,
      title: `Assess P2 expansion readiness for ${lane ? laneLabel({ domain: lane.domain, title: lane.laneTitle }) : 'primary lane'} before widening commitment`,
      commitmentState: 'review-required',
      index: blocks.length,
      blockType: 'gate',
    }));
  }

  return blocks;
}

// ─── P3 derivation ────────────────────────────────────────────────────────────

function deriveP3Blocks({ planId, phase, lane, horizonEndDayKey }) {
  const { startBoundary, endBoundary } = phase;
  if (!startBoundary || !endBoundary) return [];

  const phaseEnd = clampKey(endBoundary, horizonEndDayKey);
  const totalDays = daysBetween(startBoundary, phaseEnd);
  if (totalDays < 30) return [];

  const templates = p3TitleTemplates(lane ? { domain: lane.domain, title: lane.laneTitle } : null);
  const blocks = [];

  // Entry block: first quarter start
  const entryKey = clampKey(nextFirstOfMonth(startBoundary), phaseEnd);
  if (entryKey <= phaseEnd) {
    blocks.push(buildForecastBlock({
      planId, phase, lane, dayKey: entryKey,
      title: templates[0 % templates.length],
      commitmentState: phase.commitmentState,
      index: blocks.length,
      blockType: 'review',
    }));
  }

  // Quarterly blocks (every 3 months)
  const maxBlocks = Math.min(Math.floor(totalDays / 90), 6);
  let cursor = entryKey ? addDaysToKey(entryKey, 90) : addDaysToKey(startBoundary, 90);
  let templateIdx = 1;
  while (cursor <= phaseEnd && blocks.length <= maxBlocks) {
    blocks.push(buildForecastBlock({
      planId, phase, lane, dayKey: cursor,
      title: templates[templateIdx % templates.length],
      commitmentState: phase.commitmentState,
      index: blocks.length,
      blockType: templateIdx % 2 === 0 ? 'audit' : 'readiness',
    }));
    cursor = addDaysToKey(cursor, 90);
    templateIdx++;
  }

  // Terminal-readiness block: 1 month before horizon end (mandatory P3 artifact)
  const terminalKey = clampKey(addMonthsToKey(phaseEnd, -1), phaseEnd);
  const lastBlockKey = blocks[blocks.length - 1]?.dayKey || startBoundary;
  if (terminalKey > lastBlockKey) {
    blocks.push(buildForecastBlock({
      planId, phase, lane: null, dayKey: terminalKey,
      title: TERMINAL_READINESS_TITLE,
      commitmentState: 'terminal-readiness',
      index: blocks.length,
      blockType: 'terminal-readiness',
      laneIdOverride: 'cross_lane_terminal_review',
      laneLabelOverride: 'cross-lane terminal review',
      titleFamily: 'p3_cross_lane_terminal_review',
    }));
  }

  return blocks;
}

// ─── P1 post-cycle derivation ─────────────────────────────────────────────────

function deriveP1PostCycleBlocks({ planId, phase, lane, cycleEndDayKey, horizonEndDayKey }) {
  const { startBoundary, endBoundary } = phase;
  if (!startBoundary || !endBoundary) return [];

  const phaseEnd = clampKey(endBoundary, horizonEndDayKey);

  // Post-cycle P1 blocks start after the active cycle ends (or after phase start
  // if no cycle is established yet, using the estimated current-cycle window).
  const postCycleStart = cycleEndDayKey
    ? addDaysToKey(cycleEndDayKey, 1)
    : nextFirstOfMonth(startBoundary);

  // Clamp: post-cycle start must be within the P1 phase window and horizon
  const windowStart = clampKey(postCycleStart, phaseEnd);
  if (!windowStart || windowStart > phaseEnd) return [];

  const totalDays = daysBetween(windowStart, phaseEnd);
  if (totalDays < 14) return [];

  const templates = p1PostCycleTitleTemplates(lane ? { domain: lane.domain, title: lane.laneTitle } : null);
  const blocks = [];

  // Entry block: first month boundary after cycle end
  const entryKey = clampKey(nextFirstOfMonth(windowStart), phaseEnd);
  const useEntryKey = entryKey && entryKey <= phaseEnd ? entryKey : windowStart;
  blocks.push(buildForecastBlock({
    planId, phase, lane, dayKey: useEntryKey,
    title: templates[0],
    commitmentState: 'forecast',
    index: blocks.length,
    blockType: 'audit',
  }));

  // Monthly blocks through P1 window — capped at 5 (density doctrine: near-term = monthly)
  const intervalDays = 28;
  const maxBlocks = Math.min(Math.floor(totalDays / intervalDays), 5);
  let cursor = addDaysToKey(useEntryKey, intervalDays);
  let templateIdx = 1;
  while (cursor <= phaseEnd && blocks.length <= maxBlocks) {
    blocks.push(buildForecastBlock({
      planId, phase, lane, dayKey: cursor,
      title: templates[templateIdx % templates.length],
      commitmentState: 'forecast',
      index: blocks.length,
      blockType: templateIdx % 2 === 0 ? 'validation' : 'action',
    }));
    cursor = addDaysToKey(cursor, intervalDays);
    templateIdx++;
  }

  // P1-to-P2 readiness gate: 3 weeks before P1 end (if not already covered)
  const gateKey = addDaysToKey(phaseEnd, -21);
  const lastBlockKey = blocks[blocks.length - 1]?.dayKey || windowStart;
  if (gateKey > lastBlockKey && gateKey <= phaseEnd) {
    const ll = lane ? laneLabel({ domain: lane.domain, title: lane.laneTitle }) : 'primary lane';
    blocks.push(buildForecastBlock({
      planId, phase, lane, dayKey: gateKey,
      title: `Reassess P1-to-P2 expansion readiness packet for ${ll}`,
      commitmentState: 'review-required',
      index: blocks.length,
      blockType: 'gate',
    }));
  }

  return blocks;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Derive dated future forecast/gated/locked blocks for a single phase.
 *
 * For P1: derives post-cycle forecast work beginning after cycleEndDayKey.
 * For P2/P3: derives phase-level planning blocks within the selected horizon.
 *
 * @param {object} opts
 * @param {object} opts.plan            - master plan object
 * @param {object} opts.phase           - phase from deriveMasterPlanPhaseModel
 * @param {string} opts.horizonEndDayKey - selected horizon end
 * @param {string} [opts.cycleEndDayKey] - active cycle deadline; P1 blocks start after this
 * @returns {Array}
 */
export function deriveForecastBlocks({ plan, phase, horizonEndDayKey, cycleEndDayKey = null }) {
  if (!plan || !phase) return [];
  const label = String(phase.label || '').trim().toUpperCase();

  const planId = String(plan.id || 'plan');
  const effectiveHorizonEnd = horizonEndDayKey || plan.fullHorizonEndDayKey || plan.horizonEnd;
  if (!effectiveHorizonEnd) return [];

  // Use the primary lane for title generation (first active/non-deferred lane)
  const primaryLane =
    (phase.laneParticipation || []).find(l => l.status !== 'deferred') ||
    (phase.laneParticipation || [])[0] ||
    null;

  if (label === 'P1') {
    // Only derive P1 post-cycle blocks when a cycle end is known (or estimable)
    return deriveP1PostCycleBlocks({
      planId, phase, lane: primaryLane,
      cycleEndDayKey,
      horizonEndDayKey: effectiveHorizonEnd,
    });
  }

  if (label === 'P2') {
    return deriveP2Blocks({ planId, phase, lane: primaryLane, horizonEndDayKey: effectiveHorizonEnd });
  }

  if (label === 'P3') {
    return deriveP3Blocks({ planId, phase, lane: primaryLane, horizonEndDayKey: effectiveHorizonEnd });
  }

  return [];
}

/**
 * Validate that a block title meets the action-title specificity rule.
 * Returns false for single-word titles or known vague labels.
 *
 * Rule: title must contain at least one space (i.e. more than one word)
 *       and must not be on the vague-label blocklist.
 */
export function validateBlockTitle(title) {
  if (!title) return false;
  const t = String(title).trim();
  if (!t) return false;

  const VAGUE = new Set([
    'launch', 'drop', 'promo', 'scale', 'build', 'review',
    'prep', 'work', 'execute', 'plan', 'ship', 'push',
    'meet', 'call', 'check', 'write', 'post', 'share',
  ]);

  const normalized = t.toLowerCase();

  // Single-word check
  if (!normalized.includes(' ')) return false;

  // Check if the entire title (lower-cased, trimmed) is a single known vague word
  if (VAGUE.has(normalized)) return false;

  return true;
}

/**
 * Resolve the horizon end dayKey for a given selectedHorizonMode,
 * given the plan's horizonVisibility object.
 *
 * @param {object} horizonVisibility - from deriveMasterPlanPhaseModel
 * @param {string} mode              - selectedHorizonMode
 * @param {string} cycleDedlineDayKey - active cycle deadline (fallback for current_cycle)
 * @returns {string|null}
 */
export function resolveHorizonEndForMode(horizonVisibility, mode, cycleDeadlineDayKey = null) {
  if (!horizonVisibility) return cycleDeadlineDayKey || null;
  switch (mode) {
    case 'current_cycle': return cycleDeadlineDayKey || horizonVisibility.currentCycleEnd || null;
    case '1_year':        return horizonVisibility.oneYearEnd || null;
    case '2_year':        return horizonVisibility.twoYearEnd || null;
    case '3_year':        return horizonVisibility.threeYearEnd || null;
    case '4_year':        return horizonVisibility.fourYearEnd || null;
    case '5_year':        return horizonVisibility.fiveYearEnd || null;
    case 'full_horizon':  return horizonVisibility.fullEnd || null;
    default:              return cycleDeadlineDayKey || null;
  }
}

export const HORIZON_MODES = ['current_cycle', '1_year', '2_year', '3_year', '4_year', '5_year', 'full_horizon'];

export const LONG_HORIZON_REASON_CODES = {
  TODAY_SELECTED_HORIZON_NO_BLOCK_EXPANSION: 'TODAY_SELECTED_HORIZON_NO_BLOCK_EXPANSION',
  FULL_HORIZON_CALENDAR_WORKLOAD_MISSING: 'FULL_HORIZON_CALENDAR_WORKLOAD_MISSING',
  P2_CALENDAR_SUBSTRATE_EMPTY: 'P2_CALENDAR_SUBSTRATE_EMPTY',
  P3_CALENDAR_SUBSTRATE_EMPTY: 'P3_CALENDAR_SUBSTRATE_EMPTY',
  FORECAST_BLOCKS_NOT_RENDERED_IN_TODAY: 'FORECAST_BLOCKS_NOT_RENDERED_IN_TODAY',
  LONG_HORIZON_WORK_DECOMPOSITION_MISSING: 'LONG_HORIZON_WORK_DECOMPOSITION_MISSING',
  SELECTED_HORIZON_VISIBLE_ONLY_IN_PLAN: 'SELECTED_HORIZON_VISIBLE_ONLY_IN_PLAN',
  CALENDAR_COMMITMENT_VISIBILITY_CONFLATED: 'CALENDAR_COMMITMENT_VISIBILITY_CONFLATED',
  FULL_HORIZON_EXECUTION_BURDEN_NOT_EXPRESSED: 'FULL_HORIZON_EXECUTION_BURDEN_NOT_EXPRESSED',
};
