// Identity state types (JSDoc for editor support)
/**
 * @typedef {'Body' | 'Resources' | 'Creation' | 'Focus'} PracticeName
 */

/**
 * @typedef {{ name: PracticeName; minutes: number }} PracticeTarget
 */

/**
 * @typedef {{ dailyTargets: PracticeTarget[]; defaultMinutes?: number }} PatternLensConfig
 */

/**
 * @typedef {'steady'|'shifting'} Stability
 */

/**
 * @typedef {'contained'|'forming'|'elevated'|'off-track'} Drift
 */

/**
 * @typedef {'building'|'active'|'quiet'} Momentum
 */

/**
 * @typedef {'BODY' | 'RESOURCES' | 'FOCUS' | 'CREATION'} DomainKey
 */

/**
 * @typedef {{ id: string; practice: PracticeName; label: string; start: string; end: string; status: 'planned' | 'in_progress' | 'completed' | 'missed' | 'expired'; linkedAimId?: string; domain?: import('./domain').Domain; deliverableId?: string | null; criterionId?: string | null; lockedUntilDayKey?: string; requiredSystemBlock?: boolean; constraintTag?: 'CONSTRAINT' | 'INTENT' | 'ADVISORY' }} Block
 */

/**
 * @typedef {{ eventId: string; blockId: string; date: string; plannedMinutes: number; completedMinutes: number; completedAt: string; practice?: PracticeName; label?: string }} LedgerEntry
 */

/**
 * @typedef {import('./engine/todayAuthority').ExecutionEvent} ExecutionEvent
 */

/**
 * @typedef {{ name: PracticeName; load: 'light'|'moderate'|'heavy'; trend: 'rising'|'holding'|'falling' }} PracticeSummary
 */

/**
 * @typedef {{
 *   date: string;
 *   blocks: Block[];
 *   completionRate: number;
 *   driftSignal: Drift;
 *   loadByPractice: Record<PracticeName, number>;
 *   practices: PracticeSummary[];
 *   dominantPractice?: PracticeName | 'balanced';
 *   driftLabel?: 'contained' | 'elevated' | 'off-track';
 *   summaryLine?: string;
 *   overloadLabel?: 'normal' | 'overload';
 *   streakState?: 'hit' | 'miss' | 'partial';
 *   primaryObjectiveId?: string | null;
 * }} DaySummary
 */

/**
 * @typedef {{ weekStart: string; days: DaySummary[]; metrics?: any; summaryLine?: string }} WeekSummary
 */

/**
 * @typedef {{
 *   day: number;
 *   direction: string;
 *   stability: Stability;
 *   drift: Drift;
 *   momentum: Momentum;
 *   driftDetail?: any;
 *   driftLabel?: 'contained' | 'elevated' | 'off-track';
 *   driftHint?: string;
 * }} IdentityVector
 */

/**
 * @typedef {{ description: string; horizon: '30d' | '90d' | 'year' }} AimConfig
 */

/**
 * @typedef {{ routines: Record<PracticeName, string[]>; dailyTargets: PracticeTarget[]; defaultMinutes?: number }} PatternConfig
 */

/**
 * @typedef {{ streams: string[] }} FlowConfig
 */

/**
 * @typedef {{ aim: AimConfig; pattern: PatternConfig; flow: FlowConfig }} LensesConfig
 */

