import { describe, expect, it } from 'vitest';
import {
  scoreExecutionSpecBaseline,
  summarizeExecutionScorecards,
} from '../../src/state/contracts/archetypeExecutionScorecard';

describe('archetype execution scorecard baseline', () => {
  it('builds scorecards for all 45 lanes and all 6 quality dimensions', () => {
    const scorecards = scoreExecutionSpecBaseline();
    expect(scorecards).toHaveLength(45);

    scorecards.forEach((scorecard) => {
      expect(scorecard.results).toHaveLength(6);
      const dimensions = scorecard.results.map((result) => result.dimension);
      expect(dimensions).toContain('classificationQuality');
      expect(dimensions).toContain('outputQuality');
      expect(dimensions).toContain('actionQuality');
      expect(dimensions).toContain('scheduleQuality');
      expect(dimensions).toContain('correctionQuality');
      expect(dimensions).toContain('progressTrackingQuality');
    });
  });

  it('passes baseline matrix quality checks for all lanes', () => {
    const summary = summarizeExecutionScorecards(scoreExecutionSpecBaseline());
    expect(summary.laneCount).toBe(45);
    expect(summary.overall.fail).toBe(0);
    expect(summary.overall.warn).toBe(0);
    expect(summary.overall.pass).toBe(45);
  });
});
