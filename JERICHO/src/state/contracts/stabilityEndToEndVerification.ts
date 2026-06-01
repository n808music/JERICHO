import { ARCHETYPE_MATRIX_1_0 } from './archetypeMatrix1_0';
import { runCompilerScorecardFullMatrix } from './compilerScorecardRunner';
import { getRepresentativeGoals1_0, normalizeLaneKey } from './archetypeRepresentativeGoals1_0';
import {
  getLaneContextSpec,
  listLaneAuthoredQuestionCoverage,
  selectContextQuestionsForLane,
} from './contextAdmissionMatrix1_0';
import { compileGoalToDeliverables } from '../engine/goalToDeliverables';
import { buildStabilityRecoveryPayload } from '../engine/stabilityRecoveryPayload';
import type { StabilityRecoveryPayload } from '../engine/recoveryTypes';

export type LaneRuntimeIntegrity = {
  fallbackUsed: boolean;
  missingFields: string[];
  canonicalPathBreak: boolean;
  scheduleGenerationFailureReasons: string[];
  issues: string[];
};

export type LaneEndToEndVerification = {
  laneKey: string;
  archetype: string;
  subtype: string;
  goalText: string;
  admission: {
    detectedArchetype: string;
    detectedSubtype: string;
    confidence: number;
    routingBasis: string;
  };
  context: {
    requiredQuestionsAsked: number;
    optionalQuestionsAsked: number;
    answersProvided: number;
    defaultsApplied: number;
    confirmationRequired: boolean;
    unresolvedAssumptions: string[];
  };
  compilation: {
    canonicalPathUsed: boolean;
    outputCount: number;
    outputTypes: Array<'deliverable' | 'milestone'>;
    actionCount: number;
    estimatedSessionCount: number;
    scheduleGenerationStatus: 'generated' | 'failed';
  };
  quality: {
    overall: 'pass' | 'warn' | 'fail';
    dimensions: {
      outputQuality: 'pass' | 'warn' | 'fail';
      actionQuality: 'pass' | 'warn' | 'fail';
      scheduleQuality: 'pass' | 'warn' | 'fail';
      correctionQuality: 'pass' | 'warn' | 'fail';
      progressTrackingQuality: 'pass' | 'warn' | 'fail';
    };
    weakestDimensions: string[];
  };
  runtimeIntegrity: LaneRuntimeIntegrity;
  recovery: StabilityRecoveryPayload;
};

export type StabilityEndToEndSummary = {
  totalLanes: number;
  passCount: number;
  warnCount: number;
  failCount: number;
  byArchetype: Record<string, { pass: number; warn: number; fail: number }>;
  laneVerifications: LaneEndToEndVerification[];
  contextCoverage: {
    canonicalLaneCount: number;
    authoredLaneCount: number;
    missingAuthored: string[];
  };
  weakestDimensions: Record<string, string[]>;
};

function synthesizeActionsFromLane(archetype: string, subtype: string) {
  const archetypeSpec = ARCHETYPE_MATRIX_1_0.find((entry) => entry.archetype === archetype);
  const lane = archetypeSpec?.lanes.find((entry) => entry.subtype === subtype);
  if (!lane) return [];

  return lane.grammar.typicalDeliverables.map((deliverable, index) => ({
    id: `${archetype}:${subtype}:${index + 1}`.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
    title: `${lane.grammar.actionClasses[index % lane.grammar.actionClasses.length] || 'execute'}: ${deliverable}`,
    deliverable,
    definitionOfDone: `Output completed: ${deliverable}`,
    actionType: index === 0 ? 'preparation' : 'execution',
    estimateMin: 60,
    dependencies: index === 0 ? [] : [`${archetype}:${subtype}:${index}`.toLowerCase().replace(/[^a-z0-9]+/g, '-')],
  }));
}

function executionTypeForArchetype(archetype: string) {
  if (archetype === 'SkillAcquisition') return 'SkillAcquisition';
  if (archetype === 'BrandLaunch') return 'BrandLaunch';
  if (archetype === 'SalesPipeline') return 'SalesPipeline';
  if (archetype === 'Fundraising') return 'Fundraising';
  return archetype;
}

function deriveRuntimeIntegrity({
  canonicalPathUsed,
  legacyFallbackUsed,
  outputCount,
  actionCount,
  estimatedSessionCount,
  scheduleQuality,
  issues,
}: {
  canonicalPathUsed: boolean;
  legacyFallbackUsed: boolean;
  outputCount: number;
  actionCount: number;
  estimatedSessionCount: number;
  scheduleQuality: 'pass' | 'warn' | 'fail';
  issues: string[];
}): LaneRuntimeIntegrity {
  const missingFields: string[] = [];
  if (outputCount <= 0) missingFields.push('outputs');
  if (actionCount <= 0) missingFields.push('actions');
  if (estimatedSessionCount <= 0) missingFields.push('estimated_sessions');

  const scheduleGenerationFailureReasons: string[] = [];
  if (scheduleQuality === 'fail') {
    if (actionCount <= 0 || estimatedSessionCount <= 0) {
      scheduleGenerationFailureReasons.push('NO_ACTION_OR_SESSION_ESTIMATE');
    } else {
      scheduleGenerationFailureReasons.push('SCHEDULE_QUALITY_FAILED');
    }
  }

  return {
    fallbackUsed: legacyFallbackUsed,
    missingFields,
    canonicalPathBreak: !canonicalPathUsed,
    scheduleGenerationFailureReasons,
    issues,
  };
}

