import { validateBlockTitle } from './forecastBlockDerivation.js';

function normalizeDayKey(value) {
  const text = String(value || '').trim();
  return text ? text.slice(0, 10) : null;
}

function parseDayKey(value) {
  const dayKey = normalizeDayKey(value);
  return dayKey ? new Date(`${dayKey}T12:00:00.000Z`) : null;
}

function getQuarterKey(dayKey) {
  const date = parseDayKey(dayKey);
  if (!date) {
    return null;
  }
  return `${date.getUTCFullYear()}-Q${Math.floor(date.getUTCMonth() / 3) + 1}`;
}

function diffDays(left, right) {
  const leftDate = parseDayKey(left);
  const rightDate = parseDayKey(right);
  if (!leftDate || !rightDate) {
    return 0;
  }
  return Math.round((rightDate.getTime() - leftDate.getTime()) / 86400000);
}

function collectBlocks(fullHorizonScheduleBlocks = []) {
  return [...(Array.isArray(fullHorizonScheduleBlocks) ? fullHorizonScheduleBlocks : [])]
    .filter((block) => normalizeDayKey(block?.dayKey || block?.date))
    .sort((left, right) => String(left?.dayKey || left?.date || '').localeCompare(String(right?.dayKey || right?.date || '')));
}

function blocksForPhase(blocks, phaseLabel) {
  return blocks.filter((block) => String(block?.phaseLabel || '').trim() === phaseLabel);
}

function summarizeKeywords(blocks) {
  return blocks.map((block) => `${block.title || ''} ${block.expectedOutput || ''} ${block.derivationReason || ''}`.toLowerCase());
}

function hasAnyKeyword(texts, keywords) {
  return texts.some((text) => keywords.some((keyword) => text.includes(keyword)));
}

function average(values = []) {
  if (!values.length) {
    return 0;
  }
  return values.reduce((sum, value) => sum + Number(value || 0), 0) / values.length;
}

function scoreFromReasonCount(baseScore, count, penaltyPerReason = 8) {
  return Math.max(0, Math.min(100, baseScore - count * penaltyPerReason));
}

