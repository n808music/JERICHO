import { validateBlockTitle } from './forecastBlockDerivation.js';
import { resolveBlockPlainLanguage } from '../product/resolveBlockPlainLanguage.js';

const DEBUG_BLOCK_DETAIL_QUALITY =
  typeof process !== 'undefined' && process?.env?.JERICHO_DEBUG_BLOCK_DETAIL_QUALITY === '1';

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

function dayDistanceInclusive(left, right) {
  const distance = diffDays(left, right);
  return distance > 0 ? distance + 1 : 0;
}

function getTemporalDayKey(item) {
  return normalizeDayKey(
    item?.targetDate ||
      item?.dayKey ||
      item?.date ||
      item?.startDayKey ||
      item?.startDate ||
      item?.targetDayKey ||
      null
  );
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

function buildBlockDetailHierarchy(block = {}) {
  const initiative =
    block?.initiativeName ||
    block?.projectName ||
    block?.ventureName ||
    block?.initiativeTitle ||
    block?.initiativeLabel ||
    block?.initiative ||
    '';
  return {
    phase: String(block?.phaseLabel || '').trim(),
    lane: String(block?.laneLabel || block?.laneName || block?.lane || '').trim(),
    initiative: String(initiative || '').trim(),
    operatingCycle: String(block?.operatingCycleLabel || block?.cycleLabel || '').trim(),
    sprint: String(block?.sprintLabel || block?.windowLabel || '').trim(),
  };
}

// Molecular block-detail advisories are UI/display clarity signals.
// They should remain visible in block detail rendering, but they should NOT
// count as full-horizon trust failures unless the underlying schedule
// substrate is missing.
const MOLECULAR_ADVISORY_CODES = new Set([
  'BLOCK_DETAIL_TOO_ABSTRACT',
  'BLOCK_DETAIL_DO_THIS_EMPTY',
  'BLOCK_DETAIL_DONE_WHEN_EMPTY',
]);

export function summarizeBlockDetailQuality(blocks = []) {
  const startedAt = DEBUG_BLOCK_DETAIL_QUALITY ? Date.now() : 0;
  if (DEBUG_BLOCK_DETAIL_QUALITY) {
    console.log('[fullHorizonPlanQuality] block-detail loop start', { blockCount: blocks.length });
  }
  const byCode = {};
  const byBlockId = {};
  const findings = [];
  const uniqueBlockIds = new Set();

  blocks.forEach((block, index) => {
    const resolution = resolveBlockPlainLanguage(block, {
      hierarchy: buildBlockDetailHierarchy(block),
    });
    const rawFailureCodes = Array.isArray(resolution?.quality?.failureCodes)
      ? resolution.quality.failureCodes
      : [];
    const failureCodes = rawFailureCodes.filter((code) => !MOLECULAR_ADVISORY_CODES.has(code));
    if (!failureCodes.length) {
      return;
    }

    const blockId = String(block?.id || `forecast-block-${index}`).trim();
    uniqueBlockIds.add(blockId);
    findings.push({
      blockId,
      title: String(block?.title || block?.label || block?.displayTitle || '').trim(),
      failureCodes: [...new Set(failureCodes.map((code) => String(code || '').trim()).filter(Boolean))],
    });

    failureCodes.forEach((code) => {
      const normalizedCode = String(code || '').trim();
      if (!normalizedCode) {
        return;
      }
      byCode[normalizedCode] = (byCode[normalizedCode] || 0) + 1;
      if (!Array.isArray(byBlockId[normalizedCode])) {
        byBlockId[normalizedCode] = [];
      }
      if (!byBlockId[normalizedCode].includes(blockId)) {
        byBlockId[normalizedCode].push(blockId);
      }
    });
  });

  if (DEBUG_BLOCK_DETAIL_QUALITY) {
    console.log('[fullHorizonPlanQuality] block-detail loop end', {
      blockCount: blocks.length,
      failureBlockCount: uniqueBlockIds.size,
      failureCodeCount: Object.keys(byCode).length,
      durationMs: Date.now() - startedAt,
    });
  }

  return {
    failureCount: uniqueBlockIds.size,
    findings,
    codeCounts: byCode,
    failureCodes: Object.keys(byCode),
    byBlockId,
  };
}

function getReasonCodeFamily(code) {
  const text = String(code || '').trim();
  if (!text) {
    return null;
  }
  return text.replace(/_P[123]$/, '');
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
    const laneId = String(block?.laneId || '').trim();
    const laneLabel = String(block?.laneLabel || '').trim();
    const isExplicitCrossLaneReview =
      laneId.startsWith('cross_lane_') || /\bcross-lane\b/i.test(laneLabel) || /\bcross-lane\b/i.test(title);
    titleCounts.set(title, (titleCounts.get(title) || 0) + 1);
    if (!String(block?.derivationReason || '').trim() || !Array.isArray(block?.sourceInputs) || block.sourceInputs.length === 0) {
      reasonCodes.push('PROFESSIONALISM_INSUFFICIENT_LINEAGE');
      findings.push(`Insufficient lineage: ${title || block?.id}`);
    }
    if (block?.executionEligibility !== 'locked' && String(block?.phaseLabel || '').trim() !== 'P1') {
      reasonCodes.push('PROFESSIONALISM_STATE_MISMATCH');
      findings.push(`Unlocked future block detected: ${title || block?.id}`);
    }
    if (laneId && laneIds.size > 0 && !laneIds.has(laneId) && !isExplicitCrossLaneReview) {
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

function evaluateMilestoneCompleteness({ blocks, phaseModel }) {
  const reasonCodes = [];
  const findings = [];
  const phases = Array.isArray(phaseModel?.phases) ? phaseModel.phases : [];

  phases.forEach((phase) => {
    const label = String(phase?.label || '').trim();
    if (!['P1', 'P2', 'P3'].includes(label)) {
      return;
    }
    const phaseBlocks = blocksForPhase(blocks, label);
    if (!phaseBlocks.length) {
      return;
    }
    const namedMilestoneCount = Array.isArray(phase?.milestones) ? phase.milestones.length : 0;
    const anchorCount = Array.isArray(phase?.anchorsInPhase) ? phase.anchorsInPhase.length : 0;
    if (namedMilestoneCount > 0) {
      return;
    }
    reasonCodes.push('PHASE_NAMED_MILESTONES_MISSING');
    reasonCodes.push(`PHASE_NAMED_MILESTONES_MISSING_${label}`);
    findings.push(
      `${label} has ${phaseBlocks.length} forecast blocks and ${anchorCount} major anchor${
        anchorCount === 1 ? '' : 's'
      }, but no named milestones.`
    );
  });

  return {
    score: scoreFromReasonCount(94, [...new Set(reasonCodes)].length, 10),
    reasonCodes: [...new Set(reasonCodes)],
    findings,
    summary: Object.fromEntries(
      phases
        .filter((phase) => ['P1', 'P2', 'P3'].includes(String(phase?.label || '').trim()))
        .map((phase) => {
          const label = String(phase?.label || '').trim();
          return [
            label,
            {
              namedMilestoneCount: Array.isArray(phase?.milestones) ? phase.milestones.length : 0,
              anchorCount: Array.isArray(phase?.anchorsInPhase) ? phase.anchorsInPhase.length : 0,
              forecastBlockCount: blocksForPhase(blocks, label).length,
            },
          ];
        })
    ),
  };
}

function buildCompensatingPhaseSubstrate({
  label,
  phase,
  phaseBlocks,
  activeLaneIds,
  maxAllowedGapDays,
  fullHorizonBlockQuality,
}) {
  if (String(fullHorizonBlockQuality?.state || '').trim().toLowerCase() !== 'trusted') {
    return { compensates: false };
  }

  const phaseIssues = (Array.isArray(fullHorizonBlockQuality?.issues) ? fullHorizonBlockQuality.issues : []).filter((issue) => {
    const issuePhase = String(issue?.phaseLabel || '').trim();
    return issuePhase === label && String(issue?.severity || '').trim().toLowerCase() !== 'low';
  });
  if (phaseIssues.length > 0) {
    return { compensates: false };
  }

  const expectedOutputCoverage =
    phaseBlocks.length > 0
      ? phaseBlocks.filter((block) => String(block?.expectedOutput || '').trim()).length / phaseBlocks.length
      : 0;
  const activeLanesWithBlocks = [...activeLaneIds].filter((laneId) =>
    phaseBlocks.some((block) => String(block?.laneId || '').trim() === laneId)
  ).length;
  const activeLaneBlockCoverageRatio = activeLaneIds.size > 0 ? activeLanesWithBlocks / activeLaneIds.size : 1;
  const phaseQuarterCount = new Set(phaseBlocks.map((block) => getQuarterKey(block.dayKey || block.date)).filter(Boolean)).size;
  const sortedBlocks = [...phaseBlocks].sort((left, right) =>
    String(normalizeDayKey(left?.dayKey || left?.date || '')).localeCompare(
      String(normalizeDayKey(right?.dayKey || right?.date || ''))
    )
  );
  const blockGaps = sortedBlocks.slice(1).map((block, index) =>
    diffDays(sortedBlocks[index]?.dayKey || sortedBlocks[index]?.date, block?.dayKey || block?.date)
  );
  const largestBlockGapDays = Math.max(0, ...blockGaps);
  const durationDays = dayDistanceInclusive(phase?.startBoundary, phase?.endBoundary);
  const minimumQuarterCoverage = Math.max(3, Math.min(6, Math.ceil(durationDays / 180)));
  const minimumBlockCount = Math.max(activeLaneIds.size * 12, Math.ceil(durationDays / 14));

  const compensates =
    phaseBlocks.length >= minimumBlockCount &&
    expectedOutputCoverage >= 0.95 &&
    activeLaneBlockCoverageRatio >= 0.8 &&
    phaseQuarterCount >= minimumQuarterCoverage &&
    largestBlockGapDays <= maxAllowedGapDays;

  return {
    compensates,
    summary: {
      expectedOutputCoverage,
      activeLaneBlockCoverageRatio,
      phaseQuarterCount,
      largestBlockGapDays,
      minimumQuarterCoverage,
      minimumBlockCount,
    },
  };
}

function evaluatePhaseBalance({ blocks, phaseModel, fullHorizonBlockQuality = null }) {
  const reasonCodes = [];
  const findings = [];
  const phases = Array.isArray(phaseModel?.phases) ? phaseModel.phases : [];

  phases.forEach((phase) => {
    const label = String(phase?.label || '').trim();
    if (!['P1', 'P2', 'P3'].includes(label)) {
      return;
    }
    const phaseBlocks = blocksForPhase(blocks, label);
    if (!phaseBlocks.length) {
      return;
    }

    const milestones = [...(Array.isArray(phase?.milestones) ? phase.milestones : [])]
      .filter((milestone) => getTemporalDayKey(milestone))
      .sort((left, right) => String(getTemporalDayKey(left) || '').localeCompare(String(getTemporalDayKey(right) || '')));
    const namedMilestoneCount = milestones.length;
    if (namedMilestoneCount === 0) {
      return;
    }

    const activeLaneIds = new Set(
      (Array.isArray(phase?.laneParticipation) ? phase.laneParticipation : [])
        .filter((lane) => String(lane?.status || '').trim().toLowerCase() === 'active')
        .map((lane) => String(lane?.laneId || '').trim())
        .filter(Boolean)
    );
    const milestoneLaneIds = new Set(
      milestones.map((milestone) => String(milestone?.laneId || '').trim()).filter(Boolean)
    );
    const activeLanesWithMilestones = [...activeLaneIds].filter((laneId) => milestoneLaneIds.has(laneId)).length;
    const activeLaneCoverageRatio = activeLaneIds.size > 0 ? activeLanesWithMilestones / activeLaneIds.size : 1;

    const durationDays = dayDistanceInclusive(phase?.startBoundary, phase?.endBoundary);
    const requiredMilestones = Math.max(3, Math.ceil(durationDays / 120));
    const temporalPoints = [
      normalizeDayKey(phase?.startBoundary),
      ...milestones.map((milestone) => getTemporalDayKey(milestone)).filter(Boolean),
      normalizeDayKey(phase?.endBoundary),
    ].filter(Boolean);
    const gaps = [];
    for (let index = 1; index < temporalPoints.length; index += 1) {
      gaps.push(diffDays(temporalPoints[index - 1], temporalPoints[index]));
    }
    const largestGapDays = Math.max(0, ...gaps);
    const maxAllowedGapDays = Math.max(180, Math.round(durationDays * 0.4));
    const compensatingSubstrate = buildCompensatingPhaseSubstrate({
      label,
      phase,
      phaseBlocks,
      activeLaneIds,
      maxAllowedGapDays,
      fullHorizonBlockQuality,
    });

    if (namedMilestoneCount < requiredMilestones && !compensatingSubstrate.compensates) {
      reasonCodes.push('PHASE_MILESTONE_DENSITY_THIN');
      reasonCodes.push(`PHASE_MILESTONE_DENSITY_THIN_${label}`);
      findings.push(
        `${label} spans ${durationDays} days with ${phaseBlocks.length} forecast blocks but only ${namedMilestoneCount} named milestones; ${requiredMilestones} are expected for this phase length.`
      );
    }

    if (activeLaneIds.size >= 4 && activeLaneCoverageRatio < 0.8 && !compensatingSubstrate.compensates) {
      reasonCodes.push('PHASE_ACTIVE_LANE_MILESTONE_COVERAGE_THIN');
      reasonCodes.push(`PHASE_ACTIVE_LANE_MILESTONE_COVERAGE_THIN_${label}`);
      findings.push(
        `${label} only gives named milestone coverage to ${activeLanesWithMilestones}/${activeLaneIds.size} active lanes.`
      );
    }

    if (largestGapDays > maxAllowedGapDays && !compensatingSubstrate.compensates) {
      reasonCodes.push('PHASE_MILESTONE_TIME_DISTRIBUTION_THIN');
      reasonCodes.push(`PHASE_MILESTONE_TIME_DISTRIBUTION_THIN_${label}`);
      findings.push(
        `${label} has a ${largestGapDays}-day milestone gap inside a ${durationDays}-day phase, leaving long stretches with only forecast workload.`
      );
    }
  });

  return {
    score: scoreFromReasonCount(94, [...new Set(reasonCodes)].length, 8),
    reasonCodes: [...new Set(reasonCodes)],
    findings,
  };
}

function buildPhaseFindings(blocks, dimensions) {
  return {
    P1: {
      blockCount: blocksForPhase(blocks, 'P1').length,
      state: dimensions.completeness.reasonCodes.includes('PHASE_NAMED_MILESTONES_MISSING_P1')
        ? 'milestone_incomplete'
        : dimensions.balance.reasonCodes.some((code) => code.endsWith('_P1'))
          ? 'milestone_thin'
        : 'reference',
    },
    P2: {
      blockCount: blocksForPhase(blocks, 'P2').length,
      state: dimensions.completeness.reasonCodes.includes('PHASE_NAMED_MILESTONES_MISSING_P2')
        ? 'milestone_incomplete'
        : dimensions.balance.reasonCodes.some((code) => code.endsWith('_P2'))
          ? 'milestone_thin'
        : dimensions.progression.reasonCodes.some((code) => code.startsWith('PROGRESSION_P2'))
          ? 'degraded'
          : 'acceptable',
    },
    P3: {
      blockCount: blocksForPhase(blocks, 'P3').length,
      state: dimensions.completeness.reasonCodes.includes('PHASE_NAMED_MILESTONES_MISSING_P3')
        ? 'milestone_incomplete'
        : dimensions.balance.reasonCodes.some((code) => code.endsWith('_P3'))
          ? 'milestone_thin'
        : dimensions.progression.reasonCodes.some((code) => code.startsWith('PROGRESSION_P3'))
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

function getPlanHorizonBounds(masterPlanContract) {
  return {
    startDayKey: normalizeDayKey(masterPlanContract?.fullHorizonStartDayKey || masterPlanContract?.horizonStart),
    endDayKey: normalizeDayKey(
      masterPlanContract?.fullHorizonEndDayKey || masterPlanContract?.horizonEnd || masterPlanContract?.deadline
    ),
  };
}

function getFirstAnchorDayKey(anchors = []) {
  return (
    [...(Array.isArray(anchors) ? anchors : [])]
      .map((anchor) => normalizeDayKey(anchor?.date || anchor?.dayKey || anchor?.targetDate))
      .filter(Boolean)
      .sort()[0] || null
  );
}

function getExpectedLaneKeys(laneModel = []) {
  return (Array.isArray(laneModel) ? laneModel : [])
    .filter((lane) => {
      const state = String(lane?.activationState || lane?.status || 'active').trim().toLowerCase();
      return !['inactive', 'retired', 'obsolete'].includes(state);
    })
    .flatMap((lane) => [lane?.id, lane?.laneId, lane?.title, lane?.label])
    .map((value) => String(value || '').trim())
    .filter(Boolean);
}

function evaluateMvpPlanQualityStandard({
  blocks,
  fullHorizonCoverageAudit,
  dimensions,
  laneModel,
  masterPlanContract,
  anchors,
  blockDetailQualitySummary,
}) {
  const reasonCodes = [];
  const findings = [];
  const { startDayKey, endDayKey } = getPlanHorizonBounds(masterPlanContract);
  const horizonDays = dayDistanceInclusive(startDayKey, endDayKey);
  const firstBlockDayKey = normalizeDayKey(blocks[0]?.dayKey || blocks[0]?.date);
  const lastBlockDayKey = normalizeDayKey(blocks[blocks.length - 1]?.dayKey || blocks[blocks.length - 1]?.date);
  const terminalGapDays = endDayKey && lastBlockDayKey ? Math.max(0, diffDays(lastBlockDayKey, endDayKey)) : null;
  const blocksByPhase = {
    P1: blocksForPhase(blocks, 'P1'),
    P2: blocksForPhase(blocks, 'P2'),
    P3: blocksForPhase(blocks, 'P3'),
  };
  const p3LastDayKey = normalizeDayKey(blocksByPhase.P3[blocksByPhase.P3.length - 1]?.dayKey);
  const p3TerminalGapDays = endDayKey && p3LastDayKey ? Math.max(0, diffDays(p3LastDayKey, endDayKey)) : null;
  const firstAnchorDayKey = getFirstAnchorDayKey(anchors);
  const postAnchorBlocks = firstAnchorDayKey ? blocks.filter((block) => normalizeDayKey(block?.dayKey) > firstAnchorDayKey) : [];
  const expectedLaneKeys = [
    ...new Set([
      ...getExpectedLaneKeys(laneModel),
      ...blocks
        .flatMap((block) => [block?.laneId, block?.laneLabel])
        .map((value) => String(value || '').trim())
        .filter(Boolean),
    ]),
  ];
  const longHorizon = horizonDays >= 365;
  const terminalWindowDays = longHorizon ? Math.max(120, Math.round(horizonDays * 0.08)) : 45;
  const minimumBlocks = longHorizon ? Math.max(36, Math.ceil(horizonDays / 21)) : Math.max(8, Math.ceil(horizonDays / 30));
  const firstYearStartDayKey = startDayKey || firstBlockDayKey;
  const firstYearEnd = firstYearStartDayKey ? parseDayKey(firstYearStartDayKey) : null;
  if (firstYearEnd) {
    firstYearEnd.setUTCDate(firstYearEnd.getUTCDate() + 365);
  }
  const firstYearEndDayKey = firstYearEnd ? firstYearEnd.toISOString().slice(0, 10) : null;

  const addGateFailure = (code, finding) => {
    reasonCodes.push(code);
    if (finding) {
      findings.push(finding);
    }
  };

  if (!fullHorizonCoverageAudit?.fullHorizonCovered || terminalGapDays === null || terminalGapDays > terminalWindowDays) {
    addGateFailure(
      'PLAN_HORIZON_UNDERFILLED',
      `Plan work stops ${terminalGapDays ?? 'unknown'} days before the declared horizon.`
    );
  }

  if (
    !blocksByPhase.P1.length ||
    !blocksByPhase.P2.length ||
    !blocksByPhase.P3.length ||
    dimensions?.pacing?.reasonCodes?.includes('PACING_QUARTER_GAP') ||
    dimensions?.pacing?.reasonCodes?.includes('PACING_YEAR_GAP')
  ) {
    addGateFailure('PHASE_MODEL_COMPRESSED', 'P1/P2/P3 are not meaningfully distributed across the horizon.');
  }

  if (!blocksByPhase.P3.length || p3TerminalGapDays === null || p3TerminalGapDays > terminalWindowDays) {
    addGateFailure(
      'TERMINAL_PHASE_MISSING_OR_TOO_EARLY',
      `P3 terminal-readiness work stops ${p3TerminalGapDays ?? 'unknown'} days before the horizon.`
    );
  }

  const expectedLaneCount = Math.max(expectedLaneKeys.length, Array.isArray(laneModel) ? laneModel.length : 0);
  if (expectedLaneCount >= 3 && firstYearEndDayKey) {
    const lanesWithPostYearWork = new Set(
      blocks
        .filter((block) => normalizeDayKey(block?.dayKey) > firstYearEndDayKey)
        .flatMap((block) => [block?.laneId, block?.laneLabel])
        .map((value) => String(value || '').trim())
        .filter(Boolean)
    );
    const matchedContinuedLaneCount = expectedLaneKeys.filter((laneKey) => lanesWithPostYearWork.has(laneKey)).length;
    const continuedLaneCount =
      expectedLaneKeys.length > 0 && matchedContinuedLaneCount > 0
        ? matchedContinuedLaneCount
        : Math.min(lanesWithPostYearWork.size, expectedLaneCount);
    if (continuedLaneCount / expectedLaneCount < 0.6) {
      addGateFailure(
        'LANE_CONTINUITY_GAP',
        `Only ${continuedLaneCount}/${expectedLaneCount} lanes continue beyond the first year.`
      );
    }
  }

  if (
    dimensions?.precision?.reasonCodes?.some((code) =>
      ['PRECISION_VAGUE_TITLE', 'PRECISION_MISSING_EXPECTED_OUTPUT', 'PRECISION_MISSING_LANE_CONTEXT'].includes(code)
    )
  ) {
    addGateFailure('ACTION_SPECIFICITY_WEAK', 'Executable block titles or expected outputs are too vague.');
  }

  if (Number(blockDetailQualitySummary?.failureCount || 0) > 0) {
    addGateFailure(
      'ACTION_SPECIFICITY_WEAK',
      `${blockDetailQualitySummary.failureCount} forecast block${blockDetailQualitySummary.failureCount === 1 ? '' : 's'} fail the canonical block-detail authority.`
    );
  }

  if (
    blocks.length < minimumBlocks ||
    dimensions?.pacing?.reasonCodes?.some((code) =>
      ['PACING_PHASE_DENSITY_THIN', 'PACING_LATE_HORIZON_DENSITY_COLLAPSE', 'PACING_YEAR_GAP'].includes(code)
    )
  ) {
    addGateFailure('WORKLOAD_DENSITY_THIN', 'Workload density is too thin for the declared strategic horizon.');
  }

  if (
    firstAnchorDayKey &&
    endDayKey &&
    firstAnchorDayKey < endDayKey &&
    postAnchorBlocks.length < Math.max(4, Math.floor(blocks.length * 0.08))
  ) {
    addGateFailure('ANCHOR_TREATED_AS_TERMINAL_ENDPOINT', 'The first major anchor is acting like the plan endpoint.');
  }

  if (
    !fullHorizonCoverageAudit?.fullHorizonCovered ||
    fullHorizonCoverageAudit?.reasonCodes?.some((code) =>
      ['COVERAGE_BADGE_PREMATURE', 'HORIZON_RESOLVED_BUT_NOT_COVERED', 'EXPANSION_RENDERED_BUT_TERMINAL_COVERAGE_MISSING'].includes(
        code
      )
    )
  ) {
    addGateFailure('PLAN_CALENDAR_COHERENCE_WEAK', 'Plan horizon coverage and scheduled agenda do not agree.');
  }

  if (
    blocks.some((block) =>
      ['UNSCHEDULABLE', 'CAPACITY_CONSTRAINT_MISMATCH', 'OUTSIDE_WORK_WINDOW'].some((token) =>
        String(block?.placementStatus || block?.conflictCode || block?.reasonCode || '').includes(token)
      )
    )
  ) {
    addGateFailure('CAPACITY_CONSTRAINT_MISMATCH', 'Scheduled work conflicts with capacity or placement constraints.');
  }

  if (
    dimensions?.progression?.reasonCodes?.includes('PROGRESSION_DEPENDENCY_CHAIN_THIN') ||
    blocks.some((block) => String(block?.phaseLabel || '').match(/^P[23]$/) && block?.dependencyOrderWeak)
  ) {
    addGateFailure('DEPENDENCY_ORDER_WEAK', 'Later-phase work lacks enough dependency lineage.');
  }

  // Weekday distribution gate: for long-horizon plans with enough blocks,
  // clustering ≥75% of work onto ≤2 weekdays while <4 weekdays are used is a quality failure.
  if (longHorizon && blocks.length >= 20) {
    const dowCounts = {};
    const dowNames = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
    for (const block of blocks) {
      const dk = block?.dayKey || block?.date;
      if (!dk || typeof dk !== 'string') continue;
      const dowName = dowNames[new Date(`${dk}T12:00:00.000Z`).getUTCDay()];
      dowCounts[dowName] = (dowCounts[dowName] || 0) + 1;
    }
    const dowEntries = Object.entries(dowCounts).sort((a, b) => b[1] - a[1]);
    const uniqueDowCount = dowEntries.length;
    const topTwoCount = (dowEntries[0]?.[1] ?? 0) + (dowEntries[1]?.[1] ?? 0);
    const topTwoRatio = blocks.length > 0 ? topTwoCount / blocks.length : 0;
    if (topTwoRatio > 0.75 && uniqueDowCount < 4) {
      const topDay = dowEntries[0]?.[0] ?? '?';
      const topPct = Math.round(((dowEntries[0]?.[1] ?? 0) / blocks.length) * 100);
      addGateFailure(
        'WORK_WEEK_DISTRIBUTION_CLUSTERED',
        `${topPct}% of blocks land on ${topDay} — only ${uniqueDowCount} weekday${uniqueDowCount === 1 ? '' : 's'} used across a ${horizonDays}-day horizon.`
      );
    }
  }

  const uniqueReasonCodes = [...new Set(reasonCodes)];
  let status = 'trusted_plan';
  if (uniqueReasonCodes.includes('PLAN_HORIZON_UNDERFILLED') || uniqueReasonCodes.includes('PLAN_CALENDAR_COHERENCE_WEAK')) {
    status = 'withheld_plan';
  } else if (
    uniqueReasonCodes.length >= 4 ||
    uniqueReasonCodes.includes('TERMINAL_PHASE_MISSING_OR_TOO_EARLY') ||
    uniqueReasonCodes.includes('WORK_WEEK_DISTRIBUTION_CLUSTERED')
  ) {
    status = 'degraded_plan';
  } else if (uniqueReasonCodes.length > 0) {
    status = 'provisional_plan';
  }

  return {
    status,
    reasonCodes: uniqueReasonCodes,
    findings,
    gates: {
      horizonCoverage: !uniqueReasonCodes.includes('PLAN_HORIZON_UNDERFILLED'),
      phaseDistribution: !uniqueReasonCodes.includes('PHASE_MODEL_COMPRESSED'),
      terminalPhasePresence: !uniqueReasonCodes.includes('TERMINAL_PHASE_MISSING_OR_TOO_EARLY'),
      laneContinuity: !uniqueReasonCodes.includes('LANE_CONTINUITY_GAP'),
      actionSpecificity: !uniqueReasonCodes.includes('ACTION_SPECIFICITY_WEAK'),
      workloadDensity: !uniqueReasonCodes.includes('WORKLOAD_DENSITY_THIN'),
      anchorIntegration: !uniqueReasonCodes.includes('ANCHOR_TREATED_AS_TERMINAL_ENDPOINT'),
      planCalendarCoherence: !uniqueReasonCodes.includes('PLAN_CALENDAR_COHERENCE_WEAK'),
      capacityRealism: !uniqueReasonCodes.includes('CAPACITY_CONSTRAINT_MISMATCH'),
      dependencyOrder: !uniqueReasonCodes.includes('DEPENDENCY_ORDER_WEAK'),
      workWeekDistribution: !uniqueReasonCodes.includes('WORK_WEEK_DISTRIBUTION_CLUSTERED'),
    },
    summary: {
      startDayKey,
      endDayKey,
      firstBlockDayKey,
      lastBlockDayKey,
      terminalGapDays,
      p3LastDayKey,
      p3TerminalGapDays,
      blockCount: blocks.length,
      minimumBlocks,
      expectedLaneCount,
      firstAnchorDayKey,
      postAnchorBlockCount: postAnchorBlocks.length,
      blockDetailFailureCount: Number(blockDetailQualitySummary?.failureCount || 0),
      blockDetailFailureCodes: Array.isArray(blockDetailQualitySummary?.failureCodes)
        ? blockDetailQualitySummary.failureCodes
        : [],
    },
  };
}

export function evaluateFullHorizonPlanQuality({
  fullHorizonScheduleBlocks = [],
  fullHorizonCoverageAudit = null,
  fullHorizonBlockQuality = null,
  phaseModel = null,
  laneModel = [],
  masterPlanContract = null,
  anchors = [],
  successStandard = null,
  outcomeTarget = null,
  constraints = null,
} = {}) {
  const startedAt = DEBUG_BLOCK_DETAIL_QUALITY ? Date.now() : 0;
  if (DEBUG_BLOCK_DETAIL_QUALITY) {
    console.log('[fullHorizonPlanQuality] evaluate start', {
      incomingBlockCount: Array.isArray(fullHorizonScheduleBlocks) ? fullHorizonScheduleBlocks.length : 0,
    });
  }
  const blocks = collectBlocks(fullHorizonScheduleBlocks);
  const coveragePassed = Boolean(fullHorizonCoverageAudit?.fullHorizonCovered);
  const blockDetailQualitySummary = summarizeBlockDetailQuality(blocks);
  const dimensions = {
    pacing: evaluatePacing({ blocks, coverageAudit: fullHorizonCoverageAudit, phaseModel }),
    precision: evaluatePrecision({ blocks }),
    progression: evaluateProgression({ blocks }),
    professionalism: evaluateProfessionalism({ blocks, laneModel }),
    completeness: evaluateMilestoneCompleteness({ blocks, phaseModel }),
    balance: evaluatePhaseBalance({ blocks, phaseModel, fullHorizonBlockQuality }),
  };

  const aggregateReasonCodes = [
    ...dimensions.pacing.reasonCodes,
    ...dimensions.precision.reasonCodes,
    ...dimensions.progression.reasonCodes,
    ...dimensions.professionalism.reasonCodes,
    ...dimensions.completeness.reasonCodes,
    ...dimensions.balance.reasonCodes,
    ...blockDetailQualitySummary.failureCodes,
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
      dimensions.completeness.score,
      dimensions.balance.score,
    ])
  );

  const aggregateReasonFamilies = [...new Set(aggregateReasonCodes.map((code) => getReasonCodeFamily(code)).filter(Boolean))];
  const detailFailureCount = Number(blockDetailQualitySummary.failureCount || 0);
  const hasSevereDetailFailure = blockDetailQualitySummary.failureCodes.some((code) =>
    [
      'PREMATURE_INITIATIVE_ACTIVATION',
      'DEFERRED_LANE_SCHEDULED_AS_ACTIVE',
      'LONG_HORIZON_LANE_OVERWEIGHTED_IN_P1',
      'PHASE_PRIORITY_MISCLASSIFIED',
      'MISSING_EXPECTED_OUTPUT',
      'MISSING_ACCEPTANCE_EVIDENCE',
    ].includes(String(code || '').trim())
  );

  let state = 'trusted';
  if (!coveragePassed || score < 55) {
    state = 'failed';
  } else if (score < 72 || aggregateReasonFamilies.length >= 5) {
    state = 'degraded';
  } else if (score < 88 || aggregateReasonFamilies.length > 0) {
    state = 'provisional';
  }

  if (detailFailureCount > 0) {
    if (state === 'trusted') {
      state = hasSevereDetailFailure || detailFailureCount > 1 ? 'degraded' : 'provisional';
    } else if (state === 'provisional' && (hasSevereDetailFailure || detailFailureCount > 2)) {
      state = 'degraded';
    }
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

  const mvpStandard = evaluateMvpPlanQualityStandard({
    blocks,
    fullHorizonCoverageAudit,
    dimensions,
    laneModel,
    masterPlanContract,
    anchors,
    blockDetailQualitySummary,
  });
  aggregateReasonCodes.push(...mvpStandard.reasonCodes);

  let standardStatus = mvpStandard.status;
  if (detailFailureCount > 0 && standardStatus === 'trusted_plan') {
    standardStatus = hasSevereDetailFailure || detailFailureCount > 1 ? 'degraded_plan' : 'provisional_plan';
  }

  if (DEBUG_BLOCK_DETAIL_QUALITY) {
    console.log('[fullHorizonPlanQuality] evaluate end', {
      sortedBlockCount: blocks.length,
      detailFailureCount,
      reasonCodeCount: [...new Set(aggregateReasonCodes)].length,
      state,
      standardStatus,
      durationMs: Date.now() - startedAt,
    });
  }

  return {
    state,
    standardStatus,
    mvpStandard: {
      ...mvpStandard,
      status: standardStatus,
    },
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
      blockDetailFailureCount: detailFailureCount,
      blockDetailFailureCodes: blockDetailQualitySummary.failureCodes,
      blockDetailQualityFailures: blockDetailQualitySummary.byBlockId,
      blockDetailFindings: blockDetailQualitySummary.findings,
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
