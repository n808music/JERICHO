import { inferTargetMetric } from './targetUnitTaxonomy';
import { deriveTerminalOutcomeAuthority, type TerminalOutcomeAuthorityResult } from './terminalOutcomeAuthority';
import { detectTerminalEndpoint, type TerminalEndpointResult } from './terminalEndpointDetector';
import { buildStructuredPlanningIntake, type StructuredPlanningIntake } from './StructuredPlanningIntake';
import type { FeasibilityAssessment } from '../feasibility/feasibilityDerivation';
import {
  evaluatePrePlanFeasibility,
  prePlanFeasibility as buildCapitalAcquisitionFeasibility,
  type IntakeFeasibilityReport,
  type PrePlanFeasibilityResult,
} from './prePlanFeasibility';

export type ExecutionDomain = 'podcast' | 'general' | 'unknown';

export type CompletionBoundary =
  | 'recorded'
  | 'edited'
  | 'publish_ready'
  | 'published'
  | 'launched'
  | 'delivered'
  | 'sold'
  | 'installed'
  | 'approved'
  | 'custom';

export type IntakeQuestion = {
  id: string;
  domain: string;
  prompt: string;
  field: string;
  answerType: 'single_select' | 'multi_select' | 'text' | 'number' | 'boolean';
  options?: string[];
  required: boolean;
  reasonCode: string;
};

export type IntakeGateCode =
  | 'INTAKE_OK'
  | 'INTAKE_BOUNDARY_AMBIGUOUS'
  | 'INTAKE_DOMAIN_CONTEXT_REQUIRED'
  | 'INTAKE_ARTIFACT_UNCLEAR'
  | 'INTAKE_DEADLINE_MISSING'
  | 'INTAKE_NOT_READY_FOR_GRAPH';

export type IntakeReadinessState = 'fully_admitted' | 'assumption_marked_draft' | 'intake_blocked';

export type GoalIntakeContract = {
  goalId: string;
  rawGoalText: string;
  domain: ExecutionDomain | null;
  targetArtifactType: string | null;
  targetCount: number | null;
  targetUnit: string | null;
  deadline: string | null;
  commitmentVerb: string | null;
  completionBoundary: CompletionBoundary | null;
  completionBoundaryStatus: 'resolved' | 'ambiguous' | 'missing';
  deliveryMode: string | null;
  productionMode: string | null;
  startingState: string | null;
  requiredContextQuestions: IntakeQuestion[];
  answeredContext: Record<string, string | number | boolean | string[]>;
  planningIntake?: StructuredPlanningIntake;
  prePlanFeasibility?: PrePlanFeasibilityResult | null;
  capitalAcquisitionFeasibility?: IntakeFeasibilityReport | null;
  feasibilityAssessment?: FeasibilityAssessment | null;
  scopePolicy: {
    required: string[];
    recommended: string[];
    optional: string[];
    excluded: string[];
    assumptionsNeedingConfirmation: string[];
  };
  readiness: {
    state: IntakeReadinessState;
    isReadyForPlanning: boolean;
    blockingReasons: string[];
    assumptionReasons: string[];
  };
  terminalOutcomeAuthority: TerminalOutcomeAuthorityResult;
  terminalEndpoint: TerminalEndpointResult;
};

export type BuildGoalIntakeContractInput = {
  goalId?: string | null;
  rawGoalText?: string | null;
  goalText?: string | null;
  verificationCriteria?: string | null;
  executionType?: string | null;
  targetCount?: number | null;
  targetUnit?: string | null;
  deadline?: string | null;
  answeredContext?: Record<string, string | number | boolean | string[]>;
  contract?: Record<string, any> | null;
  goalDraftV2?: Record<string, any> | null;
};

function normalizeText(value: unknown): string {
  return String(value || '').trim();
}

function coerceCount(text: string): number | null {
  const match = /(\d+)\s*(?:episodes?|deliverables?|outputs?)/i.exec(text);
  if (!match) {
    return null;
  }
  const value = Number(match[1]);
  return Number.isFinite(value) && value > 0 ? value : null;
}

