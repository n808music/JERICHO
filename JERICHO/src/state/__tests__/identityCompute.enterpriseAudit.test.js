import { describe, it, expect } from 'vitest';
import { applyEnterpriseIdentityAudit } from '../identityCompute.js';

function buildMinimalState({ goalText = '', laneIds = [], blocks = [] } = {}) {
  return {
    activeProfileId: 'p1',
    profilesById: { p1: { id: 'p1', activeCoreMissionContractId: 'm1' } },
    coreMissionContractsById: {
      m1: { id: 'm1', goalText },
    },
    masterPlansById: {
      plan1: {
        id: 'plan1',
        coreMissionContractId: 'm1',
        laneIds,
      },
    },
    masterPlanLanesById: laneIds.reduce((acc, laneId) => {
      acc[laneId] = { id: laneId, domain: laneId, label: laneId };
      return acc;
    }, {}),
    days: blocks.length > 0 ? [{ blocks }] : [],
  };
}

describe('applyEnterpriseIdentityAudit', () => {
  it('attaches enterpriseProjections and enterpriseIdentityAudit to the state', () => {
    const next = buildMinimalState({
      goalText: 'product, civic pathways',
      laneIds: ['product', 'civic'],
    });
    applyEnterpriseIdentityAudit(next);
    expect(Array.isArray(next.enterpriseProjections)).toBe(true);
    expect(next.enterpriseProjections.length).toBe(2);
    expect(next.enterpriseIdentityAudit).toBeDefined();
    expect(Array.isArray(next.enterpriseIdentityAudit.findings)).toBe(true);
  });

  it('projects civic as Global State Holdings', () => {
    const next = buildMinimalState({
      goalText: 'civic pathways',
      laneIds: ['civic'],
    });
    applyEnterpriseIdentityAudit(next);
    const civicProjection = next.enterpriseProjections.find((p) => p.internalLane === 'civic');
    expect(civicProjection?.displayName).toBe('Global State Holdings');
  });

  it('emits no findings when chart rows already use founder-facing names', () => {
    const next = buildMinimalState({
      goalText: 'product, civic',
      laneIds: ['product', 'civic'],
    });
    applyEnterpriseIdentityAudit(next);
    // With clean projections and no malformed chart rows or blocks, audit should have zero findings.
    expect(next.enterpriseIdentityAudit.findings.length).toBe(0);
  });

  it('handles empty state without crashing', () => {
    const next = {};
    applyEnterpriseIdentityAudit(next);
    expect(next.enterpriseProjections).toEqual([]);
    expect(next.enterpriseIdentityAudit.findings).toEqual([]);
  });
});
