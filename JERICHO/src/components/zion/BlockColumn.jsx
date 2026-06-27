import React from 'react';
import { describeBlockMeaning } from './blockMeaning.js';
import { localMinutesFromISO } from '../../state/time/time.ts';

const DAY_COLUMN_HEIGHT_PX = 720;
const MIN_BLOCK_HEIGHT_PX = 16;
const PX_PER_MINUTE = DAY_COLUMN_HEIGHT_PX / 1440;

export default function BlockColumn({
  dateLabel = 'Today',
  blocks = [],
  drafts = [],
  timeZone = 'UTC',
  onBlockClick,
  selectedBlockId = null,
  lineageBlocks = null,
  deliverableLabelById = {},
  criterionLabelById = {},
}) {
  const visibleDrafts = (drafts || []).filter((draft) => {
    if (!draft?.startISO) return false;
    const date = new Date(draft.startISO);
    return Number.isFinite(date.getTime());
  });
  const lineageSource = Array.isArray(lineageBlocks) && lineageBlocks.length > 0 ? lineageBlocks : blocks;

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
          const startISO = block?.startISO || block?.start || '';
          const endISO = block?.endISO || block?.end || '';
          const startDate = startISO ? new Date(startISO) : null;
          const endDate = endISO ? new Date(endISO) : null;
          const startMin = localMinutesFromISO(startISO, timeZone);
          const endMin = endISO ? localMinutesFromISO(endISO, timeZone) : startMin;
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
          const label = block.displayTitle || block.title || block.label || 'Untitled task';
          const meaning = describeBlockMeaning(block, lineageSource, {
            deliverableLabelById,
            criterionLabelById,
          });
          return (
            <button
              key={block.id || `${label}-${block.start}`}
              data-testid={`block-${block.id || label}`}
              data-block-id={block.id || label}
              aria-pressed={String(selectedBlockId === (block.id || label))}
              className="absolute left-1 right-1 overflow-hidden text-left group rounded-md border border-line/60 bg-white shadow-xs"
              style={{ top: y, height: h }}
              onClick={() => onBlockClick?.(block.id)}
            >
              <div className="h-full w-full px-2 py-1 text-[11px] leading-tight text-jericho-text/90">
                <div className="font-semibold truncate">{label}</div>
                {meaning?.lines?.length ? (
                  <div className="mt-0.5 space-y-0.5 text-[10px] text-muted">
                    {meaning.lines.slice(0, 3).map((line) => (
                      <div key={line} className="truncate">
                        {line}
                      </div>
                    ))}
                  </div>
                ) : null}
                <div className="text-[10px] text-muted">
                  {durationMinutes || 0}m · {block.status || 'pending'}
                </div>
              </div>
            </button>
          );
        })}
        {visibleDrafts.map((draft) => {
          const startMin = localMinutesFromISO(draft?.startISO || '', timeZone);
          const durationMinutes = Number.isFinite(draft?.minutes) ? draft.minutes : 30;
          let y = startMin * PX_PER_MINUTE;
          let h = Math.max(MIN_BLOCK_HEIGHT_PX, durationMinutes * PX_PER_MINUTE || 0);
          if (!Number.isFinite(y) || !Number.isFinite(h)) {
            y = 0;
            h = MIN_BLOCK_HEIGHT_PX;
          }
          y = Math.min(Math.max(0, y), DAY_COLUMN_HEIGHT_PX - MIN_BLOCK_HEIGHT_PX);
          h = Math.min(h, DAY_COLUMN_HEIGHT_PX - y);
          return (
            <div
              key={draft.id}
              data-testid={`ghost-${draft.id}`}
              className="absolute left-1 right-1 overflow-hidden rounded-md border border-dashed border-amber-400/60 bg-amber-50/70"
              style={{ top: y, height: h }}
            >
              <div className="h-full w-full px-2 py-1 text-[11px] leading-tight text-amber-700">
                <div className="uppercase tracking-[0.12em] text-amber-500">Draft</div>
                <div className="font-semibold truncate">{draft.displayTitle || draft.title}</div>
                <div className="text-[10px]">
                  {durationMinutes}m · {draft.domainKey || 'Draft'}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
