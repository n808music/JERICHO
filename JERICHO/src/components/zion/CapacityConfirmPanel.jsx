import React from 'react';
import { useIdentityStore } from '../../state/identityStore.js';

const STATUS_LABEL = { CONFIRMED: 'CONFIRMED', NEEDS_REVIEW: 'NEEDS REVIEW', DRAFT: 'DRAFT' };
const STATUS_COLOR = { CONFIRMED: '#16a34a', NEEDS_REVIEW: '#ca8a04', DRAFT: '#6b7280' };

/**
 * Deliberately separate from MasterGridTab (which is read-only by design — see its AC4
 * "never calls matrixDispatch" test). This is the one small write-capable surface for the
 * 2026-07-13 capacity design: a carried-forward capacity row lands here as DRAFT (seeded
 * automatically from whatever work-windows data already existed, no re-entry required) and
 * a single click promotes it to CONFIRMED — no elicitation-engine survey involved.
 */
export function CapacityConfirmPanel() {
  const store = useIdentityStore();
  const capacityById = store?.matrix?.capacityById || {};
  const rows = Object.values(capacityById).filter(Boolean);

  if (rows.length === 0) {
    return null;
  }

  return (
    <div data-testid="capacity-confirm-panel" className="space-y-2">
      <div className="text-xs uppercase tracking-[0.14em] text-muted">Allocation</div>
      <div className="text-xs text-muted">Confirm each entity's allocation — its attested split of the one shared pool, not a supply.</div>
      {rows.map((row) => (
        <div
          key={row.id}
          data-testid="capacity-confirm-row"
          className="flex items-center justify-between rounded-lg border border-line/60 bg-jericho-surface/90 p-3 text-sm"
        >
          <div>
            <div className="font-medium">{row.name}</div>
            <div style={{ color: STATUS_COLOR[row.reviewStatus] }} className="text-xs">
              {STATUS_LABEL[row.reviewStatus] || row.reviewStatus}
              {row.source === 'carried_forward' ? ' — carried forward from existing settings' : ''}
            </div>
          </div>
          {row.reviewStatus !== 'CONFIRMED' && (
            <button
              type="button"
              data-testid={`confirm-capacity-${row.id}`}
              onClick={() => store.matrixDispatch?.({ type: 'CONFIRM_CAPACITY', payload: { id: row.id } })}
              className="rounded border border-line/60 px-3 py-1 text-xs font-medium"
            >
              Confirm
            </button>
          )}
        </div>
      ))}
    </div>
  );
}

export default CapacityConfirmPanel;
