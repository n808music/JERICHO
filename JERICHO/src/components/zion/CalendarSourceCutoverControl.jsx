import React from 'react';

// Gate 2 — operator-visible cutover control for the live calendar's source of truth.
// Shows which source is live (label) and flips it explicitly. The production flip is the
// operator's hand on this button — no silent, implicit source swap. A dev flag may enable the
// matrix source underneath for testing, but this control is how the operator sees and owns it.
export default function CalendarSourceCutoverControl({ label = '', enabled = false, onToggle = () => {} }) {
  return (
    <div className="flex items-center gap-2 rounded-lg border p-2 text-xs">
      <span
        className={`rounded px-2 py-0.5 font-semibold ${
          enabled ? 'bg-emerald-500/15 text-emerald-400' : 'bg-slate-500/15 text-muted'
        }`}
      >
        {label}
      </span>
      <button
        type="button"
        className="rounded border px-2 py-0.5 font-medium text-jericho-text"
        onClick={() => onToggle(!enabled)}
      >
        {enabled ? 'Switch to forecast source' : 'Switch to matrix source'}
      </button>
    </div>
  );
}
