import { describe, expect, it } from 'vitest';
import { classifyGoalPlanningTier } from './planningTierClassifier';

describe('classifyGoalPlanningTier', () => {
  it('classifies the multi-lane Oct 17 ecosystem goal as master_plan', () => {
    const tier = classifyGoalPlanningTier(
      'Build and coordinate a multi-lane master plan from today through October 17, centered on releasing my album and launching the supporting ecosystem around it. The plan should organize the album/label launch, Jericho app launch, podcast rollout, project-management brand, and income/runway work into clear lanes, milestones, and execution phases.'
    );
    expect(tier).toBe('master_plan');
  });

  it('does not classify the EP release goal as master_plan', () => {
    const tier = classifyGoalPlanningTier(
      'Finish and release a polished 3-song EP in 45 days so I have final recordings, cover art, distribution setup, and a ready release package.'
    );
    expect(tier).toBe('short_term_complex');
  });

  it('does not classify the gum launch goal as master_plan', () => {
    const tier = classifyGoalPlanningTier(
      'Launch a caffeinated gum brand and make my first real sale in 9 months.',
      { goalType: 'physical_product', isConsumable: true }
    );
    expect(tier).toBe('long_term_complex');
  });
});
