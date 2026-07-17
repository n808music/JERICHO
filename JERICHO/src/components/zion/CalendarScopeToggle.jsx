import React from 'react';
import { BLOCK_SCOPE_KINDS } from '../../domain/masterGrid/filterCalendarBlocksByScope.js';

// Gate 8 calendar scope toggle. Two levels: Full (default) + a class chip; selecting a class
// reveals its node options, each isolating that specific node's calendar blocks (node-level).
// Unowned Systems surface as their own explicit "(unowned)" option — never hidden, never
// attached to a guessed entity. Read-only over the schedule: it only changes which blocks the
// calendar shows; the caller keeps the full list, so Full restores the complete schedule.
export function CalendarScopeToggle({ options = {}, scope = 'full', onScope }) {
  const [openClass, setOpenClass] = React.useState(null);
  const activeKind = scope && scope !== 'full' ? scope.kind : null;
  const activeId = scope && scope !== 'full' ? scope.id : null;
  const classes = BLOCK_SCOPE_KINDS.filter((k) => (options[k] || []).length > 0);
  if (classes.length === 0) return null;
  const expanded = openClass || activeKind;

  const chip = (active) =>
    `rounded px-2 py-1 border ${active ? 'border-jericho-accent text-jericho-accent font-medium' : 'border-line/60 text-muted'}`;

  return (
    <div data-testid="calendar-scope-toggle" className="space-y-1">
      <div className="flex flex-wrap items-center gap-1 text-xs">
        <span className="uppercase tracking-[0.14em] text-muted pr-1">Isolate</span>
        <button
          type="button"
          data-testid="calendar-scope-full"
          onClick={() => { onScope?.('full'); setOpenClass(null); }}
          aria-pressed={scope === 'full'}
          className={chip(scope === 'full')}
        >
          Full
        </button>
        {classes.map((k) => (
          <button
            key={k}
            type="button"
            data-testid={`calendar-scope-class-${k}`}
            onClick={() => setOpenClass(openClass === k ? null : k)}
            aria-pressed={activeKind === k}
            className={chip(activeKind === k)}
          >
            {k}
          </button>
        ))}
      </div>
      {expanded && (options[expanded] || []).length > 0 && (
        <div data-testid="calendar-scope-nodes" className="flex flex-wrap gap-1 pl-2 text-xs">
          {(options[expanded] || []).map((opt) => (
            <button
              key={opt.id}
              type="button"
              data-testid="calendar-scope-node"
              onClick={() => onScope?.({ kind: expanded, id: opt.id })}
              aria-pressed={activeKind === expanded && activeId === opt.id}
              className={chip(activeKind === expanded && activeId === opt.id)}
            >
              {opt.label}{opt.unowned ? ' (unowned)' : ''} · {opt.count}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default CalendarScopeToggle;
