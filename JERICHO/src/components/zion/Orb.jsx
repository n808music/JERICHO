import React from 'react';

const STATE_STYLES = {
  'on-track': 'border-jericho-accent shadow-[0_0_0_4px_rgba(72,211,190,0.12)]',
  drifting: 'border-amber-400 shadow-[0_0_0_4px_rgba(251,191,36,0.12)]',
  'off-track': 'border-hot shadow-[0_0_0_4px_rgba(248,113,113,0.12)]',
  neutral: 'border-line/70 shadow-[0_0_0_4px_rgba(255,255,255,0.04)]'
};

export default function Orb({ state = 'neutral', label, delta, size = 'md' }) {
  const tone = STATE_STYLES[state] || STATE_STYLES.neutral;
  const dimension = size === 'lg' ? 'h-12 w-12' : size === 'sm' ? 'h-6 w-6' : 'h-8 w-8';
  return (
    <div className="flex items-center gap-2">
      <span
        className={`rounded-full border-2 ${tone} ${dimension} flex items-center justify-center bg-jericho-bg`}
      >
        <span className="h-2.5 w-2.5 rounded-full bg-current" />
      </span>
      {label ? <span className="text-xs text-muted">{label}</span> : null}
      {delta !== undefined ? (
        <span className="text-[11px] text-muted/80">{delta > 0 ? `+${delta}` : delta}</span>
      ) : null}
    </div>
  );
}
