import { summarizeCycle } from './cycleSummary.ts';

export type ProfileLearning = {
  cycleCount: number;
  totalCompletionCount: number;
  averageCompletionRate: number;
};

/**
 * Compute profile learning from ended cycles with convergence verdict.
 * MVP 3.0: Only cycles with CONVERGED verdict contribute to learning.
 * This prevents learning from polluted failed/incomplete attempts.
 */
export function computeProfileLearning(cyclesById: Record<string, any> = {}): ProfileLearning {
  // Filter to ended cycles with convergence verdict CONVERGED
  const learnableCycles = Object.values(cyclesById || {}).filter((cycle: any) => {
    if (cycle?.status !== 'ended') return false;
    // MVP 3.0: Require convergence verdict
    const verdict = cycle?.convergenceReport?.verdict;
    return verdict === 'CONVERGED';
  });

  if (!learnableCycles.length) {
    return { cycleCount: 0, totalCompletionCount: 0, averageCompletionRate: 0 };
  }

  const summaries = learnableCycles.map((cycle: any) => summarizeCycle(cycle));
  const totalCompletionCount = summaries.reduce((sum, s) => sum + (s.completionCount || 0), 0);
  const averageCompletionRate =
    summaries.reduce((sum, s) => sum + (Number.isFinite(s.completionRate) ? s.completionRate : 0), 0) / summaries.length;

  return {
    cycleCount: learnableCycles.length,
    totalCompletionCount,
    averageCompletionRate
  };
}
