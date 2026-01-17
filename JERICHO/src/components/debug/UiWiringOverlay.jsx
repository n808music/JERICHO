import React from 'react';
import { DEV } from '../../utils/devFlags.js';
import { getWiringTraces, subscribeWiringTraces } from '../../dev/uiWiringTrace.ts';
import { UI_AUTHORITY_MAP } from '../../contracts/uiAuthorityMap.ts';

export default function UiWiringOverlay({ open }) {
  const [traces, setTraces] = React.useState(() => getWiringTraces());

  React.useEffect(() => {
    if (!DEV || !open) return undefined;
    setTraces(getWiringTraces());
    return subscribeWiringTraces((next) => setTraces(next));
  }, [open]);

  if (!DEV || !open) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 w-[360px] rounded-xl border border-line/60 bg-jericho-surface/95 p-3 text-[11px] text-muted shadow-lg">
      <div className="flex items-center justify-between mb-2">
        <span className="uppercase tracking-[0.16em] text-[10px] text-muted">UI Wiring</span>
        <span className="text-[10px] text-muted">
          {traces.length} traces · {Object.keys(UI_AUTHORITY_MAP).length} mapped
        </span>
      </div>
      <div className="space-y-2 max-h-[320px] overflow-auto">
        {!traces.length ? <p className="text-[11px] text-muted">No traces yet.</p> : null}
        {traces.map((trace, idx) => (
          <div key={`${trace.atISO}-${idx}`} className="rounded border border-line/40 px-2 py-1">
            <div className="flex items-center justify-between">
              <span className="text-jericho-text">{trace.name}</span>
              <span className="text-[10px] text-muted">{trace.type}</span>
            </div>
            <div className="text-[10px] text-muted">{trace.atISO}</div>
            {trace.reason ? <div className="text-[10px] text-amber-600">{trace.reason}</div> : null}
          </div>
        ))}
      </div>
    </div>
  );
}
