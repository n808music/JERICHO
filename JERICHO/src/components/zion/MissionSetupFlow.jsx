import React, { useState, useMemo } from 'react';

/**
 * MissionSetupFlow: Single onboarding pipeline for Structure tab
 * 
 * Stages:
 * 1. Define Goal (gated input via Workspace)
 * 2. Feasibility + Capacity (read-only computed)
 * 3. Generate Proposed Schedule (one action)
 * 4. Commit (Apply)
 * 
 * Design:
 * - Goal must be compiled before Feasibility gate unlocks
 * - Feasibility gate must pass before Plan generation unlocks
 * - Proposed blocks must exist before Apply button activates
 * - Non-critical panels (deliverables, truth, strategy) hidden in collapsible sections
 */
export default function MissionSetupFlow({
  activeCycleId,
  activeCycle,
  feasibilityByGoal,
  probabilityByGoal,
  appTime,
  goalExecutionContract,
  suggestedBlocks,
  actions,
  emitAction
}) {
  const [advancedOpen, setAdvancedOpen] = useState(false);

  if (!activeCycleId || !activeCycle) {
    return <div className="text-xs text-muted">No active cycle.</div>;
  }

  // Extract goal and plan state
  const goalId = goalExecutionContract?.goalId || activeCycle?.goalContract?.goalId;
  const definiteGoal = activeCycle?.definiteGoal;
  const feasibility = goalId ? feasibilityByGoal?.[goalId] : null;
  const probability = goalId ? probabilityByGoal?.[goalId] : null;
  const autoAsanaPlan = activeCycle?.autoAsanaPlan || null;
  const proposedBlockCount = (suggestedBlocks || []).filter((s) => s && s.status === 'suggested').length;
  
  // Determine stage gating
  const hasCompiledGoal = definiteGoal?.outcome && definiteGoal?.deadlineDayKey;
  const isFeasible = feasibility?.status === 'FEASIBLE';
  const hasProposedSchedule = proposedBlockCount > 0 || (autoAsanaPlan?.horizonBlocks?.length);

  // Current stage
  let currentStage = 1;
  if (hasCompiledGoal) currentStage = 2;
  if (hasCompiledGoal && isFeasible) currentStage = 3;
  if (hasProposedSchedule) currentStage = 4;

  return (
    <div className="space-y-4">
      {/* STAGE 1: Define Goal */}
      <div className="rounded-xl border border-line/60 bg-jericho-surface/90 p-4 space-y-3">
        <div className="flex items-center gap-2">
          <span className="inline-block w-6 h-6 rounded-full bg-jericho-accent text-white text-[10px] font-semibold flex items-center justify-center">
            1
          </span>
          <p className="text-xs uppercase tracking-[0.14em] text-muted">Stage 1: Define Goal</p>
          {hasCompiledGoal && <span className="text-[10px] text-green-600">✓ Complete</span>}
        </div>
        <div className="text-xs text-muted space-y-2 border-t border-line/40 pt-2">
          <p className="text-[11px]">Compile your goal outcome and deadline to proceed.</p>
          <div className="rounded-md bg-jericho-surface/50 px-3 py-2 border border-line/40">
            {hasCompiledGoal ? (
              <>
                <p className="text-[10px] uppercase tracking-[0.12em] text-muted mb-1">Current Goal</p>
                <p className="text-sm font-semibold text-jericho-text">{definiteGoal.outcome}</p>
                <p className="text-[10px] text-muted mt-1">Deadline: {definiteGoal.deadlineDayKey}</p>
              </>
            ) : (
              <p className="text-[11px] text-muted">Use the Goal Editor below to define your outcome and deadline.</p>
            )}
          </div>
        </div>
      </div>

      {/* STAGE 2: Feasibility + Capacity (appears after goal is compiled) */}
      {currentStage >= 2 ? (
        <div className={`rounded-xl border p-4 space-y-3 ${isFeasible ? 'border-green-600/40 bg-green-50/5' : 'border-amber-600/40 bg-amber-50/5'}`}>
          <div className="flex items-center gap-2">
            <span className="inline-block w-6 h-6 rounded-full bg-jericho-accent text-white text-[10px] font-semibold flex items-center justify-center">
              2
            </span>
            <p className="text-xs uppercase tracking-[0.14em] text-muted">Stage 2: Feasibility Check</p>
            <span className={`text-[10px] font-semibold ${isFeasible ? 'text-green-600' : 'text-amber-600'}`}>
              {isFeasible ? '✓ Feasible' : feasibility?.status || 'Pending'}
            </span>
          </div>
          {feasibility ? (
            <div className="space-y-2 text-xs text-muted">
              <div className="grid sm:grid-cols-2 gap-2">
                <div className="rounded-md border border-line/40 bg-jericho-surface/80 px-3 py-2">
                  <p className="uppercase tracking-[0.12em] text-[10px] mb-1">Required pace</p>
                  <p className="text-sm text-jericho-text font-semibold">
                    {feasibility.requiredBlocksPerDay ? feasibility.requiredBlocksPerDay.toFixed(1) : '—'} blocks/day
                  </p>
                </div>
                <div className="rounded-md border border-line/40 bg-jericho-surface/80 px-3 py-2">
                  <p className="uppercase tracking-[0.12em] text-[10px] mb-1">Days remaining</p>
                  <p className="text-sm text-jericho-text font-semibold">
                    {feasibility.workableDaysRemaining || '—'}
                  </p>
                </div>
              </div>
              {feasibility.reasons?.length ? (
                <div className="rounded-md border border-line/40 bg-jericho-surface/80 px-3 py-2">
                  <p className="uppercase tracking-[0.12em] text-[10px] mb-1">Notes</p>
                  <p className="text-[11px] text-muted">{feasibility.reasons.join('; ')}</p>
                </div>
              ) : null}
            </div>
          ) : (
            <p className="text-[11px] text-muted">Feasibility analysis pending...</p>
          )}
        </div>
      ) : null}

      {/* STAGE 3: Generate Proposed Schedule */}
      {currentStage >= 3 && hasCompiledGoal && isFeasible ? (
        <div className="rounded-xl border border-line/60 bg-jericho-surface/90 p-4 space-y-3">
          <div className="flex items-center gap-2">
            <span className="inline-block w-6 h-6 rounded-full bg-jericho-accent text-white text-[10px] font-semibold flex items-center justify-center">
              3
            </span>
            <p className="text-xs uppercase tracking-[0.14em] text-muted">Stage 3: Generate Schedule</p>
            {hasProposedSchedule && <span className="text-[10px] text-green-600">✓ Generated</span>}
          </div>
          {!hasProposedSchedule ? (
            <button
              className="rounded-full border border-jericho-accent px-4 py-2 text-xs text-jericho-accent hover:bg-jericho-accent/10 font-semibold"
              onClick={() =>
                emitAction('plan.generate', { cycleId: activeCycleId }, actions.generatePlan)
              }
              disabled={!actions.generatePlan}
            >
              Generate Cold Plan
            </button>
          ) : (
            <>
              <div className="rounded-md border border-line/40 bg-jericho-surface/80 px-3 py-2">
                <p className="uppercase tracking-[0.12em] text-[10px] text-muted mb-1">Proposed blocks</p>
                <p className="text-sm font-semibold text-jericho-text">{proposedBlockCount || autoAsanaPlan?.horizonBlocks?.length || 0}</p>
              </div>
              <p className="text-[11px] text-muted">Review proposed blocks on the Today view. Proceed to apply when ready.</p>
            </>
          )}
        </div>
      ) : null}

      {/* STAGE 4: Apply to Calendar */}
      {hasProposedSchedule && currentStage >= 4 ? (
        <div className="rounded-xl border border-line/60 bg-jericho-surface/90 p-4 space-y-3">
          <div className="flex items-center gap-2">
            <span className="inline-block w-6 h-6 rounded-full bg-jericho-accent text-white text-[10px] font-semibold flex items-center justify-center">
              4
            </span>
            <p className="text-xs uppercase tracking-[0.14em] text-muted">Stage 4: Commit Schedule</p>
          </div>
          <button
            className="rounded-full border border-jericho-accent px-4 py-2 text-xs text-jericho-accent hover:bg-jericho-accent/10 font-semibold"
            onClick={() =>
              emitAction('plan.apply', { cycleId: activeCycleId }, actions.applyPlan)
            }
            disabled={!actions.applyPlan || !hasProposedSchedule}
          >
            Apply Schedule to Calendar
          </button>
          <p className="text-[11px] text-muted">Accepts all proposed blocks and commits them to your calendar.</p>
        </div>
      ) : null}

      {/* CLUTTER: Advanced Options (collapsed) */}
      <details className="rounded-xl border border-line/60 bg-jericho-surface/90 p-4">
        <summary className="cursor-pointer flex items-center gap-2">
          <p className="text-xs uppercase tracking-[0.14em] text-muted">Strategy & Constraints (Advanced)</p>
        </summary>
        <div className="mt-3 space-y-3 text-xs text-muted">
          <p className="text-[11px]">Cold plan strategy, constraints, and advanced goal options (if needed).</p>
          {/* Strategy panel, constraints, and other advanced UI can be placed here */}
        </div>
      </details>
    </div>
  );
}
