import { describe, it, expect } from 'vitest';
import {
  CONVERGENCE_SLOT,
  buildConvergenceDeclarePayload,
} from '../../../src/domain/elicitation/convergenceSlot.ts';

// Multi-source convergence (2026-07-10): several parts of the operation often
// feed one destination (the operator's own workbook models exactly this —
// content + music + broadcast all feed the marketing flywheel). The source
// answer accepts an array; legacy single-string answers keep working.

const SNAP = {
  matrixSnapshot: {
    entitiesById: { 'ent-corp': { id: 'ent-corp' } },
    systemsById: { 'sys-music': { id: 'sys-music' }, 'sys-flywheel': { id: 'sys-flywheel' } },
    initiativesById: {},
    projectsById: { 'proj-ofl': { id: 'proj-ofl' } },
    artifactsById: {},
  },
};

const gate = (code) => CONVERGENCE_SLOT.gate.find((g) => g.code === code);

describe('convergence slot — multi-source answers', () => {
  it('array of declared sources resolves the from gates', () => {
    const captured = { fromNodeId: ['sys-music', 'proj-ofl'] };
    expect(gate('CONVERGENCE_FROM_MISSING').detect(captured)).toBe(false);
    expect(gate('CONVERGENCE_FROM_UNRESOLVED').detect(captured, SNAP)).toBe(false);
  });

  it('empty array is missing; an undeclared member is unresolved', () => {
    expect(gate('CONVERGENCE_FROM_MISSING').detect({ fromNodeId: [] })).toBe(true);
    expect(
      gate('CONVERGENCE_FROM_UNRESOLVED').detect({ fromNodeId: ['sys-music', 'ghost'] }, SNAP)
    ).toBe(true);
  });

  it('self-edge fires when the destination is ANY of the sources', () => {
    expect(
      gate('CONVERGENCE_SELF_EDGE').detect({ fromNodeId: ['sys-music', 'sys-flywheel'], toNodeId: 'sys-flywheel' })
    ).toBe(true);
    expect(
      gate('CONVERGENCE_SELF_EDGE').detect({ fromNodeId: ['sys-music'], toNodeId: 'sys-flywheel' })
    ).toBe(false);
  });

  it('payload carries every source; legacy scalar mirrors the first', () => {
    const p = buildConvergenceDeclarePayload({
      fromNodeId: ['sys-music', 'proj-ofl'],
      toNodeId: 'sys-flywheel',
      gives: 'creates awareness that feeds the funnel',
    });
    expect(p.fromNodeIds).toEqual(['sys-music', 'proj-ofl']);
    expect(p.fromNodeId).toBe('sys-music');
    expect(p.toNodeId).toBe('sys-flywheel');
  });

  it('legacy single-string answers still work end to end', () => {
    const captured = { fromNodeId: 'sys-music', toNodeId: 'sys-flywheel', gives: 'creates awareness' };
    expect(gate('CONVERGENCE_FROM_MISSING').detect(captured)).toBe(false);
    expect(gate('CONVERGENCE_SELF_EDGE').detect(captured)).toBe(false);
    const p = buildConvergenceDeclarePayload(captured);
    expect(p.fromNodeId).toBe('sys-music');
    expect(p.fromNodeIds).toEqual(['sys-music']);
  });
});
