import { compileGoalToDeliverables, type DeliverableCompilerResult } from './goalToDeliverables';

export type QualityIssueCode =
  | 'VAGUE_TITLE'
  | 'PHASE_LABEL_AS_DELIVERABLE'
  | 'WEAK_DEFINITION_OF_DONE'
  | 'EMPTY_OR_WEAK_ACCEPTANCE_CRITERIA'
  | 'ACTION_DELIVERABLE_MISMATCH'
  | 'ESTIMATE_IMPLAUSIBILITY'
  | 'MISSING_CORE_OUTPUT'
  | 'DEPENDENCY_FLATTENING';

export type QualityIssue = {
  deliverableId: string;
  code: QualityIssueCode;
  severity: 'warning' | 'error';
  message: string;
};

export type ArchetypeRuleQualitySummary = {
  archetype: string;
  deliverableCount: number;
  invalidCount: number;
  warningCount: number;
  usesCanonicalDeliverablePath: boolean;
  issues: QualityIssue[];
  coverage: {
    hasConcreteOutputs: boolean;
    hasDefinitionOfDoneForAll: boolean;
    hasAcceptanceCriteriaForAll: boolean;
    hasNonTrivialDependencies: boolean;
    hasSessionEstimates: boolean;
  };
  schedulerReadiness: {
    actionDerivationCoherent: boolean;
    sessionEstimationCoherent: boolean;
    schedulerCompatible: boolean;
  };
};

const PHASE_LABEL_PATTERN =
  /planning\s*&\s*setup|core production|verification\s*&\s*finalization|build\s*&\s*refinement|execution\s*&\s*iteration|launch prep|phase\s*\d+/i;

const VAGUE_TITLE_PATTERN =
  /^(study|work on|prepare|continue|improve|do|handle|manage|support)\b|\bwork on\b|\bcontinue\b|\bimprove\b/i;

const WEAK_DOD_PATTERN = /\b(spend\s+\d+|work on|continue|keep|practice for|review for|make progress|ongoing)\b/i;

const WEAK_CRITERIA_PATTERN = /\b(done|complete|finished|worked on)\b$/i;

function normalizeText(value: unknown): string {
  return String(value || '').trim();
}

function tokenize(value: string): Set<string> {
  const normalizeToken = (token: string) => {
    if (token.length > 4 && token.endsWith('s')) return token.slice(0, -1);
    return token;
  };
  return new Set(
    value
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .map((token) => token.trim())
      .map((token) => normalizeToken(token))
      .filter((token) => token.length > 2)
  );
}

function hasKeyword(text: string, keywords: string[]): boolean {
  const lower = text.toLowerCase();
  return keywords.some((keyword) => lower.includes(keyword.toLowerCase()));
}