/**
 * @typedef {{
 *   id: string;
 *   status: 'active' | 'closed';
 *   startedAtDayKey: string;
 *   endedAtDayKey?: string;
 *   definiteGoal: { outcome: string; deadlineDayKey: string };
 *   goalContract?: import('./contracts/goalContract').GoalExecutionContract | null;
 *   goalGovernanceContract?: import('./contracts/goalContract').GoalGovernanceContract | null;
 *   scheduleLifecycle?: 'no_schedule' | 'draft_schedule_ready' | 'applied_review' | 'active_schedule' | 'reschedule_pending' | 'stale_draft_invalidated';
 *   scheduleReviewBlocks?: Array<{
 *     id: string;
 *     cycleId: string;
 *     goalId?: string | null;
 *     title?: string;
 *     startISO?: string;
 *     durationMinutes?: number;
 *     status?: string;
 *   }>;
 *   scheduleDraftHash?: string | null;
 *   scheduleActiveHash?: string | null;
 *   scheduleAppliedAtISO?: string | null;
 *   scheduleActivatedAtISO?: string | null;
 *   scheduleGeneratedAtISO?: string | null;
 *   generatedForStartDayKey?: string | null;
 *   validUntilDayKey?: string | null;
 *   activationRequestedAtISO?: string | null;
 *   executionStartDayKey?: string | null;
 *   temporalStatus?: 'fresh' | 'drifted' | 'stale' | 'rebase_required' | 'rebased';
 *   rebaseRequired?: boolean;
 *   pastDatedBlockCount?: number;
 *   scheduleDebtMinutes?: number;
 *   compressionDelta?: number;
 *   temporalReasonCodes?: string[];
 *   activationDelayAssessment?: {
 *     status?: 'not_required' | 'requires_user_investigation' | 'ready_to_rebase' | 'ready_for_backfill' | 'requires_regeneration' | 'blocked';
 *     appliedAtISO?: string | null;
 *     activationRequestedAtISO?: string | null;
 *     appliedStartDayKey?: string | null;
 *     requestedExecutionStartDayKey?: string | null;
 *     delayDays?: number;
 *     userDelayExplanation?: string | null;
 *     workHappenedDuringDelay?: 'none' | 'some' | 'most' | 'unknown';
 *     selectedResolution?: 'rebase' | 'backfill' | 'regenerate' | 'change_start_date' | null;
 *     pastDatedBlockCount?: number;
 *     scheduleDebtMinutes?: number;
 *     reasonCodes?: string[];
 *   };
 *   lastTemporalAudit?: {
 *     generatedAtISO?: string | null;
 *     generatedForStartDayKey?: string | null;
 *     validUntilDayKey?: string | null;
 *     activationRequestedAtISO?: string | null;
 *     executionStartDayKey?: string | null;
 *     temporalStatus?: string | null;
 *     rebaseRequired?: boolean;
 *     pastDatedBlockCount?: number;
 *     scheduleDebtMinutes?: number;
 *     compressionDelta?: number;
 *     daysSinceGenerated?: number;
 *     temporalReasonCodes?: string[];
 *   };
 *   selectedPlanResolutionKind?: string | null;
 *   lastResolvedPlanSummary?: {
 *     planStatus?: string | null;
 *     requiredBlockCount?: number;
 *     scheduledBlockCount?: number;
 *     unscheduledBlockCount?: number;
 *     acceptedBlockCount?: number;
 *     horizonDayCount?: number;
 *     candidateResolutionKinds?: string[];
 *     recommendations?: Array<any>;
 *   } | null;
 *   deferredScheduleBlocks?: Array<{
 *     id: string;
 *     title?: string;
 *     actionId?: string | null;
 *     deferredReason?: string | null;
 *     targetDayKey?: string | null;
 *     hardGateFloorISO?: string | null;
 *   }>;
 *   aim?: { text?: string };
 *   pattern: { dailyTargets: PracticeTarget[] };
 *   flow?: FlowConfig;
 *   planDraft?: PlanDraft;
 *   calibration?: PlanCalibration;
 *   goalEquation?: GoalEquationInput;
 *   goalPlan?: { planProof: GoalPlanProof; scheduleBlocks: ColdPlanScheduleBlock[]; generatedAtISO: string };
 *   planProof?: PlanProof;
 *   autoAsanaPlan?: AutoAsanaPlan;
 *   policyState?: {
 *     currentPolicyId?: string;
 *     policySetAtDayKey?: string;
 *     policyAgeDays?: number;
 *     priorSignalsSnapshot?: any;
 *   };
 *   lastPolicySelectionDecision?: any;
 *   lastPlanAppliedAtISO?: string | null;
 *   goalAdmission?: { status: AdmissionStatus; reasonCodes: AdmissionReasonCode[]; admittedAtISO?: string };
 *   contractFailure?: {
 *     state:
 *       | 'ON_TRACK'
 *       | 'RECOVERABLE_DRIFT'
 *       | 'OVERLOADED_CURRENT_CONTRACT'
 *       | 'INFEASIBLE_CURRENT_CONTRACT'
 *       | 'DEADLINE_FAILED_RENEGOTIATION_REQUIRED';
 *     reasons: string[];
 *     renegotiationRequired: boolean;
 *     details?: {
 *       deadlineDayKey?: string | null;
 *       deadlinePassed?: boolean;
 *       remainingRequiredWork?: number;
 *       requiredWeeklyThroughput?: number | null;
 *       capacityWeekly?: number | null;
 *     };
 *     updatedAtISO?: string;
 *   };
 *   recoveryContract?: {
 *     state: 'RECOVERY_WITHIN_CONTRACT' | 'RECOVERY_RENEGOTIATION_REQUIRED';
 *     reasons: string[];
 *     metrics?: {
 *       missedExpiredBurden?: number;
 *       unscheduledRequiredBurden?: number;
 *       remainingRequiredBurden?: number;
 *       availableRecoverySlack?: number;
 *       recoverableWithinCurrentContract?: boolean;
 *       overloadDetected?: boolean;
 *       overloadReasonCodes?: string[];
 *       requiredWeeklyThroughputAfterRecovery?: number | null;
 *       requiredBlocksPerDayAfterRecovery?: number | null;
 *       requiredMinutesPerDayAfterRecovery?: number | null;
 *       minutesCapPerDay?: number | null;
 *       projectedSlackAfterRecovery?: number | null;
 *       overCapacityAmount?: number | null;
 *     };
 *     renegotiationRequired: boolean;
 *     options?: Array<{ type: string; summary: string; delta?: number | null; unit?: string | null; reasonCode?: string }>;
 *     updatedAtISO?: string;
 *   };
 *   lastRenegotiationApplied?: {
 *     id: string;
 *     atISO: string;
 *     cycleId: string;
 *     goalId?: string | null;
 *     optionType: string;
 *     optionSummary?: string;
 *     optionDelta?: number | null;
 *     optionUnit?: string | null;
 *     status: 'APPLIED' | 'UNSUPPORTED';
 *     priorContract?: Record<string, any>;
 *     appliedContractChanges?: Record<string, any>;
 *     unsupportedReason?: string | null;
 *   };
 *   renegotiationHistory?: Array<{
 *     id: string;
 *     atISO: string;
 *     cycleId: string;
 *     goalId?: string | null;
 *     optionType: string;
 *     status: 'APPLIED' | 'UNSUPPORTED';
 *     priorContract?: Record<string, any>;
 *     appliedContractChanges?: Record<string, any>;
 *     unsupportedReason?: string | null;
 *   }>;
 * }} Cycle
 */

