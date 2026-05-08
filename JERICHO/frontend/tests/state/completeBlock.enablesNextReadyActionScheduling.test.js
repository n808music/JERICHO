import { describe, expect, it } from 'vitest';
import {
  assertAutomationItemsHaveContext,
  buildCycleDraftItems,
  hasScheduledOrActiveActionBlock,
  runAdvancementSpine,
} from '../helpers/advancementHarness.js';

describe('completeBlock enables next ready action scheduling', () => {
  it('after completing A, regenerated draft contains B-linked rows with action context', async () => {
    const { bId, postCompletionState } = await runAdvancementSpine({ includeCycle2: false });

    const draft = buildCycleDraftItems(postCompletionState, { cycleId: 'cycle-1' });
    const bInDraft = draft.some((item) => item?.actionId === bId);
    const bMaterialized = hasScheduledOrActiveActionBlock(postCompletionState, { cycleId: 'cycle-1', actionId: bId });
    expect(bInDraft || bMaterialized).toBe(true);

    assertAutomationItemsHaveContext(draft);

    // Progression contract: dependent action is now schedulable in draft and/or materialized schedule.
  });
});
