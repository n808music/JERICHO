import React, { useMemo } from 'react';
import { describeBlockMeaning } from '../blockMeaning.js';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function buildCalendar(days = []) {
  const weeks = [];
  for (let i = 0; i < days.length; i += 7) {
    weeks.push(days.slice(i, i + 7));
  }
  return weeks;
}

const clampTwoLinesStyle = {
  display: '-webkit-box',
  WebkitLineClamp: 2,
  WebkitBoxOrient: 'vertical',
  overflow: 'hidden',
};

const sevenColumnGridStyle = {
  display: 'grid',
  gridTemplateColumns: 'repeat(7, minmax(0, 1fr))',
};

export default function ZionMonthView({
  days = [],
  onSelectDay,
  lineageBlocks = null,
  deliverableLabelById = {},
  criterionLabelById = {},
}) {
  const weeks = useMemo(() => buildCalendar(days), [days]);
  const cells = useMemo(() => weeks.flatMap((week) => week), [weeks]);
  return (
    <div className="rounded-xl border border-line/60 bg-jericho-surface/90 p-3">
      <div
        className="gap-px rounded-t-lg border border-line/50 bg-line/30 text-[11px] uppercase tracking-[0.14em] text-muted"
        style={sevenColumnGridStyle}
      >
        {WEEKDAYS.map((d) => (
          <span key={d} className="bg-jericho-surface/95 px-2 py-2 text-center">
            {d}
          </span>
        ))}
      </div>
      <div
        className="gap-px rounded-b-lg border-x border-b border-line/50 bg-line/30"
        style={{
          ...sevenColumnGridStyle,
          gridAutoRows: `minmax(${weeks.length >= 6 ? '8.5rem' : '9.5rem'}, 1fr)`,
        }}
      >
        {cells.map((day, index) =>
          day ? (
            <button
              key={day.date}
              type="button"
              data-day={day.date}
              className={`min-h-0 min-w-0 overflow-hidden px-2.5 py-2 text-left align-top transition hover:bg-white/55 ${
                day.inMonth ? 'bg-white/40 text-jericho-text' : 'bg-jericho-surface/55 text-muted'
              }`}
              onClick={() => onSelectDay?.(day.date)}
            >
              <div className="flex items-start justify-between gap-2 text-[11px]">
                <span className="font-semibold leading-none">{day.dayNumber}</span>
                <span className="shrink-0 rounded-full border border-line/40 px-1.5 py-0.5 text-[10px] text-muted">
                  {day.completedCount}/{day.plannedCount}
                </span>
              </div>
              <div className="mt-1 text-[10px] text-muted">{Math.round((day.completionRate || 0) * 100)}%</div>
              <div className="mt-2 min-w-0 space-y-1 overflow-hidden">
                {(Array.isArray(day.blocks) && day.blocks.length
                  ? day.blocks
                  : (day.titles || []).map((title, idx) => ({
                      id: `${day.date || 'day'}-${idx}`,
                      displayTitle: title,
                      title,
                    }))
                )
                  .slice(0, 2)
                  .map((block, idx) => {
                    const meaning = describeBlockMeaning(block, lineageBlocks || day.blocks, {
                      deliverableLabelById,
                      criterionLabelById,
                    });
                    return (
                      <div key={block.id || idx} className="min-w-0 space-y-0.5 overflow-hidden">
                        <div className="text-[10px] leading-tight text-jericho-text" style={clampTwoLinesStyle}>
                          {block.displayTitle || block.title || block.label || 'Untitled task'}
                        </div>
                        {meaning?.lines?.length ? (
                          <div className="space-y-0.5 text-[10px] text-muted">
                            {meaning.lines.slice(0, 3).map((line) => (
                              <div key={line} className="truncate">
                                {line}
                              </div>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                {day.moreCount > 0 ? <div className="text-[10px] text-muted">+{day.moreCount} more</div> : null}
                {!(Array.isArray(day.blocks) && day.blocks.length > 0) && day.gapReasonLabel ? (
                  <div className="text-[10px] text-muted">{day.gapReasonLabel}</div>
                ) : null}
              </div>
            </button>
          ) : (
            <div key={`empty-${index}`} className="min-h-0 bg-jericho-surface/35" />
          )
        )}
      </div>
    </div>
  );
}
