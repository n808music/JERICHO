import { describe, expect, it } from 'vitest';
import { inferGoalArchitecture } from './goalArchitectureClassifier';

describe('inferGoalArchitecture', () => {
  it('infers an integrated master-plan lane composition for Operation Endgame style goals', () => {
    const result = inferGoalArchitecture(
      'Build and execute Operation Endgame: a five-to-six-year master plan to scale Global State through the Jericho app, album release, podcast support campaign, project-management brand, record label, production company, real-estate campaign, private school, and district revitalization.'
    );

    expect(result.planningTier).toBe('master_plan');
    expect(result.goalArchitecture).toBe('integrated_master_plan');
    expect(result.executionModel).toBe('multi_lane_portfolio');
    expect(result.primaryLane).toBe('product');
    expect(result.laneComposition).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ domain: 'product', title: 'Product / software' }),
        expect.objectContaining({ domain: 'creative', title: 'Creative project' }),
        expect.objectContaining({ domain: 'media', title: 'Media / content' }),
        expect.objectContaining({ domain: 'brand', title: 'Brand / presence' }),
        expect.objectContaining({ domain: 'capital', title: 'Capital / real estate' }),
        expect.objectContaining({ domain: 'institution', title: 'Institution / education' }),
        expect.objectContaining({ domain: 'civic', title: 'Civic / district development' }),
      ])
    );
  });
});
