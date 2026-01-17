import React, { useMemo } from 'react';
import BlockColumn from './BlockColumn.jsx';

export default function WeekGrid({
  days = [],
  metrics = {},
  summaryLine,
  completeBlock,
  deleteBlock,
  selectedDayKey,
  setSelectedDayKey,
  selectedBlockId,
  setSelectedBlockId
}) {
  const completionRate =
    metrics.completionRate ||
    days.reduce((sum, d) => sum + (d.completionRate || 0), 0) / Math.max(1, days.length || 1);
  const loadByPractice =
    metrics.loadByPractice ||
    days.reduce(
      (acc, day) => {
        Object.keys(day.loadByPractice || {}).forEach((p) => {
          acc[p] = (acc[p] || 0) + (day.loadByPractice[p] || 0);
        });
        return acc;
      },
      { Body: 0, Resources: 0, Creation: 0, Focus: 0 }
    );
  const driftSignal =
    metrics.driftSignal ||
    (days.some((d) => d.driftSignal === 'elevated')
      ? 'elevated'
      : days.some((d) => d.driftSignal === 'forming')
      ? 'forming'
      : 'contained');

  return (
    <div className="space-y-4">
      <div className="grid md:grid-cols-7 gap-3">
        {days.map((day) => (
          <div
            key={day.label || day.date}
            className="text-left"
            data-testid={`day-${day.date}`}
            data-day={day.date}
          >
            <BlockColumn
              dateLabel={day.label || day.date}
              blocks={day.blocks}
              onBlockClick={(id) => {
                setSelectedBlockId?.(id);
                setSelectedDayKey?.(day.date);
              }}
            />
            <div className="mt-2 text-[11px] text-muted flex flex-col items-center gap-1">
              <span>
                {(day.blocks || []).length} blocks · {Math.round((Number.isFinite(day.completionRate) ? day.completionRate : 0) * 100)}%
              </span>
              <div className="h-1 w-10 rounded-full bg-line/30 overflow-hidden">
                <div
                  className="h-full bg-jericho-accent/70"
                  style={{ width: `${Math.min(100, Math.max(0, (day.completionRate || 0) * 100))}%` }}
                />
              </div>
            </div>
          </div>
        ))}
      </div>
      <div className="mt-2 flex flex-wrap items-center justify-between text-[11px] text-muted gap-3">
        <span>Completion: {Math.round(completionRate * 100)}%</span>
        <span>
          Load: Body {loadByPractice.Body || 0}m · Resources {loadByPractice.Resources || 0}m · Creation{' '}
          {loadByPractice.Creation || 0}m · Focus {loadByPractice.Focus || 0}m
        </span>
        <span>Drift: {driftSignal}</span>
      </div>
      {summaryLine ? <p className="text-xs text-muted mt-2">{summaryLine}</p> : null}
    </div>
  );
}
