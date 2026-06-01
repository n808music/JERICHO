/**
 * GoalTimeline — adapts a single goal's cycle state into TimelineGrid props.
 *
 * Data mapping:
 *   proposedBlocks (via getCanonicalProposedBlocks)
 *     → grouped by domain → LaneShape per domain
 *     → split into time thirds within each domain → MilestoneShape per bucket
 *   goalContract.deadlineISO || definiteGoal.deadlineDayKey → anchor
 *   goalContract.activationDateISO || cycle.startedAtDayKey  → horizonStart
 *
 * Flags (data model gaps surfaced during this refactor):
 *
 *   FLAG 1 — No phase tags on blocks.
 *     Blocks have no `phase` field. Time-bucket grouping (thirds) is the fallback.
 *     When the block data model gains explicit phase tagging, replace the thirds
 *     split with phase-key grouping here. Grid rendering is unchanged.
 *
 *   FLAG 2 — Domain values are ALL_CAPS ('BODY', 'CREATION', 'RESOURCES', 'FOCUS').
 *     Master plan lanes use lowercase ('creative', 'income', etc.).
 *     TimelineGrid's DOMAIN_ACCENT handles both forms. If a unified domain enum
 *     is introduced, remove the dual mapping there.
 *
 *   FLAG 3 — Deadline is in two places with different field names.
 *     goalContract.deadlineISO (ISO string) vs definiteGoal.deadlineDayKey (day key).
 *     Adapter tries goalContract first. A single canonical deadline selector
 *     would remove this branching.
 *
 *   FLAG 4 — No lane labels on goal blocks.
 *     Lane titles here are human-readable domain names ('Creation', 'Focus').
 *     Master plan lanes have user-authored titles ('Album / label rollout').
 *     When goal state gains block-level theme or phase labels, use those as
 *     lane titles instead. No grid changes required.
 */
import React, { useMemo } from 'react';
import { useIdentityStore } from '../../state/identityStore.js';
import { getCanonicalProposedBlocks } from '../../state/cycleSelectors.js';
import TimelineGrid from './TimelineGrid.jsx';
import { MILESTONE_TYPE, MILESTONE_STATUS, LANE_ACTIVATION_STATE } from '../../domain/masterPlan/masterPlanSchema.js';

// ─── Domain → display label ───────────────────────────────────────────────────

const DOMAIN_LABEL = {
  BODY: 'Body',
  CREATION: 'Creation',
  RESOURCES: 'Resources',
  FOCUS: 'Focus',
};

// ─── Milestone status from block completion ───────────────────────────────────

function deriveBucketStatus(blocks) {
  if (!blocks.length) return MILESTONE_STATUS.PENDING;
  const completed = blocks.filter((b) => b.status === 'completed').length;
  const missed = blocks.filter((b) => b.status === 'missed').length;
  if (completed === blocks.length) return MILESTONE_STATUS.COMPLETE;
  if (completed > 0) return MILESTONE_STATUS.IN_PROGRESS;
  if (missed / blocks.length > 0.3) return MILESTONE_STATUS.AT_RISK;
  return MILESTONE_STATUS.PENDING;
}

// ─── Adapter ──────────────────────────────────────────────────────────────────

