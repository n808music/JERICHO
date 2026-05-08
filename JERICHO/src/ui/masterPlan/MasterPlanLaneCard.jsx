import React from 'react';
import { useIdentityStore } from '../../state/identityStore.js';
import {
  selectLaneById,
  selectMilestonesForLane,
} from '../../domain/masterPlan/masterPlanSelectors.js';
import {
  LANE_ACTIVATION_STATE,
  LANE_ASSESSED_CONFIDENCE,
  MILESTONE_STATUS,
  MILESTONE_TYPE,
  REQUIREMENT_STATUS,
} from '../../domain/masterPlan/masterPlanSchema.js';

const ACTIVATION_PILL = {
  [LANE_ACTIVATION_STATE.ACTIVE]: 'bg-green-500/10 text-green-600 border-green-400/30',
  [LANE_ACTIVATION_STATE.INCUBATING]: 'bg-amber-400/10 text-amber-600 border-amber-400/30',
  [LANE_ACTIVATION_STATE.PARKED]: 'bg-line/20 text-muted border-line/30',
};

const CONFIDENCE_COLOR = {
  [LANE_ASSESSED_CONFIDENCE.HIGH]: 'text-green-600',
  [LANE_ASSESSED_CONFIDENCE.MEDIUM]: 'text-amber-500',
  [LANE_ASSESSED_CONFIDENCE.LOW]: 'text-red-400',
};

const MS_STATUS_DOT = {
  [MILESTONE_STATUS.PENDING]: 'bg-line',
  [MILESTONE_STATUS.IN_PROGRESS]: 'bg-jericho-accent',
  [MILESTONE_STATUS.COMPLETE]: 'bg-green-500',
  [MILESTONE_STATUS.AT_RISK]: 'bg-amber-400',
  [MILESTONE_STATUS.MISSED]: 'bg-red-500',
};

const MS_TYPE_LABEL = {
  [MILESTONE_TYPE.GATE]: 'gate',
  [MILESTONE_TYPE.ANCHOR]: 'anchor',
  [MILESTONE_TYPE.CHECKPOINT]: null,
};

const REQ_STATUS_ICON = {
  [REQUIREMENT_STATUS.COMPLETE]: '✓',
  [REQUIREMENT_STATUS.SCHEDULED]: '○',
  [REQUIREMENT_STATUS.BLOCKED]: '✗',
};

const REQ_STATUS_COLOR = {
  [REQUIREMENT_STATUS.COMPLETE]: 'text-green-500',
  [REQUIREMENT_STATUS.SCHEDULED]: 'text-muted',
  [REQUIREMENT_STATUS.BLOCKED]: 'text-red-400',
};

const DOMAIN_BORDER = {
  creative: 'border-l-purple-400',
  product: 'border-l-blue-400',
  brand: 'border-l-pink-400',
  income: 'border-l-green-400',
  media: 'border-l-orange-400',
};

// ─── Main export ──────────────────────────────────────────────────────────────

export default function MasterPlanLaneCard({ laneId, onClose }) {
  const store = useIdentityStore();
  const lane = selectLaneById(store, laneId);
  const milestones = selectMilestonesForLane(store, laneId);

  if (!lane) return null;

  const sortedMilestones = [...milestones].sort((a, b) =>
    a.targetDate < b.targetDate ? -1 : 1
  );

  const legalReqs = (lane.requirements || []).filter((r) => r.requirementType === 'legal');
  const standardReqs = (lane.requirements || []).filter((r) => r.requirementType !== 'legal');

  const depLaneTitles = (lane.dependsOnLaneIds || [])
    .map((id) => store.masterPlanLanesById?.[id]?.title)
    .filter(Boolean);

  const borderClass = DOMAIN_BORDER[lane.domain] || 'border-l-line';

  return (
    <div className={`rounded-xl border border-line/40 bg-jericho-surface border-l-2 ${borderClass}`}>
      <LaneHeader lane={lane} onClose={onClose} />

      <div className="px-4 py-3 space-y-4">
        <AssessmentSection lane={lane} />
        <DescriptionSection lane={lane} />
        <FlagsSection lane={lane} />
        <DependenciesSection titles={depLaneTitles} />
        <RequirementsSection label="Legal requirements" items={legalReqs} />
        <RequirementsSection label="Requirements" items={standardReqs} />
        <MilestonesSection milestones={sortedMilestones} />
      </div>
    </div>
  );
}

// ─── Sub-sections ─────────────────────────────────────────────────────────────

