function normalizeDayKey(value) {
  const normalized = String(value || '').trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(normalized) ? normalized : null;
}

function buildQuarterKey(dayKey) {
  const normalized = normalizeDayKey(dayKey);
  if (!normalized) {
    return null;
  }
  const [year, month] = normalized.split('-');
  const quarter = Math.floor((Number(month) - 1) / 3) + 1;
  return `${year}-Q${quarter}`;
}

function hashString(value) {
  const input = String(value || '');
  let hash = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return Math.abs(hash >>> 0).toString(16).padStart(8, '0');
}

function summarizeWorkWindows(workWindows = {}) {
  const entries = Object.entries(workWindows || {});
  const activeDays = entries.filter(([, windows]) => Array.isArray(windows) && windows.length > 0);
  const totalWindows = activeDays.reduce((sum, [, windows]) => sum + windows.length, 0);
  return {
    activeDayCount: activeDays.length,
    totalWindows,
    days: Object.fromEntries(
      activeDays.map(([day, windows]) => [
        day,
        windows.map((window) => `${window.start || '00:00'}-${window.end || '00:00'}`),
      ])
    ),
  };
}

function buildConstraintHash({ officialStartDayKey, weeklyCapacityMinutes, workWindowSummary, source, masterCalendarId }) {
  return hashString(
    JSON.stringify({
      officialStartDayKey: normalizeDayKey(officialStartDayKey),
      weeklyCapacityMinutes: Number(weeklyCapacityMinutes) || 0,
      workWindowSummary,
      source: String(source || ''),
      masterCalendarId: String(masterCalendarId || ''),
    })
  );
}

function buildBlockHash(blocks = []) {
  return hashString(
    JSON.stringify(
      blocks.map((block) => ({
        id: String(block?.id || ''),
        dayKey: normalizeDayKey(block?.dayKey || block?.date),
        phaseLabel: String(block?.phaseLabel || ''),
        laneId: String(block?.masterPlanLaneId || block?.laneId || ''),
        blockType: String(block?.blockType || block?.type || ''),
      }))
    )
  );
}

function summarizeBlocksByKey(blocks, keyBuilder) {
  return blocks.reduce((acc, block) => {
    const key = keyBuilder(block);
    if (!key) {
      return acc;
    }
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
}

function normalizeAgendaState(previousAgenda, nextConstraintVersionId) {
  if (!previousAgenda) {
    return null;
  }
  if (previousAgenda.sourceConstraintVersionId === nextConstraintVersionId) {
    return previousAgenda;
  }
  return {
    ...previousAgenda,
    state: previousAgenda.state === 'superseded' ? 'superseded' : 'stale',
  };
}

export function buildFullHorizonConstraintVersion({
  profileId,
  masterPlanId,
  createdAtISO,
  officialStartDayKey,
  weeklyCapacityMinutes,
  workWindows,
  source = 'master_calendar',
  masterCalendarId = null,
  constraintsStatus = null,
}) {
  const workWindowSummary = summarizeWorkWindows(workWindows);
  const constraintHash = buildConstraintHash({
    officialStartDayKey,
    weeklyCapacityMinutes,
    workWindowSummary,
    source,
    masterCalendarId,
  });
  return {
    id: `agenda-constraint:${masterPlanId}:${constraintHash}`,
    profileId,
    masterPlanId,
    createdAtISO,
    source,
    constraintHash,
    officialStartDayKey: normalizeDayKey(officialStartDayKey),
    weeklyCapacityMinutes: Number(weeklyCapacityMinutes) || 0,
    workWindowSummary,
    constraintsStatus: constraintsStatus || null,
    masterCalendarId: masterCalendarId || null,
  };
}

export function buildFullHorizonAgendaVersion({
  profileId,
  masterPlanId,
  createdAtISO,
  range,
  blocks,
  sourceConstraintVersionId,
  strategicCoverageState,
  planQualityState,
  blockQualityState,
  existingAgendaVersionsById = {},
  existingCurrentAgendaVersionId = null,
}) {
  const normalizedBlocks = Array.isArray(blocks) ? blocks : [];
  const rangeStartDayKey = normalizeDayKey(range?.startDayKey);
  const rangeEndDayKey = normalizeDayKey(range?.endDayKey);
  const blockHash = buildBlockHash(normalizedBlocks);
  const agendaVersionId = `agenda:${masterPlanId}:${String(sourceConstraintVersionId || 'none').split(':').pop()}:${blockHash}`;
  const previousCurrentAgenda = existingCurrentAgendaVersionId
    ? existingAgendaVersionsById?.[existingCurrentAgendaVersionId] || null
    : null;

  const byPhase = summarizeBlocksByKey(normalizedBlocks, (block) => String(block?.phaseLabel || '').trim() || null);
  const byYear = summarizeBlocksByKey(normalizedBlocks, (block) => normalizeDayKey(block?.dayKey || block?.date)?.slice(0, 4));
  const byQuarter = summarizeBlocksByKey(normalizedBlocks, (block) => buildQuarterKey(block?.dayKey || block?.date));
  const byLane = summarizeBlocksByKey(
    normalizedBlocks,
    (block) => String(block?.masterPlanLaneId || block?.laneId || '').trim() || null
  );
  const byBlockType = summarizeBlocksByKey(
    normalizedBlocks,
    (block) => String(block?.blockType || block?.type || '').trim() || null
  );
  const unscheduledCount = normalizedBlocks.filter((block) => !normalizeDayKey(block?.dayKey || block?.date)).length;
  const scheduledCount = normalizedBlocks.length - unscheduledCount;

  const agenda = {
    id: agendaVersionId,
    profileId,
    masterPlanId,
    createdAtISO,
    sourceConstraintVersionId: sourceConstraintVersionId || null,
    state: 'current',
    range: {
      startDayKey: rangeStartDayKey,
      endDayKey: rangeEndDayKey,
    },
    blockCount: normalizedBlocks.length,
    blockIds: normalizedBlocks.map((block) => block.id).filter(Boolean),
    summary: {
      byPhase,
      byYear,
      byQuarter,
      byLane,
      byBlockType,
      scheduledCount,
      unscheduledCount,
      overloadCount: 0,
    },
    quality: {
      strategicCoverageState: strategicCoverageState || null,
      planQualityState: planQualityState || null,
      blockQualityState: blockQualityState || null,
    },
  };

  const nextAgendaVersionsById = {
    ...existingAgendaVersionsById,
  };
  if (previousCurrentAgenda && previousCurrentAgenda.id !== agendaVersionId) {
    nextAgendaVersionsById[previousCurrentAgenda.id] = normalizeAgendaState(
      previousCurrentAgenda,
      sourceConstraintVersionId
    );
  }
  nextAgendaVersionsById[agendaVersionId] = {
    ...(existingAgendaVersionsById?.[agendaVersionId] || {}),
    ...agenda,
    createdAtISO: existingAgendaVersionsById?.[agendaVersionId]?.createdAtISO || agenda.createdAtISO,
  };

  return {
    agendaVersion: nextAgendaVersionsById[agendaVersionId],
    agendaVersionsById: nextAgendaVersionsById,
  };
}
