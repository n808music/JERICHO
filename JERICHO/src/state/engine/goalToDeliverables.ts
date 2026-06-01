import { BRIDGE_DELIVERABLES_BY_PAIR } from './compositionDetector';

export type DeliverableStatus = 'not_started' | 'in_progress' | 'blocked' | 'complete' | 'at_risk';

export type CanonicalDeliverable = {
  id: string;
  outputType: 'deliverable' | 'milestone';
  title: string;
  summary: string;
  archetype: string;
  definitionOfDone: string;
  acceptanceCriteria: string[];
  status: DeliverableStatus;
  estimatedSessions: number;
  estimatedMinutes: number;
  dependencyIds: string[];
  sourceType: 'action_graph' | 'legacy';
  generatedBy: string;
  evidenceType: string;
  targetDayKey?: string | null;
  actionIds: string[];
};

export type ScaffoldGroup = {
  id: string;
  title: string;
  type: 'phase' | 'group' | 'section';
  actionIds: string[];
  deliverableIds: string[];
  generatedBy: string;
};

export type DeliverableCompilerResult = {
  archetype: string;
  usesCanonicalDeliverablePath: boolean;
  deliverables: CanonicalDeliverable[];
  scaffoldGroups: ScaffoldGroup[];
  actionSeeds: Array<{
    id: string;
    title: string;
    deliverableId: string;
    actionType?: 'preparation' | 'execution';
    estimateMin: number;
    dependencyIds: string[];
    readinessConditions?: string[];
    assumptions?: string[];
    sessionTitles?: string[];
  }>;
  estimatedSessionCount: number;
  legacyFallbackUsed: boolean;
  invalidDeliverables: Array<{ id: string; reason: string }>;
};

const PHASE_LABEL_PATTERN =
  /planning\s*&\s*setup|scope definition|core production|verification\s*&\s*finalization|build\s*&\s*refinement|execution\s*&\s*iteration|launch\s*&\s*rollout/i;

const TV_WRITING_PATTERN = /tv show|television|season|episode|pilot|script/i;
const CREATIVE_PRODUCTION_PATTERN = /podcast|music|ep\b|video|manuscript|longform|book/i;

const MIGRATED_EXECUTION_TYPES = new Set([
  'ProfessionalQualification',
  'VentureLaunch',
  'JobSearchPipeline',
  'PhysicalTraining',
  'SkillAcquisition',
  'BrandLaunch',
  'SalesPipeline',
  'Fundraising',
  'CreativeProduction',
]);

function normalizeText(value: unknown): string {
  return String(value || '').trim();
}

function normalizeMinutes(value: unknown): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return 60;
  return Math.max(15, Math.round(parsed));
}

function slugFromText(value: string): string {
  const slug = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug || 'deliverable';
}

function deriveExecutionTypeKey({
  executionType = '',
  actions = [],
  contract = null,
}: {
  executionType?: string;
  actions?: any[];
  contract?: any;
}) {
  const base = String(executionType || '').trim();
  if (MIGRATED_EXECUTION_TYPES.has(base)) return base;
  if (base === 'GenericStructured') {
    const actionText = (Array.isArray(actions) ? actions : [])
      .map((action) => `${action?.title || ''} ${action?.deliverable || ''}`)
      .join(' ')
      .toLowerCase();
    const contractText = `${contract?.goalText || ''} ${(contract?.terminalOutcome || {}).text || ''}`.toLowerCase();
    const combined = `${actionText} ${contractText}`;
    if (TV_WRITING_PATTERN.test(combined)) {
      return 'GenericStructured.TVWriting';
    }
    if (CREATIVE_PRODUCTION_PATTERN.test(combined)) {
      return 'CreativeProduction';
    }
  }
  return base;
}

function inferScaffoldTitle(action: any, index: number): string {
  const actionId = normalizeText(action?.id);
  const idPrefix = actionId.includes(':') ? actionId.split(':')[0] : '';
  if (idPrefix) {
    return idPrefix
      .split(/[-_]/g)
      .filter(Boolean)
      .map((chunk) => chunk.charAt(0).toUpperCase() + chunk.slice(1))
      .join(' ');
  }
  const fallback = normalizeText(action?.category || action?.domain || `group ${index + 1}`);
  return fallback.charAt(0).toUpperCase() + fallback.slice(1);
}

