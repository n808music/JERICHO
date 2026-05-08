import React, { useState, useCallback } from 'react';
import { getCanonicalCycleContract, getCanonicalProposedBlocks } from '../../state/cycleSelectors.js';
import { buildGoalIntakeContract, getIntakeGateCode } from '../../domain/goal/GoalIntakeContract.ts';
import IntakeDraftSuggestion from './IntakeDraftSuggestion.jsx';

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
  proposedBlocks,
  suggestedBlocks,
  pendingPlanConfirmation = false,
  scheduleLifecycle = null,
  scheduleReviewBlocks = [],
  actions,
  emitAction,
  // Role A — optional; if provided, enables the "Get AI suggestions" button for intake.
  // Signature: (intakeContract, rawGoalText) => Promise<IntakeDraftPayload | null>
  // If omitted or if it returns null, the manual intake path remains intact.
  onRequestIntakeDraft = null,
}) {
  const [advancedOpen, setAdvancedOpen] = useState(false);

  // Role A: local state for intake draft assistant
  const [localAnsweredContext, setLocalAnsweredContext] = useState({});
  const [intakeDraftPayload, setIntakeDraftPayload] = useState(null);
  const [intakeDraftLoading, setIntakeDraftLoading] = useState(false);
  const [intakeDraftError, setIntakeDraftError] = useState(null);

  if (!activeCycleId || !activeCycle) {
    return <div className="text-xs text-muted">No active cycle.</div>;
  }

  // Extract goal and plan state
  const contract = getCanonicalCycleContract(activeCycle, goalExecutionContract);
  const goalId = contract?.goalId || null;
  const definiteGoal = activeCycle?.definiteGoal;
  const feasibility = goalId ? feasibilityByGoal?.[goalId] : null;
  const probability = goalId ? probabilityByGoal?.[goalId] : null;
  const autoAsanaPlan = activeCycle?.autoAsanaPlan || null;
  const normalizedScheduleLifecycle = String(scheduleLifecycle || activeCycle?.scheduleLifecycle || '')
    .trim()
    .toLowerCase();
  const appliedReviewBlocks = Array.isArray(scheduleReviewBlocks)
    ? scheduleReviewBlocks
    : Array.isArray(activeCycle?.scheduleReviewBlocks)
      ? activeCycle.scheduleReviewBlocks
      : [];
  const scheduleSource = getCanonicalProposedBlocks(proposedBlocks, suggestedBlocks);
  const proposedBlockCount = (scheduleSource || []).filter((s) => s && s.status === 'suggested').length;
  const hasAppliedReviewSchedule = normalizedScheduleLifecycle === 'applied_review' && appliedReviewBlocks.length > 0;
  const hasActiveSchedule = normalizedScheduleLifecycle === 'active_schedule';

  // Determine stage gating
  const hasCompiledGoal = definiteGoal?.outcome && definiteGoal?.deadlineDayKey;
  const isFeasible = feasibility?.status === 'FEASIBLE';
  const hasProposedSchedule =
    proposedBlockCount > 0 || autoAsanaPlan?.horizonBlocks?.length || hasAppliedReviewSchedule;

  // Current stage
  let currentStage = 1;
  if (hasCompiledGoal) currentStage = 2;
  if (hasCompiledGoal && isFeasible) currentStage = 3;
  if (hasProposedSchedule) currentStage = 4;

  // Role A — derive intake contract to detect blocking context questions.
  // buildGoalIntakeContract is deterministic; localAnsweredContext contains only
  // user-confirmed answers (never raw agent output).
  const rawGoalText =
    activeCycle?.goalDraftV2?.goalLabel ||
    activeCycle?.goalDraftV2?.goalText ||
    contract?.goalText ||
    contract?.goalLabel ||
    contract?.terminalOutcome?.text ||
    '';
  const intakeContract = hasCompiledGoal
    ? buildGoalIntakeContract({
        goalId: contract?.goalId || activeCycleId,
        rawGoalText,
        executionType: contract?.executionType || activeCycle?.goalDraftV2?.executionType || '',
        deadline: contract?.deadline?.dayKey || contract?.endDayKey || null,
        goalDraftV2: activeCycle?.goalDraftV2 || null,
        contract,
        answeredContext: localAnsweredContext,
      })
    : null;

  const intakeGateCode = intakeContract ? getIntakeGateCode(intakeContract) : null;
  const intakeBlocked =
    intakeContract !== null &&
    !intakeContract.readiness.isReadyForPlanning &&
    intakeContract.requiredContextQuestions.length > 0;

  // Role A handlers — no store dispatch; all state is component-local
  const handleRequestIntakeDraft = useCallback(async () => {
    if (!intakeContract || !onRequestIntakeDraft) return;
    setIntakeDraftLoading(true);
    setIntakeDraftError(null);
    setIntakeDraftPayload(null);
    try {
      const payload = await onRequestIntakeDraft(intakeContract, rawGoalText);
      setIntakeDraftPayload(payload); // may be null — fallback to manual shown
    } catch {
      setIntakeDraftPayload(null);
      setIntakeDraftError('AI suggestion unavailable. Please answer manually.');
    } finally {
      setIntakeDraftLoading(false);
    }
  }, [intakeContract, rawGoalText, onRequestIntakeDraft]);

  // Confirmed: user explicitly accepted one draft answer.
  // Updates localAnsweredContext → triggers buildGoalIntakeContract re-run via re-render.
  const handleIntakeDraftConfirm = useCallback((field, value) => {
    setLocalAnsweredContext((prev) => ({ ...prev, [field]: value }));
    setIntakeDraftPayload(null);
  }, []);

  const handleIntakeDraftDismiss = useCallback(() => {
    setIntakeDraftPayload(null);
    setIntakeDraftError(null);
  }, []);

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
        <div
          className={`rounded-xl border p-4 space-y-3 ${isFeasible ? 'border-green-600/40 bg-green-50/5' : 'border-amber-600/40 bg-amber-50/5'}`}
        >
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
                  <p className="text-sm text-jericho-text font-semibold">{feasibility.workableDaysRemaining || '—'}</p>
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
            <>
              {/* Role A — Intake context panel: shown when buildGoalIntakeContract detects
                  unresolved required questions. Advisory only; generate button still works
                  regardless. Answers confirmed here are passed via localAnsweredContext. */}
              {intakeBlocked ? (
                <div
                  data-testid="intake-context-panel"
                  className="rounded-lg border border-amber-400/30 bg-amber-50/10 px-3 py-2 space-y-2"
                >
                  <p className="text-[10px] uppercase tracking-[0.12em] text-amber-600 font-semibold">Context needed</p>
                  {intakeContract.requiredContextQuestions.map((q) => {
                    const alreadyAnswered = localAnsweredContext[q.field] !== undefined;
                    // Find a draft answer for this question, if one was returned
                    const draftAnswerForQ = intakeDraftPayload?.draftedAnswers?.find((a) => a.field === q.field);
                    return (
                      <div key={q.id} data-testid={`intake-question-${q.id}`} className="space-y-1">
                        <p className="text-[11px] text-jericho-text">{q.prompt}</p>
                        {alreadyAnswered ? (
                          <p className="text-[11px] text-green-600">✓ {String(localAnsweredContext[q.field])}</p>
                        ) : q.options?.length ? (
                          <div className="flex flex-wrap gap-1">
                            {q.options.map((opt) => (
                              <button
                                key={opt}
                                type="button"
                                className="text-[11px] rounded border border-line/60 px-2 py-0.5 text-muted hover:border-jericho-accent hover:text-jericho-accent"
                                onClick={() => handleIntakeDraftConfirm(q.field, opt)}
                              >
                                {opt}
                              </button>
                            ))}
                          </div>
                        ) : null}
                        {/* Role A: show AI draft suggestion below manual options */}
                        {!alreadyAnswered && draftAnswerForQ ? (
                          <IntakeDraftSuggestion
                            question={q}
                            draftAnswer={draftAnswerForQ}
                            onConfirm={handleIntakeDraftConfirm}
                            onDismiss={handleIntakeDraftDismiss}
                          />
                        ) : null}
                      </div>
                    );
                  })}
                  {/* Get AI suggestions button — opt-in, only shown when provider is available */}
                  {onRequestIntakeDraft && !intakeDraftLoading && !intakeDraftPayload ? (
                    <button
                      data-testid="intake-draft-request-btn"
                      type="button"
                      className="text-[11px] rounded-full border border-line/60 px-3 py-1 text-muted hover:border-jericho-accent hover:text-jericho-accent"
                      onClick={handleRequestIntakeDraft}
                    >
                      Get AI suggestions
                    </button>
                  ) : null}
                  {intakeDraftLoading ? (
                    <p data-testid="intake-draft-loading" className="text-[11px] text-muted">
                      Getting suggestions…
                    </p>
                  ) : null}
                  {intakeDraftError ? (
                    <p data-testid="intake-draft-error" className="text-[11px] text-amber-600">
                      {intakeDraftError}
                    </p>
                  ) : null}
                  {intakeGateCode && <p className="text-[10px] text-muted">Gate: {intakeGateCode}</p>}
                </div>
              ) : null}
              <button
                className="rounded-full border border-jericho-accent px-4 py-2 text-xs text-jericho-accent hover:bg-jericho-accent/10 font-semibold"
                onClick={() =>
                  emitAction(
                    'plan.generate',
                    {
                      cycleId: activeCycleId,
                      answeredContext: Object.keys(localAnsweredContext).length > 0 ? localAnsweredContext : undefined,
                    },
                    actions.generateScheduleForActiveCycle || actions.generatePlan
                  )
                }
                disabled={!actions.generateScheduleForActiveCycle && !actions.generatePlan}
              >
                Generate Cold Plan
              </button>
            </>
          ) : (
            <>
              <div className="rounded-md border border-line/40 bg-jericho-surface/80 px-3 py-2">
                <p className="uppercase tracking-[0.12em] text-[10px] text-muted mb-1">Proposed blocks</p>
                <p className="text-sm font-semibold text-jericho-text">
                  {proposedBlockCount || autoAsanaPlan?.horizonBlocks?.length || 0}
                </p>
              </div>
              {pendingPlanConfirmation ? (
                <p className="text-[11px] text-amber-600">
                  Schedule preview is awaiting confirmation. Use Stage 4 to commit it to the calendar.
                </p>
              ) : null}
              <p className="text-[11px] text-muted">
                Review proposed blocks on the Today view. Proceed to apply when ready.
              </p>
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
            <p className="text-xs uppercase tracking-[0.14em] text-muted">
              {hasActiveSchedule ? 'Stage 4: Active Schedule' : 'Stage 4: Apply Schedule'}
            </p>
          </div>
          <button
            className="rounded-full border border-jericho-accent px-4 py-2 text-xs text-jericho-accent hover:bg-jericho-accent/10 font-semibold"
            onClick={() => emitAction('plan.apply', { cycleId: activeCycleId }, actions.applyPlan)}
            disabled={!actions.applyPlan || !hasProposedSchedule || hasActiveSchedule}
          >
            Apply Schedule for Review
          </button>
          {hasAppliedReviewSchedule && !hasActiveSchedule ? (
            <button
              className="rounded-full border border-jericho-accent px-4 py-2 text-xs text-jericho-accent hover:bg-jericho-accent/10 font-semibold"
              onClick={() => emitAction('schedule.activate', { cycleId: activeCycleId }, actions.activateSchedule)}
              disabled={!actions.activateSchedule || !appliedReviewBlocks.length}
            >
              Activate Schedule
            </button>
          ) : null}
          <p className="text-[11px] text-muted">
            {hasActiveSchedule
              ? 'The schedule is live. Reschedule specific active blocks instead of regenerating.'
              : 'Apply moves proposed blocks onto the calendar for review. Activate makes them authoritative.'}
          </p>
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
