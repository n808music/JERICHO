import React, { useMemo, useState } from 'react';

/**
 * Shared day-level schedule panel for Month/Year planning surfaces.
 * Planning-only: add/delete; no execution controls.
 */
export default function DaySchedulePanel({ dayKey, blocks = [], onAdd, onDelete, surfaceLabel = 'Planning surface' }) {
  const [time, setTime] = useState('09:00');
  const [duration, setDuration] = useState(30);
  const [domain, setDomain] = useState('CREATION');
  const [title, setTitle] = useState('Block');

  const sortedBlocks = useMemo(() => {
    return [...(blocks || [])].sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());
  }, [blocks]);

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
            Scheduled {totals.planned}m · Completed {totals.completed}m · {totals.planned ? Math.round((totals.completed / totals.planned) * 100) : 0}%
          </p>
        </div>
      </div>

      <div className="space-y-2 text-xs">
        {sortedBlocks.map((b) => (
          <div
            key={b.id}
            className="flex items-center justify-between rounded-md border border-line/60 bg-jericho-surface px-2 py-1"
          >
            <div>
              <div className="font-semibold">{b.label || `${b.practice || b.domain} block`}</div>
              <div className="text-muted">
                {b.practice || b.domain} · {b.start} → {b.end} · {b.status}
              </div>
            </div>
            <button
              className="rounded-full border border-jericho-accent px-3 py-1 text-jericho-accent hover:bg-jericho-accent/5"
              onClick={() => onDelete?.(b.id)}
            >
              Delete
            </button>
          </div>
        ))}
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
          <select
            className="rounded border border-line/60 bg-transparent px-2 py-1"
            value={domain}
            onChange={(e) => setDomain(e.target.value)}
          >
            {['BODY', 'RESOURCES', 'CREATION', 'FOCUS'].map((d) => (
              <option key={d} value={d}>
                {d.charAt(0) + d.slice(1).toLowerCase()}
              </option>
            ))}
          </select>
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
                title,
                domain,
                durationMinutes: duration,
                time
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
