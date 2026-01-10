import type { Suggestion } from './suggestions.ts';

export type ForecastPlacement = {
  suggestionId: string;
  dayKey: string;
  startISO: string;
  durationMinutes: number;
};

// Forecast placements are derived from suggestion schedule and never commit blocks.
export function scheduleSuggestions(suggestions: Suggestion[] = []): ForecastPlacement[] {
  return (suggestions || [])
    .filter((s) => s && s.status === 'suggested')
    .map((s) => ({
      suggestionId: s.id,
      dayKey: s.dayKey,
      startISO: s.startISO,
      durationMinutes: s.durationMinutes
    }));
}
