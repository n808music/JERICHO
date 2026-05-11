import React, { useState, useCallback, useEffect, useRef } from 'react';
import type {
  StructuredPlanningIntake,
  FormulaPathway,
  GoalClassification,
  LegalFoundation,
  CapitalAcquisitionAssets,
  ExistingAudience,
} from '../../domain/goal/StructuredPlanningIntake';
import type { PrePlanFeasibilityResult, IntakeFeasibilityReport } from '../../domain/goal/prePlanFeasibility';
import { evaluatePrePlanFeasibility, prePlanFeasibility } from '../../domain/goal/prePlanFeasibility';
import { classifyGoalPlanningTier, type GoalPlanningTier } from '../../domain/goal/planningTierClassifier';
import {
  inferGoalArchitecture,
  type GoalArchitectureInference,
  type InferredLane,
} from '../../domain/goal/goalArchitectureClassifier.ts';
import { deriveMasterPlanSemanticModel } from '../../domain/masterPlan/masterPlanSemanticModel.js';
import WorkWindowsEditor from '../../components/zion/WorkWindowsEditor';

// ────────────────────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────────────────────

export interface Screen1Data {
  goalDescription: string;
  goalType: 'physical_product' | 'digital_product' | 'service' | 'personal_development' | 'other' | null;
  isConsumable: boolean | null;
  formulaPathway: 'custom_development' | 'base_modification' | 'white_label' | 'undecided' | null;
  targetCategory: 'food_product' | 'dietary_supplement' | 'functional_food' | null;
  distributionChannel: 'direct_to_consumer' | 'marketplace' | 'retail' | 'wholesale' | null;
  intakeRoutingView?: 'goal_only' | 'simple_type' | 'master_plan_lanes';
  laneMapAccepted?: boolean;
  adjustLanesMode?: boolean;
  selectedLaneDomains?: string[];
  primaryLaneOverride?: string | null;
}

export interface AudienceEntry {
  platform: string;
  size: number | '';
  relationship: string;
}

export interface Screen2Data {
  startDayKey: string | null;
  deadlineType: 'specific' | 'as_fast_as_possible' | null;
  deadline: string | null;
  weeklyHoursAvailable: number | '';
  executionContext: 'full_time' | 'part_time' | null;
  existingRelationships: string[];
  blackoutPeriods: { start: string; end: string }[];
}

export interface Screen3Data {
  capitalAvailable: number | '';
  capitalAcquisitionRequired: boolean;
  audienceEntries: AudienceEntry[];
  existingRevenue: boolean | null;
  capitalCommitmentConfidence: 'confirmed' | 'probable' | 'uncertain' | null;
  stopCondition: number | '';
}

export interface Screen4Data {
  legalEntityExists: 'yes' | 'no' | 'not_sure' | null;
  entityType: string | null;
  entityState: string | null;
  entityPurpose: string | null;
  entityForThisGoal: boolean | null;
  locationState: string | null;
  industryExperience: 'yes' | 'adjacent' | 'no' | null;
}

export interface IntakeProgressState {
  currentScreen: 1 | 2 | 3 | 4 | 5;
  screen1: Screen1Data | null;
  screen2: Screen2Data | null;
  screen3: Screen3Data | null;
  screen4: Screen4Data | null;
  feasibilityResult: PrePlanFeasibilityResult | null;
  intakeFeasibilityReport: IntakeFeasibilityReport | null;
  selectedPivot: string | null;
  immutabilityAcknowledged: boolean;
  workWindows: Record<string, Array<{ start: string; end: string }>>;
}

export interface GoalAdmissionFlowProps {
  onGeneratePlan: (intake: StructuredPlanningIntake) => void;
  onAspire: () => void;
  savedState?: IntakeProgressState | null;
  onStateChange?: (state: IntakeProgressState) => void;
  appTimeISO?: string;
  onPlanningTierRouted?: (payload: {
    planningTier: GoalPlanningTier;
    goalDescription: string;
    screen1: Screen1Data;
    goalArchitecture: GoalArchitectureInference;
  }) => void;
}

// ────────────────────────────────────────────────────────────────────────────
// Constants
// ────────────────────────────────────────────────────────────────────────────

const SCREEN_LABELS = ['Your goal', 'Timeline', 'Capital', 'Assets', 'Review'] as const;
const EMPTY_WORK_WINDOWS = { mon: [], tue: [], wed: [], thu: [], fri: [], sat: [], sun: [] } as const;

const US_STATES = [
  'AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA',
  'KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ',
  'NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT',
  'VA','WA','WV','WI','WY',
];

const RELATIONSHIP_OPTIONS = [
  { id: 'manufacturer', label: 'Manufacturer or supplier contact' },
  { id: 'regulatory', label: 'Regulatory or compliance consultant' },
  { id: 'packaging', label: 'Packaging supplier' },
  { id: 'distributor', label: 'Distributor or retailer contact' },
  { id: 'none', label: 'None of the above — starting from scratch' },
];

const AUDIENCE_PLATFORMS = ['Instagram', 'TikTok', 'YouTube', 'Spotify', 'Email list', 'Twitter/X', 'Other'];

const AUDIENCE_RELATIONSHIPS = [
  { id: 'creative_work', label: 'They follow my creative work (music, art, content)' },
  { id: 'business_expertise', label: 'They follow my business or expertise' },
  { id: 'existing_customers', label: 'They are existing customers' },
  { id: 'other', label: 'Other' },
];

// Template intake for the Screen 3 framing block (white-label, zero capital)
const FRAMING_TEMPLATE: StructuredPlanningIntake = {
  goalClassification: 'regulated_physical_consumable',
  startDayKey: null,
  formulaPathway: 'white_label',
  capitalAvailable: 0,
  capitalAcquisitionRequired: true,
  executionContext: 'full_time',
  weeklyHoursAvailable: 40,
  workWindows: null,
  hardDeadline: null,
  existingDomainRelationships: [],
  blackoutPeriods: [],
  stopCondition: null,
  capitalCommitmentConfidence: null,
  targetCategory: 'food_product',
  distributionChannel: 'direct_to_consumer',
  capitalAcquisitionAssets: {
    existingAudience: { spotifyListeners: 25000, instagramFollowers: 0, audienceRelationship: null, influencerNetwork: false, entrepreneurNetwork: false },
    existingRevenue: null,
  },
};

// ────────────────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────────────────

function deriveGoalClassification(s1: Screen1Data): GoalClassification {
  if (s1.goalType === 'physical_product') {
    return s1.isConsumable ? 'regulated_physical_consumable' : 'physical_product';
  }
  if (s1.goalType === 'digital_product') return 'digital_product';
  if (s1.goalType === 'service') return 'service';
  return 'other';
}

export function assembleIntake(
  s1: Screen1Data,
  s2: Screen2Data,
  s3: Screen3Data,
  s4: Screen4Data,
): StructuredPlanningIntake {
  const goalClassification = deriveGoalClassification(s1);

  let formulaPathway: FormulaPathway | null = null;
  if (s1.formulaPathway && s1.formulaPathway !== 'undecided') {
    formulaPathway = s1.formulaPathway as FormulaPathway;
  }

  const rawCapital = s3.capitalAvailable === '' ? 0 : Number(s3.capitalAvailable);
  const capitalAcquisitionRequired = s3.capitalAcquisitionRequired || rawCapital < 5000;

  let capitalAcquisitionAssets: CapitalAcquisitionAssets | null = null;
  if (capitalAcquisitionRequired && s3.audienceEntries.length > 0) {
    const spotifyEntry = s3.audienceEntries.find((e) => e.platform === 'Spotify');
    const instagramEntry = s3.audienceEntries.find((e) => e.platform === 'Instagram');
    const existingAudience: ExistingAudience = {
      spotifyListeners: spotifyEntry && spotifyEntry.size !== '' ? Number(spotifyEntry.size) : null,
      instagramFollowers: instagramEntry && instagramEntry.size !== '' ? Number(instagramEntry.size) : null,
      audienceRelationship: s3.audienceEntries[0]?.relationship || null,
      influencerNetwork: s3.audienceEntries.some((e) => e.relationship === 'creative_work'),
      entrepreneurNetwork: s3.audienceEntries.some((e) => e.relationship === 'business_expertise'),
    };
    capitalAcquisitionAssets = {
      existingAudience,
      existingRevenue: s3.existingRevenue !== null ? { projectManagementCompany: s3.existingRevenue } : null,
    };
  }

  let legalFoundation: LegalFoundation | null = null;
  if (s4.legalEntityExists === 'yes') {
    legalFoundation = {
      existingEntity: true,
      existingEntityType: s4.entityType,
      existingEntityState: s4.entityState,
      existingEntityPurpose: s4.entityPurpose,
      gumEntityExists: s4.entityForThisGoal === true,
    };
  } else if (s4.legalEntityExists === 'no') {
    legalFoundation = {
      existingEntity: false,
      existingEntityType: null,
      existingEntityState: null,
      existingEntityPurpose: null,
      gumEntityExists: false,
    };
  }

  return {
    goalDescription: s1.goalDescription,
    goalClassification,
    startDayKey: s2.startDayKey,
    formulaPathway,
    hardDeadline: s2.deadlineType === 'specific' ? s2.deadline : null,
    weeklyHoursAvailable: s2.weeklyHoursAvailable === '' ? null : Number(s2.weeklyHoursAvailable),
    executionContext: s2.executionContext,
    workWindows: null,
    existingDomainRelationships: s2.existingRelationships,
    blackoutPeriods: s2.blackoutPeriods,
    capitalAvailable: rawCapital,
    capitalAcquisitionRequired,
    capitalAcquisitionAssets,
    capitalCommitmentConfidence: s3.capitalCommitmentConfidence,
    stopCondition: s3.stopCondition === '' ? null : s3.stopCondition ? Number(s3.stopCondition) : null,
    legalFoundation,
    location: s4.locationState ? { state: s4.locationState } : null,
    industryExperience: s4.industryExperience,
    targetCategory: s1.targetCategory,
    distributionChannel: s1.distributionChannel,
    employmentStatus: s2.executionContext === 'full_time' ? 'full_time_focus' : 'part_time_focus',
  };
}

