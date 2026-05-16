import { dayKeyFromISO } from '../../state/time/time.ts';
import { getMonthStats } from '../../state/time/viewAggregates.ts';
import { getMonthDayKeys } from '../../state/time/window.ts';

function normalizeDayKey(value) {
  const text = String(value || '').trim();
  return text ? text.slice(0, 10) : null;
}

function getBlockDayKey(block, timeZone = 'UTC') {
  return normalizeDayKey(block?.dayKey || block?.date || dayKeyFromISO(block?.startISO || block?.start || '', timeZone));
}

function countByYear(blocks = [], years = []) {
  return Object.fromEntries(
    years.map((year) => [
      year,
      (Array.isArray(blocks) ? blocks : []).filter((block) => String(getBlockDayKey(block) || '').slice(0, 4) === year).length,
    ])
  );
}

function countByPhase(blocks = [], labels = ['P1', 'P2', 'P3']) {
  return Object.fromEntries(
    labels.map((label) => [
      label,
      (Array.isArray(blocks) ? blocks : []).filter((block) => String(block?.phaseLabel || '').trim() === label).length,
    ])
  );
}

function summarizeSource(name, blocks = [], years = []) {
  const normalizedBlocks = Array.isArray(blocks) ? blocks : [];
  const dayKeys = normalizedBlocks.map((block) => getBlockDayKey(block)).filter(Boolean).sort((left, right) => left.localeCompare(right));
  return {
    name,
    total: normalizedBlocks.length,
    countByYear: countByYear(normalizedBlocks, years),
    countByPhase: countByPhase(normalizedBlocks),
    lastDayKey: dayKeys[dayKeys.length - 1] || null,
  };
}

function buildTodayYearProjection(blocks = [], years = [], timeZone = 'UTC') {
  const dayMap = new Map();
  (Array.isArray(blocks) ? blocks : []).forEach((block) => {
    const dayKey = getBlockDayKey(block, timeZone);
    if (!dayKey) {
      return;
    }
    if (!dayMap.has(dayKey)) {
      dayMap.set(dayKey, []);
    }
    dayMap.get(dayKey).push(block);
  });

  return Object.fromEntries(
    years.map((year) => {
      const months = Object.fromEntries(
        Array.from({ length: 12 }, (_, index) => {
          const month = String(index + 1).padStart(2, '0');
          const monthKey = `${year}-${month}-01`;
          const monthDays = getMonthDayKeys(monthKey, timeZone).filter((dayKey) => dayKey.slice(0, 7) === `${year}-${month}`);
          const stats = getMonthStats(monthDays, dayMap);
          return [`${year}-${month}`, stats.plannedCount];
        })
      );
      return [year, months];
    })
  );
}

function resolveActiveContract(state = {}) {
  const activeCycleId = String(state?.activeCycleId || '').trim();
  const activeCycle = activeCycleId ? state?.cyclesById?.[activeCycleId] || null : null;
  return {
    activeCycleId: activeCycleId || null,
    activeCycle,
    contract: activeCycle?.goalContract || state?.goalExecutionContract || null,
  };
}

function filterToWindow(blocks = [], { startDayKey = null, endDayKey = null, timeZone = 'UTC' } = {}) {
  return (Array.isArray(blocks) ? blocks : []).filter((block) => {
    const dayKey = getBlockDayKey(block, timeZone);
    if (!dayKey) {
      return false;
    }
    if (startDayKey && dayKey < startDayKey) {
      return false;
    }
    if (endDayKey && dayKey > endDayKey) {
      return false;
    }
    return true;
  });
}

