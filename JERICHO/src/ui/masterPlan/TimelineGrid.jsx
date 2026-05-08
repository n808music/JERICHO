/**
 * TimelineGrid — pure presentational component.
 * Renders lanes as rows against a month axis with milestones plotted by targetDate.
 * No store access. Both MasterPlanTimeline and GoalTimeline feed it normalized props.
 *
 * Props:
 *   plan     — { id, title, northStarOutcome, horizonStart, horizonEnd, status }
 *   lanes    — Array<{ id, title, domain, activationState }>
 *   milestones — Array<{ id, laneId, title, targetDate, milestoneType, status,
 *                        missConsequence, derivedFrom }>
 *   anchors  — Array<{ id, date, label, isFixed }>
 *   emptyMessage — string shown when lanes is empty
 */
import React, { useMemo } from 'react';
import { MILESTONE_TYPE, MILESTONE_STATUS, LANE_ACTIVATION_STATE } from '../../domain/masterPlan/masterPlanSchema.js';

// ─── Domain → left-border accent ─────────────────────────────────────────────
// Covers both master plan domains (lowercase) and goal domains (ALL_CAPS).

const DOMAIN_ACCENT = {
  // Master plan domains
  creative: 'border-l-purple-400',
  product: 'border-l-blue-400',
  brand: 'border-l-pink-400',
  income: 'border-l-green-400',
  media: 'border-l-orange-400',
  // Goal domains (ALL_CAPS)
  CREATION: 'border-l-purple-400',
  FOCUS: 'border-l-blue-400',
  BODY: 'border-l-red-400',
  RESOURCES: 'border-l-green-400',
};

const STATUS_DOT = {
  [MILESTONE_STATUS.PENDING]: 'bg-line',
  [MILESTONE_STATUS.IN_PROGRESS]: 'bg-jericho-accent',
  [MILESTONE_STATUS.COMPLETE]: 'bg-green-500',
  [MILESTONE_STATUS.AT_RISK]: 'bg-amber-400',
  [MILESTONE_STATUS.MISSED]: 'bg-red-500',
};

const TYPE_RING = {
  [MILESTONE_TYPE.GATE]: 'ring-2 ring-jericho-accent/60',
  [MILESTONE_TYPE.ANCHOR]: 'ring-2 ring-amber-400',
  [MILESTONE_TYPE.CHECKPOINT]: '',
};

