import { dayKeyFromISO, APP_TIME_ZONE } from './time/time.ts';

const ensureISOForComparison = (value) => {
  if (!value) return null;
  if (value.length === 10) return `${value}T00:00:00.000Z`;
  return value;
};

export const isBeforeStartDate = (candidate, startISO) => {
  if (!startISO || !candidate) return false;
  const normalizedStart = new Date(startISO).getTime();
  if (!Number.isFinite(normalizedStart)) return false;
  const candidateIso = ensureISOForComparison(candidate);
  if (!candidateIso) return false;
  const candidateMs = new Date(candidateIso).getTime();
  if (!Number.isFinite(candidateMs)) return false;
  return candidateMs < normalizedStart;
};

export const normalizeSuggestionDayKey = (suggestion, timeZone) => {
  if (!suggestion) return null;
  if (suggestion.dayKey) return suggestion.dayKey;
  const iso = suggestion.startISO || suggestion.start || suggestion.dateISO || suggestion.startDateISO;
  if (!iso) return null;
  return dayKeyFromISO(iso, timeZone);
};

export const filterSuggestedBlocksByStartDate = (suggestedBlocks = [], startISO, timeZone) => {
  if (!startISO) return suggestedBlocks || [];
  return (suggestedBlocks || []).filter((s) => {
    if (!s) return false;
    if (s?.startISO && isBeforeStartDate(s.startISO, startISO)) return false;
    if (s?.start && isBeforeStartDate(s.start, startISO)) return false;
    const dayKey = normalizeSuggestionDayKey(s, timeZone);
    if (dayKey && isBeforeStartDate(dayKey, startISO)) return false;
    return true;
  });
};

export const toDayKey = (value, timeZone) => {
  if (!value) return null;
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  return dayKeyFromISO(value, timeZone || APP_TIME_ZONE);
};

export const getContractStartDayKey = (contract, timeZone) => {
  if (!contract) return null;
  const candidate = contract.startDate || contract.startDateISO || contract.startISO || contract.startDayKey;
  return toDayKey(candidate, timeZone);
};

export const getContractDeadlineDayKey = (contract) => {
  if (!contract) return null;
  return contract.deadline?.dayKey || contract.deadlineDayKey || null;
};

export const filterSuggestionsByStartDayKey = (items = [], startDayKey, timeZone) => {
  if (!startDayKey) return items || [];
  return (items || []).filter((item) => {
    if (!item) return false;
    const dayKey = normalizeSuggestionDayKey(item, timeZone);
    if (!dayKey) return true;
    return dayKey >= startDayKey;
  });
};

export const selectVisibleDraftItems = ({
  cycle,
  draftItems = [],
  timeZone = APP_TIME_ZONE,
  deadlineDayKey = null
} = {}) => {
  if (!cycle?.goalContract) return [];
  const startKey = getContractStartDayKey(cycle?.goalContract, timeZone);
  const endKey = deadlineDayKey || getContractDeadlineDayKey(cycle?.goalContract);
  return (draftItems || [])
    .filter((item) => {
      if (!item?.dayKey) return false;
      if (startKey && item.dayKey < startKey) return false;
      if (endKey && item.dayKey > endKey) return false;
      return true;
    })
    .sort((a, b) => {
      if (a.dayKey !== b.dayKey) return a.dayKey.localeCompare(b.dayKey);
      if (a.startISO !== b.startISO) return (a.startISO || '').localeCompare(b.startISO || '');
      return (a.title || '').localeCompare(b.title || '');
    });
};