export function auditFullHorizonRenderTruth({
  state = {},
  fullHorizonScheduleBlocks = state?.fullHorizonScheduleBlocks || [],
  calendarDisplayBlocks = state?.calendarDisplayBlocks || [],
  selectedHorizonMode = state?.selectedHorizonMode || 'current_cycle',
  timeZone = state?.appTime?.timeZone || 'UTC',
} = {}) {
  const years = ['2026', '2027', '2028', '2029', '2030', '2031'];
  const { activeCycleId, activeCycle, contract } = resolveActiveContract(state);
  const contractStartDayKey = normalizeDayKey(
    contract?.startDayKey || contract?.startDateISO || contract?.startDate || activeCycle?.startedAtDayKey || null
  );
  const contractDeadlineDayKey = normalizeDayKey(
    contract?.endDayKey || contract?.deadlineDayKey || contract?.deadlineISO || activeCycle?.definiteGoal?.deadlineDayKey || null
  );
  const horizonDisplayEndDayKey =
    normalizeDayKey(
      (Array.isArray(calendarDisplayBlocks) ? calendarDisplayBlocks : [])
        .map((block) => getBlockDayKey(block, timeZone))
        .filter(Boolean)
        .sort((left, right) => left.localeCompare(right))
        .pop()
    ) || contractDeadlineDayKey;

  const todayYearProjectionSourceBlocks =
    String(selectedHorizonMode || '').trim() === 'current_cycle'
      ? []
      : filterToWindow(calendarDisplayBlocks, {
          startDayKey: contractStartDayKey,
          endDayKey: horizonDisplayEndDayKey,
          timeZone,
        });
  const todayMonthProjectionSourceBlocks = todayYearProjectionSourceBlocks;
  const structureDeliverablesSourceBlocks =
    String(selectedHorizonMode || '').trim() === 'current_cycle'
      ? []
      : filterToWindow(fullHorizonScheduleBlocks, {
          startDayKey: contractStartDayKey,
          endDayKey: horizonDisplayEndDayKey,
          timeZone,
        });
  const planOverviewSourceBlocks = structureDeliverablesSourceBlocks;

  const summaries = {
    fullHorizonScheduleBlocks: summarizeSource('fullHorizonScheduleBlocks', fullHorizonScheduleBlocks, years),
    calendarDisplayBlocks: summarizeSource('calendarDisplayBlocks', calendarDisplayBlocks, years),
    todayYearProjectionSource: summarizeSource('todayYearProjectionSource', todayYearProjectionSourceBlocks, years),
    todayMonthProjectionSource: summarizeSource('todayMonthProjectionSource', todayMonthProjectionSourceBlocks, years),
    structureDeliverablesSource: summarizeSource('structureDeliverablesSource', structureDeliverablesSourceBlocks, years),
    planOverviewSource: summarizeSource('planOverviewSource', planOverviewSourceBlocks, years),
  };

  const yearProjection = buildTodayYearProjection(todayYearProjectionSourceBlocks, years, timeZone);
  const reasonCodes = [];
  const substrateTerminalYearsPresent =
    Number(summaries.fullHorizonScheduleBlocks.countByYear['2030'] || 0) > 0 &&
    Number(summaries.fullHorizonScheduleBlocks.countByYear['2031'] || 0) > 0;

  if (substrateTerminalYearsPresent) {
    const renderSources = [
      summaries.calendarDisplayBlocks,
      summaries.todayYearProjectionSource,
      summaries.structureDeliverablesSource,
      summaries.planOverviewSource,
    ];
    const hasTerminalRenderGap = renderSources.some(
      (source) => Number(source.countByYear['2030'] || 0) === 0 || Number(source.countByYear['2031'] || 0) === 0
    );
    if (hasTerminalRenderGap) {
      reasonCodes.push('COVERAGE_AUDIT_RENDER_SOURCE_MISMATCH');
      reasonCodes.push('TERMINAL_YEAR_RENDER_GAP');
      reasonCodes.push('FULL_HORIZON_BADGE_RENDER_CONTRADICTION');
    }
    const p3RenderedCount = Number(summaries.todayYearProjectionSource.countByPhase.P3 || 0);
    if (p3RenderedCount === 0 && Number(summaries.fullHorizonScheduleBlocks.countByPhase.P3 || 0) > 0) {
      reasonCodes.push('P3_RENDERED_WORK_MISSING');
      reasonCodes.push('FULL_HORIZON_BADGE_RENDER_CONTRADICTION');
    }
  }

  return {
    selectedHorizonMode: String(selectedHorizonMode || '').trim() || null,
    activeCycleId,
    scheduleStatus: String(activeCycle?.scheduleLifecycle || state?.scheduleLifecycle || '').trim() || 'unknown',
    contractStartDayKey,
    contractDeadlineDayKey,
    horizonDisplayEndDayKey,
    sources: summaries,
    todayYearProjection: yearProjection,
    reasonCodes: [...new Set(reasonCodes)],
  };
}

export function applyRenderTruthToCoverageAudit(coverageAudit = null, renderTruthAudit = null) {
  if (!coverageAudit) {
    return coverageAudit;
  }
  const reasonCodes = [
    ...new Set([...(coverageAudit?.reasonCodes || []), ...(renderTruthAudit?.reasonCodes || [])]),
  ];
  const hasRenderContradiction = reasonCodes.some((code) =>
    [
      'COVERAGE_AUDIT_RENDER_SOURCE_MISMATCH',
      'TERMINAL_YEAR_RENDER_GAP',
      'P3_RENDERED_WORK_MISSING',
      'FULL_HORIZON_BADGE_RENDER_CONTRADICTION',
    ].includes(code)
  );
  return {
    ...coverageAudit,
    fullHorizonCovered: hasRenderContradiction ? false : Boolean(coverageAudit.fullHorizonCovered),
    fullHorizonQualityTrusted:
      hasRenderContradiction ? false : Boolean(coverageAudit.fullHorizonQualityTrusted),
    reasonCodes,
    renderTruth: renderTruthAudit || null,
  };
}

export default auditFullHorizonRenderTruth;
