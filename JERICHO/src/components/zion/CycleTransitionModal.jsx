import React from 'react';

export default function CycleTransitionModal({ open, onArchive, onDelete, onCancel }) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Start a new cycle"
    >
      <div className="w-full max-w-md rounded-xl border border-line/60 bg-jericho-surface p-4 shadow-xl">
        <h2 className="text-base font-semibold text-jericho-text">Start a new cycle?</h2>
        <p className="mt-2 text-sm text-muted">
          Your current cycle will be archived or deleted before starting a new one.
        </p>

        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={onArchive}
            className="rounded-full border border-line/60 px-3 py-1.5 text-xs text-jericho-text hover:text-jericho-accent"
          >
            Archive current cycle
          </button>
          <button
            type="button"
            onClick={onDelete}
            className="rounded-full border border-red-600 px-3 py-1.5 text-xs text-red-600 hover:bg-red-600/10"
          >
            Delete current cycle
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="rounded-full border border-line/40 px-3 py-1.5 text-xs text-muted"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
