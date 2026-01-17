import React from 'react';
import Orb from './Orb.jsx';

export default function IdentityBar({
  day = 1,
  direction = 'steady trajectory',
  stability = 'steady',
  drift = 'contained',
  momentum = 'active',
  trend = [],
  driftLabel,
  driftHint
}) {
  return (
    <div className="rounded-xl border border-line/60 bg-jericho-surface/90 px-4 py-3 flex items-center justify-between gap-4">
      <div className="flex items-center gap-3">
        <Orb state="on-track" size="md" />
        <div>
          <p className="text-xs uppercase tracking-[0.16em] text-muted">Identity Vector — Day {day}</p>
          <p className="text-sm font-semibold leading-tight">Direction: {direction}</p>
          <p className="text-xs text-muted">
            Stability: {stability} · Drift: {drift} · Momentum: {momentum}
          </p>
          {driftLabel ? (
            <p className="text-[11px] text-muted">
              Drift: {driftLabel}
              {driftHint ? ` — ${driftHint}` : ''}
            </p>
          ) : null}
        </div>
      </div>
      <div className="hidden sm:flex items-center gap-1 text-[10px] text-muted">
        {trend.map((value, idx) => (
          <span
            key={`${value}-${idx}`}
            className="h-2 w-2 rounded-full bg-jericho-bg border border-line/50"
            style={{ opacity: 0.35 + Math.min(0.65, value / 100) }}
          />
        ))}
      </div>
    </div>
  );
}