function LaneHeader({ lane, onClose }) {
  return (
    <div className="flex items-start justify-between gap-3 px-4 pt-4 pb-3 border-b border-line/30">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <h3 className="text-sm font-semibold text-jericho-text">{lane.title}</h3>
          <span
            className={`text-[10px] px-1.5 py-0.5 rounded-full border font-medium ${
              ACTIVATION_PILL[lane.activationState] || 'bg-line/20 text-muted border-line/30'
            }`}
          >
            {lane.activationState}
          </span>
        </div>
        <p className="text-[11px] text-muted mt-0.5">{lane.domain}</p>
      </div>
      {onClose && (
        <button
          onClick={onClose}
          className="text-muted hover:text-jericho-text text-sm leading-none p-1 -mt-0.5 shrink-0"
          aria-label="Close lane detail"
        >
          ✕
        </button>
      )}
    </div>
  );
}

function AssessmentSection({ lane }) {
  if (!lane.assessedStage && !lane.assessedConfidence) return null;
  return (
    <div>
      <SectionLabel>Assessment</SectionLabel>
      <div className="flex items-center gap-3 flex-wrap">
        {lane.assessedStage && (
          <span className="text-xs text-jericho-text">
            Stage: <span className="font-medium">{lane.assessedStage}</span>
          </span>
        )}
        {lane.assessedConfidence && (
          <span className={`text-xs font-medium ${CONFIDENCE_COLOR[lane.assessedConfidence] || 'text-muted'}`}>
            {lane.assessedConfidence} confidence
          </span>
        )}
      </div>
      {lane.assessmentNotes && (
        <p className="text-[11px] text-muted mt-1.5 leading-relaxed">{lane.assessmentNotes}</p>
      )}
    </div>
  );
}

function DescriptionSection({ lane }) {
  if (!lane.userDescription) return null;
  return (
    <div>
      <SectionLabel>Description</SectionLabel>
      <p className="text-xs text-jericho-text leading-relaxed">{lane.userDescription}</p>
    </div>
  );
}

function FlagsSection({ lane }) {
  if (!lane.capitalRequired && !lane.legalRequired) return null;
  return (
    <div className="flex gap-2 flex-wrap">
      {lane.capitalRequired && (
        <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-400/10 text-amber-600 border border-amber-400/30 font-medium">
          Capital required
        </span>
      )}
      {lane.legalRequired && (
        <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-400/10 text-red-500 border border-red-400/30 font-medium">
          Legal required
        </span>
      )}
    </div>
  );
}

function DependenciesSection({ titles }) {
  if (!titles.length) return null;
  return (
    <div>
      <SectionLabel>Depends on</SectionLabel>
      <div className="flex gap-1.5 flex-wrap">
        {titles.map((title, i) => (
          <span key={i} className="text-[10px] px-2 py-0.5 rounded-full bg-line/20 text-muted border border-line/30">
            {title}
          </span>
        ))}
      </div>
    </div>
  );
}

function RequirementsSection({ label, items }) {
  if (!items.length) return null;
  return (
    <div>
      <SectionLabel>{label}</SectionLabel>
      <ul className="space-y-1.5">
        {items.map((req) => (
          <li key={req.id} className="flex items-start gap-2">
            <span
              className={`text-xs font-medium shrink-0 mt-0.5 ${
                REQ_STATUS_COLOR[req.status] || 'text-muted'
              }`}
            >
              {REQ_STATUS_ICON[req.status] || '○'}
            </span>
            <span className="text-xs text-jericho-text leading-snug">{req.description}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function MilestonesSection({ milestones }) {
  if (!milestones.length) {
    return <p className="text-xs text-muted">No milestones set for this lane yet.</p>;
  }
  return (
    <div>
      <SectionLabel>Milestones</SectionLabel>
      <ul className="space-y-2">
        {milestones.map((ms) => (
          <li key={ms.id} className="flex items-start gap-2">
            <span
              className={`w-2 h-2 rounded-full shrink-0 mt-1 ${MS_STATUS_DOT[ms.status] || 'bg-line'}`}
            />
            <div className="flex-1 min-w-0">
              <div className="flex items-baseline gap-1.5 flex-wrap">
                <span className="text-xs text-jericho-text font-medium leading-snug">{ms.title}</span>
                {MS_TYPE_LABEL[ms.milestoneType] && (
                  <span className="text-[10px] text-muted">{MS_TYPE_LABEL[ms.milestoneType]}</span>
                )}
              </div>
              <p className="text-[10px] text-muted mt-0.5">
                {ms.targetDate}
                {ms.flex ? ` · flex: ${ms.flex}` : ''}
              </p>
              {ms.missConsequence && (
                <p className="text-[10px] text-amber-500 mt-0.5">{ms.missConsequence}</p>
              )}
              {ms.derivedFrom && <p className="text-[10px] text-muted/70 mt-0.5 italic">{ms.derivedFrom}</p>}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function SectionLabel({ children }) {
  return (
    <p className="text-[10px] font-medium text-muted uppercase tracking-wide mb-1.5">{children}</p>
  );
}
