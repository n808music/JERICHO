/**
 * StructurePageConsolidated.jsx
 * 
 * Enforces 2-module doctrine for Structure tab:
 * - Module 1: Pre-admission (no activeCycleId) - Goal admission form only
 * - Module 2: Post-admission (activeCycleId exists) - Goal Banner (canonical, read-only) + advisory constraints + commit schedule
 * 
 * Key invariants:
 * - No duplicate goal surfaces (single Goal Banner)
 * - No suggestions/placement in Structure (belongs in Today)
 * - No probability/feasibility dashboards (belongs in Stability)
 * - No time-availability grids/lifestyle tuning (coarse advisory constraints only)
 * - Commit Schedule atomic with explicit success/error (no silent failures)
 */

import React, { useMemo, useState } from 'react';
import { useIdentityStore } from '../../state/identityStore';
import GoalAdmissionPage from '../../ui/goalAdmission/GoalAdmissionPage';
import { getActiveGoalOutcomes } from '../../state/cycleSelectors.js';
import { buildDraftScheduleItems } from '../../state/draftSchedule.js';
import { selectVisiblePreviewItems, getContractStartDayKey, getContractDeadlineDayKey } from '../../state/suggestionFilters.js';

const formatDate = (iso) => {
  if (!iso) return '';
  try {
    const normalized = new Date(iso);
    if (Number.isNaN(normalized.getTime())) return iso;
    return normalized.toLocaleDateString(undefined, {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
  } catch {
    return iso;
  }
};

function buildDefiniteGoalView(activeCycle) {
  if (!activeCycle) {
    return {
      title: 'Untitled',
      deadlineISO: '',
      startISO: '',
      outcome: '',
      cost: '',
      targetCount: null,
      targetUnit: '',
      definitionOfDone: '',
      daysPerWeek: null,
      minutesPerDay: null,
      hasGoalContract: false
    };
  }
  const contract = activeCycle.goalContract;
  const legacyGoal = activeCycle.definiteGoal || {};
  const title =
    (contract?.goalLabel || contract?.label || legacyGoal?.outcome || activeCycle?.direction || 'Untitled')
      .trim() || 'Untitled';
  const startISO = contract?.startDateISO || contract?.startISO || '';
  const deadlineISO =
    contract?.deadlineISO ||
    contract?.deadline?.iso ||
    contract?.deadline?.dayKey ||
    legacyGoal?.deadlineDayKey ||
    '';
  const outcome =
    contract?.terminalOutcome?.verificationCriteria ||
    contract?.terminalOutcome?.text ||
    legacyGoal?.outcome ||
    '';
  const cost =
    contract?.sacrifice?.whatIsGivenUp ||
    legacyGoal?.cost ||
    '';
  return {
    title,
    startISO,
    deadlineISO,
    outcome,
    cost,
    targetCount: contract?.target?.count ?? null,
    targetUnit: contract?.target?.unit || '',
    definitionOfDone: contract?.target?.definitionOfDone || '',
    daysPerWeek: contract?.capacity?.daysPerWeek ?? null,
    minutesPerDay: contract?.capacity?.minutesPerDay ?? null,
    hasGoalContract: Boolean(contract)
  };
}

export function StructurePageConsolidated() {
  const store = useIdentityStore();
  const {
    activeCycleId,
    cyclesById,
    aspirations,
    appTime,
    suggestedBlocks,
    lastPlanError,
    generateColdPlan,
    rebaseColdPlan,
    applyPlan,
    attemptGoalAdmission,
    archiveAndCloneCycle
  } = store;
  const activeCycle = activeCycleId ? cyclesById[activeCycleId] : null;
  const hasAdmittedGoal = Boolean(activeCycle?.goalContract);
  const timeZone = appTime?.timeZone || 'UTC';
  const routeForecast = useMemo(() => {
    const forecast = activeCycle?.coldPlan?.forecastByDayKey || {};
    return Object.keys(forecast || {})
      .map((dayKey) => ({
        dayKey,
        totalBlocks: forecast[dayKey].totalBlocks || 0,
        byDeliverable: forecast[dayKey].byDeliverable || {},
        summary: forecast[dayKey].summary || ''
      }))
      .filter((entry) => entry.totalBlocks > 0);
  }, [activeCycle?.coldPlan]);
  const contract = activeCycle?.goalContract || null;
  const rawDraftItems = useMemo(
    () =>
      buildDraftScheduleItems({
        suggestedBlocks: suggestedBlocks || [],
        routeSuggestions: routeForecast,
        contract,
        timeZone,
        contractStartDayKey: getContractStartDayKey(contract, timeZone),
        defaults: {
          todayKey: appTime?.activeDayKey || new Date().toISOString().split('T')[0],
          primaryDomain: contract?.primaryDomain || 'FOCUS',
          routeMinutes: planDraft?.routeMinutes || 30
        }
      }),
    [suggestedBlocks, routeForecast, contract, timeZone, appTime?.activeDayKey, planDraft?.routeMinutes]
  );
  const visiblePreviewItems = useMemo(
    () =>
      selectVisiblePreviewItems({
        cycle: activeCycle,
        draftItems: rawDraftItems,
        timeZone,
        deadlineDayKey: getContractDeadlineDayKey(contract)
      }),
    [activeCycle, rawDraftItems, timeZone, contract]
  );
  const previewCount = visiblePreviewItems.length;
  const definiteGoalView = buildDefiniteGoalView(activeCycle);
  const existingGoalOutcomes = useMemo(() => getActiveGoalOutcomes(cyclesById), [cyclesById]);

  // Local state for Commit Schedule UI
  const [commitError, setCommitError] = useState(null);
  const [commitLoading, setCommitLoading] = useState(false);
  const [expandPlanErrorDetails, setExpandPlanErrorDetails] = useState(false);

  // Local state for goal admission form
  const appNow = new Date();
  const defaultDeadlineKey = new Date(appNow.getTime() + 42 * 24 * 60 * 60 * 1000)
    .toISOString()
    .split('T')[0]; // 42 days from now

  const [admissionContract, setAdmissionContract] = useState({
    goalId: `goal_${Date.now()}`,
    cycleId: activeCycleId || '',
    planGenerationMechanismClass: 'GENERIC_DETERMINISTIC', // Phase 3: Required, locked to v1
    
    terminalOutcome: {
      text: '',
      hash: '',
      verificationCriteria: '',
      isConcrete: false,
    },
    
    deadline: {
      dayKey: defaultDeadlineKey,
      isHardDeadline: true,
    },
    
    sacrifice: {
      whatIsGivenUp: '',
      duration: '',
      quantifiedImpact: '',
      rationale: '',
      hash: '',
    },
    
    temporalBinding: {
      daysPerWeek: 5,
      specificDays: 'Mon, Tue, Wed, Thu, Fri',
      activationTime: '09:00',
      sessionDurationMinutes: 60,
      weeklyMinutes: 300,
      startDayKey: new Date().toISOString().split('T')[0],
    },
    
    causalChain: {
      steps: [],
      hash: '',
    },
    
    reinforcement: {
      dailyExposureEnabled: true,
      dailyMechanism: 'Dashboard banner',
      checkInFrequency: 'DAILY',
      triggerDescription: 'Every morning',
    },
    
    inscription: {
      contractHash: '',
      inscribedAtISO: appNow.toISOString(),
      acknowledgment: '',
      acknowledgmentHash: '',
      isCompromised: false,
    },
    
    admissionStatus: 'PENDING',
    admissionAttemptCount: 0,
    rejectionCodes: [],
    createdAtISO: appNow.toISOString(),
    isAspirational: false,
  });

  // ============================================================================
  // MODULE 1: Pre-admission (no admitted goal contract)
  // ============================================================================
  if (!hasAdmittedGoal) {
    return (
      <div className="space-y-4">
        {/* Goal Admission Form */}
        <GoalAdmissionPage
          contract={admissionContract}
          onContractChange={setAdmissionContract}
          onAdmit={async (result) => {
            // Attempt to persist admission via store action
            try {
              const outcome = await attemptGoalAdmission(admissionContract);
              if (outcome && outcome.status === 'ADMITTED') {
                // admission persisted; allow UI to flip to Module 2
                setCommitError(null);
              } else if (outcome && outcome.status === 'REJECTED') {
                // keep user informed
                window.alert('Admission rejected: ' + (outcome.rejectionCodes || []).join(', '));
              }
            } catch (err) {
              console.error('admission error', err);
              window.alert('Failed to admit goal. See console for details.');
            }
          }}
          onAspire={(notes) => {
            console.log('Aspirational notes:', notes);
          }}
          existingGoalOutcomes={existingGoalOutcomes}
          appTimeISO={appTime?.nowISO || new Date().toISOString()}
        />

        {/* Rejected Aspirations Display */}
        {aspirations && aspirations.length > 0 && (
          <div className="rounded-xl border border-red-600/40 bg-red-50/5 p-4 space-y-3">
            <div className="text-xs uppercase tracking-[0.14em] text-red-600/70">
              Aspirations (Not Yet Admitted)
            </div>
            {aspirations.map((aspiration) => (
              <div
                key={aspiration.id}
                className="rounded-lg border border-red-600/20 bg-red-600/5 p-3 space-y-2"
              >
                <div className="text-xs text-muted/80">
                  {aspiration.contractDraft?.goalText || 'Untitled aspiration'}
                </div>
                {aspiration.rejectionCodes && aspiration.rejectionCodes.length > 0 && (
                  <div className="text-xs text-red-600/70 space-y-1">
                    <div className="font-semibold">Rejection codes:</div>
                    <ul className="list-disc list-inside space-y-0.5">
                      {aspiration.rejectionCodes.map((code) => (
                        <li key={code}>{code}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // ============================================================================
  // MODULE 2: Post-admission (activeCycleId exists)
  // ============================================================================
  return (
    <div className="space-y-4">
      {/* Debug panel (temporary) */}
      <div className="rounded-md border border-line/60 bg-jericho-surface/80 p-3 text-xs">
        <div className="flex gap-4 items-center">
          <div><strong>activeCycleId:</strong> {String(activeCycleId || 'none')}</div>
          <div><strong>hasGoalContract:</strong> {String(Boolean(activeCycle?.goalContract))}</div>
          <div><strong>proposedBlocks:</strong> {(suggestedBlocks || []).length}</div>
          <div><strong>lastPlanError:</strong> {lastPlanError ? lastPlanError.code || lastPlanError.reason : 'none'}</div>
        </div>
      </div>
      {/* Goal Banner (Canonical, Read-Only) */}
      {activeCycle && (
        <div className="rounded-xl border border-line/60 bg-jericho-surface/90 p-4">
          <div className="text-xs uppercase tracking-[0.14em] text-muted mb-2">
            Definite Goal
          </div>
          <div className="space-y-2">
            <div className="text-sm font-semibold text-jericho-text">{definiteGoalView.title}</div>
            <div className="text-xs text-muted space-y-1">
              {definiteGoalView.startISO && definiteGoalView.deadlineISO ? (
                <div>
                  <span className="font-semibold">Plan window:</span>{' '}
                  {formatDate(definiteGoalView.startISO)} → {formatDate(definiteGoalView.deadlineISO)}
                </div>
              ) : definiteGoalView.deadlineISO ? (
                <div>
                  <span className="font-semibold">Deadline:</span> {formatDate(definiteGoalView.deadlineISO)}
                </div>
              ) : (
                <div>
                  <span className="font-semibold">Deadline:</span> N/A
                </div>
              )}
              {definiteGoalView.targetCount != null && definiteGoalView.targetUnit ? (
                <div>
                  <span className="font-semibold">Target:</span>{' '}
                  {definiteGoalView.targetCount} {definiteGoalView.targetUnit}
                </div>
              ) : null}
              {definiteGoalView.daysPerWeek && definiteGoalView.minutesPerDay ? (
                <div>
                  <span className="font-semibold">Capacity:</span>{' '}
                  {definiteGoalView.daysPerWeek} days/week · {definiteGoalView.minutesPerDay} min/day
                </div>
              ) : null}
              <div>
                <span className="font-semibold">Outcome:</span> {definiteGoalView.outcome || '—'}
              </div>
              <div>
                <span className="font-semibold">Cost:</span> {definiteGoalView.cost || '—'}
              </div>
            </div>
          </div>
          <div className="mt-3 text-xs text-muted/60 italic">
            Read-only. To change goal, archive this cycle and start a new one.
          </div>
        </div>
      )}

      {/* Deliverables (Collapsed by Default) */}
      <details className="rounded-xl border border-line/60 bg-jericho-surface/90 p-4">
        <summary className="cursor-pointer flex items-center justify-between hover:bg-jericho-surface/60 p-2 -m-2 rounded">
          <div className="flex items-center gap-2">
            <p className="text-xs uppercase tracking-[0.14em] text-muted">Deliverables</p>
          </div>
          <div className="text-xs text-muted/70 flex items-center gap-4">
            {activeCycle?.suggestedBlocks?.length > 0 && (
              <span>{activeCycle.suggestedBlocks.length} blocks proposed</span>
            )}
            {store?.deliverablesByCycleId?.[activeCycleId]?.autoGenerated && (
              <span className="text-success text-xs font-medium">Auto-generated</span>
            )}
          </div>
        </summary>
        <div className="mt-3 space-y-3 text-xs">
          {store?.deliverablesByCycleId?.[activeCycleId]?.autoGenerated && (
            <div className="rounded-lg border border-success/30 bg-success/5 p-3">
              <p className="text-success/80 font-medium mb-1">Auto-generated deliverables</p>
              <p className="text-muted/70 text-xs mb-2">
                {store.deliverablesByCycleId[activeCycleId].autoStrategy?.rationale}
              </p>
              <p className="text-muted/70 text-xs">Edit optional · derivable from goal commitment</p>
            </div>
          )}
          <div>
            <div className="text-muted/80 font-semibold mb-2">
              Deliverables ({store?.deliverablesByCycleId?.[activeCycleId]?.deliverables?.length || 0})
            </div>
            <div className="space-y-2">
              {(store?.deliverablesByCycleId?.[activeCycleId]?.deliverables || []).length > 0 ? (
                (store.deliverablesByCycleId[activeCycleId].deliverables).map((deliv, idx) => (
                  <div key={deliv.id || idx} className="flex justify-between items-start bg-jericho-surface/60 rounded p-2">
                    <div className="flex-1">
                      <div className="text-xs font-medium text-jericho-text">{deliv.title}</div>
                      <div className="text-xs text-muted/70">{deliv.requiredBlocks} blocks</div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-xs text-muted/70 italic">No deliverables yet · click edit to add</div>
              )}
            </div>
          </div>
        </div>
      </details>

      {/* Advisory Constraints (Max/Day, Max/Week, Preferred Days, Blackout) */}
      <details className="rounded-xl border border-line/60 bg-jericho-surface/90 p-4">
        <summary className="cursor-pointer flex items-center gap-2">
          <p className="text-xs uppercase tracking-[0.14em] text-muted">Advisory Constraints</p>
        </summary>
        <div className="mt-3 space-y-3 text-xs">
          <div>
            <label className="block text-muted/80 mb-1">Max blocks per day:</label>
            <input
              type="number"
              defaultValue={5}
              min={1}
              max={20}
              className="w-full rounded border border-line/40 bg-jericho-surface px-2 py-1 text-xs text-jericho-text"
            />
          </div>
          <div>
            <label className="block text-muted/80 mb-1">Max blocks per week:</label>
            <input
              type="number"
              defaultValue={20}
              min={1}
              max={100}
              className="w-full rounded border border-line/40 bg-jericho-surface px-2 py-1 text-xs text-jericho-text"
            />
          </div>
          <div>
            <label className="block text-muted/80 mb-1">Preferred working days:</label>
            <div className="flex gap-2 flex-wrap">
              {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day) => (
                <label key={day} className="flex items-center gap-1">
                  <input type="checkbox" defaultChecked={!['Sat', 'Sun'].includes(day)} className="w-3 h-3" />
                  <span>{day}</span>
                </label>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-muted/80 mb-1">Blackout days (comma-separated dayKeys):</label>
            <input
              type="text"
              placeholder="e.g. 2026-01-11, 2026-01-25"
              className="w-full rounded border border-line/40 bg-jericho-surface px-2 py-1 text-xs text-jericho-text"
            />
          </div>
        </div>
      </details>

      {/* Commit Schedule (Atomic: Success or Explicit Error) */}
      <div className="rounded-xl border border-line/60 bg-jericho-surface/90 p-4 space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-xs uppercase tracking-[0.14em] text-muted">Commit Schedule</p>
          <div className="flex gap-2">
            <button
              type="button"
              className="rounded-full border border-line/60 px-2 py-0.5 text-[11px] text-muted"
              onClick={() => {
                generateColdPlan?.();
              }}
            >
              Regenerate Route
            </button>
            <button
              type="button"
              className="rounded-full border border-line/60 px-2 py-0.5 text-[11px] text-muted"
              onClick={() => {
                rebaseColdPlan?.();
              }}
            >
              Rebase From Today
            </button>
          </div>
        </div>

        {/* Error Banner (Explicit Failure) */}
        {(commitError || lastPlanError) && (
          <div className="rounded-lg border border-red-600/40 bg-red-50/5 p-3 space-y-2">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs text-red-600/80 font-semibold">
                  {commitError ? 'Commit Failed' : 'Plan Generation Issue'}
                </div>
                <div className="text-xs text-red-600/70 mt-1">
                  {commitError ? commitError : (lastPlanError?.code || 'Unknown error')}
                </div>
              </div>
              {lastPlanError?.reasons && lastPlanError.reasons.length > 0 && (
                <button
                  type="button"
                  onClick={() => setExpandPlanErrorDetails(!expandPlanErrorDetails)}
                  className="text-[11px] text-red-600/60 hover:text-red-600/80 underline ml-2 flex-shrink-0"
                >
                  {expandPlanErrorDetails ? 'Hide' : 'Details'}
                </button>
              )}
            </div>

            {/* Expanded details section */}
            {expandPlanErrorDetails && lastPlanError?.reasons && (
              <div className="mt-2 pl-3 border-l-2 border-red-600/30 space-y-1">
                <div className="text-[11px] text-red-600/70 font-semibold">Why plan generation failed:</div>
                {lastPlanError.reasons.map((reason, idx) => (
                  <div key={idx} className="text-[11px] text-red-600/70">
                    • {reason}
                  </div>
                ))}
                
                {lastPlanError.details && (
                  <div className="mt-2 pt-2 border-t border-red-600/20 text-[11px] text-red-600/60 space-y-1">
                    <div className="font-semibold">Context:</div>
                    {lastPlanError.details.deliverableCount !== undefined && (
                      <div>Deliverables defined: {lastPlanError.details.deliverableCount}</div>
                    )}
                    {lastPlanError.details.totalRequired !== undefined && (
                      <div>Total blocks required: {lastPlanError.details.totalRequired}</div>
                    )}
                    {lastPlanError.details.workableDaysCount !== undefined && (
                      <div>Workable days available: {lastPlanError.details.workableDaysCount}</div>
                    )}
                    {lastPlanError.details.startDayKey && (
                      <div>Start date: {lastPlanError.details.startDayKey}</div>
                    )}
                    {lastPlanError.details.deadlineKey && (
                      <div>Deadline: {lastPlanError.details.deadlineKey}</div>
                    )}
                    {lastPlanError.details.maxBlocksPerDay !== undefined && (
                      <div>Max blocks/day: {lastPlanError.details.maxBlocksPerDay}</div>
                    )}
                    {lastPlanError.details.maxBlocksPerWeek !== undefined && (
                      <div>Max blocks/week: {lastPlanError.details.maxBlocksPerWeek}</div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* UX Recovery: Archive + Clone button for DEADLINE_INVALID */}
            {lastPlanError?.code === 'PLAN_PRECONDITIONS_FAILED' &&
              lastPlanError?.reasons?.some((r) => r.includes('DEADLINE_INVALID')) && (
                <div className="mt-3 pt-3 border-t border-red-600/30">
                  <button
                    type="button"
                    onClick={() => {
                      archiveAndCloneCycle?.(activeCycleId);
                    }}
                    className="text-[11px] bg-red-600/10 hover:bg-red-600/20 text-red-600 px-2 py-1 rounded border border-red-600/40 transition"
                  >
                    Archive + Clone (Edit Goal)
                  </button>
                  <div className="text-[11px] text-red-600/60 mt-2">
                    The current goal will be archived, and you'll get a new editable draft to fix the deadline.
                  </div>
                </div>
              )}
          </div>
        )}

        {/* Status / guidance */}
        {!commitError && !lastPlanError && !commitLoading && (
          <div className="text-xs text-muted/70">{previewCount} proposed block{previewCount === 1 ? '' : 's'} available to commit.</div>
        )}

        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              setCommitLoading(true);
              setCommitError(null);
              store.commitPreviewItems({ cycleId: activeCycleId, items: visiblePreviewItems });
              setCommitLoading(false);
              if (store.lastPlanError) {
                setCommitError(store.lastPlanError.reason || store.lastPlanError.code);
              } else {
                window.alert(`Committed ${previewCount} block${previewCount === 1 ? '' : 's'} to calendar.`);
              }
            }}
            disabled={
              commitLoading ||
              isCycleReadOnly ||
              visiblePreviewItems.length === 0 ||
              suppressDrafts
            }
            className="rounded-full border border-line/60 px-3 py-1.5 text-xs text-muted hover:text-jericho-accent disabled:opacity-50"
          >
            {commitLoading ? 'Committing...' : 'Apply Schedule to Calendar'}
          </button>

          <button
            onClick={() => {
              // quick inspect: open Today view
              if (window.confirm('Open Today view?')) {
                // best-effort: trigger location hash change used by app routing if present
                try { window.location.hash = '#/today'; } catch (e) {}
              }
            }}
            className="rounded-full border border-line/40 px-3 py-1.5 text-xs text-muted"
          >
            Open Today
          </button>
        </div>
      </div>

      {/* Cycle Management (Collapsed) */}
      <details className="rounded-xl border border-line/60 bg-jericho-surface/90 p-4">
        <summary className="cursor-pointer flex items-center gap-2">
          <p className="text-xs uppercase tracking-[0.14em] text-muted">Cycle Management</p>
        </summary>
        <div className="mt-3 space-y-3">
          <div className="flex gap-2">
            <button
              onClick={() => {
                if (window.confirm('Start a new cycle?')) {
                  store.startNewCycle?.({
                    goalText: activeCycle?.goalContract?.goalText || 'New goal',
                    deadlineDayKey: activeCycle?.goalContract?.endDayKey
                  });
                }
              }}
              className="rounded-full border border-line/60 px-3 py-1 text-xs text-muted hover:text-jericho-accent"
            >
              New Cycle
            </button>
            <button
              onClick={() => {
                if (window.confirm('Archive the active cycle and move it to review mode?')) {
                  store.endCycle?.(activeCycleId);
                }
              }}
              className="rounded-full border border-amber-600 px-3 py-1 text-xs text-amber-600 hover:bg-amber-600/10"
            >
              Archive Cycle
            </button>
            <button
              onClick={() => {
                if (window.confirm('Delete the active cycle and clear the calendar? This cannot be undone.')) {
                  store.deleteCycle?.(activeCycleId);
                }
              }}
              className="rounded-full border border-red-600 px-3 py-1 text-xs text-red-600 hover:bg-red-600/10"
            >
              Delete Cycle
            </button>
          </div>
        </div>
      </details>
    </div>
  );
}