function evaluatePacing({ blocks, coverageAudit, phaseModel }) {
  const reasonCodes = [];
  const findings = [];
  const dayCounts = new Map();
  const quarterCounts = new Map();
  const p2Blocks = blocksForPhase(blocks, 'P2');
  const p3Blocks = blocksForPhase(blocks, 'P3');

  blocks.forEach((block) => {
    const dayKey = normalizeDayKey(block?.dayKey || block?.date);
    if (!dayKey) {
      return;
    }
    dayCounts.set(dayKey, (dayCounts.get(dayKey) || 0) + 1);
    const quarterKey = getQuarterKey(dayKey);
    if (quarterKey) {
      quarterCounts.set(quarterKey, (quarterCounts.get(quarterKey) || 0) + 1);
    }
  });

  const maxDayCount = Math.max(0, ...dayCounts.values());
  if (maxDayCount > 16) {
    reasonCodes.push('PACING_SINGLE_DAY_PILEUP');
    findings.push(`Peak same-day workload reaches ${maxDayCount} blocks on one day.`);
  }

  Object.entries(coverageAudit?.coverageByYear || {}).forEach(([year, entry]) => {
    if (Number(entry?.blockCount || 0) <= 0) {
      reasonCodes.push('PACING_YEAR_GAP');
      findings.push(`Year ${year} has no meaningful work.`);
    }
  });

  Object.entries(coverageAudit?.coverageByYear || {}).forEach(([year, entry]) => {
    if (Number(entry?.blockCount || 0) > 0 && Number(entry?.blockCount || 0) < Number(entry?.minExpectedCount || 1)) {
      reasonCodes.push('PACING_YEAR_GAP');
      findings.push(`Year ${year} is underpopulated for the declared horizon.`);
    }
  });

  const p2QuarterKeys = new Set(p2Blocks.map((block) => getQuarterKey(block.dayKey)).filter(Boolean));
  const p3QuarterKeys = new Set(p3Blocks.map((block) => getQuarterKey(block.dayKey)).filter(Boolean));
  const phaseCoverage = Array.isArray(phaseModel?.phases) ? phaseModel.phases : [];
  phaseCoverage.forEach((phase) => {
    const label = String(phase?.label || '').trim();
    const phaseBlocks = blocksForPhase(blocks, label);
    if (!phaseBlocks.length) {
      return;
    }
    const quarterSet = new Set(phaseBlocks.map((block) => getQuarterKey(block.dayKey)).filter(Boolean));
    if ((label === 'P2' || label === 'P3') && quarterSet.size <= 1) {
      reasonCodes.push('PACING_QUARTER_GAP');
      findings.push(`${label} only occupies ${quarterSet.size} quarter of work.`);
    }
  });

  const p2Gaps = p2Blocks.slice(1).map((block, index) => diffDays(p2Blocks[index].dayKey, block.dayKey));
  const p3Gaps = p3Blocks.slice(1).map((block, index) => diffDays(p3Blocks[index].dayKey, block.dayKey));
  if (p2Gaps.some((gap) => gap > 75)) {
    reasonCodes.push('PACING_PHASE_DENSITY_THIN');
    findings.push('P2 has unsupported gaps larger than 75 days.');
  }
  if (p3Gaps.some((gap) => gap > 120)) {
    reasonCodes.push('PACING_QUARTER_GAP');
    findings.push('P3 has unsupported gaps larger than 120 days.');
  }

  if (coverageAudit?.densityTrend?.state === 'collapsed') {
    reasonCodes.push('PACING_LATE_HORIZON_DENSITY_COLLAPSE');
    findings.push('Late-horizon density collapses before the terminal date.');
  }

  if (average(p2Gaps) > 35 || p2Blocks.length < 20) {
    reasonCodes.push('PACING_PHASE_DENSITY_THIN');
    findings.push('P2 cadence is thinner than expected for operating-system buildup.');
  }
  if (average(p3Gaps) > 65 || p3Blocks.length < 10) {
    reasonCodes.push('PACING_PHASE_DENSITY_THIN');
    findings.push('P3 cadence is thinner than expected for terminal-readiness buildup.');
  }

  return {
    score: scoreFromReasonCount(92, [...new Set(reasonCodes)].length, 10),
    reasonCodes: [...new Set(reasonCodes)],
    findings,
    summary: {
      maxDayCount,
      p2QuarterCount: p2QuarterKeys.size,
      p3QuarterCount: p3QuarterKeys.size,
      averageP2GapDays: Math.round(average(p2Gaps)),
      averageP3GapDays: Math.round(average(p3Gaps)),
    },
  };
}

function evaluatePrecision({ blocks }) {
  const reasonCodes = [];
  const findings = [];
  const titleCounts = new Map();

  blocks.forEach((block) => {
    const title = String(block?.title || '').trim();
    if (!validateBlockTitle(title)) {
      reasonCodes.push('PRECISION_VAGUE_TITLE');
      findings.push(`Vague title: ${title || '(empty title)'}`);
    }
    if (!String(block?.expectedOutput || '').trim()) {
      reasonCodes.push('PRECISION_MISSING_EXPECTED_OUTPUT');
      findings.push(`Missing expectedOutput: ${title || block?.id}`);
    }
    const lower = title.toLowerCase();
    if (!/(lane|operation endgame|app platform|album release engine|pipeline|system|bridge|thesis|design|development)/i.test(title)) {
      reasonCodes.push('PRECISION_MISSING_LANE_CONTEXT');
      findings.push(`Missing lane/object context: ${title || block?.id}`);
    }
    if (!Array.isArray(block?.sourceInputs) || block.sourceInputs.length === 0) {
      reasonCodes.push('PRECISION_MISSING_SOURCE_INPUTS');
      findings.push(`Missing source inputs: ${title || block?.id}`);
    }
    titleCounts.set(title, (titleCounts.get(title) || 0) + 1);
    if (['review', 'build', 'scale', 'launch', 'promo', 'work on app', 'grow audience', 'check progress', 'improve operations'].includes(lower)) {
      reasonCodes.push('PRECISION_VAGUE_TITLE');
      findings.push(`Rejected vague title token: ${title}`);
    }
  });

  const repeatedTitles = [...titleCounts.entries()].filter(([, count]) => count > 24);
  if (repeatedTitles.length > 0) {
    reasonCodes.push('PRECISION_TEMPLATE_REPETITION');
    findings.push(`Template repetition detected in ${repeatedTitles.length} title families.`);
  }

  return {
    score: scoreFromReasonCount(96, [...new Set(reasonCodes)].length, 8),
    reasonCodes: [...new Set(reasonCodes)],
    findings,
    summary: {
      repeatedTitleFamilies: repeatedTitles.length,
    },
  };
}

