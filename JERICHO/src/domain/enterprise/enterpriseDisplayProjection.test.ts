import { describe, it, expect } from 'vitest';
import { projectEnterpriseDisplay } from './enterpriseDisplayProjection';

describe('projectEnterpriseDisplay', () => {
  const OE_INTAKE = {
    goalText:
      'Build product, creative, media, operations, revenue, capital, institution, and civic pathways. Funded capital pathway by 2031.',
    declaredLaneIds: [
      'product', 'creative', 'media', 'operations',
      'revenue', 'capital', 'institution', 'civic',
    ],
  };

  it('projects product as Global State Systems / Jericho with intake_declared', () => {
    const projection = projectEnterpriseDisplay({
      laneId: 'product',
      laneLabel: 'Product',
      intakeSignals: OE_INTAKE,
    });
    expect(projection.displayName).toBe('Global State Systems');
    expect(projection.displaySubtitle).toContain('Jericho');
    expect(projection.companyCategory).toBe('Technology');
    expect(projection.provenanceStatus).toBe('intake_declared');
    expect(projection.phaseScope).toBe('P1-P3');
  });

  it('projects civic as Global State Holdings with intake_normalized and Real Estate warning', () => {
    const projection = projectEnterpriseDisplay({
      laneId: 'civic',
      laneLabel: 'Civic',
      intakeSignals: OE_INTAKE,
    });
    expect(projection.displayName).toBe('Global State Holdings');
    expect(projection.companyCategory).toBe('Real Estate');
    expect(projection.provenanceStatus).toBe('intake_normalized');
    expect(projection.phaseScope).toBe('P2-P3');
    expect(projection.priorityStatus).toBe('deferred');
    expect(projection.warnings?.[0]).toMatch(/Real Estate is not P1-critical/);
  });

  it('projects energy_gym with no intake support as F8 Energy Co. system_placeholder', () => {
    const projection = projectEnterpriseDisplay({
      laneId: 'energy_gym',
      laneLabel: 'Energy Gym',
      intakeSignals: OE_INTAKE,
    });
    expect(projection.displayName).toBe('F8 Energy Co.');
    expect(projection.provenanceStatus).toBe('system_placeholder');
    expect(projection.priorityStatus).toBe('deferred');
  });

  it('marks capital/revenue lanes as unsupported (not business entities)', () => {
    const projection = projectEnterpriseDisplay({
      laneId: 'income',
      laneLabel: 'Operation Endgame services revenue bridge',
      intakeSignals: OE_INTAKE,
    });
    expect(projection.entityId).toBe('');
    expect(projection.displayName).toBe('Operation Endgame services revenue bridge');
    expect(projection.warnings).toContain('No canonical enterprise entity matched this lane; treat as system-only until intake supports it.');
  });

  it('never produces E8 Energy Co. as a display name', () => {
    const projection = projectEnterpriseDisplay({
      laneId: 'energy_gym',
      laneLabel: 'E8 Energy Co.',
      intakeSignals: OE_INTAKE,
    });
    expect(projection.displayName).not.toBe('E8 Energy Co.');
    expect(projection.displayName).toBe('F8 Energy Co.');
  });

  it('normalizes legacy Operation Endgame product labels to Global State Systems', () => {
    const projection = projectEnterpriseDisplay({
      laneId: 'lane-7fdafe6a-1613-447b-877c-raw',
      laneLabel: 'Operation Endgame product platform',
      intakeSignals: OE_INTAKE,
    });
    expect(projection.displayName).toBe('Global State Systems');
    expect(projection.companyCategory).toBe('Technology');
  });

  it('produces unsupported projection with no display name when the lane has no map entry', () => {
    const projection = projectEnterpriseDisplay({
      laneId: 'mystery_lane',
      laneLabel: 'Mystery',
      intakeSignals: { goalText: '', declaredLaneIds: [] },
    });
    expect(projection.provenanceStatus).toBe('unsupported');
    expect(projection.displayName).toBe('Mystery');
    expect(projection.warnings?.[0]).toMatch(/no canonical enterprise entity/i);
  });
});
