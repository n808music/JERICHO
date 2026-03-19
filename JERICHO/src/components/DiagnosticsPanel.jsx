import React from 'react';

export default function DiagnosticsPanel({ drift, risks = [], metrics, traceLog = [] }) {
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
      {traceLog.length > 0 ? (
        <div className="space-y-1">
          <p className="text-xs uppercase tracking-[0.18em] text-muted">Recent activity</p>
          {traceLog
            .slice()
            .reverse()
            .slice(0, 10)
            .map((entry) => (
              <div
                key={entry.traceId}
                className={`rounded-md border px-3 py-2 text-xs space-y-0.5 ${
                  entry.status === 'error' ? 'border-hot/40 bg-hot/10' : 'border-line/50 bg-jericho-bg/70'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-jericho-text">{entry.stepName}</span>
                  <span className={entry.status === 'error' ? 'text-hot' : 'text-muted'}>{entry.status}</span>
                </div>
                <p className="text-muted">{entry.moduleName}</p>
                {entry.outputSummary?.errorCode ? <p className="text-hot">{entry.outputSummary.errorCode}</p> : null}
                {entry.outputSummary?.proposedBlocksCount !== undefined ? (
                  <p className="text-muted">{entry.outputSummary.proposedBlocksCount} blocks proposed</p>
                ) : null}
                {entry.outputSummary?.committedCount !== undefined ? (
                  <p className="text-muted">{entry.outputSummary.committedCount} blocks committed</p>
                ) : null}
              </div>
            ))}
        </div>
      ) : null}
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