/**
 * @typedef {{ minutesByPractice: Record<string, number>; preferredSlot: 'morning' | 'afternoon' | 'evening' }} ObjectiveTemplate
 */

/**
 * @typedef {{ headline?: string; actionLine?: string }} StabilityState
 */

/**
 * @typedef {{ id: string; practice: PracticeName; startMs: number; durationMs: number; weekdays: string[] }} RecurringPattern
 */

/**
 * @typedef {{
 *   id: string;
 *   deliverableId: string;
 *   text: string;
 *   isDone: boolean;
 *   doneAtDayKey?: string | null;
 *   doneAtISO?: string | null;
 * }} Criterion
 */

/**
 * @typedef {{
 *   id: string;
 *   outputType?: 'deliverable' | 'milestone';
 *   cycleId: string;
 *   domain: DomainKey;
 *   title: string;
 *   requiredBlocks?: number;
 *   weight: number;
 *   dueDayKey?: string | null;
 *   criteria: Criterion[];
 *   createdAtISO: string;
 *   updatedAtISO: string;
 * }} Deliverable
 */

/**
 * @typedef {{
 *   cycleId: string;
 *   deliverables: Deliverable[];
 *   suggestionLinks?: Record<string, { deliverableId?: string | null; criterionId?: string | null }>;
 *   lastUpdatedAtISO: string;
 * }} DeliverableWorkspace
 */

