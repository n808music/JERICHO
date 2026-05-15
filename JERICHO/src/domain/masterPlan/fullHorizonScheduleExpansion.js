import { dayKeyFromISO, addDays } from '../../state/time/time.ts';

// Simple deterministic full-horizon expansion engine.
// Produces dated blocks across the horizon per phase and per lane.

function mkId(planId, phaseLabel, laneId, dayKey, idx) {
  return `fh-${planId || 'plan'}-${phaseLabel || 'phase'}-${laneId || 'lane'}-${dayKey}-${idx}`;
}

function clampKey(key) {
  return String(key || '').slice(0, 10);
}

function nextDayKey(dayKey, days) {
  const d = new Date(`${dayKey}T12:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function expandFullHorizonSchedule({
  plan = {},
  phaseModel = null,
  horizonStartDayKey = null,
  horizonEndDayKey = null,
  lanes = [],
  existingForecastBlocks = [],
  committedBlocks = [],
} = {}) {
  const result = [];
  if (!phaseModel || !phaseModel.phases || !horizonStartDayKey || !horizonEndDayKey) {
    return existingForecastBlocks || [];
  }

  const planId = plan.id || (plan && plan.planId) || 'plan';

  for (const phase of phaseModel.phases) {
    const phaseLabel = phase.label || 'phase';
    const phaseStart = clampKey(phase.startBoundary || horizonStartDayKey);
    const phaseEnd = clampKey(phase.endBoundary || horizonEndDayKey);
    if (!phaseStart || !phaseEnd) continue;

    // Choose density by phase
    let intervalDays = 30; // default monthly
    if (phaseLabel === 'P1') intervalDays = 7; // weekly
    if (phaseLabel === 'P2') intervalDays = 14; // biweekly
    if (phaseLabel === 'P3') intervalDays = 90; // quarterly

    // For each lane, seed blocks across the phase range
    const targetLanes = Array.isArray(lanes) && lanes.length ? lanes : [null];
    for (const lane of targetLanes) {
      let cursor = phaseStart;
      let idx = 0;
      while (cursor && cursor <= phaseEnd) {
        const title = `${phaseLabel} work: ${lane?.laneTitle || lane?.title || 'general'} — checkpoint`;
        result.push({
          id: mkId(planId, phaseLabel, lane?.laneId || lane?.id || 'lane', cursor, idx),
          title,
          date: cursor,
          dayKey: cursor,
          start: `${cursor}T09:00:00.000Z`,
          end: `${cursor}T10:00:00.000Z`,
          phaseId: phase.id || null,
          phaseLabel,
          laneId: lane?.laneId || lane?.id || null,
          laneLabel: lane?.laneTitle || lane?.title || null,
          deliverableId: null,
          blockType: phaseLabel === 'P3' ? 'review' : 'action',
          commitmentState: 'forecast',
          executionEligibility: 'locked',
          executionLockReason: 'Full-horizon forecast: not executable until committed.',
          source: 'derived',
          expectedOutput: null,
          derivationReason: `Full-horizon expansion for ${phaseLabel}`,
          timeEstimateMinutes: 60,
          predecessors: [],
        });
        cursor = nextDayKey(cursor, intervalDays);
        idx++;
      }
    }
  }

  // Merge with existing committed blocks so active-cycle committed work stays present
  const merged = [...committedBlocks, ...result];
  // Deduplicate by id (committed first)
  const seen = new Set();
  const dedup = [];
  for (const b of merged) {
    if (!b || !b.id) continue;
    if (seen.has(b.id)) continue;
    seen.add(b.id);
    dedup.push(b);
  }
  return dedup;
}

export default expandFullHorizonSchedule;
