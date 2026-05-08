import { describe, expect, it } from 'vitest';
import { buildStabilityEndToEndSummary } from '../../src/state/contracts/stabilityEndToEndVerification';

describe('stability end-to-end verification summary', () => {
  it('builds deterministic 45-lane end-to-end summary with admission, context, compile, quality, and runtime integrity fields', () => {
    const summary = buildStabilityEndToEndSummary();

    expect(summary.totalLanes).toBe(45);
    expect(summary.contextCoverage.canonicalLaneCount).toBe(45);
    expect(summary.contextCoverage.authoredLaneCount).toBe(45);
    expect(summary.contextCoverage.missingAuthored).toEqual([]);

    const aggregateTotal = summary.passCount + summary.warnCount + summary.failCount;
    expect(aggregateTotal).toBe(45);
    expect(Object.keys(summary.byArchetype)).toHaveLength(9);

    summary.laneVerifications.forEach((lane) => {
      expect(lane.admission.detectedArchetype).toBe(lane.archetype);
      expect(lane.admission.detectedSubtype).toBe(lane.subtype);
      expect(lane.context.requiredQuestionsAsked).toBe(3);
      expect(lane.compilation.outputCount).toBeGreaterThan(0);
      expect(lane.compilation.actionCount).toBeGreaterThan(0);
      expect(lane.quality.overall).toMatch(/pass|warn|fail/);
      expect(Array.isArray(lane.runtimeIntegrity.issues)).toBe(true);
      expect(typeof lane.recovery.signalCount).toBe('number');
      expect(lane.recovery.recommendation.issueDetected.length).toBeGreaterThan(0);
      expect(typeof lane.recovery.recommendation.confirmationRequired).toBe('boolean');
    });
  });
});
