function coerceDayKey(value) {
  const normalized = String(value || '').trim();
  if (!normalized) {
    return null;
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
    return normalized;
  }
  return normalized.slice(0, 10) || null;
}

export function resolveEffectiveExecutableStartDayKey({
  executionStartDayKey,
  reassessmentCompletedAtISO,
  scheduleGeneratedAtISO,
  fallbackStartDayKey,
} = {}) {
  const fallbackDayKey = coerceDayKey(fallbackStartDayKey);
  const floorDayKey =
    [executionStartDayKey, reassessmentCompletedAtISO, scheduleGeneratedAtISO]
      .map(coerceDayKey)
      .filter(Boolean)
      .sort()
      .pop() || null;

  if (fallbackDayKey && floorDayKey) {
    return fallbackDayKey > floorDayKey ? fallbackDayKey : floorDayKey;
  }

  return fallbackDayKey || floorDayKey || null;
}