function evaluateProgression({ blocks }) {
  const reasonCodes = [];
  const findings = [];
  const p1Texts = summarizeKeywords(blocksForPhase(blocks, 'P1'));
  const p2Texts = summarizeKeywords(blocksForPhase(blocks, 'P2'));
  const p3Texts = summarizeKeywords(blocksForPhase(blocks, 'P3'));

  if (!hasAnyKeyword(p2Texts, ['conversion', 'retention', 'funnel', 'repeatable'])) {
    reasonCodes.push('PROGRESSION_P2_LACKS_CONVERSION_SYSTEM');
    findings.push('P2 lacks conversion-system evidence.');
  }
  if (!hasAnyKeyword(p2Texts, ['cadence', 'operating-system', 'dashboard', 'handoff', 'operating cadence'])) {
    reasonCodes.push('PROGRESSION_P2_LACKS_OPERATING_CADENCE');
    findings.push('P2 lacks operating cadence/system work.');
  }
  if (!hasAnyKeyword(p2Texts, ['revenue', 'margin', 'monetization', 'sponsor', 'partner readiness'])) {
    reasonCodes.push('PROGRESSION_P2_LACKS_REVENUE_ARCHITECTURE');
    findings.push('P2 lacks revenue architecture or monetization validation.');
  }
  if (!hasAnyKeyword(p3Texts, ['terminal-readiness', 'terminal evidence', 'outcome target', 'success standard'])) {
    reasonCodes.push('PROGRESSION_P3_LACKS_TERMINAL_READINESS');
    findings.push('P3 lacks terminal-readiness evidence.');
  }
  if (!hasAnyKeyword(p3Texts, ['scale-readiness', 'scale economics', 'scale distribution', 'scale-entry', 'institutional scale-readiness', 'civic scale-readiness'])) {
    reasonCodes.push('PROGRESSION_P3_LACKS_SCALE_READINESS');
    findings.push('P3 lacks scale-readiness work.');
  }
  if (!hasAnyKeyword(p3Texts, ['delegation', 'operating-system', 'institutional', 'charter', 'coalition'])) {
    reasonCodes.push('PROGRESSION_PHASE_ROLE_CONFUSED');
    findings.push('P3 lacks delegation/systemization or institutionalization signals.');
  }

  const p1LaunchWords = ['launch', 'release asset', 'pre-release', 'distribution', 'beta evidence'];
  const p3LooksLikeP1 = p3Texts.filter((text) => p1LaunchWords.some((word) => text.includes(word))).length;
  if (p3LooksLikeP1 > Math.max(2, Math.floor(p3Texts.length * 0.2))) {
    reasonCodes.push('PROGRESSION_LATER_PHASE_REPEATS_P1');
    findings.push('P3 still resembles launch-proof work instead of terminal-readiness work.');
  }

  const dependencyThinCount = blocks.filter(
    (block) =>
      (block.phaseLabel === 'P2' || block.phaseLabel === 'P3') &&
      (!Array.isArray(block.dependsOn) || block.dependsOn.length === 0)
  ).length;
  if (dependencyThinCount > Math.max(10, Math.floor(blocks.length * 0.05))) {
    reasonCodes.push('PROGRESSION_DEPENDENCY_CHAIN_THIN');
    findings.push(`${dependencyThinCount} later-phase blocks are missing dependency lineage.`);
  }

  return {
    score: scoreFromReasonCount(92, [...new Set(reasonCodes)].length, 9),
    reasonCodes: [...new Set(reasonCodes)],
    findings,
    summary: {
      p3LooksLikeP1,
      dependencyThinCount,
    },
  };
}