function coerceDeadline(input?: string | null): string | null {
  const text = normalizeText(input);
  if (!text) {
    return null;
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    return text;
  }
  return text.slice(0, 10) || null;
}

function detectDomain(text: string, executionType: string): ExecutionDomain | null {
  const combined = `${text} ${executionType}`.toLowerCase();
  if (combined.includes('podcast') || combined.includes('episode') || combined.includes('episodes')) {
    return 'podcast';
  }
  if (combined.trim()) {
    return 'general';
  }
  return null;
}

function detectCommitmentVerb(text: string): string | null {
  const lower = text.toLowerCase();
  const verbPatterns: Array<[string, RegExp]> = [
    ['publish', /^\s*publish\b/],
    ['launch', /^\s*launch\b/],
    ['deliver', /^\s*deliver\b/],
    ['record', /^\s*record\b/],
    ['edit', /^\s*edit\b/],
    ['finish', /^\s*finish\b/],
    ['complete', /^\s*complete\b/],
    ['prepare', /^\s*prepare\b/],
    ['create', /^\s*create\b/],
    ['start', /^\s*start\b/],
    ['build', /^\s*build\b/],
    ['make', /^\s*make\b/],
    ['get ready', /^\s*get ready\b/],
  ];
  for (const [verb, pattern] of verbPatterns) {
    if (pattern.test(lower)) {
      return verb;
    }
  }
  return null;
}

function detectBoundaryFromText(text: string, commitmentVerb: string | null): CompletionBoundary | null {
  const lower = text.toLowerCase();
  const hasDirectPublished = /\bpublished\s+live\b|\blive\s+published\b|\bgo\s+live\b|\breleased\b/.test(lower);
  const hasPublishReady =
    /\bread(?:y)?\s+to\s+publish\b|\bpublish[-\s]?ready\b|\bready\s+for\s+release\b|\bfor\s+release\b/.test(lower);
  const hasRecorded = /\brecorded\b/.test(lower);
  const hasEdited = /\bedited\b/.test(lower);
  const hasLaunched = /\blaunched\b|\blaunch\b/.test(lower);
  const hasDelivered = /\bdelivered\b/.test(lower);
  const hasSold = /\bsold\b/.test(lower);
  const hasInstalled = /\binstalled\b/.test(lower);
  const hasApproved = /\bapproved\b/.test(lower);

  if (hasDirectPublished || commitmentVerb === 'publish') {
    return 'published';
  }
  if (hasPublishReady) {
    return 'publish_ready';
  }
  if (commitmentVerb === 'record' || hasRecorded) {
    return 'recorded';
  }
  if (commitmentVerb === 'edit' || hasEdited) {
    return 'edited';
  }
  if (commitmentVerb === 'launch' || hasLaunched) {
    return 'launched';
  }
  if (commitmentVerb === 'deliver' || hasDelivered) {
    return 'delivered';
  }
  if (hasSold) {
    return 'sold';
  }
  if (hasInstalled) {
    return 'installed';
  }
  if (hasApproved) {
    return 'approved';
  }
  return null;
}

function isPortfolioBasedQualification(text: string, executionType: string): boolean {
  if (executionType !== 'ProfessionalQualification') {
    return false;
  }
  return /\b(portfolio|case study|case-study|work sample|submission|shareable page|writeup)\b/i.test(text);
}

function supportsCompletionBoundaryResolution(domain: ExecutionDomain | null, executionType: string, combinedText: string): boolean {
  return (
    domain === 'podcast' ||
    executionType === 'CreativeProduction' ||
    isPortfolioBasedQualification(combinedText, executionType)
  );
}

function inferCompletionBoundaryFromTerminalEndpoint(
  endpoint: TerminalEndpointResult | null | undefined,
  domain: ExecutionDomain | null,
  executionType: string,
  combinedText: string
): CompletionBoundary | null {
  if (domain === 'podcast') {
    return null;
  }
  const creativeProductionBoundary = executionType === 'CreativeProduction';
  const portfolioQualificationBoundary = isPortfolioBasedQualification(combinedText, executionType);
  if (!creativeProductionBoundary && !portfolioQualificationBoundary) {
    return null;
  }
  if (!endpoint || (endpoint.status !== 'clear_explicit' && endpoint.status !== 'clear_inferred')) {
    return null;
  }
  if (endpoint.primaryEndpoint === 'published_live') {
    return 'published';
  }
  if (endpoint.primaryEndpoint === 'artifact_complete') {
    return 'delivered';
  }
  return null;
}

