import React, { useState } from 'react';
import { DEV } from '../../utils/devFlags.js';

export default function DebugProvenance({ title = 'Debug', metrics, collapsedDefault = true }) {
  if (!DEV || !metrics || !metrics.provenance) return null;
  const [open, setOpen] = useState(!collapsedDefault);
  const { provenance = {}, plannedMinutes = 0, completedMinutes = 0, cr = 0 } = metrics;
  const excludedCounts = (provenance.excluded || []).reduce((acc, e) => {
    acc[e.reason] = (acc[e.reason] || 0) + 1;
    return acc;
  }, {});

  return (
    <div className="mt-2 rounded-lg border border-line/60 bg-jericho-surface/80 p-2 text-[11px] text-muted">
      <div className="flex items-center justify-between">
        <span className="font-semibold text-jericho-text">{title}</span>
        <button className="text-[11px] text-jericho-accent" onClick={() => setOpen((v) => !v)}>
          {open ? 'Hide' : 'Show'}
        </button>
      </div>
      {open ? (
        <div className="mt-1 space-y-1">
          <p>Planned: {Math.round(plannedMinutes)}m · Completed: {Math.round(completedMinutes)}m · CR: {Math.round(cr * 100)}%</p>
          <p>
            Window: {provenance.window?.kind} [{provenance.window?.startDayKey || '—'} →{' '}
            {provenance.window?.endDayKeyExclusive || '—'}) · Mode: {provenance.mode || 'calendar'}
          </p>
          <p>
            Included: {provenance.includedBlockIds?.length || 0} · Excluded:{' '}
            {Object.entries(excludedCounts)
              .map(([k, v]) => `${k}:${v}`)
              .join(', ') || '0'}
          </p>
          {provenance.summary ? (
            <p>
              Unknown: blocks {provenance.summary.unknownBlocks || 0} · planned {provenance.summary.unknownPlannedMinutes || 0}m ·
              completed {provenance.summary.unknownCompletedMinutes || 0}m
            </p>
          ) : null}
          <p>
            Sample IDs: {provenance.includedBlockIds?.slice(0, 5).join(', ') || '—'}{' '}
            {provenance.excluded?.length ? `| Excluded: ${provenance.excluded.slice(0, 5).map((e) => `${e.id}:${e.reason}`).join(', ')}` : ''}
          </p>
        </div>
      ) : null}
    </div>
  );
}
