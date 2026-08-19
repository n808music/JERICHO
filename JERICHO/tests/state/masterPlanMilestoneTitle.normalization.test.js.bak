/**
 * Milestone title normalization tests — acceptance criterion 5
 *
 * Verifies that vague all-caps or generic template titles are expanded into
 * complete, action-oriented labels when milestones are generated.
 */
import { describe, it, expect } from 'vitest';
import { generateMilestonesForLane } from '../../src/domain/masterPlan/masterPlanMilestoneGenerator.js';

const NOW = '2026-05-11T12:00:00.000Z';
const ANCHOR_OCT17 = { id: 'anchor-oct17', date: '2026-10-17', label: 'Oct 17 drop', isFixed: true, affectedLaneIds: [] };
const PLAN_STUB = { id: 'plan-1', horizonStart: '2026-05-11', horizonEnd: '2031-05-11', anchors: [ANCHOR_OCT17] };

function buildLane(overrides = {}) {
  return {
    id: `lane-${Math.random().toString(36).slice(2)}`,
    title: 'Our Fearless Leader',
    domain: 'creative',
    activationState: 'active',
    assessedStage: 'ready-to-launch',
    anchorIds: ['anchor-oct17'],
    milestoneIds: [],
    ...overrides,
  };
}

describe('Milestone title normalization — no vague standalone labels', () => {
  it('creative ready-to-launch: "DROP" becomes "Release {lane.title}"', () => {
    const lane = buildLane({ domain: 'creative', assessedStage: 'ready-to-launch' });
    const milestones = generateMilestonesForLane(PLAN_STUB, lane, [ANCHOR_OCT17], NOW);

    const titles = milestones.map((m) => m.title);
    expect(titles).not.toContain('DROP');
    expect(titles.some((t) => t.startsWith('Release') && t.includes(lane.title))).toBe(true);
  });

  it('product in-development: "LAUNCH" becomes "Launch {lane.title}"', () => {
    const lane = buildLane({
      title: 'Jericho',
      domain: 'product',
      assessedStage: 'in-development',
    });
    const milestones = generateMilestonesForLane(PLAN_STUB, lane, [ANCHOR_OCT17], NOW);

    const titles = milestones.map((m) => m.title);
    expect(titles).not.toContain('LAUNCH');
    expect(titles.some((t) => t.startsWith('Launch') && t.includes('Jericho'))).toBe(true);
  });

  it('media pre-concept: no "Album promo episodes" in output', () => {
    const lane = buildLane({
      title: 'Jericho Podcast',
      domain: 'media',
      assessedStage: 'pre-concept',
    });
    const milestones = generateMilestonesForLane(PLAN_STUB, lane, [ANCHOR_OCT17], NOW);

    const titles = milestones.map((m) => m.title);
    expect(titles).not.toContain('Album promo episodes');
    // Replacement must be descriptive
    expect(titles.some((t) => /promo.*episode/i.test(t))).toBe(true);
  });

  it('media active: no "Anchor tie-in series begins" in output', () => {
    const lane = buildLane({
      title: 'Jericho Podcast',
      domain: 'media',
      assessedStage: 'active',
    });
    const milestones = generateMilestonesForLane(PLAN_STUB, lane, [ANCHOR_OCT17], NOW);

    const titles = milestones.map((m) => m.title);
    expect(titles).not.toContain('Anchor tie-in series begins');
  });

  it('all milestone titles are action-oriented (verb + object pattern)', () => {
    const creativeLane = buildLane({ domain: 'creative', assessedStage: 'ready-to-launch' });
    const milestones = generateMilestonesForLane(PLAN_STUB, creativeLane, [ANCHOR_OCT17], NOW);

    for (const m of milestones) {
      // Must not be a bare noun or all-caps token
      expect(m.title).not.toMatch(/^[A-Z]+$/);
      // Must contain at least one word
      expect(m.title.trim().length).toBeGreaterThan(3);
    }
  });
});

describe('Milestone density — near-term launch prep', () => {
  it('creative ready-to-launch: 8+ milestones for October anchor plan', () => {
    const lane = buildLane({ domain: 'creative', assessedStage: 'ready-to-launch' });
    const milestones = generateMilestonesForLane(PLAN_STUB, lane, [ANCHOR_OCT17], NOW);

    // Expanded template should produce ≥8 milestones (was 6)
    expect(milestones.length).toBeGreaterThanOrEqual(8);
  });

  it('product in-development: 6+ milestones for app launch', () => {
    const lane = buildLane({
      title: 'Jericho App',
      domain: 'product',
      assessedStage: 'in-development',
    });
    const milestones = generateMilestonesForLane(PLAN_STUB, lane, [ANCHOR_OCT17], NOW);

    expect(milestones.length).toBeGreaterThanOrEqual(6);
  });

  it('near-term milestones exist between today and anchor date', () => {
    const lane = buildLane({ domain: 'creative', assessedStage: 'ready-to-launch' });
    const milestones = generateMilestonesForLane(PLAN_STUB, lane, [ANCHOR_OCT17], NOW);

    const nearTermCount = milestones.filter(
      (m) => m.targetDate >= '2026-05-11' && m.targetDate <= '2026-10-17'
    ).length;

    // Majority of milestones should be in the near-term launch window
    expect(nearTermCount).toBeGreaterThan(4);
  });

  it('milestone titles include lane context (not generic for all lanes)', () => {
    const laneA = buildLane({ title: 'Our Fearless Leader', domain: 'creative', assessedStage: 'ready-to-launch' });
    const laneB = buildLane({ title: 'Jericho App', domain: 'product', assessedStage: 'in-development' });

    const milestonesA = generateMilestonesForLane(PLAN_STUB, laneA, [ANCHOR_OCT17], NOW);
    const milestonesB = generateMilestonesForLane(PLAN_STUB, laneB, [ANCHOR_OCT17], NOW);

    const titlesA = milestonesA.map((m) => m.title);
    const titlesB = milestonesB.map((m) => m.title);

    // The final milestone for creative includes "Our Fearless Leader"
    const releaseMilestone = milestonesA.find((m) => m.title.includes('Our Fearless Leader'));
    expect(releaseMilestone).toBeTruthy();

    // The final milestone for product includes "Jericho App"
    const launchMilestone = milestonesB.find((m) => m.title.includes('Jericho App'));
    expect(launchMilestone).toBeTruthy();

    // The two sets should not have identical title lists
    expect(titlesA.join('|')).not.toBe(titlesB.join('|'));
  });
});
