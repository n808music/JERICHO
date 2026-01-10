import React from 'react';

export default function DayLog({ day }) {
  if (!day) return null;
  const blocks = (day.blocks || []).slice().sort((a, b) => new Date(a.start) - new Date(b.start));
  return (
    <div className="mt-2 rounded-lg border border-line/60 bg-jericho-surface/80 p-3 text-xs text-muted space-y-2">
      <p className="font-semibold text-jericho-text">{day.summaryLine || 'Day details'}</p>
      <div className="space-y-1">
        {blocks.map((b) => (
          <div key={b.id} className="flex items-center gap-2">
            <span className="text-[11px] text-muted">
              {formatTime(b.start)}–{formatTime(b.end)}
            </span>
            <span className="text-jericho-text font-medium">{b.practice}</span>
            <span className="text-muted">{b.label}</span>
            <span className="ml-auto capitalize">{b.status}</span>
          </div>
        ))}
        {!blocks.length ? <p className="text-muted">No blocks logged.</p> : null}
      </div>
    </div>
  );
}

function formatTime(value) {
  if (!value) return '--';
  const d = new Date(value);
  if (!isNaN(d)) {
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  return value;
}