function evaluateProfessionalism({ blocks, laneModel = [] }) {
  const reasonCodes = [];
  const findings = [];
  const titleCounts = new Map();
  const laneIds = new Set((Array.isArray(laneModel) ? laneModel : []).map((lane) => String(lane?.id || '').trim()).filter(Boolean));

  blocks.forEach((block) => {
    const title = String(block?.title || '').trim();
    titleCounts.set(title, (titleCounts.get(title) || 0) + 1);
    if (!String(block?.derivationReason || '').trim() || !Array.isArray(block?.sourceInputs) || block.sourceInputs.length === 0) {
      reasonCodes.push('PROFESSIONALISM_INSUFFICIENT_LINEAGE');
      findings.push(`Insufficient lineage: ${title || block?.id}`);
    }
    if (block?.executionEligibility !== 'locked' && String(block?.phaseLabel || '').trim() !== 'P1') {
      reasonCodes.push('PROFESSIONALISM_STATE_MISMATCH');
      findings.push(`Unlocked future block detected: ${title || block?.id}`);
    }
    if (block?.laneId && laneIds.size > 0 && !laneIds.has(String(block.laneId).trim())) {
      reasonCodes.push('PROFESSIONALISM_LANE_PHASE_MISMATCH');
      findings.push(`Unknown lane assignment: ${title || block?.id}`);
    }
    if (/\bjust\b|\bthing\b|\bstuff\b|\bgeneric\b/i.test(title)) {
      reasonCodes.push('PROFESSIONALISM_GENERIC_LANGUAGE');
      findings.push(`Generic language detected: ${title}`);
    }
  });

  const repetitiveFamilies = [...titleCounts.entries()].filter(([, count]) => count > 18);
  if (repetitiveFamilies.length > 2) {
    reasonCodes.push('PROFESSIONALISM_REPETITIVE_BLOCK_PATTERN');
    findings.push(`Repeated template pattern dominates ${repetitiveFamilies.length} titles.`);
  }

  return {
    score: scoreFromReasonCount(90, [...new Set(reasonCodes)].length, 10),
    reasonCodes: [...new Set(reasonCodes)],
    findings,
    summary: {
      repetitiveFamilies: repetitiveFamilies.length,
    },
  };
}

function buildPhaseFindings(blocks, dimensions) {
  return {
    P1: {
      blockCount: blocksForPhase(blocks, 'P1').length,
      state: 'reference',
    },
    P2: {
      blockCount: blocksForPhase(blocks, 'P2').length,
      state: dimensions.progression.reasonCodes.some((code) => code.startsWith('PROGRESSION_P2'))
        ? 'degraded'
        : 'acceptable',
    },
    P3: {
      blockCount: blocksForPhase(blocks, 'P3').length,
      state: dimensions.progression.reasonCodes.some((code) => code.startsWith('PROGRESSION_P3'))
        ? 'degraded'
        : 'acceptable',
    },
  };
}

function buildLaneFindings(blocks) {
  const byLane = {};
  blocks.forEach((block) => {
    const key = String(block?.laneLabel || block?.laneId || 'unknown').trim();
    if (!byLane[key]) {
      byLane[key] = { blockCount: 0, phases: new Set(), blockTypes: new Set() };
    }
    byLane[key].blockCount += 1;
    if (block?.phaseLabel) {
      byLane[key].phases.add(block.phaseLabel);
    }
    if (block?.blockType) {
      byLane[key].blockTypes.add(block.blockType);
    }
  });
  return Object.fromEntries(
    Object.entries(byLane).map(([key, value]) => [
      key,
      {
        blockCount: value.blockCount,
        phases: [...value.phases],
        blockTypes: [...value.blockTypes],
      },
    ])
  );
}

