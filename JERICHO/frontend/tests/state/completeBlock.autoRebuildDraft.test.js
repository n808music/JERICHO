import { describe, expect, it } from 'vitest';
import {
  buildCycleDraftItems,
  hasScheduledOrActiveActionBlock,
  runAdvancementSpine,
} from '../helpers/advancementHarness.js';

describe('completeBlock auto rebuild draft schedule', () => {
  it('rebuilds preview drafting after completing an action-linked block', async () => {
    const { bId, postCompletionState } = await runAdvancementSpine({ includeCycle2: false });
    const rebuiltDraft = buildCycleDraftItems(postCompletionState, { cycleId: 'cycle-1' });
    const bInDraft = rebuiltDraft.some((item) => item?.actionId === bId);
    const bMaterialized = hasScheduledOrActiveActionBlock(postCompletionState, { cycleId: 'cycle-1', actionId: bId });
    expect(bInDraft || bMaterialized).toBe(true);
  });

  it('keeps auto-rebuild scoped to the completed block cycle', async () => {
    const { postCommitState, postCompletionState } = await runAdvancementSpine({ includeCycle2: true });
    const cycle2Before = postCommitState.cyclesById?.['cycle-2']?.coldPlan || {};
    const cycle2After = postCompletionState.cyclesById?.['cycle-2']?.coldPlan || {};
    expect(cycle2After).toEqual(cycle2Before);
  });
});
