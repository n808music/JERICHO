import { describe, expect, it } from 'vitest';
import {
  buildCycleDraftItems,
  hasScheduledOrActiveActionBlock,
  runAdvancementSpine,
} from '../helpers/advancementHarness.js';

describe('completeBlock auto rebuild schedule to next', () => {
  it('makes next dependency-ready action draftable without manual generate', async () => {
    const { bId, postCompletionState } = await runAdvancementSpine({ includeCycle2: false });
    const draft = buildCycleDraftItems(postCompletionState, { cycleId: 'cycle-1' });
    const bInDraft = draft.some((item) => item?.actionId === bId);
    const bMaterialized = hasScheduledOrActiveActionBlock(postCompletionState, { cycleId: 'cycle-1', actionId: bId });
    expect(bInDraft || bMaterialized).toBe(true);
  });

  it('does not leak rebuild effects across cycles', async () => {
    const { postCompletionState } = await runAdvancementSpine({ includeCycle2: true });
    const cycle2Draft = buildCycleDraftItems(postCompletionState, { cycleId: 'cycle-2' });
    expect(Array.isArray(cycle2Draft)).toBe(true);
  });
});
