/**
 * Basic cycle metrics (kept for backward compatibility).
 */
type CycleSummary = {
  completionCount: number;
  completionRate: number;
  convergenceReport?: any; // ConvergenceReport from convergenceTerminal.ts
};

export function summarizeCycle(cycle: any): CycleSummary {
  const events = cycle?.executionEvents || [];
  const completed = events.filter((e: any) => e?.completed && (!e.kind || e.kind === 'complete'));
  const created = events.filter((e: any) => e?.kind === 'create');
  const completionCount = completed.length;
  const completionRate = created.length ? completionCount / created.length : 0;
  return {
    completionCount,
    completionRate,
    convergenceReport: cycle?.convergenceReport
  };
}
