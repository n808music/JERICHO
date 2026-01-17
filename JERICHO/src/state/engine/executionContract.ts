import type { ExecutionEvent } from './todayAuthority.ts';

type EventSnapshot = {
  exists: boolean;
  deleted: boolean;
  completed: boolean;
};

const emptySnapshot = () => ({ exists: false, deleted: false, completed: false });

function buildSnapshot(events: ExecutionEvent[] = []) {
  const map = new Map<string, EventSnapshot>();
  (events || []).forEach((event) => {
    if (!event?.blockId) return;
    const current = map.get(event.blockId) || emptySnapshot();
    if (event.kind === 'delete') {
      map.set(event.blockId, { exists: false, deleted: true, completed: false });
      return;
    }
    if (current.deleted) {
      map.set(event.blockId, current);
      return;
    }
    if (event.kind === 'create') {
      map.set(event.blockId, { ...current, exists: true });
      return;
    }
    if (event.kind === 'complete') {
      map.set(event.blockId, { ...current, exists: true, completed: true });
      return;
    }
    if (event.kind === 'update' || event.kind === 'reschedule') {
      map.set(event.blockId, { ...current });
      return;
    }
  });
  return map;
}

export function canEmitExecutionEvent(
  events: ExecutionEvent[] = [],
  event?: ExecutionEvent,
  options: { existingBlockIds?: Set<string> } = {}
) {
  if (!event?.blockId || !event.kind) return false;
  const snapshot = buildSnapshot(events);
  const status = snapshot.get(event.blockId) || emptySnapshot();
  const exists = status.exists || Boolean(options.existingBlockIds?.has(event.blockId));

  if (event.kind === 'create') {
    if (status.deleted) return false;
    if (exists) return false;
    return true;
  }

  if (event.kind === 'delete') {
    return true;
  }

  if (event.kind === 'update') {
    if (!exists || status.deleted) return false;
    if (event.dateISO || event.startISO || event.endISO) return false;
    return true;
  }

  if (event.kind === 'reschedule') {
    if (!exists || status.deleted) return false;
    return true;
  }

  if (event.kind === 'complete') {
    if (!exists || status.deleted) return false;
    return true;
  }

  return false;
}
