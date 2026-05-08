import React from 'react';

const DEFAULT_METRICS = {
  completionRate: 0,
  streak: 0,
  driftIndex: 0,
};

export default function DiagnosticsPanel({
  drift = 0,
  risks = [],
  metrics = DEFAULT_METRICS,
  traceLog = [],
  missedSignal = null,
}) {
  const safeMetrics = {
    ...DEFAULT_METRICS,
    ...(metrics && typeof metrics === 'object' ? metrics : {}),
  };
  const safeRisks = Array.isArray(risks) ? risks.filter(Boolean) : [];
  const safeTraceLog = Array.isArray(traceLog) ? traceLog.filter((entry) => entry && typeof entry === 'object') : [];
  const transitionTraceLog = safeTraceLog.filter(
    (entry) => typeof entry.transition === 'string' && entry.transition.trim()
  );

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
        <Metric label="Completion rate" value={`${safeMetrics.completionRate}%`} />
        <Metric label="Streak" value={`${safeMetrics.streak} days`} />
        <Metric label="Drift index" value={safeMetrics.driftIndex} />
        <Metric label="Risks" value={safeRisks.length} />
      </div>
      <div className="space-y-1 text-sm">
        {safeRisks.map((risk) => (
          <div key={risk} className="rounded-md bg-hot/10 border border-hot/40 px-3 py-2 text-jericho-text">
            {risk}
          </div>
        ))}
        {safeRisks.length === 0 ? (
          <div className="rounded-md border border-line/50 px-3 py-2 text-muted">No active risk flags.</div>
        ) : null}
      </div>
      {missedSignal ? (
        <div className="space-y-1">
          <p className="text-xs uppercase tracking-[0.18em] text-muted">Missed block signal</p>
          <div className="rounded-md border border-hot/40 bg-hot/10 px-3 py-2 text-xs space-y-1">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-jericho-text">{missedSignal.headline || 'Missed work detected'}</span>
              <span className="text-hot">{missedSignal.level || 'active'}</span>
            </div>
            {missedSignal.actionLine ? <p className="text-muted">{missedSignal.actionLine}</p> : null}
            {Array.isArray(missedSignal.details) && missedSignal.details.length > 0 ? (
              <p className="text-muted">{missedSignal.details.join(' · ')}</p>
            ) : null}
          </div>
        </div>
      ) : null}
      {transitionTraceLog.length > 0 ? (
        <div className="space-y-1">
          <p className="text-xs uppercase tracking-[0.18em] text-muted">Trace timeline</p>
          {transitionTraceLog
            .slice()
            .reverse()
            .slice(0, 10)
            .map((entry, index) => (
              <div
                key={`${entry.transition}-${entry.blockId || 'none'}-${entry.timestamp || index}-${index}`}
                className="rounded-md border border-line/50 bg-jericho-bg/70 px-3 py-2 text-xs space-y-0.5"
              >
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-jericho-text">{formatTransition(entry.transition)}</span>
                  <span className="text-muted">{entry.timestamp || '—'}</span>
                </div>
                <p className="text-jericho-text">{entry.label || 'Untitled block'}</p>
                <p className="text-muted">Block: {entry.blockId || '—'}</p>
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

function formatTransition(value) {
  const normalized = String(value || '')
    .trim()
    .toLowerCase();
  if (!normalized) return 'Unknown';
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}