function resolvePodcastScopePolicy(boundary: CompletionBoundary | null) {
  switch (boundary) {
    case 'recorded':
      return {
        required: ['outline', 'record'],
        recommended: ['edit'],
        optional: ['show notes', 'hosting setup'],
        excluded: ['publish workflow'],
        assumptionsNeedingConfirmation: [],
      };
    case 'edited':
      return {
        required: ['outline', 'record', 'edit'],
        recommended: ['show notes', 'hosting setup'],
        optional: ['launch landing page', 'social pack'],
        excluded: ['publish workflow'],
        assumptionsNeedingConfirmation: [],
      };
    case 'publish_ready':
      return {
        required: ['outline', 'record', 'edit', 'show notes', 'hosting setup'],
        recommended: ['release workflow'],
        optional: ['launch landing page', 'social pack'],
        excluded: ['published live launch'],
        assumptionsNeedingConfirmation: [],
      };
    case 'published':
      return {
        required: ['outline', 'record', 'edit', 'show notes', 'hosting setup', 'release workflow', 'publish'],
        recommended: ['launch landing page', 'social pack'],
        optional: ['post-launch review'],
        excluded: [],
        assumptionsNeedingConfirmation: [],
      };
    case 'launched':
      return {
        required: ['launch workflow'],
        recommended: ['post-launch review'],
        optional: ['growth experiments'],
        excluded: [],
        assumptionsNeedingConfirmation: [],
      };
    case 'delivered':
    case 'sold':
    case 'installed':
    case 'approved':
    case 'custom':
    default:
      return {
        required: [],
        recommended: [],
        optional: [],
        excluded: [],
        assumptionsNeedingConfirmation: [],
      };
  }
}

function buildBoundaryQuestion(): IntakeQuestion {
  return {
    id: 'podcast-completion-boundary',
    domain: 'podcast',
    prompt: 'What counts as complete by the deadline?',
    field: 'completionBoundary',
    answerType: 'single_select',
    options: ['recorded', 'edited', 'publish_ready', 'published'],
    required: true,
    reasonCode: 'COMPLETION_BOUNDARY_REQUIRED',
  };
}

function hasAnsweredValue(value: unknown): boolean {
  if (Array.isArray(value)) {
    return true;
  }
  if (typeof value === 'number') {
    return Number.isFinite(value);
  }
  if (typeof value === 'boolean') {
    return true;
  }
  return String(value || '').trim().length > 0;
}

