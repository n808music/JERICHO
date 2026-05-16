function normalizeDayKey(value) {
  const text = String(value || '').trim();
  return text ? text.slice(0, 10) : null;
}

function parseDayKey(value) {
  const dayKey = normalizeDayKey(value);
  return dayKey ? new Date(`${dayKey}T12:00:00.000Z`) : null;
}

function addDays(dayKey, days) {
  const date = parseDayKey(dayKey);
  if (!date) {
    return null;
  }
  date.setUTCDate(date.getUTCDate() + Number(days || 0));
  return date.toISOString().slice(0, 10);
}

function diffDaysInclusive(startValue, endValue) {
  const start = parseDayKey(startValue);
  const end = parseDayKey(endValue);
  if (!start || !end) {
    return 0;
  }
  return Math.max(1, Math.round((end.getTime() - start.getTime()) / 86400000) + 1);
}

function enumerateYears(startValue, endValue) {
  const start = parseDayKey(startValue);
  const end = parseDayKey(endValue);
  if (!start || !end || start > end) {
    return [];
  }
  const years = [];
  for (let year = start.getUTCFullYear(); year <= end.getUTCFullYear(); year += 1) {
    years.push(String(year));
  }
  return years;
}

function buildYearBounds(year, startValue, endValue) {
  const startYear = String(year);
  const yearStart = `${startYear}-01-01`;
  const yearEnd = `${startYear}-12-31`;
  const boundedStart = normalizeDayKey(startValue) > yearStart ? normalizeDayKey(startValue) : yearStart;
  const boundedEnd = normalizeDayKey(endValue) < yearEnd ? normalizeDayKey(endValue) : yearEnd;
  if (!boundedStart || !boundedEnd || boundedStart > boundedEnd) {
    return null;
  }
  return { start: boundedStart, end: boundedEnd };
}

function countMonthsInRange(startValue, endValue) {
  const start = parseDayKey(startValue);
  const end = parseDayKey(endValue);
  if (!start || !end || start > end) {
    return 0;
  }
  return (end.getUTCFullYear() - start.getUTCFullYear()) * 12 + (end.getUTCMonth() - start.getUTCMonth()) + 1;
}

function getMeaningfulBlocks(fullHorizonScheduleBlocks = []) {
  return [...(Array.isArray(fullHorizonScheduleBlocks) ? fullHorizonScheduleBlocks : [])]
    .filter((block) => normalizeDayKey(block?.dayKey || block?.date) && String(block?.title || '').trim())
    .sort((left, right) => String(left?.dayKey || left?.date || '').localeCompare(String(right?.dayKey || right?.date || '')));
}