function detectCoreCoverage(archetype: string, titles: string[]) {
  const joined = titles.join(' | ').toLowerCase();

  if (archetype === 'ProfessionalQualification') {
    return [
      { id: 'study_foundation', ok: hasKeyword(joined, ['domain', 'study', 'notes']) },
      { id: 'practice_exam', ok: hasKeyword(joined, ['practice exam', 'question bank', 'mock']) },
      { id: 'final_readiness', ok: hasKeyword(joined, ['final', 'exam completed', 'result']) },
    ];
  }

  if (archetype === 'VentureLaunch') {
    return [
      { id: 'customer_validation', ok: hasKeyword(joined, ['interview', 'problem hypothesis', 'assumption']) },
      { id: 'launch_material', ok: hasKeyword(joined, ['landing page', 'value prop', 'copy', 'pitch']) },
      { id: 'outreach_execution', ok: hasKeyword(joined, ['outreach', 'shared', 'communities', 'distribution']) },
    ];
  }

  if (archetype === 'GenericStructured.TVWriting') {
    return [
      { id: 'premise_arc', ok: hasKeyword(joined, ['premise', 'story outline', 'season arc']) },
      { id: 'episode_outline', ok: hasKeyword(joined, ['episode outline', 'outline']) },
      { id: 'episode_draft', ok: hasKeyword(joined, ['draft', 'script']) },
      { id: 'revision', ok: hasKeyword(joined, ['continuity', 'revision']) },
    ];
  }

  if (archetype === 'JobSearchPipeline') {
    return [
      { id: 'role_targeting', ok: hasKeyword(joined, ['target role', 'role profile', 'target company']) },
      { id: 'application_assets', ok: hasKeyword(joined, ['resume', 'portfolio', 'story bank', 'materials']) },
      { id: 'application_throughput', ok: hasKeyword(joined, ['application', 'outreach', 'batch', 'pipeline']) },
      { id: 'interview_readiness', ok: hasKeyword(joined, ['interview', 'mock', 'feedback']) },
    ];
  }

  if (archetype === 'CreativeProduction') {
    return [
      { id: 'concept_scope', ok: hasKeyword(joined, ['concept', 'scope', 'package']) },
      { id: 'production_execution', ok: hasKeyword(joined, ['production', 'recording', 'asset batch', 'draft']) },
      { id: 'revision_quality', ok: hasKeyword(joined, ['revision', 'continuity', 'quality']) },
      { id: 'release_readiness', ok: hasKeyword(joined, ['release', 'publish', 'final package']) },
    ];
  }

  if (archetype === 'Fundraising') {
    return [
      { id: 'ask_structure', ok: hasKeyword(joined, ['ask structure', 'raise thesis', 'target amount']) },
      { id: 'investor_narrative', ok: hasKeyword(joined, ['narrative', 'deck', 'memo']) },
      { id: 'target_fit_pipeline', ok: hasKeyword(joined, ['target list', 'fit', 'outreach']) },
      { id: 'diligence_progression', ok: hasKeyword(joined, ['diligence', 'compliance', 'commitment']) },
    ];
  }

  if (archetype === 'PhysicalTraining') {
    return [
      { id: 'baseline_or_clearance', ok: hasKeyword(joined, ['baseline', 'clearance', 'assessment']) },
      {
        id: 'training_block_execution',
        ok: hasKeyword(joined, ['training sessions', 'build phase', 'block', 'protocol']),
      },
      { id: 'benchmark_or_event', ok: hasKeyword(joined, ['benchmark', 'event completed', 'performance']) },
      { id: 'review_or_adjustment', ok: hasKeyword(joined, ['review', 'adjusted plan', 'post-event']) },
    ];
  }

  return [];
}

