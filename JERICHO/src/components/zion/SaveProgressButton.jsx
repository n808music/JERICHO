import React, { useCallback, useState } from 'react';

import { useIdentityStore } from '../../state/identityStore';

function nowLabel() {
  try {
    return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
}

// Explicit, user-triggered durable save to the backend with a visible result.
// Auto-persist to LocalStorage still happens on every change; this button gives
// the operator a confirmed, server-side save (survives LocalStorage loss).
export default function SaveProgressButton() {
  const store = useIdentityStore();
  const [status, setStatus] = useState(null);
  const [busy, setBusy] = useState(false);

  const onSave = useCallback(async () => {
    setStatus(null);
    setBusy(true);
    try {
      const result =
        typeof store?.saveProgress === 'function'
          ? await store.saveProgress()
          : { ok: false, error: 'unavailable' };
      if (result?.ok) {
        setStatus({ kind: 'success', message: `Saved ${nowLabel()}` });
      } else {
        const detail = result?.status ? ` (${result.status})` : '';
        setStatus({
          kind: 'error',
          message: `Save failed${detail} — your work is still stored locally.`,
        });
      }
    } catch (err) {
      setStatus({ kind: 'error', message: `Save failed: ${err?.message || String(err)}` });
    } finally {
      setBusy(false);
    }
  }, [store]);

  return (
    <span className="inline-flex items-center gap-2">
      <button
        type="button"
        onClick={onSave}
        disabled={busy}
        className="rounded-full border border-line/60 px-3 py-1 text-xs text-muted hover:text-jericho-accent disabled:opacity-50"
        title="Save your current progress to the server"
      >
        {busy ? 'Saving…' : 'Save Progress'}
      </button>
      {status ? (
        <span
          role={status.kind === 'error' ? 'alert' : 'status'}
          data-testid="save-progress-status"
          className={status.kind === 'error' ? 'text-[11px] text-red-500' : 'text-[11px] text-emerald-500'}
        >
          {status.message}
        </span>
      ) : null}
    </span>
  );
}
