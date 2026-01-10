import { addDays } from './time/time.ts';
import { buildLocalStartISO, assertValidISO } from './time/time.ts';

type SuggestionTemplate = {
  title: string;
  domain: string;
  durationMinutes: number;
  frequency: string;
  reason: string;
};

export type Suggestion = {
  id: string;
  goalId: string;
  dayKey: string;
  startISO: string;
  endISO: string;
  domain: string;
  durationMinutes: number;
  frequency: string;
  title: string;
  whyThis: string;
  assumption: string;
  status: 'suggested' | 'accepted' | 'rejected' | 'ignored' | 'dismissed';
  createdAtISO: string;
  rejectedReason?: string;
  acceptedAtISO?: string;
};

type GenerateSuggestionsInput = {
  goalId: string;
  startDayKey: string;
  blocksPerWeek: number;
  templates: SuggestionTemplate[];
  daysPerWeek: number;
  goalText: string;
  primaryDomain: string;
  reservedIds?: Set<string>;
  timeZone?: string;
};

// Deterministic suggestions with scheduled placements (forecast only).
export function generateSuggestions({
  goalId,
  startDayKey,
  blocksPerWeek,
  templates,
  daysPerWeek,
  goalText,
  primaryDomain,
  reservedIds = new Set(),
  timeZone
}: GenerateSuggestionsInput): Suggestion[] {
  const slots = blocksPerWeek > 7 ? ['09:00', '16:00'] : ['09:00'];
  const suggestions: Suggestion[] = [];
  const nowISO = new Date().toISOString();
  let idx = 0;
  let sequence = 0;
  while (sequence < blocksPerWeek) {
    idx += 1;
    const id = `sugg-${goalId}-${idx}`;
    if (reservedIds.has(id)) continue;
    const dayOffset = Math.floor(sequence / slots.length);
    const dayKey = addDays(startDayKey, dayOffset, timeZone);
    const slot = slots[sequence % slots.length];
    const template =
      templates[sequence % templates.length] || {
        title: `${primaryDomain} block`,
        domain: primaryDomain,
        durationMinutes: 45,
        frequency: 'weekly',
        reason: 'maintain momentum'
      };
    const startResult = buildLocalStartISO(dayKey, slot, timeZone);
    if (!startResult?.ok) {
      assertValidISO('suggestion_startISO', '', { dayKey, slot, reason: startResult?.reason });
      sequence += 1;
      continue;
    }
    const startISO = startResult.startISO;
    assertValidISO('suggestion_startISO', startISO, { dayKey, slot });
    const endISO = new Date(new Date(startISO).getTime() + template.durationMinutes * 60000).toISOString();
    suggestions.push({
      id,
      goalId,
      dayKey,
      startISO,
      endISO,
      domain: template.domain,
      durationMinutes: template.durationMinutes,
      frequency: template.frequency,
      title: template.title,
      whyThis: `${template.reason} for “${goalText || 'your goal'}”.`,
      assumption: `Assuming ${daysPerWeek} days/week execution.`,
      status: 'suggested',
      createdAtISO: nowISO
    });
    sequence += 1;
  }
  return suggestions;
}