function dedupe<T>(values: T[]): T[] {
  const seen = new Set();
  const output: T[] = [];
  values.forEach((value) => {
    const key = JSON.stringify(value);
    if (seen.has(key)) return;
    seen.add(key);
    output.push(value);
  });
  return output;
}

function collectStringList(...sources: unknown[]): string[] {
  return dedupe(
    sources
      .flatMap((source) => (Array.isArray(source) ? source : [source]))
      .map((entry) => normalizeText(entry))
      .filter(Boolean)
  );
}

function inferOutputType(archetype: string, title: string): 'deliverable' | 'milestone' {
  if (archetype !== 'PhysicalTraining') return 'deliverable';
  const lower = String(title || '').toLowerCase();
  const milestonePattern =
    /baseline|assessment|benchmark|test|target achieved|clearance|event completed|return to training|protocol/;
  return milestonePattern.test(lower) ? 'milestone' : 'deliverable';
}

export function isScaffoldGroup(candidate: any): boolean {
  if (!candidate || typeof candidate !== 'object') return false;
  return ['phase', 'group', 'section'].includes(
    String(candidate.type || '')
      .trim()
      .toLowerCase()
  );
}

export function isCanonicalDeliverable(candidate: any): boolean {
  if (!candidate || typeof candidate !== 'object') return false;
  const title = normalizeText(candidate.title);
  const definitionOfDone = normalizeText(candidate.definitionOfDone);
  const acceptanceCriteria = Array.isArray(candidate.acceptanceCriteria)
    ? candidate.acceptanceCriteria.map((entry) => normalizeText(entry)).filter(Boolean)
    : [];
  if (!title || !definitionOfDone || acceptanceCriteria.length === 0) return false;
  if (PHASE_LABEL_PATTERN.test(title)) return false;
  return true;
}

export function normalizeDeliverable(candidate: any, context: { archetype: string; index: number; cycleId: string }) {
  const title = normalizeText(candidate?.title) || `Deliverable ${context.index + 1}`;
  const definitionOfDone =
    normalizeText(candidate?.definitionOfDone) || 'Deliverable output is completed and verifiable.';
  const acceptanceCriteria = Array.isArray(candidate?.acceptanceCriteria)
    ? candidate.acceptanceCriteria.map((entry: unknown) => normalizeText(entry)).filter(Boolean)
    : [];

  const normalizedAcceptance = acceptanceCriteria.length ? acceptanceCriteria : [definitionOfDone];
  const estimatedMinutes = normalizeMinutes(candidate?.estimatedMinutes ?? candidate?.estimateMin);
  const estimatedSessions = Math.max(1, Math.ceil(estimatedMinutes / 60));

  return {
    id:
      normalizeText(candidate?.id) || `${context.cycleId || 'cycle'}:deliv:${context.index + 1}:${slugFromText(title)}`,
    outputType: inferOutputType(context.archetype, title),
    title,
    summary: normalizeText(candidate?.summary || candidate?.description || title),
    archetype: context.archetype,
    definitionOfDone,
    acceptanceCriteria: normalizedAcceptance,
    status: ['not_started', 'in_progress', 'blocked', 'complete', 'at_risk'].includes(candidate?.status)
      ? candidate.status
      : 'not_started',
    estimatedSessions,
    estimatedMinutes,
    dependencyIds: Array.isArray(candidate?.dependencyIds)
      ? dedupe(candidate.dependencyIds.map((entry: unknown) => normalizeText(entry)).filter(Boolean))
      : [],
    sourceType: 'action_graph' as const,
    generatedBy: 'goal_to_deliverable_compiler_phase_a',
    evidenceType: normalizeText(candidate?.evidenceType || 'artifact_or_result'),
    targetDayKey: candidate?.targetDayKey || null,
    actionIds: Array.isArray(candidate?.actionIds)
      ? dedupe(candidate.actionIds.map((entry: unknown) => normalizeText(entry)).filter(Boolean))
      : [],
  } satisfies CanonicalDeliverable;
}

