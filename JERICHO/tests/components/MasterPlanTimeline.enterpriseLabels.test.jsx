import React from 'react';
import '@testing-library/jest-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import MasterPlanTimeline from '../../src/ui/masterPlan/MasterPlanTimeline.jsx';

let mockStore = {};

vi.mock('../../src/state/identityStore.js', async () => {
  const actual = await vi.importActual('../../src/state/identityStore.js');
  return {
    ...actual,
    useIdentityStore: () => mockStore,
  };
});

afterEach(() => {
  mockStore = {};
  cleanup();
});

function buildStoreWithLanes(laneDomains) {
  const laneTitleByDomain = {
    product: 'Operation Endgame app platform',
    creative: 'Operation Endgame album release engine',
    media: 'Operation Endgame media narrative pipeline',
    brand: 'Operation Endgame studio operations system',
    income: 'Operation Endgame services revenue bridge',
    capital: 'Operation Endgame capital stack',
    institution: 'Operation Endgame apprenticeship institution design',
    civic: 'Operation Endgame district coalition development',
    energy_gym: 'F8 Energy Gum',
  };
  const lanes = laneDomains.map((domain, i) => ({
    id: `${domain}-${i}`,
    domain,
    label: domain,
    title: laneTitleByDomain[domain] || `${domain} lane`,
    milestoneIds: [],
    activationState: 'active',
  }));
  const planId = 'plan-enterprise-test';
  const agendaVersionId = 'agenda-v1';
  const masterPlan = {
    id: planId,
    laneIds: lanes.map((lane) => lane.id),
    coreMissionContractId: null,
    anchors: [],
    milestones: [],
    phases: [],
    horizonEndDayKey: '2031-01-01',
    startDayKey: '2026-01-01',
    goalText: 'product, creative, media, operations, civic pathways across 5 years',
    policyState: null,
    structureCritic: null,
    currentAgendaVersionId: agendaVersionId,
    currentScheduleConstraintVersionId: null,
  };
  const lanesById = lanes.reduce((acc, lane) => {
    acc[lane.id] = lane;
    return acc;
  }, {});
  // Build full-horizon blocks so the byLane summary has data to show
  const fullHorizonScheduleBlocks = lanes.map((lane, i) => ({
    id: `block-${lane.id}-${i}`,
    masterPlanId: planId,
    masterPlanLaneId: lane.id,
    laneId: lane.id,
    phaseLabel: 'P1',
    dayKey: `2026-0${(i % 9) + 1}-01`,
  }));
  return {
    activeMissionContract: {
      goalText: 'product, creative, media, operations, civic pathways across 5 years',
    },
    activeMasterPlan: masterPlan,
    masterPlan,
    masterPlanLanesById: lanesById,
    masterPlansById: { [planId]: masterPlan },
    masterPlanLanesByPlanId: { [planId]: lanes },
    profilesById: {
      'default-profile': {
        id: 'default-profile',
        activeMasterPlanId: planId,
        activeCoreMissionContractId: null,
        goalIds: [],
        strategicClusterIds: [],
        masterCalendarId: null,
      },
    },
    activeProfileId: 'default-profile',
    goalsById: {},
    cyclesById: {},
    coreMissionContractsById: {},
    masterPlanAgendaVersionsById: {
      [agendaVersionId]: {
        id: agendaVersionId,
        state: 'current',
        blockCount: fullHorizonScheduleBlocks.length,
        range: { startDayKey: '2026-01-01', endDayKey: '2031-01-01' },
        summary: { totalBlocks: fullHorizonScheduleBlocks.length, scheduledCount: fullHorizonScheduleBlocks.length, unscheduledCount: 0 },
        byLane: lanes.reduce((acc, lane) => { acc[lane.id] = 1; return acc; }, {}),
      },
    },
    scheduleConstraintVersionsById: {},
    fullHorizonScheduleBlocks,
    proposedBlocks: [],
    proposedBlocksByCycleId: {},
    masterCalendarsById: {},
    strategicClustersById: {},
    constraintRelations: [],
  };
}

describe('MasterPlanTimeline enterprise-facing labels', () => {
  it('renders Global State Holdings instead of Civic for the civic lane', () => {
    mockStore = buildStoreWithLanes(['civic']);
    render(<MasterPlanTimeline />);
    expect(screen.getAllByText('Global State Holdings').length).toBeGreaterThan(0);
    expect(screen.queryAllByText(/^Civic$/)).toHaveLength(0);
  });

  it('renders F8 Energy Co. (not E8) for the energy_gym lane', () => {
    mockStore = buildStoreWithLanes(['energy_gym']);
    render(<MasterPlanTimeline />);
    expect(screen.queryAllByText(/E8 Energy Co\./)).toHaveLength(0);
    expect(screen.getAllByText('F8 Energy Co.')).toHaveLength(2);
  });

  it('renders Global State Systems for product lane', () => {
    mockStore = buildStoreWithLanes(['product']);
    render(<MasterPlanTimeline />);
    expect(screen.getAllByText('Global State Systems').length).toBeGreaterThan(0);
  });

  it('renders the full canonical entity matrix with F8 present and Capital shown once', () => {
    mockStore = buildStoreWithLanes(['product', 'creative', 'media', 'brand', 'income', 'capital', 'institution', 'civic']);
    render(<MasterPlanTimeline />);

    expect(screen.getAllByText('Global State Systems').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Global State Corp.').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Global State Productions').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Global State Solutions').length).toBeGreaterThan(0);
    expect(screen.getAllByText('F8 Energy Co.').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Capital Path or Revenue Engine')).toHaveLength(2);
    expect(screen.getAllByText('Global State Academy').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Global State Holdings').length).toBeGreaterThan(0);
  });

  it('projects the bottom lane overview from the same canonical entity set as the agenda controls', () => {
    mockStore = buildStoreWithLanes(['product', 'creative', 'media', 'brand', 'income', 'capital', 'institution', 'civic']);
    render(<MasterPlanTimeline />);

    const agendaLaneLabels = screen
      .getAllByTestId(/^scheduled-agenda-lane-/)
      .map((node) => node.textContent?.trim())
      .filter((label) => label && label !== 'All lanes');
    const overviewLaneLabels = screen
      .getAllByTestId(/^timeline-lane-/)
      .map((node) => node.querySelector('span')?.textContent?.trim())
      .filter(Boolean);

    expect(new Set(overviewLaneLabels)).toEqual(new Set(agendaLaneLabels));
    expect(overviewLaneLabels.filter((label) => label === 'Capital Path or Revenue Engine')).toHaveLength(1);
    expect(overviewLaneLabels).toContain('F8 Energy Co.');
    expect(overviewLaneLabels.some((label) => /Operation Endgame capi/i.test(label))).toBe(false);
    expect(overviewLaneLabels.some((label) => /Operation Endgame civic/i.test(label))).toBe(false);
    expect(overviewLaneLabels.some((label) => /Operation Endgame insti/i.test(label))).toBe(false);
  });
});
