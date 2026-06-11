import { describe, expect, it } from 'vitest';

import { makeSyntheticCalendarBlock } from '../helpers/longHorizonHarness.js';

function getCalendarSurfaceIdentity(block) {
  const stableId = String(block?.id || '').trim();
  if (stableId) {
    return `id:${stableId}`;
  }
  const dayKey = String(block?.dayKey || block?.date || '').trim();
  const start = String(block?.start || block?.startISO || '').trim();
  const title = String(block?.displayTitle || block?.title || block?.label || '').trim();
  return `shape:${dayKey}:${start}:${title}`;
}

function mergeCalendarSurfaceBlocks(committed = [], forecast = []) {
  const ordered = [...committed, ...forecast];
  const deduped = new Map();
  ordered.forEach((block) => {
    const identity = getCalendarSurfaceIdentity(block);
    if (!deduped.has(identity)) {
      deduped.set(identity, block);
    }
  });
  return Array.from(deduped.values());
}

describe('long-horizon merge behavior', () => {
  it('deduplicates equivalent committed and forecast blocks by stable id', () => {
    const block = makeSyntheticCalendarBlock({ id: 'same-id' });
    const merged = mergeCalendarSurfaceBlocks([block], [{ ...block }]);
    expect(merged).toHaveLength(1);
  });

  it('falls back to shape identity when id is unavailable', () => {
    const committed = makeSyntheticCalendarBlock({ id: '', title: 'Fallback block' });
    const forecast = makeSyntheticCalendarBlock({ id: null, title: 'Fallback block' });
    const merged = mergeCalendarSurfaceBlocks([committed], [forecast]);
    expect(merged).toHaveLength(1);
  });

  it('preserves distinct blocks when the identity differs', () => {
    const committed = makeSyntheticCalendarBlock({ id: 'block-a' });
    const forecast = makeSyntheticCalendarBlock({ id: 'block-b' });
    const merged = mergeCalendarSurfaceBlocks([committed], [forecast]);
    expect(merged).toHaveLength(2);
  });
});
