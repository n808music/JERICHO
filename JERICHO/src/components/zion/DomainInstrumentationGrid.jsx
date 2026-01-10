import React from 'react';

// Renders Today domain instrumentation: Target / Scheduled / Completed / Gap per domain.
export default function DomainInstrumentationGrid({ domains = [] }) {
  return (
    <div className="space-y-3">
      <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(2, minmax(0,1fr))' }}>
        {domains.map((d) => (
          <div
            key={d.name}
            className="w-full text-left p-3 rounded-lg border border-line/50 bg-jericho-bg/70 transition group"
          >
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-line/80" aria-hidden />
              <p className="text-sm font-semibold">{d.name}</p>
            </div>
            <div className="mt-2 grid grid-cols-2 gap-1 text-xs text-muted">
              <span>Target: {d.target}m</span>
              <span>Scheduled: {d.scheduled}m</span>
              <span>Completed: {d.completed}m</span>
              <span>Gap: {d.gap}m</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
