import React from 'react';
import { explainTaskReasons } from '../core/explanations.js';

export default function TaskStreamPanel({ tasks = [], onComplete, onAck }) {
  return (
    <div className="rounded-xl border border-line/60 bg-jericho-surface/90 shadow-glass p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-muted">Timeline</p>
          <h3 className="text-lg font-semibold">Today’s work</h3>
        </div>
        <div className="text-xs text-muted">{tasks.length} active</div>
      </div>
      <div className="space-y-3">
        {tasks.map((task) => {
          const explanation = task.explanation || explainTaskReasons(task);
          return (
            <div
              key={task.id}
              className="rounded-lg border border-line/40 bg-jericho-bg/70 p-3 flex flex-col gap-2"
            >
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold">{task.title}</p>
                  <p className="text-xs text-muted">{explanation.headline}</p>
                </div>
                <span className="px-2 py-1 text-[11px] uppercase tracking-[0.12em] rounded-full bg-jericho-accent text-jericho-bg">
                  {task.decision}
                </span>
              </div>
              <ul className="text-xs text-jericho-text/80 space-y-1">
                {explanation.details.map((d, idx) => (
                  <li key={idx}>• {d}</li>
                ))}
              </ul>
              <div className="flex gap-2">
                {onComplete ? (
                  <button
                    className="px-3 py-1 text-xs font-semibold rounded-md bg-jericho-accent text-jericho-bg"
                    onClick={() => onComplete(task.id)}
                  >
                    Complete
                  </button>
                ) : null}
                {onAck ? (
                  <button
                    className="px-3 py-1 text-xs font-semibold rounded-md bg-glass border border-line/50"
                    onClick={() => onAck(task.id)}
                  >
                    Ack
                  </button>
                ) : null}
              </div>
            </div>
          );
        })}
        {tasks.length === 0 ? (
          <div className="rounded-lg border border-dashed border-line/40 p-3 text-sm text-muted">
            No tasks queued for today.
          </div>
        ) : null}
      </div>
    </div>
  );
}