/**
 * @typedef {'BODY'|'SKILL'|'OUTPUT'} GoalFamily
 */

/**
 * @typedef {'LOSE_WEIGHT_LBS'|'PRACTICE_HOURS_TOTAL'|'PUBLISH_COUNT'} GoalObjective
 */

/**
 * @typedef {'HARD'|'SOFT'} GoalDeadlineType
 */

/**
 * @typedef {{
 *   label?: string;
 *   family: GoalFamily;
 *   mechanismClass: 'THROUGHPUT'|'PIPELINE'|'PROJECT_GRAPH';
 *   objective: GoalObjective;
 *   objectiveValue: number;
 *   deadlineDayKey: string;
 *   deadlineType: GoalDeadlineType;
 *   workingFullTime: boolean;
 *   workDaysPerWeek: 3|4|5|6|7;
 *   workStartWindow: 'EARLY'|'MID'|'LATE'|'VARIABLE';
 *   workEndWindow: 'EARLY'|'MID'|'LATE'|'VARIABLE';
 *   minSleepHours: 6|7|8|9;
 *   sleepFixedWindow: boolean;
 *   sleepStartWindow: 'EARLY'|'MID'|'LATE'|'VARIABLE';
 *   sleepEndWindow: 'EARLY'|'MID'|'LATE'|'VARIABLE';
 *   hasWeeklyRestDay: boolean;
 *   restDay: 0|1|2|3|4|5|6;
 *   blackoutBlocks: string[];
 *   hasGymAccess: boolean;
 *   canCookMostDays: boolean;
 *   hasTransportLimitation: boolean;
 *   currentlyInjured: boolean;
 *   beginnerLevel: boolean;
 *   maxDailyWorkMinutes: 30|60|90|120|180;
 *   noEveningWork: boolean;
 *   noMorningWork: boolean;
 *   weekendsAllowed: boolean;
 *   travelThisPeriod: 'NONE'|'1-3'|'4-7'|'8+';
 *   acceptsDailyMinimum: boolean;
 *   acceptsFixedSchedule: boolean;
 *   acceptsNoRenegotiation7d: boolean;
 *   acceptsAutomaticCatchUp: boolean;
 * }} GoalEquationInput
 */

/**
 * @typedef {{
 *   verdict: 'FEASIBLE'|'FEASIBLE_WITH_CHANGES'|'INFEASIBLE';
 *   requiredMinutesPerDay: number;
 *   workableDays: number;
 *   scheduledBlocks: number;
 *   weeklyMinutes: number;
 *   constraintsSummary: string[];
 *   failureConditions: string[];
 *   changeList?: string[];
 *   status: 'SUBMITTED'|'DRAFT';
 * }} GoalPlanProof
 */

/**
 * @typedef {{
 *   workableDaysRemaining: number;
 *   totalRequiredUnits: number;
 *   requiredPacePerDay: number;
 *   maxPerDay: number;
 *   maxPerWeek: number;
 *   slackUnits: number;
 *   slackRatio: number;
 *   intensityRatio: number;
 *   feasibilityStatus: 'FEASIBLE'|'INFEASIBLE';
 *   feasibilityReasons: string[];
 * }} PlanProof
 */

/**
 * @typedef {{
 *   status: 'INFEASIBLE'|'UNSCHEDULABLE'|'ELIGIBLE'|'INELIGIBLE'|'NO_EVIDENCE';
 *   value: number | null;
 *   capApplied: boolean;
 *   reasons: string[];
 *   proof: { inputs: any; derived: any; policyVersion: string };
 * }} ProbabilityReport
 */

/**
 * @typedef {{
 *   graph: { tasks: any[]; dependencies: any[]; milestones: any[] };
 *   horizon: { startDayKey: string; endDayKey: string; daysCount: number };
 *   horizonBlocks: any[];
 *   conflicts: { kind: string; detail: string; candidateResolutions?: string[] }[];
 *   recoveryOptions: { kind: string; detail: string }[];
 *   audit: { generatedAtISO: string; goalId: string; cycleId: string; policyVersion: string };
 * }} AutoAsanaPlan
 */

