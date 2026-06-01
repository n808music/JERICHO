import { generateCandidates, type CandidateGenerationInputs } from './generateCandidates.ts';
import {
  scoreSchedule,
  type ScoreAssignment,
  type ScoreBreakdown,
  type ScoreInputs,
} from '../scoring/scoreSchedule.ts';

export type OptimizeScheduleInputs = {
  baselineAssignments: ScoreAssignment[];
  frozenReservations: Array<{ actionId: string; chunkIndex: number }>;
  actionGraph: ScoreInputs['actionGraph'];
  constraints: ScoreInputs['constraints'];
  horizons: ScoreInputs['horizons'];
  milestones?: ScoreInputs['milestones'];
  metricsContext?: ScoreInputs['metricsContext'];
  actionConstraintsById?: CandidateGenerationInputs['actionConstraintsById'];
  dependencyBufferMinutes?: number;
  maxIterations?: number;
  maxCandidatesPerIter?: number;
};

export type OptimizeScheduleResult = {
  bestAssignments: ScoreAssignment[];
  bestScore: ScoreBreakdown;
  improvement: {
    deltaTotal: number;
    deltaByComponent: ScoreBreakdown['components'];
  };
  chosenMovesSummary: {
    iterations: number;
    candidatesEvaluated: number;
    moves: Array<{
      actionId: string;
      chunkIndex: number;
      fromDayKey: string;
      fromStartMin: number;
      toDayKey: string;
      toStartMin: number;
    }>;
  };
};

function cloneAssignments(assignments: ScoreAssignment[]) {
  return (assignments || []).map((row) => ({ ...row }));
}

function deltaComponents(a: ScoreBreakdown['components'], b: ScoreBreakdown['components']) {
  return {
    deadlineRisk: Number((b.deadlineRisk - a.deadlineRisk).toFixed(6)),
    milestoneRisk: Number((b.milestoneRisk - a.milestoneRisk).toFixed(6)),
    dependencyRisk: Number((b.dependencyRisk - a.dependencyRisk).toFixed(6)),
    contextSwitching: Number((b.contextSwitching - a.contextSwitching).toFixed(6)),
    loadSmoothness: Number((b.loadSmoothness - a.loadSmoothness).toFixed(6)),
    deferralPenalty: Number((b.deferralPenalty - a.deferralPenalty).toFixed(6)),
  };
}

function summarizeMoves(before: ScoreAssignment[], after: ScoreAssignment[]) {
  const beforeByKey = new Map(before.map((row) => [`${row.actionId}::${row.chunkIndex}`, row]));
  const moves: OptimizeScheduleResult['chosenMovesSummary']['moves'] = [];
  after.forEach((row) => {
    const key = `${row.actionId}::${row.chunkIndex}`;
    const previous = beforeByKey.get(key);
    if (!previous) return;
    if (previous.dayKey === row.dayKey && previous.startMin === row.startMin) return;
    moves.push({
      actionId: row.actionId,
      chunkIndex: row.chunkIndex,
      fromDayKey: previous.dayKey,
      fromStartMin: previous.startMin,
      toDayKey: row.dayKey,
      toStartMin: row.startMin,
    });
  });
  moves.sort((a, b) => {
    if (a.actionId !== b.actionId) return a.actionId.localeCompare(b.actionId);
    return a.chunkIndex - b.chunkIndex;
  });
  return moves;
}

function scoreInputsFrom(assignments: ScoreAssignment[], inputs: OptimizeScheduleInputs): ScoreInputs {
  return {
    assignments,
    actionGraph: inputs.actionGraph,
    constraints: inputs.constraints,
    horizons: inputs.horizons,
    milestones: inputs.milestones,
    metricsContext: inputs.metricsContext,
  };
}

export function optimizeSchedule(inputs: OptimizeScheduleInputs): OptimizeScheduleResult {
  const maxIterations = Math.max(1, Number(inputs.maxIterations || 2));
  const maxCandidatesPerIter = Math.max(1, Number(inputs.maxCandidatesPerIter || 30));

  let current = cloneAssignments(inputs.baselineAssignments || []);
  const baselineScore = scoreSchedule(scoreInputsFrom(current, inputs));
  let bestScore = baselineScore;
  let candidatesEvaluated = 0;

  for (let i = 0; i < maxIterations; i += 1) {
    const candidates = generateCandidates({
      baselineAssignments: current,
      frozenReservations: inputs.frozenReservations,
      actionGraph: inputs.actionGraph,
      constraints: inputs.constraints,
      horizons: inputs.horizons,
      milestones: inputs.milestones,
      actionConstraintsById: inputs.actionConstraintsById,
      dependencyBufferMinutes: inputs.dependencyBufferMinutes,
      maxCandidates: maxCandidatesPerIter,
    });

    let chosen: ScoreAssignment[] | null = null;
    let chosenScore: ScoreBreakdown | null = null;
    for (const candidate of candidates) {
      const candidateScore = scoreSchedule(scoreInputsFrom(candidate, inputs));
      candidatesEvaluated += 1;
      if (candidateScore.total >= bestScore.total) continue;
      if (!chosenScore || candidateScore.total < chosenScore.total) {
        chosen = candidate;
        chosenScore = candidateScore;
      }
    }

    if (!chosen || !chosenScore) break;
    current = cloneAssignments(chosen);
    bestScore = chosenScore;
  }

  const moves = summarizeMoves(inputs.baselineAssignments || [], current);

  return {
    bestAssignments: current,
    bestScore,
    improvement: {
      deltaTotal: Number((bestScore.total - baselineScore.total).toFixed(6)),
      deltaByComponent: deltaComponents(baselineScore.components, bestScore.components),
    },
    chosenMovesSummary: {
      iterations: maxIterations,
      candidatesEvaluated,
      moves,
    },
  };
}
