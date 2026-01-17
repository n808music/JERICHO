import React from 'react';

export default function ZionYearView({ months = [], onSelectMonth }) {
  return (
    <div className="grid md:grid-cols-4 gap-3">
      {months.map((month) => (
        <button
          key={month.anchorDayKey}
          data-month={month.anchorDayKey}
          className="rounded-xl border border-line/60 bg-jericho-surface/90 p-3 text-left hover:border-jericho-accent/60"
          onClick={() => onSelectMonth?.(month.anchorDayKey)}
        >
          <p className="text-sm font-semibold text-jericho-text">{month.label}</p>
          <p className="text-[11px] text-muted">
            {month.completedCount}/{month.plannedCount} · {Math.round((month.completionRate || 0) * 100)}%
          </p>
          <p className="text-[11px] text-muted">Route: {month.routeTotal || 0}</p>
        </button>
      ))}
    </div>
  );
}