function buildStructuredPlanningQuestions(
  intake: StructuredPlanningIntake,
  answeredContext: Record<string, unknown>
): IntakeQuestion[] {
  const questions: IntakeQuestion[] = [];
  const goalClassification = String(intake.goalClassification || '').trim();
  const has = (field: string) => hasAnsweredValue(answeredContext?.[field]);
  const hasExplicitField = (field: string) =>
    answeredContext && Object.prototype.hasOwnProperty.call(answeredContext, field);

  if (!has('executionContext')) {
    questions.push({
      id: 'planning-execution-context',
      domain: 'planning',
      prompt: 'Will you be pursuing this goal full time or part time alongside other major commitments?',
      field: 'executionContext',
      answerType: 'single_select',
      options: ['full_time', 'part_time'],
      required: true,
      reasonCode: 'PLANNING_EXECUTION_CONTEXT_REQUIRED',
    });
  }

  if (!has('weeklyHoursAvailable')) {
    questions.push({
      id: 'planning-weekly-hours',
      domain: 'planning',
      prompt: 'How many hours per week can you actually commit to this goal?',
      field: 'weeklyHoursAvailable',
      answerType: 'number',
      required: true,
      reasonCode: 'PLANNING_WEEKLY_HOURS_REQUIRED',
    });
  }

  if (!has('capitalAvailable')) {
    questions.push({
      id: 'planning-capital-available',
      domain: 'planning',
      prompt:
        goalClassification === 'regulated_physical_consumable'
          ? 'Launching a physical consumable product typically requires $20,000-$60,000 before first sale for regulatory review, sample cycles, production deposit, packaging, and merchant setup. How much capital do you have available for this goal?'
          : 'How much capital do you have available for this goal, and when can it actually be committed?',
      field: 'capitalAvailable',
      answerType: 'number',
      required: true,
      reasonCode: 'PLANNING_CAPITAL_REQUIRED',
    });
  }

  if (!has('hardDeadline') && !hasExplicitField('hardDeadline')) {
    questions.push({
      id: 'planning-hard-deadline',
      domain: 'planning',
      prompt: 'What real external deadline applies here, if any? If none, answer as fast as realistically possible.',
      field: 'hardDeadline',
      answerType: 'text',
      required: true,
      reasonCode: 'PLANNING_HARD_DEADLINE_REQUIRED',
    });
  }

  if (!has('existingDomainRelationships')) {
    questions.push({
      id: 'planning-domain-relationships',
      domain: 'planning',
      prompt:
        'What domain relationships do you already have in place for this goal, if any? For example: manufacturer, regulatory consultant, distributor.',
      field: 'existingDomainRelationships',
      answerType: 'text',
      required: true,
      reasonCode: 'PLANNING_RELATIONSHIPS_REQUIRED',
    });
  }

  if (goalClassification === 'regulated_physical_consumable' && !has('formulaPathway')) {
    questions.push({
      id: 'planning-formula-pathway',
      domain: 'planning',
      prompt: 'Which formula pathway are you pursuing: custom development, base modification, or white label?',
      field: 'formulaPathway',
      answerType: 'single_select',
      options: ['custom_development', 'base_modification', 'white_label'],
      required: true,
      reasonCode: 'PLANNING_FORMULA_PATHWAY_REQUIRED',
    });
  }

  if (goalClassification === 'regulated_physical_consumable' && !has('targetCategory')) {
    questions.push({
      id: 'planning-target-category',
      domain: 'planning',
      prompt: 'Which category best describes the product: food product, dietary supplement, or functional food?',
      field: 'targetCategory',
      answerType: 'single_select',
      options: ['food_product', 'dietary_supplement', 'functional_food'],
      required: true,
      reasonCode: 'PLANNING_TARGET_CATEGORY_REQUIRED',
    });
  }

  if (goalClassification === 'regulated_physical_consumable' && !has('distributionChannel')) {
    questions.push({
      id: 'planning-distribution-channel',
      domain: 'planning',
      prompt: 'Which distribution channel matters first: direct to consumer, marketplace, retail, or wholesale?',
      field: 'distributionChannel',
      answerType: 'single_select',
      options: ['direct_to_consumer', 'marketplace', 'retail', 'wholesale'],
      required: true,
      reasonCode: 'PLANNING_DISTRIBUTION_CHANNEL_REQUIRED',
    });
  }

  return questions;
}

