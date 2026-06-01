import { describe, expect, it } from 'vitest';
import { generateRecoveryRecommendation } from '../../src/state/engine/recoveryRecommendationEngine';

const signal = (code: any) => ({ code, severity: 'warning', evidence: {}, laneKey: 'x::y' });

describe('recoveryRecommendationEngine baseline', () => {
  it('returns lane-specific recommendation for podcast production', () => {
    const recommendation = generateRecoveryRecommendation({
      laneKey: 'CreativeProduction::Podcast Production',
      driftSignals: [signal('OUTPUT_DELAY'), signal('CAPACITY_OVERRUN')],
      failureClasses: [{ code: 'SCOPE_OVERLOAD', confidence: 'high', basedOn: ['OUTPUT_DELAY', 'CAPACITY_OVERRUN'] }],
      contextState: {},
    });

    expect(recommendation.proposedAdjustment.toLowerCase()).toContain('trailer plus first episode');
    expect(recommendation.recoveryLevers).toContain('REDUCE_SCOPE');
    expect(recommendation.issueDetected.toLowerCase()).not.toContain('work harder');
  });

  it('returns lane-specific recommendation for certification exam readiness drift', () => {
    const recommendation = generateRecoveryRecommendation({
      laneKey: 'ProfessionalQualification::Certification Exam',
      driftSignals: [signal('LOW_READINESS')],
      failureClasses: [{ code: 'READINESS_GAP', confidence: 'high', basedOn: ['LOW_READINESS'] }],
      contextState: {},
    });

    expect(recommendation.proposedAdjustment.toLowerCase()).toContain('weak domains');
    expect(recommendation.recoveryLevers).toContain('INCREASE_REMEDIATION');
  });
});
