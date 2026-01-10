import React, { useMemo } from 'react';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function buildCalendar(days = []) {
  const weeks = [];
  for (let i = 0; i < days.length; i += 7) {
    weeks.push(days.slice(i, i + 7));
  }
  return weeks;
}

export default function ZionMonthView({ days = [], onSelectDay }) {
  const weeks = useMemo(() => buildCalendar(days), [days]);
  return (
    <div className="rounded-xl border border-line/60 bg-jericho-surface/90 p-3">
      <div className="grid grid-cols-7 gap-2 mb-2 text-[11px] text-muted">
        {WEEKDAYS.map((d) => (
          <span key={d} className="text-center">
            {d}
          </span>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-2">
        {weeks.flatMap((week, wi) =>
          week.map((day, di) =>
            day ? (
              <button
                key={day.date}
                data-day={day.date}
                className={`p-2 space-y-1 text-left rounded-md border ${
                  day.inMonth ? 'border-line/40' : 'border-transparent text-muted'
                } hover:border-jericho-accent/60`}
                onClick={() => onSelectDay?.(day.date)}
              >
                <div className="flex items-center justify-between text-[11px]">
                  <span className="font-semibold">{day.dayNumber}</span>
                  <span className="text-muted">
                    {day.completedCount}/{day.plannedCount}
                  </span>
                </div>
                <div className="text-[10px] text-muted">
                  {Math.round((day.completionRate || 0) * 100)}%
                </div>
                <div className="text-[10px] text-muted">Route: {day.routeCount || 0}</div>
                <div className="space-y-0.5">
                  {(day.titles || []).map((title, idx) => (
                    <div key={idx} className="text-[10px] text-jericho-text truncate">
                      {title}
                    </div>
                  ))}
                  {day.moreCount > 0 ? (
                    <div className="text-[10px] text-muted">+{day.moreCount} more</div>
                  ) : null}
                </div>
              </button>
            ) : (
              <div key={`empty-${wi}-${di}`} className="p-2 rounded-md border border-transparent" />
            )
          )
        )}
      </div>
    </div>
  );
}