export function buildGoalIntakeContract(input: BuildGoalIntakeContractInput): GoalIntakeContract {
  const rawGoalText = normalizeText(
    input.rawGoalText || input.goalText || input.contract?.goalText || input.goalDraftV2?.goalText
  );
  const verificationCriteria = normalizeText(
    input.verificationCriteria ||
      input.contract?.terminalOutcome?.verificationCriteria ||
      input.goalDraftV2?.definitionOfDone
  );
  const executionType = normalizeText(
    input.executionType || input.contract?.executionType || input.goalDraftV2?.executionType
  );
  const combinedText = `${rawGoalText} ${verificationCriteria}`.trim();
  const terminalOutcomeAuthority = deriveTerminalOutcomeAuthority(rawGoalText || '', verificationCriteria || '');
  const terminalEndpoint = detectTerminalEndpoint(rawGoalText || '', verificationCriteria || '');
  const domain = detectDomain(combinedText, executionType);
  const commitmentVerb = detectCommitmentVerb(rawGoalText || verificationCriteria || combinedText);
  const inferredTargetMetric = inferTargetMetric(rawGoalText || verificationCriteria || combinedText, executionType);
  const inferredCount = input.targetCount ?? inferredTargetMetric.targetCount ?? coerceCount(combinedText);
  const targetUnit = normalizeText(
    input.targetUnit || input.contract?.target?.unit || input.goalDraftV2?.targetUnit || inferredTargetMetric.targetUnit
  );
  const deadline = coerceDeadline(input.deadline || input.contract?.deadline?.dayKey || input.contract?.deadlineISO);
  const supportsBoundaryResolution = supportsCompletionBoundaryResolution(domain, executionType, combinedText);
  const completionBoundaryFromText = supportsBoundaryResolution ? detectBoundaryFromText(combinedText, commitmentVerb) : null;
  // Role A: if the user (or agent-assisted draft) provided a confirmed completionBoundary via
  // answeredContext, use it when text-detection could not resolve the boundary.
  // This is the only place answeredContext affects readiness; all other gate logic is unchanged.
  const VALID_COMPLETION_BOUNDARIES: readonly string[] = [
    'recorded',
    'edited',
    'publish_ready',
    'published',
    'launched',
    'delivered',
    'sold',
    'installed',
    'approved',
    'custom',
  ];
  const answeredBoundaryRaw = (input.answeredContext || {})['completionBoundary'];
  const answeredBoundary =
    supportsBoundaryResolution && VALID_COMPLETION_BOUNDARIES.includes(String(answeredBoundaryRaw || ''))
      ? (answeredBoundaryRaw as CompletionBoundary)
      : null;
  const inferredTerminalBoundary = inferCompletionBoundaryFromTerminalEndpoint(
    terminalEndpoint,
    domain,
    executionType,
    combinedText
  );
  const completionBoundary = completionBoundaryFromText || answeredBoundary || inferredTerminalBoundary;
  const completionBoundaryStatus =
    supportsBoundaryResolution
      ? completionBoundary
        ? 'resolved'
        : domain === 'podcast'
          ? 'ambiguous'
          : 'missing'
      : 'missing';
  const answeredContext = (input.answeredContext || {}) as Record<string, string | number | boolean | string[]>;
  const baseContextQuestions =
    completionBoundaryStatus === 'resolved' ? [] : domain === 'podcast' ? [buildBoundaryQuestion()] : [];
  const hasGoalContext = Boolean(
    input.goalId ||
    input.contract?.goalId ||
    rawGoalText ||
    verificationCriteria ||
    inferredCount !== null ||
    input.goalDraftV2 ||
    input.contract?.goalText ||
    input.contract?.terminalOutcome?.text
  );
  const deliveryMode = /video\s+podcast|podcast\s+video/i.test(combinedText)
    ? 'video'
    : /\baudio\s+podcast\b/i.test(combinedText)
      ? 'audio'
      : null;
  const productionMode = /\bsolo\b/i.test(combinedText)
    ? 'solo'
    : /\bguest\b/i.test(combinedText)
      ? 'guest'
      : /\bmixed\b/i.test(combinedText)
        ? 'mixed'
        : null;
  const startingStateFromText = /from\s+scratch|starting\s+from\s+scratch|partially\s+set\s+up|already\s+equipped|already\s+branded/i.test(
    combinedText
  )
    ? combinedText.match(
        /from\s+scratch|starting\s+from\s+scratch|partially\s+set\s+up|already\s+equipped|already\s+branded/i
      )?.[0] || null
    : null;
  const startingStateFromContext = normalizeText((input.answeredContext || {})['startingState']);
  const startingState = startingStateFromText || startingStateFromContext || null;
  const blockingReasons: string[] = [];
  const assumptionReasons: string[] = [];
  if (!rawGoalText) {
    if (hasGoalContext) {
      assumptionReasons.push('GOAL_TEXT_ASSUMED');
    } else {
      blockingReasons.push('INTAKE_ARTIFACT_UNCLEAR');
    }
  }
  if (!deadline) {
    if (hasGoalContext) {
      assumptionReasons.push('DEADLINE_ASSUMED');
    } else {
      blockingReasons.push('INTAKE_DEADLINE_MISSING');
    }
  }
  if (domain === 'podcast' && completionBoundaryStatus === 'ambiguous') {
    blockingReasons.push('INTAKE_BOUNDARY_AMBIGUOUS');
  }
  if (!startingState && rawGoalText) {
    assumptionReasons.push('STARTING_STATE_ASSUMED');
  }
  const confirmedPlanningContext = {
    ...((input.contract?.goalIntakeContract?.planningIntake as Record<string, unknown>) || {}),
    ...((input.contract?.planningIntake as Record<string, unknown>) || {}),
    ...answeredContext,
  };
  const planningBuild = buildStructuredPlanningIntake({
    rawGoalText,
    executionType,
    contract: input.contract,
    goalDraftV2: input.goalDraftV2,
    answeredContext: confirmedPlanningContext,
  });
  const planningQuestions = buildStructuredPlanningQuestions(planningBuild.intake, confirmedPlanningContext);
  const startDayKey =
    String(
      input.contract?.startDayKey ||
        input.contract?.startDateISO ||
        input.contract?.startDate ||
        input.goalDraftV2?.startDate ||
        ''
    ).trim() || null;
  const prePlanFeasibility = evaluatePrePlanFeasibility(planningBuild.intake, {
    startDayKey,
  });
  const capitalAcquisitionFeasibility =
    planningBuild.intake.goalClassification === 'regulated_physical_consumable'
      ? buildCapitalAcquisitionFeasibility(planningBuild.intake)
      : null;
  const requiredContextQuestions = [...baseContextQuestions, ...planningQuestions];
  const scopePolicy =
    domain === 'podcast' && completionBoundary
      ? resolvePodcastScopePolicy(completionBoundary)
      : {
          required: [],
          recommended: [],
          optional: [],
          excluded: [],
          assumptionsNeedingConfirmation: completionBoundaryStatus === 'resolved' ? [] : ['completion boundary'],
        };
  if (!startingState && rawGoalText) {
    scopePolicy.assumptionsNeedingConfirmation.push('starting state');
  }

  const readinessState: IntakeReadinessState =
    blockingReasons.length > 0
      ? 'intake_blocked'
      : assumptionReasons.length > 0
        ? 'assumption_marked_draft'
        : 'fully_admitted';
  return {
    goalId: normalizeText(input.goalId || input.contract?.goalId),
    rawGoalText,
    domain,
    targetArtifactType: domain === 'podcast' ? 'episodes' : inferredCount !== null ? 'deliverables' : null,
    targetCount: inferredCount ?? null,
    targetUnit: targetUnit || null,
    deadline,
    commitmentVerb,
    completionBoundary,
    completionBoundaryStatus,
    deliveryMode,
    productionMode,
    startingState,
    requiredContextQuestions,
    answeredContext,
    planningIntake: planningBuild.intake,
    prePlanFeasibility,
    capitalAcquisitionFeasibility,
    scopePolicy,
    readiness: {
      state: readinessState,
      isReadyForPlanning: readinessState !== 'intake_blocked',
      blockingReasons: blockingReasons.length
        ? blockingReasons
        : requiredContextQuestions.length > 0
          ? [requiredContextQuestions[0].reasonCode]
          : [],
      assumptionReasons,
    },
    terminalOutcomeAuthority,
    terminalEndpoint,
  };
}

export function getIntakeGateCode(intake: GoalIntakeContract): IntakeGateCode {
  if (!intake) {
    return 'INTAKE_NOT_READY_FOR_GRAPH';
  }
  if (intake.readiness?.blockingReasons?.includes('INTAKE_DEADLINE_MISSING')) {
    return 'INTAKE_DEADLINE_MISSING';
  }
  if (intake.readiness?.blockingReasons?.includes('INTAKE_ARTIFACT_UNCLEAR')) {
    return 'INTAKE_ARTIFACT_UNCLEAR';
  }
  if (intake.completionBoundaryStatus === 'ambiguous' && intake.domain === 'podcast') {
    return 'INTAKE_BOUNDARY_AMBIGUOUS';
  }
  if (!intake.goalId || !intake.rawGoalText) {
    return 'INTAKE_ARTIFACT_UNCLEAR';
  }
  return intake.readiness.isReadyForPlanning ? 'INTAKE_OK' : 'INTAKE_NOT_READY_FOR_GRAPH';
}