function summarizeBlockTypes(blocks = []) {
  return blocks.reduce((acc, block) => {
    const key = String(block?.blockType || 'unknown').trim() || 'unknown';
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
}

function summarizeLanes(blocks = []) {
  return [...new Set(blocks.map((block) => String(block?.laneId || block?.laneLabel || '').trim()).filter(Boolean))];
}

function getRequiredTypesForP3() {
  return new Set(['review', 'audit', 'readiness', 'terminal-readiness']);
}

function evaluateDensityTrend(years, coverageByYear) {
  const counts = years.map((year) => Number(coverageByYear?.[year]?.blockCount || 0));
  let state = 'stable';
  const reasonCodes = [];
  for (let index = 1; index < counts.length; index += 1) {
    const previous = counts[index - 1];
    const current = counts[index];
    const previousYear = years[index - 1];
    const currentYear = years[index];
    if (previous >= 12 && current <= Math.max(2, Math.floor(previous * 0.25))) {
      state = 'collapsed';
      reasonCodes.push(`LATE_HORIZON_DENSITY_COLLAPSE:${previousYear}->${currentYear}`);
      break;
    }
    if (previous > 0 && current < previous) {
      state = state === 'stable' ? 'tapering' : state;
    }
  }
  return { state, countsByYear: Object.fromEntries(years.map((year, index) => [year, counts[index]])), reasonCodes };
}

export function auditFullHorizonCoverage({
  fullHorizonScheduleBlocks = [],
  phaseModel = null,
  fullHorizonStartDayKey = null,
  fullHorizonEndDayKey = null,
  laneModel = [],
  selectedHorizonMode = null,
} = {}) {
  const startDayKey = normalizeDayKey(fullHorizonStartDayKey);
  const endDayKey = normalizeDayKey(fullHorizonEndDayKey);
  const meaningfulBlocks = getMeaningfulBlocks(fullHorizonScheduleBlocks);
  const years = enumerateYears(startDayKey, endDayKey);
  const firstMeaningfulWorkDate = normalizeDayKey(meaningfulBlocks[0]?.dayKey || meaningfulBlocks[0]?.date);
  const lastMeaningfulWorkDate = normalizeDayKey(
    meaningfulBlocks[meaningfulBlocks.length - 1]?.dayKey || meaningfulBlocks[meaningfulBlocks.length - 1]?.date
  );
  const reasonCodes = [];

  const horizonResolved = Boolean(startDayKey && endDayKey && startDayKey <= endDayKey);
  const horizonExpanded = Boolean(
    meaningfulBlocks.length > 0 &&
      (new Set(meaningfulBlocks.map((block) => String(block?.phaseLabel || '').trim()).filter(Boolean)).size > 1 ||
        new Set(meaningfulBlocks.map((block) => String(block?.dayKey || '').slice(0, 4)).filter(Boolean)).size > 1)
  );

  const coverageByYear = Object.fromEntries(
    years.map((year) => {
      const bounds = buildYearBounds(year, startDayKey, endDayKey);
      const blocks = meaningfulBlocks.filter((block) => String(block?.dayKey || '').startsWith(`${year}-`));
      const minExpectedCount = bounds ? Math.max(1, Math.ceil(countMonthsInRange(bounds.start, bounds.end) / 4)) : 0;
      const firstDayKey = normalizeDayKey(blocks[0]?.dayKey || blocks[0]?.date);
      const lastDayKey = normalizeDayKey(blocks[blocks.length - 1]?.dayKey || blocks[blocks.length - 1]?.date);
      const covered = blocks.length >= minExpectedCount;
      return [
        year,
        {
          year,
          startDayKey: bounds?.start || null,
          endDayKey: bounds?.end || null,
          blockCount: blocks.length,
          minExpectedCount,
          firstDayKey,
          lastDayKey,
          laneCount: summarizeLanes(blocks).length,
          blockTypeCounts: summarizeBlockTypes(blocks),
          covered,
        },
      ];
    })
  );

  const phases = Array.isArray(phaseModel?.phases) ? phaseModel.phases : [];
  const coverageByPhase = Object.fromEntries(
    phases.map((phase) => {
      const label = String(phase?.label || phase?.title || '').trim() || String(phase?.id || 'phase');
      const phaseStart = normalizeDayKey(phase?.startBoundary || phase?.startDayKey || startDayKey);
      const phaseEnd = normalizeDayKey(phase?.endBoundary || phase?.endDayKey || endDayKey);
      const phaseBlocks = meaningfulBlocks.filter((block) => String(block?.phaseLabel || '').trim() === label);
      const typeCounts = summarizeBlockTypes(phaseBlocks);
      const minExpectedCount =
        label === 'P1'
          ? 12
          : label === 'P2'
            ? 10
            : label === 'P3'
              ? Math.max(6, Math.ceil(countMonthsInRange(phaseStart, phaseEnd) / 2))
              : 1;
      const covered = phaseBlocks.length >= minExpectedCount;
      return [
        label,
        {
          phaseId: phase?.id || null,
          phaseLabel: label,
          startDayKey: phaseStart,
          endDayKey: phaseEnd,
          blockCount: phaseBlocks.length,
          minExpectedCount,
          firstDayKey: normalizeDayKey(phaseBlocks[0]?.dayKey || phaseBlocks[0]?.date),
          lastDayKey: normalizeDayKey(phaseBlocks[phaseBlocks.length - 1]?.dayKey || phaseBlocks[phaseBlocks.length - 1]?.date),
          laneCount: summarizeLanes(phaseBlocks).length,
          blockTypeCounts: typeCounts,
          covered,
        },
      ];
    })
  );

  if (!horizonResolved) {
    reasonCodes.push('HORIZON_RESOLUTION_MISSING');
  }

  if (horizonResolved && !horizonExpanded) {
    reasonCodes.push('FULL_HORIZON_COVERAGE_INCOMPLETE');
    reasonCodes.push('HORIZON_RESOLVED_BUT_NOT_COVERED');
  }

  const terminalCoverageDate = lastMeaningfulWorkDate;
  const terminalGapDays =
    horizonResolved && lastMeaningfulWorkDate ? diffDaysInclusive(lastMeaningfulWorkDate, endDayKey) - 1 : null;
  if (horizonResolved && (!lastMeaningfulWorkDate || terminalGapDays > 45)) {
    reasonCodes.push('FULL_HORIZON_WORK_STOPS_BEFORE_TERMINAL_DATE');
    reasonCodes.push('FULL_HORIZON_COVERAGE_INCOMPLETE');
  }

  years.forEach((year) => {
    if (!coverageByYear[year]?.covered) {
      reasonCodes.push(`YEAR_COVERAGE_GAP:${year}`);
      reasonCodes.push('YEAR_COVERAGE_GAP');
      reasonCodes.push('FULL_HORIZON_COVERAGE_INCOMPLETE');
    }
  });

  ['P1', 'P2', 'P3'].forEach((label) => {
    if (coverageByPhase[label] && !coverageByPhase[label].covered) {
      reasonCodes.push(`PHASE_COVERAGE_GAP:${label}`);
      reasonCodes.push('FULL_HORIZON_COVERAGE_INCOMPLETE');
    }
  });

  const p3Coverage = coverageByPhase.P3 || null;
  if (p3Coverage) {
    const p3Types = new Set(Object.keys(p3Coverage.blockTypeCounts || {}));
    const requiredP3Types = getRequiredTypesForP3();
    const missingP3Types = [...requiredP3Types].filter((type) => !p3Types.has(type));
    if (missingP3Types.length > 0 || p3Coverage.blockCount < p3Coverage.minExpectedCount) {
      reasonCodes.push('P3_TERMINAL_HORIZON_UNDERPOPULATED');
      reasonCodes.push('FULL_HORIZON_COVERAGE_INCOMPLETE');
    }
  }

  const densityTrend = evaluateDensityTrend(years, coverageByYear);
  if (densityTrend.state === 'collapsed') {
    reasonCodes.push('LATE_HORIZON_DENSITY_COLLAPSE');
    reasonCodes.push('FULL_HORIZON_COVERAGE_INCOMPLETE');
  }

  if (horizonResolved && !reasonCodes.includes('FULL_HORIZON_WORK_STOPS_BEFORE_TERMINAL_DATE') && terminalGapDays > 0) {
    const finalYear = String(parseDayKey(endDayKey)?.getUTCFullYear() || '');
    const finalYearCount = Number(coverageByYear?.[finalYear]?.blockCount || 0);
    if (finalYearCount <= 1) {
      reasonCodes.push('LATE_HORIZON_DENSITY_COLLAPSE');
      reasonCodes.push('FULL_HORIZON_COVERAGE_INCOMPLETE');
    }
  }

  const uniqueReasonCodes = [...new Set(reasonCodes)];
  const fullHorizonCovered =
    horizonResolved &&
    horizonExpanded &&
    uniqueReasonCodes.every(
      (code) =>
        ![
          'FULL_HORIZON_COVERAGE_INCOMPLETE',
          'FULL_HORIZON_WORK_STOPS_BEFORE_TERMINAL_DATE',
          'P3_TERMINAL_HORIZON_UNDERPOPULATED',
          'YEAR_COVERAGE_GAP',
          'LATE_HORIZON_DENSITY_COLLAPSE',
          'HORIZON_RESOLVED_BUT_NOT_COVERED',
          'EXPANSION_RENDERED_BUT_TERMINAL_COVERAGE_MISSING',
        ].includes(code)
    );
  const fullHorizonQualityTrusted = fullHorizonCovered && densityTrend.state !== 'collapsed';

  if (!fullHorizonCovered && horizonResolved) {
    uniqueReasonCodes.push('COVERAGE_BADGE_PREMATURE');
  }
  if (!fullHorizonCovered && horizonResolved) {
    uniqueReasonCodes.push('HORIZON_RESOLVED_BUT_NOT_COVERED');
  }
  if (!fullHorizonCovered && horizonExpanded) {
    uniqueReasonCodes.push('EXPANSION_RENDERED_BUT_TERMINAL_COVERAGE_MISSING');
  }

  return {
    horizonResolved,
    horizonExpanded,
    fullHorizonCovered,
    fullHorizonQualityTrusted,
    terminalCoverageDate,
    expectedTerminalDate: endDayKey,
    firstMeaningfulWorkDate,
    lastMeaningfulWorkDate,
    coverageByYear,
    coverageByPhase,
    densityTrend,
    selectedHorizonMode: String(selectedHorizonMode || '').trim() || null,
    activeLaneCount: Array.isArray(laneModel) ? laneModel.length : 0,
    reasonCodes: [...new Set(uniqueReasonCodes)],
  };
}

export function getFullHorizonCoverageLabel(audit = null) {
  if (audit?.fullHorizonQualityTrusted) {
    return 'Full horizon quality trusted';
  }
  if (audit?.fullHorizonCovered) {
    return 'Full horizon covered';
  }
  if (audit?.horizonExpanded && audit?.reasonCodes?.includes('FULL_HORIZON_WORK_STOPS_BEFORE_TERMINAL_DATE')) {
    return 'Terminal coverage incomplete';
  }
  if (audit?.horizonExpanded) {
    return 'Partial long-horizon coverage';
  }
  if (audit?.horizonResolved) {
    return 'Horizon resolved';
  }
  return 'Horizon unresolved';
}

export function getFullHorizonCoverageTone(audit = null) {
  if (audit?.fullHorizonQualityTrusted || audit?.fullHorizonCovered) {
    return 'positive';
  }
  if (audit?.horizonExpanded || audit?.horizonResolved) {
    return 'warning';
  }
  return 'muted';
}

export default auditFullHorizonCoverage;