/**
 * @typedef {{
 *   id: string;
 *   dayKey: string;
 *   startISO: string;
 *   durationMinutes: number;
 *   kind: string;
 *   title: string;
 *   locked: boolean;
 * }} ColdPlanScheduleBlock
 */

/**
 * @typedef {{ type: string; timestamp: string; beforeSummary?: string; afterSummary?: string }} SessionChange
 */

/**
 * @typedef {Object} NextSuggestion
 * @property {'resume'|'start_planned'|'repair'} type
 * @property {string} [blockId]
 * @property {PracticeName} practice
 * @property {string} startISO
 * @property {string} endISO
 * @property {string} reason
 * @property {string} [goalId]
 */

/**
 * @typedef {Object} GoalDirective
 * @property {'execute'|'schedule'} type
 * @property {string} domain
 * @property {number} durationMinutes
 * @property {string} [blockId]
 * @property {string[]} [rationale]
 * @property {string} doneWhen
 * @property {string} goalId
 */

/**
 * @typedef {{
 *   goalId: string;
 *   goalText: string;
 *   horizonDays: number;
 *   domains: PracticeName[];
 *   narrative?: string;
 *   startDayKey: string;
 *   endDayKey: string;
 *   successDefinition?: string;
 * }} GoalExecutionContractV0
 */

/**
 * @typedef {'ADMITTED'|'REJECTED_NO_MECHANISM'|'REJECTED_MISSING_CONSTRAINTS'|'REJECTED_INFEASIBLE'} AdmissionStatus
 */

/**
 * @typedef {'MISSING_GOAL_FAMILY'|'MISSING_NUMERIC_TARGET'|'MISSING_DEADLINE'|'MISSING_MECHANISM_CLASS'|'MISSING_CONSTRAINTS'|'DEADLINE_PASSED'|'NO_WORKABLE_DAYS'|'MAX_PER_DAY_ZERO'|'REQUIRED_PACE_EXCEEDS_MAX_PER_DAY'|'REQUIRED_PACE_EXCEEDS_MAX_PER_WEEK'|'MIN_PIPELINE_YEARS_EXCEED_TIME_AVAILABLE'|'UNSCHEDULABLE_FORBIDDEN_WINDOWS'|'UNSCHEDULABLE_OVERLAP_EXISTING_BLOCKS'|'UNSCHEDULABLE_CAPACITY_CONSUMED'|'UNSCHEDULABLE_HORIZON_TOO_SMALL'} AdmissionReasonCode
 */

/**
 * @typedef {{
 *   aspirationId: string;
 *   cycleId: string;
 *   createdAtISO: string;
 *   draft: GoalEquationInput;
 *   admissionStatus: AdmissionStatus;
 *   reasonCodes: AdmissionReasonCode[];
 * }} Aspiration
 */

/**
 * @typedef {{
 *   id: string;
 *   goalId: string;
 *   status: 'draft' | 'calibrated';
 *   createdAtISO: string;
 *   blocksPerWeek: number;
 *   totalMinutesPerWeek: number;
 *   primaryDomain: PracticeName;
 *   archetype: string;
 *   templates: Array<{ title: string; domain: PracticeName; durationMinutes: number; frequency: string; reason: string }>;
 *   successDefinition?: string;
 *   horizonDays: number;
 *   daysPerWeek: number;
 *   qualityPolicyId?: string;
 *   autoPolicySelection?: boolean;
 *   enableHistoryPolicySelection?: boolean;
 *   historyWindowCycles?: number;
 *   historyInfluenceStrength?: 'light'|'standard'|'strong';
 *   minPolicyHoldDays?: number;
 *   enableQualityOptimizer?: boolean;
 *   optimizerMaxIterations?: number;
 *   optimizerMaxCandidates?: number;
 *   enableMilestonePacing?: boolean;
 *   pacingCadenceMode?: 'weekly'|'biweekly'|'adaptive';
 *   actions?: Array<{ id: string; estimateMin?: number; category?: string; dependencies?: string[] }>;
 *   milestones?: Array<{
 *     milestoneId: string;
 *     windowStartDayKey: string;
 *     windowEndDayKey: string;
 *     checkpointActionIds?: string[];
 *     actionIds?: string[];
 *   }>;
 *   executionHorizonDays?: number;
 *   maxScheduledMinutesPerDay?: number;
 *   maxScheduledMinutesPerWeek?: number;
 * }} PlanDraft
 */

