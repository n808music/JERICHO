import React from 'react';
import { describeBlockMeaning } from '../blockMeaning.js';
import { formatISOTime } from '../../../state/time/time.ts';

export default function ZionWeekView({
  days = [],
  timeZone = 'UTC',
  onSelectDay,
  onSelectBlock,
  lineageBlocks = null,
  deliverableLabelById = {},
  criterionLabelById = {},
}) {
  return (
    <div className="grid md:grid-cols-7 gap-3">
      {days.map((day) => (
        <div
          key={day.dayKey}
          data-day={day.dayKey}
          className="rounded-xl border border-line/60 bg-jericho-surface/90 p-3 space-y-2"
        >
          <button className="text-left w-full" onClick={() => onSelectDay?.(day.dayKey)}>
            <p className="text-xs uppercase tracking-[0.14em] text-muted">{day.label}</p>
            <p className="text-[11px] text-muted">
              {day.completedCount}/{day.plannedCount} · {Math.round((day.completionRate || 0) * 100)}%
            </p>
          </button>
          <div className="space-y-1">
            {(day.blocks || []).length ? (
              (day.blocks || []).map((block) => {
                const meaning = describeBlockMeaning(block, lineageBlocks || day.blocks, {
                  deliverableLabelById,
                  criterionLabelById,
                });
                return (
                  <button
                    key={`${block.id}-${day.dayKey}`}
                    className="w-full text-left rounded-md border border-line/40 px-2 py-1 text-[11px] hover:border-jericho-accent/60"
                    onClick={() => onSelectBlock?.(block.id)}
                    data-block-id={block.id}
                  >
                    <div className="text-jericho-text">
                      {formatISOTime(block.startISO || block.start || '', timeZone)} ·{' '}
                      {block.displayTitle || block.title || block.label || 'Untitled task'}
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
                    <div className="text-[10px] text-muted">{block.status || 'planned'}</div>
                  </button>
                );
              })
            ) : (
              <p className="text-[11px] text-muted">No blocks.</p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