function buildCanonicalDeliverablesFromActions({
  actions,
  archetype,
  cycleId,
}: {
  actions: any[];
  archetype: string;
  cycleId: string;
}) {
  const byDeliverableTitle = new Map<string, any>();
  const deliverableOrder: string[] = [];
  const actionById = new Map<string, any>();

  actions.forEach((action, index) => {
    const actionId = normalizeText(action?.id) || `action-${index + 1}`;
    actionById.set(actionId, action);
    const outputTitle =
      cleanGeneratedDeliverableTitle(action?.deliverable) ||
      cleanGeneratedDeliverableTitle(action?.title) ||
      `Output ${index + 1}`;

    if (!byDeliverableTitle.has(outputTitle)) {
      byDeliverableTitle.set(outputTitle, {
        id: `${cycleId || 'cycle'}:deliv:${deliverableOrder.length + 1}:${slugFromText(outputTitle)}`,
        title: outputTitle,
        summary: outputTitle,
        definitionOfDone: normalizeText(action?.definitionOfDone) || `Completed output: ${outputTitle}`,
        acceptanceCriteria: [],
        estimatedMinutes: 0,
        dependencyIds: [],
        actionIds: [],
      });
      deliverableOrder.push(outputTitle);
    }

    const entry = byDeliverableTitle.get(outputTitle);
    entry.actionIds.push(actionId);
    entry.estimatedMinutes += normalizeMinutes(action?.estimateMin);
    const criteria = normalizeText(action?.definitionOfDone);
    if (criteria) entry.acceptanceCriteria.push(criteria);
  });

  const deliverableIdByActionId = new Map<string, string>();
  deliverableOrder.forEach((title) => {
    const entry = byDeliverableTitle.get(title);
    (entry?.actionIds || []).forEach((actionId: string) => {
      deliverableIdByActionId.set(actionId, entry.id);
    });
  });

  deliverableOrder.forEach((title) => {
    const entry = byDeliverableTitle.get(title);
    const dependencyDeliverables = new Set<string>();
    (entry?.actionIds || []).forEach((actionId: string) => {
      const action = actionById.get(actionId);
      const dependencies = Array.isArray(action?.dependencies) ? action.dependencies : [];
      dependencies.forEach((depActionId: unknown) => {
        const depDeliverableId = deliverableIdByActionId.get(normalizeText(depActionId));
        if (depDeliverableId && depDeliverableId !== entry.id) {
          dependencyDeliverables.add(depDeliverableId);
        }
      });
    });
    entry.dependencyIds = Array.from(dependencyDeliverables);
  });

  const normalized = deliverableOrder.map((title, index) =>
    normalizeDeliverable(byDeliverableTitle.get(title), {
      archetype,
      index,
      cycleId,
    })
  );

  return normalized;
}

function cleanGeneratedDeliverableTitle(value: unknown): string {
  const title = normalizeText(value);
  if (!title) return '';

  const polluted = title.match(
    /^(finalize|set|create|activate|review)\s+execution\s+completed\.\s+(?:build\s+)?(?:a|an|the)?\s*(.+)$/i
  );
  if (polluted) {
    const verb = `${polluted[1].slice(0, 1).toUpperCase()}${polluted[1].slice(1).toLowerCase()}`;
    const rest = normalizeText(polluted[2]).replace(/^(finalize|set|create|activate|review)\s+/i, '');
    return `${verb} ${rest}`.trim();
  }

  return title
    .replace(/^execution\s+completed\.\s+/i, '')
    .replace(
      /^complete\s+(finalize|set|create|activate|review)\s+/i,
      (_match, verb: string) => `${verb.slice(0, 1).toUpperCase()}${verb.slice(1).toLowerCase()} `
    );
}

function buildScaffoldGroups(actions: any[], deliverables: CanonicalDeliverable[]) {
  const deliverableByActionId = new Map<string, string>();
  deliverables.forEach((deliverable) => {
    (deliverable.actionIds || []).forEach((actionId) => {
      deliverableByActionId.set(actionId, deliverable.id);
    });
  });

  const groupMap = new Map<string, ScaffoldGroup>();
  (Array.isArray(actions) ? actions : []).forEach((action, index) => {
    const actionId = normalizeText(action?.id) || `action-${index + 1}`;
    const title = inferScaffoldTitle(action, index);
    const groupId = `scaffold:${slugFromText(title)}`;
    if (!groupMap.has(groupId)) {
      groupMap.set(groupId, {
        id: groupId,
        title,
        type: 'phase',
        actionIds: [],
        deliverableIds: [],
        generatedBy: 'goal_to_deliverable_compiler_phase_a',
      });
    }
    const entry = groupMap.get(groupId)!;
    entry.actionIds.push(actionId);
    const deliverableId = deliverableByActionId.get(actionId);
    if (deliverableId) entry.deliverableIds.push(deliverableId);
  });

  return Array.from(groupMap.values()).map((group) => ({
    ...group,
    actionIds: dedupe(group.actionIds),
    deliverableIds: dedupe(group.deliverableIds),
  }));
}

