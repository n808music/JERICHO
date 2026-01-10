import React from 'react';

export default function OrbPanel({ onRunCycle, onFocusToday }) {
  return (
    <div className="rounded-xl border border-line/60 bg-jericho-surface/90 shadow-glass p-5 flex items-center justify-between gap-4">
      <div>
        <p className="text-xs uppercase tracking-[0.18em] text-muted">Command</p>
        <h3 className="text-lg font-semibold">Orb control</h3>
        <p className="text-sm text-muted">Trigger alignment pulses and focus micro-actions.</p>
      </div>
      <div className="flex gap-2">
        <button
          className="px-4 py-2 text-sm font-semibold rounded-full bg-jericho-accent text-jericho-bg"
          onClick={onRunCycle}
        >
          Run cycle
        </button>
        <button
          className="px-4 py-2 text-sm font-semibold rounded-full bg-glass border border-line/60"
          onClick={onFocusToday}
        >
          Focus today
        </button>
      </div>
    </div>
  );
}
