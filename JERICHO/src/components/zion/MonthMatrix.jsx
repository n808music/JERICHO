import React from 'react';

function DayCell({ day, onSelect }) {
  const raw = typeof day?.completionRate === 'number' ? day.completionRate : 0;
  const completionPercent = Math.max(0, Math.min(100, Math.round(raw * 100)));
  const dateLabel = day.date ? Number(day.date.slice(8, 10)) : day.label || '';
  return (
    <button
      data-testid={`month-day-${day.date}`}
      data-day={day.date}
      className="p-2 space-y-2 text-left hover:border-line/60 rounded-md border border-transparent"
      onClick={() => onSelect?.(day)}
    >
      <div className="flex items-center justify-between text-xs text-muted">
        <span className="font-semibold">{dateLabel}</span>
        {day.missed ? <span className="h-2 w-2 rounded-full bg-hot" aria-hidden /> : null}
      </div>
      <div className="flex items-center gap-1">
        {day.streakDots?.map((filled, idx) => (
          <span
            key={idx}
            className={`h-1.5 w-1.5 rounded-full ${filled ? 'bg-jericho-accent' : 'bg-line/60'}`}
          />
        ))}
      </div>
      <div className="h-1.5 rounded-full bg-line/20 overflow-hidden">
        <div
          className="h-full bg-jericho-accent/70"
          style={{ width: `${Math.min(100, completionPercent)}%` }}
        />
      </div>
      <div className="text-[11px] text-muted">{(day.blocks || []).length} · {completionPercent}%</div>
    </button>
  );
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function buildCalendar(days) {
  if (!days.length) return [];
  const firstDate = days[0].date ? new Date(`${days[0].date}T00:00:00`) : null;
  const offset = firstDate ? firstDate.getDay() : 0;
  const calendar = [];
  let week = new Array(offset).fill(null);
  days.forEach((day) => {
    if (week.length === 7) {
      calendar.push(week);
      week = [];
    }
    week.push(day);
  });
  if (week.length) {
    while (week.length < 7) week.push(null);
    calendar.push(week);
  }
  return calendar;
}

export default function MonthMatrix({ days = [], onSelect }) {
  const calendar = buildCalendar(days);
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
        {calendar.flatMap((week, wi) =>
          week.map((day, di) =>
            day ? (
              <DayCell
                key={day.label || day.date}
                day={day}
                onSelect={(d) => onSelect?.(d)}
              />
            ) : (
              <div key={`empty-${wi}-${di}`} className="p-2 rounded-md border border-transparent" />
            )
          )
        )}
      </div>
    </div>
  );
}
