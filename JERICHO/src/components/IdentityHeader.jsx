import React from 'react';

export default function IdentityHeader({ identity, metrics }) {
  const bandTone =
    identity.band === 'positive'
      ? 'bg-jericho-accent text-jericho-bg'
      : identity.band === 'negative'
      ? 'bg-hot text-jericho-bg'
      : 'bg-glass text-jericho-text';

  return (
    <div className="rounded-xl border border-line/60 bg-jericho-surface/90 shadow-glass p-4 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-muted">Identity</p>
          <h3 className="text-xl font-semibold">{identity.name}</h3>
        </div>
        <span className={`px-3 py-1 text-xs uppercase tracking-[0.16em] rounded-full ${bandTone}`}>
          {identity.band}
        </span>
      </div>
      <div className="text-xs text-muted">Regulation (S): {identity.regulation || 'steady'}</div>
      <div className="flex flex-wrap gap-2">
        {identity.traits.map((trait) => (
          <span
            key={trait}
            className="px-2 py-1 text-xs rounded-lg bg-glass text-jericho-text border border-line/50"
          >
            {trait}
          </span>
        ))}
        {identity.gaps.map((gap) => (
          <span
            key={gap}
            className="px-2 py-1 text-xs rounded-lg bg-hot/20 text-jericho-text border border-line/50"
          >
            Gap: {gap}
          </span>
        ))}
      </div>
      <div className="grid grid-cols-3 gap-2 text-sm">
        <Metric label="Drift" value={`${metrics.driftIndex}%`} />
        <Metric label="Completion" value={`${metrics.completionRate}%`} />
        <Metric label="Streak" value={`${metrics.streak}d`} />
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