type ValidationError = { field: string; message: string } | null;

function hasAnyWorkWindow(workWindows: Record<string, Array<{ start: string; end: string }>> | null | undefined) {
  return Object.values(workWindows || {}).some((rows) =>
    Array.isArray(rows) && rows.some((row) => String(row?.start || '') < String(row?.end || ''))
  );
}

function buildLaneOverrides(screen1: Screen1Data, architecture: GoalArchitectureInference | null): InferredLane[] {
  if (!architecture) {
    return [];
  }
  const allowedDomains = new Set(
    Array.isArray(screen1.selectedLaneDomains) && screen1.selectedLaneDomains.length > 0
      ? screen1.selectedLaneDomains
      : architecture.laneComposition.map((lane) => lane.domain)
  );
  return architecture.laneComposition.filter((lane) => allowedDomains.has(lane.domain));
}

function deriveScreen1RoutingView(
  screen1: Screen1Data,
  planningTier: GoalPlanningTier | null,
  architecture: GoalArchitectureInference | null
): 'goal_only' | 'simple_type' | 'master_plan_lanes' {
  const hasGoalText = String(screen1.goalDescription || '').trim().length > 0;
  if (screen1.intakeRoutingView === 'simple_type') {
    return 'simple_type';
  }
  if (screen1.intakeRoutingView === 'master_plan_lanes') {
    return 'master_plan_lanes';
  }
  if (planningTier === 'master_plan' && architecture) {
    return 'master_plan_lanes';
  }
  if (screen1.goalType) {
    return 'simple_type';
  }
  if (hasGoalText) {
    return 'simple_type';
  }
  return 'goal_only';
}

function validateScreen1(
  d: Screen1Data,
  planningTier: GoalPlanningTier | null,
  architecture: GoalArchitectureInference | null
): ValidationError {
  if (!d.goalDescription || d.goalDescription.trim().length < 10) {
    return { field: 'goalDescription', message: 'Please describe your goal (at least 10 characters).' };
  }
  if (planningTier === 'master_plan') {
    if (!architecture || architecture.laneComposition.length === 0) {
      return { field: 'goalDescription', message: 'Jericho could not infer the lane composition yet. Add a little more structure to the goal description.' };
    }
    if (!d.laneMapAccepted && !d.adjustLanesMode) {
      return { field: 'goalDescription', message: 'Review the detected master-plan lanes before continuing.' };
    }
    const selectedCount = buildLaneOverrides(d, architecture).length;
    if (selectedCount === 0) {
      return { field: 'goalDescription', message: 'Keep at least one lane in the master-plan lane map.' };
    }
    if (architecture.laneClassificationConfidence === 'low' && !(d.primaryLaneOverride || architecture.primaryLane)) {
      return { field: 'goalDescription', message: 'Choose the main driver lane so Jericho can route the master plan correctly.' };
    }
    return null;
  }
  if (!d.goalType) {
    return { field: 'goalType', message: 'Please select a goal type.' };
  }
  if (d.goalType === 'physical_product' && d.isConsumable === null) {
    return { field: 'isConsumable', message: 'Please answer whether your product is consumable.' };
  }
  if (d.goalType === 'physical_product' && d.isConsumable && !d.formulaPathway) {
    return { field: 'formulaPathway', message: 'Please select your formula pathway.' };
  }
  if (d.goalType === 'physical_product' && d.isConsumable && !d.targetCategory) {
    return { field: 'targetCategory', message: 'Please select the product category.' };
  }
  if (d.goalType === 'physical_product' && d.isConsumable && !d.distributionChannel) {
    return { field: 'distributionChannel', message: 'Please select the first distribution channel.' };
  }
  return null;
}

function validateScreen2(d: Screen2Data, classification: GoalClassification | null): ValidationError {
  if (!d.startDayKey) {
    return { field: 'startDayKey', message: 'Please choose when this plan should start.' };
  }
  if (d.weeklyHoursAvailable === '' || Number(d.weeklyHoursAvailable) < 1) {
    return { field: 'weeklyHoursAvailable', message: 'Please enter at least 1 hour per week.' };
  }
  if (Number(d.weeklyHoursAvailable) > 60) {
    return { field: 'weeklyHoursAvailable', message: 'Maximum is 60 hours per week.' };
  }
  if (!d.executionContext) {
    return { field: 'executionContext', message: 'Please select your execution context.' };
  }
  const isPhysical = classification === 'regulated_physical_consumable' || classification === 'physical_product';
  if (isPhysical && d.existingRelationships.length === 0) {
    return { field: 'existingRelationships', message: 'Please select at least one option.' };
  }
  if (!d.deadlineType) {
    return { field: 'deadlineType', message: 'Please indicate whether you have a target date.' };
  }
  if (d.deadlineType === 'specific' && !d.deadline) {
    return { field: 'deadline', message: 'Please enter your deadline date.' };
  }
  return null;
}

function validateScreen3(d: Screen3Data): ValidationError {
  if (d.capitalAvailable === '') {
    return { field: 'capitalAvailable', message: 'Please enter your available capital (enter 0 if none).' };
  }
  if (!d.capitalCommitmentConfidence) {
    return { field: 'capitalCommitmentConfidence', message: 'Please select your confidence level.' };
  }
  const showAcquisition = d.capitalAcquisitionRequired || Number(d.capitalAvailable) < 5000;
  if (showAcquisition && d.audienceEntries.length === 0) {
    return { field: 'audienceEntries', message: 'Please add at least one audience platform.' };
  }
  return null;
}

function validateScreen4(d: Screen4Data): ValidationError {
  if (!d.legalEntityExists) {
    return { field: 'legalEntityExists', message: 'Please answer whether you have a business entity.' };
  }
  if (!d.locationState) {
    return { field: 'locationState', message: 'Please select your state.' };
  }
  if (!d.industryExperience) {
    return { field: 'industryExperience', message: 'Please select your experience level.' };
  }
  return null;
}

function formatCurrency(n: number): string {
  return `$${n.toLocaleString()}`;
}

// ────────────────────────────────────────────────────────────────────────────
// Progress Indicator
// ────────────────────────────────────────────────────────────────────────────

