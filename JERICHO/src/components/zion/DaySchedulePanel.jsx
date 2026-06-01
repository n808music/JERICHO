import React, { useMemo, useState } from 'react';
import { describeBlockMeaning } from './blockMeaning.js';

/**
 * Shared day-level schedule panel for Month/Year planning surfaces.
 * Planning-only: add/delete; no execution controls.
 */
export default function DaySchedulePanel({
  dayKey,
  blocks = [],
  onAdd,
  onDelete,
  surfaceLabel = 'Planning surface',
  lineageBlocks = null,
  deliverableLabelById = {},
  criterionLabelById = {},
}) {
  const [time, setTime] = useState('09:00');
  const [duration, setDuration] = useState(30);
  const [title, setTitle] = useState('');

  const sortedBlocks = useMemo(() => {
    return [...(blocks || [])].sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());
  }, [blocks]);
  const lineageSource = Array.isArray(lineageBlocks) && lineageBlocks.length > 0 ? lineageBlocks : sortedBlocks;

  const totals = useMemo(() => {
    return sortedBlocks.reduce(
      (acc, b) => {
        const start = b?.start ? new Date(b.start).getTime() : 0;
        const end = b?.end ? new Date(b.end).getTime() : 0;
        const minutes = Math.max(0, Math.round((end - start) / 60000));
        acc.planned += minutes;
        if (b?.status === 'completed' || b?.status === 'complete') acc.completed += minutes;
        return acc;
      },
      { planned: 0, completed: 0 }
    );
  }, [sortedBlocks]);

  return (
    <div className="rounded-xl border border-line/60 bg-jericho-surface/90 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.14em] text-muted">Day Summary</p>
          <p className="text-sm text-jericho-text font-semibold">{dayKey || '—'}</p>
          <p className="text-xs text-muted">
            Scheduled {totals.planned}m · Completed {totals.completed}m ·{' '}
            {totals.planned ? Math.round((totals.completed / totals.planned) * 100) : 0}%
          </p>
        </div>
      </div>

      <div className="space-y-2 text-xs">
        {sortedBlocks.map((b) => {
          const meaning = describeBlockMeaning(b, lineageSource, { deliverableLabelById, criterionLabelById });
          return (
            <div
              key={b.id}
              className="flex items-center justify-between rounded-md border border-line/60 bg-jericho-surface px-2 py-1"
            >
              <div className="min-w-0">
                <div className="font-semibold">{b.displayTitle || b.title || b.label || 'Untitled task'}</div>
                <div className="text-muted">
                  {b.start} → {b.end} · {b.status}
                </div>
                {meaning?.lines?.length ? (
                  <div className="mt-0.5 space-y-0.5 text-[10px] text-muted">
                    {meaning.lines.slice(0, 3).map((line) => (
                      <div key={line} className="truncate">
                        {line}
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
              <button
                className="rounded-full border border-jericho-accent px-3 py-1 text-jericho-accent hover:bg-jericho-accent/5"
                onClick={() => onDelete?.(b.id)}
                disabled={Boolean(b?.requiredSystemBlock || String(b?.origin || '').trim() === 'schedule_active')}
              >
                Delete
              </button>
            </div>
          );
        })}
        {!sortedBlocks.length ? <p className="text-muted">No blocks on this day.</p> : null}
      </div>

      <div className="space-y-2 text-xs rounded-md border border-line/60 bg-jericho-surface/80 p-3">
        <p className="text-muted font-semibold">Add block</p>
        <div className="flex flex-wrap gap-2">
          <input
            type="time"
            className="rounded border border-line/60 bg-transparent px-2 py-1"
            value={time}
            onChange={(e) => setTime(e.target.value)}
          />
          <input
            type="number"
            className="w-20 rounded border border-line/60 bg-transparent px-2 py-1"
            value={duration}
            min={1}
            onChange={(e) => setDuration(Math.max(1, Number(e.target.value) || 1))}
          />
          <input
            className="rounded border border-line/60 bg-transparent px-2 py-1 flex-1 min-w-[140px]"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Title"
          />
          <button
            className="rounded-full border border-jericho-accent px-3 py-1 text-jericho-accent hover:bg-jericho-accent/5"
            onClick={() =>
              onAdd?.(dayKey, {
                title: title || 'Untitled task',
                domain: 'FOCUS',
                durationMinutes: duration,
                time,
              })
            }
          >
            Add
          </button>
        </div>
        <p className="text-[11px] text-muted">{surfaceLabel}: add/delete only; execution stays in Today.</p>
      </div>
    </div>
  );
}