export function summarizeDeliverableSet(result: DeliverableCompilerResult) {
  const invalidDeliverables = (result.deliverables || []).flatMap((deliverable) => {
    const issues = [] as Array<{ id: string; reason: string }>;
    if (!normalizeText(deliverable.title)) issues.push({ id: deliverable.id, reason: 'missing_title' });
    if (!normalizeText(deliverable.definitionOfDone))
      issues.push({ id: deliverable.id, reason: 'missing_definition_of_done' });
    if (!Array.isArray(deliverable.acceptanceCriteria) || deliverable.acceptanceCriteria.length === 0) {
      issues.push({ id: deliverable.id, reason: 'missing_acceptance_criteria' });
    }
    if (PHASE_LABEL_PATTERN.test(deliverable.title)) issues.push({ id: deliverable.id, reason: 'phase_label' });
    if ((Number(deliverable.estimatedSessions) || 0) <= 0)
      issues.push({ id: deliverable.id, reason: 'invalid_estimated_sessions' });
    return issues;
  });

  return {
    archetype: result.archetype,
    usesCanonicalDeliverablePath: result.usesCanonicalDeliverablePath,
    deliverableCount: result.deliverables.length,
    scaffoldGroupCount: result.scaffoldGroups.length,
    actionSeedCount: result.actionSeeds.length,
    estimatedSessionCount: result.estimatedSessionCount,
    legacyFallbackUsed: result.legacyFallbackUsed,
    invalidDeliverables,
  };
}

export function toLegacyWorkspaceDeliverables(deliverables: CanonicalDeliverable[] = [], nowISO: string) {
  return (Array.isArray(deliverables) ? deliverables : []).map((deliverable) => ({
    id: deliverable.id,
    outputType: deliverable.outputType || 'deliverable',
    title: deliverable.title,
    requiredBlocks: Math.max(1, Number(deliverable.estimatedSessions) || 1),
    estimateMin: Math.max(30, Number(deliverable.estimatedMinutes) || 60),
    criteria: (deliverable.acceptanceCriteria || []).map((criterion, index) => ({
      id: `${deliverable.id}:criterion:${index + 1}`,
      deliverableId: deliverable.id,
      text: criterion,
      isDone: false,
      doneAtDayKey: null,
      doneAtISO: null,
    })),
    weight: 1,
    status: deliverable.status,
    definitionOfDone: deliverable.definitionOfDone,
    acceptanceCriteria: [...(deliverable.acceptanceCriteria || [])],
    summary: deliverable.summary,
    archetype: deliverable.archetype,
    dependencyIds: [...(deliverable.dependencyIds || [])],
    sourceType: deliverable.sourceType,
    generatedBy: deliverable.generatedBy,
    evidenceType: deliverable.evidenceType,
    actionIds: [...(deliverable.actionIds || [])],
    createdAtISO: nowISO,
    updatedAtISO: nowISO,
  }));
}

