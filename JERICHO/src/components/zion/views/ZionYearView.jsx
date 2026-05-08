import React from 'react';

export default function ZionYearView({ months = [], onSelectMonth }) {
  return (
    <div className="rounded-xl border border-line/60 bg-jericho-surface/90 p-3">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {months.map((month) => (
          <button
            key={month.anchorDayKey}
            data-month={month.anchorDayKey}
            className="w-full rounded-xl border border-line/60 bg-white/40 p-3 text-left shadow-sm transition hover:border-jericho-accent/60"
            onClick={() => onSelectMonth?.(month.anchorDayKey)}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-1">
                <p className="text-sm font-semibold text-jericho-text">{month.label}</p>
                <p className="text-[11px] uppercase tracking-[0.14em] text-muted">Execution Month</p>
              </div>
              <span className="rounded-full border border-line/40 px-2 py-1 text-[10px] text-muted">
                {Math.round((month.completionRate || 0) * 100)}%
              </span>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2 text-[11px]">
              <div className="rounded-lg border border-line/30 bg-jericho-surface/60 px-2 py-2">
                <div className="text-muted">Completed</div>
                <div className="mt-1 font-semibold text-jericho-text">{month.completedCount}</div>
              </div>
              <div className="rounded-lg border border-line/30 bg-jericho-surface/60 px-2 py-2">
                <div className="text-muted">Planned</div>
                <div className="mt-1 font-semibold text-jericho-text">{month.plannedCount}</div>
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
