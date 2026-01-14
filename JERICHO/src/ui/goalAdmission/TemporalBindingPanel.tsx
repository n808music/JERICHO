import React from 'react';
import { TemporalBinding } from '../../domain/goal/GoalExecutionContract';

interface TemporalBindingPanelProps {
  temporalBinding: TemporalBinding | undefined;
  onTemporalChange: (binding: TemporalBinding) => void;
  isValid: boolean;
}

export default function TemporalBindingPanel({
  temporalBinding,
  onTemporalChange,
  isValid,
}: TemporalBindingPanelProps) {
  const current = temporalBinding || {
    daysPerWeek: 3,
    activationTime: '09:00',
    sessionDurationMinutes: 60,
    weeklyMinutes: 180,
    startDayKey: '',
  };

  const weeklyMinutes = current.daysPerWeek * current.sessionDurationMinutes;

  return (
    <div className="rounded-lg border border-line/60 bg-jericho-surface/90 p-4 space-y-3">
      <div className="flex items-center gap-2">
        <span className="inline-block w-5 h-5 rounded-full border border-line/60 text-[11px] flex items-center justify-center flex-shrink-0">
          4
        </span>
        <p className="text-xs uppercase tracking-[0.14em] text-muted font-semibold">Temporal Binding</p>
        {isValid && <span className="text-xs text-green-600">✓</span>}
      </div>

      <div className="space-y-2 text-xs">
        <p className="text-muted">How often and when will you work on this goal?</p>

        <div className="grid sm:grid-cols-3 gap-2">
          <label className="block">
            <span className="text-xs uppercase tracking-[0.12em] text-muted mb-1 block">Days per week</span>
            <select
              value={current.daysPerWeek}
              onChange={(e) =>
                onTemporalChange({
                  ...current,
                  daysPerWeek: Number(e.target.value) as 3 | 4 | 5 | 6 | 7,
                  weeklyMinutes: Number(e.target.value) * current.sessionDurationMinutes,
                })
              }
              className="w-full rounded border border-line/60 bg-transparent px-2 py-1"
            >
              {[3, 4, 5, 6, 7].map((d) => (
                <option key={d} value={d}>
                  {d} days
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="text-xs uppercase tracking-[0.12em] text-muted mb-1 block">Time of day</span>
            <input
              type="time"
              value={current.activationTime}
              onChange={(e) =>
                onTemporalChange({
                  ...current,
                  activationTime: e.target.value,
                })
              }
              className="w-full rounded border border-line/60 bg-transparent px-2 py-1"
            />
          </label>

          <label className="block">
            <span className="text-xs uppercase tracking-[0.12em] text-muted mb-1 block">Session length (min)</span>
            <input
              type="number"
              value={current.sessionDurationMinutes}
              onChange={(e) =>
                onTemporalChange({
                  ...current,
                  sessionDurationMinutes: Math.max(15, Number(e.target.value)),
                  weeklyMinutes: current.daysPerWeek * Math.max(15, Number(e.target.value)),
                })
              }
              min={15}
              step={15}
              className="w-full rounded border border-line/60 bg-transparent px-2 py-1"
            />
          </label>
        </div>

        <div className="rounded border border-line/40 bg-jericho-surface/50 px-2 py-1 text-[11px] text-muted">
          <strong>Total commitment:</strong> {weeklyMinutes} minutes/week ({Math.round(weeklyMinutes / 60)} hours)
        </div>

        <label className="block">
          <span className="text-xs uppercase tracking-[0.12em] text-muted mb-1 block">Start date</span>
          <input
            type="date"
            value={current.startDayKey || ''}
            onChange={(e) =>
              onTemporalChange({
                ...current,
                startDayKey: e.target.value,
              })
            }
            className="w-full rounded border border-line/60 bg-transparent px-2 py-1"
          />
        </label>
      </div>
    </div>
  );
}