/**
 * @typedef {{
 *   confidence: number;
 *   daysPerWeek?: number;
 *   assumptions: string[];
 *   missingInfo: string[];
 * }} PlanCalibration
 */

/**
 * @typedef {{
 *   id: string;
 *   goalId: string;
 *   dayKey: string;
 *   startISO: string;
 *   endISO: string;
 *   domain: PracticeName;
 *   durationMinutes: number;
 *   frequency: string;
 *   title: string;
 *   whyThis: string;
 *   assumption?: string;
 *   status: 'suggested' | 'accepted' | 'rejected' | 'ignored' | 'dismissed';
 *   rejectedReason?: string;
 *   deliverableId?: string | null;
 *   criterionId?: string | null;
 *   createdAtISO: string;
 *   acceptedAtISO?: string;
 * }} SuggestedBlock
 */

/**
 * @typedef {{
 *   id: string;
 *   type:
 *     | 'suggested_block_created'
 *     | 'suggested_block_accepted'
 *     | 'suggested_block_rejected'
 *     | 'suggestions_recomputed'
 *     | 'suggestion_rejected'
 *     | 'suggestion_ignored'
 *     | 'suggestion_dismissed'
 *     | 'suggestions_generated';
 *   proposalId?: string;
 *   suggestionId?: string;
 *   goalId?: string;
 *   reason?: string;
 *   prevSuggestionIds?: string[];
 *   nextSuggestionIds?: string[];
 *   dayKey?: string;
 *   contractId?: string;
 *   planId?: string;
 *   atISO: string;
 * }} SuggestionEvent
 */

/**
 * @typedef {{
 *   id: string;
 *   type: 'calibration_days_per_week_set';
 *   daysPerWeek: number;
 *   dayKey: string;
 *   contractId?: string;
 *   planId?: string;
 *   atISO: string;
 * }} CalibrationEvent
 */

/**
 * @typedef {{
 *   totalBlocks: number;
 *   totalMinutes: number;
 *   primaryDomain?: PracticeName;
 *   horizonDays?: number;
 *   qualityPolicyIdRequested?: string;
 *   qualityPolicyIdUsed?: string;
 *   policySelectionDecision?: any;
 *   policySelectionReasonCodes?: string[];
 *   policySelectionSignalsSnapshot?: any;
 *   historyProfileSnapshotUsed?: any;
 *   historyReasonCodes?: string[];
 *   qualityScoreBaseline?: number;
 *   qualityScoreBaselineByComponent?: Record<string, number>;
 *   qualityScoreOptimized?: number;
 *   qualityScoreOptimizedByComponent?: Record<string, number>;
 *   qualityImprovementDelta?: number;
 *   optimizerRejectedCandidatesSummary?: Record<string, number>;
 *   pacingCadenceModeUsed?: string;
 *   pacingInjectedCheckpointCount?: number;
 *   pacingInjectedByMilestone?: Record<string, { count: number; ids: string[] }>;
 *   pacingSegmentCount?: number;
 *   pacingRequiredCriticalMinutes?: number;
 *   pacingAvailableWindowMinutes?: number;
 *   pacingSlackRatio?: number;
 *   pacingInfeasibleMilestonesCount?: number;
 *   pacingByMilestone?: Record<string, any>;
 *   pacingAnchoringMissCount?: number;
 *   milestonePlacedRatioAvg?: number;
 * }} PlanPreview
 */

/**
 * @typedef {{
 *   windowDays: number;
 *   totalRejections: number;
 *   byReason: Record<string, number>;
 *   signals: {
 *     capacityPressure: number;
 *     durationMismatch: number;
 *     timingMismatch: number;
 *     energyMismatch: number;
 *     relevanceMismatch: number;
 *     prereqDebt: number;
 *   };
 * }} CorrectionSignals
 */

