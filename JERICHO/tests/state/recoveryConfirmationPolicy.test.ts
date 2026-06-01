import { describe, expect, it } from 'vitest';
import { requiresRecoveryConfirmation } from '../../src/state/engine/recoveryConfirmationPolicy';

describe('recovery confirmation policy', () => {
  it('does not require confirmation for low-risk structural shifts', () => {
    const result = requiresRecoveryConfirmation({
      laneKey: 'JobSearchPipeline::Corporate Role Search',
      recoveryLevers: ['REORDER_DEPENDENCIES', 'SHIFT_SCHEDULE_DENSITY'],
      proposedAdjustment: 'Reorder interview prep after material refresh and rebalance weekly blocks.',
    });

    expect(result.confirmationRequired).toBe(false);
  });

  it('requires confirmation for success-definition changes', () => {
    const result = requiresRecoveryConfirmation({
      laneKey: 'CreativeProduction::Podcast Production',
      recoveryLevers: ['REDUCE_SCOPE'],
      proposedAdjustment: 'Reduce launch from 3 episodes to trailer plus first episode.',
      affectsSuccessDefinition: true,
    });

    expect(result.confirmationRequired).toBe(true);
    expect(String(result.reason || '').length).toBeGreaterThan(0);
  });

  it('requires confirmation when context is insufficient', () => {
    const result = requiresRecoveryConfirmation({
      laneKey: 'Fundraising::Angel Raise',
      recoveryLevers: ['ESCALATE_CONTEXT'],
      proposedAdjustment: 'Escalate missing raise target and investor-fit context.',
      insufficientContext: true,
    });

    expect(result.confirmationRequired).toBe(true);
  });
});