export function evaluateArchetypeRuleQuality(result: DeliverableCompilerResult): ArchetypeRuleQualitySummary {
  const issues: QualityIssue[] = [];
  const deliverables = Array.isArray(result.deliverables) ? result.deliverables : [];

  deliverables.forEach((deliverable) => {
    const title = normalizeText(deliverable.title);
    const definitionOfDone = normalizeText(deliverable.definitionOfDone);
    const acceptanceCriteria = Array.isArray(deliverable.acceptanceCriteria)
      ? deliverable.acceptanceCriteria.map((entry) => normalizeText(entry)).filter(Boolean)
      : [];

    if (!title || VAGUE_TITLE_PATTERN.test(title)) {
      issues.push({
        deliverableId: deliverable.id,
        code: 'VAGUE_TITLE',
        severity: 'error',
        message: 'Title appears effort-oriented or too vague to verify output completion.',
      });
    }

    if (PHASE_LABEL_PATTERN.test(title)) {
      issues.push({
        deliverableId: deliverable.id,
        code: 'PHASE_LABEL_AS_DELIVERABLE',
        severity: 'error',
        message: 'Phase/group label appears as a top-level deliverable.',
      });
    }

    if (!definitionOfDone || WEAK_DOD_PATTERN.test(definitionOfDone) || definitionOfDone.length < 12) {
      issues.push({
        deliverableId: deliverable.id,
        code: 'WEAK_DEFINITION_OF_DONE',
        severity: 'warning',
        message: 'Definition of done is weak or effort-oriented instead of output-verifiable.',
      });
    }

    if (
      !acceptanceCriteria.length ||
      acceptanceCriteria.some((criterion) => criterion.length < 8 || WEAK_CRITERIA_PATTERN.test(criterion))
    ) {
      issues.push({
        deliverableId: deliverable.id,
        code: 'EMPTY_OR_WEAK_ACCEPTANCE_CRITERIA',
        severity: 'warning',
        message: 'Acceptance criteria are missing or too weak to verify completion.',
      });
    }

    if (
      !Number.isFinite(deliverable.estimatedSessions) ||
      deliverable.estimatedSessions <= 0 ||
      deliverable.estimatedMinutes <= 0
    ) {
      issues.push({
        deliverableId: deliverable.id,
        code: 'ESTIMATE_IMPLAUSIBILITY',
        severity: 'error',
        message: 'Estimated effort is missing or implausible for a concrete deliverable.',
      });
    }
  });

  const actionSeedByDeliverable = new Map<string, string[]>();
  (result.actionSeeds || []).forEach((seed) => {
    const list = actionSeedByDeliverable.get(seed.deliverableId) || [];
    list.push(normalizeText(seed.title));
    actionSeedByDeliverable.set(seed.deliverableId, list);
  });

  deliverables.forEach((deliverable) => {
    const deliverableTokens = tokenize(deliverable.title);
    const actions = actionSeedByDeliverable.get(deliverable.id) || [];
    if (!actions.length) {
      issues.push({
        deliverableId: deliverable.id,
        code: 'ACTION_DELIVERABLE_MISMATCH',
        severity: 'error',
        message: 'No actions map to this deliverable.',
      });
      return;
    }

    const hasSemanticOverlap = actions.some((title) => {
      const actionTokens = tokenize(title);
      let overlap = 0;
      deliverableTokens.forEach((token) => {
        if (actionTokens.has(token)) overlap += 1;
      });
      return overlap >= 1;
    });

    if (!hasSemanticOverlap) {
      issues.push({
        deliverableId: deliverable.id,
        code: 'ACTION_DELIVERABLE_MISMATCH',
        severity: 'warning',
        message: 'Actions mapped to deliverable appear semantically disconnected from output title.',
      });
    }
  });

  const hasDependencies = deliverables.some(
    (deliverable) => Array.isArray(deliverable.dependencyIds) && deliverable.dependencyIds.length > 0
  );
  if (deliverables.length >= 3 && !hasDependencies) {
    issues.push({
      deliverableId: 'archetype',
      code: 'DEPENDENCY_FLATTENING',
      severity: 'warning',
      message: 'Deliverable set appears fully flat without ordering dependencies.',
    });
  }

  const coverageChecks = detectCoreCoverage(
    result.archetype,
    deliverables.map((entry) => entry.title)
  );
  coverageChecks
    .filter((entry) => !entry.ok)
    .forEach((entry) => {
      issues.push({
        deliverableId: 'archetype',
        code: 'MISSING_CORE_OUTPUT',
        severity: 'warning',
        message: `Expected core output class missing for archetype: ${entry.id}.`,
      });
    });

  const errorCount = issues.filter((issue) => issue.severity === 'error').length;
  const warningCount = issues.filter((issue) => issue.severity === 'warning').length;

  const hasSessionEstimates = deliverables.every(
    (deliverable) =>
      Number.isFinite(deliverable.estimatedSessions) &&
      deliverable.estimatedSessions > 0 &&
      deliverable.estimatedMinutes > 0
  );

  const actionDerivationCoherent = !issues.some(
    (issue) => issue.code === 'ACTION_DELIVERABLE_MISMATCH' && issue.severity === 'error'
  );
  const sessionEstimationCoherent = !issues.some((issue) => issue.code === 'ESTIMATE_IMPLAUSIBILITY');
  const schedulerCompatible =
    result.usesCanonicalDeliverablePath &&
    actionDerivationCoherent &&
    sessionEstimationCoherent &&
    hasSessionEstimates &&
    errorCount === 0 &&
    (result.actionSeeds || []).length > 0;

  return {
    archetype: result.archetype,
    deliverableCount: deliverables.length,
    invalidCount: errorCount,
    warningCount,
    usesCanonicalDeliverablePath: result.usesCanonicalDeliverablePath,
    issues,
    coverage: {
      hasConcreteOutputs: deliverables.every(
        (deliverable) => !VAGUE_TITLE_PATTERN.test(normalizeText(deliverable.title))
      ),
      hasDefinitionOfDoneForAll: deliverables.every(
        (deliverable) => normalizeText(deliverable.definitionOfDone).length >= 12
      ),
      hasAcceptanceCriteriaForAll: deliverables.every(
        (deliverable) => Array.isArray(deliverable.acceptanceCriteria) && deliverable.acceptanceCriteria.length > 0
      ),
      hasNonTrivialDependencies: hasDependencies,
      hasSessionEstimates,
    },
    schedulerReadiness: {
      actionDerivationCoherent,
      sessionEstimationCoherent,
      schedulerCompatible,
    },
  };
}

export function evaluateArchetypeRulesFromActions({
  executionType,
  actions,
  contract,
  cycleId,
}: {
  executionType: string;
  actions: any[];
  contract?: any;
  cycleId: string;
}): ArchetypeRuleQualitySummary {
  const compiled = compileGoalToDeliverables({
    executionType,
    actions,
    contract,
    cycleId,
  });
  return evaluateArchetypeRuleQuality(compiled);
}
