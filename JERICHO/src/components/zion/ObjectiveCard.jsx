import React from 'react';

export default function ObjectiveCard({ title, weight, status, nextStepTime, onReveal }) {
  return (
    <div className="space-y-2">
      <p className="text-xs uppercase tracking-[0.14em] text-muted">Today’s Work</p>
      <div className="flex items-center gap-2 text-xl font-semibold">
        <span className="h-2.5 w-2.5 rounded-full bg-jericho-accent" aria-hidden />
        <span>{title}</span>
      </div>
      <div className="text-sm text-muted">Next block: {nextStepTime || '—'} · Purpose: strengthen your systems</div>
      <div className="flex gap-3 text-sm">
        {onReveal ? (
          <button onClick={onReveal} className="text-muted">
            View context
          </button>
        ) : null}
      </div>
    </div>
  );
}
