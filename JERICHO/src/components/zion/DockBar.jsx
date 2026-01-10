import React from 'react';

const PRINCIPLES = ['Definite Goal', 'Pattern Lens'];

export default function DockBar({ onDock }) {
  return (
    <div className="flex flex-wrap gap-2 justify-center text-sm">
      {PRINCIPLES.map((p) => (
        <button
          key={p}
          onClick={() => onDock?.(p)}
          className="px-3 py-2 rounded-lg border border-line/60 text-muted hover:border-jericho-accent/70"
        >
          {p}
        </button>
      ))}
    </div>
  );
}
