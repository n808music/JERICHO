import { generateCandidates } from './generateCandidates.ts';
import {
  scoreSchedule,
  type ScheduleAssignment,
  type ScoreInputs,
  type ScoreBreakdown,
} from '../scoring/scoreSchedule.ts';
import { getQualityPolicy, type QualityPolicy } from '../scoring/policy.ts';

type OptimizeInput = {
  baselineAssignments: ScheduleAssignment[];
  frozenReservations?: Array<{ actionId: string; chunkIndex: number }>;
  actionGraph?: ScoreInputs['actionGraph'];
  constraints?: ScoreInputs['constraints'];
  horizons?: ScoreInputs['horizons'];
  milestones?: ScoreInputs['milestones'];
  metricsContext?: ScoreInputs['metricsContext'];
  policyId?: string;
  policy?: QualityPolicy;
  maxIterations?: number;
  maxCandidatesPerIter?: number;
  candidateSchedules?: ScheduleAssignment[][];
};

const REJECTION_CODES = [
  'DEADLINE_GUARDRAIL',
  'MILESTONE_GUARDRAIL',
  'DEFERRAL_GUARDRAIL',
  'DEPENDENCY_GUARDRAIL',
  'NO_IMPROVEMENT',
] as const;

type RejectionCode = (typeof REJECTION_CODES)[number];

function initSummary(): Record<RejectionCode, number> {
  return {
    DEADLINE_GUARDRAIL: 0,
    MILESTONE_GUARDRAIL: 0,
    DEFERRAL_GUARDRAIL: 0,
    DEPENDENCY_GUARDRAIL: 0,
    NO_IMPROVEMENT: 0,
  };
}

function scoreCandidate(
  assignments: ScheduleAssignment[],
  input: OptimizeInput,
  policy: QualityPolicy
): ScoreBreakdown {
  return scoreSchedule({
    assignments,
    assignmentsAreSorted: false,
    actionGraph: input.actionGraph,
    constraints: input.constraints,
    horizons: input.horizons,
    milestones: input.milestones,
    metricsContext: input.metricsContext,
    policy,
  });
}

function violatesGuardrails(
  baseline: ScoreBreakdown,
  candidate: ScoreBreakdown,
  policy: QualityPolicy
): RejectionCode | null {
  if (
    candidate.components.deadlineRisk - baseline.components.deadlineRisk >
    policy.optimizerGuardrails.allowDeadlineRiskIncrease
  ) {
    return 'DEADLINE_GUARDRAIL';
  }
  if (
    candidate.components.milestoneRisk - baseline.components.milestoneRisk >
    policy.optimizerGuardrails.allowMilestoneRiskIncrease
  ) {
    return 'MILESTONE_GUARDRAIL';
  }
  if (
    candidate.components.deferralPenalty - baseline.components.deferralPenalty >
    policy.optimizerGuardrails.allowDeferralPenaltyIncrease
  ) {
    return 'DEFERRAL_GUARDRAIL';
  }
  if (
    candidate.components.dependencyRisk - baseline.components.dependencyRisk >
    policy.optimizerGuardrails.allowDependencyRiskIncrease
  ) {
    return 'DEPENDENCY_GUARDRAIL';
  }
  return null;
}

export function optimizeSchedule(input: OptimizeInput) {
  const debugPerf = typeof process !== 'undefined' && process.env?.JERICHO_DEBUG_PERF_ACTIONS === '1';
  const totalStart = debugPerf ? Date.now() : 0;
  const policy = input.policy || getQualityPolicy(input.policyId);
  const maxIterations = Math.max(1, input.maxIterations || 2);
  const maxCandidatesPerIter = Math.max(1, input.maxCandidatesPerIter || 30);
  const rejectedCandidatesSummary = initSummary();
  let baselineScoreMs = 0;
  let candidateGenerationMs = 0;
  let candidateScoringMs = 0;

  let bestAssignments = input.baselineAssignments.map((a) => ({ ...a }));
  const baselineStart = debugPerf ? Date.now() : 0;
  let bestScore = scoreCandidate(bestAssignments, input, policy);
  baselineScoreMs = debugPerf ? Date.now() - baselineStart : 0;
  const baselineScore = bestScore;

  for (let iter = 0; iter < maxIterations; iter += 1) {
    const candidateGenerationStart = debugPerf ? Date.now() : 0;
    const candidatesRaw =
      input.candidateSchedules && input.candidateSchedules.length
        ? input.candidateSchedules
        : generateCandidates({
            baselineAssignments: bestAssignments,
            frozenReservations: input.frozenReservations,
            maxCandidates: maxCandidatesPerIter,
          });
    candidateGenerationMs += debugPerf ? Date.now() - candidateGenerationStart : 0;

    const candidates = candidatesRaw.slice(0, maxCandidatesPerIter);
    let improved = false;

    for (const candidateAssignments of candidates) {
      const candidateScoreStart = debugPerf ? Date.now() : 0;
      const candidate = scoreCandidate(candidateAssignments, input, policy);
      candidateScoringMs += debugPerf ? Date.now() - candidateScoreStart : 0;
      if (candidate.total >= bestScore.total) {
        rejectedCandidatesSummary.NO_IMPROVEMENT += 1;
        continue;
      }
      const rejection = violatesGuardrails(bestScore, candidate, policy);
      if (rejection) {
        rejectedCandidatesSummary[rejection] += 1;
        continue;
      }
      bestAssignments = candidateAssignments.map((a) => ({ ...a }));
      bestScore = candidate;
      improved = true;
    }

    if (!improved) break;
  }

  const improvement = {
    deltaTotal: bestScore.total - baselineScore.total,
    deltaByComponent: {
      deadlineRisk: bestScore.components.deadlineRisk - baselineScore.components.deadlineRisk,
      milestoneRisk: bestScore.components.milestoneRisk - baselineScore.components.milestoneRisk,
      dependencyRisk: bestScore.components.dependencyRisk - baselineScore.components.dependencyRisk,
      contextSwitching: bestScore.components.contextSwitching - baselineScore.components.contextSwitching,
      loadSmoothness: bestScore.components.loadSmoothness - baselineScore.components.loadSmoothness,
      deferralPenalty: bestScore.components.deferralPenalty - baselineScore.components.deferralPenalty,
    },
  };

  return {
    bestAssignments,
    baselineScore,
    bestScore,
    improvement,
    chosenMovesSummary: {
      movedChunks: Math.max(0, input.baselineAssignments.length - bestAssignments.length),
    },
    rejectedCandidatesSummary,
    perf: debugPerf
      ? {
          totalMs: Date.now() - totalStart,
          baselineScoreMs,
          candidateGenerationMs,
          candidateScoringMs,
        }
      : undefined,
  };
}
