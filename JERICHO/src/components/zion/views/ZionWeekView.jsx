import React from 'react';

function formatTime(iso = '') {
  if (!iso) return '--:--';
  const d = new Date(iso);
  const h = d.getHours().toString().padStart(2, '0');
  const m = d.getMinutes().toString().padStart(2, '0');
  return `${h}:${m}`;
}

export default function ZionWeekView({ days = [], onSelectDay, onSelectBlock }) {
  return (
    <div className="grid md:grid-cols-7 gap-3">
      {days.map((day) => (
        <div key={day.dayKey} data-day={day.dayKey} className="rounded-xl border border-line/60 bg-jericho-surface/90 p-3 space-y-2">
          <button className="text-left w-full" onClick={() => onSelectDay?.(day.dayKey)}>
            <p className="text-xs uppercase tracking-[0.14em] text-muted">{day.label}</p>
            <p className="text-[11px] text-muted">
              {day.completedCount}/{day.plannedCount} · {Math.round((day.completionRate || 0) * 100)}%
            </p>
            <p className="text-[11px] text-muted">Route: {day.routeCount || 0}</p>
          </button>
          <div className="space-y-1">
            {(day.blocks || []).length ? (
              (day.blocks || []).map((block) => (
                <button
                  key={`${block.id}-${day.dayKey}`}
                  className="w-full text-left rounded-md border border-line/40 px-2 py-1 text-[11px] hover:border-jericho-accent/60"
                  onClick={() => onSelectBlock?.(block.id)}
                  data-block-id={block.id}
                >
                  <div className="text-jericho-text">
                    {formatTime(block.start)} · {block.label || `${block.practice || block.domain} block`}
                  </div>
                  <div className="text-[10px] text-muted">{block.status || 'planned'}</div>
                </button>
              ))
            ) : (
              <p className="text-[11px] text-muted">No blocks.</p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
