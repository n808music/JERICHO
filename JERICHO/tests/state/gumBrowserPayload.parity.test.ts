import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

describe('gum browser payload parity', () => {
  it('captures the live browser pre-apply planning state shape', () => {
    const fixturePath = path.resolve(process.cwd(), 'tests/fixtures/gum/live-browser-jericho-identity.json');

    const state = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));
    const cycle = state.cyclesById?.[state.activeCycleId];

    expect(state.activeCycleId).toBeTruthy();
    expect(cycle).toBeTruthy();

    expect(cycle.goalContract).toBeTruthy();

    // This fixture is pre-apply review-state evidence, not committed execution state.
    expect(cycle.policyState).toBeFalsy();
    expect(cycle.scheduledBlocks).toBeFalsy();
    expect(cycle.blocks).toBeFalsy();

    // Preserve the live mismatch: active-cycle proposedBlocks is empty even though review material exists.
    expect(Array.isArray(cycle.proposedBlocks)).toBe(true);
    expect(cycle.proposedBlocks).toHaveLength(0);

    expect(cycle.planDraft).toBeFalsy();
    expect(cycle.planPreview).toBeFalsy();
    expect(cycle.planProof).toBeTruthy();
    expect(cycle.planStatus).toBe('generating');

    const cycleReviewCount = Array.isArray(cycle.scheduleReviewBlocks) ? cycle.scheduleReviewBlocks.length : 0;
    const topLevelReviewCount = Array.isArray(state.scheduleReviewBlocks) ? state.scheduleReviewBlocks.length : 0;
    const topLevelProposedCount = Array.isArray(state.proposedBlocks) ? state.proposedBlocks.length : 0;

    expect(cycleReviewCount).toBe(0);
    expect(topLevelReviewCount).toBe(0);
    expect(topLevelProposedCount).toBe(0);
    expect(state.goalPolicyByGoalId).toEqual({});
    expect(state.planQualityGateByGoal).toEqual({});
  });
});
