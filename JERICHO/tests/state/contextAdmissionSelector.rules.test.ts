import { describe, expect, it } from 'vitest';
import { getLaneContextSpec, selectContextQuestionsForLane } from '../../src/state/contracts/contextAdmissionMatrix1_0';

describe('context admission selector rules', () => {
  it('asks only required questions first and caps at 3 required', () => {
    const result = selectContextQuestionsForLane({
      archetype: 'Fundraising',
      subtype: 'Angel Raise',
      answeredQuestionIds: [],
      askOptional: true,
    });

    expect(result.requiredQuestionsToAsk).toHaveLength(3);
    expect(result.optionalQuestionsToAsk).toHaveLength(0);
    expect(result.confirmationRequired).toBe(true);
    expect(result.assumptionsApplied.length).toBeGreaterThan(0);
  });

  it('asks up to 2 optional questions only after required are answered', () => {
    const spec = getLaneContextSpec('CreativeProduction', 'Podcast Production');
    const answeredRequiredIds = spec.requiredQuestions.map((q) => q.id);

    const result = selectContextQuestionsForLane({
      archetype: 'CreativeProduction',
      subtype: 'Podcast Production',
      answeredQuestionIds: answeredRequiredIds,
      askOptional: true,
    });

    expect(result.requiredQuestionsToAsk).toHaveLength(0);
    expect(result.optionalQuestionsToAsk.length).toBeLessThanOrEqual(2);
    expect(result.confirmationRequired).toBe(false);
    expect(result.assumptionsApplied).toEqual([]);
  });

  it('keeps total question ask under hard cap of 5', () => {
    const result = selectContextQuestionsForLane({
      archetype: 'SalesPipeline',
      subtype: 'B2B Service Sales',
      answeredQuestionIds: [],
      askOptional: true,
    });

    const totalAsked = result.requiredQuestionsToAsk.length + result.optionalQuestionsToAsk.length;
    expect(totalAsked).toBeLessThanOrEqual(5);
  });
});
