import React from 'react';

export default function PatternBar({ weeks = [] }) {
  return (
    <div className="rounded-xl border border-line/60 bg-jericho-surface/90 p-3 space-y-2">
      {weeks.map((week, idx) => (
        <div key={idx} className="space-y-1">
          <div className="flex items-center justify-between text-xs text-muted">
            <span>{week.label}</span>
            {week.alert ? <span className="text-amber-400">{week.alert}</span> : null}
          </div>
          <div className="h-3 bg-line/20 overflow-hidden flex">
            {week.segments.map((seg, segIdx) => (
              <div
                key={segIdx}
                className="h-full"
                style={{
                  width: `${Math.max(5, seg.share)}%`,
                  background: seg.color || 'var(--color-jericho-accent)'
                }}
                title={`${seg.discipline}: ${seg.share}%`}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
