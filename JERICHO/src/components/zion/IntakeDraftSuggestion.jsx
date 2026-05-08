import React from 'react';

/**
 * IntakeDraftSuggestion
 * Role A — Intake Drafting Assistant UI surface
 *
 * Displays a single AI-drafted candidate answer for one required intake question.
 * All output is visibly qualified as advisory, not yet applied.
 *
 * Invariants:
 * - Output is always labeled "AI suggestion — not applied".
 * - User must explicitly click "Use this answer" to confirm. No auto-apply.
 * - Dismiss leaves the manual intake path intact.
 * - No store dispatch occurs here; onConfirm and onDismiss are caller-provided.
 */
export default function IntakeDraftSuggestion({ question, draftAnswer, onConfirm, onDismiss }) {
  if (!question || !draftAnswer) return null;

  const displayValue = Array.isArray(draftAnswer.suggestedValue)
    ? draftAnswer.suggestedValue.join(', ')
    : String(draftAnswer.suggestedValue);

  return (
    <div
      data-testid="intake-draft-suggestion"
      className="rounded-lg border border-amber-400/40 bg-amber-50/10 px-3 py-2 mt-2 space-y-2"
      role="region"
      aria-label="AI suggestion — not yet applied"
    >
      <p
        data-testid="intake-draft-qualifier"
        className="text-[10px] uppercase tracking-[0.12em] text-amber-600 font-semibold"
      >
        AI suggestion — not applied
      </p>
      <p data-testid="intake-draft-value" className="text-xs text-jericho-text font-medium">
        {displayValue}
      </p>
      {draftAnswer.rationale ? (
        <p data-testid="intake-draft-rationale" className="text-[11px] text-muted italic">
          {draftAnswer.rationale}
        </p>
      ) : null}
      <div className="flex gap-2 pt-1">
        <button
          data-testid="intake-draft-confirm"
          className="text-[11px] rounded-full border border-jericho-accent px-3 py-1 text-jericho-accent hover:bg-jericho-accent/10 font-semibold"
          onClick={() => onConfirm(question.field, draftAnswer.suggestedValue)}
          type="button"
        >
          Use this answer
        </button>
        <button
          data-testid="intake-draft-dismiss"
          className="text-[11px] rounded-full border border-line/60 px-3 py-1 text-muted hover:bg-jericho-surface/50"
          onClick={onDismiss}
          type="button"
        >
          Dismiss
        </button>
      </div>
    </div>
  );
}
