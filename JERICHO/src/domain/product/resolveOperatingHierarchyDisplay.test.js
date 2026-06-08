import { describe, expect, it } from 'vitest';

import { resolveOperatingHierarchyDisplay } from './resolveOperatingHierarchyDisplay.js';

describe('resolveOperatingHierarchyDisplay', () => {
  it('returns the full hierarchy when metadata is present', () => {
    expect(
      resolveOperatingHierarchyDisplay({
        block: {
          title: 'Clarify launch-blocker requirements',
          phaseLabel: 'P1',
          laneLabel: 'Product / Software',
        },
        operatingCycle: 'June 2026 Review Window',
        sprint: 'Jun 8–Jun 19 Sprint',
        initiative: 'Jericho System',
      })
    ).toEqual({
      masterPlan: 'Operation Endgame',
      activatedPlan: 'Activated Plan',
      phase: 'P1 Launch / Proof',
      operatingCycle: 'June 2026 Review Window',
      sprint: 'Jun 8–Jun 19 Sprint',
      lane: 'Product / Software',
      initiative: 'Jericho System',
      block: 'Clarify launch-blocker requirements',
      milestoneType: '',
    });
  });

  it('falls back to the lane when no initiative label is available', () => {
    const result = resolveOperatingHierarchyDisplay({
      block: {
        title: 'Prep episode outline',
        phaseLabel: 'P1',
        laneLabel: 'Creative / Entertainment',
      },
    });

    expect(result.lane).toBe('Creative / Entertainment');
    expect(result.initiative).toBe('Creative / Entertainment');
  });

  it('handles missing sprint and operating cycle metadata gracefully', () => {
    expect(
      resolveOperatingHierarchyDisplay({
        block: {
          title: 'Stabilize activation checks',
          phaseLabel: 'P2',
          laneLabel: 'Operations / Systems',
        },
      })
    ).toMatchObject({
      phase: 'P2 Conversion / Operating System',
      operatingCycle: '',
      sprint: '',
      lane: 'Operations / Systems',
      initiative: 'Operations / Systems',
    });
  });

  it('renders clear phase labels for later phases', () => {
    expect(
      resolveOperatingHierarchyDisplay({
        block: {
          title: 'Terminal readiness review',
          phaseLabel: 'P3',
          laneLabel: 'Capital / Holdings',
        },
      }).phase
    ).toBe('P3 Scale / Terminal Readiness');
  });

  it('renders a macro milestone label for cross-lane launch convergence blocks', () => {
    expect(
      resolveOperatingHierarchyDisplay({
        block: {
          title: 'Operation Endgame Public Launch Convergence',
          phaseLabel: 'P1',
          laneLabel: 'Cross-lane convergence',
          blockType: 'milestone',
        },
      }).milestoneType
    ).toBe('Macro Milestone');
  });

  it('renders a lane milestone label when milestone scope stays inside one lane', () => {
    expect(
      resolveOperatingHierarchyDisplay({
        block: {
          title: 'Sequence release asset completion',
          phaseLabel: 'P1',
          laneLabel: 'Creative / Entertainment',
          blockType: 'milestone',
        },
      }).milestoneType
    ).toBe('Lane Milestone');
  });
});
