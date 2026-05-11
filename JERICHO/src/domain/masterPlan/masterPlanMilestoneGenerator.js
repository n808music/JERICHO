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
      { title: 'Upload and prepare release files for distribution',  offsetWeeks: 22, flex: F.LOW,  type: T.CHECKPOINT, miss: 'Files must be clean and tagged before submission.' },
      { title: 'Distribution submitted',                             offsetWeeks: 20, flex: F.NONE, type: T.GATE,       miss: 'DSPs require lead time — missing this collapses the release date.' },
      { title: 'Artwork finalized',                                  offsetWeeks: 18, flex: F.LOW,  type: T.CHECKPOINT, miss: 'Distribution cannot be submitted without approved artwork.' },
      { title: 'Press and playlist outreach begins',                 offsetWeeks: 14, flex: F.HIGH, type: T.CHECKPOINT, miss: 'Playlist consideration requires 4–6 weeks lead time.' },
      { title: 'Pre-release single 1',                              offsetWeeks: 10, flex: F.HIGH, type: T.CHECKPOINT, miss: '' },
      { title: 'Content creation sprint begins',                    offsetWeeks: 8,  flex: F.HIGH, type: T.CHECKPOINT, miss: 'Social and promotional assets must be built before promo window.' },
      { title: 'Pre-release single 2',                              offsetWeeks: 6,  flex: F.HIGH, type: T.CHECKPOINT, miss: '' },
      { title: 'Final promo push begins',                           offsetWeeks: 4,  flex: F.LOW,  type: T.CHECKPOINT, miss: 'Reduces awareness window before release.' },
      { title: 'Release-week campaign activated',                   offsetWeeks: 1,  flex: F.LOW,  type: T.CHECKPOINT, miss: 'Coordinated release-week push is highest-leverage day-of window.' },
      { title: 'DROP',                                               offsetWeeks: 0,  flex: F.NONE, type: T.ANCHOR,     miss: 'Hard date — all lanes cascade from this.' },
    ],
    'in-development': [
      { title: 'Recording sessions complete',  offsetWeeks: 16, flex: F.LOW,  type: T.CHECKPOINT, miss: 'Cannot mix or master without completed recordings.' },
      { title: 'Mixing complete',              offsetWeeks: 14, flex: F.LOW,  type: T.CHECKPOINT, miss: 'Mastering requires finalized mix.' },
      { title: 'Creative work complete',       offsetWeeks: 12, flex: F.LOW,  type: T.CHECKPOINT, miss: 'Distribution timeline cannot begin.' },
      { title: 'Mastering complete',           offsetWeeks: 10, flex: F.LOW,  type: T.CHECKPOINT, miss: '' },
      { title: 'Distribution submitted',       offsetWeeks: 8,  flex: F.NONE, type: T.CHECKPOINT, miss: 'Missing this collapses the release date.' },
      { title: 'Promotional assets ready',     offsetWeeks: 6,  flex: F.HIGH, type: T.CHECKPOINT, miss: 'Promo push requires assets built in advance.' },
      { title: 'Pre-release content',          offsetWeeks: 4,  flex: F.HIGH, type: T.CHECKPOINT, miss: '' },
      { title: 'Release',                      offsetWeeks: 0,  flex: F.NONE, type: T.ANCHOR,     miss: 'Hard date — all lanes cascade from this.' },
    ],
    'near-complete': [
      { title: 'Final mixing and mastering sessions',  offsetWeeks: 10, flex: F.LOW,  type: T.CHECKPOINT, miss: '' },
      { title: 'Mastering / finish complete',          offsetWeeks: 8,  flex: F.LOW,  type: T.CHECKPOINT, miss: '' },
      { title: 'Distribution submitted',               offsetWeeks: 6,  flex: F.NONE, type: T.CHECKPOINT, miss: 'Missing this collapses the release date.' },
      { title: 'Pre-release push',                     offsetWeeks: 3,  flex: F.HIGH, type: T.CHECKPOINT, miss: '' },
      { title: 'Release',                              offsetWeeks: 0,  flex: F.NONE, type: T.ANCHOR,     miss: 'Hard date.' },
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
      { title: 'Core feature set locked',           offsetWeeks: 18, flex: F.LOW,  type: T.CHECKPOINT, miss: 'Scope must be locked before QA can begin.' },
      { title: 'Feature freeze',                    offsetWeeks: 14, flex: F.LOW,  type: T.CHECKPOINT, miss: 'Scope creep past this point delays launch.' },
      { title: 'Internal test complete',            offsetWeeks: 10, flex: F.LOW,  type: T.CHECKPOINT, miss: '' },
      { title: 'Closed beta',                       offsetWeeks: 8,  flex: F.HIGH, type: T.CHECKPOINT, miss: '' },
      { title: 'Landing page and pricing live',     offsetWeeks: 6,  flex: F.HIGH, type: T.CHECKPOINT, miss: 'Pre-launch waitlist and pricing must be up before submission.' },
      { title: 'App store submitted',               offsetWeeks: 4,  flex: F.NONE, type: T.GATE,       miss: 'Review windows are fixed; missing this kills the launch date.' },
      { title: 'Pre-launch waitlist activation',    offsetWeeks: 2,  flex: F.HIGH, type: T.CHECKPOINT, miss: '' },
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
      { title: 'Record pilot episode batch (episodes 1–3)',         offsetWeeks: 10, flex: F.HIGH, type: T.CHECKPOINT, miss: 'Cannot list on directories without initial batch.' },
      { title: 'Set up podcast distribution and hosting',           offsetWeeks: 9,  flex: F.LOW,  type: T.CHECKPOINT, miss: 'Approval windows vary by platform.' },
      { title: 'Publish launch episode',                            offsetWeeks: 8,  flex: F.LOW,  type: T.CHECKPOINT, miss: 'Must precede anchor date to build audience.' },
      { title: 'Record and publish promo episodes supporting anchor', offsetWeeks: 4, flex: F.HIGH, type: T.CHECKPOINT, miss: '' },
    ],
    'pre-launch': [
      { title: 'Record pilot episode batch (episodes 1–3)',         offsetWeeks: 10, flex: F.HIGH, type: T.CHECKPOINT, miss: 'Cannot list on directories without initial batch.' },
      { title: 'Set up podcast distribution and hosting',           offsetWeeks: 9,  flex: F.LOW,  type: T.CHECKPOINT, miss: 'Approval windows vary by platform.' },
      { title: 'Publish launch episode',                            offsetWeeks: 8,  flex: F.LOW,  type: T.CHECKPOINT, miss: 'Must precede anchor date to build audience.' },
      { title: 'Record and publish promo episodes supporting anchor', offsetWeeks: 4, flex: F.HIGH, type: T.CHECKPOINT, miss: '' },
    ],
    'in-development': [
      { title: 'Complete current episode production batch',         offsetWeeks: 6, flex: F.HIGH, type: T.CHECKPOINT, miss: '' },
      { title: 'Publish podcast to distribution platform',          offsetWeeks: 5, flex: F.LOW,  type: T.CHECKPOINT, miss: '' },
      { title: 'Publish anchor-week promo content',                 offsetWeeks: 4, flex: F.HIGH, type: T.CHECKPOINT, miss: '' },
    ],
    'active': [
      { title: 'Begin anchor tie-in content series',               offsetWeeks: 6, flex: F.HIGH, type: T.CHECKPOINT, miss: '' },
      { title: 'Complete promo episode batch for anchor window',    offsetWeeks: 2, flex: F.LOW,  type: T.CHECKPOINT, miss: '' },
    ],
    default: [
      { title: 'Produce and publish first episode',   offsetWeeks: 8, flex: F.HIGH, type: T.CHECKPOINT, miss: '' },
      { title: 'Publish channel to distribution',     offsetWeeks: 6, flex: F.LOW,  type: T.CHECKPOINT, miss: '' },
      { title: 'Execute pre-launch promo campaign',   offsetWeeks: 4, flex: F.HIGH, type: T.CHECKPOINT, miss: '' },
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

  capital: {
    default: [
      { title: 'Capital path defined', forwardWeeks: 3, flex: F.LOW, type: T.CHECKPOINT, miss: 'Capital timing stays ambiguous and blocks downstream expansion.' },
      { title: 'Real-estate or asset thesis validated', forwardWeeks: 8, flex: F.HIGH, type: T.CHECKPOINT, miss: '' },
      { title: 'First capital-ready opportunity selected', forwardWeeks: 16, flex: F.HIGH, type: T.GATE, miss: 'Expansion remains abstract without a specific asset path.' },
    ],
  },

  institution: {
    default: [
      { title: 'Institution model defined', forwardWeeks: 4, flex: F.LOW, type: T.CHECKPOINT, miss: 'Education lane lacks a credible starting shape.' },
      { title: 'Requirements and compliance mapped', forwardWeeks: 10, flex: F.LOW, type: T.CHECKPOINT, miss: '' },
      { title: 'Pilot or founding path selected', forwardWeeks: 18, flex: F.HIGH, type: T.GATE, miss: 'Institution lane cannot move into execution.' },
    ],
  },

  civic: {
    default: [
      { title: 'District thesis documented', forwardWeeks: 4, flex: F.LOW, type: T.CHECKPOINT, miss: 'Civic lane remains vision-only.' },
      { title: 'Stakeholder map created', forwardWeeks: 8, flex: F.HIGH, type: T.CHECKPOINT, miss: '' },
      { title: 'First civic opportunity framed', forwardWeeks: 16, flex: F.HIGH, type: T.CHECKPOINT, miss: '' },
    ],
  },

  company: {
    default: [
      { title: 'Operating model defined', forwardWeeks: 2, flex: F.LOW, type: T.CHECKPOINT, miss: 'Execution stays fragmented across lanes.' },
      { title: 'Business-line sequence clarified', forwardWeeks: 6, flex: F.LOW, type: T.CHECKPOINT, miss: '' },
      { title: 'Company cadence established', forwardWeeks: 12, flex: F.HIGH, type: T.CHECKPOINT, miss: 'Scaling stays inconsistent without operating rhythm.' },
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

// ─── Title normalization ──────────────────────────────────────────────────────
// Converts vague template titles into complete, action-oriented labels using
// lane context. Rules are specific pattern matches, not generic string ops.

function normalizeMilestoneTitle(rawTitle, lane) {
  const laneLabel = lane.title || `${lane.domain} work`;

  // All-caps release/launch tokens → verb + lane object
  if (rawTitle === 'DROP') return `Release ${laneLabel}`;
  if (rawTitle === 'LAUNCH') return `Launch ${laneLabel}`;

  // Lowercase single-word tokens that appear as anchor entries
  if (/^release$/i.test(rawTitle)) return `Release ${laneLabel}`;
  if (/^launch$/i.test(rawTitle)) return `Launch ${laneLabel}`;

  // Media lane vague titles
  if (/^album promo episodes?$/i.test(rawTitle)) return `Record and publish promo episodes supporting ${laneLabel}`;
  if (/^anchor promo push$/i.test(rawTitle)) return `Publish anchor-week promo content for ${laneLabel}`;
  if (/^anchor tie-in series begins$/i.test(rawTitle)) return `Begin anchor tie-in content series for ${laneLabel}`;
  if (/^promo episodes? complete$/i.test(rawTitle)) return `Complete promo episode batch for ${laneLabel}`;
  if (/^promo push$/i.test(rawTitle)) return `Execute pre-release promo push for ${laneLabel}`;

  // Generic milestone titles — leave unchanged
  return rawTitle;
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
        title: normalizeMilestoneTitle(entry.title, lane),
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
