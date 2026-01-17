import React from 'react';

const DAY_COLUMN_HEIGHT_PX = 720;
const MIN_BLOCK_HEIGHT_PX = 16;
const PX_PER_MINUTE = DAY_COLUMN_HEIGHT_PX / 1440;

export default function BlockColumn({ dateLabel = 'Today', blocks = [], onBlockClick }) {
  return (
    <div className="p-3 flex flex-col rounded-xl border border-line/60 bg-jericho-surface/90">
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs uppercase tracking-[0.14em] text-muted">{dateLabel}</p>
        <p className="text-xs text-muted">24h</p>
      </div>
      <div className="relative flex-1" style={{ minHeight: DAY_COLUMN_HEIGHT_PX }}>
        {[0, 6, 12, 18, 24].map((h) => (
          <div
            key={h}
            className="absolute left-0 right-0 border-t border-dashed border-line/20 text-[10px] text-muted"
            style={{ top: `${(h / 24) * 100}%` }}
          >
            <span className="px-1">{`${String(h).padStart(2, '0')}:00`}</span>
          </div>
        ))}
        {(blocks || []).map((block) => {
          const startDate = block?.start ? new Date(block.start) : null;
          const endDate = block?.end ? new Date(block.end) : null;
          const startMin = startDate ? startDate.getHours() * 60 + startDate.getMinutes() : 0;
          const endMin = endDate ? endDate.getHours() * 60 + endDate.getMinutes() : startMin;
          const durationMinutesRaw = (() => {
            const s = startDate ? startDate.getTime() : 0;
            const e = endDate ? endDate.getTime() : 0;
            const diff = (e - s) / 60000;
            return Number.isFinite(diff) ? Math.max(0, diff) : 0;
          })();
          const durationMinutes = durationMinutesRaw;
          let y = startMin * PX_PER_MINUTE;
          let h = Math.max(MIN_BLOCK_HEIGHT_PX, durationMinutes * PX_PER_MINUTE || 0);
          if (!Number.isFinite(y) || !Number.isFinite(h)) {
            y = 0;
            h = MIN_BLOCK_HEIGHT_PX;
          }
          y = Math.min(Math.max(0, y), DAY_COLUMN_HEIGHT_PX - MIN_BLOCK_HEIGHT_PX);
          h = Math.min(h, DAY_COLUMN_HEIGHT_PX - y);
          const label = block.label || `${block.practice || block.domain} block`;
          return (
            <button
              key={block.id || `${label}-${block.start}`}
              data-testid={`block-${block.id || label}`}
              data-block-id={block.id || label}
              className="absolute left-1 right-1 overflow-hidden text-left group rounded-md border border-line/60 bg-white shadow-xs"
              style={{ top: y, height: h }}
              onClick={() => onBlockClick?.(block.id)}
            >
              <div className="h-full w-full px-2 py-1 text-[11px] leading-tight text-jericho-text/90">
                <div className="uppercase tracking-[0.12em] text-muted">{block.practice || block.domain || 'Block'}</div>
                <div className="font-semibold truncate">{label}</div>
                <div className="text-[10px] text-muted">{durationMinutes || 0}m · {block.status || 'pending'}</div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
