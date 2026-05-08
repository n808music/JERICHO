/**
 * Milestone generator — deterministic backward (or forward) scheduling
 * from a plan's anchors and each lane's domain + assessedStage.
 *
 * Contract:
 *   generateMilestonesForLane(plan, lane, planAnchors, nowISO)
 *     → Milestone[]  (not yet written to store — caller owns persistence)
 *
 * Placement authority:
 *   Lanes with an anchor → milestones placed backward from anchor via deriveTargetDateFromAnchor.
 *   Lanes without a hard anchor (brand, income) → milestones placed forward from today.
 *   The anchor for a lane is resolved in this priority:
 *     1. planAnchors where lane.id appears in anchor.affectedLaneIds
 *     2. latest fixed anchor on the plan (isFixed: true)
 *     3. latest anchor on the plan regardless of isFixed
 *     4. no anchor → forward-only placement
 */
import { buildMilestone, deriveTargetDateFromAnchor } from './masterPlanFactory.js';
import { MILESTONE_TYPE, MILESTONE_FLEX } from './masterPlanSchema.js';

// ─── Template shape ───────────────────────────────────────────────────────────
// offsetWeeks  — weeks before anchor (backward placement). offsetWeeks: 0 = anchor date.
// forwardWeeks — weeks after today (forward placement). Use when lane has no hard deadline.
// milestoneType defaults to 'checkpoint'.

const T = MILESTONE_TYPE;
const F = MILESTONE_FLEX;

// ─── Domain × stage templates ─────────────────────────────────────────────────

