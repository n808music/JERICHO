import React from 'react';

const STATE_DOT = {
  active: 'bg-jericho-accent',
  drifting: 'bg-amber-400',
  missed: 'bg-hot',
  complete: 'bg-emerald-400',
  pending: 'bg-line/80'
};

export default function DisciplineTile({ domain, horizon, label, state = 'pending', metric, delta, onInsert, onReveal }) {
  const dot = STATE_DOT[state] || STATE_DOT.pending;
  return (
    <button
      onClick={onReveal}
      className="w-full text-left p-3 rounded-lg border border-line/50 bg-jericho-bg/70 hover:border-jericho-accent/60 transition group"
    >
      <div className="flex items-center gap-2">
        <span className={`h-2.5 w-2.5 rounded-full ${dot}`} aria-hidden />
        <p className="text-sm font-semibold">{label}</p>
      </div>
      <div className="mt-1 flex items-center justify-between text-xs text-muted">
        <span>Load: {metric || 'light'}</span>
        {delta !== undefined ? (
          <span className={delta >= 0 ? 'text-emerald-400' : 'text-amber-400'}>
            Trend: {delta > 0 ? 'rising' : delta < 0 ? 'easing' : 'holding'}
          </span>
        ) : (
          <span />
        )}
      </div>
    </button>
  );
}
