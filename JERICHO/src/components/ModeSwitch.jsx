import React from 'react';
import { useJericho } from '../core/state.js';

const options = [
  { key: 'discipline', label: 'Discipline (micro)' },
  { key: 'zion', label: 'Zion (macro)' }
];

export default function ModeSwitch() {
  const { mode, switchMode } = useJericho();

  return (
    <div className="flex rounded-full border border-line/60 bg-jericho-surface/80 shadow-glass overflow-hidden">
      {options.map((opt) => {
        const active = mode === opt.key;
        return (
          <button
            key={opt.key}
            onClick={() => switchMode(opt.key)}
            className={`px-4 py-2 text-sm font-semibold transition ${
              active
                ? 'bg-jericho-accent text-jericho-bg'
                : 'text-jericho-text hover:bg-glass'
            }`}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
