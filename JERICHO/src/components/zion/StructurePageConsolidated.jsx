/**
 * StructurePageConsolidated.jsx
 *
 * Enforces 2-module doctrine for Structure tab:
 * - Module 1: Pre-admission (no activeCycleId) - Goal admission form only
 * - Module 2: Post-admission (activeCycleId exists) - Goal Banner + advisory constraints + read-only schedule status
 *
 * Key invariants:
 * - No duplicate goal surfaces (single Goal Banner)
 * - No suggestions/placement in Structure (belongs in Today)
 * - No probability/feasibility dashboards (belongs in Stability)
 * - No time-availability grids/lifestyle tuning (coarse advisory constraints only)
 * - Schedule generation/apply controls are Today-only
 */

import React, { useEffect, useMemo, useState } from 'react';
import { useIdentityStore } from '../../state/identityStore';
import {
  getActiveGoalOutcomes,
  getCanonicalLongHorizonPlanMetadata,
  getCanonicalProposedBlocks,
} from '../../state/cycleSelectors.js';
import GoalAdmissionPage from '../../ui/goalAdmission/GoalAdmissionPage.tsx';
import MasterPlanIntake from '../../ui/masterPlan/MasterPlanIntake.jsx';
import { computeContractHash } from '../../domain/goal/GoalAdmissionPolicy.ts';
import { requiresCoreMissionContract } from '../../domain/goal/planningTierClassifier.ts';
import { buildGoalIntakeContract } from '../../domain/goal/GoalIntakeContract.ts';
import { GOAL_REJECTION_MESSAGES } from '../../domain/goal/GoalRejectionCode.ts';
import {
  deriveStructureSchedulingSemanticSummary,
  getStructureSchedulingLabels,
} from '../../state/structureSchedulingSemantics.js';
import { materializeBlocksFromEvents } from '../../state/engine/todayAuthority.ts';
import { isCanonicalBlankState } from '../../state/identityCompute.js';
import { describeBlockMeaning } from '../zion/blockMeaning.js';
import CycleTransitionModal from './CycleTransitionModal.jsx';
import ExportFullScheduleButton from './ExportFullScheduleButton.jsx';
import HorizonResolutionPanel from './HorizonResolutionPanel.jsx';
import WorkWindowsEditor from './WorkWindowsEditor.tsx';
import {
  formatBlockRef,
  formatArtifactLabel,
  formatConsumedArtifacts,
  formatGateSummary,
} from './formalChartFormatters.js';

const EMPTY_WORK_WINDOWS = {
  mon: [],
  tue: [],
  wed: [],
  thu: [],
  fri: [],
  sat: [],
  sun: [],
};

const uniqueStrings = (values = []) =>
  Array.from(new Set((Array.isArray(values) ? values : []).map((value) => String(value || '').trim()).filter(Boolean)));

const normalizeActionType = (action = null) => {
  const rawType = String(action?.actionType || action?.type || '')
    .trim()
    .toLowerCase();
  if (rawType === 'preparation' || rawType === 'prep' || rawType === 'readiness') {
    return 'Preparation';
  }
  if (rawType === 'execution' || rawType === 'execute') {
    return 'Execution';
  }
  return 'Unknown';
};

const formatOwnerLabel = (owner) => {
  const normalized = String(owner || '').trim();
  if (!normalized) {
    return '—';
  }
  return normalized
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (match) => match.toUpperCase());
};

const normalizeCanonicalBlockType = (block = null, fallbackActionType = 'Unknown') => {
  const rawType = String(block?.blockType || block?.type || '')
    .trim()
    .toLowerCase();
  if (rawType === 'action' || rawType === 'execution') return 'Execution';
  if (rawType === 'readiness' || rawType === 'terminal-readiness' || rawType === 'milestone') return 'Readiness';
  if (rawType === 'review') return 'Review';
  if (rawType === 'gate') return 'Gate';
  if (rawType === 'audit' || rawType === 'monitoring') return 'Monitoring';
  if (rawType === 'validation') return 'Validation';
  return fallbackActionType || 'Unknown';
};

const humanizeDependencyRef = (dependencyRef) => {
  const normalized = String(dependencyRef || '').trim();
  if (!normalized) {
    return '';
  }
  if (normalized.startsWith('phase:')) {
    return `phase ${normalized.slice(6).toUpperCase()} prerequisite`;
  }
  if (normalized.startsWith('lane:')) {
    return `lane prerequisite ${normalized.slice(5)}`;
  }
  if (normalized.startsWith('terminal-review:')) {
    return 'terminal review prerequisite';
  }
  return normalized;
};

const deriveFormalActionLineage = (block = null, actionMeta = null, resolvedDeliverable = null) => {
  if (actionMeta?.title) {
    return actionMeta.title;
  }
  const derivationReason = String(block?.derivationReason || '').trim();
  if (derivationReason) {
    return derivationReason;
  }
  const unlockTarget = Array.isArray(block?.unlocks) ? String(block.unlocks[0] || '').trim() : '';
  const dependencyTarget = Array.isArray(block?.dependsOn) ? String(block.dependsOn[0] || '').trim() : '';
  const lineageParts = [
    resolvedDeliverable?.title ? `Advances ${resolvedDeliverable.title}` : '',
    unlockTarget ? `unlocks ${humanizeDependencyRef(unlockTarget)}` : '',
    block?.successCriterionServed ? `serves ${block.successCriterionServed}` : '',
    block?.producesArtifact ? `produces ${block.producesArtifact}` : '',
    dependencyTarget ? `after ${humanizeDependencyRef(dependencyTarget)}` : '',
  ].filter(Boolean);
  return lineageParts.join(' · ');
};

const formatDate = (iso, timeZone) => {
  if (!iso) {
    return '';
  }
  try {
    const text = String(iso).trim();
    const dayKeyMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
    const normalized = dayKeyMatch
      ? new Date(Number(dayKeyMatch[1]), Number(dayKeyMatch[2]) - 1, Number(dayKeyMatch[3]), 12, 0, 0)
      : new Date(text);
    if (Number.isNaN(normalized.getTime())) {
      return iso;
    }
    return normalized.toLocaleDateString(undefined, {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      timeZone: timeZone || undefined,
    });
  } catch {
    return iso;
  }
};

const formatDateTime = (iso, timeZone) => {
  if (!iso) {
    return '';
  }
  try {
    const text = String(iso).trim();
    const dayKeyMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
    const normalized = dayKeyMatch
      ? new Date(Number(dayKeyMatch[1]), Number(dayKeyMatch[2]) - 1, Number(dayKeyMatch[3]), 12, 0, 0)
      : new Date(text);
    if (Number.isNaN(normalized.getTime())) {
      return iso;
    }
    return normalized.toLocaleString(undefined, {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: timeZone || undefined,
    });
  } catch {
    return iso;
  }
};

const formatPhaseMode = (value) => {
  if (value === 'preparation') return 'Preparation';
  if (value === 'execution') return 'Execution';
  if (value === 'mixed') return 'Mixed';
  return 'Unknown';
};

function PersistenceRecoveryNotice({ planRecovery }) {
  const reasonCodes = Array.isArray(planRecovery?.persistenceFailure?.reasonCodes)
    ? planRecovery.persistenceFailure.reasonCodes
    : [];
  const orphanedCycleId = planRecovery?.persistenceFailure?.orphanedCycleId || null;

  return (
    <div className="rounded-lg border border-amber-500/40 bg-amber-50 px-4 py-3 space-y-2">
      <p className="text-sm font-semibold text-amber-950">Profile found, but active plan is missing</p>
      <p className="text-xs text-amber-900">
        Jericho preserved profile residue but quarantined invalid active execution state because the owning
        goal or master plan could not be restored safely.
      </p>
      {orphanedCycleId ? (
        <p className="text-xs text-amber-900">Quarantined cycle: {orphanedCycleId}</p>
      ) : null}
      {reasonCodes.length > 0 ? (
        <p className="text-xs text-amber-800">
          Recovery reasons:{' '}
          {reasonCodes
            .map((code) =>
              String(code || '')
                .replace(/^ACTIVE_/i, '')
                .replace(/_/g, ' ')
                .toLowerCase()
            )
            .join(' · ')}
        </p>
      ) : null}
    </div>
  );
}

const formatTemporalCertainty = (value) => {
  if (value === 'firm') return 'Firm';
  if (value === 'provisional') return 'Provisional';
  return 'Unknown';
};

const formatLongTermQualityState = (value) => {
  if (value === 'trusted') return 'Trusted';
  if (value === 'provisional') return 'Provisional';
  if (value === 'degraded') return 'Degraded';
  if (value === 'withheld') return 'Withheld';
  return 'Not applicable';
};

function MissionContextBanner({ contract }) {
  if (!contract) return null;
  return (
    <div className="rounded-xl border border-line/60 bg-jericho-surface/90 p-4 space-y-2">
      <div className="text-xs uppercase tracking-[0.14em] text-muted">Core Mission</div>
      <div className="text-sm font-semibold text-jericho-text leading-snug">{contract.durableObjective}</div>
      <div className="flex items-center gap-3 text-xs text-muted">
        <span>
          Phase: <span className="text-jericho-text font-medium">{contract.currentPhase}</span>
        </span>
        {contract.horizonYears ? (
          <span>
            Horizon: <span className="text-jericho-text font-medium">{contract.horizonYears}yr</span>
          </span>
        ) : null}
      </div>
    </div>
  );
}