export function compileGoalToDeliverables({
  executionType,
  actions,
  contract,
  cycleId,
}: {
  executionType: string;
  actions: any[];
  contract?: any;
  cycleId: string;
}): DeliverableCompilerResult {
  const actionList = Array.isArray(actions) ? actions.filter(Boolean) : [];
  const archetype = deriveExecutionTypeKey({ executionType, actions: actionList, contract });
  const migrated = MIGRATED_EXECUTION_TYPES.has(archetype) || archetype === 'GenericStructured.TVWriting';

  if (!migrated || actionList.length === 0) {
    return {
      archetype,
      usesCanonicalDeliverablePath: false,
      deliverables: [],
      scaffoldGroups: [],
      actionSeeds: [],
      estimatedSessionCount: 0,
      legacyFallbackUsed: true,
      invalidDeliverables: [],
    };
  }

  const deliverables = buildCanonicalDeliverablesFromActions({
    actions: actionList,
    archetype,
    cycleId,
  });

  // Phase C: bridge deliverable injection for composed goals.
  // compositeGrammar is an additive, optional field on the contract.
  // Primary deliverables are generated first; bridge deliverables are injected after.
  // Primary actions MUST NOT depend on bridge deliverables (completion boundary rule).
  const compositeGrammar = contract?.compositeGrammar;
  if (
    compositeGrammar &&
    typeof compositeGrammar.pairId === 'string' &&
    typeof compositeGrammar.injectionPoint === 'string'
  ) {
    const { pairId, injectionPoint, secondary } = compositeGrammar;
    const bridgeSpecs: any[] = BRIDGE_DELIVERABLES_BY_PAIR[pairId] || [];

    if (bridgeSpecs.length > 0) {
      // Find the injection point deliverable: the primary deliverable whose actionIds
      // contain the injection point action ID. Used only when injectionPoint !== 'PARALLEL'.
      const injectionDeliverable =
        injectionPoint !== 'PARALLEL' ? deliverables.find((d) => (d.actionIds || []).includes(injectionPoint)) : null;

      let prevBridgeId: string | null = null;

      bridgeSpecs.forEach((spec: any, index: number) => {
        const bridgeDependencyIds: string[] = [];

        if (spec.dependsOnInjectionPoint && injectionDeliverable) {
          bridgeDependencyIds.push(injectionDeliverable.id);
        }
        if (spec.dependsOnPrevBridge && prevBridgeId) {
          bridgeDependencyIds.push(prevBridgeId);
        }

        const bridgeDeliverable = normalizeDeliverable(
          {
            ...spec,
            archetype: secondary || archetype,
            sourceType: 'action_graph',
            generatedBy: 'composition_bridge_injector',
            evidenceType: 'artifact_or_result',
            dependencyIds: bridgeDependencyIds,
            actionIds: [],
          },
          { archetype: secondary || archetype, index: deliverables.length + index, cycleId }
        );

        deliverables.push(bridgeDeliverable);
        prevBridgeId = bridgeDeliverable.id;
      });
    }
  }

  const scaffoldGroups = buildScaffoldGroups(actionList, deliverables);
  const actionSeeds = actionList.map((action, index) => {
    const actionId = normalizeText(action?.id) || `action-${index + 1}`;
    const deliverable = deliverables.find((entry) => (entry.actionIds || []).includes(actionId));
    const dependencyIds = collectStringList(action?.dependencies, action?.dependsOn, action?.dependencyIds);
    const readinessConditions = collectStringList(
      action?.readinessConditions,
      action?.readinessCondition,
      action?.readiness
    );
    const assumptions = collectStringList(action?.assumptions, action?.assumption);
    const sessionTitles = collectStringList(action?.sessionTitles);
    return {
      id: actionId,
      title: normalizeText(action?.title) || `Action ${index + 1}`,
      deliverableId: deliverable?.id || '',
      actionType:
        action?.actionType === 'preparation' || action?.actionType === 'execution'
          ? action.actionType
          : action?.type === 'preparation' || action?.type === 'execution'
            ? action.type
            : undefined,
      estimateMin: normalizeMinutes(action?.estimateMin),
      dependencyIds,
      readinessConditions: readinessConditions.length ? readinessConditions : undefined,
      assumptions: assumptions.length ? assumptions : undefined,
      sessionTitles: sessionTitles.length ? sessionTitles : undefined,
    };
  });

  const summary = summarizeDeliverableSet({
    archetype,
    usesCanonicalDeliverablePath: true,
    deliverables,
    scaffoldGroups,
    actionSeeds,
    estimatedSessionCount: deliverables.reduce((sum, d) => sum + Math.max(0, Number(d.estimatedSessions) || 0), 0),
    legacyFallbackUsed: false,
    invalidDeliverables: [],
  });

  return {
    archetype,
    usesCanonicalDeliverablePath: true,
    deliverables,
    scaffoldGroups,
    actionSeeds,
    estimatedSessionCount: Number(summary.estimatedSessionCount) || 0,
    legacyFallbackUsed: false,
    invalidDeliverables: summary.invalidDeliverables,
  };
}