export function buildStabilityEndToEndSummary(): StabilityEndToEndSummary {
  const scorecardRun = runCompilerScorecardFullMatrix();
  const laneByKey = new Map(
    scorecardRun.laneResults.map((result) => [normalizeLaneKey(result.archetype, result.subtype), result])
  );
  const fixtures = getRepresentativeGoals1_0();

  const laneVerifications = fixtures.map((fixture) => {
    const laneKey = normalizeLaneKey(fixture.archetype, fixture.subtype);
    const laneScore = laneByKey.get(laneKey);
    if (!laneScore) {
      throw new Error(`Missing scorecard lane result for ${laneKey}`);
    }

    const contextSpec = getLaneContextSpec(fixture.archetype, fixture.subtype);
    const contextSelection = selectContextQuestionsForLane({
      archetype: fixture.archetype,
      subtype: fixture.subtype,
      answeredQuestionIds: [],
      askOptional: false,
    });

    const compiled = compileGoalToDeliverables({
      executionType: executionTypeForArchetype(fixture.archetype),
      actions: synthesizeActionsFromLane(fixture.archetype, fixture.subtype),
      contract: { goalText: fixture.representativeGoal, terminalOutcome: { text: fixture.representativeGoal } },
      cycleId: `stability-e2e:${laneKey.toLowerCase().replace(/[^a-z0-9]+/g, '_')}`,
    });

    const outputTypes = Array.from(new Set(compiled.deliverables.map((entry) => entry.outputType)));
    const weakestDimensions = Object.entries(laneScore.scorecard)
      .filter(([, rating]) => rating !== 'pass')
      .map(([dimension]) => dimension);

    const recovery = buildStabilityRecoveryPayload({
      laneKey,
      archetype: fixture.archetype,
      subtype: fixture.subtype,
      planState: {
        plannedOutputs: Math.max(1, compiled.deliverables.length),
        completedOutputs: Math.max(0, compiled.deliverables.length - (laneScore.overall === 'pass' ? 0 : 1)),
        blockedDependencies: laneScore.scorecard.scheduleQuality === 'fail' ? 1 : 0,
        requiredWeeklySessions: 6,
        availableWeeklySessions: laneScore.scorecard.scheduleQuality === 'fail' ? 3 : 8,
      },
      executionState: {
        plannedSessions: Math.max(1, compiled.estimatedSessionCount),
        completedSessions:
          laneScore.overall === 'pass'
            ? compiled.estimatedSessionCount
            : Math.max(0, compiled.estimatedSessionCount - 2),
        missedSessions: laneScore.overall === 'pass' ? 0 : 2,
        adherenceRate: laneScore.overall === 'pass' ? 0.85 : 0.5,
        readinessScore: laneScore.scorecard.outputQuality === 'fail' ? 0.45 : 0.8,
        throughputActual: laneScore.scorecard.actionQuality === 'fail' ? 2 : 6,
        throughputExpected: 6,
        qualityFailures: laneScore.scorecard.outputQuality === 'fail' ? 1 : 0,
        qualityScore: laneScore.scorecard.outputQuality === 'fail' ? 0.55 : 0.85,
      },
      scheduleState: {
        requiredWeeklySessions: 6,
        availableWeeklySessions: laneScore.scorecard.scheduleQuality === 'fail' ? 3 : 8,
        unplacedSessions: laneScore.scorecard.scheduleQuality === 'fail' ? 2 : 0,
      },
      contextState: {
        missingRequiredAnswers: contextSelection.confirmationRequired
          ? contextSpec.requiredQuestions.map((question) => question.text)
          : [],
        successDefinitionClear: !contextSelection.confirmationRequired,
        assumptionsApplied: contextSelection.assumptionsApplied,
      },
    });

    return {
      laneKey,
      archetype: fixture.archetype,
      subtype: fixture.subtype,
      goalText: fixture.representativeGoal,
      admission: {
        detectedArchetype: fixture.archetype,
        detectedSubtype: fixture.subtype,
        confidence: 1,
        routingBasis: 'canonical_1_0_representative_lane_fixture',
      },
      context: {
        requiredQuestionsAsked: contextSelection.requiredQuestionsToAsk.length,
        optionalQuestionsAsked: contextSelection.optionalQuestionsToAsk.length,
        answersProvided: 0,
        defaultsApplied: contextSelection.assumptionsApplied.length,
        confirmationRequired: contextSelection.confirmationRequired,
        unresolvedAssumptions: contextSelection.assumptionsApplied,
      },
      compilation: {
        canonicalPathUsed: compiled.usesCanonicalDeliverablePath,
        outputCount: compiled.deliverables.length,
        outputTypes,
        actionCount: compiled.actionSeeds.length,
        estimatedSessionCount: compiled.estimatedSessionCount,
        scheduleGenerationStatus: laneScore.scorecard.scheduleQuality === 'fail' ? 'failed' : 'generated',
      },
      quality: {
        overall: laneScore.overall,
        dimensions: laneScore.scorecard,
        weakestDimensions,
      },
      runtimeIntegrity: deriveRuntimeIntegrity({
        canonicalPathUsed: compiled.usesCanonicalDeliverablePath,
        legacyFallbackUsed: compiled.legacyFallbackUsed,
        outputCount: compiled.deliverables.length,
        actionCount: compiled.actionSeeds.length,
        estimatedSessionCount: compiled.estimatedSessionCount,
        scheduleQuality: laneScore.scorecard.scheduleQuality,
        issues: laneScore.issues,
      }),
      recovery,
    } satisfies LaneEndToEndVerification;
  });

  return {
    totalLanes: laneVerifications.length,
    passCount: scorecardRun.aggregate.pass,
    warnCount: scorecardRun.aggregate.warn,
    failCount: scorecardRun.aggregate.fail,
    byArchetype: scorecardRun.aggregate.byArchetype,
    laneVerifications,
    contextCoverage: listLaneAuthoredQuestionCoverage(),
    weakestDimensions: scorecardRun.aggregate.weakestDimensions,
  };
}
