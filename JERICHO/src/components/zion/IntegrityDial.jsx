import React from 'react';

function normalize(value, min = 0, max = 100) {
  if (max === min) return 0;
  const clamped = Math.max(min, Math.min(max, value));
  return ((clamped - min) / (max - min)) * 100;
}

export default function IntegrityDial({ metrics = {} }) {
  const completion = normalize(metrics.completionRate || 0);
  const drift = 100 - normalize(metrics.driftIndex || 0, 0, 100);
  const streak = normalize(metrics.streak || 0, 0, 14);
  const momentum = normalize((metrics.cycleHistory || []).slice(-3).reduce((a, b) => a + b, 0) / 3 || 0);

  const slices = [
    { label: 'Completion', value: completion, color: '#ef4444' }, // red
    { label: 'Low drift', value: drift, color: '#3b82f6' }, // blue
    { label: 'Streak', value: streak, color: '#16a34a' }, // distinct green
    { label: 'Momentum', value: momentum, color: '#0ea5e9' } // cyan/blue-green
  ];

  const total = slices.reduce((sum, s) => sum + s.value, 0) || 1;
  let current = 0;
  const gradient = slices
    .map((s) => {
      const start = (current / total) * 100;
      const end = ((current + s.value) / total) * 100;
      current += s.value;
      return `${s.color} ${start}% ${end}%`;
    })
    .join(', ');

  const strengthLabel = (v) => {
    if (v >= 70) return 'strong';
    if (v >= 40) return 'steady';
    return 'weak';
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="relative h-32 w-32">
          <div
            className="absolute inset-0 rounded-full"
            style={{ background: `conic-gradient(${gradient})` }}
            aria-hidden
          />
          <div className="absolute inset-3 rounded-full bg-jericho-surface border border-line/60 flex flex-col items-center justify-center text-center">
            <p className="text-xs uppercase tracking-[0.14em] text-muted">Stability</p>
            <p className="text-sm font-semibold">Identity Vector</p>
            <p className="text-[11px] text-muted">On request</p>
          </div>
        </div>
        <div className="flex-1 space-y-2 text-sm">
          {slices.map((s) => (
            <div key={s.label} className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: s.color }} aria-hidden />
              <span className="text-muted">{s.label}</span>
              <span className="ml-auto font-semibold capitalize">{strengthLabel(s.value)}</span>
            </div>
          ))}
        </div>
      </div>
      <p className="text-xs text-muted">
        Stability reflects alignment, drift resistance, streak consistency, and momentum—surface it when you need a read.
      </p>
    </div>
  );
}