function MasterPlanStructureSection({
  hasActiveMasterPlan,
  masterPlanIntakeStatus,
  activeMasterPlan = null,
  activeCycle = null,
  scheduleLifecycle = 'no_schedule',
  onClearGoal = null,
}) {
  const laneCount = Array.isArray(activeMasterPlan?.laneIds) ? activeMasterPlan.laneIds.length : 0;
  return (
    <div className="rounded-xl border border-line/60 bg-jericho-surface/90 p-4 space-y-3">
      <div>
        <div className="text-xs uppercase tracking-[0.14em] text-muted mb-2">Goal</div>
        <div className="text-sm font-semibold text-jericho-text">Structure establishes the goal and Master Plan</div>
        <div className="text-xs text-muted mt-1">
          Define lanes, anchors, milestones, and convergence logic here. The Master Plan tab visualizes the result read-only.
        </div>
      </div>

      {hasActiveMasterPlan && masterPlanIntakeStatus !== 'in-progress' ? (
        <>
          <div className="rounded-lg border border-line/40 bg-jericho-surface/80 p-3 text-xs text-muted">
            Goal established. Review lanes, anchors, and milestones in Master Plan.
          </div>
          <div className="rounded-lg border border-line/40 bg-jericho-surface/80 p-3 space-y-3">
            <div className="space-y-2">
              <div>
                <div className="text-[11px] uppercase tracking-[0.12em] text-muted">Core Mission</div>
                <div className="text-sm font-semibold text-jericho-text">
                  {activeMasterPlan?.coreMission || activeMasterPlan?.title || 'Active goal'}
                </div>
              </div>
              <div>
                <div className="text-[11px] uppercase tracking-[0.12em] text-muted">Outcome Target</div>
                <div className="text-xs text-jericho-text">
                  {activeMasterPlan?.outcomeTarget || activeMasterPlan?.northStarOutcome || 'Outcome target pending'}
                </div>
              </div>
              <div>
                <div className="text-[11px] uppercase tracking-[0.12em] text-muted">Success Standard</div>
                <div className="text-xs text-jericho-text">
                  {activeMasterPlan?.successStandard || 'Success standard pending'}
                </div>
              </div>
              <div className="text-xs text-muted">
                {laneCount} lane{laneCount === 1 ? '' : 's'} · schedule lifecycle:{' '}
                <span className="font-medium text-jericho-text">{formatPolicyState(scheduleLifecycle || 'no_schedule')}</span>
              </div>
              <div className="text-xs text-muted">
                {activeCycle?.id
                  ? `Active Operating Cycle: ${activeCycle.id}`
                  : 'No active Operating Cycle yet. Start Operating Cycle to create one.'}
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <ExportFullScheduleButton />
              <button
                type="button"
                onClick={onClearGoal}
                className="rounded-full border border-red-600 px-3 py-1 text-xs text-red-600 hover:bg-red-600/10"
              >
                Clear Goal
              </button>
            </div>
          </div>
        </>
      ) : (
        <MasterPlanIntake />
      )}
    </div>
  );
}

function CycleManagementSection({
  activeCycleId = null,
  hasActiveMasterPlan = false,
  activeCycle = null,
  scheduleLifecycle = 'no_schedule',
  onCompleteReassessment = null,
  onStartNewCycleRequest = null,
  onArchiveCycle = null,
  onResetCycle = null,
  onDeleteCycle = null,
}) {
  const hasActiveCycle = Boolean(activeCycleId && activeCycle);
  const reassessmentStatus = String(activeCycle?.reassessmentStatus || '').trim().toLowerCase();
  return (
    <details className="rounded-xl border border-line/60 bg-jericho-surface/90 p-4" open={hasActiveMasterPlan && !hasActiveCycle}>
      <summary className="cursor-pointer flex items-center gap-2">
        <p className="text-xs uppercase tracking-[0.14em] text-muted">Operating Cycle</p>
      </summary>
      <div className="mt-3 space-y-3">
        {!hasActiveCycle ? (
          <p className="text-xs text-muted">
            No active Operating Cycle yet. Start one here, then generate the first Sprint from Today.
          </p>
        ) : (
          <div className="space-y-1 text-xs text-muted">
            <p>
              Schedule:{' '}
              <span className="font-medium text-jericho-text">{formatPolicyState(scheduleLifecycle || 'no_schedule')}</span>
            </p>
            {reassessmentStatus === 'required' ? (
              <p className="text-amber-700">
                Current-state reassessment required before schedule generation.
              </p>
            ) : (
              <p>Current-state reassessment complete.</p>
            )}
          </div>
        )}
        <div className="flex flex-wrap gap-2">
          <button
            onClick={onStartNewCycleRequest}
            className="rounded-full border border-line/60 px-3 py-1 text-xs text-muted hover:text-jericho-accent"
          >
            {hasActiveCycle ? 'Replace Active Operating Cycle' : 'Start Operating Cycle'}
          </button>
          <button
            onClick={onCompleteReassessment}
            disabled={!hasActiveCycle || reassessmentStatus === 'complete'}
            className="rounded-full border border-line/60 px-3 py-1 text-xs text-muted hover:text-jericho-accent disabled:opacity-50"
          >
            Reassess Current State
          </button>
          <button
            onClick={onArchiveCycle}
            disabled={!hasActiveCycle}
            className={`rounded-full border px-3 py-1 text-xs disabled:opacity-50 ${hasActiveCycle ? 'border-amber-600 text-amber-600 hover:bg-amber-600/10' : 'border-line/60 text-muted'}`}
          >
            Archive Operating Cycle
          </button>
          <button
            onClick={onResetCycle}
            disabled={!hasActiveCycle}
            className="rounded-full border border-line/60 px-3 py-1 text-xs text-muted hover:text-jericho-accent disabled:opacity-50"
          >
            Reset Operating Cycle
          </button>
          <button
            onClick={onDeleteCycle}
            disabled={!hasActiveCycle}
            className="rounded-full border border-red-600 px-3 py-1 text-xs text-red-600 hover:bg-red-600/10 disabled:opacity-50"
          >
            Delete Operating Cycle
          </button>
        </div>
      </div>
    </details>
  );
}

function toDayKey(value) {
  const text = String(value || '').trim();
  if (!text) {
    return '';
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    return text;
  }
  return text.slice(0, 10);
}

