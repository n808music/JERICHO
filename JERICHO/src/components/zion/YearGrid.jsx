import React, { useMemo } from 'react';

function DayCell({ day, onSelect, selected }) {
  const completionPercent = Math.max(0, Math.min(100, Math.round((day.completionRate || 0) * 100)));
  const hasData = (day.blocks || []).length > 0 || completionPercent > 0;
  const dateNumber = day.date ? Number(day.date.slice(8, 10)) : '';
  return (
    <button
      data-testid={`year-day-${day.date}`}
      className={`w-8 h-8 rounded-sm border text-[10px] flex flex-col items-center justify-center ${
        selected ? 'border-jericho-accent bg-jericho-accent/5' : hasData ? 'border-line/80 bg-jericho-surface/80' : 'border-line/30 bg-transparent'
      } hover:border-jericho-accent`}
      onClick={() => onSelect?.(day)}
      title={`${day.date} · ${completionPercent}%`}
    >
      <span className="leading-none text-muted">{dateNumber}</span>
      <div className="h-[3px] w-full bg-line/30">
        <div className="h-full bg-jericho-accent/80" style={{ width: `${completionPercent}%` }} />
      </div>
    </button>
  );
}

export default function YearGrid({ months = [], onSelectDay, selectedDayKey }) {
  const monthChunks = useMemo(() => {
    const chunked = [];
    for (let i = 0; i < months.length; i += 3) {
      chunked.push(months.slice(i, i + 3));
    }
    return chunked;
  }, [months]);

  const selectDay = (day) => {
    onSelectDay?.(day);
  };

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        {monthChunks.map((row, idx) => (
          <div key={idx} className="grid md:grid-cols-3 gap-3">
            {row.map((month) => (
              <div key={month.label} className="rounded-xl border border-line/60 bg-jericho-surface/90 p-3 space-y-2">
                <div className="flex items-center justify-between text-xs text-muted">
                  <span className="font-semibold">{month.label}</span>
                  <span>{month.days.length}d</span>
                </div>
                <div className="grid grid-cols-7 gap-1">
                  {month.days.map((day) => (
                    <DayCell key={day.date} day={day} onSelect={selectDay} selected={selectedDayKey === day.date} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
