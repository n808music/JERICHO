import { describe, it, expect } from 'vitest';
import { evaluateEnterpriseIdentityAudit } from './evaluateEnterpriseIdentityAudit';
import { projectEnterpriseDisplay } from './enterpriseDisplayProjection';

const OE_INTAKE = {
  goalText:
    'Build product, creative, media, operations, revenue, capital, institution, and civic pathways.',
  declaredLaneIds: [
    'product', 'creative', 'media', 'operations',
    'revenue', 'capital', 'institution', 'civic',
  ],
};

describe('evaluateEnterpriseIdentityAudit', () => {
  it('emits no failures when civic resolves to Global State Holdings normalized', () => {
    const projections = [
      projectEnterpriseDisplay({ laneId: 'civic', laneLabel: 'Civic', intakeSignals: OE_INTAKE }),
    ];
    const audit = evaluateEnterpriseIdentityAudit({
      projections,
      chartRows: projections.map((p) => ({ primaryLabel: p.displayName, laneId: p.internalLane })),
      blocks: [],
    });
    expect(audit.findings.filter((f) => f.code === 'CIVIC_LABEL_NOT_NORMALIZED')).toHaveLength(0);
  });

  it('emits CIVIC_LABEL_NOT_NORMALIZED when the chart still renders "Civic" as the primary label', () => {
    const projections = [
      projectEnterpriseDisplay({ laneId: 'civic', laneLabel: 'Civic', intakeSignals: OE_INTAKE }),
    ];
    const audit = evaluateEnterpriseIdentityAudit({
      projections,
      chartRows: [{ primaryLabel: 'Civic', laneId: 'civic' }],
      blocks: [],
    });
    expect(audit.findings.some((f) => f.code === 'CIVIC_LABEL_NOT_NORMALIZED')).toBe(true);
  });

  it('emits INCORRECT_ENTERPRISE_ENTITY_NAME when E8 Energy Co. appears anywhere', () => {
    const projections = [
      projectEnterpriseDisplay({ laneId: 'energy_gym', laneLabel: 'Energy Gym', intakeSignals: OE_INTAKE }),
    ];
    const audit = evaluateEnterpriseIdentityAudit({
      projections,
      chartRows: [{ primaryLabel: 'E8 Energy Co.', laneId: 'energy_gym' }],
      blocks: [],
    });
    const finding = audit.findings.find((f) => f.code === 'INCORRECT_ENTERPRISE_ENTITY_NAME');
    expect(finding).toBeDefined();
    expect(finding?.detail).toMatch(/F8 Energy Co/);
  });

  it('emits DISPLAY_ROW_USES_INTERNAL_LANE_NAME when chart label looks like an internal id', () => {
    const projections = [
      projectEnterpriseDisplay({ laneId: 'product', laneLabel: 'Product', intakeSignals: OE_INTAKE }),
    ];
    const audit = evaluateEnterpriseIdentityAudit({
      projections,
      chartRows: [{ primaryLabel: 'Operation Endgame product proof...', laneId: 'product' }],
      blocks: [],
    });
    expect(audit.findings.some((f) => f.code === 'DISPLAY_ROW_USES_INTERNAL_LANE_NAME')).toBe(true);
  });

  it('emits REAL_ESTATE_P1_EXECUTION_UNJUSTIFIED when a Real Estate block is scheduled in P1 without justification', () => {
    const projections = [
      projectEnterpriseDisplay({ laneId: 'civic', laneLabel: 'Civic', intakeSignals: OE_INTAKE }),
    ];
    const audit = evaluateEnterpriseIdentityAudit({
      projections,
      chartRows: [{ primaryLabel: 'Global State Holdings', laneId: 'civic' }],
      blocks: [
        {
          id: 'block-x',
          laneId: 'civic',
          phaseLabel: 'P1',
          blockType: 'execution',
          gatesJustification: null,
        },
      ],
    });
    expect(audit.findings.some((f) => f.code === 'REAL_ESTATE_P1_EXECUTION_UNJUSTIFIED')).toBe(true);
  });

  it('emits BLOCK_DETAIL_TOO_ABSTRACT when block has no concrete artifact or evidence', () => {
    const projections = [
      projectEnterpriseDisplay({ laneId: 'product', laneLabel: 'Product', intakeSignals: OE_INTAKE }),
    ];
    const audit = evaluateEnterpriseIdentityAudit({
      projections,
      chartRows: [{ primaryLabel: 'Global State Systems', laneId: 'product' }],
      blocks: [
        {
          id: 'block-y',
          laneId: 'product',
          phaseLabel: 'P1',
          blockType: 'execution',
          expectedOutput: '',
          acceptanceEvidence: '',
        },
      ],
    });
    expect(audit.findings.some((f) => f.code === 'BLOCK_DETAIL_TOO_ABSTRACT')).toBe(true);
  });

  it('emits BLOCK_PROVENANCE_MISSING when a block has no resolvable lane or entity', () => {
    const audit = evaluateEnterpriseIdentityAudit({
      projections: [],
      chartRows: [],
      blocks: [
        {
          id: 'block-z',
          laneId: null,
          phaseLabel: 'P1',
          blockType: 'execution',
        },
      ],
    });
    expect(audit.findings.some((f) => f.code === 'BLOCK_PROVENANCE_MISSING')).toBe(true);
  });
});
