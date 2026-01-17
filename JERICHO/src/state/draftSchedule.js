import { dayKeyFromISO } from './time/time.ts';
import { getContractStartDayKey, filterSuggestionsByStartDayKey, normalizeSuggestionDayKey } from './suggestionFilters.js';

const ensureISO = (dayKey, time = '09:00') => {
  if (!dayKey) return null;
  return `${dayKey}T${time}:00.000Z`;
};

const sortDraftItems = (items = []) =>
  [...items].sort((a, b) => {
    if (a.dayKey !== b.dayKey) return a.dayKey.localeCompare(b.dayKey);
    if (a.startISO !== b.startISO) return (a.startISO || '').localeCompare(b.startISO || '');
    return (a.title || '').localeCompare(b.title || '');
  });

export function buildDraftScheduleItems({
  suggestedBlocks = [],
  routeSuggestions = [],
  contract = null,
  timeZone = 'UTC',
  defaults = {},
  contractStartDayKey: contractStartDayKeyOverride = null
} = {}) {
  const startDayKey = contractStartDayKeyOverride || getContractStartDayKey(contract, timeZone);
  const normalizedSuggested = filterSuggestionsByStartDayKey(suggestedBlocks, startDayKey, timeZone);
  const items = [];

  normalizedSuggested.forEach((suggestion) => {
    const dayKey = normalizeSuggestionDayKey(suggestion, timeZone) || defaults.todayKey || '';
    const startISO =
      suggestion.startISO ||
      suggestion.start ||
      ensureISO(dayKey, '09:00') ||
      `${dayKey}T09:00:00.000Z`;
    const minutes = Number(suggestion.durationMinutes) || Number(suggestion.minutes) || 30;
    const title = suggestion.title || suggestion.label || 'Suggested block';
    items.push({
      id: `suggested:${suggestion.id || `${dayKey}-${title}`}`,
      source: 'suggestedPath',
      dayKey,
      startISO,
      minutes,
      domainKey: suggestion.domain || 'FOCUS',
      title,
      detail: suggestion.detail || suggestion.description || '',
      reason: 'Suggested path',
      payload: suggestion
    });
  });

  const route = routeSuggestions.map((entry) => {
    const dayKey = entry?.dayKey || defaults.todayKey || '';
    const total = Number(entry?.totalBlocks) || 0;
    return {
      id: `route:${dayKey}`,
      source: 'coldPlan',
      dayKey,
      startISO: ensureISO(dayKey, '09:00'),
      minutes: defaults.routeMinutes || 30,
      domainKey: defaults.primaryDomain || 'FOCUS',
      title: `${total} forecast block${total !== 1 ? 's' : ''}`,
      detail: entry?.summary || '',
      reason: 'Cold plan',
      payload: entry
    };
  });

  const merged = sortDraftItems([...items, ...route]);
  if (!startDayKey && !contract?.deadline?.dayKey) return merged;
  return merged.filter((item) => {
    if (!item.dayKey) return false;
    if (startDayKey && item.dayKey < startDayKey) return false;
    if (contract?.deadline?.dayKey && contract.deadline.dayKey && item.dayKey > contract.deadline.dayKey) return false;
    return true;
  });
}

export function filterDraftItemsByDay(items = [], dayKey) {
  if (!dayKey) return [];
  return (items || []).filter((item) => item.dayKey === dayKey);
}