function ProgressIndicator({ current }: { current: 1 | 2 | 3 | 4 | 5 }) {
  return (
    <div className="flex items-center gap-0 mb-6" aria-label="Intake progress">
      {SCREEN_LABELS.map((label, idx) => {
        const screenNum = (idx + 1) as 1 | 2 | 3 | 4 | 5;
        const isComplete = screenNum < current;
        const isActive = screenNum === current;
        return (
          <React.Fragment key={label}>
            <div className="flex items-center gap-1">
              <span
                className={[
                  'text-xs font-semibold',
                  isActive ? 'text-jericho-accent' : isComplete ? 'text-green-600' : 'text-muted/50',
                ].join(' ')}
              >
                {isComplete ? '✓ ' : ''}{label}
              </span>
            </div>
            {idx < 4 && (
              <span className="text-muted/30 text-xs mx-2">→</span>
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Field error helper
// ────────────────────────────────────────────────────────────────────────────

function FieldError({ field, error }: { field: string; error: ValidationError }) {
  if (!error || error.field !== field) return null;
  return <p className="text-xs text-red-600 mt-1" role="alert">{error.message}</p>;
}

// ────────────────────────────────────────────────────────────────────────────
// Screen 1 — What are you trying to do?
// ────────────────────────────────────────────────────────────────────────────

function Screen1({
  data,
  onChange,
  onContinue,
  error,
  planningTier,
  goalArchitecture,
  routingView,
  missionPreview,
}: {
  data: Screen1Data;
  onChange: (d: Screen1Data) => void;
  onContinue: () => void;
  error: ValidationError;
  planningTier: GoalPlanningTier | null;
  goalArchitecture: GoalArchitectureInference | null;
  routingView: 'goal_only' | 'simple_type' | 'master_plan_lanes';
  missionPreview?: {
    coreMission?: string;
    outcomeTarget?: string;
    successStandard?: string;
  } | null;
}) {
  const isPhysical = data.goalType === 'physical_product';
  const isConsumable = isPhysical && data.isConsumable === true;
  const isMasterPlan = routingView === 'master_plan_lanes' && planningTier === 'master_plan' && Boolean(goalArchitecture);
  const showPrimitiveGoalType = routingView === 'simple_type' && !isMasterPlan;
  const selectedLaneDomains =
    Array.isArray(data.selectedLaneDomains) && data.selectedLaneDomains.length > 0
      ? data.selectedLaneDomains
      : goalArchitecture?.laneComposition.map((lane) => lane.domain) || [];

  return (
    <div className="space-y-5">
      <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-muted">What are you trying to do?</h2>

      {/* Goal description */}
      <div>
        <label className="block text-xs uppercase tracking-[0.12em] text-muted mb-1" htmlFor="goalDescription">
          Describe your goal in one or two sentences.
        </label>
        <textarea
          id="goalDescription"
          className="w-full rounded border border-line/60 bg-transparent px-3 py-2 text-sm resize-none"
          rows={3}
          maxLength={1000}
          placeholder="e.g., Launch a caffeinated gum brand and make my first real sale."
          value={data.goalDescription}
          onChange={(e) =>
            onChange({
              ...data,
              goalDescription: e.target.value,
              intakeRoutingView: 'goal_only',
              laneMapAccepted: false,
              adjustLanesMode: false,
              selectedLaneDomains: [],
              primaryLaneOverride: null,
            })
          }
        />
        <p className="text-[10px] text-muted/60 text-right">{data.goalDescription.length}/1000</p>
        <FieldError field="goalDescription" error={error} />
      </div>

      {routingView === 'goal_only' ? (
        <div className="rounded-lg border border-line/40 bg-jericho-surface/60 p-3 text-xs text-muted">
          Describe the goal first. Jericho will determine whether this is a simple goal or a multi-lane master plan
          before asking for any additional structure.
        </div>
      ) : null}

      {isMasterPlan ? (
        <div className="rounded-lg border border-line/60 bg-jericho-surface/70 p-4 space-y-3">
          <div>
            <p className="text-xs uppercase tracking-[0.12em] text-muted mb-1">Detected master-plan lanes</p>
            <p className="text-sm font-medium text-jericho-text">
              Jericho detected this as an {goalArchitecture?.goalArchitecture === 'portfolio_master_plan' ? 'portfolio' : 'integrated'} master plan.
            </p>
            <p className="text-xs text-muted mt-1">
              Review the lane map before continuing.
            </p>
          </div>
          <div className="grid gap-2 text-xs text-muted">
            {missionPreview?.coreMission ? (
              <div>
                Core Mission: <span className="font-medium text-jericho-text">{missionPreview.coreMission}</span>
              </div>
            ) : null}
            {missionPreview?.outcomeTarget ? (
              <div>
                Outcome Target: <span className="font-medium text-jericho-text">{missionPreview.outcomeTarget}</span>
              </div>
            ) : null}
            {missionPreview?.successStandard ? (
              <div>
                Success Standard: <span className="font-medium text-jericho-text">{missionPreview.successStandard}</span>
              </div>
            ) : null}
          </div>
          <div className="flex flex-wrap gap-2">
            {(goalArchitecture?.laneComposition || []).map((lane) => {
              const selected = selectedLaneDomains.includes(lane.domain);
              return (
                <label
                  key={lane.domain}
                  className={`rounded-full border px-3 py-1 text-xs cursor-pointer ${
                    selected ? 'border-jericho-accent text-jericho-accent' : 'border-line/60 text-muted'
                  }`}
                >
                  <input
                    type="checkbox"
                    className="sr-only"
                    checked={selected}
                    disabled={!data.adjustLanesMode}
                    onChange={() => {
                      const current = new Set(selectedLaneDomains);
                      if (current.has(lane.domain)) {
                        current.delete(lane.domain);
                      } else {
                        current.add(lane.domain);
                      }
                      onChange({
                        ...data,
                        intakeRoutingView: 'master_plan_lanes',
                        selectedLaneDomains: Array.from(current),
                        laneMapAccepted: true,
                        goalType: 'other',
                      });
                    }}
                    aria-label={lane.title}
                  />
                  {lane.title}
                </label>
              );
            })}
          </div>
          <div className="text-xs text-muted space-y-1">
            <div>Architecture: <span className="font-medium text-jericho-text">{goalArchitecture?.goalArchitecture}</span></div>
            <div>Primary lane: <span className="font-medium text-jericho-text">{goalArchitecture?.primaryLane || 'pending'}</span></div>
            <div>Supporting lanes: <span className="font-medium text-jericho-text">{goalArchitecture?.supportingLanes.join(', ') || 'none'}</span></div>
            <div>Execution model: <span className="font-medium text-jericho-text">{goalArchitecture?.executionModel}</span></div>
            <div>Confidence: <span className="font-medium text-jericho-text">{goalArchitecture?.laneClassificationConfidence}</span></div>
          </div>
          {goalArchitecture?.laneClassificationConfidence === 'low' ? (
            <div>
              <label className="block text-xs uppercase tracking-[0.12em] text-muted mb-1" htmlFor="primaryLaneOverride">
                Which lane is the main driver of this plan?
              </label>
              <select
                id="primaryLaneOverride"
                className="w-full rounded border border-line/60 bg-transparent px-3 py-2 text-sm"
                value={data.primaryLaneOverride || ''}
                onChange={(e) =>
                onChange({
                  ...data,
                  intakeRoutingView: 'master_plan_lanes',
                  primaryLaneOverride: e.target.value || null,
                  laneMapAccepted: true,
                  goalType: 'other',
                  })
                }
              >
                <option value="">Select one</option>
                {(goalArchitecture?.laneComposition || []).map((lane) => (
                  <option key={lane.domain} value={lane.domain}>
                    {lane.title}
                  </option>
                ))}
              </select>
            </div>
          ) : null}
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="rounded-full border border-jericho-accent px-3 py-1 text-xs font-semibold text-jericho-accent hover:bg-jericho-accent/10"
              onClick={() =>
                onChange({
                  ...data,
                  intakeRoutingView: 'master_plan_lanes',
                  laneMapAccepted: true,
                  adjustLanesMode: false,
                  selectedLaneDomains,
                  goalType: 'other',
                })
              }
            >
              Accept lane map
            </button>
            <button
              type="button"
              className="rounded-full border border-line/60 px-3 py-1 text-xs text-muted hover:text-jericho-accent"
              onClick={() =>
                onChange({
                  ...data,
                  intakeRoutingView: 'master_plan_lanes',
                  adjustLanesMode: true,
                  laneMapAccepted: true,
                  selectedLaneDomains,
                  goalType: 'other',
                })
              }
            >
              Adjust lanes
            </button>
          </div>
        </div>
      ) : showPrimitiveGoalType ? (
        <div>
          <p className="text-xs uppercase tracking-[0.12em] text-muted mb-2">What kind of goal is this?</p>
          {(
            [
              { id: 'physical_product', label: 'Physical product', sub: 'I am making something physical to sell' },
              { id: 'digital_product', label: 'Digital product', sub: 'I am building software, content, or a digital asset' },
              { id: 'service', label: 'Service', sub: 'I am offering my skills or expertise' },
              { id: 'personal_development', label: 'Personal development', sub: 'I am building a habit, skill, or outcome for myself' },
              { id: 'other', label: 'Other', sub: '' },
            ] as const
          ).map(({ id, label, sub }) => (
            <label
              key={id}
              className={`mb-2 flex cursor-pointer items-start gap-3 rounded-lg border px-3 py-3 ${
                data.goalType === id
                  ? 'border-jericho-accent bg-jericho-accent/5'
                  : 'border-line/60 bg-jericho-surface/60 hover:border-jericho-accent/40'
              }`}
            >
              <input
                type="radio"
                name="goalType"
                value={id}
                checked={data.goalType === id}
                onChange={() =>
                  onChange({
                    ...data,
                    intakeRoutingView: 'simple_type',
                    goalType: id,
                    isConsumable: null,
                    formulaPathway: null,
                    targetCategory: null,
                    distributionChannel: null,
                  })
                }
                className="mt-0.5"
                aria-label={label}
              />
              <span className="text-sm leading-relaxed">
                <span className="font-medium">{label}</span>
                {sub && <span className="block pt-1 text-xs text-muted">{sub}</span>}
              </span>
            </label>
          ))}
          <FieldError field="goalType" error={error} />
        </div>
      ) : null}

      {/* Consumable sub-question */}
      {!isMasterPlan && showPrimitiveGoalType && isPhysical && (
        <div>
          <p className="text-xs uppercase tracking-[0.12em] text-muted mb-2">
            Is your product a food, supplement, or other consumable?
          </p>
          {[
            { val: true, label: 'Yes — it is ingested (food, gum, drink, supplement)' },
            { val: false, label: 'No — it is worn, used, or applied externally' },
          ].map(({ val, label }) => (
            <label
              key={String(val)}
              className={`mb-2 flex cursor-pointer items-start gap-3 rounded-lg border px-3 py-3 ${
                data.isConsumable === val
                  ? 'border-jericho-accent bg-jericho-accent/5'
                  : 'border-line/60 bg-jericho-surface/60 hover:border-jericho-accent/40'
              }`}
            >
              <input
                type="radio"
                name="isConsumable"
                checked={data.isConsumable === val}
                onChange={() =>
                  onChange({
                    ...data,
                    isConsumable: val,
                    formulaPathway: null,
                    targetCategory: null,
                    distributionChannel: null,
                  })
                }
                aria-label={label}
              />
              <span className="text-sm leading-relaxed">{label}</span>
            </label>
          ))}
          <FieldError field="isConsumable" error={error} />
        </div>
      )}

      {/* Formula pathway */}
      {showPrimitiveGoalType && isConsumable && (
        <div>
          <p className="text-xs uppercase tracking-[0.12em] text-muted mb-2">
            How do you plan to develop the product formula?
          </p>
          {(
            [
              {
                id: 'custom_development',
                label: 'I want to develop a custom formula from scratch',
                sub: 'Requires a formulation chemist. Adds 6–12 months and $15,000–$30,000 before you have a product.',
              },
              {
                id: 'base_modification',
                label: 'I want to modify an existing manufacturer formula',
                sub: 'Faster than custom. Manufacturer already has a base. Adds 4–8 weeks and $1,000–$5,000.',
              },
              {
                id: 'white_label',
                label: "I want to use a manufacturer's existing formula with my branding only",
                sub: 'Fastest path to a real product. Lower capital requirement. Less product differentiation.',
              },
              {
                id: 'undecided',
                label: "I'm not sure yet — help me decide",
                sub: 'The system will recommend based on your timeline and capital.',
              },
            ] as const
          ).map(({ id, label, sub }) => (
            <label
              key={id}
              className={`mb-2 flex cursor-pointer items-start gap-3 rounded-lg border px-3 py-3 ${
                data.formulaPathway === id
                  ? 'border-jericho-accent bg-jericho-accent/5'
                  : 'border-line/60 bg-jericho-surface/60 hover:border-jericho-accent/40'
              }`}
            >
              <input
                type="radio"
                name="formulaPathway"
                value={id}
                checked={data.formulaPathway === id}
                onChange={() => onChange({ ...data, formulaPathway: id })}
                className="mt-0.5"
                aria-label={label}
              />
              <span className="text-sm leading-relaxed">
                <span className="font-medium">{label}</span>
                {sub && <span className="block text-xs text-muted">{sub}</span>}
              </span>
            </label>
          ))}
          <FieldError field="formulaPathway" error={error} />
        </div>
      )}

      {showPrimitiveGoalType && isConsumable && (
        <div>
          <p className="text-xs uppercase tracking-[0.12em] text-muted mb-2">
            Which category best describes the product?
          </p>
          {(
            [
              {
                id: 'food_product',
                label: 'Food product',
                sub: 'Standard food labeling and compliance path.',
              },
              {
                id: 'dietary_supplement',
                label: 'Dietary supplement',
                sub: 'Supplement-specific labeling and compliance path.',
              },
              {
                id: 'functional_food',
                label: 'Functional food',
                sub: 'Food product with functional positioning and claim constraints.',
              },
            ] as const
          ).map(({ id, label, sub }) => (
            <label
              key={id}
              className={`mb-2 flex cursor-pointer items-start gap-3 rounded-lg border px-3 py-3 ${
                data.targetCategory === id
                  ? 'border-jericho-accent bg-jericho-accent/5'
                  : 'border-line/60 bg-jericho-surface/60 hover:border-jericho-accent/40'
              }`}
            >
              <input
                type="radio"
                name="targetCategory"
                value={id}
                checked={data.targetCategory === id}
                onChange={() => onChange({ ...data, targetCategory: id })}
                className="mt-0.5"
                aria-label={label}
              />
              <span className="text-sm leading-relaxed">
                <span className="font-medium">{label}</span>
                {sub && <span className="block text-xs text-muted">{sub}</span>}
              </span>
            </label>
          ))}
          <FieldError field="targetCategory" error={error} />
        </div>
      )}

      {isConsumable && (
        <div>
          <p className="text-xs uppercase tracking-[0.12em] text-muted mb-2">
            Which distribution channel matters first?
          </p>
          {(
            [
              {
                id: 'direct_to_consumer',
                label: 'Direct to consumer',
                sub: 'Own website, checkout, and fulfillment path first.',
              },
              {
                id: 'marketplace',
                label: 'Marketplace',
                sub: 'Amazon or similar marketplace first.',
              },
              {
                id: 'retail',
                label: 'Retail',
                sub: 'Physical shelf placement first.',
              },
              {
                id: 'wholesale',
                label: 'Wholesale',
                sub: 'Distributor or wholesale relationships first.',
              },
            ] as const
          ).map(({ id, label, sub }) => (
            <label
              key={id}
              className={`mb-2 flex cursor-pointer items-start gap-3 rounded-lg border px-3 py-3 ${
                data.distributionChannel === id
                  ? 'border-jericho-accent bg-jericho-accent/5'
                  : 'border-line/60 bg-jericho-surface/60 hover:border-jericho-accent/40'
              }`}
            >
              <input
                type="radio"
                name="distributionChannel"
                value={id}
                checked={data.distributionChannel === id}
                onChange={() => onChange({ ...data, distributionChannel: id })}
                className="mt-0.5"
                aria-label={label}
              />
              <span className="text-sm leading-relaxed">
                <span className="font-medium">{label}</span>
                {sub && <span className="block text-xs text-muted">{sub}</span>}
              </span>
            </label>
          ))}
          <FieldError field="distributionChannel" error={error} />
        </div>
      )}

      <button
        className="w-full rounded-lg border border-jericho-accent bg-jericho-accent text-white px-4 py-2 text-sm font-semibold hover:opacity-90"
        onClick={onContinue}
      >
        Continue
      </button>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Screen 2 — When and how?
// ────────────────────────────────────────────────────────────────────────────

function Screen2({
  data,
  onChange,
  onContinue,
  onBack,
  error,
  goalClassification,
}: {
  data: Screen2Data;
  onChange: (d: Screen2Data) => void;
  onContinue: () => void;
  onBack: () => void;
  error: ValidationError;
  goalClassification: GoalClassification | null;
}) {
  const hours = data.weeklyHoursAvailable === '' ? 0 : Number(data.weeklyHoursAvailable);
  const showPhysicalRelationships =
    goalClassification === 'regulated_physical_consumable' || goalClassification === 'physical_product';

  function toggleRelationship(id: string) {
    const current = data.existingRelationships;
    if (id === 'none') {
      onChange({ ...data, existingRelationships: current.includes('none') ? [] : ['none'] });
      return;
    }
    const next = current.includes(id)
      ? current.filter((r) => r !== id)
      : [...current.filter((r) => r !== 'none'), id];
    onChange({ ...data, existingRelationships: next });
  }

  return (
    <div className="space-y-5">
      <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-muted">When and how?</h2>

      <div>
        <label className="block text-xs uppercase tracking-[0.12em] text-muted mb-1" htmlFor="startDayKey">
          When should this plan start?
        </label>
        <input
          id="startDayKey"
          type="date"
          className="w-full rounded border border-line/60 bg-transparent px-2 py-1 text-sm"
          value={data.startDayKey || ''}
          onChange={(e) => onChange({ ...data, startDayKey: e.target.value || null })}
        />
        <p className="text-[10px] text-muted mt-1">
          This is the first day the scheduler may place work. It belongs to the intake contract, not a later calendar
          patch.
        </p>
        <FieldError field="startDayKey" error={error} />
      </div>

      {/* Timeline */}
      <div>
        <p className="text-xs uppercase tracking-[0.12em] text-muted mb-2">
          Do you have a target date for this goal?
        </p>
        {[
          { id: 'specific', label: 'Yes — I have a specific deadline' },
          { id: 'as_fast_as_possible', label: 'No — as fast as realistically possible' },
        ].map(({ id, label }) => (
          <label key={id} className="flex items-center gap-2 py-1.5 cursor-pointer">
            <input
              type="radio"
              name="deadlineType"
              value={id}
              checked={data.deadlineType === id}
              onChange={() => onChange({ ...data, deadlineType: id as 'specific' | 'as_fast_as_possible' })}
              aria-label={label}
            />
            <span className="text-sm">{label}</span>
          </label>
        ))}
        <FieldError field="deadlineType" error={error} />
      </div>

      {data.deadlineType === 'specific' && (
        <div>
          <label className="block text-xs uppercase tracking-[0.12em] text-muted mb-1" htmlFor="deadline">
            What is your deadline?
          </label>
          <input
            id="deadline"
            type="date"
            className="w-full rounded border border-line/60 bg-transparent px-2 py-1 text-sm"
            value={data.deadline || ''}
            onChange={(e) => onChange({ ...data, deadline: e.target.value || null })}
          />
          <FieldError field="deadline" error={error} />
        </div>
      )}

      {/* Weekly availability */}
      <div>
        <label className="block text-xs uppercase tracking-[0.12em] text-muted mb-1" htmlFor="weeklyHours">
          How many hours per week can you realistically commit to this goal?
        </label>
        <input
          id="weeklyHours"
          type="number"
          min={1}
          max={60}
          className="w-full rounded border border-line/60 bg-transparent px-2 py-1 text-sm"
          value={data.weeklyHoursAvailable}
          onChange={(e) => {
            const v = e.target.value === '' ? '' : Number(e.target.value);
            onChange({ ...data, weeklyHoursAvailable: v as number | '' });
          }}
        />
        <p className="text-[10px] text-muted mt-1">
          Be honest — this directly affects how the plan is scheduled. 5 hours/week produces a very different plan
          than 20 hours/week.
        </p>
        {hours > 0 && hours < 3 && (
          <p className="text-xs text-amber-600 mt-1">
            At fewer than 3 hours per week this goal will take significantly longer than the estimates below.
          </p>
        )}
        {hours > 25 && data.executionContext === 'part_time' && (
          <p className="text-xs text-amber-600 mt-1">
            This pace may be difficult to sustain alongside other commitments.
          </p>
        )}
        <FieldError field="weeklyHoursAvailable" error={error} />
      </div>

      {/* Execution context */}
      <div>
        <p className="text-xs uppercase tracking-[0.12em] text-muted mb-2">Is this your primary focus right now?</p>
        {[
          { id: 'full_time', label: 'Yes — this is my main focus. I am not working a full-time job.' },
          { id: 'part_time', label: 'No — I am working on this alongside a full-time job or other major commitment.' },
        ].map(({ id, label }) => (
          <label key={id} className="flex items-center gap-2 py-1.5 cursor-pointer">
            <input
              type="radio"
              name="executionContext"
              value={id}
              checked={data.executionContext === id}
              onChange={() => onChange({ ...data, executionContext: id as 'full_time' | 'part_time' })}
              aria-label={label}
            />
            <span className="text-sm">{label}</span>
          </label>
        ))}
        <FieldError field="executionContext" error={error} />
      </div>

      {/* Existing relationships (physical product only) */}
      {showPhysicalRelationships && (
        <div>
          <p className="text-xs uppercase tracking-[0.12em] text-muted mb-2">
            Do you have any existing relationships in this space?
          </p>
          {RELATIONSHIP_OPTIONS.map(({ id, label }) => (
            <label key={id} className="flex items-center gap-2 py-1.5 cursor-pointer">
              <input
                type="checkbox"
                checked={data.existingRelationships.includes(id)}
                onChange={() => toggleRelationship(id)}
                aria-label={label}
              />
              <span className="text-sm">{label}</span>
            </label>
          ))}
          <FieldError field="existingRelationships" error={error} />
        </div>
      )}

      {/* Blackout periods */}
      <div>
        <p className="text-xs uppercase tracking-[0.12em] text-muted mb-1">
          Are there periods when you won't be able to work on this? <span className="font-normal">(optional)</span>
        </p>
        <p className="text-[10px] text-muted">Travel, existing commitments, planned breaks. Leave blank if none.</p>
        {data.blackoutPeriods.map((bp, idx) => (
          <div key={idx} className="flex items-center gap-2 mt-2">
            <input
              type="date"
              className="rounded border border-line/60 bg-transparent px-2 py-1 text-xs"
              value={bp.start}
              aria-label={`Blackout start ${idx + 1}`}
              onChange={(e) => {
                const next = [...data.blackoutPeriods];
                next[idx] = { ...next[idx], start: e.target.value };
                onChange({ ...data, blackoutPeriods: next });
              }}
            />
            <span className="text-xs text-muted">to</span>
            <input
              type="date"
              className="rounded border border-line/60 bg-transparent px-2 py-1 text-xs"
              value={bp.end}
              aria-label={`Blackout end ${idx + 1}`}
              onChange={(e) => {
                const next = [...data.blackoutPeriods];
                next[idx] = { ...next[idx], end: e.target.value };
                onChange({ ...data, blackoutPeriods: next });
              }}
            />
            <button
              className="text-xs text-red-500"
              onClick={() => onChange({ ...data, blackoutPeriods: data.blackoutPeriods.filter((_, i) => i !== idx) })}
            >
              Remove
            </button>
          </div>
        ))}
        <button
          className="text-xs text-jericho-accent mt-2 hover:underline"
          onClick={() =>
            onChange({ ...data, blackoutPeriods: [...data.blackoutPeriods, { start: '', end: '' }] })
          }
        >
          + Add blackout period
        </button>
      </div>

      <div className="flex gap-2">
        <button
          className="flex-1 rounded-lg border border-line/60 px-4 py-2 text-sm text-muted hover:text-jericho-accent"
          onClick={onBack}
        >
          Back
        </button>
        <button
          className="flex-1 rounded-lg border border-jericho-accent bg-jericho-accent text-white px-4 py-2 text-sm font-semibold hover:opacity-90"
          onClick={onContinue}
        >
          Continue
        </button>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Screen 3 — How much money?
// ────────────────────────────────────────────────────────────────────────────

function Screen3({
  data,
  onChange,
  onContinue,
  onBack,
  error,
  goalClassification,
}: {
  data: Screen3Data;
  onChange: (d: Screen3Data) => void;
  onContinue: () => void;
  onBack: () => void;
  error: ValidationError;
  goalClassification: GoalClassification | null;
}) {
  const isRegulated = goalClassification === 'regulated_physical_consumable';
  const rawCapital = data.capitalAvailable === '' ? 0 : Number(data.capitalAvailable);
  const showAcquisition = data.capitalAcquisitionRequired || rawCapital < 5000;

  // Framing block numbers from domain function
  const framingReport = React.useMemo(() => (isRegulated ? prePlanFeasibility(FRAMING_TEMPLATE) : null), [isRegulated]);

  function addAudienceEntry() {
    onChange({
      ...data,
      audienceEntries: [...data.audienceEntries, { platform: 'Instagram', size: '', relationship: 'creative_work' }],
    });
  }

  function updateAudienceEntry(idx: number, field: keyof AudienceEntry, value: string | number | '') {
    const next = data.audienceEntries.map((e, i) =>
      i === idx ? { ...e, [field]: value } : e
    );
    onChange({ ...data, audienceEntries: next });
  }

  function removeAudienceEntry(idx: number) {
    onChange({ ...data, audienceEntries: data.audienceEntries.filter((_, i) => i !== idx) });
  }

  const framingPhases = framingReport
    ? [
        { label: 'Legal entity and insurance', phase: framingReport.capitalRequired['phase1_entity_and_insurance'], timing: 'month 1' },
        { label: 'Bench samples from manufacturers', phase: framingReport.capitalRequired['phase2_samples'], timing: 'months 2–3' },
        { label: 'Third-party label review', phase: framingReport.capitalRequired['phase3_label_review'], timing: 'month 4' },
        { label: 'Packaging design and production', phase: framingReport.capitalRequired['phase4_packaging'], timing: 'months 5–7' },
        { label: 'Production deposit (MOQ)', phase: framingReport.capitalRequired['phase4_moq_deposit'], timing: 'month 7' },
        { label: 'Merchant account setup', phase: framingReport.capitalRequired['phase4_merchant_setup'], timing: 'months 8–10' },
      ]
    : [];

  return (
    <div className="space-y-5">
      <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-muted">How much money?</h2>

      {/* Framing block for regulated consumables */}
      {isRegulated && framingReport && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 space-y-2" data-testid="capital-framing-block">
          <p className="text-xs font-semibold text-amber-900 uppercase tracking-wide">
            Before we ask about capital, here is what this type of goal typically costs at each stage:
          </p>
          <div className="space-y-1">
            {framingPhases.map(({ label, phase, timing }) =>
              phase ? (
                <div key={label} className="flex justify-between text-xs text-amber-800">
                  <span>{label}</span>
                  <span className="text-right ml-4">
                    {formatCurrency(phase.min)}–{formatCurrency(phase.max)}{' '}
                    <span className="text-amber-600">({timing})</span>
                  </span>
                </div>
              ) : null
            )}
          </div>
          {framingReport.totalCapitalRequired && (
            <p className="text-xs text-amber-900 pt-1 border-t border-amber-200">
              <span className="font-semibold">
                Total before first sale: approximately{' '}
                {formatCurrency(framingReport.totalCapitalRequired.min)}–
                {formatCurrency(framingReport.totalCapitalRequired.max)}
              </span>{' '}
              on the white-label path.
            </p>
          )}
          <p className="text-xs text-amber-700 italic">
            This is not meant to discourage you. It is meant to help you answer the next question honestly.
          </p>
        </div>
      )}

      {/* Capital available */}
      <div>
        <label className="block text-xs uppercase tracking-[0.12em] text-muted mb-1" htmlFor="capitalAvailable">
          How much capital do you have available for this goal right now?
        </label>
        <input
          id="capitalAvailable"
          type="number"
          min={0}
          className="w-full rounded border border-line/60 bg-transparent px-2 py-1 text-sm"
          value={data.capitalAvailable}
          onChange={(e) => {
            const v = e.target.value === '' ? '' : Number(e.target.value);
            const capital = v as number | '';
            const autoAcquire = capital !== '' && Number(capital) < 5000;
            onChange({ ...data, capitalAvailable: capital, capitalAcquisitionRequired: autoAcquire || data.capitalAcquisitionRequired });
          }}
        />
        <p className="text-[10px] text-muted mt-1">
          Include savings, available credit, or funds you can direct to this goal. Do not include money you need
          for living expenses.
        </p>
        {rawCapital === 0 && (
          <p className="text-xs text-muted mt-1">
            If your answer is $0, that is okay. Select "I need to raise the capital as part of the plan" below.
          </p>
        )}
        <FieldError field="capitalAvailable" error={error} />
      </div>

      {/* Capital acquisition flag */}
      {(data.capitalAvailable === '' || Number(data.capitalAvailable) < 5000 || data.capitalAcquisitionRequired) && (
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input
            type="checkbox"
            checked={data.capitalAcquisitionRequired}
            onChange={(e) => onChange({ ...data, capitalAcquisitionRequired: e.target.checked })}
            aria-label="I need to raise the capital as part of the plan"
          />
          I need to raise the capital as part of the plan
        </label>
      )}

      {/* Audience (when capital acquisition required) */}
      {showAcquisition && (
        <div>
          <p className="text-xs uppercase tracking-[0.12em] text-muted mb-1">
            Do you have an existing audience you could reach for early sales or presale support?
          </p>
          {data.audienceEntries.map((entry, idx) => (
            <div key={idx} className="border border-line/40 rounded p-3 space-y-2 mb-2">
              <div className="flex gap-2 items-start">
                <select
                  className="rounded border border-line/60 bg-transparent px-2 py-1 text-xs flex-1"
                  value={entry.platform}
                  aria-label={`Audience platform ${idx + 1}`}
                  onChange={(e) => updateAudienceEntry(idx, 'platform', e.target.value)}
                >
                  {AUDIENCE_PLATFORMS.map((p) => <option key={p} value={p}>{p}</option>)}
                </select>
                <input
                  type="number"
                  min={0}
                  className="rounded border border-line/60 bg-transparent px-2 py-1 text-xs w-28"
                  placeholder="Approx. size"
                  value={entry.size}
                  aria-label={`Audience size ${idx + 1}`}
                  onChange={(e) => updateAudienceEntry(idx, 'size', e.target.value === '' ? '' : Number(e.target.value))}
                />
                <button className="text-xs text-red-500 flex-shrink-0" onClick={() => removeAudienceEntry(idx)}>
                  Remove
                </button>
              </div>
              <div>
                {AUDIENCE_RELATIONSHIPS.map(({ id, label }) => (
                  <label key={id} className="flex items-center gap-2 text-xs py-0.5 cursor-pointer">
                    <input
                      type="radio"
                      name={`relationship-${idx}`}
                      value={id}
                      checked={entry.relationship === id}
                      onChange={() => updateAudienceEntry(idx, 'relationship', id)}
                      aria-label={label}
                    />
                    {label}
                  </label>
                ))}
              </div>
            </div>
          ))}
          <button className="text-xs text-jericho-accent hover:underline" onClick={addAudienceEntry}>
            + Add audience platform
          </button>
          <FieldError field="audienceEntries" error={error} />

          {/* Existing revenue */}
          <div className="mt-3">
            <p className="text-xs uppercase tracking-[0.12em] text-muted mb-2">
              Do you have another income source that could contribute to this goal?
            </p>
            {[
              { val: true, label: 'Yes — I have a business or job generating income' },
              { val: false, label: 'No — this goal is my only current income focus' },
            ].map(({ val, label }) => (
              <label key={String(val)} className="flex items-center gap-2 py-1 cursor-pointer">
                <input
                  type="radio"
                  name="existingRevenue"
                  checked={data.existingRevenue === val}
                  onChange={() => onChange({ ...data, existingRevenue: val })}
                  aria-label={label}
                />
                <span className="text-sm">{label}</span>
              </label>
            ))}
          </div>
        </div>
      )}

      {/* Capital commitment confidence */}
      <div>
        <p className="text-xs uppercase tracking-[0.12em] text-muted mb-2">
          How confident are you in this capital being available when you need it?
        </p>
        {[
          { id: 'confirmed', label: 'Confirmed — it is available now' },
          { id: 'probable', label: 'Probable — I expect to have it when needed' },
          { id: 'uncertain', label: 'Uncertain — I am not sure' },
        ].map(({ id, label }) => (
          <label key={id} className="flex items-center gap-2 py-1.5 cursor-pointer">
            <input
              type="radio"
              name="capitalCommitmentConfidence"
              value={id}
              checked={data.capitalCommitmentConfidence === id}
              onChange={() =>
                onChange({ ...data, capitalCommitmentConfidence: id as 'confirmed' | 'probable' | 'uncertain' })
              }
              aria-label={label}
            />
            <span className="text-sm">{label}</span>
          </label>
        ))}
        <FieldError field="capitalCommitmentConfidence" error={error} />
      </div>

      {/* Stop condition (optional) */}
      <div>
        <label className="block text-xs uppercase tracking-[0.12em] text-muted mb-1" htmlFor="stopCondition">
          Is there a maximum you would invest before reassessing whether to continue?{' '}
          <span className="font-normal">(optional)</span>
        </label>
        <input
          id="stopCondition"
          type="number"
          min={0}
          className="w-full rounded border border-line/60 bg-transparent px-2 py-1 text-sm"
          value={data.stopCondition}
          onChange={(e) =>
            onChange({ ...data, stopCondition: e.target.value === '' ? '' : Number(e.target.value) })
          }
        />
        <p className="text-[10px] text-muted mt-1">
          This is not a commitment — it helps the system flag when a gate approaches your limit. Leave blank if
          you have not thought about this yet.
        </p>
      </div>

      <div className="flex gap-2">
        <button
          className="flex-1 rounded-lg border border-line/60 px-4 py-2 text-sm text-muted hover:text-jericho-accent"
          onClick={onBack}
        >
          Back
        </button>
        <button
          className="flex-1 rounded-lg border border-jericho-accent bg-jericho-accent text-white px-4 py-2 text-sm font-semibold hover:opacity-90"
          onClick={onContinue}
        >
          Continue
        </button>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Screen 4 — Your existing assets
// ────────────────────────────────────────────────────────────────────────────

function Screen4({
  data,
  onChange,
  onContinue,
  onBack,
  error,
}: {
  data: Screen4Data;
  onChange: (d: Screen4Data) => void;
  onContinue: () => void;
  onBack: () => void;
  error: ValidationError;
}) {
  return (
    <div className="space-y-5">
      <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-muted">Your existing assets</h2>

      {/* Legal entity */}
      <div>
        <p className="text-xs uppercase tracking-[0.12em] text-muted mb-2">
          Do you have an existing business entity (LLC, corporation, sole proprietor)?
        </p>
        {[
          { id: 'yes', label: 'Yes' },
          { id: 'no', label: 'No — I do not have one yet' },
          { id: 'not_sure', label: 'I am not sure' },
        ].map(({ id, label }) => (
          <label key={id} className="flex items-center gap-2 py-1.5 cursor-pointer">
            <input
              type="radio"
              name="legalEntityExists"
              value={id}
              checked={data.legalEntityExists === id}
              onChange={() =>
                onChange({
                  ...data,
                  legalEntityExists: id as 'yes' | 'no' | 'not_sure',
                  entityType: null,
                  entityState: null,
                  entityPurpose: null,
                  entityForThisGoal: null,
                })
              }
              aria-label={label}
            />
            <span className="text-sm">{label}</span>
          </label>
        ))}
        <FieldError field="legalEntityExists" error={error} />
      </div>

      {/* Entity details */}
      {data.legalEntityExists === 'yes' && (
        <div className="space-y-3 pl-2 border-l border-line/40">
          <div>
            <label className="block text-xs uppercase tracking-[0.12em] text-muted mb-1">Entity type</label>
            <select
              className="w-full rounded border border-line/60 bg-transparent px-2 py-1 text-sm"
              value={data.entityType || ''}
              onChange={(e) => onChange({ ...data, entityType: e.target.value || null })}
              aria-label="Entity type"
            >
              <option value="">Select type</option>
              <option value="LLC">LLC</option>
              <option value="Corporation">Corporation</option>
              <option value="Sole proprietor">Sole proprietor</option>
            </select>
          </div>
          <div>
            <label className="block text-xs uppercase tracking-[0.12em] text-muted mb-1">State of formation</label>
            <select
              className="w-full rounded border border-line/60 bg-transparent px-2 py-1 text-sm"
              value={data.entityState || ''}
              onChange={(e) => onChange({ ...data, entityState: e.target.value || null })}
              aria-label="Entity state"
            >
              <option value="">Select state</option>
              {US_STATES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs uppercase tracking-[0.12em] text-muted mb-1" htmlFor="entityPurpose">
              What is it currently used for?
            </label>
            <input
              id="entityPurpose"
              type="text"
              className="w-full rounded border border-line/60 bg-transparent px-2 py-1 text-sm"
              value={data.entityPurpose || ''}
              onChange={(e) => onChange({ ...data, entityPurpose: e.target.value || null })}
              placeholder="e.g., project management consulting"
            />
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.12em] text-muted mb-2">
              Is this entity for the goal above, or for a different business?
            </p>
            {[
              { val: true, label: 'This goal' },
              { val: false, label: 'Different business' },
            ].map(({ val, label }) => (
              <label key={String(val)} className="flex items-center gap-2 py-1 cursor-pointer">
                <input
                  type="radio"
                  name="entityForThisGoal"
                  checked={data.entityForThisGoal === val}
                  onChange={() => onChange({ ...data, entityForThisGoal: val })}
                  aria-label={label}
                />
                <span className="text-sm">{label}</span>
              </label>
            ))}
          </div>
        </div>
      )}

      {/* Location state */}
      <div>
        <label className="block text-xs uppercase tracking-[0.12em] text-muted mb-1" htmlFor="locationState">
          What state are you based in?
        </label>
        <select
          id="locationState"
          className="w-full rounded border border-line/60 bg-transparent px-2 py-1 text-sm"
          value={data.locationState || ''}
          onChange={(e) => onChange({ ...data, locationState: e.target.value || null })}
        >
          <option value="">Select state</option>
          {US_STATES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <p className="text-[10px] text-muted mt-1">
          State-specific requirements affect entity formation, food labeling laws, and tax obligations.
        </p>
        <FieldError field="locationState" error={error} />
      </div>

      {/* Industry experience */}
      <div>
        <p className="text-xs uppercase tracking-[0.12em] text-muted mb-2">
          Do you have any prior experience in this industry?
        </p>
        {[
          { id: 'yes', label: 'Yes — I have worked in this industry' },
          { id: 'adjacent', label: 'Adjacent — I have relevant experience from a related field' },
          { id: 'no', label: 'No — this is new territory for me' },
        ].map(({ id, label }) => (
          <label key={id} className="flex items-center gap-2 py-1.5 cursor-pointer">
            <input
              type="radio"
              name="industryExperience"
              value={id}
              checked={data.industryExperience === id}
              onChange={() => onChange({ ...data, industryExperience: id as 'yes' | 'adjacent' | 'no' })}
              aria-label={label}
            />
            <span className="text-sm">{label}</span>
          </label>
        ))}
        <FieldError field="industryExperience" error={error} />
      </div>

      <div className="flex gap-2">
        <button
          className="flex-1 rounded-lg border border-line/60 px-4 py-2 text-sm text-muted hover:text-jericho-accent"
          onClick={onBack}
        >
          Back
        </button>
        <button
          className="flex-1 rounded-lg border border-jericho-accent bg-jericho-accent text-white px-4 py-2 text-sm font-semibold hover:opacity-90"
          onClick={onContinue}
        >
          Continue
        </button>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Screen 5 — Feasibility result
// ────────────────────────────────────────────────────────────────────────────

function Screen5({
  feasibilityResult,
  intakeFeasibilityReport,
  immutabilityAcknowledged,
  workWindows,
  validationError,
  onAcknowledge,
  onWorkWindowsChange,
  onGeneratePlan,
  onBack,
  onSelectPivot,
  selectedPivot,
}: {
  feasibilityResult: PrePlanFeasibilityResult | null;
  intakeFeasibilityReport: IntakeFeasibilityReport | null;
  immutabilityAcknowledged: boolean;
  workWindows: Record<string, Array<{ start: string; end: string }>>;
  validationError: ValidationError;
  onAcknowledge: (v: boolean) => void;
  onWorkWindowsChange: (windows: Record<string, Array<{ start: string; end: string }>>) => void;
  onGeneratePlan: () => void;
  onBack: () => void;
  onSelectPivot: (pivot: string) => void;
  selectedPivot: string | null;
}) {
  if (!feasibilityResult) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-muted italic">Evaluating your goal against real-world constraints...</p>
      </div>
    );
  }

  const status = feasibilityResult.status;

  return (
    <div className="space-y-5">
      <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-muted">Feasibility Result</h2>

      {validationError ? (
        <div className="rounded-lg border border-red-600/40 bg-red-50 p-3 text-sm text-red-800">
          {validationError.message}
        </div>
      ) : null}

      {/* VIABLE */}
      {status === 'VIABLE' && (
        <div className="rounded-lg border border-green-600/40 bg-green-50 p-4 space-y-2">
          <p className="font-semibold text-green-900">Your goal is viable.</p>
          <p className="text-sm text-green-800">{feasibilityResult.explanation}</p>
          {intakeFeasibilityReport && (
            <div className="mt-2 space-y-1">
              <p className="text-xs font-semibold text-green-900 uppercase tracking-wide">Capital gate sequence</p>
              {Object.entries(intakeFeasibilityReport.capitalRequired).map(([key, phase]) => (
                <div key={key} className="flex justify-between text-xs text-green-800">
                  <span>{phase.description}</span>
                  <span>{formatCurrency(phase.min)}–{formatCurrency(phase.max)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* VIABLE_WITH_CAPITAL_ACQUISITION_REQUIRED */}
      {status === 'VIABLE_WITH_CAPITAL_ACQUISITION_REQUIRED' && (
        <div className="rounded-lg border border-blue-600/40 bg-blue-50 p-4 space-y-3">
          <p className="font-semibold text-blue-900">Your goal is viable with a capital acquisition track.</p>
          <p className="text-sm text-blue-800">{feasibilityResult.explanation}</p>

          {intakeFeasibilityReport?.capitalAcquisitionPath?.presaleMath && (
            <div className="rounded border border-blue-300 bg-blue-100 p-3 space-y-1" data-testid="presale-math">
              <p className="text-xs font-semibold text-blue-900 uppercase tracking-wide">Presale math</p>
              <div className="grid grid-cols-2 gap-x-4 text-xs text-blue-800">
                <span>Target</span>
                <span className="font-semibold">
                  {formatCurrency(intakeFeasibilityReport.capitalAcquisitionPath.presaleMath.target)}
                </span>
                <span>Presale price</span>
                <span className="font-semibold">
                  {formatCurrency(intakeFeasibilityReport.capitalAcquisitionPath.presaleMath.suggestedUnitPrice)}
                </span>
                <span>Orders needed</span>
                <span className="font-semibold">
                  {intakeFeasibilityReport.capitalAcquisitionPath.presaleMath.unitsRequired}
                </span>
                <span>Conversion required</span>
                <span className="font-semibold">
                  {(intakeFeasibilityReport.capitalAcquisitionPath.presaleMath.audienceConversionRequired * 100).toFixed(2)}%
                </span>
              </div>
              <p className="text-xs text-blue-700 italic">
                {intakeFeasibilityReport.capitalAcquisitionPath.presaleMath.interpretation}
              </p>
            </div>
          )}

          {intakeFeasibilityReport && (
            <div className="space-y-1">
              <p className="text-xs font-semibold text-blue-900 uppercase tracking-wide">Capital gate sequence</p>
              {Object.entries(intakeFeasibilityReport.capitalRequired).map(([key, phase]) => (
                <div key={key} className="flex justify-between text-xs text-blue-800">
                  <span>{phase.description}</span>
                  <span className="ml-4 text-right">{formatCurrency(phase.min)}–{formatCurrency(phase.max)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* VIABLE_WITH_ADJUSTED_TIMELINE */}
      {status === 'VIABLE_WITH_ADJUSTED_TIMELINE' && (
        <div className="rounded-lg border border-amber-600/40 bg-amber-50 p-4 space-y-3">
          <p className="font-semibold text-amber-900">
            Your goal is viable, but not by {feasibilityResult.statedDeadline}.
          </p>
          <p className="text-sm text-amber-800">
            Based on the real-world constraints for this type of goal, the earliest realistic completion date is{' '}
            <strong>{feasibilityResult.realisticMinimumDate}</strong>.
          </p>
          <p className="text-sm text-amber-800">
            The primary constraint is <strong>{feasibilityResult.primaryConstraint}</strong>:{' '}
            {feasibilityResult.explanation}
          </p>
          <div className="space-y-2">
            <p className="text-xs font-semibold text-amber-900 uppercase tracking-wide">Pivot options</p>
            {[
              { id: 'white_label_pivot', label: 'White-label pivot', sub: 'Saves approximately 16 weeks.' },
              { id: 'crowdfund_pivot', label: 'Crowdfund pivot', sub: "Moves 'first sales' earlier without physical product." },
              { id: 'capital_injection', label: 'Capital injection', sub: 'Rush fees and air freight can save approximately 2 months for $5,000 additional.' },
            ].map(({ id, label, sub }) => (
              <div key={id} className="flex items-start gap-2">
                <button
                  className={[
                    'text-xs px-2 py-1 rounded border flex-shrink-0',
                    selectedPivot === id
                      ? 'border-amber-600 bg-amber-600 text-white'
                      : 'border-amber-400 text-amber-800 hover:bg-amber-100',
                  ].join(' ')}
                  onClick={() => onSelectPivot(id)}
                >
                  Use this approach
                </button>
                <div>
                  <span className="text-sm font-medium text-amber-900">{label}</span>
                  <span className="text-xs text-amber-700 ml-1">— {sub}</span>
                </div>
              </div>
            ))}
            <button
              className="text-xs text-amber-700 hover:underline"
              onClick={() => onSelectPivot('accept_adjusted')}
            >
              Accept adjusted timeline and generate plan
            </button>
          </div>
        </div>
      )}

      {/* CAPITAL_CONSTRAINED */}
      {status === 'CAPITAL_CONSTRAINED' && (
        <div className="rounded-lg border border-red-600/40 bg-red-50 p-4 space-y-3">
          <p className="font-semibold text-red-900">
            Your goal requires more capital than you currently have access to.
          </p>
          <p className="text-sm text-red-800">
            The <strong>{feasibilityResult.constrainedGate}</strong> requires approximately{' '}
            <strong>{formatCurrency(feasibilityResult.estimatedRequirement)}</strong> by{' '}
            {feasibilityResult.estimatedTiming}. Your current capital of{' '}
            {formatCurrency(feasibilityResult.userCapital)} leaves a gap of{' '}
            <strong>{formatCurrency(feasibilityResult.gap)}</strong>.
          </p>
          <p className="text-sm text-red-800">{feasibilityResult.explanation}</p>
          <div className="space-y-2">
            <p className="text-xs font-semibold text-red-900 uppercase tracking-wide">
              Here are paths that work within your constraints:
            </p>
            {[
              { id: 'white_label_lower_capital', label: 'White-label pathway', sub: 'Lower capital requirement — uses manufacturer existing formula.' },
              { id: 'crowdfund_first', label: 'Crowdfund-first approach', sub: 'Validates demand and raises capital before committing to production.' },
              { id: 'phased_research_only', label: 'Phased approach starting with research only', sub: 'Delays capital commitment while building market knowledge.' },
            ].map(({ id, label, sub }) => (
              <div key={id} className="flex items-start gap-2">
                <button
                  className={[
                    'text-xs px-2 py-1 rounded border flex-shrink-0',
                    selectedPivot === id
                      ? 'border-red-600 bg-red-600 text-white'
                      : 'border-red-400 text-red-800 hover:bg-red-100',
                  ].join(' ')}
                  onClick={() => onSelectPivot(id)}
                >
                  Use this approach
                </button>
                <div>
                  <span className="text-sm font-medium text-red-900">{label}</span>
                  <span className="text-xs text-red-700 ml-1">— {sub}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* PATHWAY_MISMATCH */}
      {status === 'PATHWAY_MISMATCH' && (
        <div className="rounded-lg border border-amber-600/40 bg-amber-50 p-4 space-y-2">
          <p className="font-semibold text-amber-900">Pathway and timeline are not compatible.</p>
          <p className="text-sm text-amber-800">{feasibilityResult.explanation}</p>
          <p className="text-sm text-amber-800">
            Suggested pathway: <strong>{feasibilityResult.suggestedPathway}</strong>
            {feasibilityResult.suggestedPathwayTimelineDelta && (
              <span className="ml-1">({feasibilityResult.suggestedPathwayTimelineDelta})</span>
            )}
          </p>
        </div>
      )}

      <WorkWindowsEditor value={workWindows} onChange={onWorkWindowsChange} />

      {/* Immutability acknowledgment */}
      <div className="rounded-lg border border-line/60 bg-jericho-surface/90 p-4 space-y-3" data-testid="immutability-section">
        <p className="text-xs text-muted leading-relaxed">
          Once your plan is generated and activated, the core structure becomes immutable. You may log
          completions, adjust scheduling density, and respond to course corrections. You may not restructure the
          dependency graph without starting a new cycle.
        </p>
        <label className="flex items-start gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={immutabilityAcknowledged}
            onChange={(e) => onAcknowledge(e.target.checked)}
            aria-label="I understand and am ready to generate my plan"
          />
          <span className="text-sm">I understand and am ready to generate my plan.</span>
        </label>
      </div>

      <div className="flex gap-2">
        <button
          className="flex-1 rounded-lg border border-line/60 px-4 py-2 text-sm text-muted hover:text-jericho-accent"
          onClick={onBack}
        >
          Back
        </button>
        <button
          className="flex-1 rounded-lg border border-green-600 bg-green-600 text-white px-4 py-2 text-sm font-semibold hover:bg-green-700 disabled:opacity-40 disabled:cursor-not-allowed"
          onClick={onGeneratePlan}
          disabled={!immutabilityAcknowledged}
          aria-label="Generate plan"
        >
          Generate plan
        </button>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Continue or restart prompt
// ────────────────────────────────────────────────────────────────────────────

function ContinueOrRestartPrompt({
  onContinue,
  onRestart,
}: {
  onContinue: () => void;
  onRestart: () => void;
}) {
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted">You have an intake in progress.</p>
      <div className="flex gap-3">
        <button
          className="flex-1 rounded-lg border border-jericho-accent text-jericho-accent px-4 py-2 text-sm font-semibold hover:bg-jericho-accent/10"
          onClick={onContinue}
        >
          Continue where you left off
        </button>
        <button
          className="flex-1 rounded-lg border border-line/60 text-muted px-4 py-2 text-sm hover:text-jericho-accent"
          onClick={onRestart}
        >
          Start over
        </button>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Initial state factories
// ────────────────────────────────────────────────────────────────────────────

function emptyScreen1(): Screen1Data {
  return {
    goalDescription: '',
    goalType: null,
    isConsumable: null,
    formulaPathway: null,
    targetCategory: null,
    distributionChannel: null,
    intakeRoutingView: 'goal_only',
    laneMapAccepted: false,
    adjustLanesMode: false,
    selectedLaneDomains: [],
    primaryLaneOverride: null,
  };
}

function emptyScreen2(startDayKey: string | null = null): Screen2Data {
  return {
    startDayKey,
    deadlineType: null,
    deadline: null,
    weeklyHoursAvailable: '',
    executionContext: null,
    existingRelationships: [],
    blackoutPeriods: [],
  };
}

function emptyScreen3(): Screen3Data {
  return {
    capitalAvailable: '',
    capitalAcquisitionRequired: false,
    audienceEntries: [],
    existingRevenue: null,
    capitalCommitmentConfidence: null,
    stopCondition: '',
  };
}

function emptyScreen4(): Screen4Data {
  return {
    legalEntityExists: null,
    entityType: null,
    entityState: null,
    entityPurpose: null,
    entityForThisGoal: null,
    locationState: null,
    industryExperience: null,
  };
}

function freshState(): IntakeProgressState {
  return {
    currentScreen: 1,
    screen1: emptyScreen1(),
    screen2: emptyScreen2(),
    screen3: emptyScreen3(),
    screen4: emptyScreen4(),
    feasibilityResult: null,
    intakeFeasibilityReport: null,
    selectedPivot: null,
    immutabilityAcknowledged: false,
    workWindows: { ...EMPTY_WORK_WINDOWS },
  };
}

// ────────────────────────────────────────────────────────────────────────────
// Main component
// ────────────────────────────────────────────────────────────────────────────

export function GoalAdmissionFlow({
  onGeneratePlan,
  onAspire,
  savedState,
  onStateChange,
  appTimeISO,
  onPlanningTierRouted,
}: GoalAdmissionFlowProps) {
  const resolvedStartDayKey = (appTimeISO || new Date().toISOString()).slice(0, 10);
  const hasSavedProgress =
    savedState != null && savedState.screen1 != null && savedState.screen1.goalDescription.length > 0;

  const [showResumePrompt, setShowResumePrompt] = useState(hasSavedProgress);
  const [state, setStateRaw] = useState<IntakeProgressState>(() => {
    if (hasSavedProgress && savedState != null) {
      return {
        ...savedState,
        screen2: savedState.screen2
          ? { ...savedState.screen2, startDayKey: savedState.screen2.startDayKey || resolvedStartDayKey }
          : emptyScreen2(resolvedStartDayKey),
      };
    }
    return {
      ...freshState(),
      screen2: emptyScreen2(resolvedStartDayKey),
    };
  });
  const [validationError, setValidationError] = useState<ValidationError>(null);
  const [computingFeasibility, setComputingFeasibility] = useState(false);

  const setState = useCallback(
    (next: IntakeProgressState | ((prev: IntakeProgressState) => IntakeProgressState)) => {
      setStateRaw((prev) => {
        const resolved = typeof next === 'function' ? next(prev) : next;
        onStateChange?.(resolved);
        return resolved;
      });
    },
    [onStateChange],
  );

  // Compute feasibility when reaching Screen 5
  useEffect(() => {
    if (state.currentScreen !== 5) return;
    if (state.feasibilityResult) return;
    if (!state.screen1 || !state.screen2 || !state.screen3 || !state.screen4) return;

    setComputingFeasibility(true);
    const timer = setTimeout(() => {
      const intake = assembleIntake(state.screen1!, state.screen2!, state.screen3!, state.screen4!);
      const feasibilityResult = evaluatePrePlanFeasibility(intake, {
        startDayKey: state.screen2?.startDayKey || resolvedStartDayKey,
      });
      const intakeFeasibilityReport = prePlanFeasibility(intake);
      setState((prev) => ({ ...prev, feasibilityResult, intakeFeasibilityReport }));
      setComputingFeasibility(false);
    }, 400);

    return () => clearTimeout(timer);
  }, [state.currentScreen, state.feasibilityResult, state.screen1, state.screen2, state.screen3, state.screen4, setState]);

  if (showResumePrompt) {
    return (
      <ContinueOrRestartPrompt
        onContinue={() => setShowResumePrompt(false)}
        onRestart={() => {
          const next = freshState();
          next.screen2 = emptyScreen2(resolvedStartDayKey);
          setStateRaw(next);
          onStateChange?.(next);
          setShowResumePrompt(false);
        }}
      />
    );
  }

  const s1 = state.screen1 ?? emptyScreen1();
  const s2 = state.screen2 ?? emptyScreen2();
  const s3 = state.screen3 ?? emptyScreen3();
  const s4 = state.screen4 ?? emptyScreen4();
  const goalClassification = s1.goalType ? deriveGoalClassification(s1) : null;
  const inferredPlanningTier = s1.goalDescription.trim()
    ? classifyGoalPlanningTier(s1.goalDescription, {
        goalType: s1.goalType,
        isConsumable: s1.isConsumable,
      })
    : null;
  const inferredGoalArchitecture =
    inferredPlanningTier === 'master_plan'
      ? inferGoalArchitecture(s1.goalDescription, {
          planningTier: 'master_plan',
          laneOverrides:
            Array.isArray(s1.selectedLaneDomains) && s1.selectedLaneDomains.length > 0
              ? inferGoalArchitecture(s1.goalDescription, { planningTier: 'master_plan' }).laneComposition.filter((lane) =>
                  s1.selectedLaneDomains?.includes(lane.domain)
                )
              : undefined,
          classificationSource:
            Array.isArray(s1.selectedLaneDomains) && s1.selectedLaneDomains.length > 0 ? 'user_corrected' : 'inferred',
        })
      : null;
  const screen1RoutingView = deriveScreen1RoutingView(s1, inferredPlanningTier, inferredGoalArchitecture);
  const masterPlanSemanticPreview =
    inferredPlanningTier === 'master_plan'
      ? deriveMasterPlanSemanticModel({
          goalText: s1.goalDescription,
          extractedLanes: inferredGoalArchitecture?.laneComposition || [],
          horizonAnswer: null,
        })
      : null;

  function advanceTo(screen: 1 | 2 | 3 | 4 | 5) {
    setValidationError(null);
    setState((prev) => ({ ...prev, currentScreen: screen }));
  }

  function handleScreen1Continue() {
    const planningTier =
      inferredPlanningTier ||
      classifyGoalPlanningTier(s1.goalDescription, {
        goalType: s1.goalType,
        isConsumable: s1.isConsumable,
      });
    const architecture =
      inferredGoalArchitecture ||
      (planningTier === 'master_plan' ? inferGoalArchitecture(s1.goalDescription, { planningTier }) : null);
    const routingView = deriveScreen1RoutingView(s1, planningTier, architecture);
    if (routingView === 'goal_only') {
      setValidationError({ field: 'goalDescription', message: 'Please describe your goal (at least 10 characters).' });
      return;
    }
    const err = validateScreen1(s1, planningTier, architecture);
    setValidationError(err);
    if (err) return;
    if (planningTier === 'master_plan' && onPlanningTierRouted) {
      setState((prev) => ({ ...prev, screen1: s1 }));
      onPlanningTierRouted({
        planningTier,
        goalDescription: s1.goalDescription.trim(),
        screen1: s1,
        goalArchitecture: architecture || inferGoalArchitecture(s1.goalDescription, { planningTier }),
      });
      return;
    }
    setState((prev) => ({ ...prev, screen1: s1, currentScreen: 2 }));
  }

  function handleScreen2Continue() {
    const err = validateScreen2(s2, goalClassification);
    setValidationError(err);
    if (err) return;
    setState((prev) => ({ ...prev, screen2: s2, currentScreen: 3 }));
  }

  function handleScreen3Continue() {
    const err = validateScreen3(s3);
    setValidationError(err);
    if (err) return;
    setState((prev) => ({ ...prev, screen3: s3, currentScreen: 4 }));
  }

  function handleScreen4Continue() {
    const err = validateScreen4(s4);
    setValidationError(err);
    if (err) return;
    setState((prev) => ({
      ...prev,
      screen4: s4,
      currentScreen: 5,
      feasibilityResult: null,
      intakeFeasibilityReport: null,
    }));
  }

  function handleGeneratePlan() {
    if (!state.immutabilityAcknowledged) return;
    if (!state.screen1 || !state.screen2 || !state.screen3 || !state.screen4) return;
    if (!hasAnyWorkWindow(state.workWindows)) {
      setValidationError({ field: 'workWindows', message: 'Add at least one work window before generating your plan.' });
      return;
    }
    const intake = assembleIntake(state.screen1, state.screen2, state.screen3, state.screen4);
    setValidationError(null);
    onGeneratePlan(intake);
  }

  return (
    <div className="space-y-4">
      <ProgressIndicator current={state.currentScreen} />

      {state.currentScreen === 1 && (
        <Screen1
          data={s1}
          onChange={(d) => setState((prev) => ({ ...prev, screen1: d }))}
          onContinue={handleScreen1Continue}
          error={validationError}
          planningTier={inferredPlanningTier}
          goalArchitecture={inferredGoalArchitecture}
          routingView={screen1RoutingView}
          missionPreview={masterPlanSemanticPreview}
        />
      )}

      {state.currentScreen === 2 && (
        <Screen2
          data={s2}
          onChange={(d) => setState((prev) => ({ ...prev, screen2: d }))}
          onContinue={handleScreen2Continue}
          onBack={() => advanceTo(1)}
          error={validationError}
          goalClassification={goalClassification}
        />
      )}

      {state.currentScreen === 3 && (
        <Screen3
          data={s3}
          onChange={(d) => setState((prev) => ({ ...prev, screen3: d }))}
          onContinue={handleScreen3Continue}
          onBack={() => advanceTo(2)}
          error={validationError}
          goalClassification={goalClassification}
        />
      )}

      {state.currentScreen === 4 && (
        <Screen4
          data={s4}
          onChange={(d) => setState((prev) => ({ ...prev, screen4: d }))}
          onContinue={handleScreen4Continue}
          onBack={() => advanceTo(3)}
          error={validationError}
        />
      )}

      {state.currentScreen === 5 && (
        <Screen5
          feasibilityResult={computingFeasibility ? null : state.feasibilityResult}
          intakeFeasibilityReport={state.intakeFeasibilityReport}
          immutabilityAcknowledged={state.immutabilityAcknowledged}
          workWindows={state.workWindows}
          validationError={validationError}
          onAcknowledge={(v) => setState((prev) => ({ ...prev, immutabilityAcknowledged: v }))}
          onWorkWindowsChange={(windows) => setState((prev) => ({ ...prev, workWindows: windows }))}
          onGeneratePlan={handleGeneratePlan}
          onBack={() => advanceTo(4)}
          onSelectPivot={(pivot) => setState((prev) => ({ ...prev, selectedPivot: pivot }))}
          selectedPivot={state.selectedPivot}
        />
      )}
    </div>
  );
}

export default GoalAdmissionFlow;
