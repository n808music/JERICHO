import React, { useMemo } from 'react';

export interface WorkWindow {
  start: string;
  end: string;
}

export interface WorkWindowsEditorProps {
  value: Record<string, WorkWindow[]>;
  onChange: (windows: Record<string, WorkWindow[]>) => void;
  readOnly?: boolean;
}

const DAY_ORDER = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
const DAY_LABELS: Record<string, string> = {
  mon: 'Mon',
  tue: 'Tue',
  wed: 'Wed',
  thu: 'Thu',
  fri: 'Fri',
  sat: 'Sat',
  sun: 'Sun',
};

function normalizeWindows(value: Record<string, WorkWindow[]>): Record<string, WorkWindow[]> {
  const normalized: Record<string, WorkWindow[]> = {};
  DAY_ORDER.forEach((day) => {
    normalized[day] = Array.isArray(value?.[day]) ? value[day] : [];
  });
  return normalized;
}

function parseHHMMToMinutes(hhmm: string): number {
  if (!hhmm || !/^\d{2}:\d{2}$/.test(hhmm)) return 0;
  const [hh, mm] = hhmm.split(':').map((n) => Number(n));
  if (!Number.isFinite(hh) || !Number.isFinite(mm)) return 0;
  return hh * 60 + mm;
}

function formatHours(totalMinutes: number): string {
  const hours = totalMinutes / 60;
  return `${hours.toFixed(hours % 1 === 0 ? 0 : 1)} hrs/week`;
}

export default function WorkWindowsEditor({ value, onChange, readOnly = false }: WorkWindowsEditorProps) {
  const windows = useMemo(() => normalizeWindows(value || {}), [value]);

  const weeklyCapacityMinutes = useMemo(
    () =>
      DAY_ORDER.reduce((sum, day) => {
        const dayMinutes = (windows[day] || []).reduce((acc, window) => {
          const start = parseHHMMToMinutes(window.start);
          const end = parseHHMMToMinutes(window.end);
          return acc + Math.max(0, end - start);
        }, 0);
        return sum + dayMinutes;
      }, 0),
    [windows]
  );

  const updateDay = (day: string, nextDayWindows: WorkWindow[]) => {
    onChange({ ...windows, [day]: nextDayWindows });
  };

  const addWindow = (day: string) => {
    updateDay(day, [...(windows[day] || []), { start: '09:00', end: '10:00' }]);
  };

  const removeWindow = (day: string, index: number) => {
    updateDay(
      day,
      (windows[day] || []).filter((_, idx) => idx !== index)
    );
  };

  const updateWindow = (day: string, index: number, patch: Partial<WorkWindow>) => {
    updateDay(
      day,
      (windows[day] || []).map((window, idx) => (idx === index ? { ...window, ...patch } : window))
    );
  };

  return (
    <div className="rounded-lg border border-line/60 bg-jericho-surface/90 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs uppercase tracking-[0.14em] text-muted font-semibold">Work Windows</p>
        <span className="text-xs text-muted/80">{formatHours(weeklyCapacityMinutes)}</span>
      </div>

      <div className="space-y-2">
        {DAY_ORDER.map((day) => {
          const dayWindows = windows[day] || [];
          return (
            <div key={day} className="rounded border border-line/40 bg-jericho-surface/70 p-2">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-xs font-semibold text-jericho-text">{DAY_LABELS[day]}</span>
                {!readOnly && (
                  <button
                    type="button"
                    onClick={() => addWindow(day)}
                    className="rounded border border-line/60 px-2 py-0.5 text-[11px] text-muted hover:text-jericho-accent"
                  >
                    Add window
                  </button>
                )}
              </div>

              {dayWindows.length === 0 ? (
                <div className="text-[11px] text-muted/70">No windows</div>
              ) : (
                <div className="space-y-1">
                  {dayWindows.map((window, index) => (
                    <div key={`${day}-${index}`} className="flex items-center gap-2">
                      <input
                        type="time"
                        value={window.start || '09:00'}
                        onChange={(event) => updateWindow(day, index, { start: event.target.value })}
                        disabled={readOnly}
                        className="rounded border border-line/60 bg-transparent px-2 py-1 text-xs"
                      />
                      <span className="text-xs text-muted">to</span>
                      <input
                        type="time"
                        value={window.end || '10:00'}
                        onChange={(event) => updateWindow(day, index, { end: event.target.value })}
                        disabled={readOnly}
                        className="rounded border border-line/60 bg-transparent px-2 py-1 text-xs"
                      />
                      {!readOnly && (
                        <button
                          type="button"
                          onClick={() => removeWindow(day, index)}
                          className="rounded border border-red-600 px-2 py-0.5 text-[11px] text-red-600 hover:bg-red-600/10"
                        >
                          Remove
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