const ACTIVATION_BADGE = {
  [LANE_ACTIVATION_STATE.ACTIVE]: 'bg-green-500/10 text-green-600',
  [LANE_ACTIVATION_STATE.INCUBATING]: 'bg-amber-400/10 text-amber-600',
  [LANE_ACTIVATION_STATE.PARKED]: 'bg-line/30 text-muted',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getMonthsInRange(startISO, endISO) {
  const start = new Date(startISO || endISO);
  const end = new Date(endISO || startISO);
  const months = [];
  let cur = new Date(start.getFullYear(), start.getMonth(), 1);
  const endMonth = new Date(end.getFullYear(), end.getMonth(), 1);
  while (cur <= endMonth) {
    months.push({
      key: cur.toISOString().slice(0, 7),
      label: cur.toLocaleDateString('en-US', { month: 'short', year: '2-digit' }),
    });
    cur = new Date(cur.getFullYear(), cur.getMonth() + 1, 1);
  }
  return months;
}

// ─── Main export ──────────────────────────────────────────────────────────────

export default function TimelineGrid({ plan, lanes = [], milestones = [], anchors = [], emptyMessage, onLaneClick }) {
  const horizonBounds = useMemo(() => {
    const dates = [
      plan?.horizonStart,
      plan?.horizonEnd,
      ...anchors.map((a) => a.date),
      ...milestones.map((m) => m.targetDate),
    ].filter(Boolean).sort();
    if (dates.length === 0) {
      const today = new Date().toISOString().slice(0, 10);
      return { start: today, end: today };
    }
    return { start: dates[0], end: dates[dates.length - 1] };
  }, [plan, anchors, milestones]);

  const months = useMemo(
    () => getMonthsInRange(horizonBounds.start, horizonBounds.end),
    [horizonBounds]
  );

  const anchorMonths = useMemo(
    () => new Set(anchors.map((a) => a.date?.slice(0, 7)).filter(Boolean)),
    [anchors]
  );

  // Build laneId → milestones map — more reliable than laneTitle matching.
  const milestonesByLane = useMemo(() => {
    const map = {};
    for (const ms of milestones) {
      if (!map[ms.laneId]) map[ms.laneId] = [];
      map[ms.laneId].push(ms);
    }
    return map;
  }, [milestones]);

  if (months.length === 0) {
    return <p className="text-muted text-sm p-4">Timeline has no date range set.</p>;
  }

  return (
    <div className="space-y-3">
      {plan && <PlanHeader plan={plan} anchors={anchors} />}

      {lanes.length === 0 ? (
        <p className="text-muted text-sm p-4">
          {emptyMessage || 'No lanes to display.'}
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-line/40 bg-jericho-surface/80">
          <div
            className="grid min-w-max"
            style={{ gridTemplateColumns: `180px repeat(${months.length}, minmax(72px, 1fr))` }}
          >
            {/* Month header row */}
            <div className="px-3 py-2 border-b border-line/40" />
            {months.map((month) => (
              <div
                key={month.key}
                className={`px-1 py-2 text-center text-[11px] font-medium border-b border-line/40 ${
                  anchorMonths.has(month.key)
                    ? 'text-amber-500 bg-amber-400/5'
                    : 'text-muted'
                }`}
              >
                {month.label}
                {anchorMonths.has(month.key) && (
                  <span className="block text-amber-400 leading-none">▾</span>
                )}
              </div>
            ))}

            {/* Lane rows */}
            {lanes.map((lane, laneIdx) => {
              const laneMilestones = milestonesByLane[lane.id] || [];
              const byMonth = {};
              for (const ms of laneMilestones) {
                const mk = ms.targetDate?.slice(0, 7);
                if (!mk) continue;
                if (!byMonth[mk]) byMonth[mk] = [];
                byMonth[mk].push(ms);
              }
              const stripe = laneIdx % 2 !== 0;

              return (
                <React.Fragment key={lane.id}>
                  <div
                    className={`px-3 py-3 border-b border-line/20 border-l-2 flex flex-col gap-1 ${
                      DOMAIN_ACCENT[lane.domain] || 'border-l-line'
                    } ${stripe ? 'bg-jericho-surface/40' : ''} ${
                      onLaneClick ? 'cursor-pointer hover:bg-jericho-surface/60 transition-colors' : ''
                    }`}
                    data-testid={`timeline-lane-${lane.id}`}
                    onClick={onLaneClick ? () => onLaneClick(lane.id) : undefined}
                  >
                    <span className="text-xs font-medium text-jericho-text leading-tight truncate">
                      {lane.title}
                    </span>
                    <div className="flex items-center gap-1 flex-wrap">
                      {lane.activationState && (
                        <span
                          className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
                            ACTIVATION_BADGE[lane.activationState] || 'bg-line/20 text-muted'
                          }`}
                        >
                          {lane.activationState}
                        </span>
                      )}
                      <span className="text-[10px] text-muted">{lane.domain}</span>
                    </div>
                  </div>

                  {months.map((month) => (
                    <div
                      key={month.key}
                      className={`px-1 py-2 border-b border-line/20 flex flex-col gap-1 items-center ${
                        anchorMonths.has(month.key) ? 'bg-amber-400/5' : ''
                      } ${stripe ? 'bg-jericho-surface/20' : ''}`}
                    >
                      {(byMonth[month.key] || []).map((ms) => (
                        <MilestoneDot key={ms.id} milestone={ms} />
                      ))}
                    </div>
                  ))}
                </React.Fragment>
              );
            })}
          </div>
        </div>
      )}

      {anchors.length > 0 && <AnchorList anchors={anchors} />}
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function PlanHeader({ plan, anchors }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <h2 className="text-base font-semibold text-jericho-text">{plan.title}</h2>
        {plan.northStarOutcome && (
          <p className="text-sm text-muted mt-0.5">{plan.northStarOutcome}</p>
        )}
      </div>
      <div className="flex items-center gap-3 text-xs text-muted shrink-0">
        {plan.horizonEnd && (
          <span>
            through{' '}
            <span className="text-jericho-text font-medium">
              {new Date(plan.horizonEnd).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
            </span>
          </span>
        )}
        {plan.status && (
          <span
            className={`px-2 py-0.5 rounded-full border text-[11px] ${
              plan.status === 'active'
                ? 'border-green-400/50 text-green-600'
                : 'border-line/50 text-muted'
            }`}
          >
            {plan.status}
          </span>
        )}
      </div>
    </div>
  );
}

function MilestoneDot({ milestone }) {
  const [hover, setHover] = React.useState(false);

  return (
    <div className="relative flex flex-col items-center">
      <div
        className={`w-2.5 h-2.5 rounded-full cursor-default ${
          STATUS_DOT[milestone.status] || 'bg-line'
        } ${TYPE_RING[milestone.milestoneType] || ''}`}
        aria-label={`${milestone.title} · ${milestone.targetDate} · ${milestone.milestoneType}`}
        data-testid={`milestone-dot-${milestone.id}`}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
      />
      {hover && (
        <div className="absolute bottom-full mb-1 z-10 w-48 bg-jericho-surface border border-line/60 rounded-lg p-2 shadow-lg text-left pointer-events-none">
          <p className="text-[11px] font-medium text-jericho-text leading-tight">{milestone.title}</p>
          <p className="text-[10px] text-muted mt-0.5">{milestone.targetDate}</p>
          {milestone.flex && <p className="text-[10px] text-muted mt-0.5">Flex: {milestone.flex}</p>}
          {milestone.missConsequence && (
            <p className="text-[10px] text-amber-500 mt-1">{milestone.missConsequence}</p>
          )}
          {milestone.derivedFrom && (
            <p className="text-[10px] text-muted/60 mt-1 italic">{milestone.derivedFrom}</p>
          )}
        </div>
      )}
    </div>
  );
}

function AnchorList({ anchors }) {
  return (
    <div className="flex flex-wrap gap-2">
      {anchors.map((anchor) => (
        <div
          key={anchor.id}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-amber-400/40 bg-amber-400/5 text-xs"
        >
          <span className="text-amber-400">▾</span>
          <span className="font-medium text-jericho-text">{anchor.label}</span>
          <span className="text-muted">{anchor.date}</span>
          {anchor.isFixed && (
            <span className="text-[10px] text-amber-500 font-medium">fixed</span>
          )}
        </div>
      ))}
    </div>
  );
}
