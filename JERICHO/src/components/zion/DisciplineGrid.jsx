import React from 'react';
import DisciplineTile from './DisciplineTile.jsx';

export default function DisciplineGrid({ domains = [], horizons = [], data = {}, onInsert, onReveal }) {
  return (
    <div className="space-y-3">
      <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(2, minmax(0,1fr))' }}>
        {domains.map((domain) => {
          const tile = data[domain]?.[horizons[0]];
          return tile ? (
            <DisciplineTile
              key={`${domain}-${horizons[0]}`}
              domain={domain}
              horizon={horizons[0]}
              label={tile.label}
              state={tile.state}
              metric={tile.metric}
              delta={tile.delta}
              onInsert={tile.onInsert || onInsert}
              onReveal={() => (tile.onReveal ? tile.onReveal() : onReveal?.(tile))}
            />
          ) : (
            <div
              key={`${domain}-${horizons[0]}`}
              className="p-3 text-xs text-muted flex items-center justify-center"
            >
              —
            </div>
          );
        })}
      </div>
    </div>
  );
}
