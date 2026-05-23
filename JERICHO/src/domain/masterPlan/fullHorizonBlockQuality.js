import { validateBlockTitle } from './forecastBlockDerivation.js';

function normalizeDayKey(value) {
  const text = String(value || '').trim();
  return text ? text.slice(0, 10) : null;
}

function parseDayKey(value) {
  const dayKey = normalizeDayKey(value);
  return dayKey ? new Date(`${dayKey}T12:00:00.000Z`) : null;
}

function diffDays(left, right) {
  const leftDate = parseDayKey(left);
  const rightDate = parseDayKey(right);
  if (!leftDate || !rightDate) {
    return 0;
  }
  return Math.round((rightDate.getTime() - leftDate.getTime()) / 86400000);
}

function dayDistanceInclusive(startValue, endValue) {
  const distance = diffDays(startValue, endValue);
  return distance > 0 ? distance + 1 : 0;
}

function getQuarterKey(dayKey) {
  const date = parseDayKey(dayKey);
  if (!date) {
    return null;
  }
  return `${date.getUTCFullYear()}-Q${Math.floor(date.getUTCMonth() / 3) + 1}`;
}

function countBy(items, keyFn) {
  return items.reduce((acc, item) => {
    const key = keyFn(item);
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
}

function collectBlocks(fullHorizonScheduleBlocks = []) {
  return [...(Array.isArray(fullHorizonScheduleBlocks) ? fullHorizonScheduleBlocks : [])]
    .filter((block) => {
      const source = String(block?.source || '').trim().toLowerCase();
      const commitmentState = String(block?.commitmentState || '').trim().toLowerCase();
      const executionEligibility = String(block?.executionEligibility || '').trim().toLowerCase();
      return source === 'derived' || commitmentState === 'forecast' || executionEligibility === 'locked';
    })
    .filter((block) => normalizeDayKey(block?.dayKey || block?.date))
    .sort((left, right) => String(left?.dayKey || left?.date || '').localeCompare(String(right?.dayKey || right?.date || '')));
}

function addIssue(issues, reasonCodes, issue) {
  issues.push(issue);
  reasonCodes.push(issue.code);
}

function issueCountByCode(issues = []) {
  return issues.reduce((acc, issue) => {
    const key = String(issue?.code || 'unknown').trim();
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
}

function getReasonCodeFamilies(reasonCodes = []) {
  return [...new Set(reasonCodes.map((code) => String(code || '').replace(/:(.+)$/, '')).filter(Boolean))];
}

function scoreState(issues, families) {
  const highCount = issues.filter((issue) => issue.severity === 'high').length;
  const mediumCount = issues.filter((issue) => issue.severity === 'medium').length;
  const lowCount = issues.filter((issue) => issue.severity === 'low').length;
  const hasFutureLeak = families.includes('FUTURE_PHASE_EXECUTION_LEAK');
  const score = Math.max(0, 100 - highCount * 12 - mediumCount * 5 - lowCount * 1);

  let state = 'trusted';
  if (!issues.length) {
    state = 'trusted';
  } else if (hasFutureLeak) {
    state = 'withheld';
  } else if (highCount >= 2 || families.length >= 6 || score < 50) {
    state = 'degraded';
  } else {
    state = 'provisional';
  }

  return { state, score };
}

function summarizeBlocks(blocks = []) {
  const blocksMissingExpectedOutput = blocks.filter((block) => !String(block?.expectedOutput || '').trim()).length;
  const blocksMissingLane = blocks.filter((block) => !String(block?.laneId || block?.laneLabel || '').trim()).length;
  const blocksMissingPhase = blocks.filter((block) => !String(block?.phaseLabel || '').trim()).length;
  const blocksMissingSourceInputs = blocks.filter((block) => !Array.isArray(block?.sourceInputs) || block.sourceInputs.length === 0).length;
  const blocksMissingDerivationReason = blocks.filter((block) => !String(block?.derivationReason || '').trim()).length;
  return {
    totalBlocks: blocks.length,
    byPhase: countBy(blocks, (block) => String(block?.phaseLabel || 'unknown').trim() || 'unknown'),
    byYear: countBy(blocks, (block) => String(block?.dayKey || block?.date || '').slice(0, 4) || 'unknown'),
    byQuarter: countBy(blocks, (block) => getQuarterKey(block?.dayKey || block?.date) || 'unknown'),
    byLane: countBy(blocks, (block) => String(block?.laneLabel || block?.laneId || 'unknown').trim() || 'unknown'),
    byBlockType: countBy(blocks, (block) => String(block?.blockType || 'unknown').trim() || 'unknown'),
    blocksWithExpectedOutput: blocks.length - blocksMissingExpectedOutput,
    blocksMissingExpectedOutput,
    blocksMissingLane,
    blocksMissingPhase,
    blocksMissingSourceInputs,
    blocksMissingDerivationReason,
  };
}

const ACTIONABLE_VERBS = [
  'validate',
  'establish',
  'prove',
  'widen',
  'stabilize',
  'formalize',
  'document',
  'convert',
  'institutionalize',
  'prepare',
  'review',
  'compare',
  'audit',
  'assess',
  'reassess',
  'define',
  'plan',
  'design',
  'develop',
  'integrate',
  'secure',
  'sequence',
  'measure',
  'map',
  'package',
  'delegate',
  'expand',
  'gate',
  'ship',
  'launch',
  'stress-test',
  'reconcile',
  'confirm',
];

function isActionableTitle(title) {
  const normalized = String(title || '').trim().toLowerCase();
  if (!normalized) {
    return false;
  }
  return ACTIONABLE_VERBS.some((verb) => normalized.startsWith(`${verb} `));
}

function hasObjectContext(title) {
  return /(conversion|cadence|dashboard|architecture|loop|platform|engine|pipeline|system|bridge|stack|design|path|package|packet|model|handoff|feedback|distribution|readiness|proof|launch|scope|milestone|progress|consistency|capacity|cashflow|compliance|partner|coalition|economics|durability|prerequisite|trajectory|instrumentation|blocker|controls?|evidence|property|dependency gates?)/i.test(
    String(title || '')
  );
}

function analyzePhaseWorkloadCompression(blocks, issues, reasonCodes) {
  const byYear = countBy(blocks, (block) => String(block?.dayKey || block?.date || '').slice(0, 4) || 'unknown');
  const yearCounts = Object.entries(byYear)
    .map(([year, count]) => ({ year, count }))
    .filter((entry) => entry.year !== 'unknown')
    .sort((left, right) => Number(left.year) - Number(right.year));
  if (yearCounts.length < 2) {
    return;
  }
  const peakYearCount = Math.max(...yearCounts.map((entry) => entry.count));
  const terminalYear = yearCounts[yearCounts.length - 1];
  if (peakYearCount > 0 && terminalYear.count / peakYearCount < 0.35) {
    addIssue(issues, reasonCodes, {
      code: 'PHASE_WORKLOAD_COMPRESSION',
      severity: 'medium',
      blockId: null,
      phaseLabel: 'P3',
      laneId: null,
      dayKey: `${terminalYear.year}-01-01`,
      title: 'Terminal year workload compression',
      explanation: `Terminal year ${terminalYear.year} has only ${terminalYear.count} blocks vs peak year ${peakYearCount}.`,
    });
  }
}

function analyzeDuplicateTitleRatioByLanePhase(blocks, issues, reasonCodes) {
  const lanePhaseGroups = blocks.reduce((acc, block) => {
    const laneKey = String(block?.laneId || block?.laneLabel || 'unassigned').trim();
    const phaseLabel = String(block?.phaseLabel || '').trim();
    if (!phaseLabel || !['P2', 'P3'].includes(phaseLabel)) {
      return acc;
    }
    const groupKey = `${laneKey}||${phaseLabel}`;
    if (!acc[groupKey]) {
      acc[groupKey] = { laneKey, phaseLabel, blocks: [] };
    }
    acc[groupKey].blocks.push(block);
    return acc;
  }, {});

  Object.values(lanePhaseGroups).forEach(({ laneKey, phaseLabel, blocks: groupBlocks }) => {
    if (groupBlocks.length < 8) {
      return;
    }
    const familyCounts = countBy(groupBlocks, (block) =>
      String(block?.titleFamily || block?.title || '').trim() || '(untitled family)'
    );
    const largestFamilyCount = Math.max(...Object.values(familyCounts), 0);
    const duplicateRatio = groupBlocks.length > 0 ? largestFamilyCount / groupBlocks.length : 0;
    if (duplicateRatio > 0.4) {
      addIssue(issues, reasonCodes, {
        code: 'DUPLICATE_FORECAST_BLOCK_TITLE_BY_LANE_PHASE',
        severity: 'medium',
        blockId: null,
        phaseLabel,
        laneId: laneKey === 'unassigned' ? null : laneKey,
        dayKey: null,
        title: `${phaseLabel} duplicate titles`,
        explanation: `${phaseLabel} on lane ${laneKey} is dominated by one title family across ${Math.round(duplicateRatio * 100)}% of blocks.`,
      });
    }
  });
}

function analyzePhaseTransitionCompression(blocks, issues, reasonCodes) {
  const blocksByLane = blocks.reduce((acc, block) => {
    const laneKey = String(block?.laneId || block?.laneLabel || 'unassigned').trim();
    if (!laneKey) {
      return acc;
    }
    if (!acc[laneKey]) {
      acc[laneKey] = [];
    }
    acc[laneKey].push(block);
    return acc;
  }, {});

  Object.entries(blocksByLane).forEach(([laneKey, laneBlocks]) => {
    const p2Blocks = laneBlocks
      .filter((block) => String(block?.phaseLabel || '').trim() === 'P2')
      .sort((left, right) => String(normalizeDayKey(left?.dayKey || left?.date || '')).localeCompare(String(normalizeDayKey(right?.dayKey || right?.date || ''))));
    const p3Blocks = laneBlocks
      .filter((block) => String(block?.phaseLabel || '').trim() === 'P3')
      .sort((left, right) => String(normalizeDayKey(left?.dayKey || left?.date || '')).localeCompare(String(normalizeDayKey(right?.dayKey || right?.date || ''))));
    if (!p2Blocks.length || !p3Blocks.length) {
      return;
    }
    const lastP2 = p2Blocks[p2Blocks.length - 1];
    const firstP3 = p3Blocks[0];
    const bufferDays = diffDays(lastP2?.dayKey || lastP2?.date, firstP3?.dayKey || firstP3?.date);
    if (bufferDays >= 0 && bufferDays < 7) {
      addIssue(issues, reasonCodes, {
        code: 'PHASE_TRANSITION_COMPRESSED',
        severity: 'medium',
        blockId: firstP3?.id || null,
        phaseLabel: 'P3',
        laneId: laneKey === 'unassigned' ? null : laneKey,
        dayKey: normalizeDayKey(firstP3?.dayKey || firstP3?.date),
        title: 'Compressed P2→P3 transition',
        explanation: `Last P2 and first P3 blocks on lane ${laneKey} are separated by only ${bufferDays} days.`,
      });
    }
  });
}

function analyzeLanguageAndOwnership(blocks, issues, reasonCodes) {
  const titleCounts = countBy(blocks, (block) => String(block?.title || '').trim());
  Object.entries(titleCounts)
    .filter(([title, count]) => title && count > 12)
    .forEach(([title, count]) => {
      addIssue(issues, reasonCodes, {
        code: 'DUPLICATE_FORECAST_BLOCK_TITLE',
        severity: 'medium',
        blockId: null,
        phaseLabel: null,
        laneId: null,
        dayKey: null,
        title,
        explanation: `${title} repeats ${count} times across the forecast map.`,
      });
    });

  blocks.forEach((block) => {
    const title = String(block?.title || '').trim();
    if (!validateBlockTitle(title) || !isActionableTitle(title)) {
      addIssue(issues, reasonCodes, {
        code: 'BLOCK_TITLE_NOT_ACTIONABLE',
        severity: 'medium',
        blockId: block?.id || null,
        phaseLabel: block?.phaseLabel || null,
        laneId: block?.laneId || null,
        dayKey: normalizeDayKey(block?.dayKey || block?.date),
        title,
        explanation: `Forecast block title is not action-oriented enough: ${title || '(empty title)'}.`,
      });
    }
    if (!hasObjectContext(title)) {
      addIssue(issues, reasonCodes, {
        code: 'BLOCK_OBJECT_UNSPECIFIED',
        severity: 'low',
        blockId: block?.id || null,
        phaseLabel: block?.phaseLabel || null,
        laneId: block?.laneId || null,
        dayKey: normalizeDayKey(block?.dayKey || block?.date),
        title,
        explanation: `Forecast block does not clearly name the object of work: ${title || '(empty title)'}.`,
      });
    }
    if (!String(block?.expectedOutput || '').trim()) {
      addIssue(issues, reasonCodes, {
        code: 'BLOCK_OUTPUT_MISSING',
        severity: 'medium',
        blockId: block?.id || null,
        phaseLabel: block?.phaseLabel || null,
        laneId: block?.laneId || null,
        dayKey: normalizeDayKey(block?.dayKey || block?.date),
        title,
        explanation: `Forecast block is missing expectedOutput: ${title || block?.id || '(unknown block)'}.`,
      });
    }
    if (!String(block?.laneId || block?.laneLabel || '').trim()) {
      addIssue(issues, reasonCodes, {
        code: 'BLOCK_LANE_MISSING',
        severity: 'medium',
        blockId: block?.id || null,
        phaseLabel: block?.phaseLabel || null,
        laneId: null,
        dayKey: normalizeDayKey(block?.dayKey || block?.date),
        title,
        explanation: `Forecast block is missing lane ownership: ${title || block?.id || '(unknown block)'}.`,
      });
    }
    if (!String(block?.phaseLabel || '').trim()) {
      addIssue(issues, reasonCodes, {
        code: 'BLOCK_PHASE_MISSING',
        severity: 'medium',
        blockId: block?.id || null,
        phaseLabel: null,
        laneId: block?.laneId || null,
        dayKey: normalizeDayKey(block?.dayKey || block?.date),
        title,
        explanation: `Forecast block is missing phase ownership: ${title || block?.id || '(unknown block)'}.`,
      });
    }
  });
}

function analyzePhaseUnlockCriteria(blocks, issues, reasonCodes) {
  const counted = blocks.filter((block) => {
    const phaseLabel = String(block?.phaseLabel || '').trim();
    return phaseLabel === 'P2' || phaseLabel === 'P3';
  });
  const unresolved = counted.filter((block) => {
    const dependsOn = Array.isArray(block?.dependsOn) ? block.dependsOn : [];
    const dependencyStatus = String(block?.dependencyStatus || '').trim().toLowerCase();
    return dependsOn.length === 0 && !dependencyStatus;
  });
  if (unresolved.length > 0) {
    addIssue(issues, reasonCodes, {
      code: 'PHASE_UNLOCK_CRITERIA_THIN',
      severity: 'high',
      blockId: null,
      phaseLabel: null,
      laneId: null,
      dayKey: null,
      title: 'Thin phase unlock criteria',
      explanation: `${unresolved.length} P2/P3 blocks lack explicit dependency or unlock criteria markers.`,
    });
  }
}

function analyzeTemporalSpacing(blocks, phaseModel, issues, reasonCodes) {
  const byPhase = Array.isArray(phaseModel?.phases) ? phaseModel.phases : [];
  byPhase.forEach((phase) => {
    const label = String(phase?.label || '').trim();
    if (!label) {
      return;
    }
    const phaseBlocks = blocks.filter((block) => String(block?.phaseLabel || '').trim() === label);
    if (!phaseBlocks.length) {
      return;
    }
    const phaseStart = normalizeDayKey(phase?.startBoundary || phase?.startDayKey);
    const phaseEnd = normalizeDayKey(phase?.endBoundary || phase?.endDayKey);
    const durationDays = dayDistanceInclusive(phaseStart, phaseEnd);
    const dates = phaseBlocks.map((block) => normalizeDayKey(block?.dayKey || block?.date)).filter(Boolean);
    const uniqueDates = [...new Set(dates)];
    for (let index = 1; index < uniqueDates.length; index += 1) {
      const gapDays = diffDays(uniqueDates[index - 1], uniqueDates[index]);
      if (gapDays > Math.max(45, Math.round(durationDays * 0.12))) {
        addIssue(issues, reasonCodes, {
          code: 'LONG_HORIZON_TEMPORAL_GAP',
          severity: 'medium',
          blockId: null,
          phaseLabel: label,
          laneId: null,
          dayKey: uniqueDates[index - 1],
          title: `${label} temporal gap`,
          explanation: `${label} has a ${gapDays}-day block gap between ${uniqueDates[index - 1]} and ${uniqueDates[index]}.`,
        });
        break;
      }
    }

    if (phaseStart && durationDays > 0) {
      const first30End = parseDayKey(phaseStart);
      if (first30End) {
        first30End.setUTCDate(first30End.getUTCDate() + 30);
        const boundary = first30End.toISOString().slice(0, 10);
        const hasEarlyPreparation = phaseBlocks.some((block) => normalizeDayKey(block?.dayKey || block?.date) <= boundary);
        if (!hasEarlyPreparation && label !== 'P1') {
          addIssue(issues, reasonCodes, {
            code: 'PHASE_TRANSITION_UNPREPARED',
            severity: 'medium',
            blockId: null,
            phaseLabel: label,
            laneId: null,
            dayKey: phaseStart,
            title: `${label} phase transition`,
            explanation: `${label} begins without preparation blocks in its first 30 days.`,
          });
        }
      }
    }

    if (phaseEnd && durationDays > 0) {
      const lateThresholdDate = parseDayKey(phaseEnd);
      if (lateThresholdDate) {
        lateThresholdDate.setUTCDate(lateThresholdDate.getUTCDate() - Math.max(30, Math.round(durationDays * 0.2)));
        const threshold = lateThresholdDate.toISOString().slice(0, 10);
        const terminalBlocks = phaseBlocks.filter((block) =>
          /terminal|readiness|evidence|review/i.test(`${block?.title || ''} ${block?.expectedOutput || ''} ${block?.blockType || ''}`)
        );
        if (label === 'P3' && terminalBlocks.length > 0) {
          const lateTerminalCount = terminalBlocks.filter((block) => normalizeDayKey(block?.dayKey || block?.date) >= threshold).length;
          if (lateTerminalCount / terminalBlocks.length > 0.8) {
            addIssue(issues, reasonCodes, {
              code: 'TERMINAL_READINESS_CLUSTERED_TOO_LATE',
              severity: 'medium',
              blockId: null,
              phaseLabel: label,
              laneId: null,
              dayKey: threshold,
              title: 'Terminal readiness clustering',
              explanation: `P3 terminal-readiness work is clustered too late in the phase window.`,
            });
          }
        }
      }
    }
  });
}

function analyzePrioritization(blocks, issues, reasonCodes) {
  const firstByMatch = (predicate) =>
    blocks.find((block) => predicate(`${block?.title || ''} ${block?.expectedOutput || ''} ${block?.laneLabel || ''}`.toLowerCase()));

  const firstConversion = firstByMatch((text) => /conversion|revenue architecture|repeatable conversion|operating cadence|feedback loop/.test(text));
  const firstCapital = firstByMatch((text) => /capital|real estate|asset-path|capital readiness/.test(text));
  if (firstCapital && firstConversion && normalizeDayKey(firstCapital?.dayKey) < normalizeDayKey(firstConversion?.dayKey)) {
    addIssue(issues, reasonCodes, {
      code: 'CAPITAL_BEFORE_CONVERSION_EVIDENCE',
      severity: 'high',
      blockId: firstCapital?.id || null,
      phaseLabel: firstCapital?.phaseLabel || null,
      laneId: firstCapital?.laneId || null,
      dayKey: normalizeDayKey(firstCapital?.dayKey || firstCapital?.date),
      title: firstCapital?.title || 'Capital sequencing',
      explanation: 'Capital-readiness work appears before conversion evidence is established.',
    });
  }

  const firstDistribution = firstByMatch((text) => /distribution|widen channel|audience expansion/.test(text));
  const firstOffer = firstByMatch((text) => /offer|conversion|feedback loop|revenue architecture/.test(text));
  if (firstDistribution && firstOffer && normalizeDayKey(firstDistribution?.dayKey) < normalizeDayKey(firstOffer?.dayKey)) {
    addIssue(issues, reasonCodes, {
      code: 'DISTRIBUTION_BEFORE_OFFER_CLARITY',
      severity: 'medium',
      blockId: firstDistribution?.id || null,
      phaseLabel: firstDistribution?.phaseLabel || null,
      laneId: firstDistribution?.laneId || null,
      dayKey: normalizeDayKey(firstDistribution?.dayKey || firstDistribution?.date),
      title: firstDistribution?.title || 'Distribution sequencing',
      explanation: 'Distribution expansion appears before conversion or offer clarity is established.',
    });
  }

  const firstScale = firstByMatch((text) => /scale|terminal readiness|delegation|institutional/.test(text));
  const firstProof = firstByMatch((text) => /proof|launch proof|convergence|conversion path/.test(text));
  if (firstScale && firstProof && normalizeDayKey(firstScale?.dayKey) < normalizeDayKey(firstProof?.dayKey)) {
    addIssue(issues, reasonCodes, {
      code: 'SCALE_BEFORE_PROOF',
      severity: 'high',
      blockId: firstScale?.id || null,
      phaseLabel: firstScale?.phaseLabel || null,
      laneId: firstScale?.laneId || null,
      dayKey: normalizeDayKey(firstScale?.dayKey || firstScale?.date),
      title: firstScale?.title || 'Scale sequencing',
      explanation: 'Scale or terminal-readiness work appears before proof substrate is established.',
    });
  }
}

function analyzePhaseUnlockIntegrity(blocks, issues, reasonCodes) {
  blocks.forEach((block) => {
    const phaseLabel = String(block?.phaseLabel || '').trim();
    if (phaseLabel && phaseLabel !== 'P1' && String(block?.executionEligibility || '').trim() !== 'locked') {
      addIssue(issues, reasonCodes, {
        code: 'FUTURE_PHASE_EXECUTION_LEAK',
        severity: 'high',
        blockId: block?.id || null,
        phaseLabel,
        laneId: block?.laneId || null,
        dayKey: normalizeDayKey(block?.dayKey || block?.date),
        title: block?.title || '(future block)',
        explanation: `${phaseLabel} block is visible as future work but not locked from execution.`,
      });
    }
  });
}

export function evaluateFullHorizonBlockQuality({
  fullHorizonScheduleBlocks = [],
  phaseModel = null,
} = {}) {
  const blocks = collectBlocks(fullHorizonScheduleBlocks);
  if (!blocks.length) {
    return {
      state: 'withheld',
      score: 0,
      reasonCodes: ['FULL_HORIZON_BLOCKS_UNAVAILABLE'],
      summary: {
        totalBlocks: 0,
        byPhase: {},
        byYear: {},
        byQuarter: {},
        byLane: {},
        byBlockType: {},
        issueCounts: {},
      },
      issues: [],
    };
  }

  const issues = [];
  const reasonCodes = [];

  analyzeLanguageAndOwnership(blocks, issues, reasonCodes);
  analyzeDuplicateTitleRatioByLanePhase(blocks, issues, reasonCodes);
  analyzePhaseTransitionCompression(blocks, issues, reasonCodes);
  analyzePhaseWorkloadCompression(blocks, issues, reasonCodes);
  analyzePhaseUnlockCriteria(blocks, issues, reasonCodes);
  analyzeTemporalSpacing(blocks, phaseModel, issues, reasonCodes);
  analyzePrioritization(blocks, issues, reasonCodes);
  analyzePhaseUnlockIntegrity(blocks, issues, reasonCodes);

  const uniqueReasonCodes = [...new Set(reasonCodes)];
  const families = getReasonCodeFamilies(uniqueReasonCodes);
  const { state, score } = scoreState(issues, families);

  return {
    state,
    score,
    reasonCodes: uniqueReasonCodes,
    summary: {
      ...summarizeBlocks(blocks),
      issueCounts: issueCountByCode(issues),
    },
    issues,
  };
}

export function getFullHorizonBlockQualityLabel(blockQuality = null) {
  const state = String(blockQuality?.state || '').trim().toLowerCase();
  if (state === 'trusted') {
    return 'Forecast block quality trusted';
  }
  if (state === 'provisional') {
    return 'Forecast block quality provisional';
  }
  if (state === 'degraded') {
    return 'Forecast block quality degraded';
  }
  if (state === 'withheld') {
    return 'Forecast block quality withheld';
  }
  return 'Forecast block quality unavailable';
}

export function getFullHorizonBlockQualityTone(blockQuality = null) {
  const state = String(blockQuality?.state || '').trim().toLowerCase();
  if (state === 'trusted') {
    return 'positive';
  }
  if (state === 'provisional') {
    return 'warning';
  }
  if (state === 'degraded' || state === 'withheld') {
    return 'critical';
  }
  return 'muted';
}

export default evaluateFullHorizonBlockQuality;