function adaptGoalToTimelineProps(state) {
  const activeCycleId = state.activeCycleId;
  if (!activeCycleId) return null;

  const cycle = state.cyclesById?.[activeCycleId];
  if (!cycle) return null;

  const goalContract = cycle.goalContract;

  // FLAG 3: deadline in two places — prefer goalContract.deadlineISO
  const horizonEnd =
    goalContract?.deadlineISO ||
    cycle.definiteGoal?.deadlineDayKey ||
    null;

  const horizonStart =
    goalContract?.activationDateISO ||
    cycle.startedAtDayKey ||
    state.appTime?.activeDayKey ||
    null;

  // Use the canonical proposed block source (per cycleSelectors.js contract)
  const blocks = getCanonicalProposedBlocks(
    cycle.proposedBlocks || [],
    cycle.suggestedBlocks || []
  );

  // Group by normalized domain (ALL_CAPS)
  const byDomain = {};
  for (const block of blocks) {
    // Blocks may carry either `domain` (normalized) or `practice` (display label).
    // Prefer `domain`; fall back to uppercasing `practice`.
    const domainKey = block.domain || (block.practice ? block.practice.toUpperCase() : 'FOCUS');
    if (!byDomain[domainKey]) byDomain[domainKey] = [];
    byDomain[domainKey].push(block);
  }

  const startDate = horizonStart ? new Date(horizonStart) : null;
  const endDate = horizonEnd ? new Date(horizonEnd) : null;
  const totalMs = startDate && endDate ? endDate.getTime() - startDate.getTime() : 0;

  const lanes = [];
  const milestones = [];

  const domainEntries = Object.entries(byDomain).sort((a, b) => b[1].length - a[1].length);

  for (const [domain, domainBlocks] of domainEntries) {
    const laneId = `goal-lane-${domain}`;
    const lane = {
      id: laneId,
      // FLAG 4: generic domain name — replace with user-authored label when available
      title: DOMAIN_LABEL[domain] || domain,
      domain,
      activationState: LANE_ACTIVATION_STATE.ACTIVE,
    };

    if (totalMs > 0) {
      // Split into thirds: Opening / Build / Final push
      // FLAG 1: when blocks gain phase tags, replace this time-bucket logic
      const thirdMs = totalMs / 3;
      const thirds = [
        { label: 'Opening', endMs: startDate.getTime() + thirdMs, type: MILESTONE_TYPE.CHECKPOINT },
        { label: 'Build', endMs: startDate.getTime() + 2 * thirdMs, type: MILESTONE_TYPE.CHECKPOINT },
        { label: 'Final push', endMs: endDate.getTime(), type: MILESTONE_TYPE.ANCHOR },
      ];

      const buckets = thirds.map(() => []);
      for (const block of domainBlocks) {
        const blockMs = block.start ? new Date(block.start).getTime() : 0;
        const idx = blockMs <= thirds[0].endMs ? 0 : blockMs <= thirds[1].endMs ? 1 : 2;
        buckets[idx].push(block);
      }

      for (let i = 0; i < thirds.length; i++) {
        const bucket = buckets[i];
        if (!bucket.length) continue;

        const msId = `goal-ms-${domain}-${i}`;
        const targetDate = new Date(thirds[i].endMs).toISOString().slice(0, 10);
        const ms = {
          id: msId,
          laneId,
          title: `${thirds[i].label} · ${bucket.length} block${bucket.length !== 1 ? 's' : ''}`,
          targetDate,
          milestoneType: thirds[i].type,
          flex: i === 2 ? 'none' : 'low',
          status: deriveBucketStatus(bucket),
          missConsequence: '',
          derivedFrom: `${bucket.length} ${DOMAIN_LABEL[domain] || domain} block${bucket.length !== 1 ? 's' : ''}`,
        };
        milestones.push(ms);
      }
    } else {
      // No horizon — one milestone per domain at the last block's date
      const sortedBlocks = [...domainBlocks].sort((a, b) =>
        (a.start || '') > (b.start || '') ? 1 : -1
      );
      const lastDate = sortedBlocks[sortedBlocks.length - 1]?.start?.slice(0, 10) || '';
      const ms = {
        id: `goal-ms-${domain}-0`,
        laneId,
        title: `${domainBlocks.length} block${domainBlocks.length !== 1 ? 's' : ''}`,
        targetDate: lastDate,
        milestoneType: MILESTONE_TYPE.CHECKPOINT,
        flex: 'high',
        status: deriveBucketStatus(domainBlocks),
        missConsequence: '',
        derivedFrom: `${domainBlocks.length} ${DOMAIN_LABEL[domain] || domain} blocks`,
      };
      milestones.push(ms);
    }

    lanes.push(lane);
  }

  const goalOutcome = cycle.definiteGoal?.outcome || goalContract?.goalLabel || '';

  const anchors = horizonEnd
    ? [
        {
          id: 'goal-deadline',
          date: horizonEnd,
          label: goalOutcome || 'Deadline',
          isFixed: true,
          affectedLaneIds: lanes.map((l) => l.id),
          priority: 0,
        },
      ]
    : [];

  const plan = {
    id: activeCycleId,
    title: goalOutcome || 'Current Goal',
    northStarOutcome: goalContract?.success?.[0]?.metricName
      ? `Target: ${goalContract.success[0].metricName}`
      : '',
    horizonStart,
    horizonEnd,
    status: cycle.status || 'active',
  };

  return { plan, lanes, milestones, anchors };
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function GoalTimeline() {
  const store = useIdentityStore();
  const adapted = useMemo(() => adaptGoalToTimelineProps(store), [store]);

  if (!adapted) {
    return (
      <p className="text-muted text-sm p-4">
        No active goal. Go to Structure to set up a goal first.
      </p>
    );
  }

  const { plan, lanes, milestones, anchors } = adapted;

  if (lanes.length === 0) {
    return (
      <div className="space-y-3">
        <p className="text-sm font-medium text-jericho-text">{plan.title}</p>
        <p className="text-muted text-sm">
          No scheduled blocks yet. Generate a plan from Structure to see the timeline.
        </p>
      </div>
    );
  }

  return (
    <TimelineGrid
      plan={plan}
      lanes={lanes}
      milestones={milestones}
      anchors={anchors}
      emptyMessage="No blocks scheduled yet."
    />
  );
}
