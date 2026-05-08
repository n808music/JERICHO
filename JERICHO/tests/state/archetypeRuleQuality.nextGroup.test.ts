import { describe, expect, it } from 'vitest';
import { evaluateArchetypeRulesFromActions } from '../../src/state/engine/archetypeRuleQuality';
import { jobSearchPipelineActions, physicalTrainingActions } from './phaseC.archetype.fixtures';

const scenarios = [
  {
    archetype: 'JobSearchPipeline',
    actions: jobSearchPipelineActions,
    contract: { goalText: 'Land a PM role in 60 days' },
    cycleId: 'cycle-job-quality',
  },
  {
    archetype: 'PhysicalTraining',
    actions: physicalTrainingActions,
    contract: { goalText: 'Run a 5k in 8 weeks' },
    cycleId: 'cycle-pt-quality',
  },
] as const;

function evaluateAll() {
  return scenarios.map((scenario) =>
    evaluateArchetypeRulesFromActions({
      executionType: scenario.archetype,
      actions: scenario.actions,
      contract: scenario.contract,
      cycleId: scenario.cycleId,
    })
  );
}

describe('archetypeRuleQuality next group', () => {
  it('anti-vagueness', () => {
    evaluateAll().forEach((summary) => {
      expect(summary.issues.filter((issue) => issue.code === 'VAGUE_TITLE')).toHaveLength(0);
    });
  });

  it('anti-phase regression', () => {
    evaluateAll().forEach((summary) => {
      expect(summary.issues.filter((issue) => issue.code === 'PHASE_LABEL_AS_DELIVERABLE')).toHaveLength(0);
    });
  });

  it('definition-of-done quality', () => {
    evaluateAll().forEach((summary) => {
      expect(summary.issues.filter((issue) => issue.code === 'WEAK_DEFINITION_OF_DONE')).toHaveLength(0);
    });
  });

  it('acceptance-criteria quality', () => {
    evaluateAll().forEach((summary) => {
      expect(summary.issues.filter((issue) => issue.code === 'EMPTY_OR_WEAK_ACCEPTANCE_CRITERIA')).toHaveLength(0);
    });
  });

  it('action coherence', () => {
    evaluateAll().forEach((summary) => {
      expect(summary.issues.filter((issue) => issue.code === 'ACTION_DELIVERABLE_MISMATCH')).toHaveLength(0);
    });
  });

  it('dependency coherence', () => {
    evaluateAll().forEach((summary) => {
      expect(summary.issues.filter((issue) => issue.code === 'DEPENDENCY_FLATTENING')).toHaveLength(0);
    });
  });

  it('session plausibility', () => {
    evaluateAll().forEach((summary) => {
      expect(summary.issues.filter((issue) => issue.code === 'ESTIMATE_IMPLAUSIBILITY')).toHaveLength(0);
    });
  });

  it('coverage and scheduler readiness', () => {
    evaluateAll().forEach((summary) => {
      expect(summary.issues.filter((issue) => issue.code === 'MISSING_CORE_OUTPUT')).toHaveLength(0);
      expect(summary.schedulerReadiness.schedulerCompatible).toBe(true);
    });
  });
});