const TEMPLATES = {
  creative: {
    'ready-to-launch': [
      { title: 'Distribution submitted',   offsetWeeks: 20, flex: F.NONE, type: T.GATE,       miss: 'DSPs require lead time — missing this collapses the release date.' },
      { title: 'Artwork finalized',        offsetWeeks: 18, flex: F.LOW,  type: T.CHECKPOINT, miss: 'Distribution cannot be submitted without approved artwork.' },
      { title: 'Pre-release single 1',     offsetWeeks: 10, flex: F.HIGH, type: T.CHECKPOINT, miss: '' },
      { title: 'Pre-release single 2',     offsetWeeks: 6,  flex: F.HIGH, type: T.CHECKPOINT, miss: '' },
      { title: 'Final promo push begins',  offsetWeeks: 4,  flex: F.LOW,  type: T.CHECKPOINT, miss: 'Reduces awareness window before release.' },
      { title: 'DROP',                     offsetWeeks: 0,  flex: F.NONE, type: T.ANCHOR,     miss: 'Hard date — all lanes cascade from this.' },
    ],
    'in-development': [
      { title: 'Creative work complete',   offsetWeeks: 12, flex: F.LOW,  type: T.CHECKPOINT, miss: 'Distribution timeline cannot begin.' },
      { title: 'Mastering complete',       offsetWeeks: 10, flex: F.LOW,  type: T.CHECKPOINT, miss: '' },
      { title: 'Distribution submitted',   offsetWeeks: 8,  flex: F.NONE, type: T.CHECKPOINT, miss: 'Missing this collapses the release date.' },
      { title: 'Pre-release content',      offsetWeeks: 4,  flex: F.HIGH, type: T.CHECKPOINT, miss: '' },
      { title: 'Release',                  offsetWeeks: 0,  flex: F.NONE, type: T.ANCHOR,     miss: 'Hard date — all lanes cascade from this.' },
    ],
    'near-complete': [
      { title: 'Mastering / finish complete', offsetWeeks: 8,  flex: F.LOW,  type: T.CHECKPOINT, miss: '' },
      { title: 'Distribution submitted',      offsetWeeks: 6,  flex: F.NONE, type: T.CHECKPOINT, miss: 'Missing this collapses the release date.' },
      { title: 'Pre-release push',            offsetWeeks: 3,  flex: F.HIGH, type: T.CHECKPOINT, miss: '' },
      { title: 'Release',                     offsetWeeks: 0,  flex: F.NONE, type: T.ANCHOR,     miss: 'Hard date.' },
    ],
    default: [
      { title: 'Work begins',       offsetWeeks: 16, flex: F.HIGH, type: T.CHECKPOINT, miss: '' },
      { title: 'First draft done',  offsetWeeks: 8,  flex: F.LOW,  type: T.CHECKPOINT, miss: '' },
      { title: 'Ready to release',  offsetWeeks: 4,  flex: F.LOW,  type: T.CHECKPOINT, miss: '' },
      { title: 'Release',           offsetWeeks: 0,  flex: F.NONE, type: T.ANCHOR,     miss: '' },
    ],
  },

  product: {
    'in-development': [
      { title: 'Feature freeze',                    offsetWeeks: 14, flex: F.LOW,  type: T.CHECKPOINT, miss: 'Scope creep past this point delays launch.' },
      { title: 'Internal test complete',            offsetWeeks: 10, flex: F.LOW,  type: T.CHECKPOINT, miss: '' },
      { title: 'Closed beta',                       offsetWeeks: 8,  flex: F.HIGH, type: T.CHECKPOINT, miss: '' },
      { title: 'App store submitted',               offsetWeeks: 4,  flex: F.NONE, type: T.GATE,       miss: 'Review windows are fixed; missing this kills the launch date.' },
      { title: 'LAUNCH',                            offsetWeeks: 0,  flex: F.NONE, type: T.ANCHOR,     miss: 'Hard date.' },
    ],
    'near-complete': [
      { title: 'Final polish done',              offsetWeeks: 6,  flex: F.LOW,  type: T.CHECKPOINT, miss: '' },
      { title: 'Platform submitted',             offsetWeeks: 4,  flex: F.NONE, type: T.CHECKPOINT, miss: 'Review window is fixed.' },
      { title: 'Launch',                         offsetWeeks: 0,  flex: F.NONE, type: T.ANCHOR,     miss: 'Hard date.' },
    ],
    'ready-to-launch': [
      { title: 'Platform submitted', offsetWeeks: 4,  flex: F.NONE, type: T.CHECKPOINT, miss: 'Review window is fixed.' },
      { title: 'Launch',             offsetWeeks: 0,  flex: F.NONE, type: T.ANCHOR,     miss: 'Hard date.' },
    ],
    'active': [
      { title: 'Release milestone', offsetWeeks: 0, flex: F.NONE, type: T.ANCHOR, miss: '' },
    ],
    default: [
      { title: 'Core feature complete', offsetWeeks: 16, flex: F.HIGH, type: T.CHECKPOINT, miss: '' },
      { title: 'Beta',                  offsetWeeks: 8,  flex: F.HIGH, type: T.CHECKPOINT, miss: '' },
      { title: 'Submitted',             offsetWeeks: 4,  flex: F.NONE, type: T.CHECKPOINT, miss: '' },
      { title: 'Launch',                offsetWeeks: 0,  flex: F.NONE, type: T.ANCHOR,     miss: '' },
    ],
  },

  media: {
    'pre-concept': [
      { title: 'Episodes 1–3 recorded',      offsetWeeks: 8, flex: F.HIGH, type: T.CHECKPOINT, miss: 'Cannot list on directories without initial batch.' },
      { title: 'Distribution set up',        offsetWeeks: 7, flex: F.LOW,  type: T.CHECKPOINT, miss: 'Approval windows vary by platform.' },
      { title: 'Launch episode live',        offsetWeeks: 6, flex: F.LOW,  type: T.CHECKPOINT, miss: 'Must precede anchor date to build audience.' },
      { title: 'Album promo episodes',       offsetWeeks: 4, flex: F.HIGH, type: T.CHECKPOINT, miss: '' },
    ],
    'pre-launch': [
      { title: 'Episodes 1–3 recorded',      offsetWeeks: 8, flex: F.HIGH, type: T.CHECKPOINT, miss: 'Cannot list on directories without initial batch.' },
      { title: 'Distribution set up',        offsetWeeks: 7, flex: F.LOW,  type: T.CHECKPOINT, miss: 'Approval windows vary by platform.' },
      { title: 'Launch episode live',        offsetWeeks: 6, flex: F.LOW,  type: T.CHECKPOINT, miss: 'Must precede anchor date to build audience.' },
      { title: 'Album promo episodes',       offsetWeeks: 4, flex: F.HIGH, type: T.CHECKPOINT, miss: '' },
    ],
    'in-development': [
      { title: 'Episodes batch complete',    offsetWeeks: 6, flex: F.HIGH, type: T.CHECKPOINT, miss: '' },
      { title: 'Distribution live',          offsetWeeks: 5, flex: F.LOW,  type: T.CHECKPOINT, miss: '' },
      { title: 'Anchor promo push',          offsetWeeks: 4, flex: F.HIGH, type: T.CHECKPOINT, miss: '' },
    ],
    'active': [
      { title: 'Anchor tie-in series begins', offsetWeeks: 6, flex: F.HIGH, type: T.CHECKPOINT, miss: '' },
      { title: 'Promo episodes complete',     offsetWeeks: 2, flex: F.LOW,  type: T.CHECKPOINT, miss: '' },
    ],
    default: [
      { title: 'First content produced', offsetWeeks: 8, flex: F.HIGH, type: T.CHECKPOINT, miss: '' },
      { title: 'Channel live',           offsetWeeks: 6, flex: F.LOW,  type: T.CHECKPOINT, miss: '' },
      { title: 'Promo push',             offsetWeeks: 4, flex: F.HIGH, type: T.CHECKPOINT, miss: '' },
    ],
  },

  // Forward-from-today lanes — no hard anchor expected
  brand: {
    default: [
      { title: 'Positioning complete',          forwardWeeks: 2,  flex: F.LOW,  type: T.CHECKPOINT, miss: 'Outreach without clear positioning reduces conversion.' },
      { title: 'Outreach started',              forwardWeeks: 3,  flex: F.LOW,  type: T.CHECKPOINT, miss: '' },
      { title: 'First client or contract closed', forwardWeeks: 8, flex: F.HIGH, type: T.GATE,       miss: 'Income stream unblocked only after first closed deal.' },
    ],
    'in-development': [
      { title: 'Assets / site updated',         forwardWeeks: 2,  flex: F.LOW,  type: T.CHECKPOINT, miss: '' },
      { title: 'Repositioning announced',       forwardWeeks: 4,  flex: F.LOW,  type: T.CHECKPOINT, miss: '' },
      { title: 'Pipeline engaged',              forwardWeeks: 6,  flex: F.HIGH, type: T.CHECKPOINT, miss: '' },
    ],
    'active': [
      { title: 'Repositioning complete', forwardWeeks: 3,  flex: F.LOW,  type: T.CHECKPOINT, miss: '' },
      { title: 'Growth milestone',       forwardWeeks: 10, flex: F.HIGH, type: T.CHECKPOINT, miss: '' },
    ],
  },

  income: {
    default: [
      { title: 'First revenue event',             forwardWeeks: 8,  flex: F.NONE, type: T.GATE,       miss: 'Income constraint — revenue required within 60 days.' },
      { title: 'Recurring pipeline established',  forwardWeeks: 16, flex: F.HIGH, type: T.CHECKPOINT, miss: '' },
    ],
    'active': [
      { title: 'Revenue milestone',        forwardWeeks: 4,  flex: F.LOW,  type: T.CHECKPOINT, miss: '' },
      { title: 'Scale / retention target', forwardWeeks: 12, flex: F.HIGH, type: T.CHECKPOINT, miss: '' },
    ],
  },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getTemplate(domain, assessedStage) {
  const domainTemplates = TEMPLATES[domain];
  if (!domainTemplates) return null;
  // Exact stage match first, then 'default'
  return domainTemplates[assessedStage] || domainTemplates['default'] || null;
}

function findPrimaryAnchor(lane, planAnchors) {
  if (!planAnchors || planAnchors.length === 0) return null;
  const sorted = [...planAnchors].sort((a, b) => (a.date < b.date ? -1 : 1));
  // 1. Anchor explicitly linked to this lane
  if (lane.anchorIds && lane.anchorIds.length > 0) {
    const linked = sorted.find((a) => lane.anchorIds.includes(a.id));
    if (linked) return linked;
  }
  // 2. Latest fixed anchor on the plan
  const fixed = sorted.filter((a) => a.isFixed);
  if (fixed.length > 0) return fixed[fixed.length - 1];
  // 3. Latest anchor overall
  return sorted[sorted.length - 1];
}

function addWeeks(isoDate, weeks) {
  const d = new Date(isoDate);
  d.setDate(d.getDate() + weeks * 7);
  return d.toISOString().slice(0, 10);
}

// ─── Main export ──────────────────────────────────────────────────────────────

/**
 * Generates milestones for a single lane.
 * Returns an array of milestone objects ready to be written to masterPlanMilestonesById.
 * Does not mutate state — caller owns persistence.
 */
export function generateMilestonesForLane(plan, lane, planAnchors, nowISO) {
  const template = getTemplate(lane.domain, lane.assessedStage);
  if (!template || template.length === 0) return [];

  const anchor = findPrimaryAnchor(lane, planAnchors);
  const today = (nowISO || new Date().toISOString()).slice(0, 10);

  const milestones = [];

  for (const entry of template) {
    let targetDate;
    let derivedFrom;

    if (entry.forwardWeeks != null) {
      targetDate = addWeeks(today, entry.forwardWeeks);
      derivedFrom = `forward from today + ${entry.forwardWeeks} week${entry.forwardWeeks !== 1 ? 's' : ''}`;
    } else if (anchor) {
      const result = deriveTargetDateFromAnchor(anchor.date, entry.offsetWeeks, anchor.id);
      targetDate = result.targetDate;
      derivedFrom = result.derivedFrom;
    } else {
      // offsetWeeks entry with no anchor — skip; can't place it
      continue;
    }

    milestones.push(
      buildMilestone({
        laneId: lane.id,
        anchorId: anchor?.id || null,
        title: entry.title,
        milestoneType: entry.type || T.CHECKPOINT,
        targetDate,
        derivedFrom,
        flex: entry.flex || F.LOW,
        missConsequence: entry.miss || '',
        origin: 'system',
      })
    );
  }

  return milestones;
}
