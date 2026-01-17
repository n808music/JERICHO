import { addDays, dayKeyFromDate } from './time/time.ts';

const EVENT_TYPE_MAP = {
  suggested_block_created: 'CREATED',
  suggested_block_accepted: 'ACCEPTED',
  suggestion_rejected: 'REJECTED',
  suggestion_ignored: 'IGNORED',
  suggestion_dismissed: 'DISMISSED'
};

function getSuggestionFromLookup(lookup, id) {
  if (!id) return null;
  if (!lookup) return null;
  if (lookup instanceof Map) return lookup.get(id) || null;
  return lookup[id] || null;
}

export function projectSuggestionHistory({
  suggestionEvents = [],
  suggestionsById = {},
  nowDayKey,
  windowDays = 14,
  filters = {},
  timeZone
} = {}) {
  if (!Array.isArray(suggestionEvents) || !suggestionEvents.length || !nowDayKey) return [];
  const safeWindow = Number.isFinite(windowDays) && windowDays > 0 ? Math.floor(windowDays) : 14;
  const startKey = addDays(nowDayKey, -(safeWindow - 1), timeZone);
  const items = suggestionEvents
    .map((event, idx) => {
      const mappedType = EVENT_TYPE_MAP[event?.type];
      if (!mappedType) return null;
      const suggestionId = event.suggestionId || event.proposalId || '';
      const dayKey = event.dayKey || (event.atISO ? dayKeyFromDate(new Date(event.atISO), timeZone) : '');
      if (!dayKey) return null;
      if (dayKey < startKey || dayKey > nowDayKey) return null;
      const suggestion = getSuggestionFromLookup(suggestionsById, suggestionId);
      return {
        id: event.id || `${mappedType}-${suggestionId || idx}`,
        dayKey,
        type: mappedType,
        suggestionId,
        reason: event.reason,
        domain: suggestion?.domain,
        title: suggestion?.title,
        archived: suggestionId ? !suggestion : true,
        atISO: event.atISO || '',
        idx
      };
    })
    .filter(Boolean);

  const { types = [], domains = [], reasons = [] } = filters || {};
  const filtered = items.filter((item) => {
    if (types.length && !types.includes(item.type)) return false;
    if (domains.length && !domains.includes(item.domain || '')) return false;
    if (reasons.length && !reasons.includes(item.reason || '')) return false;
    return true;
  });

  filtered.sort((a, b) => {
    if (a.dayKey !== b.dayKey) return b.dayKey.localeCompare(a.dayKey);
    if (a.atISO !== b.atISO) return a.atISO.localeCompare(b.atISO);
    return a.idx - b.idx;
  });
  return filtered;
}