function formatPolicyState(value) {
  return String(value || '')
    .trim()
    .replace(/_/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function formatFeasibilityState(value) {
  if (value === 'feasible') return 'Feasible';
  if (value === 'constrained') return 'Constrained';
  if (value === 'degraded') return 'Degraded';
  if (value === 'withheld') return 'Withheld';
  return 'Unknown';
}

function formatPlanQualityReason(code) {
  const key = String(code || '').trim();
  if (key === 'LONG_HORIZON_TEMPORAL_COMPRESSION') {
    return 'Long-horizon issue: scheduled work compresses into the opening part of the contract.';
  }
  if (key === 'LONG_HORIZON_UNJUSTIFIED_TAIL_GAP') {
    return 'Long-horizon issue: scheduled work leaves a large unexplained tail before the contract end.';
  }
  if (key === 'LONG_HORIZON_SPARSE_CADENCE') {
    return 'Long-horizon issue: planned work is too thin for this commercial launch corridor.';
  }
  if (key === 'LONG_HORIZON_WORK_GAPS') {
    return 'Long-horizon issue: scheduled work leaves repeated gaps between execution blocks.';
  }
  if (key === 'COMMERCIAL_BLOCK_SPECIFICITY_WEAK') {
    return 'Commercial launch issue: scheduled blocks repeat family shells instead of concrete operational sub-work.';
  }
  if (key === 'COMMERCIAL_WORK_WINDOW_UNDERUSED') {
    return 'Commercial launch issue: active weeks use too few workdays for this launch corridor.';
  }
  if (key === 'TERMINAL_OBJECT_DRIFT') {
    return 'Semantic coverage issue: the plan does not preserve the sellable product object.';
  }
  if (key === 'COMMERCIAL_READINESS_MISSING') {
    return 'Semantic coverage issue: commercial readiness is missing.';
  }
  if (key === 'PURCHASE_PATH_MISSING') {
    return 'Semantic coverage issue: purchase path or checkout coverage is missing.';
  }
  if (key === 'FIRST_SALES_CORRIDOR_MISSING') {
    return 'Semantic coverage issue: first-sales execution corridor is missing.';
  }
  if (key === 'BRAND_LAUNCH_SUBSTITUTED_FOR_PRODUCT_LAUNCH') {
    return 'Semantic coverage issue: brand-launch support is substituting for product-launch completion.';
  }
  if (key === 'TERMINAL_EVENT_EVIDENCE_MISSING') {
    return 'Semantic coverage issue: terminal sales evidence review or decision coverage is missing.';
  }
  return key.replace(/_/g, ' ').toLowerCase();
}

const PLAN_QUALITY_REASON_PRIORITY = {
  LONG_HORIZON_UNJUSTIFIED_TAIL_GAP: 0,
  LONG_HORIZON_TEMPORAL_COMPRESSION: 1,
  LONG_HORIZON_SPARSE_CADENCE: 2,
  LONG_HORIZON_WORK_GAPS: 3,
  COMMERCIAL_BLOCK_SPECIFICITY_WEAK: 4,
  COMMERCIAL_WORK_WINDOW_UNDERUSED: 5,
  BRAND_LAUNCH_SUBSTITUTED_FOR_PRODUCT_LAUNCH: 6,
  TERMINAL_OBJECT_DRIFT: 7,
  PURCHASE_PATH_MISSING: 8,
  COMMERCIAL_READINESS_MISSING: 9,
  FIRST_SALES_CORRIDOR_MISSING: 10,
  TERMINAL_EVENT_EVIDENCE_MISSING: 11,
};

function sortPlanQualityCodesForDisplay(codes) {
  return [...(codes || [])].sort((a, b) => {
    const aPriority = PLAN_QUALITY_REASON_PRIORITY[a] ?? 100;
    const bPriority = PLAN_QUALITY_REASON_PRIORITY[b] ?? 100;
    if (aPriority !== bPriority) {
      return aPriority - bPriority;
    }
    return String(a).localeCompare(String(b));
  });
}

function formatPlanQualityTemporalDiagnostic(planQualityGate) {
  const temporal = planQualityGate?.meta?.temporalDistribution || null;
  const codes = uniqueStrings([...(planQualityGate?.failureCodes || []), ...(planQualityGate?.reasonCodes || [])]);
  if (!temporal || codes.length === 0) {
    return null;
  }
  const last = formatDate(temporal.lastScheduledDayKey);
  const end = formatDate(temporal.contractEndDayKey);
  if (codes.includes('LONG_HORIZON_UNJUSTIFIED_TAIL_GAP')) {
    return `Long-horizon issue: work ends on ${last}, leaving an unjustified tail before ${end}.`;
  }
  if (codes.includes('LONG_HORIZON_TEMPORAL_COMPRESSION')) {
    return `Long-horizon issue: work is compressed too early; last scheduled work is ${last} before the ${end} contract end.`;
  }
  return null;
}

function synchronizeAdmissionContract(contract) {
  if (!contract || typeof contract !== 'object') {
    return contract;
  }
  const nextContract = { ...contract };
  if (!nextContract.inscription) {
    return nextContract;
  }
  const contractHash = computeContractHash(nextContract);
  nextContract.inscription = {
    ...nextContract.inscription,
    contractHash,
    acknowledgmentHash: nextContract.inscription.acknowledgmentHash || contractHash.slice(0, 16),
  };
  return nextContract;
}

function deriveAdmissionIntakeContract(admissionDraft, pendingOnboardingInputs = null) {
  return buildGoalIntakeContract({
    goalId: admissionDraft?.goalId || pendingOnboardingInputs?.goalContract?.goalId || null,
    rawGoalText:
      admissionDraft?.terminalOutcome?.text ||
      admissionDraft?.goalLabel ||
      admissionDraft?.goalText ||
      pendingOnboardingInputs?.goalText ||
      pendingOnboardingInputs?.goalDraftV2?.goalText ||
      pendingOnboardingInputs?.goalDraftV2?.goalLabel ||
      '',
    verificationCriteria: admissionDraft?.terminalOutcome?.verificationCriteria || '',
    executionType: admissionDraft?.executionType || pendingOnboardingInputs?.executionType || null,
    deadline: admissionDraft?.deadline?.dayKey || admissionDraft?.deadlineISO || null,
    goalDraftV2: pendingOnboardingInputs?.goalDraftV2 || admissionDraft?.goalDraftV2 || null,
    contract: admissionDraft,
  });
}

export function buildAdmissionDraftFromPendingInputs(pendingOnboardingInputs = null) {
  const onboarding = pendingOnboardingInputs || {};
  const onboardingContract = onboarding?.goalContract ? { ...onboarding.goalContract } : {};
  const goalLabel =
    onboarding?.goalDraftV2?.goalLabel ||
    onboarding?.goalDraftV2?.goalText ||
    onboarding?.goalText ||
    onboarding?.direction ||
    onboardingContract?.goalLabel ||
    '';
  const definitionOfDone = onboardingContract?.target?.definitionOfDone || onboarding?.successDefinition || '';
  const startDayKey = toDayKey(onboardingContract?.startDateISO || onboardingContract?.startDayKey);
  const deadlineDayKey = toDayKey(
    onboardingContract?.deadline?.dayKey || onboardingContract?.deadlineISO || onboardingContract?.endDayKey
  );

  const draft = {
    ...onboardingContract,
    executionType: onboardingContract?.executionType || onboarding?.executionType || null,
    planGenerationMechanismClass: onboardingContract?.planGenerationMechanismClass || 'LLM_TYPED',
    goalDraftV2: onboarding?.goalDraftV2 || null,
    goalLabel,
    goalText: goalLabel,
    terminalOutcome: {
      ...(onboardingContract?.terminalOutcome || {}),
      text: onboardingContract?.terminalOutcome?.text || goalLabel,
      verificationCriteria: onboardingContract?.terminalOutcome?.verificationCriteria || definitionOfDone,
      isConcrete: onboardingContract?.terminalOutcome?.isConcrete ?? true,
    },
    deadline: {
      ...(onboardingContract?.deadline || {}),
      dayKey: deadlineDayKey,
      isHardDeadline: onboardingContract?.deadline?.isHardDeadline ?? true,
    },
    target: onboardingContract?.target || null,
    capacity: onboardingContract?.capacity || null,
    startDateISO: onboardingContract?.startDateISO || (startDayKey ? `${startDayKey}T00:00:00.000Z` : null),
    startDayKey,
    workWindows: onboardingContract?.workWindows || EMPTY_WORK_WINDOWS,
    commitmentDisclosureAccepted: onboardingContract?.commitmentDisclosureAccepted ?? false,
    commitmentDisclosureAcceptedAtISO: onboardingContract?.commitmentDisclosureAcceptedAtISO,
    isAspirational: onboardingContract?.isAspirational ?? false,
  };
  return {
    ...draft,
    goalIntakeContract: deriveAdmissionIntakeContract(draft, onboarding),
  };
}

function buildDefiniteGoalView(activeCycle, goalExecutionContract) {
  if (!activeCycle) {
    return {
      title: 'Untitled',
      deadlineISO: '',
      startISO: '',
      hasStartDateViolation: false,
      outcome: '',
      targetCount: null,
      targetUnit: '',
      definitionOfDone: '',
      daysPerWeek: null,
      minutesPerDay: null,
      hasGoalContract: false,
    };
  }
  const contract = activeCycle.goalContract;
  const legacyGoal = activeCycle.definiteGoal || {};
  const title =
    (contract?.goalLabel || contract?.label || legacyGoal?.outcome || activeCycle?.direction || 'Untitled').trim() ||
    'Untitled';
  const startISO =
    contract?.startDayKey ||
    contract?.startDateISO ||
    contract?.startISO ||
    contract?.startDate ||
    contract?.temporalBinding?.startDayKey ||
    activeCycle?.startedAtDayKey ||
    activeCycle?.goalGovernanceContract?.activeFromISO ||
    goalExecutionContract?.startDayKey ||
    goalExecutionContract?.startDateISO ||
    goalExecutionContract?.startISO ||
    goalExecutionContract?.startDate ||
    goalExecutionContract?.temporalBinding?.startDayKey ||
    '';
  const deadlineISO =
    contract?.deadline?.dayKey ||
    contract?.deadlineISO ||
    contract?.deadline?.iso ||
    legacyGoal?.deadlineDayKey ||
    goalExecutionContract?.endDayKey ||
    '';
  const outcome =
    contract?.terminalOutcome?.verificationCriteria || contract?.terminalOutcome?.text || legacyGoal?.outcome || '';
  return {
    title,
    startISO,
    hasStartDateViolation: Boolean(contract) && !startISO,
    deadlineISO,
    outcome,
    targetCount: contract?.target?.count ?? null,
    targetUnit: contract?.target?.unit || '',
    definitionOfDone: contract?.target?.definitionOfDone || '',
    daysPerWeek: contract?.capacity?.daysPerWeek ?? null,
    minutesPerDay: contract?.capacity?.minutesPerDay ?? null,
    hasGoalContract: Boolean(contract),
  };
}

export function StructurePageConsolidated({ onStartNewCycleRequest = null, onOpenToday = null }) {
  const store = useIdentityStore();
  const {
    activeCycleId,
    cyclesById,
    goalExecutionContract,
    aspirations,
    appTime,
    proposedBlocks,
    suggestedBlocks,
    lastPlanError,
    pendingOnboardingInputs,
    planRecovery,
    finishOnboardingGate,
    updatePendingOnboardingInputs,
    clearPlanRecovery,
    updateWorkWindows,
    setPlanResolutionKind,
    resetIdentity,
    resetActiveCycle,
  } = store;
  const activeProfileId = store?.activeProfileId || null;
  const activeProfile = activeProfileId ? store?.profilesById?.[activeProfileId] || null : null;
  const activeMasterPlanId = activeProfile?.activeMasterPlanId || null;
  const activeMasterPlan = activeMasterPlanId ? store?.masterPlansById?.[activeMasterPlanId] || null : null;
  const masterPlanIntake = store?.masterPlanIntake || null;
  const hasActiveMasterPlan = Boolean(activeProfile?.activeMasterPlanId);
  const activeMissionId = activeProfile?.activeCoreMissionContractId || null;
  const activeMissionContract = activeMissionId
    ? store?.coreMissionContractsById?.[activeMissionId] || null
    : null;
  const activePlanningTier = String(pendingOnboardingInputs?.goalPlanningTier || '').trim().toLowerCase();
  const isBlankStructureState = isCanonicalBlankState(store);
  const showMasterPlanFlow =
    masterPlanIntake?.status === 'in-progress' ||
    masterPlanIntake?.status === 'complete' ||
    hasActiveMasterPlan ||
    activePlanningTier === 'master_plan';
  const [isCycleTransitionModalOpen, setCycleTransitionModalOpen] = useState(false);
  const [constraintsSaveState, setConstraintsSaveState] = useState('idle');
  const activeCycle = activeCycleId ? cyclesById[activeCycleId] : null;
  const activeGoalId = activeCycle?.goalContract?.goalId || goalExecutionContract?.goalId || null;
  const activeGoalPolicy = activeCycle?.policyState?.goalPolicy || null;
  const activePlanQualityGate =
    activeCycle?.planQualityGate || (activeGoalId ? store?.planQualityGateByGoal?.[activeGoalId] || null : null);
  const activePlanQualityCodes = sortPlanQualityCodesForDisplay(
    uniqueStrings([...(activePlanQualityGate?.failureCodes || []), ...(activePlanQualityGate?.reasonCodes || [])])
  );
  const activePlanQualityTemporalDiagnostic = formatPlanQualityTemporalDiagnostic(activePlanQualityGate);
  const gatePassedWithPolicyAdvisory =
    activePlanQualityGate?.status === 'PLAN_QUALITY_PASSED' &&
    activeGoalPolicy?.planQuality?.state &&
    activeGoalPolicy.planQuality.state !== 'policy_clean';
  const cycleStatus = String(activeCycle?.status || activeCycle?.state || '')
    .trim()
    .toLowerCase();
  const hasValidActiveExecutionCycle = Boolean(activeCycle?.id && cycleStatus !== 'ended' && cycleStatus !== 'archived');
  const isCycleReadOnly = cycleStatus === 'ended' || cycleStatus === 'archived';
  const hasAdmittedGoal = Boolean(activeCycle?.goalContract);
  const hasGoalDraftRecovery =
    String(planRecovery?.required || '')
      .trim()
      .toUpperCase() === 'GOAL_DRAFT_CONTEXT';
  const hasPersistenceRecovery =
    String(planRecovery?.required || '')
      .trim()
      .toUpperCase() === 'PERSISTED_PLAN_MISSING';
  const workspace = activeCycleId ? store?.deliverablesByCycleId?.[activeCycleId] || null : null;
  const deliverables = Array.isArray(workspace?.deliverables) ? workspace.deliverables : [];
  const reviewBlocks = Array.isArray(activeCycle?.scheduleReviewBlocks) ? activeCycle.scheduleReviewBlocks : [];
  const normalizedScheduleLifecycle = String(activeCycle?.scheduleLifecycle || '')
    .trim()
    .toLowerCase();
  const hasAppliedReviewSchedule = normalizedScheduleLifecycle === 'applied_review' && reviewBlocks.length > 0;
  const hasActiveSchedule = normalizedScheduleLifecycle === 'active_schedule';
  const hasExecutableMasterPlan = Boolean(
    activeMasterPlan?.id && Array.isArray(activeMasterPlan?.laneIds) && activeMasterPlan.laneIds.length > 0
  );
  const canonicalProposedInput = useMemo(() => {
    if (Array.isArray(proposedBlocks) && proposedBlocks.length > 0) {
      return proposedBlocks;
    }
    return Array.isArray(activeCycle?.proposedBlocks) ? activeCycle.proposedBlocks : [];
  }, [proposedBlocks, activeCycle?.proposedBlocks]);
  const canonicalProposedChartBlocks = useMemo(() => {
    const canonicalProposed = getCanonicalProposedBlocks(canonicalProposedInput, suggestedBlocks);
    return (Array.isArray(canonicalProposed) ? canonicalProposed : [])
      .filter((block) => {
        if (
          !block ||
          String(block?.status || '')
            .trim()
            .toLowerCase() !== 'suggested'
        ) {
          return false;
        }
        if (activeCycleId && block?.cycleId && block.cycleId !== activeCycleId) {
          return false;
        }
        if (activeGoalId && block?.goalId && block.goalId !== activeGoalId) {
          return false;
        }
        return true;
      })
      .sort((a, b) => String(a?.start || a?.startISO || '').localeCompare(String(b?.start || b?.startISO || '')));
  }, [canonicalProposedInput, suggestedBlocks, activeCycleId, activeGoalId]);
  const canonicalExecutionBlocks = useMemo(() => {
    const cycleEvents = Array.isArray(activeCycle?.executionEvents) ? activeCycle.executionEvents : [];
    if (cycleEvents.length === 0) {
      return [];
    }
    const { days } = materializeBlocksFromEvents(cycleEvents, {
      todayISO: appTime?.nowISO || appTime?.activeDayKey || undefined,
    });
    return (days || [])
      .flatMap((day) => day?.blocks || [])
      .filter((block) => !activeCycleId || block?.cycleId === activeCycleId);
  }, [activeCycle?.executionEvents, activeCycleId, appTime?.nowISO, appTime?.activeDayKey]);
  const chartScheduleBlocks = useMemo(() => {
    // If user has selected an expanded horizon, prefer the full-horizon substrate
    const selectedHorizonMode = String(store?.selectedHorizonMode || 'current_cycle').trim();
    const fullHorizon = Array.isArray(store?.fullHorizonScheduleBlocks) ? store.fullHorizonScheduleBlocks : [];
    if (selectedHorizonMode && selectedHorizonMode !== 'current_cycle' && fullHorizon.length > 0) {
      return fullHorizon;
    }
    if (reviewBlocks.length > 0) {
      return reviewBlocks;
    }
    if (canonicalExecutionBlocks.length > 0) {
      return canonicalExecutionBlocks;
    }
    return canonicalProposedChartBlocks;
  }, [reviewBlocks, canonicalExecutionBlocks, canonicalProposedChartBlocks]);
  const hasVisibleScheduleBlocks = chartScheduleBlocks.length > 0;
  const planChartRows = useMemo(() => {
    const actions = Array.isArray(activeCycle?.actions) ? activeCycle.actions : [];
    const deliverableByActionId = new Map();
    const deliverableIds = new Set();
    deliverables.forEach((deliverable, index) => {
      const deliverableId = String(deliverable?.id || '').trim() || `deliverable-${index + 1}`;
      deliverableIds.add(deliverableId);
      const actionIds = uniqueStrings(deliverable?.actionIds || []);
      actionIds.forEach((actionId) => {
        deliverableByActionId.set(actionId, {
          id: deliverableId,
          title: deliverable?.title || `Deliverable ${index + 1}`,
        });
      });
    });
    const actionMetaById = new Map(
      actions
        .map((action) => {
          const id = String(action?.id || '').trim();
          if (!id) {
            return null;
          }
          return [
            id,
            {
              title: String(action?.title || '').trim(),
              actionType: normalizeActionType(action),
              dependencies: uniqueStrings(action?.dependencies || action?.dependencyIds || []),
              assumptions: uniqueStrings([
                ...(Array.isArray(action?.assumptions) ? action.assumptions : []),
                action?.assumption,
              ]),
            },
          ];
        })
        .filter(Boolean)
    );
    const deliverableLabelById = Object.fromEntries(
      deliverables
        .map((deliverable, index) => [
          String(deliverable?.id || '').trim() || `deliverable-${index + 1}`,
          deliverable?.title || `Deliverable ${index + 1}`,
        ])
        .filter(([id]) => id)
    );
    const chartBlocksById = new Map(
      (chartScheduleBlocks || [])
        .filter((b) => b && b.id)
        .map((b) => [b.id, b]),
    );
    const artifactRegistry =
      (workspace && workspace.fullHorizonScheduleExport && workspace.fullHorizonScheduleExport.artifactRegistry) ||
      {};
    return deliverables.map((deliverable, index) => {
      const deliverableId = String(deliverable?.id || '').trim() || `deliverable-${index + 1}`;
      const blocks = chartScheduleBlocks
        .sort((a, b) => String(a?.start || '').localeCompare(String(b?.start || '')))
        .map((block, blockIndex) => {
          const actionId = String(block?.actionId || '').trim();
          const actionMeta = actionMetaById.get(actionId) || null;
          const resolvedDeliverable = deliverableByActionId.get(actionId) || null;
          const dependencyTitles = uniqueStrings(actionMeta?.dependencies || []).map(
            (dependencyId) => actionMetaById.get(dependencyId)?.title || dependencyId
          );
          const blockMeaning = describeBlockMeaning(block, chartScheduleBlocks, {
            deliverableLabelById,
          });
          const readinessLines = dependencyTitles.length
            ? [`Depends on: ${dependencyTitles.join(', ')}`]
            : (blockMeaning.lines || []).filter((line) => !/^Serves:|^Why:/i.test(String(line || '')));
          if (block?.commerceReadinessLevel) {
            readinessLines.push(`Commerce readiness: ${String(block.commerceReadinessLevel)}`);
          }
          return {
            id: block?.id || `${deliverableId}-block-${blockIndex + 1}`,
            blockId: String(block?.id || `${deliverableId}-block-${blockIndex + 1}`),
            title:
              block?.displayTitle ||
              block?.title ||
              block?.canonicalTitle ||
              block?.rawLabel ||
              block?.label ||
              'Scheduled block',
            actionTitle: deriveFormalActionLineage(block, actionMeta, resolvedDeliverable),
            actionType: normalizeCanonicalBlockType(block, actionMeta?.actionType || 'Unknown'),
            readinessText: readinessLines.join(' · ') || 'No readiness metadata',
            assumptions: uniqueStrings([...(actionMeta?.assumptions || []), block?.assumption]),
            deliverableId: String(block?.deliverableId || '').trim(),
            actionId,
            resolvedDeliverableId: resolvedDeliverable?.id || '',
            start: block?.startISO || block?.start || block?.dateISO || '',
            durationMinutes: block?.durationMinutes || null,
            status: block?.status || 'planned',
            commerceReadinessLevel: block?.commerceReadinessLevel || null,
            ownerLabel: formatOwnerLabel(block?.owner),
            outputArtifactLabel: formatArtifactLabel(
              block?.outputArtifact?.artifactName || block?.outputArtifact?.id || block?.outputArtifactId || block?.producesArtifact || '',
              artifactRegistry,
            ),
            consumedArtifactsLabel: formatConsumedArtifacts(
              block?.consumedArtifactIds,
              artifactRegistry,
              chartBlocksById,
            ),
            consumedArtifactIds: Array.isArray(block?.consumedArtifactIds) ? block.consumedArtifactIds : [],
            gateCriteriaLabel: formatGateSummary(block),
            blockRef: formatBlockRef(block, blockIndex),
            rawBlockId: String(block?.id || `${deliverableId}-block-${blockIndex + 1}`),
          };
        });
      return {
        id: deliverableId,
        title: deliverable?.title || `Deliverable ${index + 1}`,
        requiredBlocks: Number(deliverable?.requiredBlocks || 0),
        blocks: blocks.filter((block) => {
          const blockDeliverableId = String(block?.deliverableId || '').trim();
          if (blockDeliverableId && blockDeliverableId === deliverableId) {
            return true;
          }
          if (blockDeliverableId && !deliverableIds.has(blockDeliverableId)) {
            return block.resolvedDeliverableId === deliverableId;
          }
          return !blockDeliverableId && block.resolvedDeliverableId === deliverableId;
        }),
      };
    });
  }, [deliverables, chartScheduleBlocks, activeCycle?.actions]);
  const totalScheduledChartBlocks = planChartRows.reduce((sum, row) => sum + row.blocks.length, 0);
  const unscheduledDeliverableRows = planChartRows.filter((row) => row.blocks.length === 0);
  const planAssumptions = useMemo(
    () =>
      uniqueStrings([
        ...(activeCycle?.policyState?.goalPolicy?.assumptions || []),
        ...(activeCycle?.goalContract?.goalIntakeContract?.readiness?.assumptionReasons || []),
      ]),
    [activeCycle?.policyState?.goalPolicy?.assumptions, activeCycle?.goalContract?.goalIntakeContract?.readiness]
  );
  const longHorizonMetadata = useMemo(
    () => getCanonicalLongHorizonPlanMetadata(activeCycle, workspace, chartScheduleBlocks),
    [activeCycle, workspace, chartScheduleBlocks]
  );
  const semanticSummary = useMemo(
    () =>
      deriveStructureSchedulingSemanticSummary({
        proposedBlocks: canonicalProposedInput,
        suggestedBlocks,
        deliverables: workspace?.deliverables || [],
        workspace,
        executionEvents: activeCycle?.executionEvents || [],
        activeCycleId,
        activeGoalId,
        scheduleLifecycle: activeCycle?.scheduleLifecycle || null,
        scheduleReviewBlocks: activeCycle?.scheduleReviewBlocks || [],
        lastPlanError,
        activePlanSummary: activeCycle?.autoAsanaPlan?.summary || activeCycle?.lastResolvedPlanSummary || null,
      }),
    [
      canonicalProposedInput,
      suggestedBlocks,
      workspace,
      activeCycle?.executionEvents,
      activeCycleId,
      activeGoalId,
      activeCycle?.scheduleLifecycle,
      activeCycle?.scheduleReviewBlocks,
      lastPlanError,
      activeCycle?.autoAsanaPlan?.summary,
      activeCycle?.lastResolvedPlanSummary,
    ]
  );
  const semanticLabels = useMemo(() => getStructureSchedulingLabels(semanticSummary), [semanticSummary]);
  const scheduleStatus = semanticSummary?.scheduleStatus || 'none';
  const selectedPlanResolutionKind = activeCycle?.selectedPlanResolutionKind || null;
  const definiteGoalView = buildDefiniteGoalView(activeCycle, goalExecutionContract);
  const existingGoalOutcomes = useMemo(() => getActiveGoalOutcomes(cyclesById), [cyclesById]);

  const canonicalWorkWindows = activeCycle?.goalContract?.workWindows ?? EMPTY_WORK_WINDOWS;
  const [workWindows, setWorkWindows] = useState(canonicalWorkWindows);
  const [blackoutDays, setBlackoutDays] = useState('');

  useEffect(() => {
    const localSerialized = JSON.stringify(workWindows || EMPTY_WORK_WINDOWS);
    const canonicalSerialized = JSON.stringify(canonicalWorkWindows || EMPTY_WORK_WINDOWS);
    if (localSerialized !== canonicalSerialized) {
      setWorkWindows(canonicalWorkWindows);
    }
  }, [activeCycle?.id, canonicalWorkWindows]);

  useEffect(() => {
    const localSerialized = JSON.stringify(workWindows || EMPTY_WORK_WINDOWS);
    const canonicalSerialized = JSON.stringify(canonicalWorkWindows || EMPTY_WORK_WINDOWS);
    if (localSerialized === canonicalSerialized) {
      setConstraintsSaveState((prev) => (prev === 'saving' ? 'saved' : prev === 'dirty' ? 'idle' : prev));
      return;
    }
    setConstraintsSaveState((prev) => (prev === 'saving' ? 'saving' : 'dirty'));
  }, [workWindows, canonicalWorkWindows]);

  const appNowISO = appTime?.nowISO || new Date().toISOString();
  const appCurrentDayKey = toDayKey(appNowISO);
  const [admissionDraft, setAdmissionDraft] = useState(() =>
    buildAdmissionDraftFromPendingInputs(pendingOnboardingInputs)
  );
  const [admissionAttemptFeedback, setAdmissionAttemptFeedback] = useState(null);
  const persistAdmissionDraft = (nextDraft) => {
    const nextWithIntake = {
      ...nextDraft,
      goalIntakeContract: deriveAdmissionIntakeContract(nextDraft, pendingOnboardingInputs),
    };
    setAdmissionDraft(nextWithIntake);
    setAdmissionAttemptFeedback(null);
    updatePendingOnboardingInputs?.({
      ...(pendingOnboardingInputs || {}),
      goalContract: nextWithIntake,
    });
  };

  useEffect(() => {
    if (hasAdmittedGoal) {
      setAdmissionAttemptFeedback(null);
      return;
    }
    setAdmissionDraft(buildAdmissionDraftFromPendingInputs(pendingOnboardingInputs));
  }, [pendingOnboardingInputs, hasAdmittedGoal]);

  useEffect(() => {
    if (!hasAdmittedGoal) {
      return;
    }
    if (!hasGoalDraftRecovery) {
      return;
    }
    clearPlanRecovery?.();
  }, [hasAdmittedGoal, hasGoalDraftRecovery, clearPlanRecovery]);

  useEffect(() => {
    if (!showMasterPlanFlow || hasActiveMasterPlan) {
      return;
    }
    if (!activeProfileId) {
      return;
    }
    if (masterPlanIntake?.status !== 'idle') {
      return;
    }
    store?.masterPlanIntakeStart?.(activeProfileId);
  }, [showMasterPlanFlow, hasActiveMasterPlan, activeProfileId, masterPlanIntake?.status, store]);

  const handleClearGoal = async () => {
    if (
      window.confirm(
        'Clear the current goal? This deletes the goal, Master Plan, Operating Cycle, schedule, and evidence and returns Jericho to blank state.'
      )
    ) {
      if (typeof store?.hardResetIdentity === 'function') {
        await store.hardResetIdentity();
      } else {
        resetIdentity?.();
      }
      try {
        window.location.hash = '#/structure';
      } catch {
        // ignore hash routing failures
      }
      try {
        window.location.reload?.();
      } catch {
        // ignore reload failures
      }
    }
  };

  const handleResetActiveCycle = () => {
    if (!activeCycleId) {
      return;
    }
    if (
      window.confirm(
        'Reset the active Operating Cycle? This clears generated schedule, applied schedule, and execution evidence for this Operating Cycle but keeps the Master Plan.'
      )
    ) {
      resetActiveCycle?.(activeCycleId);
    }
  };

  const handleCompleteCycleReassessment = () => {
    if (!hasValidActiveExecutionCycle || !activeCycleId) {
      return;
    }
    store.completeCycleReassessment?.(activeCycleId);
  };

  const handleDeleteActiveCycle = () => {
    if (!hasValidActiveExecutionCycle || !activeCycleId) {
      return;
    }
    if (window.confirm('Delete the active Operating Cycle and clear the calendar? This cannot be undone.')) {
      store.deleteCycle?.(activeCycleId);
      try {
        window.location.hash = '#/structure';
      } catch {
        // ignore hash routing failures
      }
    }
  };

  const handleStartNewCycle = () => {
    if (onStartNewCycleRequest) {
      onStartNewCycleRequest({ hasActiveExecutionCycle: hasValidActiveExecutionCycle, activeCycleId });
      return;
    }
    if (hasValidActiveExecutionCycle) {
      setCycleTransitionModalOpen(true);
      return;
    }
    store.startNewCycleWithDecision?.({ mode: 'archive' });
  };

  // ============================================================================
  // MODULE 1: Pre-admission (no admitted goal contract)
  // ============================================================================
  if (!hasAdmittedGoal) {
    if (showMasterPlanFlow) {
      return (
        <div className="space-y-6">
          <div className="border-b border-line/40 pb-4">
            <h1 className="text-2xl font-bold text-jericho-text mb-2">Structure</h1>
            <p className="text-sm text-muted">Master Plan Establishment</p>
          </div>

          {hasPersistenceRecovery ? <PersistenceRecoveryNotice planRecovery={planRecovery} /> : null}

          <MasterPlanStructureSection
            hasActiveMasterPlan={hasActiveMasterPlan}
            masterPlanIntakeStatus={masterPlanIntake?.status || 'idle'}
            activeMasterPlan={activeMasterPlan}
            activeCycle={activeCycle}
            scheduleLifecycle={normalizedScheduleLifecycle || 'no_schedule'}
            onClearGoal={handleClearGoal}
          />

          {hasActiveMasterPlan ? (
            <CycleManagementSection
              activeCycleId={hasValidActiveExecutionCycle ? activeCycleId : null}
              hasActiveMasterPlan={hasActiveMasterPlan}
              activeCycle={hasValidActiveExecutionCycle ? activeCycle : null}
              scheduleLifecycle={normalizedScheduleLifecycle || 'no_schedule'}
              onCompleteReassessment={handleCompleteCycleReassessment}
              onStartNewCycleRequest={() => {
                handleStartNewCycle();
              }}
              onArchiveCycle={() => {
                if (!hasValidActiveExecutionCycle || !activeCycleId) {
                  return;
                }
                if (window.confirm('Archive the active Operating Cycle and move it to review mode?')) {
                  store.endCycle?.(activeCycleId);
                }
              }}
              onResetCycle={handleResetActiveCycle}
              onDeleteCycle={handleDeleteActiveCycle}
            />
          ) : null}
        </div>
      );
    }

    const draftStartDayKey = toDayKey(
      admissionDraft?.startDayKey || admissionDraft?.startDateISO || admissionDraft?.startDate || ''
    );
    const startDayViolation = Boolean(draftStartDayKey) && draftStartDayKey < appCurrentDayKey;
    const startDayMessage = startDayViolation
      ? `Start date ${draftStartDayKey} is earlier than the current day ${appCurrentDayKey}. Update the start date before admitting this cycle.`
      : null;
    return (
      <div className="space-y-6">
        <div className="border-b border-line/40 pb-4">
          <h1 className="text-2xl font-bold text-jericho-text mb-2">Structure</h1>
          <p className="text-sm text-muted">Contract Admission</p>
        </div>

        {hasPersistenceRecovery ? <PersistenceRecoveryNotice planRecovery={planRecovery} /> : null}

        {startDayMessage ? (
          <div className="rounded-lg border border-red-600/40 bg-red-50 p-4 text-sm text-red-900">
            {startDayMessage}
          </div>
        ) : null}

        {admissionAttemptFeedback ? (
          <div className="rounded-lg border border-red-600/40 bg-red-50 p-4 space-y-2">
            <p className="text-sm font-semibold text-red-900">Admission failed</p>
            {admissionAttemptFeedback.rejectionReason ? (
              <p className="text-xs text-red-800">{admissionAttemptFeedback.rejectionReason}</p>
            ) : null}
            {Array.isArray(admissionAttemptFeedback.rejectionCodes) &&
            admissionAttemptFeedback.rejectionCodes.length > 0 ? (
              <ul className="space-y-1 text-xs text-red-800">
                {admissionAttemptFeedback.rejectionCodes.map((code) => (
                  <li key={code}>• {GOAL_REJECTION_MESSAGES[code] || code}</li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}

        {isBlankStructureState ? (
          <div className="rounded-lg border border-line/60 bg-jericho-surface/90 p-4 space-y-1">
            <p className="text-sm font-semibold text-jericho-text">No goal established yet.</p>
            <p className="text-xs text-muted">Describe a goal to begin structure intake.</p>
          </div>
        ) : null}

        {activeMissionContract ? (
          <MissionContextBanner contract={activeMissionContract} />
        ) : null}

        <GoalAdmissionPage
          contract={admissionDraft}
          onContractChange={persistAdmissionDraft}
          onPlanningTierRouted={({ planningTier, goalDescription, goalArchitecture }) => {
            const nextPending = {
              ...(pendingOnboardingInputs || {}),
              goalPlanningTier: planningTier,
              goalText: goalDescription,
              goalArchitecture,
              goalDraftV2: {
                ...((pendingOnboardingInputs || {}).goalDraftV2 || {}),
                goalText: goalDescription,
                goalLabel: goalDescription,
              },
            };
            updatePendingOnboardingInputs?.(nextPending);
            if (requiresCoreMissionContract(planningTier, goalDescription)) {
              const existingMissionId = activeProfile?.activeCoreMissionContractId || null;
              if (!existingMissionId && activeProfileId) {
                store.createCoreMissionContract?.({
                  profileId: activeProfileId,
                  durableObjective: goalDescription,
                  currentPhase: 'foundation',
                  horizonYears: 3,
                });
              }
            }
            if (activeProfileId && masterPlanIntake?.status === 'idle') {
              store.masterPlanIntakeStart?.(activeProfileId);
              store.masterPlanIntakeAnswer?.(goalDescription);
              if (goalArchitecture?.laneComposition?.length) {
                store.masterPlanIntakeSetLanes?.(goalArchitecture.laneComposition);
              }
            } else if (masterPlanIntake?.status === 'in-progress' && masterPlanIntake?.step === 1) {
              store.masterPlanIntakeAnswer?.(goalDescription);
              if (goalArchitecture?.laneComposition?.length) {
                store.masterPlanIntakeSetLanes?.(goalArchitecture.laneComposition);
              }
            }
          }}
          onExecutionTypeChange={(executionType) => {
            if ((admissionDraft?.executionType || null) === (executionType || null)) {
              return;
            }
            persistAdmissionDraft({
              ...admissionDraft,
              executionType,
            });
          }}
          onAdmit={(submittedContract) => {
            const draftForSubmit = synchronizeAdmissionContract(submittedContract || admissionDraft);
            const intakeContractForAdmit =
              draftForSubmit?.goalIntakeContract || deriveAdmissionIntakeContract(draftForSubmit, pendingOnboardingInputs);
            if (!intakeContractForAdmit.readiness.isReadyForPlanning) {
              setAdmissionAttemptFeedback({
                rejectionCodes: [
                  intakeContractForAdmit.requiredContextQuestions[0]?.reasonCode || 'INTAKE_BOUNDARY_AMBIGUOUS',
                ],
                rejectionReason:
                  intakeContractForAdmit.requiredContextQuestions[0]?.prompt ||
                  'Goal intake is not ready for planning.',
              });
              return;
            }
            persistAdmissionDraft(draftForSubmit);
            const result = store.attemptGoalAdmission?.({
              contract: draftForSubmit,
              goalDraftV2: draftForSubmit?.goalDraftV2 || null,
            });
            if (result?.status === 'REJECTED') {
              setAdmissionAttemptFeedback(result);
              return;
            }
            setAdmissionAttemptFeedback(null);
          }}
          onAspire={() => {
            finishOnboardingGate?.(null);
          }}
          existingGoalOutcomes={existingGoalOutcomes}
          appTimeISO={appNowISO}
        />
      </div>
    );
  }

  // ============================================================================
  // MODULE 2: Post-admission (admitted goal contract exists)
  // ============================================================================
  return (
    <div className="space-y-4">
      {/* Goal Banner (Canonical, Read-Only) */}
      {activeCycle && (
        <div className="rounded-xl border border-line/60 bg-jericho-surface/90 p-4">
          <div className="text-xs uppercase tracking-[0.14em] text-muted mb-2">Definite Goal</div>
          <div className="space-y-2">
            <div className="text-sm font-semibold text-jericho-text">{definiteGoalView.title}</div>
            <div className="text-xs text-muted space-y-1">
              {definiteGoalView.startISO && definiteGoalView.deadlineISO ? (
                <div>
                  <span className="font-semibold">Plan window:</span> {formatDate(definiteGoalView.startISO)} →{' '}
                  {formatDate(definiteGoalView.deadlineISO)}
                </div>
              ) : null}
              <div>
                <span className="font-semibold">Start date:</span>{' '}
                {definiteGoalView.startISO
                  ? formatDate(definiteGoalView.startISO)
                  : 'CONTRACT_VIOLATION_MISSING_START_DATE'}
              </div>
              {definiteGoalView.deadlineISO ? (
                <div>
                  <span className="font-semibold">Deadline:</span> {formatDate(definiteGoalView.deadlineISO)}
                </div>
              ) : (
                <div>
                  <span className="font-semibold">Deadline:</span> N/A
                </div>
              )}
              {definiteGoalView.targetCount !== null && definiteGoalView.targetUnit ? (
                <div>
                  <span className="font-semibold">Target:</span> {definiteGoalView.targetCount}{' '}
                  {definiteGoalView.targetUnit}
                </div>
              ) : null}
              {definiteGoalView.daysPerWeek && definiteGoalView.minutesPerDay ? (
                <div>
                  <span className="font-semibold">Capacity:</span> {definiteGoalView.daysPerWeek} days/week ·{' '}
                  {definiteGoalView.minutesPerDay} min/day
                </div>
              ) : null}
              <div>
                <span className="font-semibold">Outcome:</span> {definiteGoalView.outcome || '—'}
              </div>
              {activeGoalPolicy ? (
                <div className="rounded-md border border-line/60 bg-jericho-surface/80 px-3 py-2 space-y-1">
                  <div className="text-[11px] uppercase tracking-[0.14em] text-muted">Policy advisory</div>
                  <div className="grid gap-1 text-[11px] text-muted sm:grid-cols-3">
                    <div>
                      <span className="font-semibold">Intake:</span>{' '}
                      {formatPolicyState(activeGoalPolicy.intakeReadiness?.state || 'unknown')}
                    </div>
                    <div>
                      <span className="font-semibold">Planning advisory:</span>{' '}
                      {formatPolicyState(activeGoalPolicy.planQuality?.state || 'unknown')}
                    </div>
                    <div>
                      <span className="font-semibold">P.O.S. trust:</span>{' '}
                      {formatPolicyState(activeGoalPolicy.posTrust?.state || 'unknown')}
                    </div>
                  </div>
                  {gatePassedWithPolicyAdvisory ? (
                    <div className="text-[11px] text-muted/70">
                      Canonical plan-quality gate passed; advisory signals may still flag pacing, density, or
                      support-forecast pressure.
                    </div>
                  ) : null}
                  {activeGoalPolicy.feasibility ? (
                    <div className="text-[11px] text-muted border-t border-line/40 pt-1 mt-1 space-y-1">
                      <div>
                        <span className="font-semibold">Initial feasibility:</span>{' '}
                        {formatFeasibilityState(activeGoalPolicy.feasibility.state)}
                        {activeGoalPolicy.feasibility.substrateLevel ? (
                          <span className="text-muted/70">
                            {' · substrate: '}
                            {String(activeGoalPolicy.feasibility.substrateLevel).replace(/_/g, ' ')}
                          </span>
                        ) : null}
                      </div>
                      <div>
                        <span className="font-semibold">Support forecast:</span>{' '}
                        {formatFeasibilityState(activeGoalPolicy.feasibility.state)}
                      </div>
                      <div className="text-muted/70">
                        Pre-execution only. Live P.O.S. remains separate and withheld until execution evidence exists.
                      </div>
                      <div className="text-muted/70">
                        Reason:{' '}
                        {Array.isArray(activeGoalPolicy.feasibility.reasonCodes) &&
                        activeGoalPolicy.feasibility.reasonCodes.length > 0
                          ? activeGoalPolicy.feasibility.reasonCodes
                              .map((code) =>
                                String(code || '')
                                  .replace(/^FEASIBILITY_/i, '')
                                  .replace(/_/g, ' ')
                                  .toLowerCase()
                              )
                              .join(' · ')
                          : 'no canonical feasibility reason codes'}
                      </div>
                    </div>
                  ) : null}
                </div>
              ) : null}
              {activePlanQualityGate ? (
                <div className="rounded-md border border-line/60 bg-jericho-surface/80 px-3 py-2 space-y-1">
                  <div className="text-[11px] uppercase tracking-[0.14em] text-muted">Plan-quality diagnostics</div>
                  <div className="text-[11px] text-muted">
                    <span className="font-semibold">Gate:</span>{' '}
                    {formatPolicyState(activePlanQualityGate.status || 'unknown')}
                  </div>
                  {activePlanQualityTemporalDiagnostic ? (
                    <div className="text-[11px] text-jericho-text">{activePlanQualityTemporalDiagnostic}</div>
                  ) : null}
                  {activePlanQualityCodes.length > 0 ? (
                    <div className="text-[11px] text-muted/80 whitespace-normal break-words">
                      {activePlanQualityCodes.map(formatPlanQualityReason).join(' · ')}
                    </div>
                  ) : (
                    <div className="text-[11px] text-muted/80">No plan-quality failure codes are active.</div>
                  )}
                </div>
              ) : null}
            </div>
          </div>
          <div className="mt-3 text-xs text-muted/60 italic">
            Read-only. To change goal, archive this cycle and start a new one.
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handleClearGoal}
              className="rounded-full border border-red-600 px-3 py-1 text-xs text-red-600 hover:bg-red-600/10"
            >
              Clear Goal
            </button>
          </div>
        </div>
      )}

      {showMasterPlanFlow && activeMissionContract ? (
        <MissionContextBanner contract={activeMissionContract} />
      ) : null}

      {showMasterPlanFlow ? (
        <MasterPlanStructureSection
          hasActiveMasterPlan={hasActiveMasterPlan}
          masterPlanIntakeStatus={masterPlanIntake?.status || 'idle'}
          activeMasterPlan={activeMasterPlan}
          activeCycle={activeCycle}
          scheduleLifecycle={normalizedScheduleLifecycle || 'no_schedule'}
          onClearGoal={handleClearGoal}
        />
      ) : null}

      {/* Deliverables (Collapsed by Default) */}
      <details className="rounded-xl border border-line/60 bg-jericho-surface/90 p-4">
        <summary className="cursor-pointer flex items-center justify-between hover:bg-jericho-surface/60 p-2 -m-2 rounded">
          <div className="flex items-center gap-2">
            <p className="text-xs uppercase tracking-[0.14em] text-muted">{semanticLabels.groupSectionLabel}</p>
          </div>
          <div className="text-xs text-muted/70 flex items-center gap-4">
            {semanticLabels.proposedCountLabel ? <span>{semanticLabels.proposedCountLabel}</span> : null}
            {store?.deliverablesByCycleId?.[activeCycleId]?.autoGenerated && (
              <span className="text-success text-xs font-medium">Auto-generated</span>
            )}
          </div>
        </summary>
        <div className="mt-3 space-y-3 text-xs">
          {store?.deliverablesByCycleId?.[activeCycleId]?.autoGenerated && (
            <div className="rounded-lg border border-success/30 bg-success/5 p-3">
              <p className="text-success/80 font-medium mb-1">
                Auto-generated {semanticLabels.groupSectionLabel.toLowerCase()}
              </p>
              <p className="text-muted/70 text-xs mb-2">
                {store.deliverablesByCycleId[activeCycleId].autoStrategy?.rationale}
              </p>
              <p className="text-muted/70 text-xs">Edit optional · derivable from goal commitment</p>
            </div>
          )}
          <div>
            <div className="text-muted/80 font-semibold mb-2">
              {semanticLabels.groupSectionLabel} ({semanticSummary.displayedGroupCount || 0})
            </div>
            <div className="space-y-2">
              {(store?.deliverablesByCycleId?.[activeCycleId]?.deliverables || []).length > 0 ? (
                store.deliverablesByCycleId[activeCycleId].deliverables.map((deliv, idx) => (
                  <div
                    key={deliv.id || idx}
                    className="flex justify-between items-start bg-jericho-surface/60 rounded p-2"
                  >
                    <div className="flex-1">
                      <div className="text-xs font-medium text-jericho-text">{deliv.title}</div>
                      <div className="text-xs text-muted/70">
                        {deliv.requiredBlocks} {semanticLabels.groupEffortUnitLabel}
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-xs text-muted/70 italic">
                  No {semanticLabels.groupSectionLabel.toLowerCase()} yet · click edit to add
                </div>
              )}
            </div>
          </div>

          {planChartRows.length > 0 ? (
            <div className="rounded-lg border border-line/60 bg-jericho-surface/70 p-3 space-y-3">
              <div className="flex items-center justify-between gap-4">
                <div className="text-muted/80 font-semibold">Formal plan chart</div>
                <div className="text-[11px] text-muted/70">
                  {totalScheduledChartBlocks} scheduled block{totalScheduledChartBlocks === 1 ? '' : 's'} across{' '}
                  {planChartRows.length} {semanticLabels.groupSectionLabel.toLowerCase()}
                </div>
              </div>

              {unscheduledDeliverableRows.length > 0 ? (
                <div className="rounded border border-amber-500/40 bg-amber-50/60 px-3 py-2 text-[11px] text-amber-900">
                  {unscheduledDeliverableRows.length} deliverable
                  {unscheduledDeliverableRows.length === 1 ? '' : 's'} currently have no scheduled blocks in this
                  outlined plan.
                </div>
              ) : null}

              {planAssumptions.length > 0 ? (
                <div className="rounded border border-amber-500/40 bg-amber-50/40 px-3 py-2 text-[11px] text-amber-950">
                  <div className="font-semibold">Plan assumptions ({planAssumptions.length})</div>
                  <div className="mt-1 whitespace-normal break-words">
                    {planAssumptions.map((assumption) => `Assumption: ${assumption}`).join(' · ')}
                  </div>
                </div>
              ) : null}

              {longHorizonMetadata.isLongHorizon &&
              (longHorizonMetadata.phases.length > 0 ||
                longHorizonMetadata.pacing.buckets.length > 0 ||
                longHorizonMetadata.uncertainty?.bands?.length > 0 ||
                longHorizonMetadata.checkpoints?.length > 0 ||
                longHorizonMetadata.saturation?.source !== 'none') ? (
                <div className="rounded border border-line/60 bg-jericho-surface/60 px-3 py-3 text-[11px] text-jericho-text space-y-3">
                  <div className="font-semibold">Long-horizon structure</div>
                  <div className="text-muted/80">
                    {longHorizonMetadata.horizonDays} day horizon · pacing{' '}
                    {String(longHorizonMetadata.pacing.shape || 'insufficient_data').replace(/_/g, ' ')}
                  </div>
                  {longHorizonMetadata.quality?.state && longHorizonMetadata.quality.state !== 'not_applicable' ? (
                    <div className="rounded border border-line/40 bg-jericho-surface/80 px-2 py-2 space-y-1">
                      <div className="font-medium">
                        Long-term quality · {formatLongTermQualityState(longHorizonMetadata.quality.state)}
                      </div>
                      {Array.isArray(longHorizonMetadata.quality.reasonCodes) &&
                      longHorizonMetadata.quality.reasonCodes.length > 0 ? (
                        <div className="text-muted/80 whitespace-normal break-words">
                          {longHorizonMetadata.quality.reasonCodes.join(' · ')}
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                  {longHorizonMetadata.phases.length > 0 ? (
                    <div className="space-y-2">
                      <div className="font-medium text-muted/80">Phase structure</div>
                      <div className="space-y-1">
                        {longHorizonMetadata.phases.map((phase) => (
                          <div key={phase.id} className="rounded border border-line/40 bg-jericho-surface/80 px-2 py-2">
                            <div className="font-medium">{phase.title}</div>
                            <div className="text-muted/80">
                              {formatPhaseMode(phase.phaseMode)} · {phase.scheduledBlockCount} scheduled block
                              {phase.scheduledBlockCount === 1 ? '' : 's'}
                              {phase.startDayKey && phase.endDayKey
                                ? ` · ${formatDate(phase.startDayKey)} → ${formatDate(phase.endDayKey)}`
                                : ''}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}
                  {longHorizonMetadata.uncertainty?.bands?.length > 0 ? (
                    <div className="space-y-2">
                      <div className="font-medium text-muted/80">Temporal certainty</div>
                      <div className="space-y-1">
                        {longHorizonMetadata.uncertainty.bands.map((band) => (
                          <div key={band.id} className="rounded border border-line/40 bg-jericho-surface/80 px-2 py-2">
                            <div className="font-medium">
                              {band.phaseTitle || 'Long-horizon segment'} · {formatTemporalCertainty(band.certainty)}
                            </div>
                            <div className="text-muted/80">
                              {band.startDayKey && band.endDayKey
                                ? `${formatDate(band.startDayKey)} → ${formatDate(band.endDayKey)}`
                                : 'Temporal span pending'}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}
                  {longHorizonMetadata.checkpoints?.length > 0 ? (
                    <div className="space-y-2">
                      <div className="font-medium text-muted/80">Checkpoints</div>
                      <div className="space-y-1">
                        {longHorizonMetadata.checkpoints.map((checkpoint) => (
                          <div
                            key={checkpoint.checkpointId}
                            className="rounded border border-line/40 bg-jericho-surface/80 px-2 py-2"
                          >
                            <div className="font-medium">{checkpoint.checkpointLabel}</div>
                            <div className="text-muted/80">
                              {checkpoint.checkpointDate ? formatDate(checkpoint.checkpointDate) : 'Date pending'} ·{' '}
                              {String(checkpoint.checkpointReason || 'checkpoint').replace(/_/g, ' ')}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}
                  {longHorizonMetadata.saturation?.source !== 'none' ? (
                    <div className="space-y-2">
                      <div className="font-medium text-muted/80">Saturation</div>
                      <div className="rounded border border-line/40 bg-jericho-surface/80 px-2 py-2 text-muted/80">
                        {String(longHorizonMetadata.saturation?.saturationShape || 'insufficient_data').replace(
                          /_/g,
                          ' '
                        )}{' '}
                        · overloaded {longHorizonMetadata.saturation?.overloadedSegments?.length || 0} ·
                        under-structured {longHorizonMetadata.saturation?.understructuredSegments?.length || 0}
                      </div>
                    </div>
                  ) : null}
                  {longHorizonMetadata.pacing.buckets.length > 0 ? (
                    <div className="space-y-2">
                      <div className="font-medium text-muted/80">Pacing by month</div>
                      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                        {longHorizonMetadata.pacing.buckets.map((bucket) => (
                          <div
                            key={bucket.bucketId}
                            className="rounded border border-line/40 bg-jericho-surface/80 px-2 py-2"
                          >
                            <div className="font-medium">{bucket.label}</div>
                            <div className="text-muted/80">
                              {bucket.blockCount} block{bucket.blockCount === 1 ? '' : 's'} · {bucket.totalMinutes} min
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>
              ) : null}

              <div className="overflow-x-auto">
                <table className="min-w-full border-collapse text-[11px]">
                  <thead>
                    <tr className="border-b border-line/60 text-left text-muted">
                      <th className="px-2 py-2 font-semibold">Deliverable</th>
                      <th className="px-2 py-2 font-semibold">Required sessions</th>
                      <th className="px-2 py-2 font-semibold">Scheduled blocks</th>
                      <th className="px-2 py-2 font-semibold">Block title</th>
                      <th className="px-2 py-2 font-semibold">Ref</th>
                      <th className="px-2 py-2 font-semibold">Action lineage</th>
                      <th className="px-2 py-2 font-semibold">Type</th>
                      <th className="px-2 py-2 font-semibold">Owner</th>
                      <th className="px-2 py-2 font-semibold">Output artifact</th>
                      <th className="px-2 py-2 font-semibold">Consumed artifacts</th>
                      <th className="px-2 py-2 font-semibold">Gate criteria</th>
                      <th className="px-2 py-2 font-semibold">Readiness</th>
                      <th className="px-2 py-2 font-semibold">Assumptions</th>
                      <th className="px-2 py-2 font-semibold">Scheduled for</th>
                    </tr>
                  </thead>
                  <tbody>
                    {planChartRows.map((row) => {
                      const rowSpan = Math.max(1, row.blocks.length);
                      const firstBlock = row.blocks[0] || null;
                      if (!firstBlock) {
                        return (
                          <tr key={row.id} className="border-b border-line/40 align-top">
                            <td className="px-2 py-2 font-medium text-jericho-text">{row.title}</td>
                            <td className="px-2 py-2 text-muted/80">{row.requiredBlocks || '—'}</td>
                            <td className="px-2 py-2 text-muted/80">0</td>
                            <td className="px-2 py-2 text-muted/60 italic whitespace-normal break-words">
                              No scheduled block yet
                            </td>
                            <td className="px-2 py-2 text-muted/60">—</td>
                            <td className="px-2 py-2 text-muted/60">—</td>
                            <td className="px-2 py-2 text-muted/60">—</td>
                            <td className="px-2 py-2 text-muted/60">—</td>
                            <td className="px-2 py-2 text-muted/60">—</td>
                            <td className="px-2 py-2 text-muted/60">—</td>
                            <td className="px-2 py-2 text-muted/60">—</td>
                            <td className="px-2 py-2 text-muted/60">—</td>
                            <td className="px-2 py-2 text-muted/60">—</td>
                            <td className="px-2 py-2 text-muted/60">—</td>
                          </tr>
                        );
                      }
                      return row.blocks.map((block, blockIndex) => (
                        <tr key={block.id} className="border-b border-line/40 align-top">
                          {blockIndex === 0 ? (
                            <>
                              <td rowSpan={rowSpan} className="px-2 py-2 font-medium text-jericho-text">
                                {row.title}
                              </td>
                              <td rowSpan={rowSpan} className="px-2 py-2 text-muted/80">
                                {row.requiredBlocks || '—'}
                              </td>
                              <td rowSpan={rowSpan} className="px-2 py-2 text-muted/80">
                                {row.blocks.length}
                              </td>
                            </>
                          ) : null}
                          <td className="px-2 py-2 text-jericho-text whitespace-normal break-words leading-4">
                            <span title={block.detailTitle || block.canonicalTitle || block.title}>
                              {block.displayTitle || block.title}
                            </span>
                          </td>
                          <td
                              className="px-2 py-2 text-muted/80 whitespace-nowrap leading-4"
                              data-block-id={block.rawBlockId}
                              title={block.rawBlockId}
                            >
                              {block.blockRef}
                            </td>
                          <td className="px-2 py-2 text-muted/80 whitespace-normal break-words leading-4">
                            {block.actionTitle || '—'}
                          </td>
                          <td className="px-2 py-2 text-muted/80">{block.actionType}</td>
                          <td className="px-2 py-2 text-muted/80">{block.ownerLabel || '—'}</td>
                          <td className="px-2 py-2 text-muted/80 whitespace-normal break-words leading-4">
                            {block.outputArtifactLabel}
                          </td>
                          <td
                              className="px-2 py-2 text-muted/80 whitespace-normal break-words leading-4"
                              title={Array.isArray(block.consumedArtifactIds) ? block.consumedArtifactIds.join('\n') : ''}
                            >
                              {block.consumedArtifactsLabel}
                            </td>
                          <td className="px-2 py-2 text-muted/80 whitespace-normal break-words leading-4">
                            {block.gateCriteriaLabel}
                          </td>
                          <td className="px-2 py-2 text-muted/80 whitespace-normal break-words leading-4">
                            {block.readinessText || '—'}
                          </td>
                          <td className="px-2 py-2 text-muted/80 whitespace-normal break-words leading-4">
                            {block.assumptions.length > 0
                              ? block.assumptions.map((assumption) => `Assumption: ${assumption}`).join(' · ')
                              : '—'}
                          </td>
                          <td className="px-2 py-2 text-muted/80">
                            {block.start ? formatDateTime(block.start, appTime?.timeZone || 'UTC') : '—'}
                          </td>
                        </tr>
                      ));
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}
        </div>
      </details>

      {/* Advisory Constraints (Work Windows + Blackout) */}
      <details className="rounded-xl border border-line/60 bg-jericho-surface/90 p-4">
        <summary className="cursor-pointer flex items-center gap-2">
          <p className="text-xs uppercase tracking-[0.14em] text-muted">Advisory Constraints</p>
        </summary>
        <div className="mt-3 space-y-3 text-xs">
          <WorkWindowsEditor value={workWindows} onChange={setWorkWindows} />
          <div>
            <label className="block text-muted/80 mb-1">Blackout days (comma-separated dayKeys):</label>
            <input
              type="text"
              placeholder="e.g. 2026-01-11, 2026-01-25"
              value={blackoutDays}
              onChange={(event) => setBlackoutDays(event.target.value)}
              className="w-full rounded border border-line/40 bg-jericho-surface px-2 py-1 text-xs text-jericho-text"
            />
          </div>
          <button
            type="button"
            className="rounded-full border border-line/60 px-3 py-1.5 text-xs text-muted hover:text-jericho-accent"
            onClick={() => {
              setConstraintsSaveState('saving');
              updateWorkWindows?.({
                cycleId: activeCycleId,
                workWindows,
              });
            }}
          >
            Save Constraints
          </button>
          {constraintsSaveState === 'saving' ? (
            <div className="text-[11px] text-muted">Saving constraints...</div>
          ) : null}
          {constraintsSaveState === 'saved' ? (
            <div className="text-[11px] text-emerald-700">Constraints saved to the active Operating Cycle.</div>
          ) : null}
          {constraintsSaveState === 'dirty' ? (
            <div className="text-[11px] text-muted">Unsaved constraint changes.</div>
          ) : null}
        </div>
      </details>

      {/* Schedule Status */}
      <div className="rounded-xl border border-line/60 bg-jericho-surface/90 p-4 space-y-3">
        <p className="text-xs uppercase tracking-[0.14em] text-muted">Schedule Status</p>
        {scheduleStatus === 'draft_schedule_ready' && (
          <p className="text-xs text-muted/80">
            {semanticLabels.scheduleStatusLabel}
            <button
              type="button"
              className="ml-2 rounded border border-line/60 px-2 py-0.5 text-[11px] text-muted hover:text-jericho-accent"
              onClick={() => {
                if (onOpenToday) {
                  onOpenToday();
                  return;
                }
                try {
                  window.location.hash = '#/today';
                } catch {
                  // ignore hash routing failures
                }
              }}
            >
              View in Today
            </button>
          </p>
        )}
        {scheduleStatus === 'horizon_insufficient' && (
          <div className="space-y-3">
            <p className="text-xs text-amber-700/90">
              {semanticLabels.scheduleStatusLabel}
              <button
                type="button"
                className="ml-2 rounded border border-line/60 px-2 py-0.5 text-[11px] text-muted hover:text-jericho-accent"
                onClick={() => {
                  if (onOpenToday) {
                    onOpenToday();
                    return;
                  }
                  try {
                    window.location.hash = '#/today';
                  } catch {
                    // ignore hash routing failures
                  }
                }}
              >
                Review in Today
              </button>
            </p>
            <HorizonResolutionPanel
              summary={semanticSummary}
              selectedKind={selectedPlanResolutionKind}
              onSelect={(kind) => setPlanResolutionKind?.({ cycleId: activeCycleId, kind })}
            />
          </div>
        )}
        {scheduleStatus === 'applied_review' && (
          <p className="text-xs text-muted/80">
            {semanticLabels.scheduleStatusLabel}
            <button
              type="button"
              className="ml-2 rounded border border-line/60 px-2 py-0.5 text-[11px] text-muted hover:text-jericho-accent"
              onClick={() => {
                if (onOpenToday) {
                  onOpenToday();
                  return;
                }
                try {
                  window.location.hash = '#/today';
                } catch {
                  // ignore hash routing failures
                }
              }}
            >
              Review in Today
            </button>
          </p>
        )}
        {scheduleStatus === 'active_schedule' && (
          <p className="text-xs text-muted/80">{semanticLabels.scheduleStatusLabel}</p>
        )}
        {scheduleStatus === 'error' && (
          <p className="text-xs text-red-600/80">Generation failed: {lastPlanError?.code || 'UNKNOWN_ERROR'}</p>
        )}
        {scheduleStatus === 'no_schedule' && (
          <p className="text-xs text-muted/80">{semanticLabels.scheduleStatusLabel}</p>
        )}
        {scheduleStatus === 'unknown' && lastPlanError?.code && (
          <p className="text-xs text-red-600/80">Generation failed: {lastPlanError?.code || 'UNKNOWN_ERROR'}</p>
        )}
      </div>

      <CycleManagementSection
        activeCycleId={hasValidActiveExecutionCycle ? activeCycleId : null}
        hasActiveMasterPlan={hasActiveMasterPlan}
        activeCycle={hasValidActiveExecutionCycle ? activeCycle : null}
        scheduleLifecycle={normalizedScheduleLifecycle || 'no_schedule'}
        onCompleteReassessment={handleCompleteCycleReassessment}
        onStartNewCycleRequest={() => {
          handleStartNewCycle();
        }}
        onArchiveCycle={() => {
          if (!hasValidActiveExecutionCycle || !activeCycleId) {
            return;
          }
          if (window.confirm('Archive the active Operating Cycle and move it to review mode?')) {
            store.endCycle?.(activeCycleId);
          }
        }}
        onResetCycle={handleResetActiveCycle}
        onDeleteCycle={() => {
          if (!hasValidActiveExecutionCycle || !activeCycleId) {
            return;
          }
          if (window.confirm('Delete the active Operating Cycle and clear the calendar? This cannot be undone.')) {
            store.deleteCycle?.(activeCycleId);
            try {
              window.location.hash = '#/structure';
            } catch {
              // ignore hash routing failures
            }
          }
        }}
      />

      <CycleTransitionModal
        open={isCycleTransitionModalOpen}
        onArchive={() => {
          store.startNewCycleWithDecision?.({ mode: 'archive' });
          setCycleTransitionModalOpen(false);
          try {
            window.location.hash = '#/structure';
          } catch {
            // ignore hash routing failures
          }
        }}
        onDelete={() => {
          store.startNewCycleWithDecision?.({ mode: 'delete' });
          setCycleTransitionModalOpen(false);
          try {
            window.location.hash = '#/structure';
          } catch {
            // ignore hash routing failures
          }
        }}
        onCancel={() => setCycleTransitionModalOpen(false)}
      />
    </div>
  );
}
