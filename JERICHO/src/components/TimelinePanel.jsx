import React from 'react';

function Bar({ label, progress, status }) {
  const tone =
    status === 'blocked'
      ? 'bg-hot/60'
      : status === 'active'
      ? 'bg-jericho-accent'
      : 'bg-muted';
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs text-muted">
        <span>{label}</span>
        <span>{Math.round(progress * 100)}%</span>
      </div>
      <div className="h-2 rounded-full bg-jericho-bg/60 overflow-hidden">
        <div className={`h-full ${tone}`} style={{ width: `${Math.round(progress * 100)}%` }} />
      </div>
    </div>
  );
}

export default function TimelinePanel({ projects = [], goals = [], trajectory = [] }) {
  return (
    <div className="rounded-xl border border-line/60 bg-jericho-surface/90 shadow-glass p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-muted">Trajectory</p>
          <h3 className="text-lg font-semibold">Projects & goals</h3>
        </div>
        <div className="text-xs text-muted">Next 7-30 days</div>
      </div>
      <div className="space-y-3">
        {projects.map((p) => (
          <Bar key={p.id} label={p.name} progress={p.progress} status={p.status} />
        ))}
      </div>
      <div className="border-t border-line/40 pt-3 space-y-2">
        <p className="text-xs uppercase tracking-[0.16em] text-muted">Goals</p>
        <div className="flex flex-wrap gap-2">
          {goals.map((goal) => (
            <span
              key={goal.id}
              className={`px-3 py-1 text-xs rounded-full border ${
                goal.focus ? 'border-jericho-accent text-jericho-accent' : 'border-line/50 text-muted'
              }`}
            >
              {goal.title}
            </span>
          ))}
        </div>
      </div>
      <div className="border-t border-line/40 pt-3">
        <p className="text-xs uppercase tracking-[0.16em] text-muted mb-2">Cycle projection</p>
        <div className="flex items-center gap-2">
          {trajectory.map((value, idx) => (
            <div
              key={`${value}-${idx}`}
              className="flex-1 h-10 rounded-md bg-jericho-bg/60 border border-line/40 flex items-end overflow-hidden"
            >
              <div
                className="w-full bg-jericho-accent"
                style={{ height: `${Math.min(100, value)}%` }}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
