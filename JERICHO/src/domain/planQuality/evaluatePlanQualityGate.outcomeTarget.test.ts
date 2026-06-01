/**
 * Outcome Target enforcement (Phase 2 — Execution Professionalism Remediation).
 *
 * Externally-mediated and semi-controllable plans must declare a falsifiable
 * terminal target. A self-controllable goal (e.g. "finish writing the book")
 * can rely on coreMission alone; a goal that depends on external markets,
 * stakeholders, or funding cannot.
 */
import { describe, expect, it } from 'vitest';

import { evaluatePlanQualityGate } from './evaluatePlanQualityGate.ts';

function baseInput(overrides: Record<string, unknown> = {}) {
  return {
    goalText: 'Coordinate Operation Endgame as a 5-year multi-lane master plan',
    deliverables: [],
    actions: [],
    proposedBlocks: [],
    committedBlocks: [],
    ...overrides,
  };
}

describe('evaluatePlanQualityGate — MISSING_OUTCOME_TARGET', () => {
  it('fires when a semi_controllable plan has an empty outcomeTarget', () => {
    const result = evaluatePlanQualityGate(
      baseInput({
        missionContext: {
          coreMission: 'Coordinate Operation Endgame across 8 lanes',
          outcomeTarget: '',
          successStandard: 'paragraph success state',
          terminalOutcome: null,
          controllabilityClass: 'semi_controllable',
          terminalTargetClass: 'market_dependent',
        },
      }) as Parameters<typeof evaluatePlanQualityGate>[0],
    );
    expect(result.failureCodes).toContain('MISSING_OUTCOME_TARGET');
    expect(result.reasonCodes).toContain('MISSING_OUTCOME_TARGET');
  });

  it('fires when an externally_mediated plan has null outcomeTarget', () => {
    const result = evaluatePlanQualityGate(
      baseInput({
        missionContext: {
          coreMission: 'Build a market-dependent venture',
          outcomeTarget: null,
          successStandard: null,
          terminalOutcome: null,
          controllabilityClass: 'externally_mediated',
          terminalTargetClass: 'market_dependent',
        },
      }) as Parameters<typeof evaluatePlanQualityGate>[0],
    );
    expect(result.failureCodes).toContain('MISSING_OUTCOME_TARGET');
  });

  it('does NOT fire when a controllable plan has empty outcomeTarget', () => {
    const result = evaluatePlanQualityGate(
      baseInput({
        missionContext: {
          coreMission: 'Finish drafting the manuscript',
          outcomeTarget: '',
          successStandard: 'all chapters drafted',
          terminalOutcome: null,
          controllabilityClass: 'controllable',
          terminalTargetClass: 'controllable',
        },
      }) as Parameters<typeof evaluatePlanQualityGate>[0],
    );
    expect(result.failureCodes).not.toContain('MISSING_OUTCOME_TARGET');
  });

  it('does NOT fire when a semi_controllable plan declares a non-empty outcomeTarget', () => {
    const result = evaluatePlanQualityGate(
      baseInput({
        missionContext: {
          coreMission: 'Coordinate Operation Endgame',
          outcomeTarget:
            'By 2031-05-19 every active lane shows externally verifiable proof of scale.',
          successStandard: 'success state',
          terminalOutcome: null,
          controllabilityClass: 'semi_controllable',
          terminalTargetClass: 'market_dependent',
        },
      }) as Parameters<typeof evaluatePlanQualityGate>[0],
    );
    expect(result.failureCodes).not.toContain('MISSING_OUTCOME_TARGET');
  });

  it('does NOT fire when missionContext is omitted entirely', () => {
    const result = evaluatePlanQualityGate(baseInput() as Parameters<typeof evaluatePlanQualityGate>[0]);
    expect(result.failureCodes).not.toContain('MISSING_OUTCOME_TARGET');
  });
});
