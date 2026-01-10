import React from 'react';

export default function DiagnosticsPanel({ drift, risks = [], metrics }) {
  return (
    <div className="rounded-xl border border-line/60 bg-jericho-surface/90 shadow-glass p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-muted">Diagnostics</p>
          <h3 className="text-lg font-semibold">Integrity + risk</h3>
        </div>
        <span className="text-xs text-muted">Drift: {drift}</span>
      </div>
      <div className="grid grid-cols-2 gap-3 text-sm">
        <Metric label="Completion rate" value={`${metrics.completionRate}%`} />
        <Metric label="Streak" value={`${metrics.streak} days`} />
        <Metric label="Drift index" value={metrics.driftIndex} />
        <Metric label="Risks" value={risks.length} />
      </div>
      <div className="space-y-1 text-sm">
        {risks.map((risk) => (
          <div
            key={risk}
            className="rounded-md bg-hot/10 border border-hot/40 px-3 py-2 text-jericho-text"
          >
            {risk}
          </div>
        ))}
        {risks.length === 0 ? (
          <div className="rounded-md border border-line/50 px-3 py-2 text-muted">No active risk flags.</div>
        ) : null}
      </div>
    </div>
  );
}

function Metric({ label, value }) {
  return (
    <div className="rounded-lg bg-jericho-bg/70 border border-line/40 px-3 py-2">
      <p className="text-[11px] uppercase tracking-[0.12em] text-muted">{label}</p>
      <p className="text-sm font-semibold">{value}</p>
    </div>
  );
}