export function evaluateFullHorizonPlanQuality({
  fullHorizonScheduleBlocks = [],
  fullHorizonCoverageAudit = null,
  phaseModel = null,
  laneModel = [],
  masterPlanContract = null,
  anchors = [],
  successStandard = null,
  outcomeTarget = null,
  constraints = null,
} = {}) {
  const blocks = collectBlocks(fullHorizonScheduleBlocks);
  const coveragePassed = Boolean(fullHorizonCoverageAudit?.fullHorizonCovered);
  const dimensions = {
    pacing: evaluatePacing({ blocks, coverageAudit: fullHorizonCoverageAudit, phaseModel }),
    precision: evaluatePrecision({ blocks }),
    progression: evaluateProgression({ blocks }),
    professionalism: evaluateProfessionalism({ blocks, laneModel }),
  };

  const aggregateReasonCodes = [
    ...dimensions.pacing.reasonCodes,
    ...dimensions.precision.reasonCodes,
    ...dimensions.progression.reasonCodes,
    ...dimensions.professionalism.reasonCodes,
  ];

  if (!coveragePassed) {
    aggregateReasonCodes.push('FULL_HORIZON_PLAN_QUALITY_FAILED');
  }

  const score = Math.round(
    average([
      dimensions.pacing.score,
      dimensions.precision.score,
      dimensions.progression.score,
      dimensions.professionalism.score,
    ])
  );

  let state = 'trusted';
  if (!coveragePassed || score < 55) {
    state = 'failed';
  } else if (score < 72 || aggregateReasonCodes.length >= 5) {
    state = 'degraded';
  } else if (score < 88 || aggregateReasonCodes.length > 0) {
    state = 'provisional';
  }

  if (dimensions.progression.reasonCodes.some((code) => code.startsWith('PROGRESSION_P2'))) {
    aggregateReasonCodes.push('P2_QUALITY_DEGRADED');
  }
  if (dimensions.progression.reasonCodes.some((code) => code.startsWith('PROGRESSION_P3'))) {
    aggregateReasonCodes.push('P3_QUALITY_DEGRADED');
  }
  if (state === 'degraded') {
    aggregateReasonCodes.push('FULL_HORIZON_PLAN_QUALITY_DEGRADED');
  }
  if (state === 'failed') {
    aggregateReasonCodes.push('FULL_HORIZON_PLAN_QUALITY_FAILED');
  }
  if (coveragePassed && state !== 'trusted') {
    aggregateReasonCodes.push('COVERAGE_PASSED_BUT_QUALITY_DEGRADED');
  }

  return {
    state,
    score,
    dimensions,
    phaseFindings: buildPhaseFindings(blocks, dimensions),
    laneFindings: buildLaneFindings(blocks),
    coveragePassed,
    meta: {
      anchorCount: Array.isArray(anchors) ? anchors.length : 0,
      hasSuccessStandard: Boolean(String(successStandard || '').trim()),
      hasOutcomeTarget: Boolean(String(outcomeTarget || '').trim()),
      hasConstraints: Boolean(constraints),
      contractPresent: Boolean(masterPlanContract),
    },
    reasonCodes: [...new Set(aggregateReasonCodes)],
  };
}

export function getFullHorizonPlanQualityLabel(planQuality = null) {
  const state = String(planQuality?.state || '').trim().toLowerCase();
  if (state === 'trusted') {
    return 'Plan quality trusted';
  }
  if (state === 'provisional') {
    return 'Plan quality provisional';
  }
  if (state === 'degraded') {
    return 'Plan quality degraded';
  }
  if (state === 'failed') {
    return 'Plan quality failed';
  }
  return 'Plan quality unavailable';
}

export function getFullHorizonPlanQualityTone(planQuality = null) {
  const state = String(planQuality?.state || '').trim().toLowerCase();
  if (state === 'trusted') {
    return 'positive';
  }
  if (state === 'provisional') {
    return 'warning';
  }
  if (state === 'degraded' || state === 'failed') {
    return 'critical';
  }
  return 'muted';
}

export default evaluateFullHorizonPlanQuality;