/**
 * @typedef {{
 *   vector: IdentityVector;
 *   lenses: LensesConfig;
 *   activeCycleId?: string | null;
 *   cyclesById?: Record<string, Cycle>;
 *   history?: { cycles: Cycle[] };
 *   today: DaySummary;
 *   currentWeek: WeekSummary;
 *   cycle: DaySummary[];
 *   viewDate?: string;
 *   templates?: { objectives: Record<string, ObjectiveTemplate> };
 *   lastAdaptedDate?: string;
 *   stability?: StabilityState;
 *   meta?: {
 *     version?: string;
 *     onboardingComplete?: boolean;
 *     lastActiveDate?: string;
 *     scenarioLabel?: string;
 *     demoScenarioEnabled?: boolean;
 *     showHints?: boolean;
 *   };
 *   recurringPatterns?: RecurringPattern[];
 *   lastSessionChange?: SessionChange;
 *   suggestionHistory?: {
 *     dayKey: string;
 *     count: number;
 *     lastSuggestedAtISO?: string | null;
 *     lastSuggestedAtISOByGoal?: Record<string, string | null>;
 *     dailyCountByGoal?: Record<string, Record<string, number>>;
 *     denials?: Array<{ goalId: string; reasons: string[]; atISO: string }>;
 *   };
 *   suggestionEligibility?: Record<string, { allowed: boolean; reasons: string[]; contractId?: string | null }>;
 *   directiveEligibilityByGoal: Record<string, { allowed: boolean; reasons: string[]; contractId?: string | null }>;
 *   goalDirective: GoalDirective | null;
 *   goalExecutionContract?: GoalExecutionContractV0 | null;
 *   planDraft?: PlanDraft | null;
 *   planCalibration?: PlanCalibration | null;
 *   planPreview?: PlanPreview | null;
 *   correctionSignals?: CorrectionSignals | null;
 *   suggestedBlocks?: SuggestedBlock[];
 *   suggestionEvents?: SuggestionEvent[];
 *   deliverablesByCycleId?: Record<string, DeliverableWorkspace>;
 *   calibrationEvents?: CalibrationEvent[];
 *   activeGoalId?: string | null;
 *   goalWorkById?: Record<string, Array<{
 *     workItemId: string;
 *     title?: string;
 *     blocksRemaining: number;
 *     mustFinishByISO?: string;
 *     category: 'Body' | 'Resources' | 'Creation' | 'Focus';
 *     focusMode: 'deep' | 'shallow';
 *     energyCost: 'low' | 'medium' | 'high';
 *     producesOutput: boolean;
 *     unblockType?: 'resource' | 'dependency' | null;
 *     dependencies?: string[];
 *   }>>;
 *   feasibilityByGoal?: Record<string, {
 *     status: 'FEASIBLE' | 'REQUIRED' | 'INFEASIBLE';
 *     reasons: string[];
 *     remainingBlocksTotal: number;
 *     workableDaysRemaining: number;
 *     requiredBlocksPerDay: number | null;
 *     requiredBlocksToday: number | null;
 *     completedBlocksToday: number;
 *     delta?: { blocksShort?: number; extraBlocksPerDayNeeded?: number };
 *   }>;
 *   probabilityStatusByGoal?: Record<string, {
 *     status: 'disabled' | 'insufficient_evidence' | 'computed';
 *     reasons: string[];
 *     contractId?: string | null;
 *     requiredEvents?: number;
 *     evidenceSummary?: { totalEvents: number; completedCount: number; daysCovered: number };
 *   }>;
 *   probabilityByGoal?: Record<string, {
 *     value: number | null;
 *     status: 'INFEASIBLE'|'UNSCHEDULABLE'|'ELIGIBLE'|'INELIGIBLE'|'NO_EVIDENCE';
 *     capApplied?: boolean;
 *     reasons: string[];
 *     requiredEvents?: number | null;
 *     evidenceSummary?: { totalEvents: number; completedCount: number; daysCovered: number };
 *     proof?: { inputs: any; derived: any; policyVersion: string };
 *     scoringSummary?: {
 *       mu: number;
 *       sigma: number;
 *       K: number;
 *       D: number;
 *       remainingBlocksTotal: number;
 *       requiredBlocksPerDay: number | null;
 *       expectedTotal: number;
 *     };
 *   }>;
 *   goalPolicyByGoalId?: Record<string, {
 *     goalId: string | null;
 *     macroBoundaryPolicy: {
 *       required: string[];
 *       bounded: string[];
 *       prohibited: string[];
 *       assumptionsNeedingConfirmation: string[];
 *     };
 *     intakeReadiness: {
 *       state: 'fully_admitted' | 'assumption_marked_draft' | 'intake_blocked';
 *       isReadyForPlanning: boolean;
 *       reasonCodes: string[];
 *       assumptions: string[];
 *     };
 *     planQuality: {
 *       state: 'policy_clean' | 'policy_degraded' | 'policy_blocked';
 *       reasonCodes: string[];
 *       endpointClarity: 'clear' | 'ambiguous' | 'missing';
 *       startingPointHonesty: 'explicit' | 'assumed' | 'unknown';
 *       scopeDiscipline: 'clean' | 'degraded' | 'inflated';
 *       blockMeasurability: 'clear' | 'weak';
 *       feasibilityHonesty: 'clear' | 'degraded' | 'blocked';
 *     };
 *     posTrust: { state: 'trusted' | 'provisional' | 'withheld'; reasonCodes: string[]; explanation: string };
 *     scopeClassification: {
 *       required: string[];
 *       recommended: string[];
 *       optional: string[];
 *       blockedByUnconfirmedContext: string[];
 *       assumedBaselineSupporting: string[];
 *     };
 *     evaluatedAtISO: string;
 *   }>;
 *   progressCreditByGoal?: Record<string, {
 *     creditedUnits: number;
 *     activityUnits: number;
 *     completedUnitsTotal: number;
 *   }>;
 *   cycleDynamicsByCycleId?: Record<string, {
 *     generatedAtISO: string;
 *     cycleId: string | null;
 *     goalId: string | null;
 *     totals: {
 *       totalBlocks: number;
 *       completed: number;
 *       inProgress: number;
 *       planned: number;
 *       missed: number;
 *       expired: number;
 *       dueToday: number;
 *       overdueUnfinished: number;
 *     };
 *     recommendedTransitions: Array<{
 *       blockId: string;
 *       fromStatus: string;
 *       toStatus: 'MISSED' | 'EXPIRED';
 *       reasonCode: 'OVERDUE_UNFINISHED' | 'MISSED_GRACE_ELAPSED';
 *       effectiveAtISO: string;
 *     }>;
 *   }>;
 *   goalAdmissionByGoal?: Record<string, { status: AdmissionStatus; reasonCodes: AdmissionReasonCode[]; admittedAtISO?: string }>;
 *   aspirationsByCycleId?: Record<string, Aspiration[]>;
 *   lastPlanError?: { code: string; reason: string; cycleId?: string; goalId?: string };
 *   planEvents?: Array<{ id: string; type: string; cycleId?: string; goalId?: string; atISO?: string; policyVersion?: string }>;
 *   profileLearning?: {
 *     cycleCount: number;
 *     totalCompletionCount: number;
 *     averageCompletionRate: number;
 *   };
 *   nextSuggestion?: NextSuggestion | null;
 *   ledger?: LedgerEntry[];
 *   executionEvents?: ExecutionEvent[];
 *   deliverableDemands?: Record<string, number>;
 *   deliverableUrgencyRanking?: Record<string, {
 *     id: string;
 *     name: string;
 *     urgencyBand: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
 *     daysToDeadline: number;
 *     chainDepth: number;
 *     blockedItems: string[];
 *     demandMinutes: number;
 *     owningInitiativeId: string;
 *     owningProjectId: string;
 *     rank: number;
 *   }>;
 * }} IdentityState
 */

export {};
