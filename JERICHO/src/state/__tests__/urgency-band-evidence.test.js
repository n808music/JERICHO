import { describe, it, expect } from 'vitest';
import { computeDerivedState } from '/Users/jamesdotson/vscode/JERICHO/JERICHO/src/state/identityCompute.js';

describe('Behavioral Verification: urgency band computation with fixed upstreamId/downstreamId', () => {
  it('CRITICAL urgency: blocker item gets marked CRITICAL when blocking a delivery in 5-day deadline lane', () => {
    // Setup: d1 (blocker) → d2 (blocked) in initiative with 5-day lane deadline
    // Expected: d1 should compute as CRITICAL because it blocks something with tight deadline

    const state = {
      matrix: {
        entitiesById: { e1: { id: 'e1', name: 'Entity 1' } },
        initiativesById: {
          init1: {
            id: 'init1',
            name: 'Test Initiative',
            owningEntityId: 'e1',
            laneId: 'lane1',
            phase: 'phase1',
            reviewStatus: 'CONFIRMED',
            declaredAtISO: '2026-08-30T00:00:00Z',
          },
        },
        projectsById: {
          p1: {
            id: 'p1',
            name: 'Test Project',
            owningInitiativeId: 'init1',
            declaredAtISO: '2026-08-30T00:00:00Z',
          },
        },
        deliverablesById: {
          blocker_item: {
            id: 'blocker_item',
            name: 'Blocker',
            owningProjectId: 'p1',
            owningInitiativeId: 'init1',
            phase: 'phase1',
            targetDate: null,
            reviewStatus: 'CONFIRMED',
            declaredAtISO: '2026-08-30T00:00:00Z',
          },
          blocked_item: {
            id: 'blocked_item',
            name: 'Blocked',
            owningProjectId: 'p1',
            owningInitiativeId: 'init1',
            phase: 'phase2',
            targetDate: null,
            reviewStatus: 'CONFIRMED',
            declaredAtISO: '2026-08-30T00:00:00Z',
          },
        },
        artifactsById: {},
        systemsById: {},
        // KEY FIX: Using corrected field names (upstreamId/downstreamId)
        dependenciesById: {
          dep1: {
            id: 'dep1',
            upstreamId: 'blocker_item',  // blocker is upstream
            downstreamId: 'blocked_item', // blocked is downstream
            kind: 'blocks',
          },
        },
      },
      masterPlanLanesById: {
        lane1: {
          id: 'lane1',
          laneEnd: '2026-09-04T23:59:59Z', // 5 days away = CRITICAL threshold
        },
      },
      masterPlanMilestonesById: {},
      planBlocks: {},
      appTime: {
        activeDayKey: '2026-08-30',
        timeIsPinned: true,
        nowISO: '2026-08-30T12:00:00.000Z',
      },
    };

    const derived = computeDerivedState(state, { type: 'INIT' });
    const ranking = derived.deliverableUrgencyRanking;

    // ASSERTION 1: Blocker item gets CRITICAL because it blocks something with 5-day deadline
    expect(ranking['blocker_item']).toBeDefined();
    expect(ranking['blocker_item'].urgencyBand).toBe('CRITICAL');
    expect(ranking['blocker_item'].blockedItems).toContain('blocked_item');
    expect(ranking['blocker_item'].daysToDeadline).toBeLessThan(7);

    // ASSERTION 2: This demonstrates the fix is working
    // The upstreamId/downstreamId fields are being read correctly in findBlockedDeliverables()
    // If the fields were still inverted (blockerId/blockedId), the traversal would fail or compute differently
  });

  it('HIGH urgency: blocker item gets marked HIGH when blocking a delivery in 10-day deadline lane', () => {
    const state = {
      matrix: {
        entitiesById: { e1: { id: 'e1', name: 'Entity 1' } },
        initiativesById: {
          init1: {
            id: 'init1',
            name: 'Test Initiative',
            owningEntityId: 'e1',
            laneId: 'lane1',
            phase: 'phase1',
            reviewStatus: 'CONFIRMED',
            declaredAtISO: '2026-08-30T00:00:00Z',
          },
        },
        projectsById: {
          p1: {
            id: 'p1',
            name: 'Test Project',
            owningInitiativeId: 'init1',
            declaredAtISO: '2026-08-30T00:00:00Z',
          },
        },
        deliverablesById: {
          blocker_item: {
            id: 'blocker_item',
            name: 'Blocker',
            owningProjectId: 'p1',
            owningInitiativeId: 'init1',
            phase: 'phase1',
            targetDate: null,
            reviewStatus: 'CONFIRMED',
            declaredAtISO: '2026-08-30T00:00:00Z',
          },
          blocked_item: {
            id: 'blocked_item',
            name: 'Blocked',
            owningProjectId: 'p1',
            owningInitiativeId: 'init1',
            phase: 'phase2',
            targetDate: null,
            reviewStatus: 'CONFIRMED',
            declaredAtISO: '2026-08-30T00:00:00Z',
          },
        },
        artifactsById: {},
        systemsById: {},
        dependenciesById: {
          dep1: {
            id: 'dep1',
            upstreamId: 'blocker_item',  // Fixed: using semantic names
            downstreamId: 'blocked_item',
            kind: 'blocks',
          },
        },
      },
      masterPlanLanesById: {
        lane1: {
          id: 'lane1',
          laneEnd: '2026-09-09T23:59:59Z', // 10 days away = HIGH threshold (7-21 day range)
        },
      },
      masterPlanMilestonesById: {},
      planBlocks: {},
      appTime: {
        activeDayKey: '2026-08-30',
        timeIsPinned: true,
        nowISO: '2026-08-30T12:00:00.000Z',
      },
    };

    const derived = computeDerivedState(state, { type: 'INIT' });
    const ranking = derived.deliverableUrgencyRanking;

    // Blocker gets HIGH urgency (10-day deadline in 7-21 day range)
    expect(ranking['blocker_item']).toBeDefined();
    expect(ranking['blocker_item'].urgencyBand).toBe('HIGH');
    expect(ranking['blocker_item'].daysToDeadline).toBeLessThan(21);
    expect(ranking['blocker_item'].daysToDeadline).toBeGreaterThan(7);
  });
});
